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
      const x1 = points[i];
      const y1 = points[i + 1];
      const x2 = points[(i + 2) % points.length];
      const y2 = points[(i + 3) % points.length];
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
      const dx = x - cx;
      const dy = y - cy;
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
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let cx = x1;
  let cy = y1;
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

function addOutline(buf, w, h) {
  const opaque = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    opaque[i] = buf[i * 4 + 3] > 20 ? 1 : 0;
  }

  // Add drop shadow first (offset 2px right, 2px down)
  const shadowBuf = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (opaque[idx]) {
        for (let dy = 2; dy <= 4; dy++) {
          for (let dx = 2; dx <= 3; dx++) {
            const sx = x + dx;
            const sy = y + dy;
            if (sx < w && sy < h) {
              const sidx = (sy * w + sx) * 4;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const a = Math.max(0, Math.min(80, Math.floor(120 / dist)));
              if (a > shadowBuf[sidx + 3]) {
                shadowBuf[sidx] = 0;
                shadowBuf[sidx + 1] = 0;
                shadowBuf[sidx + 2] = 0;
                shadowBuf[sidx + 3] = a;
              }
            }
          }
        }
      }
    }
  }

  // Merge shadow under ship
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    if (shadowBuf[idx + 3] > 0 && buf[idx + 3] === 0) {
      buf[idx] = shadowBuf[idx];
      buf[idx + 1] = shadowBuf[idx + 1];
      buf[idx + 2] = shadowBuf[idx + 2];
      buf[idx + 3] = shadowBuf[idx + 3];
    }
  }

  // Recompute opaque after shadow
  for (let i = 0; i < w * h; i++) {
    opaque[i] = buf[i * 4 + 3] > 20 ? 1 : 0;
  }

  // Add outline (1px black border around silhouette)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!opaque[idx]) continue;

      let edge = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
            edge = true;
          } else if (!opaque[ny * w + nx]) {
            edge = true;
          }
        }
      }

      if (edge) {
        buf[idx * 4] = 0;
        buf[idx * 4 + 1] = 0;
        buf[idx * 4 + 2] = 0;
        buf[idx * 4 + 3] = 255;
      }
    }
  }
}

function createShip(isPlayer) {
  const buf = Buffer.alloc(W * H * 4, 0);
  const cx = W / 2;

  // Color palettes — more saturated for readability
  const hullMain = isPlayer ? [70, 50, 32] : [42, 30, 18];
  const hullDark = isPlayer ? [48, 34, 20] : [30, 22, 12];
  const hullHighlight = isPlayer ? [95, 72, 48] : [58, 44, 30];
  const deck = isPlayer ? [110, 82, 52] : [82, 62, 42];
  const deckDark = isPlayer ? [85, 62, 40] : [65, 48, 32];
  const sail1 = isPlayer ? [248, 242, 228] : [205, 178, 148];
  const sail2 = isPlayer ? [240, 232, 215] : [190, 164, 134];
  const sail3 = isPlayer ? [225, 218, 200] : [175, 150, 122];
  const mast = [52, 40, 28];
  const mastLight = [72, 56, 40];
  const accent = isPlayer ? [220, 180, 100] : [160, 60, 45];
  const accentLight = isPlayer ? [240, 200, 120] : [185, 75, 55];
  const flag = isPlayer ? [28, 28, 30] : [130, 34, 20];
  const flagLight = isPlayer ? [55, 55, 60] : [160, 52, 34];
  const gold = [235, 200, 70];
  const windowColor = [200, 220, 180];
  const wake1 = [140, 175, 195];
  const wake2 = [175, 205, 220];

  const yKeel = 82;
  const yDeck = 68;
  const yWaterline = 60;

  // Hull (galleon shape)
  drawPolygon(
    buf,
    W,
    H,
    [cx - 22, yDeck, cx + 20, yDeck, cx + 18, yKeel, cx - 18, yKeel],
    ...hullMain,
    255,
  );
  drawPolygon(
    buf,
    W,
    H,
    [cx - 20, yWaterline, cx + 18, yWaterline, cx + 18, yKeel, cx - 18, yKeel],
    ...hullDark,
    220,
  );
  drawPolygon(
    buf,
    W,
    H,
    [cx - 22, yDeck, cx + 20, yDeck, cx + 18, yDeck + 4, cx - 20, yDeck + 4],
    ...hullHighlight,
    220,
  );

  // Bow curve
  drawPolygon(
    buf,
    W,
    H,
    [cx + 18, yDeck, cx + 22, yDeck - 4, cx + 20, yKeel - 10, cx + 18, yKeel],
    ...hullMain,
    240,
  );
  // Stern
  drawPolygon(
    buf,
    W,
    H,
    [cx - 22, yDeck, cx - 18, yKeel, cx - 22, yKeel - 6],
    ...hullMain,
    250,
  );

  // Planking lines
  for (let row = 0; row < 4; row++) {
    const y = yDeck + 4 + row * 4;
    drawLine(buf, W, H, cx - 19, y, cx + 17, y, ...hullDark, 120);
  }

  // Bowsprit
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

  // Deck cabin
  drawPolygon(
    buf,
    W,
    H,
    [cx - 10, yDeck - 10, cx + 8, yDeck - 10, cx + 8, yDeck, cx - 10, yDeck],
    ...deckDark,
    255,
  );
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
    220,
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
    220,
  );

  // Main mast
  drawPolygon(
    buf,
    W,
    H,
    [cx - 2, 28, cx + 2, 28, cx + 2, yDeck - 2, cx - 2, yDeck - 2],
    ...mast,
    255,
  );
  drawLine(buf, W, H, cx - 1, 30, cx - 1, yDeck - 4, ...mastLight, 180);
  // Crow's nest
  drawPolygon(
    buf,
    W,
    H,
    [cx - 3, 36, cx + 3, 36, cx + 4, 34, cx - 4, 34],
    ...mastLight,
    255,
  );

  // Fore mast
  drawPolygon(
    buf,
    W,
    H,
    [cx + 10, 36, cx + 13, 36, cx + 13, yDeck - 6, cx + 10, yDeck - 6],
    ...mast,
    255,
  );
  // Mizzen mast
  drawPolygon(
    buf,
    W,
    H,
    [cx - 12, 40, cx - 9, 40, cx - 9, yDeck - 4, cx - 12, yDeck - 4],
    ...mast,
    255,
  );

  // Yards
  drawLine(buf, W, H, cx - 18, 34, cx + 18, 34, ...mast, 220);
  drawLine(buf, W, H, cx - 14, 44, cx + 14, 44, ...mast, 200);
  drawLine(buf, W, H, cx - 10, 54, cx + 10, 54, ...mast, 180);

  // Main sails (brighter, more visible)
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
    240,
  );
  drawPolygon(
    buf,
    W,
    H,
    [cx - 10, 43, cx + 10, 43, cx + 12, 50, cx - 12, 50],
    [sail2[0] + 20, sail2[1] + 20, sail2[2] + 20],
    160,
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
    250,
  );
  drawPolygon(
    buf,
    W,
    H,
    [cx - 8, 33, cx + 8, 33, cx + 10, 38, cx - 10, 38],
    [sail1[0] + 15, sail1[1] + 15, sail1[2] + 15],
    160,
  );

  // Jib sail
  drawPolygon(
    buf,
    W,
    H,
    [cx + 12, 38, cx + 26, yDeck - 14, cx + 24, yDeck - 12, cx + 12, 44],
    ...sail3,
    220,
  );
  // Spanker sail
  drawPolygon(
    buf,
    W,
    H,
    [cx - 14, 42, cx - 20, yDeck - 4, cx - 18, yDeck - 2, cx - 12, 46],
    ...sail3,
    220,
  );

  // Rigging lines
  drawLine(buf, W, H, cx, 28, cx - 20, yDeck - 6, ...mast, 100);
  drawLine(buf, W, H, cx, 28, cx + 18, yDeck - 8, ...mast, 100);
  drawLine(buf, W, H, cx + 12, 36, cx + 26, yDeck - 16, ...mast, 100);

  // Flag at mainmast
  drawPolygon(
    buf,
    W,
    H,
    [cx - 2, 28, cx + 8, 28, cx + 10, 20, cx + 8, 16, cx - 2, 16],
    ...flag,
    255,
  );
  drawPolygon(
    buf,
    W,
    H,
    [cx + 8, 28, cx + 10, 20, cx + 8, 16, cx + 4, 18],
    ...flagLight,
    200,
  );

  // Player: white skull on black; LJ: red with white cross
  if (isPlayer) {
    drawCircle(buf, W, H, cx + 3, 21, 2, 200, 200, 200, 240);
    drawCircle(buf, W, H, cx + 3, 18, 1, 220, 220, 220, 140);
    drawLine(buf, W, H, cx + 1, 22, cx + 5, 26, 200, 200, 200, 200);
    drawLine(buf, W, H, cx + 5, 22, cx + 1, 26, 200, 200, 200, 200);
  } else {
    drawLine(buf, W, H, cx + 3, 18, cx + 3, 26, 255, 255, 255, 220);
    drawLine(buf, W, H, cx + 1, 22, cx + 5, 22, 255, 255, 255, 220);
  }

  // Cannon ports
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
        250,
      );
    }
  }

  // Accent stripe (gold for player, red for LJ)
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
    220,
  );
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
    140,
  );

  // Gold decor at stern
  drawPolygon(
    buf,
    W,
    H,
    [cx - 22, yDeck, cx - 18, yDeck, cx - 18, yDeck + 3, cx - 22, yDeck + 3],
    ...gold,
    220,
  );

  // Bow figurehead
  if (isPlayer) {
    drawCircle(buf, W, H, cx + 21, yDeck - 6, 3, ...gold, 220);
  } else {
    drawCircle(buf, W, H, cx + 21, yDeck - 6, 3, ...accent, 220);
  }

  // Wake (foam trail at bottom)
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
    140,
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
    110,
  );
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
    [210, 230, 240],
    90,
  );

  // Add drop shadow and outline for readability
  addOutline(buf, W, H);

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
