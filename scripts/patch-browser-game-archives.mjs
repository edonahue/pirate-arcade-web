/**
 * Patch and repack browser game archives from the source directory
 * (scripts/pygbag-port/) into public/play/.
 *
 * Usage:
 *   node scripts/patch-browser-game-archives.mjs
 *
 * Run this after modifying any Python source under scripts/pygbag-port/.
 * The source dirs mirror the archive layout: assets/ is the root.
 */

import { execSync } from "child_process";
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

const GAMES = [
  { id: "cannonball-clash", srcDir: "cannonball-clash" },
  { id: "treasure-cove", srcDir: "treasure-cove" },
  { id: "krakens-wake", srcDir: "krakens-wake" },
];

for (const game of GAMES) {
  const src = resolve(SRC, game.srcDir);
  const destDir = resolve(DEST, game.id);
  if (!existsSync(src)) {
    console.error(`Source directory not found: ${src}`);
    process.exit(1);
  }

  // Source files are at root level in src/ (no assets/ wrapper).
  // We need to wrap them in assets/ in the archive to match
  // what the inline boot script expects (it extracts to /tmp/game_extract/).
  // Create temp working directory with assets/ wrapper
  const tmp = resolve(ROOT, ".tmp-archive-build", game.id);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const assetsDir = resolve(tmp, "assets");
  mkdirSync(assetsDir, { recursive: true });

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

  // Create tarball with assets/ at root
  const outFile = resolve(destDir, `${game.id}.tar.gz`);
  execSync(`tar -czf "${outFile}" -C "${tmp}" assets`, {
    stdio: "inherit",
    cwd: ROOT,
  });

  // Clean up temp
  rmSync(resolve(ROOT, ".tmp-archive-build"), { recursive: true, force: true });

  const stats = execSync(`ls -lh "${outFile}"`, { encoding: "utf8" }).trim();
  console.log(`Repacked ${game.id}: ${stats}`);
}

console.log("All game archives repacked.");
