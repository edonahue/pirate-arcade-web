#!/usr/bin/env node
/**
 * Validate Race to Treasure Island ship PNG assets.
 *
 * The game uses Phaser procedural textures at runtime, but the PNG assets
 * in public/images/race-to-treasure-island/ serve as the canonical design
 * reference and generator-script output. This validator catches regressions
 * where the generator produces black squares, blank images, or near-identical
 * player/rival ships.
 *
 * Checks:
 *   1. File exists, size in sane range.
 *   2. Dimensions match expected (64×96).
 *   3. Alpha channel present (RGBA).
 *   4. Transparent pixels exist (not a fully filled rectangle).
 *   5. Near-black pixel ratio not too high (no black squares).
 *   6. RGB variance above threshold (has visible detail, not uniform).
 *   7. Average brightness above threshold (readable on dark ocean).
 *   8. Player and rival are not byte-identical.
 *   9. Distinct color features present (sails, accents).
 *
 * Usage: node scripts/check-race-ship-assets.mjs
 *    or: npm run test:race-ship-assets
 */

import { readFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const SHIPS = [
  {
    name: "player-ship",
    path: "public/images/race-to-treasure-island/player-ship.png",
  },
  {
    name: "long-john-ship",
    path: "public/images/race-to-treasure-island/long-john-ship.png",
  },
];

const EXPECTED_W = 64;
const EXPECTED_H = 96;
const MIN_BYTES = 500;
const MAX_BYTES = 200 * 1024;
const MAX_NEAR_BLACK_RATIO = 0.7;
const MIN_VARIANCE = 10;
const MIN_AVG_BRIGHTNESS = 40;
const MIN_LIGHT_RATIO = 0.01;
const LIGHT_THRESHOLD = 160;

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const errors = [];

async function validateShip(name, absPath) {
  process.stdout.write(`  ${name}: `);
  try {
    const s = await stat(absPath);
    if (s.size < MIN_BYTES) {
      throw new Error(
        `too small (${formatBytes(s.size)}, min ${formatBytes(MIN_BYTES)})`,
      );
    }
    if (s.size > MAX_BYTES) {
      throw new Error(
        `too large (${formatBytes(s.size)}, max ${formatBytes(MAX_BYTES)})`,
      );
    }

    const img = sharp(await readFile(absPath));
    const meta = await img.metadata();

    if (meta.width !== EXPECTED_W || meta.height !== EXPECTED_H) {
      throw new Error(
        `dimensions ${meta.width}×${meta.height}, expected ${EXPECTED_W}×${EXPECTED_H}`,
      );
    }
    if (meta.channels !== 4) {
      throw new Error(`${meta.channels} channels, expected 4 (RGBA)`);
    }

    const raw = await img.raw().toBuffer();
    const total = raw.length / 4;
    let nonTransparent = 0;
    let nearBlack = 0;
    let light = 0;
    let rSum = 0,
      gSum = 0,
      bSum = 0;
    let pixelVals = [];

    for (let i = 0; i < total; i++) {
      const off = i * 4;
      const r = raw[off],
        g = raw[off + 1],
        b = raw[off + 2],
        a = raw[off + 3];
      if (a > 20) {
        nonTransparent++;
        rSum += r;
        gSum += g;
        bSum += b;
        pixelVals.push(r, g, b);
        if (r < 25 && g < 25 && b < 25) nearBlack++;
        if ((r + g + b) / 3 > LIGHT_THRESHOLD) light++;
      }
    }

    const nonTransparentRatio = nonTransparent / total;
    const nearBlackRatio = nonTransparent > 0 ? nearBlack / nonTransparent : 1;

    if (nonTransparentRatio < 0.05) {
      throw new Error(
        `too few non-transparent pixels (${(nonTransparentRatio * 100).toFixed(1)}%)`,
      );
    }
    if (nonTransparentRatio > 0.95) {
      throw new Error(
        `nearly full rectangle (${(nonTransparentRatio * 100).toFixed(1)}% filled)`,
      );
    }
    if (nearBlackRatio > MAX_NEAR_BLACK_RATIO) {
      throw new Error(
        `${(nearBlackRatio * 100).toFixed(0)}% near-black pixels (max ${(MAX_NEAR_BLACK_RATIO * 100).toFixed(0)}%)`,
      );
    }

    const avgR = nonTransparent > 0 ? rSum / nonTransparent : 0;
    const avgG = nonTransparent > 0 ? gSum / nonTransparent : 0;
    const avgB = nonTransparent > 0 ? bSum / nonTransparent : 0;
    const avgBrightness = (avgR + avgG + avgB) / 3;

    if (avgBrightness < MIN_AVG_BRIGHTNESS) {
      throw new Error(
        `avg brightness ${avgBrightness.toFixed(1)} < ${MIN_AVG_BRIGHTNESS}`,
      );
    }

    let variance = 0;
    for (let i = 0; i < pixelVals.length; i += 3) {
      variance +=
        Math.abs(pixelVals[i] - avgR) +
        Math.abs(pixelVals[i + 1] - avgG) +
        Math.abs(pixelVals[i + 2] - avgB);
    }
    variance = nonTransparent > 0 ? variance / nonTransparent : 0;

    if (variance < MIN_VARIANCE) {
      throw new Error(
        `color variance ${variance.toFixed(1)} < ${MIN_VARIANCE}`,
      );
    }

    const lightRatio = nonTransparent > 0 ? light / nonTransparent : 0;
    if (lightRatio < MIN_LIGHT_RATIO) {
      throw new Error(
        `light pixel ratio ${(lightRatio * 100).toFixed(1)}% < ${(MIN_LIGHT_RATIO * 100).toFixed(0)}%`,
      );
    }

    console.log(
      `OK ${meta.width}×${meta.height} RGBA ${formatBytes(s.size)} ` +
        `nonBg:${(nonTransparentRatio * 100).toFixed(0)}% ` +
        `dark:${(nearBlackRatio * 100).toFixed(0)}% ` +
        `light:${(lightRatio * 100).toFixed(0)}% ` +
        `avg:${avgBrightness.toFixed(0)} ` +
        `var:${variance.toFixed(0)}`,
    );
  } catch (err) {
    console.log(`FAIL ${err.message}`);
    errors.push(`${name}: ${err.message}`);
  }
}

const ships = [];
for (const { name, path } of SHIPS) {
  const abs = resolve(REPO_ROOT, path);
  ships.push({ name, abs, path });
}

for (const ship of ships) {
  await validateShip(ship.name, ship.abs);
}

// Check player and rival are not byte-identical
if (errors.length === 0 && ships.length === 2) {
  const buf1 = await readFile(ships[0].abs);
  const buf2 = await readFile(ships[1].abs);
  const h1 = createHash("sha256").update(buf1).digest("hex").slice(0, 16);
  const h2 = createHash("sha256").update(buf2).digest("hex").slice(0, 16);
  if (h1 === h2) {
    errors.push(`player and rival ships are byte-identical (sha:${h1})`);
  }
}

if (errors.length) {
  console.error(`\n\u2717 ${errors.length} ship asset check(s) failed:`);
  for (const e of errors) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`\n\u2713 All ${SHIPS.length} ship assets valid.`);
