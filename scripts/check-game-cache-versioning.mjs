/**
 * Assert that game archive and critical JS/CSS URLs are versioned and/or
 * use cache-first strategy. This prevents stale cache regressions.
 *
 * Checks:
 *  1. Each game HTML references versioned critical assets (?v=...).
 *  2. Each game HTML uses versioned archive preload URL.
 *  3. Each game HTML inline boot code uses versioned archive fetch URL.
 *  4. sw.js uses cache-first for .tar.gz archives.
 *
 * Usage:
 *   node scripts/check-game-cache-versioning.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const gamesMeta = JSON.parse(
  readFileSync(resolve(ROOT, "src/data/games.json"), "utf-8"),
);
const GAMES = gamesMeta
  .filter((g) => g.status === "browser-playable" && g.engine !== "phaser")
  .map((g) => ({
    id: g.id,
    html: `public/play/${g.id}/index.html`,
    archiveFile: `${g.id}.tar.gz`,
  }));

const SHARED_ASSETS = [
  "/play/shared/mobile-controls.css",
  "/play/shared/mobile-controls.js",
  "/play/shared/pygame-input-bridge.js",
  "/play/shared/game-viewport.js",
];

let failures = 0;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failures++;
}

// --- Check sw.js ---
const swPath = resolve(ROOT, "public/sw.js");
const swCode = readFileSync(swPath, "utf-8");

// No top-level imports — must be classic SW
if (/^\s*import\s/s.test(swCode)) {
  fail("sw.js has top-level import — must be classic service worker");
}

if (!swCode.includes("cache-first") || !swCode.includes(".tar.gz")) {
  fail("sw.js must use cache-first for .tar.gz archives");
}
// Check for versioned cache name: either hardcoded or imported from game-asset-versions
if (
  !swCode.includes("pirate-arcade-games-v") &&
  !swCode.includes("CACHE_VERSION")
) {
  fail("sw.js CACHE_NAME must be versioned (pirate-arcade-games-vN)");
}

// --- Check each game HTML ---
for (const game of GAMES) {
  const htmlPath = resolve(ROOT, game.html);
  const html = readFileSync(htmlPath, "utf-8");

  // Archive preload link must have ?v= or ?h=
  const preloadPattern = new RegExp(
    `rel="preload"[^>]*href="[^"]*${game.archiveFile}\\?(?:v=|h=)`,
  );
  if (!preloadPattern.test(html)) {
    fail(`${game.id}: archive preload link must have ?v= or ?h= query`);
  }

  // Archive boot fetch URL must have ?v= or ?h=
  const bootFetchPattern = new RegExp(`${game.archiveFile}\\?(?:v=|h=)`);
  if (!bootFetchPattern.test(html)) {
    fail(`${game.id}: inline boot code archive URL must have ?v= or ?h= query`);
  }

  // Shared assets must have ?v=
  for (const asset of SHARED_ASSETS) {
    const assetPattern = new RegExp(`href="[^"]*${asset}\\?v=`);
    const scriptPattern = new RegExp(`src="[^"]*${asset}\\?v=`);
    if (!assetPattern.test(html) && !scriptPattern.test(html)) {
      fail(`${game.id}: shared asset ${asset} must have ?v= query`);
    }
  }

  // SW registration must use updateViaCache: 'none'
  if (
    !html.includes("updateViaCache: 'none'") &&
    !html.includes('updateViaCache: "none"')
  ) {
    fail(`${game.id}: SW registration must use updateViaCache: 'none'`);
  }

  // No registration.update() call required — updateViaCache: 'none'
  // already ensures the SW script is fetched fresh on every
  // register() call, which inherently triggers an update check.
  // Shared JS/CSS have ?v= params.  Game archives carry ?h=<sha256>
  // content hashes.  Both ?v= and ?h= URLs use cache-first in sw.js
  // (unique per version, safe to cache).  The skipWaiting() call in
  // sw.js ensures new SW activates immediately on update detection.
}

if (failures > 0) {
  console.error(`\n${failures} cache versioning failure(s) found.`);
  process.exit(1);
} else {
  console.log("All cache versioning checks passed.");
}
