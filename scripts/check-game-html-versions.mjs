#!/usr/bin/env node
/**
 * Check that game HTML files and sw.js use the expected version values
 * from the single source of truth. Read-only: does not modify files.
 *
 * Usage:
 *   node scripts/check-game-html-versions.mjs
 *   npm run test:game-versions
 *
 * Fails (exit code 1) if any version mismatch is found.
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync } from "fs";
import { ASSET_VERSION, CACHE_VERSION } from "./game-asset-versions.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const GAMES = ["cannonball-clash", "treasure-cove"];

let failures = 0;

function fail(msg) {
  console.error(`  ❌ ${msg}`);
  failures++;
}

console.log(`🔍 Checking version consistency...`);
console.log(`   Expected ASSET_VERSION: "${ASSET_VERSION}"`);
console.log(`   Expected CACHE_VERSION: "${CACHE_VERSION}"`);
console.log("");

// ── Check sw.js ──
const swPath = resolve(root, "public/sw.js");
const swContent = readFileSync(swPath, "utf-8");

// 1. No top-level imports (must be classic SW)
if (/^\s*import\s/.test(swContent)) {
  fail("sw.js has top-level import — must be a classic service worker");
}

// 2. Correct CACHE_VERSION
const cacheRegex = new RegExp(
  `const CACHE_VERSION = "${CACHE_VERSION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}";`,
);
if (!cacheRegex.test(swContent)) {
  const found = swContent.match(/const CACHE_VERSION = "([^"]+)";/);
  fail(
    `sw.js has wrong CACHE_VERSION${found ? ` (found "${found[1]}")` : " (not found)"}`,
  );
} else {
  console.log(`  ✅ sw.js → ${CACHE_VERSION}`);
}

// 3. Check for top-level import in sw.js
if (!swContent.includes("navigator.serviceWorker.register")) {
  // SW doesn't register itself, but check for import statement
  const importMatch = swContent.match(/^\s*import\s/gm);
  if (importMatch) {
    fail(`sw.js has ${importMatch.length} top-level import(s)`);
  }
}

// ── Check game HTML files ──
for (const gameDir of GAMES) {
  const indexPath = resolve(root, "public", "play", gameDir, "index.html");
  let html;

  try {
    html = readFileSync(indexPath, "utf-8");
  } catch (err) {
    fail(`${gameDir}: Could not read index.html`);
    continue;
  }

  // Archive inline URL
  const archiveUrlPattern = new RegExp(
    `${gameDir}\\.tar\\.gz\\?v=${escapeRegex(ASSET_VERSION)}`,
  );
  if (!archiveUrlPattern.test(html)) {
    fail(`${gameDir}: archive URL missing or wrong version`);
  } else {
    console.log(`  ✅ ${gameDir} archive URL`);
  }

  // Preload link
  const preloadPattern = new RegExp(
    `rel="preload"[^>]*href="[^"]*${gameDir}\\.tar\\.gz\\?v=${escapeRegex(ASSET_VERSION)}"`,
  );
  if (!preloadPattern.test(html)) {
    fail(`${gameDir}: preload link missing or wrong version`);
  } else {
    console.log(`  ✅ ${gameDir} preload link`);
  }

  // Shared CSS
  const cssPattern = new RegExp(
    `mobile-controls\\.css\\?v=${escapeRegex(ASSET_VERSION)}`,
  );
  if (!cssPattern.test(html)) {
    fail(`${gameDir}: mobile-controls.css missing or wrong version`);
  } else {
    console.log(`  ✅ ${gameDir} mobile-controls.css`);
  }

  // Shared JS
  for (const script of [
    "pygame-input-bridge.js",
    "game-viewport.js",
    "mobile-controls.js",
  ]) {
    const jsPattern = new RegExp(
      `${escapeRegex(script)}\\?v=${escapeRegex(ASSET_VERSION)}`,
    );
    if (!jsPattern.test(html)) {
      fail(`${gameDir}: ${script} missing or wrong version`);
    } else {
      console.log(`  ✅ ${gameDir} ${script}`);
    }
  }

  // SW registration does NOT use { type: "module" }
  if (html.includes(`register('/sw.js', { type: 'module'`)) {
    fail(
      `${gameDir}: SW registration should NOT use type: 'module' (classic SW)`,
    );
  }

  // SW registration uses updateViaCache: 'none'
  if (
    !html.includes("updateViaCache: 'none'") &&
    !html.includes('updateViaCache: "none"')
  ) {
    fail(`${gameDir}: SW registration must use updateViaCache: 'none'`);
  } else {
    console.log(`  ✅ ${gameDir} SW registration`);
  }
}

console.log("");
if (failures > 0) {
  console.error(`❌ ${failures} version check(s) failed.`);
  process.exit(1);
} else {
  console.log("✅ All version checks passed.");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
