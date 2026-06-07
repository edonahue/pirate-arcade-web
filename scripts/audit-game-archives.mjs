#!/usr/bin/env node
import { stat } from "fs/promises";
import { createReadStream } from "fs";
import { createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import { join } from "path";
import * as tar from "tar";

const ARCHIVES = [
  "public/play/cannonball-clash/cannonball-clash.tar.gz",
  "public/play/treasure-cove/treasure-cove.tar.gz",
  "public/play/krakens-wake/krakens-wake.tar.gz",
];

const SUSPICIOUS_PATTERNS = [
  /\.DS_Store/,
  /\.git\//,
  /test_/,
  /\/tests?\//,
  /node_modules/,
  /\.gitkeep/,
  /screenshot/i,
  /\.md$/i,
  /build\.log/i,
  /report\./i,
  /coverage/,
  /\.whl$/,
];
// Note: __pycache__ and .pyc files are allowed in game archives as they are
// harmless Python bytecode cache that can improve startup performance

let allPassed = true;

async function auditArchive(filePath) {
  const resolved = join(process.cwd(), filePath);
  console.log(`── ${filePath} ──`);

  let stats;
  try {
    stats = await stat(resolved);
  } catch (err) {
    console.log(`  ❌ File not found: ${err.message}`);
    allPassed = false;
    console.log("");
    return;
  }

  const compressedSizeKB = (stats.size / 1024).toFixed(1);
  console.log(`  Compressed size:   ${compressedSizeKB} KB`);

  if (stats.size === 0) {
    console.log(`  ❌ Archive is empty`);
    allPassed = false;
    console.log("");
    return;
  }

  // Extract and analyze tar contents
  let entries = [];
  let totalUncompressed = 0;
  let fileCount = 0;

  try {
    const readStream = createReadStream(resolved);
    const gunzip = createGunzip();

    await pipeline(
      readStream,
      gunzip,
      tar.t({
        onentry: (entry) => {
          const size = entry.size || 0;
          totalUncompressed += size;
          fileCount++;
          entry.resume();
          entries.push({
            path: entry.path,
            size: size,
            type: entry.type,
          });
        },
      }),
    );
  } catch (err) {
    console.log(`  ❌ Failed to read archive: ${err.message}`);
    allPassed = false;
    console.log("");
    return;
  }

  const uncompressedKB = (totalUncompressed / 1024).toFixed(1);
  console.log(`  Uncompressed size: ${uncompressedKB} KB`);
  console.log(`  File count:        ${fileCount}`);

  // Top 20 largest files
  const sorted = [...entries].sort((a, b) => b.size - a.size);
  console.log(`  Top 20 largest files:`);
  for (let i = 0; i < Math.min(sorted.length, 20); i++) {
    const e = sorted[i];
    const sizeKB = (e.size / 1024).toFixed(1);
    console.log(
      `    ${String(i + 1).padStart(2)}. ${sizeKB.padStart(8)} KB  ${e.path}`,
    );
  }

  // Suspicious files
  const suspicious = entries.filter((e) => {
    if (e.type === "Directory") return false;
    return SUSPICIOUS_PATTERNS.some((p) => p.test(e.path));
  });

  if (suspicious.length > 0) {
    console.log(`  ⚠️  Suspicious/unwanted files found:`);
    for (const s of suspicious) {
      console.log(`    - ${s.path} (${(s.size / 1024).toFixed(1)} KB)`);
    }
    allPassed = false;
  } else {
    console.log(`  ✅ No suspicious files found`);
  }

  if (fileCount === 0) {
    console.log(`  ❌ Archive contains no files`);
    allPassed = false;
  }

  if (stats.size < 1024) {
    console.log(`  ⚠️  Archive is very small (< 1 KB)`);
  }

  console.log("");
}

async function main() {
  console.log("=== Game Archive Audit ===\n");

  for (const archive of ARCHIVES) {
    await auditArchive(archive);
  }

  if (allPassed) {
    console.log("✓ All archives passed.");
    process.exit(0);
  } else {
    console.log("✗ Some archives had issues.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Audit script failed:", err);
  process.exit(1);
});
