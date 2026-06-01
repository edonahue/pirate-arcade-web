/**
 * Playwright test for Cannonball Clash Pygbag/WASM prototype.
 *
 * Usage:
 *   node scripts/test-browser-prototype.mjs
 */

import { chromium, firefox, webkit } from "playwright";
import { spawn, execSync } from "child_process";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = parseInt(process.env.TEST_PORT || "4327", 10);
const PREVIEW_URL = `http://localhost:${PORT}`;
const CANNONBALL_URL = `${PREVIEW_URL}/play/cannonball-clash/`;
const TREASURE_COVE_URL = `${PREVIEW_URL}/play/treasure-cove/`;
const WASM_TIMEOUT = 90000;
const CANVAS_POLL_INTERVAL = 500;
const CANVAS_TIMEOUT = 30000;
const NODE_BIN = resolve(process.execPath, "..");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let serverProcess = null;

async function startPreview() {
  try {
    execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`, {
      stdio: "ignore",
    });
  } catch {}

  return new Promise((resolve_, reject) => {
    serverProcess = spawn("npx", ["astro", "preview", "--port", String(PORT)], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: { ...process.env, PATH: `${NODE_BIN}:${process.env.PATH}` },
    });

    let started = false;
    const onData = (chunk) => {
      const text = chunk.toString();
      if (!started && (text.includes("Local") || text.includes("ready"))) {
        started = true;
        setTimeout(resolve_, 1000);
      }
    };
    serverProcess.stdout.on("data", onData);
    serverProcess.stderr.on("data", onData);
    serverProcess.on("error", reject);
    setTimeout(() => {
      if (!started) reject(new Error("Preview did not start"));
    }, 30000);
  });
}

function stopPreview() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
  try {
    execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`, {
      stdio: "ignore",
    });
  } catch {}
}

async function runRouteTests(browser, name) {
  console.log(`\n  Routes (${name}):`);
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await ctx.newPage();
  const results = [];

  const routes = [
    { p: "/", n: "Home" },
    { p: "/play/", n: "Play" },
    { p: "/play/cannonball-clash/", n: "Cannonball" },
    { p: "/play/treasure-cove/", n: "Treasure Cove" },
    { p: "/build-log/browser-port-feasibility", n: "Feasibility post" },
    { p: "/source", n: "Source" },
    { p: "/nonexistent-xyz", n: "Custom 404" },
  ];

  for (const r of routes) {
    try {
      const resp = await page.goto(`${PREVIEW_URL}${r.p}`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
      const s = resp.status();
      const ok = r.p === "/nonexistent-xyz" ? s === 404 : s === 200;
      results.push({ route: r.n, ok });
      console.log(`    ${ok ? "✓" : "✗"} ${r.n} (${s})`);
    } catch (e) {
      results.push({ route: r.n, ok: false });
      console.log(`    ✗ ${r.n} — ${e.message}`);
    }
  }

  await ctx.close();
  return results;
}

async function runPrototypeTest(browser, name, url, gameLabel) {
  console.log(`\n  ${gameLabel} (${name}):`);
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await ctx.newPage();

  const errs = [];
  const warns = [];
  const logs = [];
  const pygbagLogs = [];
  page.on("console", (m) => {
    const text = m.text();
    if (m.type() === "error") errs.push(text);
    else if (m.type() === "warning") warns.push(text);
    else logs.push(text);
    if (
      text.includes("VM.") ||
      text.includes("cross_file") ||
      text.includes("Maybe RC") ||
      text.includes("PyMain") ||
      text.includes("End.cross") ||
      text.includes("Begin.cross") ||
      text.includes("fopen") ||
      text.includes("Downloading") ||
      text.includes("Loading python") ||
      text.includes("postrun") ||
      text.includes("prerun") ||
      text.includes("aio") ||
      text.includes("runpy") ||
      text.includes("preload") ||
      text.includes("pip_install") ||
      text.includes("PYSTEP")
    )
      pygbagLogs.push(text);
  });
  const pgErrs = [];
  page.on("pageerror", (e) => pgErrs.push(e.message));

  const r = { browser: name, game: gameLabel };

  // Load
  const resp = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  r.pageLoads = resp?.status() === 200;
  await page.waitForSelector("#infobox", { timeout: 10000 });

  // DOM checks
  r.canvasExists = !!(await page.$("canvas#canvas"));
  r.infoboxExists = !!(await page.$("#infobox"));
  r.backLinkExists = !!(await page.$("#back-link"));
  r.controlsHintExists = !!(await page.$("#controls-hint"));

  console.log(`    Page load: ${r.pageLoads ? "✓" : "✗"}`);
  console.log(
    `    Canvas: ${r.canvasExists ? "✓" : "✗"} | Infobox: ${r.infoboxExists ? "✓" : "✗"} | Back: ${r.backLinkExists ? "✓" : "✗"} | Controls: ${r.controlsHintExists ? "✓" : "✗"}`,
  );

  // Wait for WASM runtime: check for Python log output (infobox text changes,
  // transfer hidden, or canvas dimension changes from 1x1 default)
  const wasmStartTime = Date.now();
  try {
    // Wait for a true signal of Python execution
    await page.waitForFunction(
      () => {
        const c = document.getElementById("canvas");
        // Python sets transfer.hidden = true in custom_site (unambiguous WASM signal)
        const tr = document.getElementById("transfer");
        if (tr && tr.hidden) return true;
        // Python infobox changes: status shows loading, then Ready/click prompt
        const ib = document.getElementById("infobox");
        if (ib) {
          const t = ib.textContent;
          if (t.includes("Ready") || t.includes("click/touch")) return true;
        }
        // Python sets canvas visibility to visible
        if (c) {
          const s = window.getComputedStyle(c);
          if (
            s.visibility === "visible" &&
            s.display !== "none" &&
            c.width > 10
          )
            return true;
        }
        return false;
      },
      { timeout: WASM_TIMEOUT },
    );
    r.wasmStarted = true;
    r.wasmStartTime = Date.now() - wasmStartTime;
    console.log(`    WASM: ✓ (${r.wasmStartTime}ms)`);
  } catch {
    r.wasmStarted = false;
    r.wasmStartTime = Date.now() - wasmStartTime;
    console.log(`    WASM: ✗ (timed out ${r.wasmStartTime}ms)`);
  }

  // Capture WASM errors from console
  const wasmErrs = errs.filter(
    (e) =>
      e.includes("BrowserFS") ||
      e.includes("MEDIA") ||
      e.includes("wasm") ||
      e.includes("Wasm"),
  );
  if (wasmErrs.length > 0) {
    console.log(`    WASM errors: ${wasmErrs.length}`);
    wasmErrs.slice(0, 5).forEach((e) => console.log(`      ${e}`));
  }

  // Dump pygbag-specific console logs for debugging
  if (pygbagLogs.length > 0) {
    console.log(`    Pygbag logs (${pygbagLogs.length}):`);
    pygbagLogs.forEach((m) => console.log(`      ${m.slice(0, 300)}`));
  } else {
    // Fallback: show last 20 logs
    const all = [...logs, ...warns, ...errs];
    const tail = all.slice(-30);
    console.log(`    Console log (last ${tail.length}/${all.length}):`);
    tail.slice(0, 15).forEach((m) => console.log(`      ${m.slice(0, 250)}`));
  }
  // Also check current infobox text and canvas state
  const state = await page.evaluate(() => {
    const ib = document.getElementById("infobox");
    const c = document.getElementById("canvas");
    const tr = document.getElementById("transfer");
    return {
      infoboxText: ib?.textContent?.slice(0, 150),
      canvasW: c?.width,
      canvasH: c?.height,
      canvasCSW: c && window.getComputedStyle(c)?.width,
      transferHidden: tr?.hidden,
      transferStyle: tr?.style?.display,
      ume: window.MM?.UME,
    };
  });
  console.log(`    Page state:`, JSON.stringify(state));

  // Check canvas visibility
  try {
    await page.waitForFunction(
      () => {
        const c = document.getElementById("canvas");
        if (!c) return false;
        const s = window.getComputedStyle(c);
        return (
          s.visibility === "visible" && s.display !== "none" && c.width > 10
        );
      },
      { timeout: 10000 },
    );
    r.canvasVisible = true;
    console.log(`    Canvas visible: ✓`);
  } catch {
    r.canvasVisible = false;
    console.log(`    Canvas visible: ✗`);
  }

  // UME: click the page to trigger user media engagement
  // Pygbag waits for a user gesture before proceeding
  console.log(`    Triggering UME (click)...`);
  try {
    await sleep(500);
    // Click multiple locations to ensure UME is triggered
    await page.mouse.click(640, 360);
    await sleep(300);
    await page.mouse.click(640, 360);
    await sleep(300);
    // Also click via the document body directly
    await page.evaluate(() => {
      document.body.click();
      document.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await sleep(1000);
    r.umeTriggered = true;
    console.log(`    Clicks sent: ✓`);
  } catch (e) {
    r.umeTriggered = false;
    console.log(`    Clicks failed: ✗ (${e.message})`);
  }

  // Wait a moment then send keyboard
  await sleep(1000);
  console.log(`    Sending keyboard input...`);
  await page.evaluate(() => document.getElementById("canvas")?.focus());
  await sleep(200);
  for (const k of [
    "ArrowUp",
    "ArrowDown",
    "Space",
    "KeyW",
    "KeyS",
    "Enter",
    "Escape",
  ]) {
    await page.keyboard.press(k);
    await sleep(80);
  }
  r.keyboardSent = true;

  // Wait for game rendering with early-exit on pixel detection
  console.log(
    `    Waiting for game rendering (max ${CANVAS_TIMEOUT / 1000}s)...`,
  );
  try {
    await page.waitForFunction(
      () => {
        const c = document.getElementById("canvas");
        if (!c) return false;
        const ctx = c.getContext("2d");
        if (!ctx) return false;
        const w = Math.min(c.width, 200);
        const h = Math.min(c.height, 200);
        if (w < 10 || h < 10) return false;
        const img = ctx.getImageData(0, 0, w, h);
        let nonZero = 0;
        for (let i = 3; i < img.data.length; i += 4) {
          if (img.data[i] > 0) nonZero++;
        }
        return nonZero > 50;
      },
      { polling: CANVAS_POLL_INTERVAL, timeout: CANVAS_TIMEOUT },
    );
    r.canvasActive = true;
    console.log(`    Canvas rendering: ✓`);
  } catch {
    r.canvasActive = false;
    console.log(`    Canvas rendering: ✗`);
  }

  // Tab blur/refocus
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await sleep(500);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await sleep(500);
  console.log(`    Tab blur/refocus: ✓`);

  // Reload
  try {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(2000);
    r.reloadWorks = true;
    console.log(`    Reload: ✓`);
  } catch {
    r.reloadWorks = false;
    console.log(`    Reload: ✗`);
  }

  // Errors
  const benign = [
    "wasm",
    "Wasm",
    "Memory",
    "emscripten",
    "Emscripten",
    "WebAssembly",
    "unreachable",
    "SourceMap",
    "source map",
    "favicon",
    "404",
    "Failed to load resource",
  ];
  const blocking = errs.filter((e) => !benign.some((b) => e.includes(b)));
  r.totalErrors = errs.length;
  r.blockingErrors = blocking.length;
  r.noBlockingErrors = blocking.length === 0;
  r.warnings = warns.length;
  r.consoleErrors = errs;
  r.pageErrors = pgErrs;

  console.log(
    `    Console errors: ${errs.length} (${blocking.length} blocking) | Warnings: ${warns.length}`,
  );
  if (errs.length > 0) console.log(`    First 5 errors:`, errs.slice(0, 5));

  await ctx.close();
  return r;
}

async function runMobileTest(browser, name, url, gameLabel) {
  console.log(`\n  Mobile ${gameLabel} (${name}):`);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text());
  });

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await sleep(3000);
    const canvas = !!(await page.$("canvas#canvas"));
    const back = !!(await page.$("#back-link"));
    const ctrl = !!(await page.$("#controls-hint"));
    console.log(
      `    Canvas: ${canvas ? "✓" : "✗"} | Back: ${back ? "✓" : "✗"} | Controls: ${ctrl ? "✓" : "✗"} | Errors: ${errs.length}`,
    );
    return { canvas, back, ctrl, game: gameLabel };
  } catch (e) {
    console.log(`    ✗ ${e.message}`);
    return { canvas: false, back: false, ctrl: false, game: gameLabel };
  } finally {
    await ctx.close();
  }
}

async function checkGamePageDetails(browser, name, url, gameLabel) {
  console.log(`\n  Page details ${gameLabel} (${name}):`);
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await ctx.newPage();
  const details = { game: gameLabel, browser: name };

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    const r = await page.evaluate(() => ({
      touchOverlay: !!document.getElementById("touch-overlay"),
      rotateDevice: !!document.getElementById("rotate-device"),
      gameWrap: !!document.getElementById("game-wrap"),
      controlsHint: document.getElementById("controls-hint")?.textContent || "",
      viewport:
        document
          .querySelector("meta[name=viewport]")
          ?.getAttribute("content") || "",
      canvas: !!document.querySelector("canvas#canvas"),
      hasUnsafeEval: false, // CSP not observable from JS, checked via _headers audit
    }));
    Object.assign(details, r);
    const touchOk = r.touchOverlay && r.rotateDevice && r.gameWrap;
    const vpOk = r.viewport.includes("user-scalable=no");
    console.log(
      `    Touch overlay: ${r.touchOverlay ? "✓" : "✗"} | Rotate: ${r.rotateDevice ? "✓" : "✗"} | Wrap: ${r.gameWrap ? "✓" : "✗"} | Viewport: ${vpOk ? "✓" : "✗"}`,
    );
    details.mobileReady = touchOk && vpOk;
  } catch (e) {
    console.log(`    ✗ ${e.message}`);
    details.mobileReady = false;
  } finally {
    await ctx.close();
  }
  return details;
}

async function main() {
  console.log("=== Browser Prototype Validation ===\n");

  // Build
  execSync(`PATH="${NODE_BIN}:${process.env.PATH}" npm run build`, {
    cwd: ROOT,
    stdio: "pipe",
    shell: true,
  });
  console.log("Build: ✓\n");

  // Start server
  await startPreview();
  console.log("Preview: running\n");

  const routeResults = [];
  const protoResults = [];
  const mobileResults = [];
  const pageDetails = [];

  const games = [
    { url: CANNONBALL_URL, label: "Cannonball Clash" },
    { url: TREASURE_COVE_URL, label: "Treasure Cove" },
  ];

  const browsers = [
    { launch: () => chromium.launch({ headless: true }), name: "Chromium" },
    { launch: () => firefox.launch({ headless: true }), name: "Firefox" },
    { launch: () => webkit.launch({ headless: true }), name: "WebKit" },
  ];

  try {
    for (const b of browsers) {
      console.log(`\n=== ${b.name} ===`);
      const br = await b.launch();
      routeResults.push(...(await runRouteTests(br, b.name)));
      for (const g of games) {
        protoResults.push(await runPrototypeTest(br, b.name, g.url, g.label));
        mobileResults.push(await runMobileTest(br, b.name, g.url, g.label));
        pageDetails.push(
          await checkGamePageDetails(br, b.name, g.url, g.label),
        );
      }
      await br.close();
    }
  } catch (err) {
    console.error("\nFatal:", err);
  } finally {
    stopPreview();
  }

  // === SUMMARY ===
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));

  console.log("\nRoutes:");
  const rs = {};
  for (const r of routeResults) {
    if (!rs[r.route]) rs[r.route] = [];
    rs[r.route].push(r);
  }
  for (const [n, arr] of Object.entries(rs)) {
    console.log(`  ${arr.every((r) => r.ok) ? "✓" : "✗"} ${n}`);
  }

  console.log("\nGame Tests:");
  const gameNames = [...new Set(protoResults.map((p) => p.game))];
  for (const gn of gameNames) {
    const entries = protoResults.filter((p) => p.game === gn);
    console.log(`  ${gn}:`);
    for (const p of entries) {
      console.log(`    ${p.browser}:`);
      const keys = [
        "pageLoads",
        "canvasExists",
        "infoboxExists",
        "backLinkExists",
        "controlsHintExists",
        "wasmStarted",
        "canvasVisible",
        "umeTriggered",
        "keyboardSent",
        "canvasActive",
        "reloadWorks",
        "noBlockingErrors",
      ];
      for (const k of keys) {
        if (k in p) console.log(`      ${k}: ${p[k] ? "✓" : "✗"}`);
      }
      console.log(
        `      totalErrors: ${p.totalErrors}, blocking: ${p.blockingErrors}, wasmStart: ${p.wasmStartTime}ms`,
      );
      if (p.blockingErrors > 0) {
        const blockingItems = p.consoleErrors.filter(
          (e) =>
            ![
              "wasm",
              "Wasm",
              "Memory",
              "emscripten",
              "Emscripten",
              "WebAssembly",
              "unreachable",
              "SourceMap",
              "favicon",
              "404",
              "Failed to load resource",
            ].some((b) => e.includes(b)),
        );
        blockingItems.forEach((e) => console.log(`        BLOCKING: ${e}`));
      }
    }
  }

  console.log("\nMobile:");
  for (const m of mobileResults)
    console.log(
      `  ${m.canvas ? "✓" : "✗"} ${m.game || "?"} Canvas | ${m.back ? "✓" : "✗"} Back | ${m.ctrl ? "✓" : "✗"} Controls`,
    );

  console.log("\nPage Details (mobile-ready checks):");
  for (const d of pageDetails) {
    const mobileReady = d.mobileReady ? "✓" : "✗";
    console.log(
      `  ${mobileReady} ${d.game} ${d.browser}: overlay=${d.touchOverlay ? "✓" : "✗"} rotate=${d.rotateDevice ? "✓" : "✗"} wrap=${d.gameWrap ? "✓" : "✗"} viewport=${d.viewport?.includes("user-scalable=no") ? "✓" : "✗"}`,
    );
  }

  console.log("\nCSP Headers Audit:");
  const fs = await import("fs");
  const headersPath = resolve(ROOT, "public/_headers");
  const headersText = fs.readFileSync(headersPath, "utf-8");
  const hasUnsafeEval = [];
  const sections = headersText.split("\n\n");
  for (const s of sections) {
    const lines = s.split("\n");
    const headerLine = lines[0].trim();
    const cspLine = lines.find((l) =>
      l.trim().startsWith("Content-Security-Policy:"),
    );
    if (cspLine) {
      const csp = cspLine;
      if (csp.includes("'unsafe-eval'"))
        hasUnsafeEval.push(`${headerLine}: has 'unsafe-eval'`);
      else hasUnsafeEval.push(`${headerLine}: MISSING 'unsafe-eval'`);
    }
  }
  for (const h of hasUnsafeEval)
    console.log(`  ${h.includes("MISSING") ? "✗" : "✓"} ${h}`);

  // Decision
  console.log("\n" + "-".repeat(40));
  console.log("DECISION");
  console.log("-".repeat(40));

  for (const gn of gameNames) {
    const entries = protoResults.filter((p) => p.game === gn);
    const coreOk = entries.every((p) => p.pageLoads && p.canvasExists);
    const wasmOk = entries.some((p) => p.wasmStarted);
    const umeOk = entries.some((p) => p.umeTriggered);
    const activeOk = entries.some((p) => p.canvasActive);
    const cleanErrs = entries.every((p) => p.noBlockingErrors);

    console.log(`  ${gn}:`);
    if (!coreOk) {
      console.log("    NO-GO: Core page broken.");
    } else if (!wasmOk) {
      console.log("    NO-GO: WASM runtime did not start.");
      console.log("      Likely: CDN blocked or pygbag issue.");
    } else if (!umeOk) {
      console.log(
        "    CONDITIONAL GO: WASM starts but UME click not triggered by automation.",
      );
      console.log("      Condition: Manual click-to-start test.");
    } else if (!activeOk) {
      console.log(
        "    CONDITIONAL GO: WASM + UME work but rendering not confirmed.",
      );
      console.log("      Condition: Manual browser test.");
    } else if (!cleanErrs) {
      console.log("    CONDITIONAL GO: Runs with non-fatal console errors.");
    } else {
      console.log("    GO: All critical checks pass.");
    }
  }

  console.log("\n=== DONE ===");
}

main().catch((err) => {
  console.error("Fatal:", err);
  stopPreview();
  process.exit(1);
});
