#!/usr/bin/env node
/**
 * Generate Pygbag game shell HTML files from game config + shared template.
 *
 * Dry-run by default. Use --apply to write files.
 * Usage: node scripts/generate-pygbag-shells.mjs [--apply]
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

for (const config of PYBAG_GAMES) {
  const indexPath = resolve(root, "public/play", config.id, "index.html");

  if (!apply) {
    console.log(
      `[dry-run] ${config.id} -> public/play/${config.id}/index.html`,
    );
    generated++;
    continue;
  }

  const html = render(config);
  writeFileSync(indexPath, html, "utf-8");
  console.log(`[apply]   ${config.id} -> public/play/${config.id}/index.html`);
  generated++;
}

if (!apply) {
  console.log(`\nDry run: ${generated} file(s) would be generated.`);
  console.log("Use --apply to write files.");
} else {
  console.log(`\nApplied: ${generated} file(s) written.`);
}
