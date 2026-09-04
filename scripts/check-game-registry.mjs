#!/usr/bin/env node
/**
 * Game registry consistency check.
 * Validates src/data/games.json for structural correctness,
 * required fields, enum values, and cross-references.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const GAMES_PATH = join(root, "src/data/games.json");
const PUBLIC_DIR = join(root, "public");

const VALID_STATUSES = [
  "browser-playable",
  "desktop-available",
  "browser-planned",
  "experimental",
];
const VALID_ENGINES = ["pygbag", "phaser"];
const VALID_CONTROL_MODES = ["pong", "breakout", "asteroids", "racer"];
const VALID_TOUCH_DIFFICULTIES = ["easy", "medium", "harder"];
const VALID_CHALLENGES = ["easier", "balanced", "harder"];

/** Fields required for every game */
const REQUIRED_FIELDS = [
  "id",
  "title",
  "classic",
  "description",
  "status",
  "statusLabel",
  "screenshot",
  "seoDescription",
];

/** Fields required for browser-playable games */
const BROWSER_REQUIRED = [
  "browserUrl",
  "engine",
  "controlMode",
  "touchDifficulty",
  "touchDifficultyLabel",
  "challenge",
  "touchControls",
  "keyboardControls",
  "howToPlay",
  "tips",
  "firstPlayTip",
  "availabilityNote",
];

/** Fields required for desktop-available games */
const DESKTOP_REQUIRED = ["desktopUrl"];

let exitCode = 0;

function fail(msg) {
  console.error(`  FAIL: ${msg}`);
  exitCode = 1;
}

let games;
try {
  const raw = readFileSync(GAMES_PATH, "utf-8");
  games = JSON.parse(raw);
} catch (err) {
  console.error(`\n❌ Cannot read or parse games.json: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(games)) {
  console.error("\n❌ games.json is not an array");
  process.exit(1);
}

console.log(`\n🔍 Checking game registry (${games.length} games)...\n`);

/** Check unique IDs */
const ids = games.map((g) => g.id);
const uniqueIds = new Set(ids);
if (uniqueIds.size !== ids.length) {
  const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
  fail(`Duplicate game IDs: ${[...new Set(dups)].join(", ")}`);
}

const titles = games.map((g) => g.title);
const uniqueTitles = new Set(titles);
if (uniqueTitles.size !== titles.length) {
  const dups = titles.filter((t, i) => titles.indexOf(t) !== i);
  fail(`Duplicate game titles: ${[...new Set(dups)].join(", ")}`);
}

for (const game of games) {
  const { id, title, status, engine } = game;
  const prefix = `[${id}]`;

  if (!id || typeof id !== "string") {
    fail(`Game at index ${games.indexOf(game)} is missing a valid 'id'`);
    continue;
  }

  /** Check required fields for every game */
  for (const field of REQUIRED_FIELDS) {
    if (!game[field]) {
      fail(`${prefix} missing required field '${field}'`);
    }
  }

  /** Check valid status */
  if (!VALID_STATUSES.includes(status)) {
    fail(
      `${prefix} invalid status '${status}'. Valid: ${VALID_STATUSES.join(", ")}`,
    );
  }

  const isBrowser = status === "browser-playable";
  const isDesktop = status === "desktop-available";

  /** Check browser-specific required fields */
  if (isBrowser) {
    for (const field of BROWSER_REQUIRED) {
      if (!game[field] && game[field] !== "") {
        fail(`${prefix} browser-playable game missing '${field}'`);
      }
    }
  }

  /** Check desktop-specific required fields */
  if (isDesktop) {
    for (const field of DESKTOP_REQUIRED) {
      if (!game[field]) {
        fail(`${prefix} desktop-available game missing '${field}'`);
      }
    }
  }

  /** Check browserUrl format for browser-playable */
  if (isBrowser && game.browserUrl) {
    const expected = `/play/${id}/`;
    if (game.browserUrl !== expected) {
      fail(
        `${prefix} browserUrl '${game.browserUrl}' does not match expected '${expected}'`,
      );
    }
  }

  /** Check desktopUrl is present for desktop-available */
  if (isDesktop && !game.desktopUrl) {
    fail(`${prefix} desktop-available game missing 'desktopUrl'`);
  }

  /** Check screenshot path */
  if (game.screenshot) {
    if (!game.screenshot.startsWith("/images/")) {
      fail(
        `${prefix} screenshot path '${game.screenshot}' does not start with /images/`,
      );
    }
    const screenshotFile = join(PUBLIC_DIR, game.screenshot.replace(/^\//, ""));
    if (!existsSync(screenshotFile)) {
      fail(`${prefix} screenshot file not found: ${screenshotFile}`);
    }
  }

  /** Check valid engine if present */
  if (engine !== undefined && engine !== null) {
    if (!VALID_ENGINES.includes(engine)) {
      fail(
        `${prefix} invalid engine '${engine}'. Valid: ${VALID_ENGINES.join(", ")}`,
      );
    }
  }

  /** Race-specific check */
  if (id === "race-to-treasure-island") {
    if (engine !== "phaser") {
      fail(`${prefix} Race engine must be 'phaser', got '${engine}'`);
    }
  }

  /** Pygbag-specific check */
  if (engine === "pygbag") {
    if (!isBrowser) {
      fail(`${prefix} Pygbag game must be browser-playable, got '${status}'`);
    }
  }

  /** Check controlMode if present */
  if (game.controlMode !== undefined && game.controlMode !== null) {
    if (!VALID_CONTROL_MODES.includes(game.controlMode)) {
      fail(
        `${prefix} invalid controlMode '${game.controlMode}'. Valid: ${VALID_CONTROL_MODES.join(", ")}`,
      );
    }
  }

  /** Check touchDifficulty if present */
  if (game.touchDifficulty !== undefined && game.touchDifficulty !== null) {
    if (!VALID_TOUCH_DIFFICULTIES.includes(game.touchDifficulty)) {
      fail(
        `${prefix} invalid touchDifficulty '${game.touchDifficulty}'. Valid: ${VALID_TOUCH_DIFFICULTIES.join(", ")}`,
      );
    }
  }

  /** Check challenge (gameplay challenge, distinct from touchDifficulty) if present */
  if (game.challenge !== undefined && game.challenge !== null) {
    if (!VALID_CHALLENGES.includes(game.challenge)) {
      fail(
        `${prefix} invalid challenge '${game.challenge}'. Valid: ${VALID_CHALLENGES.join(", ")}`,
      );
    }
  }

  /** Desktop-only games should NOT have touchDifficulty or touchControls */
  if (isDesktop) {
    if (game.touchDifficulty) {
      fail(`${prefix} desktop-only game should not have touchDifficulty`);
    }
    if (game.touchControls) {
      fail(`${prefix} desktop-only game should not have touchControls`);
    }
    if (game.touchDifficultyLabel) {
      fail(`${prefix} desktop-only game should not have touchDifficultyLabel`);
    }
  }
}

/** Check features is a non-empty array for every game */
for (const game of games) {
  if (
    !game.features ||
    !Array.isArray(game.features) ||
    game.features.length === 0
  ) {
    fail(`[${game.id}] missing or empty 'features' array`);
  }
}

/** Check demonstrates is a non-empty array for every game */
for (const game of games) {
  if (
    !game.demonstrates ||
    !Array.isArray(game.demonstrates) ||
    game.demonstrates.length === 0
  ) {
    fail(`[${game.id}] missing or empty 'demonstrates' array`);
  }
  for (const item of game.demonstrates) {
    if (typeof item !== "string" || item.trim().length === 0) {
      fail(`[${game.id}] demonstrates item must be a non-empty string`);
    }
    if (item.length > 90) {
      fail(`[${game.id}] demonstrates item too long (max 90 chars): ${item}`);
    }
  }
}

/** Browser-playable games should have bestFor */
for (const game of games) {
  if (game.status === "browser-playable" && !game.bestFor) {
    fail(`[${game.id}] browser-playable game missing 'bestFor'`);
  }
}

/** Check seoDescription lengths (fail on > 160) */
for (const game of games) {
  if (game.seoDescription && game.seoDescription.length > 160) {
    fail(
      `[${game.id}] seoDescription is ${game.seoDescription.length} chars (max 160)`,
    );
  }
}

/**
 * Platform capability matrix (declarative invariants over status/engine/URLs).
 * Desktop capability is: status "desktop-available", OR an explicit
 * desktopUrl, OR a Pygbag engine (all Pygbag ports ship in the shared
 * desktop release). This single matrix replaces the old engine-based rule;
 * see isDesktopAvailable()/getDesktopReleaseUrl() in src/lib/gameLaunch.ts
 * for the matching runtime-side rule. Deep artifact guarantees (generated
 * shells, archive/hash agreement, preload parity) live in their dedicated
 * validators and are referenced here, not duplicated.
 */
for (const game of games) {
  const prefix = `[${game.id}]`;
  const isBrowser = game.status === "browser-playable";
  const hasDesktopCapability =
    game.status === "desktop-available" ||
    !!game.desktopUrl ||
    game.engine === "pygbag";

  // browser+phaser: browser URL required, no archive expected.
  if (isBrowser && game.engine === "phaser" && !game.browserUrl) {
    fail(`${prefix} browser-playable Phaser game missing 'browserUrl'`);
  }

  // browser+pygbag: browser URL required; archive/hash/shell agreement is
  // enforced by check-browser-game-shells, check-game-cache-versioning,
  // check-game-html-versions, and check-archive-parity.
  if (isBrowser && game.engine === "pygbag" && !game.browserUrl) {
    fail(`${prefix} browser-playable Pygbag game missing 'browserUrl'`);
  }

  // desktop-only (no browserUrl): must omit browser control metadata.
  if (!game.browserUrl) {
    for (const field of ["controlMode", "touchDifficulty", "touchControls"]) {
      if (game[field]) {
        fail(`${prefix} non-browser game must not have '${field}'`);
      }
    }
  }

  // Any game with desktop capability must resolve to a release destination:
  // an explicit desktopUrl, or the shared releases index for Pygbag ports
  // and desktop-available titles.
  if (hasDesktopCapability && !game.desktopUrl) {
    if (game.status !== "desktop-available" && game.engine !== "pygbag") {
      fail(`${prefix} desktop-capable game has no resolvable release URL`);
    }
  }

  // Any explicit desktopUrl must be a valid https URL.
  if (game.desktopUrl && !game.desktopUrl.startsWith("https://")) {
    fail(
      `${prefix} desktopUrl should start with https://, got '${game.desktopUrl}'`,
    );
  }
}

console.log("");

if (exitCode === 0) {
  console.log("✅ Game registry checks passed!");
} else {
  console.log(`❌ ${exitCode} game registry check(s) failed.`);
}

process.exit(exitCode);
