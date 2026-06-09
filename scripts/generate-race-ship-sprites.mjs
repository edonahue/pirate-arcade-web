import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";

const OUT_DIR = "public/images/race-to-treasure-island";
const W = 64;
const H = 96;

mkdirSync(OUT_DIR, { recursive: true });

function drawPolygon(buf, w, h, points, r, g, b, a) {
  const minY = Math.max(0, Math.min(...points.filter((_, i) => i % 2 === 1)));
  const maxY = Math.min(
    h - 1,
    Math.max(...points.filter((_, i) => i % 2 === 1)),
  );
  for (let y = minY; y <= maxY; y++) {
    const intersects = [];
    for (let i = 0; i < points.length; i += 2) {
      const x1 = points[i],
        y1 = points[i + 1];
      const x2 = points[(i + 2) % points.length],
        y2 = points[(i + 3) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const t = (y - y1) / (y2 - y1);
        intersects.push(x1 + t * (x2 - x1));
      }
    }
    intersects.sort((a, b) => a - b);
    for (let i = 0; i < intersects.length; i += 2) {
      const xStart = Math.max(0, Math.round(intersects[i]));
      const xEnd = Math.min(w - 1, Math.round(intersects[i + 1]));
      for (let x = xStart; x <= xEnd; x++) {
        const idx = (y * w + x) * 4;
        if (buf[idx + 3] === 0 || a > 200) {
          buf[idx] = r;
          buf[idx + 1] = g;
          buf[idx + 2] = b;
          buf[idx + 3] = a;
        }
      }
    }
  }
}

function drawCircle(buf, w, h, cx, cy, radius, r, g, b, a) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const dx = x - cx,
        dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        const idx = (y * w + x) * 4;
        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = b;
        buf[idx + 3] = a;
      }
    }
  }
}

function drawLine(buf, w, h, x1, y1, x2, y2, r, g, b, a) {
  const dx = Math.abs(x2 - x1),
    dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1,
    sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let cx = x1,
    cy = y1;
  while (true) {
    if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
      const idx = (cy * w + cx) * 4;
      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = a;
    }
    if (cx === x2 && cy === y2) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
}

function createShip(isPlayer) {
  const buf = Buffer.alloc(W * H * 4, 0);
  const cx = W / 2;

  // Color palettes
  const hullMain = isPlayer ? [60, 44, 30] : [38, 28, 18];
  const hullDark = isPlayer ? [45, 32, 20] : [28, 20, 12];
  const hullHighlight = isPlayer ? [75, 56, 38] : [50, 38, 26];
  const deck = isPlayer ? [90, 68, 45] : [70, 52, 36];
  const deckDark = isPlayer ? [70, 52, 34] : [55, 40, 28];
  const sail1 = isPlayer ? [235, 225, 205] : [190, 165, 135];
  const sail2 = isPlayer ? [220, 210, 190] : [175, 150, 120];
  const sail3 = isPlayer ? [200, 190, 170] : [160, 135, 110];
  const mast = [45, 35, 25];
  const mastLight = [60, 48, 35];
  const accent = isPlayer ? [201, 164, 92] : [140, 52, 40];
  const accentLight = isPlayer ? [220, 185, 110] : [165, 65, 50];
  const flag = isPlayer ? [25, 25, 28] : [110, 30, 18];
  const flagLight = isPlayer ? [50, 50, 55] : [140, 45, 30];
  const gold = [220, 185, 60];
  const windowColor = [180, 200, 160];
  const wake1 = [130, 160, 175];
  const wake2 = [160, 190, 200];

  const yKeel = 82;
  const yDeck = 68;
  const yWaterline = 60;

  // ── Hull (galleon shape: wider at top, narrows to stern, curves at bow) ──
  // Main hull body
  drawPolygon(
    buf,
    W,
    H,
    [cx - 22, yDeck, cx + 20, yDeck, cx + 18, yKeel, cx - 18, yKeel],
    ...hullMain,
    255,
  );
  // Hull dark bottom (below waterline visual)
  drawPolygon(
    buf,
    W,
    H,
    [cx - 20, yWaterline, cx + 18, yWaterline, cx + 18, yKeel, cx - 18, yKeel],
    ...hullDark,
    200,
  );
  // Hull highlight (top edge)
  drawPolygon(
    buf,
    W,
    H,
    [cx - 22, yDeck, cx + 20, yDeck, cx + 18, yDeck + 4, cx - 20, yDeck + 4],
    ...hullHighlight,
    200,
  );

  // Bow curve (front of ship — right side)
  drawPolygon(
    buf,
    W,
    H,
    [cx + 18, yDeck, cx + 22, yDeck - 4, cx + 20, yKeel - 10, cx + 18, yKeel],
    ...hullMain,
    220,
  );
  // Stern (left — flat back)
  drawPolygon(
    buf,
    W,
    H,
    [cx - 22, yDeck, cx - 18, yKeel, cx - 22, yKeel - 6],
    ...hullMain,
    230,
  );

  // ── Planking lines ──
  for (let row = 0; row < 4; row++) {
    const y = yDeck + 4 + row * 4;
    drawLine(buf, W, H, cx - 19, y, cx + 17, y, ...hullDark, 100);
  }

  // ── Bowsprit ──
  drawPolygon(
    buf,
    W,
    H,
    [
      cx + 20,
      yDeck - 4,
      cx + 28,
      yDeck - 16,
      cx + 27,
      yDeck - 14,
      cx + 19,
      yDeck - 2,
    ],
    ...mast,
    255,
  );

  // ── Deck cabin (small structure amidships) ──
  // Cabin walls
  drawPolygon(
    buf,
    W,
    H,
    [cx - 10, yDeck - 10, cx + 8, yDeck - 10, cx + 8, yDeck, cx - 10, yDeck],
    ...deckDark,
    255,
  );
  // Cabin roof
  drawPolygon(
    buf,
    W,
    H,
    [
      cx - 12,
      yDeck - 12,
      cx + 10,
      yDeck - 12,
      cx + 8,
      yDeck - 10,
      cx - 10,
      yDeck - 10,
    ],
    ...deck,
    255,
  );
  // Cabin windows
  drawPolygon(
    buf,
    W,
    H,
    [
      cx - 7,
      yDeck - 7,
      cx - 4,
      yDeck - 7,
      cx - 4,
      yDeck - 4,
      cx - 7,
      yDeck - 4,
    ],
    ...windowColor,
    200,
  );
  drawPolygon(
    buf,
    W,
    H,
    [
      cx + 1,
      yDeck - 7,
      cx + 4,
      yDeck - 7,
      cx + 4,
      yDeck - 4,
      cx + 1,
      yDeck - 4,
    ],
    ...windowColor,
    200,
  );

  // ── Main mast (tall, midship) ──
  drawPolygon(
    buf,
    W,
    H,
    [cx - 2, 28, cx + 2, 28, cx + 2, yDeck - 2, cx - 2, yDeck - 2],
    ...mast,
    255,
  );
  // Mast highlight
  drawLine(buf, W, H, cx - 1, 30, cx - 1, yDeck - 4, ...mastLight, 150);
  // Crow's nest
  drawPolygon(
    buf,
    W,
    H,
    [cx - 3, 36, cx + 3, 36, cx + 4, 34, cx - 4, 34],
    ...mastLight,
    255,
  );

  // ── Fore mast (front, smaller) ──
  drawPolygon(
    buf,
    W,
    H,
    [cx + 10, 36, cx + 13, 36, cx + 13, yDeck - 6, cx + 10, yDeck - 6],
    ...mast,
    240,
  );

  // ── Mizzen mast (back, smallest) ──
  drawPolygon(
    buf,
    W,
    H,
    [cx - 12, 40, cx - 9, 40, cx - 9, yDeck - 4, cx - 12, yDeck - 4],
    ...mast,
    240,
  );

  // ── Yards (horizontal spars) ──
  drawLine(buf, W, H, cx - 18, 34, cx + 18, 34, ...mast, 200);
  drawLine(buf, W, H, cx - 14, 44, cx + 14, 44, ...mast, 180);
  drawLine(buf, W, H, cx - 10, 54, cx + 10, 54, ...mast, 160);

  // ── Main sails (bellying, overlapping) ──
  // Largest sail (bottom)
  drawPolygon(
    buf,
    W,
    H,
    [
      cx - 16,
      42,
      cx + 16,
      42,
      cx + 18,
      52,
      cx + 14,
      60,
      cx - 14,
      60,
      cx - 18,
      52,
    ],
    ...sail2,
    230,
  );
  // Sail highlight
  drawPolygon(
    buf,
    W,
    H,
    [cx - 10, 43, cx + 10, 43, cx + 12, 50, cx - 12, 50],
    [sail2[0] + 25, sail2[1] + 25, sail2[2] + 25],
    140,
  );

  // Middle sail
  drawPolygon(
    buf,
    W,
    H,
    [
      cx - 14,
      32,
      cx + 14,
      32,
      cx + 16,
      40,
      cx + 12,
      48,
      cx - 12,
      48,
      cx - 16,
      40,
    ],
    ...sail1,
    240,
  );
  drawPolygon(
    buf,
    W,
    H,
    [cx - 8, 33, cx + 8, 33, cx + 10, 38, cx - 10, 38],
    [sail1[0] + 20, sail1[1] + 20, sail1[2] + 20],
    140,
  );

  // Jib sail (from foremast to bowsprit)
  drawPolygon(
    buf,
    W,
    H,
    [cx + 12, 38, cx + 26, yDeck - 14, cx + 24, yDeck - 12, cx + 12, 44],
    ...sail3,
    210,
  );

  // Spanker sail (from mizzen to stern)
  drawPolygon(
    buf,
    W,
    H,
    [cx - 14, 42, cx - 20, yDeck - 4, cx - 18, yDeck - 2, cx - 12, 46],
    ...sail3,
    200,
  );

  // ── Rigging lines ──
  drawLine(buf, W, H, cx, 28, cx - 20, yDeck - 6, ...mast, 80);
  drawLine(buf, W, H, cx, 28, cx + 18, yDeck - 8, ...mast, 80);
  drawLine(buf, W, H, cx + 12, 36, cx + 26, yDeck - 16, ...mast, 80);

  // ── Flag at mainmast ──
  drawPolygon(
    buf,
    W,
    H,
    [cx - 2, 28, cx + 8, 28, cx + 10, 20, cx + 8, 16, cx - 2, 16],
    ...flag,
    255,
  );
  // Flag wavy overlap
  drawPolygon(
    buf,
    W,
    H,
    [cx + 8, 28, cx + 10, 20, cx + 8, 16, cx + 4, 18],
    ...flagLight,
    180,
  );

  // Player flag: skull (white cross/dot pattern); LJ flag: red with cross
  if (isPlayer) {
    // Skull — small white shapes on black flag
    drawCircle(buf, W, H, cx + 3, 21, 2, 200, 200, 200, 200);
    drawCircle(buf, W, H, cx + 3, 18, 1, 220, 220, 220, 100);
    // Crossbones
    drawLine(buf, W, H, cx + 1, 22, cx + 5, 26, 200, 200, 200, 150);
    drawLine(buf, W, H, cx + 5, 22, cx + 1, 26, 200, 200, 200, 150);
  } else {
    // Red flag with white cross
    drawLine(buf, W, H, cx + 3, 18, cx + 3, 26, 255, 255, 255, 180);
    drawLine(buf, W, H, cx + 1, 22, cx + 5, 22, 255, 255, 255, 180);
  }

  // ── Cannon ports ──
  // Dark square ports along hull
  for (let x = -16; x <= 14; x += 7) {
    const px = cx + x;
    if (px > cx - 20 && px < cx + 16) {
      drawPolygon(
        buf,
        W,
        H,
        [
          px - 1,
          yDeck + 6,
          px + 1,
          yDeck + 6,
          px + 1,
          yDeck + 8,
          px - 1,
          yDeck + 8,
        ],
        [15, 15, 15],
        230,
      );
    }
  }

  // ── Accent stripe ──
  drawPolygon(
    buf,
    W,
    H,
    [
      cx - 21,
      yDeck + 4,
      cx + 19,
      yDeck + 4,
      cx + 18,
      yDeck + 6,
      cx - 20,
      yDeck + 6,
    ],
    ...accent,
    200,
  );
  // Second accent stripe lower
  drawPolygon(
    buf,
    W,
    H,
    [
      cx - 20,
      yDeck + 12,
      cx + 18,
      yDeck + 12,
      cx + 17,
      yDeck + 14,
      cx - 19,
      yDeck + 14,
    ],
    ...accentLight,
    120,
  );

  // ── Gold decor at stern ──
  drawPolygon(
    buf,
    W,
    H,
    [cx - 22, yDeck, cx - 18, yDeck, cx - 18, yDeck + 3, cx - 22, yDeck + 3],
    ...gold,
    200,
  );

  // ── Bow decoration (figurehead area) ──
  if (isPlayer) {
    drawCircle(buf, W, H, cx + 21, yDeck - 6, 3, ...gold, 200);
  } else {
    drawCircle(buf, W, H, cx + 21, yDeck - 6, 3, ...accent, 200);
  }

  // ── Wake (foam trail at bottom) ──
  drawPolygon(
    buf,
    W,
    H,
    [
      cx - 18,
      yKeel,
      cx + 18,
      yKeel,
      cx + 22,
      90,
      cx + 16,
      96,
      cx - 16,
      96,
      cx - 22,
      90,
    ],
    ...wake1,
    120,
  );
  drawPolygon(
    buf,
    W,
    H,
    [
      cx - 14,
      yKeel + 2,
      cx + 14,
      yKeel + 2,
      cx + 18,
      88,
      cx + 12,
      94,
      cx - 12,
      94,
      cx - 18,
      88,
    ],
    ...wake2,
    90,
  );
  // Upper wake spray
  drawPolygon(
    buf,
    W,
    H,
    [
      cx - 16,
      yKeel - 2,
      cx + 16,
      yKeel - 2,
      cx + 18,
      yKeel + 1,
      cx - 18,
      yKeel + 1,
    ],
    [200, 220, 235],
    70,
  );

  return sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toBuffer();
}

async function main() {
  const playerShip = await createShip(true);
  const longJohnShip = await createShip(false);
  writeFileSync(`${OUT_DIR}/player-ship.png`, playerShip);
  writeFileSync(`${OUT_DIR}/long-john-ship.png`, longJohnShip);
  console.log(
    `Generated ${OUT_DIR}/player-ship.png (${playerShip.length} bytes)`,
  );
  console.log(
    `Generated ${OUT_DIR}/long-john-ship.png (${longJohnShip.length} bytes)`,
  );
}

main().catch(console.error);
