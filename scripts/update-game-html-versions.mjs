#!/usr/bin/env node
/**
 * Update game HTML version queries from single source of truth.
 *
 * Deprecated in favor of:
 *   npm run apply:game-versions  (scripts/apply-game-asset-versions.mjs)
 *
 * This script now delegates to the combined apply script.
 */

import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log("⚠️  update-game-html-versions.mjs is deprecated.");
console.log("   Use: npm run apply:game-versions");
console.log("");

try {
  execSync(`node "${__dirname}/apply-game-asset-versions.mjs"`, {
    stdio: "inherit",
  });
} catch {
  process.exit(1);
}
