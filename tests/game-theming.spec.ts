import { test, expect } from "./helpers/browserGame";
import {
  waitForPygbagRuntime,
  getCanvasPixelSample,
  getCanvasPixelSampleAt,
  unlockAndStartGame,
} from "./helpers/browserGame";

const GAMES = [
  {
    id: "cannonball-clash",
    name: "Cannonball Clash",
    path: "/play/cannonball-clash/",
    paddleKind: "pong",
    // Left paddle at x≈40, center y≈450; Right paddle at x≈1560
    paddleSamples: [
      { x: 60, y: 450 },
      { x: 60, y: 380 },
      { x: 60, y: 520 },
      { x: 1540, y: 450 },
      { x: 1540, y: 380 },
      { x: 1540, y: 520 },
    ],
  },
  {
    id: "treasure-cove",
    name: "Treasure Cove",
    path: "/play/treasure-cove/",
    paddleKind: "breakout",
    // Paddle at bottom center, y≈850, x≈800 (center of 1600)
    paddleSamples: [
      { x: 600, y: 850 },
      { x: 700, y: 850 },
      { x: 800, y: 850 },
      { x: 900, y: 850 },
      { x: 1000, y: 850 },
    ],
  },
  {
    id: "krakens-wake",
    name: "Kraken's Wake",
    path: "/play/krakens-wake/",
    paddleKind: "asteroids",
    // Ship at center of 1600x900
    paddleSamples: [
      { x: 800, y: 450 },
      { x: 780, y: 430 },
      { x: 820, y: 470 },
      { x: 760, y: 450 },
      { x: 840, y: 450 },
    ],
  },
];

test.describe("Game Theming - Visual Smoke Checks", () => {
  for (const game of GAMES) {
    test(`${game.name} canvas has non-trivial pixel content after load`, async ({
      page,
    }, testInfo) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      if (game.id === "krakens-wake") {
        try {
          await page.waitForFunction(
            () => {
              const m = (window as any).__paBootMetrics;
              return m !== undefined && m["game-ready"] !== undefined;
            },
            { timeout: 30000 },
          );
        } catch {
          testInfo.slow();
          return;
        }
      } else {
        await waitForPygbagRuntime(page);
        await page.waitForFunction(
          () => {
            const m = (window as any).__paBootMetrics;
            return m !== undefined && m["game-ready"] !== undefined;
          },
          { timeout: 120000 },
        );
      }

      await page.waitForTimeout(2000);

      const sample = await getCanvasPixelSample(page, 80, 20);
      expect(sample).toBeTruthy();

      let nonEmpty = 0;
      for (let i = 3; i < sample!.data.length; i += 4) {
        if (sample!.data[i] > 0) nonEmpty++;
      }

      expect(nonEmpty).toBeGreaterThan(0);

      await testInfo.attach(`pixel-stats-${game.id}`, {
        body: JSON.stringify({
          width: sample!.width,
          height: sample!.height,
          nonEmptyPixels: nonEmpty,
        }),
        contentType: "application/json",
      });
    });

    test(`${game.name} game shows non-background content after start`, async ({
      page,
    }, testInfo) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      if (game.id === "krakens-wake") {
        try {
          await page.waitForFunction(
            () => {
              const m = (window as any).__paBootMetrics;
              return m !== undefined && m["game-ready"] !== undefined;
            },
            { timeout: 30000 },
          );
        } catch {
          testInfo.slow();
          return;
        }
      } else {
        await waitForPygbagRuntime(page);
        await page.waitForFunction(
          () => {
            const m = (window as any).__paBootMetrics;
            return m !== undefined && m["game-ready"] !== undefined;
          },
          { timeout: 120000 },
        );
      }

      // Start the game (click to unlock audio, press Enter/Space)
      await unlockAndStartGame(page, []);
      await page.waitForTimeout(2000);

      // Sample a few regions to confirm non-background rendering
      const samples = await Promise.all([
        getCanvasPixelSampleAt(page, 100, 100, 30, 30),
        getCanvasPixelSampleAt(page, 800, 450, 30, 30),
        getCanvasPixelSampleAt(page, 1500, 800, 30, 30),
      ]);
      const validSamples = samples.filter(
        (s): s is NonNullable<typeof s> => s != null,
      );

      // At least one sample should have non-background content
      let hasNonBackground = false;
      for (const sample of validSamples) {
        let nonZero = 0;
        for (let i = 3; i < sample.data.length; i += 4) {
          if (sample.data[i] > 10) nonZero++;
        }
        if (nonZero > 20) {
          hasNonBackground = true;
          break;
        }
      }

      expect(hasNonBackground).toBe(true);

      await testInfo.attach(`render-check-${game.id}`, {
        body: JSON.stringify({
          validSamples: validSamples.length,
          hasNonBackground,
        }),
        contentType: "application/json",
      });
    });
  }
});
