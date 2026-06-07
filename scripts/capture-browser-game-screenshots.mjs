#!/usr/bin/env node
/**
 * Capture real in-game screenshots from the 3 browser-playable Pygbag
 * games (Cannonball Clash, Treasure Cove, Kraken's Wake) by booting
 * each game shell in headless Chromium via Playwright, waiting for the
 * runtime to signal `game-ready`, simulating a start input, hiding the
 * shell UI, and snapshotting the live canvas via `canvas.toDataURL()`.
 *
 * Output: `public/images/screenshot-<id>.png` at exactly 1280x720 PNG.
 *
 * Usage:
 *   npm run build
 *   node scripts/capture-browser-game-screenshots.mjs
 *
 * The package script `npm run capture:screenshots` chains the build for you.
 *
 * The script:
 *   1. Verifies `dist/play/cannonball-clash/index.html` exists (i.e. the
 *      site was built); otherwise fails with a clear message.
 *   2. Starts `astro preview` on a free port (default 4321) and waits for
 *      the server to be ready.
 *   3. For each of the 3 games, launches a headless Chromium context at
 *      1280x720 viewport, navigates to `/play/<id>/`, unlocks audio with
 *      a synthetic click, waits for `__paBootMetrics["game-ready"]` AND
 *      `#game-loading.hidden` AND canvas visible + sized, hides the
 *      shell UI (#back-link, #controls-hint, #infobox, #touch-overlay),
 *      presses the per-game start key, waits 3s for a few gameplay
 *      frames to render, hides any UI that re-appeared, then reads
 *      `canvas.toDataURL("image/png")` from the page.
 *   4. Decodes the dataURL in Node, resizes the captured 1600x900 frame
 *      down to 1280x720 via Sharp (already a dep), and writes the
 *      output PNG to `public/images/screenshot-<id>.png`.
 *   5. Stops `astro preview` (always).
 *
 * Port Royale Tycoon is intentionally NOT captured here (desktop-only).
 */

import { chromium } from "playwright";
import sharp from "sharp";
import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { setTimeout as wait } from "node:timers/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(REPO_ROOT, "public", "images");

const GAMES = [
  { id: "cannonball-clash", title: "Cannonball Clash", startKey: "Enter" },
  { id: "treasure-cove", title: "Treasure Cove", startKey: "Space" },
  { id: "krakens-wake", title: "Kraken's Wake", startKey: "Enter" },
];

const OUT_W = 1280;
const OUT_H = 720;
const PREVIEW_PORT = Number(process.env.PA_CAPTURE_PORT || 4321);
const PREVIEW_HOST = process.env.PA_CAPTURE_HOST || "127.0.0.1";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}`;
const READY_TIMEOUT_MS = 90_000;
const POST_START_SETTLE_MS = 3_000;
const PREVIEW_START_TIMEOUT_MS = 15_000;
const HIDE_UI_SELECTORS = [
  "#back-link",
  "#controls-hint",
  "#infobox",
  "#touch-overlay",
];

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
    const onChunk = (chunk) => {
      const s = chunk.toString();
      process.stdout.write(`[preview] ${s}`);
      if (!settled && /https?:\/\//i.test(s)) {
        settled = true;
        setTimeout(() => resolveP(proc), 400);
      }
    };
    proc.stdout.on("data", onChunk);
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
    setTimeout(() => {
      if (!settled) {
        settled = true;
        resolveP(proc);
      }
    }, PREVIEW_START_TIMEOUT_MS);
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
    },
    null,
    { timeout: READY_TIMEOUT_MS, polling: 500 },
  );
}

async function captureGame(browser, game) {
  const url = `${PREVIEW_URL}/play/${game.id}/`;
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("pageerror", (err) =>
    consoleErrors.push(`pageerror: ${err.message}`),
  );
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(`console.error: ${msg.text()}`);
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

    const dataURL = await page.evaluate(() => {
      const c = document.getElementById("canvas");
      if (!c) throw new Error("canvas#canvas missing");
      if (c.width < 100 || c.height < 100) {
        throw new Error(
          `canvas not yet sized (${c.width}x${c.height}); refusing to capture`,
        );
      }
      return c.toDataURL("image/png");
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

    if (consoleErrors.length) {
      console.warn(
        `  ! ${consoleErrors.length} non-fatal console error(s) during capture of ${game.id}:`,
      );
      for (const e of consoleErrors.slice(0, 5)) console.warn(`    ${e}`);
    }
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
        console.log(`\n\u2192 ${game.title} (${game.id})`);
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
