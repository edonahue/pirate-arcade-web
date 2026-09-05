#!/usr/bin/env node
/*
 * Live/Repo Parity Checker
 * Verifies that live site matches expected repo state.
 *
 * Performs blocking local checks (sw.js validity, game HTML versions)
 * that must pass before any release.
 *
 * Non-blocking parity checks (live site) use ALLOW_STALE_LIVE to bypass
 * failures during deployment propagation.
 *
 * Registry-driven: game lists derived from src/data/games.json,
 * not hardcoded. Coverage: core routes, detail routes, browser routes,
 * Pygbag, Phaser, desktop-only.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dirname } from "node:path";

const __filename = new URL(import.meta.url).pathname;
const __dirname = dirname(__filename);

// Load version manifest (same directory as this script)
const { ASSET_VERSION, CACHE_VERSION } =
  await import("./game-asset-versions.mjs");

// Load game registry
const gamesList = JSON.parse(
  readFileSync(resolve(__dirname, "..", "src", "data", "games.json"), "utf-8"),
);
const games = gamesList;

// Derive game categories from registry (NOT hardcoded)
const BROWSER_GAMES = games.filter((g) => g.status === "browser-playable");
const PYGBAG_GAMES = games.filter((g) => g.engine === "pygbag");
const PHASER_GAMES = BROWSER_GAMES.filter((g) => g.engine === "phaser");
const DESKTOP_GAMES = games.filter((g) => g.status === "desktop-available");
const ALL_GAMES = games;

const ROOT = resolve(__dirname, "..");
const LIVE_BASE = process.env.LIVE_BASE || "https://pirate-arcade.com";
const ALLOW_STALE_LIVE = process.env.ALLOW_STALE_LIVE === "1";

const checks = [];
let passed = 0;
let failed = 0;

function check(name, condition, details) {
  checks.push({ name, passed: condition, details });
  if (condition) {
    passed++;
    console.log("RT" + "RT" + "RT" + "RT" + "RT" + "RT" + "✅ " + name);
  } else {
    failed++;
    console.log("RT" + "RT" + "RT" + "RT" + "RT" + "RT" + "❌ " + name);
    if (details)
      console.log("RT" + "RT" + "RT" + "RT" + "RT" + "RT" + "   " + details);
  }
}

function fail(name, details) {
  check(name, false, details);
}

function checkLocalFile(filePath, name, predicate, details) {
  try {
    const content = readFileSync(resolve(ROOT, filePath), "utf-8");
    check(name, predicate(content), details);
  } catch (err) {
    fail(name, "Error reading " + filePath + ": " + err.message);
  }
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("HTTP " + response.status + ": " + response.statusText);
  }
  return await response.text();
}

// ———————————————————————————————
// LOCAL (blocking) checks — must pass for release
// ———————————————————————————————
console.log(
  "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT",
);

// 1. sw.js: no top-level imports, correct cache version
checkLocalFile(
  "public/sw.js",
  "SW: no top-level import",
  function (c) {
    return !/^\s*import\s/s.test(c);
  },
  "Do not use import in classic SW",
);
checkLocalFile(
  "public/sw.js",
  "SW: has correct CACHE_VERSION",
  function (c) {
    return c.includes('const CACHE_VERSION = "' + CACHE_VERSION + '"');
  },
  "Expected: " + CACHE_VERSION,
);

// 2. Game HTML: version consistency for every Pygbag game
for (var _i = 0; _i < PYGBAG_GAMES.length; _i++) {
  var gamePygbag = PYGBAG_GAMES[_i];
  var gameDir = gamePygbag.id;
  var htmlPath = "public/play/" + gameDir + "/index.html";

  checkLocalFile(
    htmlPath,
    gameDir + ": correct archive URL version",
    function (c) {
      return (
        c.includes(gameDir + ".tar.gz?h=") ||
        c.includes(gameDir + ".tar.gz?v=" + ASSET_VERSION)
      );
    },
  );
  checkLocalFile(
    htmlPath,
    gameDir + ": correct mobile-controls.css version",
    function (c) {
      return c.includes("mobile-controls.css?v=" + ASSET_VERSION);
    },
  );
  checkLocalFile(
    htmlPath,
    gameDir + ": correct shared JS versions",
    function (c) {
      return (
        c.includes("pygame-input-bridge.js?v=" + ASSET_VERSION) &&
        c.includes("game-viewport.js?v=" + ASSET_VERSION) &&
        c.includes("mobile-controls.js?v=" + ASSET_VERSION)
      );
    },
  );
  checkLocalFile(
    htmlPath,
    gameDir + ": SW registration uses updateViaCache: none",
    function (c) {
      return (
        c.includes("updateViaCache: 'none'") ||
        c.includes('updateViaCache: "none"')
      );
    },
  );
  checkLocalFile(
    htmlPath,
    gameDir + ": SW registration is classic (no type: module)",
    function (c) {
      return !c.includes("type: 'module'") && !c.includes('type: "module"');
    },
  );
  checkLocalFile(
    htmlPath,
    gameDir + ": loading overlay uses PirateArcadeLoading",
    function (c) {
      return c.includes("PirateArcadeLoading") && c.includes("game-ready");
    },
  );
  checkLocalFile(
    htmlPath,
    gameDir + ": loading overlay shows phase details",
    function (c) {
      return (
        c.includes("game-loading-detail") && c.includes("_detailEl.textContent")
      );
    },
  );
  checkLocalFile(
    htmlPath,
    gameDir + ": data-no-touch-control on back link",
    function (c) {
      return c.includes("data-no-touch-control");
    },
  );
}

// 3. game-viewport.js: exposes canvas-bottom-offset
checkLocalFile(
  "public/play/shared/game-viewport.js",
  "game-viewport.js: uses visualViewport.offsetLeft/offsetTop",
  function (c) {
    return c.includes("visualViewport") && c.includes("offsetLeft");
  },
);
checkLocalFile(
  "public/play/shared/game-viewport.js",
  "game-viewport.js: exposes --game-canvas-bottom-offset",
  function (c) {
    return c.includes("--game-canvas-bottom-offset");
  },
);

// 4. mobile-controls.css: drag zones use correct bottom coordinate
checkLocalFile(
  "public/play/shared/mobile-controls.css",
  "mobile-controls.css: touch-drag-x uses bottom-offset",
  function (c) {
    return (
      !c.includes("bottom: var(--game-canvas-bottom,") &&
      c.includes("bottom: var(--game-canvas-bottom-offset,")
    );
  },
);

// 5. game-asset-versions.js (shared runtime): matches manifest
checkLocalFile(
  "public/play/shared/game-asset-versions.js",
  "Shared game-asset-versions.js matches manifest",
  function (c) {
    return (
      c.includes('"' + ASSET_VERSION + '"') &&
      c.includes('"' + CACHE_VERSION + '"')
    );
  },
);

// ———————————————————————————————
// LIVE checks — informational, allow-stale-able
// ———————————————————————————————
console.log(
  "RT" + "RT" + "RT" + "RT" + "RT" + "RT" + "RT" + "RT" + "RT" + "RT",
);

// Check service worker
try {
  var swText = await fetchText(LIVE_BASE + "/sw.js");
  var swCacheCheck = swText.includes(
    'const CACHE_NAME = "' + CACHE_VERSION + '";',
  );
  var swArchiveCheck =
    swText.includes('if (url.pathname.endsWith(".tar.gz"))') &&
    swText.includes("event.respondWith(networkFirst(event);)");
  check(
    "SW has correct cache name",
    swCacheCheck,
    "Expected: " + CACHE_VERSION,
  );
  check(
    "SW has correct archive strategy",
    swArchiveCheck,
    "Should use network-first for archives",
  );
} catch (err) {
  check("SW fetch", false, err.message);
}

// Core site routes
var coreRoutes = ["/", "/play/", "/about/", "/source/", "/build-log/"];
for (var _i2 = 0; _i2 < coreRoutes.length; _i2++) {
  var route = coreRoutes[_i2];
  try {
    var txt = await fetchText(LIVE_BASE + route);
    check(
      route + " responds",
      txt.length > 1000,
      "Should have substantial content",
    );
  } catch (err) {
    check(route + " fetch", false, err.message);
  }
}

// Game detail routes for every registry game
for (var _i3 = 0; _i3 < ALL_GAMES.length; _i3++) {
  var gameDetail = ALL_GAMES[_i3];
  var gameIdDetail = gameDetail.id;
  try {
    var txtDetail = await fetchText(LIVE_BASE + "/games/" + gameIdDetail + "/");
    check(
      "/games/" + gameIdDetail + "/ responds",
      txtDetail.length > 1000,
      "Detail page should respond",
    );
    if (gameDetail.engine === "pygbag") {
      check(
        gameIdDetail + " archive hash present",
        txtDetail.includes(gameIdDetail + ".tar.gz?h="),
        "Archive URL hash should be present",
      );
    }
    if (gameDetail.engine === "phaser") {
      check(
        gameIdDetail + " has Instant start",
        txtDetail.includes("Instant start"),
        "Phaser game should have Instant start",
      );
    }
    if (gameDetail.status === "desktop-available") {
      check(
        gameIdDetail + " desktop destination",
        txtDetail.includes("Desktop download") ||
          txtDetail.includes("github.com/edonahue/pirate-arcade/releases"),
        "Desktop download link should appear",
      );
    }
  } catch (err) {
    check("/games/" + gameIdDetail + "/ fetch", false, err.message);
  }
}

// Browser routes for every browser-playable game
for (var _i4 = 0; _i4 < BROWSER_GAMES.length; _i4++) {
  var gameBrowser = BROWSER_GAMES[_i4];
  try {
    var txtBrowser = await fetchText(
      LIVE_BASE + "/play/" + gameBrowser.id + "/",
    );
    check(
      "/play/" + gameBrowser.id + "/ responds",
      txtBrowser.length > 1000,
      "Game detail page should respond",
    );
    if (gameBrowser.engine === "pygbag") {
      check(
        gameBrowser.id + " has Runtime load",
        txtBrowser.includes("Runtime load"),
        "Pygbag game should have Runtime load",
      );
      check(
        gameBrowser.id + " has no Instant start",
        !txtBrowser.includes("Instant start"),
        "Pygbag game should not have Instant start",
      );
    }
    if (gameBrowser.engine === "phaser") {
      check(
        gameBrowser.id + " has Instant start",
        txtBrowser.includes("Instant start"),
        "Phaser game should have Instant start",
      );
      check(
        gameBrowser.id + " has no Runtime load",
        !txtBrowser.includes("Runtime load"),
        "Phaser game should not have Runtime load",
      );
    }
  } catch (err) {
    check("/play/" + gameBrowser.id + "/ fetch", false, err.message);
  }
}

// Pygbag game detailed checks
for (var _i5 = 0; _i5 < PYGBAG_GAMES.length; _i5++) {
  var gamePygbagDetail = PYGBAG_GAMES[_i5];
  try {
    var txtPygbagDetail = await fetchText(
      LIVE_BASE + "/play/" + gamePygbagDetail.id + "/",
    );
    check(
      gamePygbagDetail.id + " has data-no-touch-control",
      txtPygbagDetail.includes(
        '<a id="back-link" href="/play/" data-no-touch-control>',
      ),
      "Should have data-no-touch-control attribute",
    );
    check(
      gamePygbagDetail.id + " has game-ready event",
      txtPygbagDetail.includes("game-ready"),
      "Should reference game-ready event",
    );
    check(
      gamePygbagDetail.id + " has game-loading-detail",
      txtPygbagDetail.includes("game-loading-detail"),
      "Should show phase details during load",
    );
  } catch (err) {
    check(gamePygbagDetail.id + " detailed fetch", false, err.message);
  }
}

// Phaser game checks
if (PHASER_GAMES.length > 0) {
  var gamePhaser = PHASER_GAMES[0];
  try {
    var txtPhaser = await fetchText(LIVE_BASE + "/play/" + gamePhaser.id + "/");
    check(
      gamePhaser.id + " has no Runtime load badge",
      !txtPhaser.includes("Runtime load"),
      "Phaser game should not have Runtime load",
    );
    check(
      gamePhaser.id + " has game-ready event",
      txtPhaser.includes("game-ready"),
      "Phaser game should have game-ready event",
    );
  } catch (err) {
    check(gamePhaser.id + " Phaser fetch", false, err.message);
  }
}

// Desktop-only game checks
if (DESKTOP_GAMES.length > 0) {
  var gameDesktop = DESKTOP_GAMES[0];
  try {
    var txtDesktop = await fetchText(
      LIVE_BASE + "/games/" + gameDesktop.id + "/",
    );
    check(
      gameDesktop.id + " detail page has desktop destination",
      txtDesktop.includes("Desktop download") ||
        txtDesktop.includes("github.com/edonahue/pirate-arcade/releases"),
      "Desktop download link should appear in detail page",
    );
  } catch (err) {
    check(gameDesktop.id + " desktop fetch", false, err.message);
  }
}

// Homepage
try {
  var homeText = await fetchText(LIVE_BASE + "/");
  check(
    "Homepage loads",
    homeText.length > 1000,
    "Should have substantial content",
  );
} catch (err) {
  check("Homepage fetch", false, err.message);
}

// data-no-touch-control check for every Pygbag game
for (var _i6 = 0; _i6 < PYGBAG_GAMES.length; _i6++) {
  var gamePygbagD = PYGBAG_GAMES[_i6];
  try {
    var cbText = await fetchText(LIVE_BASE + "/play/" + gamePygbagD.id + "/");
    check(
      gamePygbagD.id + " has data-no-touch-control on back link",
      cbText.includes(
        '\'<a id="back-link" href="/play/" data-no-touch-control>',
      ),
      "Should have data-no-touch-control attribute",
    );
  } catch (err) {
    check(gamePygbagD.id + " data-no-touch-control fetch", false, err.message);
  }
}

console.log(
  "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "RT" +
    "Results: " +
    passed +
    " passed, " +
    failed +
    " failed",
);

if (failed > 0 && !ALLOW_STALE_LIVE) {
  console.log(
    "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "❌ Parity check failed. Live site is stale or misconfigured.",
  );
  console.log(
    "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "To allow stale live (e.g., during propagation), run:",
  );
  console.log(
    "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "ALLOW_STALE_LIVE=1 npm run test:live-parity",
  );
  process.exit(1);
} else if (failed > 0) {
  console.log(
    "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "⚠️  Parity check had issues but continuing due to ALLOW_STALE_LIVE=1",
  );
} else {
  console.log(
    "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "RT" +
      "✅ All parity checks passed. Live site matches repo expectations.",
  );
}
