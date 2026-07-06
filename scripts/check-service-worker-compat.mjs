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
 *  7. ASSETS_TO_CACHE only includes Pygbag browser-playable games (no desktop-only, no web-native).
 *  8. SW registration in game HTMLs does NOT use type: "module".
 *  9. isGameShell fetch strategy only covers Pygbag games and shared paths.
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
const PYGAMES = BROWSER_GAMES.filter((g) => !g.engine || g.engine === "pygbag");
const WEB_NATIVE = BROWSER_GAMES.filter((g) => g.engine === "phaser");
const GAMES = PYGAMES.map((g) => ({
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
  const activateStart = swCode.indexOf("addEventListener('activate'");
  if (activateStart !== -1 && messageListenerIndex > activateStart) {
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
  if (!swCode.includes("new URL(raw, self.location.origin)")) {
    fail("WARM_CACHE must normalize relative URLs via new URL(raw, origin)");
  }
  if (
    !swCode.includes("WARM_CACHE_RESULT") ||
    !swCode.includes("event.source.postMessage")
  ) {
    fail("WARM_CACHE must post WARM_CACHE_RESULT back to client");
  }
  if (!swCode.includes("response.status === 200")) {
    fail("WARM_CACHE must only cache HTTP 200 responses");
  }
  if (!swCode.includes("cache.match(")) {
    fail("WARM_CACHE must check cache.match() before fetching");
  }
  if (!swCode.includes('"deduplicated"')) {
    fail("WARM_CACHE must deduplicate concurrent requests");
  }
}

// 7. ASSETS_TO_CACHE must include ALL Pygbag browser-playable games (no desktop-only, no web-native)
const assetsSectionStart = swCode.indexOf("ASSETS_TO_CACHE");
const assetsSectionEnd = swCode.indexOf("];", assetsSectionStart);
if (assetsSectionStart !== -1 && assetsSectionEnd !== -1) {
  const assetsSection = swCode.slice(assetsSectionStart, assetsSectionEnd + 2);

  for (const id of DESKTOP_ONLY_IDS) {
    if (assetsSection.includes(id)) {
      fail(`ASSETS_TO_CACHE must not contain desktop-only game: ${id}`);
    }
  }

  for (const game of WEB_NATIVE) {
    if (assetsSection.includes(`/play/${game.id}/`)) {
      fail(`ASSETS_TO_CACHE must not contain web-native game: ${game.id}`);
    }
  }

  for (const game of PYGAMES) {
    const route = `/play/${game.id}/`;
    const archivePath = `/play/${game.id}/${game.id}.tar.gz`;
    const hasRoute = assetsSection.includes(route);
    const hasArchive = assetsSection.includes(archivePath);
    if (hasRoute && !hasArchive) {
      console.log(
        `  [PASS] ASSETS_TO_CACHE includes ${game.id} shell but not archive`,
      );
    } else {
      if (!hasRoute) {
        fail(`ASSETS_TO_CACHE missing directory entry: ${route}`);
      }
      if (hasArchive) {
        fail(
          `ASSETS_TO_CACHE must not contain archive entry: ${archivePath} (archives are cache-first via ?h= content hashes)`,
        );
      }
    }
  }

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

// 9. Fetch strategy: isGameShell must cover Pygbag games and shared paths,
//    and should NOT include web-native games (handled by Astro/Vite)
const isGameShellBlock = swCode.match(/const isGameShell\s*=[\s\S]*?;\n/);
if (isGameShellBlock) {
  const block = isGameShellBlock[0];
  for (const game of PYGAMES) {
    const pathPattern = `/play/${game.id}/`;
    if (block.includes(pathPattern)) {
      console.log(`  [PASS] isGameShell includes ${game.id}`);
    } else {
      fail(
        `isGameShell fetch strategy missing path: startsWith("${pathPattern}")`,
      );
    }
  }
  for (const game of WEB_NATIVE) {
    const pathPattern = `/play/${game.id}/`;
    if (block.includes(pathPattern)) {
      console.log(`  [INFO] isGameShell includes web-native ${game.id} route`);
    }
  }
  if (block.includes("/play/shared/")) {
    console.log(`  [PASS] isGameShell includes shared assets path`);
  } else {
    fail(`isGameShell fetch strategy missing shared assets path`);
  }
} else {
  fail("sw.js must have isGameShell variable in fetch strategy");
}

// --- Check each Pygbag game HTML ---
for (const game of GAMES) {
  const htmlPath = resolve(ROOT, game.html);
  const html = readFileSync(htmlPath, "utf-8");

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
