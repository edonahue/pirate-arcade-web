#!/usr/bin/env node

import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { readFileSync } from "fs";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = dirname(__dirname);

const GAMES = [
  {
    id: "cannonball-clash",
    name: "Cannonball Clash",
    paddleKind: "pong",
    sourcePath: "scripts/pygbag-port/cannonball-clash/games/pong/paddle.py",
    gameplayPath: "scripts/pygbag-port/cannonball-clash/games/pong/gameplay.py",
    archivePath: "public/play/cannonball-clash/cannonball-clash.tar.gz",
    archiveSubPath: "assets/games/pong/paddle.py",
    requiredMarkers: [
      "_build_surfs",
      "_ship_surf",
      "pg.draw.polygon",
      /PIRATE_\w+/,
      "visual_w",
      "flag_color",
      "mast_x",
      "accent_color",
      "port_color",
      "PIRATE_TEAL",
      "PIRATE_RED",
    ],
    gameplayMarkers: [
      "__pa_touch_active__",
      "__pa_touch_axis__",
      "__pa_touch_value__",
    ],
  },
  {
    id: "treasure-cove",
    name: "Treasure Cove",
    paddleKind: "breakout",
    sourcePath: "scripts/pygbag-port/treasure-cove/games/breakout/paddle.py",
    gameplayPath:
      "scripts/pygbag-port/treasure-cove/games/breakout/gameplay.py",
    archivePath: "public/play/treasure-cove/treasure-cove.tar.gz",
    archiveSubPath: "assets/games/breakout/paddle.py",
    requiredMarkers: [
      "_build_surfs",
      "_ship_surf",
      "pg.draw.polygon",
      /PIRATE_\w+/,
      "vw",
      "mast_x",
      "crate",
      "lantern",
      "PIRATE_GOLD",
      "PIRATE_DARK_WOOD",
    ],
    gameplayMarkers: [
      "__pa_touch_active__",
      "__pa_touch_axis__",
      "__pa_touch_value__",
    ],
  },
  {
    id: "krakens-wake",
    name: "Kraken's Wake",
    paddleKind: "asteroids",
    sourcePath: "scripts/pygbag-port/krakens-wake/games/asteroids/ship.py",
    gameplayPath: null,
    archivePath: "public/play/krakens-wake/krakens-wake.tar.gz",
    archiveSubPath: "assets/games/asteroids/ship.py",
    requiredMarkers: [
      "_build_ship",
      "_ship_surf",
      "pg.draw.polygon",
      /PIRATE_\w+/,
      "flame",
      "mast",
      "PIRATE_FLAME",
    ],
    gameplayMarkers: [],
  },
];

console.log("🔍 Checking game theming source markers...");

let allPassed = true;

for (const game of GAMES) {
  console.log(`\n── ${game.name} ──`);

  // Check source file has ship-building code
  const sourcePath = join(root, game.sourcePath);
  try {
    const sourceCode = readFileSync(sourcePath, "utf-8");

    for (const marker of game.requiredMarkers) {
      if (marker instanceof RegExp) {
        if (!marker.test(sourceCode)) {
          console.log(`  ❌ Missing regex pattern: ${marker}`);
          allPassed = false;
        } else {
          console.log(`  ✅ Pattern: ${marker}`);
        }
      } else {
        if (!sourceCode.includes(marker)) {
          console.log(`  ❌ Missing marker: ${marker}`);
          allPassed = false;
        } else {
          console.log(`  ✅ ${marker}`);
        }
      }
    }

    if (game.gameplayPath) {
      const gameplayPath = join(root, game.gameplayPath);
      const gameplayCode = readFileSync(gameplayPath, "utf-8");
      for (const marker of game.gameplayMarkers) {
        if (!gameplayCode.includes(marker)) {
          console.log(`  ❌ Gameplay missing: ${marker}`);
          allPassed = false;
        } else {
          console.log(`  ✅ Gameplay: ${marker}`);
        }
      }
    }
  } catch (err) {
    console.log(`  ❌ Error reading source: ${err.message}`);
    allPassed = false;
  }

  // Check the actual shipped archive also contains the updated source code
  const archivePath = join(root, game.archivePath);
  try {
    const archiveSource = execSync(
      `tar xzf "${archivePath}" --to-stdout ${game.archiveSubPath} 2>/dev/null || echo "NOT_FOUND"`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
    );
    if (archiveSource.includes("NOT_FOUND")) {
      console.log(
        `  ❌ Archive file not found in archive: ${game.archiveSubPath}`,
      );
      allPassed = false;
    } else {
      if (!archiveSource.includes("_ship_surf")) {
        console.log(`  ❌ Archive missing _ship_surf`);
        allPassed = false;
      } else {
        console.log(`  ✅ Archive has _ship_surf`);
      }
    }
  } catch (err) {
    console.log(`  ❌ Error reading archive: ${err.message}`);
    allPassed = false;
  }
}

if (allPassed) {
  console.log("\n✅ All game theming source marker checks passed!");
  process.exit(0);
} else {
  console.log("\n❌ Some game theming source marker checks failed!");
  process.exit(1);
}
