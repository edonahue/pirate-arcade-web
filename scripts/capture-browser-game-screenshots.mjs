#!/usr/bin/env node
/**
 * Capture real in-game screenshots from all browser-playable games
 * by booting each game shell in headless Chromium via Playwright,
 * waiting for the runtime to signal ready, simulating a start
 * input, hiding the shell UI, and snapshotting the live canvas.
 *
 * Supports both Pygbag games (via __paBootMetrics) and web-native
 * Phaser games (via canvas detection in game-container).
 *
 * Game list is read from `src/data/games.json` (filtering to
 * browser-playable). Start keys and post-start inputs are in small
 * per-game maps. Preview readiness is detected via HTTP polling rather
 * than stdout parsing. Console errors are classified with an allowlist
 * of known harmless noise.
 *
 * Output: `public/images/screenshot-<id>.png` at exactly 1280x720 PNG.
 *
 * Usage:
 *   npm run build
 *   node scripts/capture-browser-game-screenshots.mjs
 *
 * The package script `npm run capture:screenshots` chains the build.
 *
 * Port Royale Tycoon is intentionally NOT captured here (desktop-only).
 */

import { chromium } from "playwright";
import sharp from "sharp";
import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as wait } from "node:timers/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(REPO_ROOT, "public", "images");

const gamesMeta = JSON.parse(
  readFileSync(resolve(REPO_ROOT, "src/data/games.json"), "utf-8"),
);
const START_KEYS = {
  "cannonball-clash": "Enter",
  "treasure-cove": "Space",
  "krakens-wake": "Enter",
  "race-to-treasure-island": "Enter",
};
const GAMES = gamesMeta
  .filter((g) => g.status === "browser-playable")
  .map((g) => ({
    id: g.id,
    title: g.title,
    startKey: START_KEYS[g.id] ?? "Enter",
    engine: g.engine || "pygbag",
  }));

const OUT_W = 1280;
const OUT_H = 720;
const PREVIEW_PORT = Number(process.env.PA_CAPTURE_PORT || 4321);
const PREVIEW_HOST = process.env.PA_CAPTURE_HOST || "127.0.0.1";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}`;
const READY_TIMEOUT_MS = 90_000;
const POST_START_SETTLE_MS = 8_000;
const PREVIEW_START_TIMEOUT_MS = 15_000;
const HIDE_UI_SELECTORS = [
  "#back-link",
  "#controls-hint",
  "#infobox",
  "#touch-overlay",
  "#touch-controls",
  ".hud-overlay",
];

/** Known harmless console.error patterns from game shells. */
const ALLOWED_ERROR_PATTERNS = [
  /PyMain: BrowserFS not found/i,
  /pygbag.*failed to load sound/i,
  /pygbag.*sound.*not supported/i,
  /Pygbag.*unable to/i,
  /404.*favicon/i,
  /404.*\.ico/i,
];

async function waitForHttpOk(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 304) return;
    } catch {
      // not ready yet
    }
    await wait(500);
  }
  throw new Error(
    `Preview at ${url} not ready within ${timeoutMs}ms (process may have failed to start or port is in use)`,
  );
}

function startPreview() {
  return new Promise((resolveP, rejectP) => {
    const proc = spawn(
      "npx",
      [
        "astro",
        "preview",
        "--host",
        PREVIEW_HOST,
        "--port",
        String(PREVIEW_PORT),
      ],
      {
        cwd: REPO_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, HOST: PREVIEW_HOST },
      },
    );
    let settled = false;

    proc.stdout.on("data", (c) => process.stdout.write(`[preview] ${c}`));
    proc.stderr.on("data", (c) => process.stderr.write(`[preview-err] ${c}`));

    proc.on("exit", (code) => {
      if (!settled) {
        settled = true;
        rejectP(
          new Error(
            `astro preview exited early with code ${code ?? "null"} on ${PREVIEW_URL}`,
          ),
        );
      }
    });

    waitForHttpOk(PREVIEW_URL, PREVIEW_START_TIMEOUT_MS)
      .then(() => {
        if (!settled) {
          settled = true;
          resolveP(proc);
        }
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          rejectP(err);
        }
      });
  });
}

function stopPreview(proc) {
  if (!proc || proc.killed) return;
  try {
    proc.kill("SIGTERM");
  } catch {
    // best-effort
  }
}

async function hideShellUI(page) {
  await page.evaluate((selectors) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) el.style.display = "none";
    }
  }, HIDE_UI_SELECTORS);
}

async function waitForGameReady(page) {
  await page.waitForFunction(
    () => {
      const c = document.getElementById("canvas");
      if (c) {
        // Pygbag game detection
        const tr = document.getElementById("transfer");
        const ov = document.getElementById("game-loading");
        const ib = document.getElementById("infobox");
        if (!c || !tr || !ov || !ib) return false;
        const ready =
          !!window.__paBootMetrics && !!window.__paBootMetrics["game-ready"];
        const overlayHidden = ov.classList.contains("hidden");
        const canvasSized = c.width > 100 && c.height > 100;
        const canvasVisible = (() => {
          const cs = window.getComputedStyle(c);
          return cs.visibility === "visible" && cs.display !== "none";
        })();
        return ready && overlayHidden && canvasSized && canvasVisible;
      }

      // Web-native (Phaser) game detection
      const gc = document.getElementById("game-container");
      const canvas = gc ? gc.querySelector("canvas") : null;
      const loadingEl = document.getElementById("game-loading");
      if (!gc || !canvas) return false;
      const ready =
        !!window.__paBootMetrics && !!window.__paBootMetrics["game-ready"];
      const overlayHidden = loadingEl
        ? loadingEl.classList.contains("hidden")
        : true;
      const canvasSized = canvas.width > 100 && canvas.height > 100;
      return ready && overlayHidden && canvasSized;
    },
    null,
    { timeout: READY_TIMEOUT_MS, polling: 500 },
  );
}

async function captureDiagnostics(page) {
  const bootMetrics = await page
    .evaluate(() => window.__paBootMetrics)
    .catch(() => null);
  const loadingDetail = await page
    .evaluate(() => {
      const el = document.getElementById("game-loading-detail");
      return el ? el.textContent : null;
    })
    .catch(() => null);
  const canvasState = await page
    .evaluate(() => {
      const c = document.getElementById("canvas");
      if (c) return { w: c.width, h: c.height };
      const gc = document.getElementById("game-container");
      const canvas = gc ? gc.querySelector("canvas") : null;
      return canvas ? { w: canvas.width, h: canvas.height } : null;
    })
    .catch(() => null);
  return { bootMetrics, loadingDetail, canvasState };
}

async function captureGame(browser, game) {
  const screenshotParam = game.engine === "phaser" ? "?screenshot" : "";
  const url = `${PREVIEW_URL}/play/${game.id}/${screenshotParam}`;
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
  });
  const page = await ctx.newPage();
  const allowlistedErrors = [];
  const criticalErrors = [];
  page.on("pageerror", (err) =>
    criticalErrors.push(`pageerror: ${err.message}`),
  );
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (ALLOWED_ERROR_PATTERNS.some((p) => p.test(text))) {
        allowlistedErrors.push(text);
      } else {
        criticalErrors.push(`console.error: ${text}`);
      }
    }
  });

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Unlock audio + create a user gesture for autoplay policy.
    await page.locator("body").click({
      position: { x: 10, y: 10 },
      timeout: 5_000,
    });

    await waitForGameReady(page);
    await hideShellUI(page);
    await page.keyboard.press(game.startKey);
    await wait(POST_START_SETTLE_MS);
    await hideShellUI(page);

    // Check that the game didn't crash or revert to loading
    const diag = await captureDiagnostics(page);
    if (
      diag.canvasState &&
      (diag.canvasState.w < 100 || diag.canvasState.h < 100)
    ) {
      throw new Error(
        `canvas shrank to ${diag.canvasState.w}x${diag.canvasState.h} after start — game may have crashed`,
      );
    }

    const dataURL = await page.evaluate(() => {
      // Try Pygbag canvas first
      const c = document.getElementById("canvas");
      if (c && c.width >= 100) {
        return c.toDataURL("image/png");
      }
      // Try web-native (Phaser) canvas
      const gc = document.getElementById("game-container");
      const canvas = gc ? gc.querySelector("canvas") : null;
      if (canvas && canvas.width >= 100) {
        return canvas.toDataURL("image/png");
      }
      throw new Error("no sized canvas found to capture");
    });

    const b64 = dataURL.replace(/^data:image\/png;base64,/, "");
    const buf = Buffer.from(b64, "base64");

    const outPath = resolve(OUT_DIR, `screenshot-${game.id}.png`);
    await sharp(buf)
      .resize(OUT_W, OUT_H, { fit: "fill" })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    const s = await stat(outPath);
    console.log(
      `  \u2713 ${game.id}: ${OUT_W}x${OUT_H} ${(s.size / 1024).toFixed(1)} KB`,
    );

    if (allowlistedErrors.length) {
      console.warn(
        `  [allowlisted] ${allowlistedErrors.length} known harmless error(s):`,
      );
      for (const e of allowlistedErrors.slice(0, 3)) console.warn(`    ${e}`);
    }
  } catch (err) {
    const diag = await captureDiagnostics(page).catch(() => ({}));
    console.error(`  \u2717 failed: ${err.message}`);
    if (diag.bootMetrics) {
      console.error(`    __paBootMetrics: ${JSON.stringify(diag.bootMetrics)}`);
    }
    if (diag.loadingDetail) {
      console.error(`    #game-loading-detail: "${diag.loadingDetail}"`);
    }
    if (diag.canvasState) {
      console.error(`    canvas: ${diag.canvasState.w}x${diag.canvasState.h}`);
    }
    throw err;
  } finally {
    await page.close();
    await ctx.close();
  }
}

async function main() {
  const distMarker = resolve(
    REPO_ROOT,
    "dist",
    "play",
    "cannonball-clash",
    "index.html",
  );
  if (!existsSync(distMarker)) {
    throw new Error(
      `dist/ missing or stale (${distMarker} not found). Run \`npm run build\` first.`,
    );
  }
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Starting astro preview at ${PREVIEW_URL} ...`);
  const preview = await startPreview();
  console.log(`Preview ready.`);
  let exitCode = 0;
  try {
    const browser = await chromium.launch({ headless: true });
    try {
      for (const game of GAMES) {
        console.log(`\n\u2192 ${game.title} (${game.id}, ${game.engine})`);
        await captureGame(browser, game);
      }
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error(`\n\u2717 capture failed: ${err.message}`);
    exitCode = 1;
  } finally {
    stopPreview(preview);
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
