/**
 * Assert SW compatibility and WARM_CACHE lifecycle correctness.
 *
 * Checks:
 *  1. No top-level import statements (classic SW only).
 *  2. CACHE_VERSION inlined (no module-level import).
 *  3. WARM_CACHE message listener at top-level scope (not nested inside activate).
 *  4. WARM_CACHE validates same-origin.
 *  5. WARM_CACHE normalizes relative URLs.
 *  6. WARM_CACHE posts result message to client.
 *  7. ASSETS_TO_CACHE only includes browser-playable games (no desktop-only).
 *  8. SW registration in game HTMLs does NOT use type: "module".
 *
 * Usage:
 *   node scripts/check-service-worker-compat.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Read game list from games.json (single source of truth)
const gamesPath = resolve(ROOT, "src/data/games.json");
const gamesMeta = JSON.parse(readFileSync(gamesPath, "utf-8"));
const BROWSER_GAMES = gamesMeta.filter((g) => g.status === "browser-playable");
const GAMES = BROWSER_GAMES.map((g) => ({
  id: g.id,
  html: `public/play/${g.id}/index.html`,
}));

// Desktop-only game IDs from games.json (for ASSETS_TO_CACHE check)
const DESKTOP_ONLY_IDS = gamesMeta
  .filter((g) => g.status !== "browser-playable")
  .map((g) => g.id);

let failures = 0;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failures++;
}

// --- Check sw.js ---
const swPath = resolve(ROOT, "public/sw.js");
const swCode = readFileSync(swPath, "utf-8");

// 1. No top-level imports — must be classic SW
if (/^\s*import\s/ms.test(swCode)) {
  fail("sw.js has top-level import — must be classic service worker");
}

// 2. CACHE_VERSION inlined (not from import)
if (
  !swCode.includes("CACHE_VERSION =") &&
  !swCode.includes('CACHE_VERSION = "pirate-arcade-games-v')
) {
  fail("sw.js CACHE_VERSION must be inlined (not imported)");
}

// 3. WARM_CACHE message listener at TOP-LEVEL scope (not nested inside activate)
// Find the message listener (support both single and double quotes)
const messageListenerRegex = /self\.addEventListener\(["']message["']/;
const messageListenerMatch = messageListenerRegex.exec(swCode);
const messageListenerIndex = messageListenerMatch
  ? messageListenerMatch.index
  : -1;

if (messageListenerIndex === -1) {
  fail(
    'sw.js must have a top-level self.addEventListener("message", ...) for WARM_CACHE',
  );
} else {
  // Verify the message listener is at top level (not nested inside activate)
  // Check that there are more opening braces before the listener than closing braces
  // This is a simple heuristic: count braces up to the listener position
  let braceDepth = 0;
  for (let i = 0; i < messageListenerIndex; i++) {
    const ch = swCode[i];
    if (ch === "{") braceDepth++;
    else if (ch === "}") braceDepth--;
  }
  // At top level, brace depth should be 0 (or 1 if inside IIFE, but not inside activate function)
  // The activate handler is an event listener callback, so it adds one level of nesting
  // If we're at depth >= 1, we might be inside a function
  // More robust: check that the listener is NOT between "addEventListener('activate'" and its closing
  const activateStart = swCode.indexOf("addEventListener('activate'");
  if (activateStart !== -1 && messageListenerIndex > activateStart) {
    // Find the end of the activate callback by matching braces
    let depth = 0;
    let activateEnd = -1;
    for (let i = activateStart; i < swCode.length; i++) {
      if (swCode[i] === "{") depth++;
      else if (swCode[i] === "}") {
        depth--;
        if (depth === 0) {
          activateEnd = i;
          break;
        }
      }
    }
    if (activateEnd !== -1 && messageListenerIndex < activateEnd) {
      fail(
        "WARM_CACHE message listener is nested inside activate — must be at top-level scope",
      );
    }
  }
}

// 4. WARM_CACHE validates same-origin
if (swCode.includes("WARM_CACHE")) {
  if (!swCode.includes("self.location.origin")) {
    fail("WARM_CACHE must validate same-origin (check self.location.origin)");
  }
  if (!swCode.includes("cross-origin")) {
    fail("WARM_CACHE must reject cross-origin URLs");
  }
  // 5. WARM_CACHE normalizes relative URLs
  if (!swCode.includes("new URL(raw, self.location.origin)")) {
    fail("WARM_CACHE must normalize relative URLs via new URL(raw, origin)");
  }
  // 6. WARM_CACHE posts result message
  if (
    !swCode.includes("WARM_CACHE_RESULT") ||
    !swCode.includes("event.source.postMessage")
  ) {
    fail("WARM_CACHE must post WARM_CACHE_RESULT back to client");
  }
  // WARM_CACHE only caches 200 responses
  if (!swCode.includes("response.status === 200")) {
    fail("WARM_CACHE must only cache HTTP 200 responses");
  }
  // WARM_CACHE uses { cache: "no-store" }
  if (!swCode.includes('cache: "no-store"')) {
    fail("WARM_CACHE must fetch with { cache: 'no-store' }");
  }
}

// 7. ASSETS_TO_CACHE must include ALL browser-playable games (no desktop-only)
const assetsSectionStart = swCode.indexOf("ASSETS_TO_CACHE");
const assetsSectionEnd = swCode.indexOf("];", assetsSectionStart);
if (assetsSectionStart !== -1 && assetsSectionEnd !== -1) {
  const assetsSection = swCode.slice(assetsSectionStart, assetsSectionEnd + 2);

  for (const id of DESKTOP_ONLY_IDS) {
    if (assetsSection.includes(id)) {
      fail(`ASSETS_TO_CACHE must not contain desktop-only game: ${id}`);
    }
  }

  for (const game of BROWSER_GAMES) {
    const route = `/play/${game.id}/`;
    const archivePath = `/play/${game.id}/${game.id}.tar.gz`;
    const hasRoute = assetsSection.includes(route);
    const hasArchive = assetsSection.includes(archivePath);
    if (hasRoute && hasArchive) {
      console.log(`  [PASS] ASSETS_TO_CACHE includes ${game.id} fully`);
    } else {
      if (!hasRoute) {
        fail(`ASSETS_TO_CACHE missing directory entry: ${route}`);
      }
      if (!hasArchive) {
        fail(`ASSETS_TO_CACHE missing archive entry: ${archivePath}`);
      }
    }
  }

  // Verify shared scaffolding assets
  const SHARED_ASSETS = [
    "/play/shared/game-boot-metrics.js",
    "/play/shared/pygame-input-bridge.js",
    "/play/shared/mobile-controls.js",
    "/play/shared/mobile-controls.css",
    "/play/shared/audio-bridge.js",
  ];
  for (const asset of SHARED_ASSETS) {
    if (assetsSection.includes(asset)) {
      console.log(`  [PASS] ASSETS_TO_CACHE includes shared: ${asset}`);
    } else {
      fail(`ASSETS_TO_CACHE missing shared asset: ${asset}`);
    }
  }
}

// 9. Fetch strategy must route ALL browser game shells through network-first
const isGameShellBlock = swCode.match(/const isGameShell\s*=[\s\S]*?;\n/);
if (isGameShellBlock) {
  const block = isGameShellBlock[0];
  for (const game of BROWSER_GAMES) {
    const pathPattern = `/play/${game.id}/`;
    if (block.includes(pathPattern)) {
      console.log(`  [PASS] isGameShell includes ${game.id}`);
    } else {
      fail(
        `isGameShell fetch strategy missing path: startsWith("${pathPattern}")`,
      );
    }
  }
  // Verify shared path is included
  if (block.includes("/play/shared/")) {
    console.log(`  [PASS] isGameShell includes shared assets path`);
  } else {
    fail(`isGameShell fetch strategy missing shared assets path`);
  }
} else {
  fail("sw.js must have isGameShell variable in fetch strategy");
}

// --- Check each game HTML ---
for (const game of GAMES) {
  const htmlPath = resolve(ROOT, game.html);
  const html = readFileSync(htmlPath, "utf-8");

  // 8. SW registration must NOT use type: "module"
  //    We look specifically for type: "module" within the register() call,
  //    not the Pygbag <script type="module"> tag.
  const registerMatch = html.match(
    /navigator\.serviceWorker\.register\([^)]+\)/,
  );
  if (registerMatch && registerMatch[0].includes("module")) {
    fail(
      `${game.id}: SW registration must not use type: "module" (classic SW only)`,
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures} SW compat failure(s) found.`);
  process.exit(1);
} else {
  console.log("All service worker compatibility checks passed.");
}
