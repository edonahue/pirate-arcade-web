/**
 * Generate dist/build-info.json during npm run build.
 * Uses Cloudflare Pages env vars when present, with deterministic fallbacks.
 * No git dependency, no timestamps, no secrets.
 * Output is deterministic for the same environment.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve();
const outputPath = path.join(root, "dist", "build-info.json");

const commit =
  process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || "local";

const branch =
  process.env.CF_PAGES_BRANCH || process.env.GITHUB_REF_NAME || "local";

const data = {
  schemaVersion: 1,
  commit,
  branch,
};

// Use writeFile with callback for ESM compatibility
fs.writeFile(outputPath, JSON.stringify(data, null, 2) + "\n", (err) => {
  if (err) {
    console.error(`❌ Failed to write ${outputPath}:`, err);
    process.exit(1);
  }
  console.log(`🛠  Generated ${outputPath}`);
  console.log(`   commit=${commit} branch=${branch}`);
});
