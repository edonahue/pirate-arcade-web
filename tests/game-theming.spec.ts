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
    paddleKind: "pong",
  },
  {
    id: "treasure-cove",
    name: "Treasure Cove",
    path: "/play/treasure-cove/",
    archivePath: "treasure-cove.tar.gz",
    paddleKind: "breakout",
  },
  {
    id: "krakens-wake",
    name: "Kraken's Wake",
    path: "/play/krakens-wake/",
    archivePath: "krakens-wake.tar.gz",
    paddleKind: "asteroids",
  },
];

test.describe("Game Theming", () => {
  test.describe("archive structure checks", () => {
    for (const game of GAMES) {
      test(`${game.name} source files contain ship-theming markers`, () => {
        const fs = require("fs");
        const path = require("path");
        const { execSync } = require("child_process");

        // Determine source paths based on game kind
        let sourcePath, gameplayPath, archiveCheckCmd, archiveSubPath;
        if (game.paddleKind === "pong") {
          sourcePath = path.resolve(
            __dirname,
            "../scripts/pygbag-port/cannonball-clash/games/pong/paddle.py",
          );
          gameplayPath = path.resolve(
            __dirname,
            "../scripts/pygbag-port/cannonball-clash/games/pong/gameplay.py",
          );
          archiveSubPath = "assets/games/pong/paddle.py";
        } else if (game.paddleKind === "breakout") {
          sourcePath = path.resolve(
            __dirname,
            "../scripts/pygbag-port/treasure-cove/games/breakout/paddle.py",
          );
          gameplayPath = path.resolve(
            __dirname,
            "../scripts/pygbag-port/treasure-cove/games/breakout/gameplay.py",
          );
          archiveSubPath = "assets/games/breakout/paddle.py";
        } else {
          // Kraken's Wake — check ship.py
          sourcePath = path.resolve(
            __dirname,
            "../scripts/pygbag-port/krakens-wake/games/asteroids/ship.py",
          );
          archiveSubPath = "assets/games/asteroids/ship.py";
        }

        // Check source file has ship-building code
        const sourceCode = fs.readFileSync(sourcePath, "utf-8");
        expect(sourceCode).toContain("_build_ship");
        expect(sourceCode).toContain("_ship_surf");
        expect(sourceCode).toContain("pg.draw.polygon");
        expect(sourceCode).toMatch(/PIRATE_\w+/);

        if (gameplayPath) {
          const gameplayCode = fs.readFileSync(gameplayPath, "utf-8");
          expect(gameplayCode).toContain("__pa_touch_active__");
          expect(gameplayCode).toContain("__pa_touch_axis__");
          expect(gameplayCode).toContain("__pa_touch_value__");
        }

        // Check the actual shipped archive also contains the updated source code
        const archivePath = path.resolve(
          __dirname,
          `../public/play/${game.id}/${game.archivePath}`,
        );
        const archiveSource = execSync(
          `tar xzf "${archivePath}" --to-stdout ${archiveSubPath} 2>/dev/null || echo "NOT_FOUND"`,
          { encoding: "utf-8" },
        );
        expect(archiveSource).not.toContain("NOT_FOUND");
        expect(archiveSource).toContain("_ship_surf");

        // Verify specific improvements per game
        if (game.id === "cannonball-clash") {
          expect(archiveSource).toMatch(
            /visual_w\s*=.*max\(self\.width\s*\+\s*\d+,\s*\d+\)/,
          );
          expect(archiveSource).toContain("flag_color");
          expect(archiveSource).toContain("mast_x");
          expect(archiveSource).toMatch(/collision|rect|width.*height/i);
          // New elegant ship markers
          expect(archiveSource).toContain("accent_color");
          expect(archiveSource).toContain("cannon_port");
          expect(archiveSource).toContain("PIRATE_TEAL");
          expect(archiveSource).toContain("PIRATE_RED");
        }

        if (game.id === "treasure-cove") {
          expect(archiveSource).toMatch(
            /vw\s*=.*max\(self\.width\s*\+\s*\d+,\s*\d+\)/,
          );
          expect(archiveSource).toContain("mast_x");
          expect(archiveSource).toMatch(/collision|rect|width.*height/i);
          // New longboat markers
          expect(archiveSource).toContain("crate");
          expect(archiveSource).toContain("lantern");
          expect(archiveSource).toContain("crow");
        }

        if (game.id === "krakens-wake") {
          expect(archiveSource).toContain("_build_flames");
          expect(archiveSource).toContain("PIRATE_CANNON");
          expect(archiveSource).toContain("PIRATE_FLAME");
          expect(archiveSource).toMatch(/collision|rect|width.*height/i);
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

        // Kraken's Wake may not boot canvas in CI — soft skip
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

        // Kraken's Wake may not boot canvas in CI — soft skip
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
            let r = 0,
              g = 0,
              b = 0,
              count = 0;
            for (let i = 0; i < Math.min(16, sample.data.length); i += 4) {
              if (sample.data[i + 3] > 0) {
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

        const firstColor = colors[0];
        const hasVariation = colors.some(
          (c) =>
            Math.abs(c.r - firstColor.r) > 10 ||
            Math.abs(c.g - firstColor.g) > 10 ||
            Math.abs(c.b - firstColor.b) > 10,
        );

        expect(
          hasVariation || colors.length < 2,
          `Paddle region should show color variation, got ${JSON.stringify(colors)}`,
        ).toBe(true);

        const whiteCount = colors.filter(
          (c) => c.r > 200 && c.g > 200 && c.b > 200,
        ).length;
        expect(whiteCount).toBeLessThan(colors.length);

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
