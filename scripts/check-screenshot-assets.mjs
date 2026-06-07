#!/usr/bin/env node
/**
 * Validate the 3 production browser-game screenshots in public/images/.
 *
 * For each of cannonball-clash, treasure-cove, krakens-wake, this script:
 *   1. Confirms the file exists and is between 5 KB and 2 MB.
 *   2. Verifies the PNG signature (8-byte magic).
 *   3. Parses the IHDR chunk (no external deps — small inline parser).
 *   4. Asserts width >= 1280, height >= 720, aspect ratio within 2% of 16:9,
 *      bit depth 8, color type 2 (RGB) or 6 (RGBA).
 *   5. Hashes the file bytes (SHA-256, first 16 hex chars) and asserts that
 *      all 3 are distinct (no accidental copy-paste).
 *
 * Exits 0 on success, 1 on any failure.
 *
 * Usage: node scripts/check-screenshot-assets.mjs
 *    or: npm run test:screenshot-assets
 */

import { readFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const GAMES = [
  { id: "cannonball-clash" },
  { id: "treasure-cove" },
  { id: "krakens-wake" },
];

const MIN_W = 1280;
const MIN_H = 720;
const TARGET_RATIO = 16 / 9;
const RATIO_TOL = 0.02;
const MIN_BYTES = 5 * 1024;
const MAX_BYTES = 2 * 1024 * 1024;

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function parsePngIhdr(buf) {
  if (buf.length < 33) throw new Error("file too short to be a PNG");
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== PNG_SIG[i]) throw new Error("not a PNG (bad signature)");
  }
  const type = buf.slice(12, 16).toString("ascii");
  if (type !== "IHDR") {
    throw new Error(`expected IHDR as first chunk, got "${type}"`);
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf.readUInt8(24);
  const colorType = buf.readUInt8(25);
  return { width, height, bitDepth, colorType };
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const errors = [];
const hashes = new Map();

for (const { id } of GAMES) {
  const rel = `public/images/screenshot-${id}.png`;
  const abs = resolve(REPO_ROOT, rel);
  process.stdout.write(`  ${id}: `);
  try {
    const s = await stat(abs);
    if (s.size < MIN_BYTES) {
      throw new Error(
        `file too small (${formatBytes(s.size)}, min ${formatBytes(MIN_BYTES)})`,
      );
    }
    if (s.size > MAX_BYTES) {
      throw new Error(
        `file too large (${formatBytes(s.size)}, max ${formatBytes(MAX_BYTES)})`,
      );
    }
    const buf = await readFile(abs);
    const { width, height, bitDepth, colorType } = parsePngIhdr(buf);
    if (width < MIN_W) throw new Error(`width ${width} < ${MIN_W}`);
    if (height < MIN_H) throw new Error(`height ${height} < ${MIN_H}`);
    const ratio = width / height;
    const ratioErr = Math.abs(ratio - TARGET_RATIO) / TARGET_RATIO;
    if (ratioErr > RATIO_TOL) {
      throw new Error(
        `aspect ratio ${ratio.toFixed(4)} not within ${(RATIO_TOL * 100).toFixed(0)}% of 16:9`,
      );
    }
    if (bitDepth !== 8) throw new Error(`bit depth ${bitDepth} != 8`);
    if (colorType !== 2 && colorType !== 6) {
      throw new Error(`color type ${colorType} != 2 (RGB) or 6 (RGBA)`);
    }
    const h = createHash("sha256").update(buf).digest("hex").slice(0, 16);
    if (hashes.has(h)) {
      throw new Error(`byte-identical to ${hashes.get(h)} (likely copy-paste)`);
    }
    hashes.set(h, id);
    const color = colorType === 6 ? "RGBA" : "RGB";
    console.log(
      `OK ${width}x${height} ${color} ${formatBytes(s.size)} sha:${h}`,
    );
  } catch (err) {
    console.log(`FAIL ${err.message}`);
    errors.push(`${id}: ${err.message}`);
  }
}

if (errors.length) {
  console.error(`\n\u2717 ${errors.length} screenshot asset check(s) failed:`);
  for (const e of errors) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`\n\u2713 All 3 screenshot assets valid.`);
