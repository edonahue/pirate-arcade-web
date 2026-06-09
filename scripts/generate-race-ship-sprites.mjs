import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";

const OUT_DIR = "public/images/race-to-treasure-island";
const W = 48;
const H = 80;

mkdirSync(OUT_DIR, { recursive: true });

// Helper: draw a polygon on a raw RGBA buffer
function drawPolygon(buf, w, h, points, r, g, b, a) {
  // Simple scanline fill
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

function createShip(isPlayer) {
  const buf = Buffer.alloc(W * H * 4, 0);
  const cx = W / 2;

  // Colors
  const hullColor = isPlayer ? [56, 40, 28] : [40, 30, 20]; // brown hull
  const deckColor = isPlayer ? [80, 60, 40] : [65, 50, 35]; // lighter deck
  const sailColor = isPlayer ? [220, 210, 190] : [190, 170, 150]; // cream/red-brown sails
  const mastColor = [50, 40, 30]; // dark mast
  const accentColor = isPlayer ? [201, 164, 92] : [140, 52, 40]; // brass / rum
  const flagColor = isPlayer ? [30, 30, 30] : [100, 30, 20]; // black flag / red flag

  // Hull (trapezoid, wider at top)
  drawPolygon(
    buf,
    W,
    H,
    [cx - 16, 60, cx + 16, 60, cx + 12, 74, cx - 12, 74],
    ...hullColor,
    255,
  );

  // Deck line
  drawPolygon(
    buf,
    W,
    H,
    [cx - 14, 58, cx + 14, 58, cx + 16, 62, cx - 16, 62],
    ...deckColor,
    255,
  );

  // Bowsprit
  drawPolygon(
    buf,
    W,
    H,
    [cx - 2, 56, cx + 2, 56, cx + 2, 48, cx - 2, 48],
    ...mastColor,
    255,
  );

  // Mainmast
  drawPolygon(
    buf,
    W,
    H,
    [cx - 2, 26, cx + 2, 26, cx + 2, 60, cx - 2, 60],
    ...mastColor,
    255,
  );

  // Main sail (bellying)
  drawPolygon(
    buf,
    W,
    H,
    [
      cx - 14,
      30,
      cx + 14,
      30,
      cx + 16,
      38,
      cx + 12,
      46,
      cx - 12,
      46,
      cx - 16,
      38,
    ],
    ...sailColor,
    230,
  );
  // Sail highlight
  drawPolygon(
    buf,
    W,
    H,
    [cx - 8, 31, cx + 8, 31, cx + 10, 38, cx - 10, 38],
    [
      Math.min(255, sailColor[0] + 30),
      Math.min(255, sailColor[1] + 30),
      Math.min(255, sailColor[2] + 30),
    ],
    120,
  );

  // Jib sail (front triangle)
  drawPolygon(
    buf,
    W,
    H,
    [cx - 8, 28, cx + 10, 36, cx - 8, 44],
    ...sailColor,
    210,
  );

  // Flag at top of mast
  drawPolygon(
    buf,
    W,
    H,
    [cx - 2, 26, cx + 6, 26, cx + 6, 18, cx - 2, 18],
    ...flagColor,
    255,
  );
  // Skull icon (just a white dot for the tiny scale — barely visible but authentic)
  if (isPlayer) {
    drawPolygon(
      buf,
      W,
      H,
      [cx + 1, 21, cx + 3, 22, cx + 3, 20, cx + 1, 20],
      [220, 220, 220],
      200,
    );
  }

  // Accent stripes on hull
  drawPolygon(
    buf,
    W,
    H,
    [cx - 15, 64, cx + 15, 64, cx + 15, 66, cx - 15, 66],
    ...accentColor,
    200,
  );

  // Cannon ports (small circles)
  for (let x = -8; x <= 8; x += 8) {
    drawPolygon(
      buf,
      W,
      H,
      [cx + x - 1, 68, cx + x + 1, 68, cx + x + 1, 70, cx + x - 1, 70],
      [20, 20, 20],
      200,
    );
  }

  // Wake (subtle white/blue at bottom)
  drawPolygon(
    buf,
    W,
    H,
    [
      cx - 14,
      74,
      cx + 14,
      74,
      cx + 18,
      78,
      cx + 12,
      80,
      cx - 12,
      80,
      cx - 18,
      78,
    ],
    [180, 200, 210],
    100,
  );

  // Player gets a more prominent wake
  if (isPlayer) {
    drawPolygon(
      buf,
      W,
      H,
      [cx - 10, 76, cx + 10, 76, cx + 14, 79, cx - 14, 79],
      [200, 220, 230],
      80,
    );
  }

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
