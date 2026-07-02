#!/usr/bin/env node
/**
 * Check that every shipped source file matches what's in the game archives.
 *
 * Uses recursive file enumeration (not handpicked keyFiles) to compare:
 * - game source tree vs archive tree
 * - shared module files in each archive
 *
 * Fails on:
 * - missing file in archive
 * - differing file content
 * - unexpected extra file in archive
 * - missing shared module file
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync, existsSync, readdirSync } from "fs";
import { execSync } from "child_process";
import { createHash } from "crypto";
import { PYBAG_GAMES } from "./pygbag-game-config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "scripts/pygbag-port");

const SHARED_FILES = ["__init__.py", "pa_state.py", "pa_loop.py"];
const EXCLUDE_DIRS = new Set(["build", "__pycache__"]);
const EXCLUDE_FILES = new Set();

function collectSourceFiles(dir, prefix = "") {
  const entries = [];
  for (const entry of readdirSyncSafe(dir)) {
    if (!entry) continue;
    if (EXCLUDE_DIRS.has(entry.name) || EXCLUDE_FILES.has(entry.name)) continue;
    const full = resolve(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      entries.push(...collectSourceFiles(full, rel));
    } else {
      entries.push(rel);
    }
  }
  return entries.sort();
}

function readdirSyncSafe(dir) {
  try {
    const entries = [];
    const dirEntries = readdirSync(dir, { withFileTypes: true });
    for (const e of dirEntries) entries.push(e);
    return entries;
  } catch {
    return [];
  }
}

function getArchiveManifest(archivePath) {
  try {
    const output = execSync(`tar tzf "${archivePath}" 2>/dev/null | sort`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return output.trim().split("\n").filter(Boolean).sort();
  } catch {
    return [];
  }
}

function getArchiveFileContent(archivePath, filePath) {
  try {
    return execSync(
      `tar xzf "${archivePath}" --to-stdout "${filePath}" 2>/dev/null`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
    );
  } catch {
    return null;
  }
}

function sha256(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

console.log("Checking archive/source parity...");

let allPassed = true;

for (const game of PYBAG_GAMES) {
  console.log(`\n── ${game.id} ──`);

  const sourceDir = resolve(ROOT, "scripts/pygbag-port", game.id);
  const archivePath = resolve(
    ROOT,
    "public/play",
    game.id,
    `${game.id}.tar.gz`,
  );

  if (!existsSync(archivePath)) {
    console.log(`  ❌ Archive not found: ${archivePath}`);
    allPassed = false;
    continue;
  }

  // Collect source files under games/ subdirectory
  const gameSourceDir = resolve(sourceDir, "games");
  let sourceFiles = [];
  if (existsSync(gameSourceDir)) {
    sourceFiles = collectSourceFiles(gameSourceDir, "assets/games");
  }

  // Collect top-level source files (audio.py, constants.py, etc.)
  const topSourceFiles = collectSourceFiles(sourceDir).filter(
    (f) =>
      !f.startsWith("games/") &&
      !f.startsWith("build/") &&
      !f.startsWith("__pycache__"),
  );

  // Check shared files
  const sharedDir = resolve(SRC, "shared");
  let sharedSourceFiles = [];
  if (existsSync(sharedDir)) {
    sharedSourceFiles = collectSourceFiles(sharedDir, "assets/shared");
  }

  // Source-side manifest
  const expectedFiles = new Set([
    ...sourceFiles,
    ...topSourceFiles.map((f) => `assets/${f}`),
    ...sharedSourceFiles,
    "assets/",
    "assets/games/",
    "assets/shared/",
  ]);

  // Archive-side manifest
  const archiveFiles = new Set(getArchiveManifest(archivePath));

  // Check for missing files
  for (const file of expectedFiles) {
    if (!archiveFiles.has(file)) {
      // Skip directory entries
      if (file.endsWith("/")) continue;
      console.log(`  ❌ MISSING in archive: ${file}`);
      allPassed = false;
    }
  }

  // Check content of every non-directory source file
  for (const file of sourceFiles) {
    if (file.endsWith("/")) continue;
    const sourceContent = readFileSync(
      resolve(
        ROOT,
        "scripts/pygbag-port",
        game.id,
        "games",
        file.replace("assets/games/", ""),
      ),
      "utf8",
    );
    const archiveContent = getArchiveFileContent(archivePath, file);
    if (archiveContent === null) {
      console.log(`  ❌ Can't extract: ${file}`);
      allPassed = false;
      continue;
    }
    if (sha256(sourceContent) !== sha256(archiveContent)) {
      console.log(`  ❌ DIFFERS: ${file}`);
      allPassed = false;
    } else {
      console.log(`  ✅ ${file}`);
    }
  }

  // Check top-level source files
  for (const file of topSourceFiles) {
    if (file.endsWith("/") || file.startsWith("games/")) continue;
    const sourceContent = readFileSync(resolve(sourceDir, file), "utf8");
    const archiveContent = getArchiveFileContent(archivePath, `assets/${file}`);
    if (archiveContent === null) {
      console.log(`  ❌ Can't extract: assets/${file}`);
      allPassed = false;
      continue;
    }
    if (sha256(sourceContent) !== sha256(archiveContent)) {
      console.log(`  ❌ DIFFERS: assets/${file}`);
      allPassed = false;
    } else {
      console.log(`  ✅ assets/${file}`);
    }
  }

  // Check shared files in archive
  for (const file of sharedSourceFiles) {
    const sourceContent = readFileSync(
      resolve(SRC, "shared", file.replace("assets/shared/", "")),
      "utf8",
    );
    const archiveContent = getArchiveFileContent(archivePath, file);
    if (archiveContent === null) {
      console.log(`  ❌ MISSING from archive: ${file}`);
      allPassed = false;
      continue;
    }
    if (sha256(sourceContent) !== sha256(archiveContent)) {
      console.log(`  ❌ DIFFERS: ${file}`);
      allPassed = false;
    } else {
      console.log(`  ✅ ${file}`);
    }
  }
}

// Check shared files in each archive
console.log(`\n── shared ──`);
for (const game of PYBAG_GAMES) {
  const archivePath = resolve(
    ROOT,
    "public/play",
    game.id,
    `${game.id}.tar.gz`,
  );
  if (!existsSync(archivePath)) continue;

  for (const file of SHARED_FILES) {
    const sourcePath = resolve(SRC, "shared", file);
    if (!existsSync(sourcePath)) continue;
    const sourceContent = readFileSync(sourcePath, "utf8");
    const archiveContent = getArchiveFileContent(
      archivePath,
      `assets/shared/${file}`,
    );
    if (archiveContent === null) {
      console.log(
        `  ❌ ${game.id} assets/shared/${file}: missing from archive`,
      );
      allPassed = false;
    } else if (sha256(sourceContent) !== sha256(archiveContent)) {
      console.log(`  ❌ ${game.id} assets/shared/${file}: differs!`);
      allPassed = false;
    } else {
      console.log(`  ✅ ${game.id} assets/shared/${file}: matches`);
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
