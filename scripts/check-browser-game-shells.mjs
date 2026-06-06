#!/usr/bin/env node
/**
 * Check that all browser-game shell pages are structurally consistent.
 * Read-only — does not modify files.
 *
 * Reads games.json for the canonical list of browser-playable games.
 * Verifies:
 *   - every browser-playable game has public/play/<id>/index.html
 *   - every browser-playable game has a matching .tar.gz archive
 *   - archive version query matches the version manifest
 *   - shared scripts and CSS are present and versioned
 *   - expected structural invariants (loading overlay, touch overlay, SW)
 *   - route-specific CSP entries in public/_headers
 *   - service worker ASSETS_TO_CACHE entries
 *
 * Usage:
 *   node scripts/check-browser-game-shells.mjs
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync, existsSync } from "fs";
import { ASSET_VERSION } from "./game-asset-versions.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const gamesPath = resolve(root, "src/data/games.json");
const games = JSON.parse(readFileSync(gamesPath, "utf-8"));
const browserGames = games.filter((g) => g.status === "browser-playable");

const REQUIRED_INVARIANTS = [
  { name: "inline script start", pattern: /INLINE_SCRIPT: starting/ },
  { name: "cross_file override", pattern: /cross_file\.patched/ },
  { name: "python ready poll", pattern: /INJECT_SCRIPT: setting up poll/ },
  { name: "custom_onload", pattern: /function custom_onload/ },
  { name: "custom_prerun", pattern: /function custom_prerun/ },
  { name: "canvas focus observer", pattern: /MutationObserver[\s\S]*?canvas/ },
  { name: "touch audio unlock", pattern: /unlockAudioOnInteraction/ },
  { name: "rotate device overlay", pattern: /rotate-device/ },
  { name: "game-loading overlay", pattern: /id="game-loading"/ },
  { name: "game-loading-detail", pattern: /id="game-loading-detail"/ },
  { name: "controls-hint", pattern: /id="controls-hint"/ },
  { name: "back-link", pattern: /id="back-link"/ },
  { name: "infobox", pattern: /id="infobox"/ },
  { name: "touch-overlay", pattern: /id="touch-overlay"/ },
  { name: "mobile-controls CSS link", pattern: /mobile-controls\.css/ },
  { name: "game-boot-metrics", pattern: /game-boot-metrics\.js/ },
  { name: "SW registration", pattern: /navigator\.serviceWorker\.register/ },
];

const REQUIRED_SHARED_SCRIPTS = [
  "pygame-input-bridge.js",
  "game-viewport.js",
  "mobile-controls.js",
];

const CSP_ROUTES = ["/", "/index.html", "/*"];

let failures = 0;

function fail(msg) {
  console.error(`  [FAIL] ${msg}`);
  failures++;
}

function ok(msg) {
  console.log(`  [PASS] ${msg}`);
}

console.log(`Checking browser-game shells...`);
console.log(
  `Browser-playable games: ${browserGames.map((g) => g.id).join(", ")}`,
);
console.log("");

if (browserGames.length === 0) {
  fail("No browser-playable games found in games.json");
  process.exit(1);
}

for (const game of browserGames) {
  const gameDir = game.id;
  const indexPath = resolve(root, "public/play", gameDir, "index.html");
  const archivePath = resolve(
    root,
    "public/play",
    gameDir,
    `${gameDir}.tar.gz`,
  );
  const controlMode = game.controlMode || "unknown";

  console.log(`── ${game.title} (${gameDir}, ${controlMode}) ──`);

  // 1. Shell exists
  if (existsSync(indexPath)) {
    ok("index.html exists");
  } else {
    fail(`${gameDir}: missing index.html`);
    continue;
  }

  const html = readFileSync(indexPath, "utf-8");

  // 2. Archive exists
  if (existsSync(archivePath)) {
    ok(".tar.gz archive exists");
  } else {
    fail(`${gameDir}: missing .tar.gz archive`);
  }

  // 3. CDN version pin
  const cdnVersion = `pythons.js@${game.cdnVersion || "0.9.3"}`;
  const cdnRegex = new RegExp(
    cdnVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  if (cdnRegex.test(html)) {
    ok(`CDN version pinned to ${game.cdnVersion || "0.9.3"}`);
  } else {
    fail(`${gameDir}: CDN version "${cdnVersion}" not found`);
  }

  // 4. Archive URL matches game
  const archiveUrlPattern = new RegExp(
    `${gameDir}\\.tar\\.gz\\?v=${ASSET_VERSION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
  );
  if (archiveUrlPattern.test(html)) {
    ok(`archive URL matches game + version`);
  } else {
    const found = html.match(new RegExp(`${gameDir}\\.tar\\.gz\\?v=([^"']+)`));
    fail(
      `${gameDir}: archive URL has wrong version (${found ? "found v" + found[1] : "not found"})`,
    );
  }

  // 5. Preload link
  const preloadPattern = new RegExp(
    `rel="preload"[^>]*href="[^"]*${gameDir}\\.tar\\.gz\\?v=${ASSET_VERSION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
  );
  if (preloadPattern.test(html)) {
    ok("preload link present");
  } else {
    fail(`${gameDir}: missing preload link`);
  }

  // 6. Structural invariants
  for (const { name, pattern } of REQUIRED_INVARIANTS) {
    if (pattern.test(html)) {
      ok(name);
    } else {
      fail(`${gameDir}: missing "${name}"`);
    }
  }

  // 7. Shared scripts versioned
  for (const script of REQUIRED_SHARED_SCRIPTS) {
    const jsPattern = new RegExp(
      `${script.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?v=${ASSET_VERSION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    );
    if (jsPattern.test(html)) {
      ok(`shared script: ${script}`);
    } else {
      if (html.includes(script)) {
        const verMatch = html.match(new RegExp(`${script}\\?v=([^"']+)`));
        fail(
          `${gameDir}: ${script} version${verMatch ? " is v" + verMatch[1] + " (expected v" + ASSET_VERSION + ")" : " is unversioned"}`,
        );
      } else {
        fail(`${gameDir}: missing shared script "${script}"`);
      }
    }
  }

  // 8. SW registration: no module, updateViaCache
  if (html.includes("type: 'module'") || html.includes('type: "module"')) {
    fail(`${gameDir}: SW registration uses module type`);
  }
  if (
    html.includes("updateViaCache: 'none'") ||
    html.includes('updateViaCache: "none"')
  ) {
    ok("SW updateViaCache: none");
  } else {
    fail(`${gameDir}: SW registration missing updateViaCache: none`);
  }

  // 9. PirateArcadeLoading API (full surface)
  if (html.includes("window.PirateArcadeLoading")) {
    const hasEnsureEls = html.includes("_ensureEls");
    const hasSetter = html.includes("set:") || html.includes("set(");
    const hasReady = html.includes("ready:");
    const hasError = html.includes("error:");
    const features = [
      hasEnsureEls ? "_ensureEls" : null,
      hasSetter ? "set" : null,
      hasReady ? "ready" : null,
      hasError ? "error" : null,
    ].filter(Boolean);
    ok(`PirateArcadeLoading API (${features.join(", ")})`);
    if (!hasEnsureEls) {
      fail(`${gameDir}: PirateArcadeLoading missing _ensureEls`);
    }
  } else {
    fail(`${gameDir}: missing PirateArcadeLoading API`);
  }

  // 10. data-controls mode
  const controlsPattern = new RegExp(`data-controls="${controlMode}"`);
  if (controlsPattern.test(html)) {
    ok(`data-controls="${controlMode}"`);
  } else {
    fail(`${gameDir}: expected data-controls="${controlMode}"`);
  }

  // 11. Manifest comment
  const manifestMatch = html.match(/<!--\s*\n\s*GAME:\s*(\S+)/);
  if (manifestMatch) {
    const manifestGame = manifestMatch[1];
    if (manifestGame === gameDir) {
      ok("manifest comment matches");
    } else {
      fail(`${gameDir}: manifest says "${manifestGame}"`);
    }
  } else {
    fail(`${gameDir}: missing manifest comment`);
  }

  console.log("");
}

// ── Cross-game checks ──
console.log("── cross-game ──");

const contents = browserGames.map((g) => {
  const path = resolve(root, "public/play", g.id, "index.html");
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
});

// Shared script versions consistent across all shells
const versionMatches = contents.map((c) => c.match(/\?v=([\w.-]+)/));
const versions = versionMatches.map((m) => (m ? m[1] : null));
if (versions.every((v) => v && v === versions[0])) {
  ok(`shared script version consistent (${versions[0]})`);
} else {
  fail(`shared script version mismatch: ${versions.join(" vs ")}`);
}

// Lang attribute consistent
const langs = contents.map((c) => {
  const m = c.match(/<html\s+lang="([^"]+)"/);
  return m ? m[1] : null;
});
if (langs.every((l) => l && l === langs[0])) {
  ok(`html lang consistent (${langs[0]})`);
} else {
  fail(`html lang mismatch`);
}

// ── CSP checks ──
console.log("");
console.log("── CSP ──");

const headersPath = resolve(root, "public/_headers");
const headers = readFileSync(headersPath, "utf-8");

// Global route must NOT have unsafe-eval
const globalCSP = headers.match(/^\/\*[\s\S]*?^$/m);
if (globalCSP) {
  const globalBlock = globalCSP[0];
  if (
    globalBlock.includes("unsafe-eval") &&
    !globalBlock.includes("wasm-unsafe-eval")
  ) {
    fail("global CSP contains unsafe-eval");
  } else {
    ok("global CSP is safe (no unsafe-eval)");
  }
}

// Each browser game route must have CSP entries
for (const game of browserGames) {
  for (const suffix of CSP_ROUTES) {
    const route = `/play/${game.id}${suffix}`;
    const cspBlock = headers.match(
      new RegExp(
        `^${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?^$`,
        "m",
      ),
    );
    if (cspBlock) {
      if (cspBlock[0].includes("unsafe-eval")) {
        ok(`CSP entry for ${route} includes unsafe-eval`);
      } else {
        fail(`${route}: CSP missing unsafe-eval`);
      }
    } else {
      fail(`missing CSP entry for ${route}`);
    }
  }
}

// ── Service worker checks ──
console.log("");
console.log("── Service Worker ──");

const swPath = resolve(root, "public/sw.js");
const swContent = readFileSync(swPath, "utf-8");

for (const game of browserGames) {
  const route = `/play/${game.id}/`;
  const archivePath = `/play/${game.id}/${game.id}.tar.gz`;

  if (swContent.includes(route)) {
    ok(`SW caches ${route}`);
  } else {
    fail(`SW missing cache entry for ${route}`);
  }

  if (swContent.includes(archivePath)) {
    ok(`SW caches ${archivePath}`);
  } else {
    fail(`SW missing cache entry for ${archivePath}`);
  }
}

console.log("");
if (failures > 0) {
  console.error(`FAILED: ${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log("PASSED: All browser-game shell checks passed.");
}
