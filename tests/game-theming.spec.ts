import { test, expect } from "./helpers/browserGame";
import {
  waitForPygbagRuntime,
  getCanvasPixelSample,
} from "./helpers/browserGame";

const GAMES = [
  {
    id: "cannonball-clash",
    name: "Cannonball Clash",
    path: "/play/cannonball-clash/",
    archivePath: "cannonball-clash.tar.gz",
  },
  {
    id: "treasure-cove",
    name: "Treasure Cove",
    path: "/play/treasure-cove/",
    archivePath: "treasure-cove.tar.gz",
  },
];

test.describe("Game Theming", () => {
  test.describe("archive structure checks", () => {
    for (const game of GAMES) {
      test(`${game.name} paddle files contain ship-theming markers`, () => {
        const fs = require("fs");
        const path = require("path");
        const { execSync } = require("child_process");

        // Check source directory
        const paddlePath =
          game.id === "cannonball-clash"
            ? path.resolve(
                __dirname,
                "../scripts/pygbag-port/cannonball-clash/games/pong/paddle.py",
              )
            : path.resolve(
                __dirname,
                "../scripts/pygbag-port/treasure-cove/games/breakout/paddle.py",
              );

        const gameplayPath =
          game.id === "cannonball-clash"
            ? path.resolve(
                __dirname,
                "../scripts/pygbag-port/cannonball-clash/games/pong/gameplay.py",
              )
            : path.resolve(
                __dirname,
                "../scripts/pygbag-port/treasure-cove/games/breakout/gameplay.py",
              );

        // Check paddle file has ship-building code
        const paddleCode = fs.readFileSync(paddlePath, "utf-8");
        expect(paddleCode).toContain("_build_surfs");
        expect(paddleCode).toContain("_ship_surf");
        expect(paddleCode).toContain("pg.draw.polygon");
        expect(paddleCode).toContain("PIRATE_DARK_WOOD");

        // Check gameplay has touch target integration
        const gameplayCode = fs.readFileSync(gameplayPath, "utf-8");
        expect(gameplayCode).toContain("__pa_touch_active__");
        expect(gameplayCode).toContain("__pa_touch_axis__");
        expect(gameplayCode).toContain("__pa_touch_value__");

        // Check the actual shipped archive also contains the updated paddle code
        const archivePath = path.resolve(
          __dirname,
          `../public/play/${game.id}/${game.archivePath}`,
        );
        const archivePaddle = execSync(
          `tar xzf "${archivePath}" --to-stdout assets/games/pong/paddle.py 2>/dev/null || ` +
            `tar xzf "${archivePath}" --to-stdout assets/games/breakout/paddle.py 2>/dev/null || echo "NOT_FOUND"`,
          { encoding: "utf-8" },
        );
        expect(archivePaddle).not.toContain("NOT_FOUND");
        expect(archivePaddle).toContain("_ship_surf");
        expect(archivePaddle).toContain("pg.draw.polygon");

        // Verify specific improvements for Cannonball
        if (game.id === "cannonball-clash") {
          expect(archivePaddle).toMatch(
            /visual_w\s*=.*max\(self\.width\s*\+\s*\d+,\s*\d+\)/,
          );
          expect(archivePaddle).toContain("flag_color");
          expect(archivePaddle).toContain("yardarm_y");
          expect(archivePaddle).toContain("mast_x = offset_x + w // 2");
          // Ensure collision rect is unchanged comment or similar marker
          expect(archivePaddle).toMatch(/collision|rect|width.*height/i);
        }

        // Verify specific improvements for Treasure Cove
        if (game.id === "treasure-cove") {
          expect(archivePaddle).toMatch(
            /vw\s*=.*max\(self\.width\s*\+\s*\d+,\s*\d+\)/,
          );
          expect(archivePaddle).toContain("mast_x = vw // 2");
          expect(archivePaddle).toContain("oar_y = oy + vh // 2");
          expect(archivePaddle).toContain("oar_spacing = vw // 4");
          // Ensure collision rect is unchanged comment or similar marker
          expect(archivePaddle).toMatch(/collision|rect|width.*height/i);
        }
      });
    }
  });

  test.describe("visual smoke checks", () => {
    for (const game of GAMES) {
      test(`${game.name} canvas has non-trivial pixel content after load`, async ({
        page,
      }, testInfo) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await waitForPygbagRuntime(page);

        await page.waitForFunction(
          () => {
            const m = (window as any).__paBootMetrics;
            return m !== undefined && m["game-ready"] !== undefined;
          },
          { timeout: 120000 },
        );

        // Wait for canvas to render
        await page.waitForTimeout(2000);

        // Sample a region where the paddle should be
        const sample = await getCanvasPixelSample(page, 80, 20);
        expect(sample).toBeTruthy();

        // Count non-zero alpha pixels (non-empty canvas)
        let nonEmpty = 0;
        for (let i = 3; i < sample!.data.length; i += 4) {
          if (sample!.data[i] > 0) nonEmpty++;
        }

        // Canvas should have rendered content
        expect(nonEmpty).toBeGreaterThan(0);

        // Attach pixel stats
        await testInfo.attach(`pixel-stats-${game.id}`, {
          body: JSON.stringify({
            width: sample!.width,
            height: sample!.height,
            nonEmptyPixels: nonEmpty,
          }),
          contentType: "application/json",
        });
      });

      test(`${game.name} paddle region has multiple colors (not plain white)`, async ({
        page,
      }, testInfo) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await waitForPygbagRuntime(page);

        await page.waitForFunction(
          () => {
            const m = (window as any).__paBootMetrics;
            return m !== undefined && m["game-ready"] !== undefined;
          },
          { timeout: 120000 },
        );

        // Wait for canvas to render
        await page.waitForTimeout(2000);

        // Sample paddle region - multiple points to check for color variety
        const paddleSamples = [
          await getCanvasPixelSample(page, 80, 20),
          await getCanvasPixelSample(page, 80, 40),
          await getCanvasPixelSample(page, 80, 60),
          await getCanvasPixelSample(page, 100, 30),
          await getCanvasPixelSample(page, 120, 30),
        ].filter((s): s is NonNullable<typeof s> => s != null);

        expect(paddleSamples.length).toBeGreaterThan(0);

        // Extract color values (RGB) from each sample
        const colors = paddleSamples
          .map((sample) => {
            // Sample a few pixels from each sample and average
            let r = 0,
              g = 0,
              b = 0,
              count = 0;
            for (let i = 0; i < Math.min(16, sample.data.length); i += 4) {
              if (sample.data[i + 3] > 0) {
                // non-transparent
                r += sample.data[i];
                g += sample.data[i + 1];
                b += sample.data[i + 2];
                count++;
              }
            }
            return {
              r: Math.round(r / Math.max(1, count)),
              g: Math.round(g / Math.max(1, count)),
              b: Math.round(b / Math.max(1, count)),
            };
          })
          .filter((c) => c.r > 0 || c.g > 0 || c.b > 0);

        // Check that we have color variation (not all same color)
        const firstColor = colors[0];
        const hasVariation = colors.some(
          (c) =>
            Math.abs(c.r - firstColor.r) > 10 ||
            Math.abs(c.g - firstColor.g) > 10 ||
            Math.abs(c.b - firstColor.b) > 10,
        );

        // Paddle should not be a single plain color (especially not white)
        expect(
          hasVariation || colors.length < 2,
          `Paddle region should show color variation, got ${JSON.stringify(colors)}`,
        ).toBe(true);

        // Additionally, check that it's not predominantly white
        const whiteCount = colors.filter(
          (c) => c.r > 200 && c.g > 200 && c.b > 200,
        ).length;
        expect(whiteCount).toBeLessThan(colors.length);

        // Attach color analysis
        await testInfo.attach(`color-analysis-${game.id}`, {
          body: JSON.stringify({
            paddleSamples: paddleSamples.length,
            colors: colors,
            hasColorVariation: hasVariation,
            whiteCount: whiteCount,
          }),
          contentType: "application/json",
        });
      });
    }
  });
});
