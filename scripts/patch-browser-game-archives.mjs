/**
 * Patch and repack browser game archives from the source directory
 * (scripts/pygbag-port/) into public/play/.
 *
 * Deterministic: same source always produces identical bytes
 * (sorted entries, fixed mtime, normalized gzip).
 *
 * Usage:
 *   node scripts/patch-browser-game-archives.mjs                    # all
 *   node scripts/patch-browser-game-archives.mjs --game=cannonball-clash
 *   node scripts/patch-browser-game-archives.mjs --game=treasure-cove
 *   node scripts/patch-browser-game-archives.mjs --game=krakens-wake
 *   node scripts/patch-browser-game-archives.mjs --game=breakout
 *   node scripts/patch-browser-game-archives.mjs --game=pong
 *   node scripts/patch-browser-game-archives.mjs --game=asteroids
 */

import { createHash } from "crypto";
import {
  existsSync,
  mkdirSync,
  cpSync,
  rmSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  createWriteStream,
} from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { create as tarCreate } from "tar";
import { PYBAG_GAMES } from "./pygbag-game-config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "scripts/pygbag-port");
const DEST = resolve(ROOT, "public/play");
const TMP_ROOT = resolve(ROOT, ".tmp-archive-build");

const ALIASES = {
  "cannonball-clash": "cannonball-clash",
  "treasure-cove": "treasure-cove",
  "krakens-wake": "krakens-wake",
  pong: "cannonball-clash",
  breakout: "treasure-cove",
  asteroids: "krakens-wake",
};

function parseArgs() {
  const args = process.argv.slice(2);
  const gameFlag = args.find((a) => a.startsWith("--game="));
  if (gameFlag) {
    const alias = gameFlag.split("=")[1];
    const canonical = ALIASES[alias];
    if (!canonical) {
      console.error(
        `Unknown game: "${alias}". Valid: ${Object.keys(ALIASES).join(", ")}`,
      );
      process.exit(1);
    }
    const game = PYBAG_GAMES.find((g) => g.id === canonical);
    if (!game) {
      console.error(`No config for game: "${canonical}"`);
      process.exit(1);
    }
    return [game];
  }
  return PYBAG_GAMES;
}

function computeSha256(filePath) {
  const data = readFileSync(filePath);
  return createHash("sha256").update(data).digest("hex");
}

function collectFiles(dir, prefix = "") {
  const entries = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__pycache__" || entry.name === "build") continue;
    const full = resolve(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      entries.push(...collectFiles(full, rel));
    } else {
      entries.push(rel);
    }
  }
  return entries.sort();
}

async function buildGame(game) {
  const src = resolve(SRC, game.id);
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

  const sharedDir = resolve(SRC, "shared");
  if (existsSync(sharedDir)) {
    const sharedDest = resolve(assetsDir, "shared");
    rmSync(sharedDest, { recursive: true, force: true });
    cpSync(sharedDir, sharedDest, { recursive: true });
  }

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

  const allFiles = collectFiles(tmp);
  const outFile = resolve(destDir, `${game.id}.tar.gz`);

  // Create deterministic tarball using node-tar with file output
  await tarCreate(
    {
      gzip: true,
      portable: true,
      cwd: tmp,
      file: outFile,
      mtime: new Date(0),
    },
    allFiles,
  );

  const hash = computeSha256(outFile);
  const size = statSync(outFile).size;

  // Check if this actually changed
  const existingHashFile = resolve(destDir, `${game.id}.tar.gz.sha256`);
  let changed = true;
  if (existsSync(existingHashFile)) {
    const oldHash = readFileSync(existingHashFile, "utf8").trim();
    changed = oldHash !== hash;
  }

  // Write hash manifest
  writeFileSync(existingHashFile, hash, "utf8");

  const sizeStr = (size / 1024).toFixed(1);
  console.log(
    `Repacked ${game.id}: ${sizeStr} KB  sha256=${hash}${changed ? "" : " (unchanged)"}`,
  );

  rmSync(tmp, { recursive: true, force: true });
  return { id: game.id, sha256: hash };
}

async function main() {
  const games = parseArgs();
  const results = [];
  for (const game of games) {
    results.push(await buildGame(game));
  }
  console.log("All game archives repacked.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
