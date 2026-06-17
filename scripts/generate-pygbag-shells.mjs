#!/usr/bin/env node
/**
 * Generate Pygbag game shell HTML files from game config + shared template.
 *
 * Dry-run by default. Use --apply to write files.
 * Usage: node scripts/generate-pygbag-shells.mjs [--apply]
 *
 * Features:
 * - Dry-run with diff summary
 * - Unchanged-file detection (skips write when content matches)
 * - Warning header in generated output
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import PYBAG_GAMES from "./pygbag-game-config.mjs";
import { render } from "./pygbag-shell-template.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const apply = process.argv.includes("--apply");

let generated = 0;
let skipped = 0;
let changed = 0;

function computeDiff(oldStr, newStr) {
  if (oldStr === newStr) return "";
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const maxLines = Math.max(oldLines.length, newLines.length);
  let diff = "";
  for (let i = 0; i < maxLines; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o !== n) {
      if (o !== undefined) diff += `- ${o}\n`;
      if (n !== undefined) diff += `+ ${n}\n`;
    }
  }
  return diff || "(no visible diff)";
}

for (const config of PYBAG_GAMES) {
  const indexPath = resolve(root, "public/play", config.id, "index.html");
  const html = render(config);

  if (!apply) {
    const committed = existsSync(indexPath)
      ? readFileSync(indexPath, "utf-8")
      : "";
    const isSame = committed === html;
    if (isSame) {
      console.log(`[dry-run] ${config.id}: UNCHANGED (matches committed file)`);
      skipped++;
    } else {
      const diff = computeDiff(committed, html);
      console.log(`[dry-run] ${config.id}: WOULD UPDATE`);
      if (diff) {
        console.log("  Diff:");
        diff.split("\n").forEach((line) => console.log(`    ${line}`));
      }
      generated++;
    }
    continue;
  }

  const committed = existsSync(indexPath)
    ? readFileSync(indexPath, "utf-8")
    : "";
  if (committed === html) {
    console.log(`[apply]   ${config.id}: UNCHANGED (skipped)`);
    skipped++;
    continue;
  }

  writeFileSync(indexPath, html, "utf-8");
  console.log(`[apply]   ${config.id}: UPDATED`);
  changed++;
}

if (!apply) {
  console.log(`\nDry run: ${generated} would update, ${skipped} unchanged.`);
  console.log("Use --apply to write files.");
} else {
  console.log(`\nApplied: ${changed} updated, ${skipped} skipped (unchanged).`);
}
