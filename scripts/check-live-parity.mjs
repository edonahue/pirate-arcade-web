#!/usr/bin/env node
/*
 * Live/Repo Parity Checker
 * Verifies that live site matches expected repo state
 */

import { parse as parseUrl } from "node:url";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load version manifest
const { ASSET_VERSION, CACHE_VERSION } =
  await import("./game-asset-versions.mjs");

const LIVE_BASE = process.env.LIVE_BASE || "https://pirate-arcade.com";
const ALLOW_STALE_LIVE = process.env.ALLOW_STALE_LIVE === "1";

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
      "CB does not have old center-circle styling",
      (!cbText.includes("left: 50%; margin-left: -36px") &&
        !cbText.includes(".btn-action {")) ||
        !cbText.includes("margin-left: -36px"),
      "Should not have old center-action button styling",
    );

    check(
      "CB has correct hint text",
      cbText.includes("Touch: slide ship up/down  •  START  •  ❚❚ pause") ||
        cbText.includes("Touch: slide ship up/down • START • Pause"),
      "Should have mobile-appropriate hint text",
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
      "TC does not have old center-circle styling",
      (!tcText.includes("left: 50%; margin-left: -36px") &&
        !tcText.includes(".btn-action {")) ||
        !tcText.includes("margin-left: -36px"),
      "Should not have old center-action button styling",
    );

    check(
      "TC has correct hint text",
      tcText.includes(
        "Touch: slide longboat left/right  •  LAUNCH  •  ❚❚ pause",
      ) || tcText.includes("Touch: slide longboat left/right • LAUNCH • Pause"),
      "Should have mobile-appropriate hint text",
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
