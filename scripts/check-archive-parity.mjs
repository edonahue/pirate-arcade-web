#!/usr/bin/env node
/**
 * Check that every shipped source file matches what's in the game archives.
 *
 * Binary-safe, bidirectional: verifies source→archive (every source file
 * must be in archive with matching content) AND archive→source (no
 * unexpected extra files).
 *
 * Uses spawnSync for extraction (read-only tool, not a build step).
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
import { createHash } from "crypto";
import { spawnSync } from "child_process";
import { PYBAG_GAMES } from "./pygbag-game-config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "scripts/pygbag-port");

const EXCLUDE_DIRS = new Set(["build", "__pycache__"]);

function collectSourceFiles(dir, prefix = "") {
  const entries = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      const full = resolve(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        entries.push(...collectSourceFiles(full, rel));
      } else {
        entries.push(rel);
      }
    }
  } catch {
    /* directory doesn't exist */
  }
  return entries.sort();
}

function listArchive(archivePath) {
  const result = spawnSync("tar", ["tzf", archivePath], {
    timeout: 15000,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) return [];
  return result.stdout.toString().trim().split("\n").filter(Boolean).sort();
}

function readArchiveFile(archivePath, filePath) {
  const result = spawnSync(
    "tar",
    ["xzf", archivePath, "--to-stdout", filePath],
    {
      timeout: 15000,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  if (result.status !== 0) return null;
  return result.stdout;
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function checkMatch(archivePath, fileInArchive, sourcePath) {
  const sourceContent = readFileSync(sourcePath);
  const archiveContent = readArchiveFile(archivePath, fileInArchive);
  if (archiveContent === null) {
    return { ok: false, msg: `\u274c MISSING from archive: ${fileInArchive}` };
  }
  if (sha256(sourceContent) !== sha256(archiveContent)) {
    return { ok: false, msg: `\u274c DIFFERS: ${fileInArchive}` };
  }
  return { ok: true, msg: `  \u2705 ${fileInArchive}` };
}

let allPassed = true;

for (const game of PYBAG_GAMES) {
  console.log(`\n\u2500\u2500 ${game.id} \u2500\u2500`);

  const sourceDir = resolve(SRC, game.id);
  const archivePath = resolve(
    ROOT,
    "public/play",
    game.id,
    `${game.id}.tar.gz`,
  );

  if (!existsSync(archivePath)) {
    console.log(`  \u274c Archive not found: ${archivePath}`);
    allPassed = false;
    continue;
  }

  // Collect source-side manifest
  const gameSourceDir = resolve(sourceDir, "games");
  const sourceFiles = existsSync(gameSourceDir)
    ? collectSourceFiles(gameSourceDir, "assets/games")
    : [];

  const topFiles = collectSourceFiles(sourceDir).filter(
    (f) =>
      !f.startsWith("games/") &&
      !f.startsWith("build/") &&
      !f.startsWith("__pycache__"),
  );

  const sharedDir = resolve(SRC, "shared");
  const sharedFiles = existsSync(sharedDir)
    ? collectSourceFiles(sharedDir, "assets/shared")
    : [];

  const expectedSet = new Set([
    ...sourceFiles,
    ...topFiles.map((f) => `assets/${f}`),
    ...sharedFiles,
    "assets/",
    "assets/games/",
    "assets/shared/",
  ]);

  // Archive-side manifest
  const archiveEntries = listArchive(archivePath);
  const archiveSet = new Set(archiveEntries);

  // Source → archive: check every expected file exists in archive
  for (const file of expectedSet) {
    if (file.endsWith("/")) continue;
    if (!archiveSet.has(file)) {
      console.log(`  \u274c MISSING in archive: ${file}`);
      allPassed = false;
    }
  }

  // Archive → source: no unexpected extras
  for (const file of archiveEntries) {
    if (file.endsWith("/")) continue;
    if (!expectedSet.has(file)) {
      console.log(`  \u274c EXTRA in archive: ${file}`);
      allPassed = false;
    }
  }

  // Content comparison
  for (const file of sourceFiles) {
    if (file.endsWith("/")) continue;
    const srcPath = resolve(gameSourceDir, file.replace("assets/games/", ""));
    const r = checkMatch(archivePath, file, srcPath);
    console.log(r.msg);
    if (!r.ok) allPassed = false;
  }

  for (const file of topFiles) {
    if (file.endsWith("/") || file.startsWith("games/")) continue;
    const srcPath = resolve(sourceDir, file);
    const r = checkMatch(archivePath, `assets/${file}`, srcPath);
    console.log(r.msg);
    if (!r.ok) allPassed = false;
  }

  for (const file of sharedFiles) {
    const srcPath = resolve(sharedDir, file.replace("assets/shared/", ""));
    const r = checkMatch(archivePath, file, srcPath);
    console.log(r.msg);
    if (!r.ok) allPassed = false;
  }
}

if (allPassed) {
  console.log("\n\u2705 All archive/source parity checks passed!");
  process.exit(0);
} else {
  console.log("\n\u274c Archive/source parity check failed!");
  process.exit(1);
}
