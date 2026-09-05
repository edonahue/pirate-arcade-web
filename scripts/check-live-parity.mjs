#!/usr/bin/env node
/*
 * Live/Repo Parity Checker (post-deploy only).
 *
 * Owns deployed-production verification:
 * - deployed commit identity (/build-info.json vs EXPECTED_COMMIT)
 * - route availability + registry topology
 * - essential remote shell/runtime markers
 * - semantic parity that can go stale after deploy
 *
 * Local deterministic correctness belongs to `verify:release:fast`.
 * This script reads local manifests (games.json, asset versions) only
 * as expected-value inputs for remote comparison.
 *
 * Registry-driven: game groups derived from src/data/games.json.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const __filename = new URL(import.meta.url).pathname;
const __dirname = dirname(__filename);

const { ASSET_VERSION, CACHE_VERSION } =
  await import("./game-asset-versions.mjs");

const games = JSON.parse(
  readFileSync(resolve(__dirname, "..", "src", "data", "games.json"), "utf-8"),
);

// Topology derived from registry fields (same capability truth as the app):
// - browser-capable: has browserUrl (4 games)
// - desktop-capable: has desktopUrl (cannonball, treasure, kraken, port)
// - desktop-only: no browserUrl (port only)
const BROWSER_GAMES = games.filter((g) => g.browserUrl);
const PYGBAG_GAMES = games.filter((g) => g.engine === "pygbag");
const PHASER_GAMES = BROWSER_GAMES.filter((g) => g.engine === "phaser");
const DESKTOP_CAPABLE_GAMES = games.filter((g) => g.desktopUrl);
const DESKTOP_ONLY_GAMES = games.filter((g) => !g.browserUrl);

const LIVE_BASE = process.env.LIVE_BASE || "https://pirate-arcade.com";
const ALLOW_STALE_LIVE = process.env.ALLOW_STALE_LIVE === "1";
const EXPECTED_COMMIT = process.env.EXPECTED_COMMIT || "";

let passed = 0;
let failed = 0;

function check(name, condition, details = "") {
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
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.text();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

console.log(`🔍 Live parity check`);
console.log(`   Live base: ${LIVE_BASE}`);
console.log(`   Asset version: ${ASSET_VERSION}, cache: ${CACHE_VERSION}`);
console.log(
  `   Registry: ${games.length} games, ` +
    `${BROWSER_GAMES.length} browser, ` +
    `${DESKTOP_CAPABLE_GAMES.length} desktop-capable, ` +
    `${DESKTOP_ONLY_GAMES.length} desktop-only`,
);
if (EXPECTED_COMMIT) console.log(`   Expected commit: ${EXPECTED_COMMIT}`);

// ——— Deployed build identity ———
console.log(`\n─── Build identity ───`);
try {
  const info = await fetchJson(`${LIVE_BASE}/build-info.json`);
  check(
    "/build-info.json responds with schemaVersion 1",
    info && info.schemaVersion === 1,
    JSON.stringify(info).slice(0, 200),
  );
  const deployed = typeof info.commit === "string" ? info.commit : "";
  if (EXPECTED_COMMIT) {
    check(
      "deployed commit matches EXPECTED_COMMIT",
      deployed === EXPECTED_COMMIT,
      `expected ${EXPECTED_COMMIT}, deployed ${deployed} (branch ${info.branch})`,
    );
  } else {
    console.log(`   deployed commit: ${deployed} (branch ${info.branch})`);
    check("deployed commit is a non-empty string", deployed.length > 0);
  }
} catch (err) {
  check("/build-info.json fetch", false, err.message);
}

// ——— Service worker (remote) ———
console.log(`\n─── Service worker ───`);
try {
  const swText = await fetchText(`${LIVE_BASE}/sw.js`);
  check(
    "SW has correct CACHE_VERSION",
    swText.includes(`const CACHE_VERSION = "${CACHE_VERSION}"`),
    `Expected: ${CACHE_VERSION}`,
  );
  check(
    "SW has correct archive strategy",
    swText.includes('if (url.pathname.endsWith(".tar.gz"))') &&
      swText.includes("event.respondWith(networkFirst(event))"),
    "Should use network-first for archives",
  );
} catch (err) {
  check("SW fetch", false, err.message);
}

// ——— Core routes ———
console.log(`\n─── Core routes ───`);
for (const route of ["/", "/play/", "/about/", "/source/", "/build-log/"]) {
  try {
    const txt = await fetchText(LIVE_BASE + route);
    check(`${route} responds`, txt.length > 1000);
  } catch (err) {
    check(`${route} fetch`, false, err.message);
  }
}

// ——— Detail routes (all registry games) ———
console.log(`\n─── Detail routes ───`);
for (const game of games) {
  try {
    const txt = await fetchText(LIVE_BASE + `/games/${game.id}/`);
    check(`/games/${game.id}/ responds`, txt.length > 1000);
    // Load badges live on detail pages (mutually exclusive per engine type)
    if (game.engine === "pygbag") {
      check(
        `${game.id} archive hash present`,
        txt.includes(`${game.id}.tar.gz?h=`),
      );
      check(`${game.id} has Runtime load`, txt.includes("Runtime load"));
      check(`${game.id} has no Instant start`, !txt.includes("Instant start"));
    }
    if (game.engine === "phaser") {
      check(`${game.id} has Instant start`, txt.includes("Instant start"));
      check(`${game.id} has no Runtime load`, !txt.includes("Runtime load"));
    }
    if (!game.browserUrl) {
      check(
        `${game.id} has no browser load badge`,
        !txt.includes("Runtime load") && !txt.includes("Instant start"),
      );
    }
    if (game.desktopUrl) {
      check(
        `${game.id} desktop destination`,
        txt.includes("Desktop download") ||
          txt.includes("github.com/edonahue/pirate-arcade/releases"),
      );
    }
  } catch (err) {
    check(`/games/${game.id}/ fetch`, false, err.message);
  }
}

// ——— Browser routes (single fetch per game) ———
console.log(`\n─── Browser routes ───`);
for (const game of BROWSER_GAMES) {
  try {
    const txt = await fetchText(LIVE_BASE + `/play/${game.id}/`);
    check(`/play/${game.id}/ responds`, txt.length > 1000);
    if (game.engine === "pygbag") {
      check(
        `${game.id} has data-no-touch-control on back link`,
        txt.includes('<a id="back-link" href="/play/" data-no-touch-control>'),
      );
      check(`${game.id} has game-ready marker`, txt.includes("game-ready"));
      check(
        `${game.id} has game-loading-detail`,
        txt.includes("game-loading-detail"),
      );
    }
    if (game.engine === "phaser") {
      // Phaser game-ready telemetry lives in the bundled JS module, not the
      // shell HTML: assert no Pygbag archive expectation instead.
      check(
        `${game.id} has no Pygbag archive expectation`,
        !txt.includes(".tar.gz"),
      );
    }
  } catch (err) {
    check(`/play/${game.id}/ fetch`, false, err.message);
  }
}

// ——— Desktop-only contract ———
console.log(`\n─── Desktop-only ───`);
for (const game of DESKTOP_ONLY_GAMES) {
  try {
    const txt = await fetchText(LIVE_BASE + `/games/${game.id}/`);
    check(
      `${game.id} detail page has desktop destination`,
      txt.includes("Desktop download") ||
        txt.includes("github.com/edonahue/pirate-arcade/releases"),
    );
  } catch (err) {
    check(`${game.id} desktop fetch`, false, err.message);
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0 && !ALLOW_STALE_LIVE) {
  console.log(`\n❌ Parity check failed. Live site is stale or misconfigured.`);
  console.log(`   To allow stale live (e.g., during propagation), run:`);
  console.log(`   ALLOW_STALE_LIVE=1 npm run test:live-parity`);
  process.exit(1);
} else if (failed > 0) {
  console.log(
    `\n⚠️  Parity check had issues but continuing due to ALLOW_STALE_LIVE=1`,
  );
} else {
  console.log(`\n✅ All parity checks passed.`);
}
