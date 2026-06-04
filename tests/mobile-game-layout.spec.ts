import { test, expect } from "@playwright/test";

test.describe("Mobile Game Layout", () => {
  const VIEWPORT_WIDTH = 932;
  const VIEWPORT_HEIGHT = 430;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
    });
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  const GAMES = [
    {
      name: "Cannonball Clash",
      path: "/play/cannonball-clash/",
      controls: "pong",
    },
    {
      name: "Treasure Cove",
      path: "/play/treasure-cove/",
      controls: "breakout",
    },
  ];

  for (const game of GAMES) {
    test.describe(`${game.name}`, () => {
      test("should render canvas and touch controls properly", async ({
        page,
      }, testInfo) => {
        const response = await page.goto(game.path);
        expect(response?.ok()).toBe(true);

        await page.waitForFunction(
          () => {
            const m = (window as any).__paBootMetrics;
            return m?.["game-ready"] !== undefined;
          },
          { timeout: 120000 },
        );

        await page.waitForFunction(
          () => {
            const overlay = document.getElementById("game-loading");
            return !overlay || overlay.classList.contains("hidden");
          },
          { timeout: 120000 },
        );

        const canvas = page.locator("canvas.emscripten");
        await expect(canvas).toBeVisible();

        const canvasBox = await canvas.boundingBox();
        expect(canvasBox).toBeTruthy();

        if (canvasBox) {
          expect(canvasBox.x).toBeGreaterThanOrEqual(0);
          expect(canvasBox.y).toBeGreaterThanOrEqual(0);
          expect(canvasBox.x + canvasBox.width).toBeLessThanOrEqual(
            VIEWPORT_WIDTH,
          );
          expect(canvasBox.y + canvasBox.height).toBeLessThanOrEqual(
            VIEWPORT_HEIGHT,
          );

          const aspectRatio = canvasBox.width / canvasBox.height;
          expect(aspectRatio).toBeGreaterThan(1.5);
          expect(aspectRatio).toBeLessThan(2.0);

          const verticalUsage = canvasBox.height / VIEWPORT_HEIGHT;
          expect(verticalUsage).toBeGreaterThan(0.6);
        }

        const backLink = page.locator("#back-link");
        await expect(backLink).toBeVisible();

        const controlsHint = page.locator("#controls-hint");
        await expect(controlsHint).toBeVisible();

        const actionButton = page.locator('.btn-action[data-dir="action"]');
        await expect(actionButton).toBeVisible();

        const actionBox = await actionButton.boundingBox();
        expect(actionBox).toBeTruthy();
        if (actionBox) {
          expect(actionBox.width).toBeGreaterThanOrEqual(44);
          expect(actionBox.height).toBeGreaterThanOrEqual(44);
        }

        const pauseButton = page.locator('.btn-pause[data-dir="pause"]');
        await expect(pauseButton).toBeVisible();

        const pauseBox = await pauseButton.boundingBox();
        expect(pauseBox).toBeTruthy();
        if (pauseBox) {
          expect(pauseBox.width).toBeGreaterThanOrEqual(44);
          expect(pauseBox.height).toBeGreaterThanOrEqual(44);
        }

        if (game.controls === "pong") {
          const leftButton = page.locator('.btn-left[data-dir="left"]');
          const rightButton = page.locator('.btn-right[data-dir="right"]');
          await expect(leftButton).toBeVisible();
          await expect(rightButton).toBeVisible();

          const leftLabel = await leftButton.textContent();
          const rightLabel = await rightButton.textContent();
          expect(leftLabel).toMatch(/[▲↑]/);
          expect(rightLabel).toMatch(/[▼↓]/);

          const hintText = await controlsHint.textContent();
          expect(hintText!.toLowerCase()).toContain("up/down");
        } else if (game.controls === "breakout") {
          const leftButton = page.locator('.btn-left[data-dir="left"]');
          const rightButton = page.locator('.btn-right[data-dir="right"]');
          await expect(leftButton).toBeVisible();
          await expect(rightButton).toBeVisible();

          const leftLabel = await leftButton.textContent();
          const rightLabel = await rightButton.textContent();
          expect(leftLabel).toMatch(/[◀←]/);
          expect(rightLabel).toMatch(/[▶→]/);

          const hintText = await controlsHint.textContent();
          expect(hintText!.toLowerCase()).toContain("move");
        }

        await testInfo.attach(`layout-${game.name}`, {
          body: JSON.stringify({
            canvasBox: canvasBox,
            actionBox: actionBox,
            pauseBox: pauseBox,
          }),
          contentType: "application/json",
        });
      });
    });
  }
});
