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
      actionText: /^START$/i,
      nudgeLeft: '.btn-up[data-dir="left"]',
      nudgeRight: '.btn-down[data-dir="right"]',
      nudgeLeftLabel: /[▲↑]/,
      nudgeRightLabel: /[▼↓]/,
      hintContains: "slide",
    },
    {
      name: "Treasure Cove",
      path: "/play/treasure-cove/",
      controls: "breakout",
      actionText: /^LAUNCH$/i,
      nudgeLeft: '.btn-left[data-dir="left"]',
      nudgeRight: '.btn-right[data-dir="right"]',
      nudgeLeftLabel: /[◀←]/,
      nudgeRightLabel: /[▶→]/,
      hintContains: "slide",
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

        // Action button (pill, not orange circle)
        const actionButton = page.locator('.btn-action[data-dir="action"]');
        await expect(actionButton).toBeVisible();

        const actionBox = await actionButton.boundingBox();
        expect(actionBox).toBeTruthy();
        if (actionBox) {
          expect(actionBox.width).toBeGreaterThanOrEqual(44);
          expect(actionBox.height).toBeGreaterThanOrEqual(44);

          // Action button must NOT be in the center of the canvas
          if (canvasBox) {
            const safeXMin = canvasBox.x + canvasBox.width * 0.3;
            const safeXMax = canvasBox.x + canvasBox.width * 0.7;
            const safeYMin = canvasBox.y + canvasBox.height * 0.25;
            const safeYMax = canvasBox.y + canvasBox.height * 0.75;
            const actionCenterX = actionBox.x + actionBox.width / 2;
            const actionCenterY = actionBox.y + actionBox.height / 2;
            const inCenterX =
              actionCenterX >= safeXMin && actionCenterX <= safeXMax;
            const inCenterY =
              actionCenterY >= safeYMin && actionCenterY <= safeYMax;
            // Assert NOT in the central gameplay zone
            expect(inCenterX && inCenterY).toBe(false);
          }

          // Action button text should match expected content
          const actionText = await actionButton.textContent();
          expect(actionText).toMatch(game.actionText);
        }

        const pauseButton = page.locator('.btn-pause[data-dir="pause"]');
        await expect(pauseButton).toBeVisible();

        const pauseBox = await pauseButton.boundingBox();
        expect(pauseBox).toBeTruthy();
        if (pauseBox) {
          expect(pauseBox.width).toBeGreaterThanOrEqual(44);
          expect(pauseBox.height).toBeGreaterThanOrEqual(44);
        }

        // Nudge fallback buttons
        const leftButton = page.locator(game.nudgeLeft);
        const rightButton = page.locator(game.nudgeRight);
        await expect(leftButton).toBeVisible();
        await expect(rightButton).toBeVisible();

        const leftLabel = await leftButton.textContent();
        const rightLabel = await rightButton.textContent();
        expect(leftLabel).toMatch(game.nudgeLeftLabel);
        expect(rightLabel).toMatch(game.nudgeRightLabel);

        // Drag zones exist
        const dragZone = page.locator(`.touch-drag-zone`);
        await expect(dragZone).toBeVisible();

        // Hint text mentions slides
        const hintText = await controlsHint.textContent();
        expect(hintText!.toLowerCase()).toContain(game.hintContains);

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
