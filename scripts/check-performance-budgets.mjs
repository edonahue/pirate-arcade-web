#!/usr/bin/env node
/**
 * Performance budget checks.
 * Ensures asset sizes and page weights stay within reasonable limits.
 * All sizes are GZIPPED (using zlib.gzipSync) to reflect real-world
 * transfer sizes over the wire with compression enabled.
 */

import { readFileSync, statSync, readdirSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = dirname(__dirname);

const BUDGETS = {
  // Public images (raw PNGs — these are already compressed)
  "public/images/art": { maxTotalKB: 1500, maxSingleKB: 600 },
  "public/images": { maxTotalKB: 3000, maxSingleKB: 2000, exclude: ["art"] },

  // Game archives (already .tar.gz — already compressed)
  "public/play": { maxTotalKB: 200, maxSingleKB: 100 },

  // Built HTML pages (gzipped)
  dist: { maxHtmlKB: 100 },

  // JS/CSS bundles (gzipped) — Phaser adds ~350KB gzipped
  "dist/assets": { maxJsKB: 500, maxCssKB: 50 },
};

let allPassed = true;

function getGzippedSizeKB(filePath) {
  try {
    const content = readFileSync(filePath);
    const gzipped = gzipSync(content);
    return gzipped.length / 1024;
  } catch {
    // Fallback to raw size if gzip fails
    return statSync(filePath).size / 1024;
  }
}

function checkDirectory(dirPath, budget) {
  if (
    !budget.maxTotalKB &&
    !budget.maxSingleKB &&
    !budget.maxHtmlKB &&
    !budget.maxJsKB &&
    !budget.maxCssKB
  ) {
    return;
  }

  let totalKB = 0;
  let maxSingleKB = 0;

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (budget.exclude && budget.exclude.includes(entry.name)) continue;
        checkDirectory(fullPath, budget);
        continue;
      }

      const ext = extname(entry.name).toLowerCase();
      // Use gzipped size for text-based assets, raw size for already-compressed files
      const isTextAsset = [
        ".html",
        ".js",
        ".css",
        ".json",
        ".xml",
        ".txt",
        ".svg",
        ".webmanifest",
      ].includes(ext);
      const sizeKB = isTextAsset
        ? getGzippedSizeKB(fullPath)
        : statSync(fullPath).size / 1024;

      totalKB += sizeKB;
      maxSingleKB = Math.max(maxSingleKB, sizeKB);

      // Check single file limits (applies to raw size for non-text, gzipped for text)
      if (budget.maxSingleKB && sizeKB > budget.maxSingleKB) {
        console.log(
          `  ❌ ${fullPath}: ${sizeKB.toFixed(1)}KB ${isTextAsset ? "(gzipped)" : "(raw)"} exceeds single file limit of ${budget.maxSingleKB}KB`,
        );
        allPassed = false;
      }

      // Check HTML size (gzipped)
      if (ext === ".html" && budget.maxHtmlKB && sizeKB > budget.maxHtmlKB) {
        console.log(
          `  ❌ ${fullPath}: ${sizeKB.toFixed(1)}KB (gzipped) exceeds HTML limit of ${budget.maxHtmlKB}KB`,
        );
        allPassed = false;
      }

      // Check JS size (gzipped)
      if (ext === ".js" && budget.maxJsKB && sizeKB > budget.maxJsKB) {
        console.log(
          `  ❌ ${fullPath}: ${sizeKB.toFixed(1)}KB (gzipped) exceeds JS limit of ${budget.maxJsKB}KB`,
        );
        allPassed = false;
      }

      // Check CSS size (gzipped)
      if (ext === ".css" && budget.maxCssKB && sizeKB > budget.maxCssKB) {
        console.log(
          `  ❌ ${fullPath}: ${sizeKB.toFixed(1)}KB (gzipped) exceeds CSS limit of ${budget.maxCssKB}KB`,
        );
        allPassed = false;
      }
    }

    if (budget.maxTotalKB && totalKB > budget.maxTotalKB) {
      console.log(
        `  ❌ ${dirPath}: total ${totalKB.toFixed(1)}KB exceeds limit of ${budget.maxTotalKB}KB`,
      );
      allPassed = false;
    } else if (totalKB > 0) {
      console.log(
        `  ✅ ${dirPath}: ${totalKB.toFixed(1)}KB total (limit: ${budget.maxTotalKB || "N/A"}KB)`,
      );
    }
  } catch (err) {
    // Directory might not exist yet (e.g., dist before build)
    // That's OK for this check
  }
}

console.log("📏 Checking performance budgets (gzipped for text assets)...\n");

for (const [dir, budget] of Object.entries(BUDGETS)) {
  const fullPath = join(root, dir);
  console.log(`\n📂 ${dir}`);
  checkDirectory(fullPath, budget);
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

if (allPassed) {
  console.log("✅ All performance budget checks passed!");
  process.exit(0);
} else {
  console.log("❌ Some performance budget checks failed!");
  process.exit(1);
}
