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
    }
  });
});
