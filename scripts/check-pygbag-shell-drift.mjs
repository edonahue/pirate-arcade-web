#!/usr/bin/env node
/**
 * Drift check: verify that committed Pygbag shell files match
 * what the generator would produce.
 *
 * Usage: node scripts/check-pygbag-shell-drift.mjs
 * Exits 0 if all generated shells match committed files.
 * Exits 1 if any drift is detected.
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import PYBAG_GAMES from "./pygbag-game-config.mjs";
import { render } from "./pygbag-shell-template.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function readArchiveHash(gameId) {
  const shaPath = resolve(
    root,
    "public/play",
    gameId,
    gameId + ".tar.gz.sha256",
  );
  if (!existsSync(shaPath)) return "";
  const content = readFileSync(shaPath, "utf-8").trim();
  return content.split(/\s+/)[0] || "";
}

let failures = 0;

for (const config of PYBAG_GAMES) {
  const indexPath = resolve(root, "public/play", config.id, "index.html");

  const committed = readFileSync(indexPath, "utf-8");
  const archiveHash = readArchiveHash(config.id);
  const generated = render(config, archiveHash);

  if (committed === generated) {
    console.log(
      `  [PASS] ${config.id}: generated shell matches committed file`,
    );
  } else {
    console.error(
      `  [FAIL] ${config.id}: drift detected — regenerate with "node scripts/generate-pygbag-shells.mjs --apply"`,
    );
    failures++;
  }
}

if (failures > 0) {
  console.error(`\nFAILED: ${failures} drifted shell(s).`);
  process.exit(1);
} else {
  console.log(
    `\nPASSED: All ${PYBAG_GAMES.length} generated shells match committed files.`,
  );
}
