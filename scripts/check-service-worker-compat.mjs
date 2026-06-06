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

const GAMES = [
  {
    id: "cannonball-clash",
    html: "public/play/cannonball-clash/index.html",
  },
  {
    id: "treasure-cove",
    html: "public/play/treasure-cove/index.html",
  },
  {
    id: "krakens-wake",
    html: "public/play/krakens-wake/index.html",
  },
];

const DESKTOP_ONLY_ASSETS = [/port-royale/];

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
//    We check that 'self.addEventListener("message",' appears after the activate handler closes.
//    The activate handler ends with }); on its own line, so we look for message addEventListener
//    after that pattern.
const activateEndIndex = swCode.lastIndexOf(
  "});",
  swCode.indexOf("self.addEventListener('fetch'"),
);
const messageListenerIndex = swCode.indexOf('self.addEventListener("message",');
if (messageListenerIndex === -1) {
  fail(
    'sw.js must have a top-level self.addEventListener("message", ...) for WARM_CACHE',
  );
} else if (messageListenerIndex < activateEndIndex) {
  fail(
    "WARM_CACHE message listener is nested inside activate — must be at top-level scope",
  );
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

// 7. ASSETS_TO_CACHE only includes browser-playable games (no desktop-only)
const assetsSection = swCode.slice(
  swCode.indexOf("ASSETS_TO_CACHE"),
  swCode.indexOf("];"),
);
for (const pattern of DESKTOP_ONLY_ASSETS) {
  if (pattern.test(assetsSection)) {
    fail(`ASSETS_TO_CACHE must not contain desktop-only game: ${pattern}`);
  }
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
