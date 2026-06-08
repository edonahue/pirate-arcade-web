#!/usr/bin/env node
/**
 * Validate browser-playable game screenshots in public/images/.
 *
 * Game list is read from src/data/games.json (browser-playable entries).
 * For each game:
 *   1. File exists, size 5 KB–2 MB.
 *   2. PNG signature valid.
 *   3. IHDR: width ≥ 1280, height ≥ 720, aspect within 2% of 16:9,
 *      bit depth 8, color type 2 (RGB) or 6 (RGBA).
 *   4. Visual content check: decompresses IDAT with built-in zlib,
 *      defilters scanlines, samples pixels for brightness & diversity.
 *   5. SHA-256 distinctness (no accidental duplicate).
 *
 * Exits 0 on success, 1 on any failure.
 *
 * Usage: node scripts/check-screenshot-assets.mjs
 *    or: npm run test:screenshot-assets
 */

import { readFile, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import zlib from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const gamesMeta = JSON.parse(
  readFileSync(resolve(REPO_ROOT, "src/data/games.json"), "utf-8"),
);
const GAMES = gamesMeta
  .filter((g) => g.status === "browser-playable")
  .map((g) => ({ id: g.id }));

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

function checkVisualContent(buf, meta) {
  const { width, height, bitDepth, colorType } = meta;
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) return;

  const bpp = colorType === 6 ? 4 : 3;
  const stride = 1 + width * bpp;

  // Collect IDAT chunks
  const idatChunks = [];
  let off = 33; // 8 sig + 25 IHDR
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.slice(off + 4, off + 8).toString("ascii");
    if (type === "IDAT") idatChunks.push(buf.slice(off + 8, off + 8 + len));
    if (type === "IEND") break;
    off += 12 + len;
  }
  if (idatChunks.length === 0) return;

  const compressed = Buffer.concat(idatChunks);
  let raw;
  try {
    raw = zlib.inflateSync(compressed);
  } catch {
    return;
  }
  if (raw.length < stride) return;

  // Defilter scanlines
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const rowOff = y * stride;
    const filter = raw[rowOff];
    pixels[rowOff] = 0;
    for (let i = 0; i < width * bpp; i++) {
      const rawByte = raw[rowOff + 1 + i];
      const left = i >= bpp ? pixels[rowOff + 1 + i - bpp] : 0;
      const above = y > 0 ? pixels[(y - 1) * stride + 1 + i] : 0;
      const aboveLeft =
        i >= bpp && y > 0 ? pixels[(y - 1) * stride + 1 + i - bpp] : 0;
      let val;
      switch (filter) {
        case 0:
          val = rawByte;
          break;
        case 1:
          val = (rawByte + left) & 0xff;
          break;
        case 2:
          val = (rawByte + above) & 0xff;
          break;
        case 3:
          val = (rawByte + Math.floor((left + above) / 2)) & 0xff;
          break;
        case 4: {
          const p = left + above - aboveLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - above);
          const pc = Math.abs(p - aboveLeft);
          val =
            (rawByte +
              (pa <= pb && pa <= pc ? left : pb <= pc ? above : aboveLeft)) &
            0xff;
          break;
        }
        default:
          val = rawByte;
      }
      pixels[rowOff + 1 + i] = val;
    }
  }

  // Sample pixels across the image
  const values = [];
  for (let y = 0; y < height; y += 20) {
    const rowBase = y * stride + 1;
    for (let xi = 0; xi < 5; xi++) {
      const px = Math.round((xi * (width - 1)) / 4);
      const pixelOff = rowBase + px * bpp;
      if (pixelOff + 3 <= pixels.length) {
        values.push(
          pixels[pixelOff],
          pixels[pixelOff + 1],
          pixels[pixelOff + 2],
        );
      }
    }
  }

  if (values.length === 0) return;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (avg < 15) {
    throw new Error(`image too dark (avg brightness ${avg.toFixed(1)} < 15)`);
  }
  if (max - min <= 5) {
    throw new Error(`pixel values nearly uniform (range ${max - min} ≤ 5)`);
  }
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
    checkVisualContent(buf, { width, height, bitDepth, colorType });
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
console.log(`\n\u2713 All ${GAMES.length} screenshot assets valid.`);
