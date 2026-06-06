#!/usr/bin/env node
/**
 * Check that browser-game HTML shells are structurally consistent.
 * Read-only — does not modify files.
 *
 * Verifies:
 *   - Both shells exist and parse
 *   - Same CDN version pin (0.9.3)
 *   - Same shared script references
 *   - Same SW registration pattern
 *   - Same inline API surface (PirateArcadeLoading)
 *   - Archive URL matches game directory
 *   - Manifest comment matches expected values
 *
 * Usage:
 *   node scripts/check-browser-game-consistency.mjs
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const GAMES = ["cannonball-clash", "treasure-cove", "krakens-wake"];

const REQUIRED_API = [
  "window.PirateArcadeLoading",
  "function set(text)",
  "function ready(text)",
  "function error(text)",
];

const REQUIRED_SHARED_SCRIPTS = [
  "pygame-input-bridge.js",
  "game-viewport.js",
  "mobile-controls.js",
];

const REQUIRED_PATTERNS = [
  { name: "inline script start", pattern: /INLINE_SCRIPT: starting/ },
  { name: "cross_file override", pattern: /cross_file\.patched/ },
  { name: "python ready poll", pattern: /INJECT_SCRIPT: setting up poll/ },
  { name: "custom_onload", pattern: /function custom_onload/ },
  { name: "custom_prerun", pattern: /function custom_prerun/ },
  { name: "canvas focus observer", pattern: /MutationObserver[\s\S]*?canvas/ },
  { name: "touch audio unlock", pattern: /unlockAudioOnInteraction/ },
  { name: "rotate device overlay", pattern: /rotate-device/ },
  { name: "game-loading overlay", pattern: /id="game-loading"/ },
  { name: "SW registration", pattern: /navigator\.serviceWorker\.register/ },
  { name: "game-boot-metrics", pattern: /game-boot-metrics\.js/ },
];

let failures = 0;

function fail(msg) {
  console.error(`  ❌ ${msg}`);
  failures++;
}

function ok(msg) {
  console.log(`  ✅ ${msg}`);
}

console.log(`🔍 Checking browser-game shell consistency...`);
console.log("");

// ── Check each game shell ──
for (const game of GAMES) {
  const indexPath = resolve(root, "public", "play", game, "index.html");
  let html;

  try {
    html = readFileSync(indexPath, "utf-8");
  } catch (err) {
    fail(`${game}: Could not read index.html`);
    continue;
  }

  console.log(`── ${game} ──`);

  // 1. CDN version pin
  if (html.includes("pythons.js@0.9.3")) {
    ok("CDN version pinned to 0.9.3");
  } else {
    fail(`${game}: CDN version not found or wrong`);
  }

  // 2. All required patterns present
  for (const { name, pattern } of REQUIRED_PATTERNS) {
    if (pattern.test(html)) {
      ok(`${name}`);
    } else {
      fail(`${game}: Missing "${name}"`);
    }
  }

  // 3. Shared scripts referenced
  for (const script of REQUIRED_SHARED_SCRIPTS) {
    if (html.includes(script)) {
      ok(`shared script: ${script}`);
    } else {
      fail(`${game}: Missing shared script "${script}"`);
    }
  }

  // 4. PirateArcadeLoading API surface
  if (html.includes("window.PirateArcadeLoading")) {
    ok("PirateArcadeLoading API present");
    if (!html.includes("_ensureEls")) {
      fail(`${game}: Missing PirateArcadeLoading._ensureEls`);
    }
  } else {
    fail(`${game}: Missing PirateArcadeLoading API`);
  }

  // 5. Archive URL matches game directory
  const archivePattern = new RegExp(`${game}\\.tar\\.gz\\?v=`);
  if (archivePattern.test(html)) {
    ok(`archive URL matches game name`);
  } else {
    fail(`${game}: archive URL does not reference "${game}"`);
  }

  // 6. SW registration: no module, updateViaCache
  if (html.includes("type: 'module'") || html.includes('type: "module"')) {
    fail(`${game}: SW registration uses module type`);
  } else {
    ok("SW registration is classic (no module)");
  }
  if (
    html.includes("updateViaCache: 'none'") ||
    html.includes('updateViaCache: "none"')
  ) {
    ok("SW registration uses updateViaCache: none");
  } else {
    fail(`${game}: SW registration missing updateViaCache: none`);
  }

  // 7. Manifest comment
  const manifestMatch = html.match(/<!--\s*\n\s*GAME:\s*(\S+)/);
  if (manifestMatch) {
    const manifestGame = manifestMatch[1];
    if (manifestGame === game) {
      ok(`manifest comment matches game "${game}"`);
    } else {
      fail(`${game}: manifest says "${manifestGame}"`);
    }
  } else {
    fail(`${game}: missing manifest comment`);
  }

  console.log("");
}

// ── Cross-game structural checks ──
console.log(`── cross-game ──`);

const contents = GAMES.map((g) => {
  const path = resolve(root, "public", "play", g, "index.html");
  return readFileSync(path, "utf-8");
});

// Shared scripts use same version suffix
const versionPattern = /\?(v=)([\w.-]+)/;
const versions = contents.map((c) => {
  const match = c.match(versionPattern);
  return match ? match[2] : null;
});
if (versions[0] && versions[1] && versions[0] === versions[1]) {
  ok(`shared script version consistent (${versions[0]})`);
} else {
  fail(`shared script version mismatch: ${versions[0]} vs ${versions[1]}`);
}

// Same lang attribute
const langMatch = contents.map((c) => c.match(/<html\s+lang="([^"]+)"/)?.[1]);
if (langMatch[0] && langMatch[1] && langMatch[0] === langMatch[1]) {
  ok(`html lang consistent (${langMatch[0]})`);
} else {
  fail(`html lang mismatch`);
}

console.log("");
if (failures > 0) {
  console.error(`❌ ${failures} consistency check(s) failed.`);
  process.exit(1);
} else {
  console.log("✅ All browser-game consistency checks passed.");
}
