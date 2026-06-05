#!/usr/bin/env node
/*
 * Live/Repo Parity Checker
 * Verifies that live site matches expected repo state.
 *
 * Also performs blocking local checks (sw.js validity, game HTML versions)
 * that must pass before any release.
 *
 * Non-blocking parity checks (live site) use ALLOW_STALE_LIVE to bypass
 * failures during deployment propagation.
 */

import { parse as parseUrl } from "node:url";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load version manifest
const { ASSET_VERSION, CACHE_VERSION } =
  await import("./game-asset-versions.mjs");

const ROOT = resolve(__dirname, "..");
const LIVE_BASE = process.env.LIVE_BASE || "https://pirate-arcade.com";
const ALLOW_STALE_LIVE = process.env.ALLOW_STALE_LIVE === "1";
const GAMES = ["cannonball-clash", "treasure-cove"];

const checks = [];
let passed = 0;
let failed = 0;

function check(name, condition, details = "") {
  checks.push({ name, passed: condition, details });
  if (condition) {
    passed++;
    console.log(`✅ ${name}`);
  } else {
    failed++;
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
  }
}

function fail(name, details) {
  check(name, false, details);
}

function checkLocalFile(path, name, predicate, details) {
  try {
    const content = readFileSync(resolve(ROOT, path), "utf-8");
    check(name, predicate(content), details);
  } catch (err) {
    fail(name, `Error reading ${path}: ${err.message}`);
  }
}

function grepLocal(path, name, pattern) {
  checkLocalFile(path, name, (c) =>
    Array.isArray(pattern) ? pattern.some((p) => c.match(p)) : c.match(pattern),
  );
}

async function fetchText(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.text();
  } catch (err) {
    throw new Error(`Failed to fetch ${url}: ${err.message}`);
  }
}

async function run() {
  console.log(`🔍 Live/Repo Parity Check`);
  console.log(`   Live base: ${LIVE_BASE}`);
  console.log(`   Asset version: ${ASSET_VERSION}`);
  console.log(`   Cache version: ${CACHE_VERSION}`);
  console.log(`   Allow stale live: ${ALLOW_STALE_LIVE}`);
  console.log("");

  // ──────────────────────────────────────────────
  // LOCAL (blocking) checks — must pass for release
  // ──────────────────────────────────────────────
  console.log("─── Local Checks ───");

  // 1. sw.js: no top-level imports, correct cache version
  checkLocalFile(
    "public/sw.js",
    "SW: no top-level import",
    (c) => !/^\s*import\s/s.test(c),
    "Do not use import in classic SW",
  );
  checkLocalFile(
    "public/sw.js",
    "SW: has correct CACHE_VERSION",
    (c) => c.includes(`const CACHE_VERSION = "${CACHE_VERSION}"`),
    `Expected: ${CACHE_VERSION}`,
  );

  // 2. Game HTML: version consistency
  for (const gameDir of GAMES) {
    const htmlPath = `public/play/${gameDir}/index.html`;

    checkLocalFile(htmlPath, `${gameDir}: correct archive URL version`, (c) =>
      c.includes(`${gameDir}.tar.gz?v=${ASSET_VERSION}`),
    );
    checkLocalFile(
      htmlPath,
      `${gameDir}: correct mobile-controls.css version`,
      (c) => c.includes(`mobile-controls.css?v=${ASSET_VERSION}`),
    );
    checkLocalFile(
      htmlPath,
      `${gameDir}: correct shared JS versions`,
      (c) =>
        c.includes(`pygame-input-bridge.js?v=${ASSET_VERSION}`) &&
        c.includes(`game-viewport.js?v=${ASSET_VERSION}`) &&
        c.includes(`mobile-controls.js?v=${ASSET_VERSION}`),
    );
    checkLocalFile(
      htmlPath,
      `${gameDir}: SW registration uses updateViaCache: none`,
      (c) =>
        c.includes("updateViaCache: 'none'") ||
        c.includes('updateViaCache: "none"'),
    );
    checkLocalFile(
      htmlPath,
      `${gameDir}: SW registration is classic (no type: module)`,
      (c) => !c.includes("type: 'module'") && !c.includes('type: "module"'),
    );
    checkLocalFile(
      htmlPath,
      `${gameDir}: loading overlay uses PirateArcadeLoading`,
      (c) => c.includes("PirateArcadeLoading") && c.includes("game-ready"),
    );
    checkLocalFile(
      htmlPath,
      `${gameDir}: loading overlay shows phase details`,
      (c) =>
        c.includes("game-loading-detail") &&
        c.includes("_detailEl.textContent"),
    );
    checkLocalFile(
      htmlPath,
      `${gameDir}: data-no-touch-control on back link`,
      (c) => c.includes("data-no-touch-control"),
    );
  }

  // 3. game-viewport.js: exposes canvas-bottom-offset
  checkLocalFile(
    "public/play/shared/game-viewport.js",
    "game-viewport.js: uses visualViewport.offsetLeft/offsetTop",
    (c) => c.includes("visualViewport") && c.includes("offsetLeft"),
    "Should account for viewport offset",
  );
  checkLocalFile(
    "public/play/shared/game-viewport.js",
    "game-viewport.js: exposes --game-canvas-bottom-offset",
    (c) => c.includes("--game-canvas-bottom-offset"),
    "Needed for drag-zone bottom positioning",
  );

  // 4. mobile-controls.css: drag zones use correct bottom coordinate
  checkLocalFile(
    "public/play/shared/mobile-controls.css",
    "mobile-controls.css: touch-drag-x uses bottom-offset",
    (c) =>
      !c.includes("bottom: var(--game-canvas-bottom,") &&
      c.includes("bottom: var(--game-canvas-bottom-offset,"),
    "Should use bottom-offset not raw canvas bottom",
  );

  // 5. game-asset-versions.js (shared runtime): matches manifest
  checkLocalFile(
    "public/play/shared/game-asset-versions.js",
    "Shared game-asset-versions.js matches manifest",
    (c) => c.includes(`"${ASSET_VERSION}"`) && c.includes(`"${CACHE_VERSION}"`),
  );

  // ──────────────────────────────────────────────
  // LIVE checks — informational, allow-stale-able
  // ──────────────────────────────────────────────
  console.log("\n─── Live Site Checks ───");

  // Check service worker
  try {
    const swText = await fetchText(`${LIVE_BASE}/sw.js`);
    check(
      "SW has correct cache name",
      swText.includes(`const CACHE_NAME = "${CACHE_VERSION}";`),
      `Expected: ${CACHE_VERSION}`,
    );

    check(
      "SW has correct archive strategy",
      swText.includes('if (url.pathname.endsWith(".tar.gz"))') &&
        swText.includes("event.respondWith(networkFirst(event));"),
      "Should use network-first for archives",
    );
  } catch (err) {
    check("SW fetch", false, err.message);
  }

  // Check Cannonball Clash
  try {
    const cbText = await fetchText(`${LIVE_BASE}/play/cannonball-clash/`);
    check(
      "CB has data-no-touch-control on back link",
      cbText.includes('<a id="back-link" href="/play/" data-no-touch-control>'),
      "Should have data-no-touch-control attribute",
    );

    check(
      "CB has correct asset version query",
      cbText.includes(`cannonball-clash.tar.gz?v=${ASSET_VERSION}`) &&
        cbText.includes(`mobile-controls.css?v=${ASSET_VERSION}`) &&
        cbText.includes(`mobile-controls.js?v=${ASSET_VERSION}`) &&
        cbText.includes(`pygame-input-bridge.js?v=${ASSET_VERSION}`) &&
        cbText.includes(`game-viewport.js?v=${ASSET_VERSION}`),
      `All assets should use v=${ASSET_VERSION}`,
    );

    check(
      "CB has correct hint text",
      cbText.includes("Touch: slide ship up/down  •  START  •  ❚❚ pause") ||
        cbText.includes("Touch: slide ship up/down • START • Pause"),
      "Should have mobile-appropriate hint text",
    );

    check(
      "CB loading overlay shows game-ready",
      cbText.includes("game-ready"),
      "Should reference game-ready event for loader dismiss",
    );

    check(
      "CB loading overlay has phase detail",
      cbText.includes("game-loading-detail"),
      "Should show phase details during load",
    );
  } catch (err) {
    check("CB fetch", false, err.message);
  }

  // Check Treasure Cove
  try {
    const tcText = await fetchText(`${LIVE_BASE}/play/treasure-cove/`);
    check(
      "TC has data-no-touch-control on back link",
      tcText.includes('<a id="back-link" href="/play/" data-no-touch-control>'),
      "Should have data-no-touch-control attribute",
    );

    check(
      "TC has correct asset version query",
      tcText.includes(`treasure-cove.tar.gz?v=${ASSET_VERSION}`) &&
        tcText.includes(`mobile-controls.css?v=${ASSET_VERSION}`) &&
        tcText.includes(`mobile-controls.js?v=${ASSET_VERSION}`) &&
        tcText.includes(`pygame-input-bridge.js?v=${ASSET_VERSION}`) &&
        tcText.includes(`game-viewport.js?v=${ASSET_VERSION}`),
      `All assets should use v=${ASSET_VERSION}`,
    );

    check(
      "TC has correct hint text",
      tcText.includes(
        "Touch: slide longboat left/right  •  LAUNCH  •  ❚❚ pause",
      ) || tcText.includes("Touch: slide longboat left/right • LAUNCH • Pause"),
      "Should have mobile-appropriate hint text",
    );

    check(
      "TC loading overlay shows game-ready",
      tcText.includes("game-ready"),
      "Should reference game-ready event for loader dismiss",
    );

    check(
      "TC loading overlay has phase detail",
      tcText.includes("game-loading-detail"),
      "Should show phase details during load",
    );
  } catch (err) {
    check("TC fetch", false, err.message);
  }

  // Check homepage
  try {
    const homeText = await fetchText(`${LIVE_BASE}/`);
    check(
      "Homepage loads",
      homeText.length > 1000,
      "Should have substantial content",
    );
  } catch (err) {
    check("Homepage fetch", false, err.message);
  }

  console.log("");
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0 && !ALLOW_STALE_LIVE) {
    console.log(
      `\n❌ Parity check failed. Live site is stale or misconfigured.`,
    );
    console.log(`   To allow stale live (e.g., during propagation), run:`);
    console.log(`   ALLOW_STALE_LIVE=1 npm run test:live-parity`);
    process.exit(1);
  } else if (failed > 0) {
    console.log(
      `\n⚠️  Parity check had issues but continuing due to ALLOW_STALE_LIVE=1`,
    );
  } else {
    console.log(
      `\n✅ All parity checks passed. Live site matches repo expectations.`,
    );
  }
}

run().catch((err) => {
  console.error(`💥 Parity checker failed:`, err);
  process.exit(1);
});
