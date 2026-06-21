/**
 * Patch and repack browser game archives from the source directory
 * (scripts/pygbag-port/) into public/play/.
 *
 * Usage:
 *   node scripts/patch-browser-game-archives.mjs              # all games
 *   node scripts/patch-browser-game-archives.mjs --game=pong  # single game
 *   node scripts/patch-browser-game-archives.mjs --game=breakout
 *   node scripts/patch-browser-game-archives.mjs --game=asteroids
 *
 * Run this after modifying any Python source under scripts/pygbag-port/.
 * The source dirs mirror the archive layout: assets/ is the root.
 */

import { execSync } from "child_process";
import { createHash } from "crypto";
import {
  existsSync,
  mkdirSync,
  cpSync,
  rmSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "scripts/pygbag-port");
const DEST = resolve(ROOT, "public/play");
const TMP_ROOT = resolve(ROOT, ".tmp-archive-build");

const KNOWN_GAMES = {
  "cannonball-clash": { id: "cannonball-clash", srcDir: "cannonball-clash" },
  "treasure-cove": { id: "treasure-cove", srcDir: "treasure-cove" },
  "krakens-wake": { id: "krakens-wake", srcDir: "krakens-wake" },
  pong: { id: "cannonball-clash", srcDir: "cannonball-clash" },
  breakout: { id: "treasure-cove", srcDir: "treasure-cove" },
  asteroids: { id: "krakens-wake", srcDir: "krakens-wake" },
};

const GAMES = [
  { id: "cannonball-clash", srcDir: "cannonball-clash" },
  { id: "treasure-cove", srcDir: "treasure-cove" },
  { id: "krakens-wake", srcDir: "krakens-wake" },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const gameFlag = args.find((a) => a.startsWith("--game="));
  if (gameFlag) {
    const alias = gameFlag.split("=")[1];
    const game = KNOWN_GAMES[alias];
    if (!game) {
      console.error(
        `Unknown game: "${alias}". Valid: ${Object.keys(KNOWN_GAMES).join(", ")}`,
      );
      process.exit(1);
    }
    return [game];
  }
  return GAMES;
}

function computeHash(filePath) {
  const data = readFileSync(filePath);
  return createHash("md5").update(data).digest("hex");
}

function buildGame(game) {
  const src = resolve(SRC, game.srcDir);
  const destDir = resolve(DEST, game.id);
  if (!existsSync(src)) {
    console.error(`Source directory not found: ${src}`);
    process.exit(1);
  }

  const tmp = resolve(TMP_ROOT, game.id);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const assetsDir = resolve(tmp, "assets");
  mkdirSync(assetsDir, { recursive: true });

  try {
    // Copy shared module into assets/
    const sharedDir = resolve(SRC, "shared");
    if (existsSync(sharedDir)) {
      const sharedDest = resolve(assetsDir, "shared");
      rmSync(sharedDest, { recursive: true, force: true });
      cpSync(sharedDir, sharedDest, { recursive: true });
    }

    // Copy all entries from src into assets/ excluding known non-asset items
    const entries = readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "build" || entry.name === "__pycache__") continue;
      const s = resolve(src, entry.name);
      const d = resolve(assetsDir, entry.name);
      if (entry.isDirectory()) {
        cpSync(s, d, { recursive: true });
      } else {
        cpSync(s, d);
      }
    }

    // Strip all __pycache__ directories (nested below top-level)
    const stripPycache = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = resolve(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === "__pycache__") {
            rmSync(p, { recursive: true, force: true });
          } else {
            stripPycache(p);
          }
        }
      }
    };
    stripPycache(assetsDir);

    // Create tarball with assets/ at root
    const outFile = resolve(destDir, `${game.id}.tar.gz`);
    execSync(`tar -czf "${outFile}" -C "${tmp}" assets`, {
      stdio: "inherit",
      cwd: ROOT,
    });

    // Report hash and size
    const hash = computeHash(outFile);
    const stat = execSync(`ls -lh "${outFile}"`, { encoding: "utf8" }).trim();
    const sizeMatch = stat.match(/([\d.]+[KMG]?)\s/);
    const sizeStr = sizeMatch ? sizeMatch[1] : "?";
    console.log(`Repacked ${game.id}: ${sizeStr}  md5=${hash}`);
  } finally {
    // Clean up temp for this game
    rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  const games = parseArgs();
  for (const game of games) {
    buildGame(game);
  }
  console.log("All game archives repacked.");
}

main();
