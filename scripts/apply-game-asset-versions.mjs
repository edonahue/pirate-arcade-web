#!/usr/bin/env node
/**
 * Apply game asset versions to static files.
 * Updates public/sw.js and game HTML files with current version values.
 *
 * Run after bumping versions in scripts/game-asset-versions.mjs:
 *   node scripts/apply-game-asset-versions.mjs
 *
 * This is the mutating counterpart of the check-only scripts:
 *   test:game-versions → check-game-html-versions.mjs
 *   test:cache-versioning → check-game-cache-versioning.mjs
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
import { ASSET_VERSION, CACHE_VERSION } from "./game-asset-versions.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const GAMES = ["cannonball-clash", "treasure-cove"];

let exitCode = 0;

// ── 1. Update public/sw.js with CACHE_VERSION ──
const swPath = resolve(root, "public/sw.js");
let swContent = readFileSync(swPath, "utf-8");

const cacheVersionRegex = /const CACHE_VERSION = "pirate-arcade-games-v\d+";/;
if (!cacheVersionRegex.test(swContent)) {
  // Check if it's still using the old import style
  if (swContent.includes("import { CACHE_VERSION } from")) {
    // Migration from import style
    swContent = swContent.replace(
      /import { CACHE_VERSION } from "[^"]+";\s*\n\s*const CACHE_NAME = CACHE_VERSION;/,
      `const CACHE_VERSION = "${CACHE_VERSION}";\nconst CACHE_NAME = CACHE_VERSION;`,
    );
    console.log("  → Migrated SW from import to inlined version");
  } else {
    console.error(`  ❌ Cannot find CACHE_VERSION placeholder in sw.js`);
    exitCode = 1;
  }
} else {
  swContent = swContent.replace(
    cacheVersionRegex,
    `const CACHE_VERSION = "${CACHE_VERSION}";`,
  );
}

if (exitCode === 0) {
  writeFileSync(swPath, swContent);
  console.log(`  ✅ sw.js → CACHE_VERSION = "${CACHE_VERSION}"`);
}

// ── 2. Update game HTML version queries ──
for (const gameDir of GAMES) {
  const indexPath = resolve(root, "public", "play", gameDir, "index.html");

  try {
    let content = readFileSync(indexPath, "utf8");

    // Update inline script archive URL
    content = content.replace(
      /url = _w\.location\.href \+ "[^"]+\.tar\.gz\?v=mobile-v\d+"/g,
      `url = _w.location.href + "${gameDir}.tar.gz?v=${ASSET_VERSION}"`,
    );

    // Update preload link
    content = content.replace(
      /<link rel="preload" href="\/play\/[^"]+\.tar\.gz\?v=mobile-v\d+" as="fetch">/g,
      `<link rel="preload" href="/play/${gameDir}/${gameDir}.tar.gz?v=${ASSET_VERSION}" as="fetch">`,
    );

    // Update CSS link
    content = content.replace(
      /<link rel="stylesheet" href="\/play\/shared\/mobile-controls\.css\?v=mobile-v\d+">/g,
      `<link rel="stylesheet" href="/play/shared/mobile-controls.css?v=${ASSET_VERSION}">`,
    );

    // Update shared JS scripts
    const sharedScripts = [
      "pygame-input-bridge.js",
      "game-viewport.js",
      "mobile-controls.js",
    ];
    for (const script of sharedScripts) {
      content = content.replace(
        new RegExp(
          `<script src="/play/shared/${script}\\?v=mobile-v\\d+"></script>`,
          "g",
        ),
        `<script src="/play/shared/${script}?v=${ASSET_VERSION}"></script>`,
      );
    }

    writeFileSync(indexPath, content);
    console.log(
      `  ✅ ${gameDir}/index.html → ASSET_VERSION = "${ASSET_VERSION}"`,
    );
  } catch (err) {
    console.error(`  ❌ Failed to update ${gameDir}: ${err.message}`);
    exitCode = 1;
  }
}

if (exitCode === 0) {
  console.log("\n✅ All versions applied successfully.");
} else {
  console.error("\n❌ Some versions failed to apply.");
  process.exit(1);
}
