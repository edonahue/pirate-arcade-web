#!/usr/bin/env node
/**
 * Check that source files match what's in the game archives
 * Ensures that when we update source, we also update the tarball
 */

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
    sourceDir: "scripts/pygbag-port/cannonball-clash/games/pong",
    archivePath: "public/play/cannonball-clash/cannonball-clash.tar.gz",
    archiveGameDir: "pong",
    keyFiles: ["paddle.py", "gameplay.py", "game.py"],
  },
  {
    id: "treasure-cove",
    sourceDir: "scripts/pygbag-port/treasure-cove/games/breakout",
    archivePath: "public/play/treasure-cove/treasure-cove.tar.gz",
    archiveGameDir: "breakout",
    keyFiles: ["paddle.py", "gameplay.py", "game.py"],
  },
  {
    id: "krakens-wake",
    sourceDir: "scripts/pygbag-port/krakens-wake/games/asteroids",
    archivePath: "public/play/krakens-wake/krakens-wake.tar.gz",
    archiveGameDir: "asteroids",
    keyFiles: ["ship.py", "gameplay.py", "game.py"],
  },
];

const SHARED_FILES = ["__init__.py", "pa_state.py"];

console.log("🔍 Checking archive/source parity...");

let allPassed = true;

for (const game of GAMES) {
  console.log(`\n── ${game.id} ──`);

  for (const file of game.keyFiles) {
    const sourcePath = join(root, game.sourceDir, file);
    const archivePath = join(root, game.archivePath);

    try {
      // Read source file
      const sourceContent = readFileSync(sourcePath, "utf8");

      // Extract from archive
      let archiveContent;
      try {
        archiveContent = execSync(
          `tar xzf "${archivePath}" --to-stdout assets/games/${game.archiveGameDir}/${file} 2>/dev/null`,
          { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
        );
      } catch (err) {
        console.log(`  ❌ ${file}: Failed to extract from archive`);
        allPassed = false;
        continue;
      }

      if (sourceContent === archiveContent) {
        console.log(`  ✅ ${file}: source matches archive`);
      } else {
        console.log(`  ❌ ${file}: source and archive differ!`);
        console.log(`     Source length: ${sourceContent.length}`);
        console.log(`     Archive length: ${archiveContent.length}`);
        allPassed = false;
      }
    } catch (err) {
      console.log(`  ❌ ${file}: Error reading source: ${err.message}`);
      allPassed = false;
    }
  }
}

// Check shared module files in each archive
console.log(`\n── shared ──`);
for (const file of SHARED_FILES) {
  const sourcePath = join(root, "scripts/pygbag-port/shared", file);
  const sourceContent = readFileSync(sourcePath, "utf8");
  for (const game of GAMES) {
    const archivePath = join(root, game.archivePath);
    try {
      const archiveContent = execSync(
        `tar xzf "${archivePath}" --to-stdout assets/shared/${file} 2>/dev/null`,
        { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
      );
      if (sourceContent === archiveContent) {
        console.log(`  ✅ ${game.id} assets/shared/${file}: matches`);
      } else {
        console.log(`  ❌ ${game.id} assets/shared/${file}: differs!`);
        allPassed = false;
      }
    } catch {
      console.log(
        `  ❌ ${game.id} assets/shared/${file}: missing from archive`,
      );
      allPassed = false;
    }
  }
}

if (allPassed) {
  console.log("\n✅ All archive/source parity checks passed!");
  process.exit(0);
} else {
  console.log("\n❌ Archive/source parity check failed!");
  process.exit(1);
}
