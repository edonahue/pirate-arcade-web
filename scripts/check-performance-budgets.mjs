#!/usr/bin/env node
/**
 * Performance budget checks — static file-size budgets.
 * All sizes are GZIPPED (using zlib.gzipSync) to reflect real-world
 * transfer sizes over the wire with compression enabled.
 *
 * Usage:
 *   node scripts/check-performance-budgets.mjs          # human-readable output
 *   node scripts/check-performance-budgets.mjs --json-output  # JSON to stdout
 */

import { readFileSync, statSync, readdirSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const root = dirname(__dirname);

export const BUDGETS = {
  "public/images/art": { maxTotalKB: 1500, maxSingleKB: 600 },
  "public/images": { maxTotalKB: 3000, maxSingleKB: 2000, exclude: ["art"] },
  "public/play": { maxTotalKB: 200, maxSingleKB: 100 },
  dist: { maxHtmlKB: 100 },
  "dist/assets": { maxJsKB: 500, maxCssKB: 50 },
};

/**
 * @param {string} filePath
 * @returns {number} size in KB (gzipped)
 */
export function getGzippedSizeKB(filePath) {
  try {
    const content = readFileSync(filePath);
    const gzipped = gzipSync(content);
    return gzipped.length / 1024;
  } catch {
    return statSync(filePath).size / 1024;
  }
}

/**
 * Recursively check a directory against a budget.
 * Accumulates subdirectory totals into parent totals.
 *
 * @param {string} dirPath
 * @param {Record<string, number|string[]>} budget
 * @returns {{ totalKB: number, maxSingleKB: number, errors: string[] }}
 */
export function checkDirectory(dirPath, budget) {
  let totalKB = 0;
  let maxSingleKB = 0;
  const errors = [];
  const exclude = budget.exclude || [];

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (exclude.includes(entry.name)) continue;
        const sub = checkDirectory(fullPath, budget);
        totalKB += sub.totalKB;
        if (sub.maxSingleKB > maxSingleKB) maxSingleKB = sub.maxSingleKB;
        errors.push(...sub.errors);
        continue;
      }

      const ext = extname(entry.name).toLowerCase();
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

      if (budget.maxSingleKB && sizeKB > budget.maxSingleKB) {
        errors.push(
          `${fullPath}: ${sizeKB.toFixed(1)}KB ${isTextAsset ? "(gzipped)" : "(raw)"} exceeds single file limit of ${budget.maxSingleKB}KB`,
        );
      }

      if (ext === ".html" && budget.maxHtmlKB && sizeKB > budget.maxHtmlKB) {
        errors.push(
          `${fullPath}: ${sizeKB.toFixed(1)}KB (gzipped) exceeds HTML limit of ${budget.maxHtmlKB}KB`,
        );
      }

      if (ext === ".js" && budget.maxJsKB && sizeKB > budget.maxJsKB) {
        errors.push(
          `${fullPath}: ${sizeKB.toFixed(1)}KB (gzipped) exceeds JS limit of ${budget.maxJsKB}KB`,
        );
      }

      if (ext === ".css" && budget.maxCssKB && sizeKB > budget.maxCssKB) {
        errors.push(
          `${fullPath}: ${sizeKB.toFixed(1)}KB (gzipped) exceeds CSS limit of ${budget.maxCssKB}KB`,
        );
      }
    }

    if (budget.maxTotalKB && totalKB > budget.maxTotalKB) {
      errors.push(
        `${dirPath}: total ${totalKB.toFixed(1)}KB exceeds limit of ${budget.maxTotalKB}KB`,
      );
    }
  } catch {
    // Directory might not exist — OK
  }

  return { totalKB, maxSingleKB, errors };
}

/**
 * @param {Record<string, Record<string, number|string[]>>} [budgets]
 * @param {string} [rootDir]
 * @returns {{ passed: boolean, results: Array<{ dir: string, totalKB: number, maxSingleKB: number, passed: boolean, errors: string[] }>, timestamp: string }}
 */
export function runBudgets(budgets, rootDir) {
  const dirBudgets = budgets || BUDGETS;
  const base = rootDir || root;
  const results = [];
  let overallPassed = true;

  for (const [dir, budget] of Object.entries(dirBudgets)) {
    const fullPath = join(base, dir);
    const { totalKB, maxSingleKB, errors } = checkDirectory(fullPath, budget);
    const passed = errors.length === 0;
    if (!passed) overallPassed = false;
    results.push({ dir, totalKB, maxSingleKB, passed, errors });
  }

  return {
    passed: overallPassed,
    results,
    timestamp: new Date().toISOString(),
  };
}

/**
 * @param {{ passed: boolean, results: Array<{ dir: string, totalKB: number, maxSingleKB: number, passed: boolean, errors: string[] }> }} results
 * @returns {string}
 */
export function formatResults(results) {
  const lines = [];
  lines.push("\u{1F4CF} Performance Budget Results\n");
  for (const r of results.results) {
    const status = r.passed ? "\u2705" : "\u274C";
    lines.push(
      `${status} ${r.dir}: ${r.totalKB.toFixed(1)}KB total, ${r.maxSingleKB.toFixed(1)}KB max single`,
    );
    for (const e of r.errors) {
      lines.push(`  \u274C ${e}`);
    }
  }
  lines.push("");
  lines.push(
    results.passed
      ? "\u2705 All performance budget checks passed!"
      : "\u274C Some performance budget checks failed!",
  );
  return lines.join("\n");
}

// ── CLI entry ────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json-output");

  const results = runBudgets();

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
  } else {
    process.stdout.write(formatResults(results) + "\n");
  }

  process.exit(results.passed ? 0 : 1);
}

if (process.argv[1] && process.argv[1] === __filename) {
  main();
}
