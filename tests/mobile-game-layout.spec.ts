// Mobile game layout tests
import { test, expect } from "@playwright/test";

test.describe("Mobile Game Layout", () => {
  // Use iPhone 16 Pro Max-ish landscape dimensions
  const VIEWPORT_WIDTH = 932;
  const VIEWPORT_HEIGHT = 430;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
    });

    // Clear storage to simulate cold load
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
      actionText: "START",
    },
    {
      name: "Treasure Cove",
      path: "/play/treasure-cove/",
      actionText: "LAUNCH",
    },
  ];

  for (const game of GAMES) {
    test.describe(`${game.name}`, () => {
      test("should render canvas properly", async ({ page }) => {
        const response = await page.goto(game.path);
        expect(response).toBeOK();

        // Wait for game to be ready
        await page.waitForFunction(
          () => {
            return window.__paBootMetrics?.["game-ready"] !== undefined;
          },
          { timeout: 60000 },
        );

        // Wait for loading overlay to disappear
        await page.waitForFunction(
          () => {
            const overlay = document.getElementById(
              "pirate-arcade-loading-overlay",
            );
            return !overlay || overlay.style.display === "none";
          },
          { timeout: 60000 },
        );

        // Check canvas exists and is visible
        const canvas = page.locator("canvas.emscripten");
        await expect(canvas).toBeVisible();

        // Get canvas bounding box
        const canvasBox = await canvas.boundingBox();
        expect(canvasBox).toBeTruthy();

        if (canvasBox) {
          // Canvas should be within viewport bounds
          expect(canvasBox.x).toBeGreaterThanOrEqual(0);
          expect(canvasBox.y).toBeGreaterThanOrEqual(0);
          expect(canvasBox.x + canvasBox.width).toBeLessThanOrEqual(
            VIEWPORT_WIDTH,
          );
          expect(canvasBox.y + canvasBox.height).toBeLessThanOrEqual(
            VIEWPORT_HEIGHT,
          );

          // Canvas should have reasonable aspect ratio (close to 16:9)
          const aspectRatio = canvasBox.width / canvasBox.height;
          expect(aspectRatio).toBeGreaterThan(1.5); // 16:9 = 1.78, allow some flexibility
          expect(aspectRatio).toBeLessThan(2.0);

          // Canvas should use a good portion of vertical space
          const verticalUsage = canvasBox.height / VIEWPORT_HEIGHT;
          expect(verticalUsage).toBeGreaterThan(0.6); // At least 60% of viewport height
        }

        // Check that back link is not covered by canvas
        const backLink = page.locator("#back-link");
        await expect(backLink).toBeVisible();

        const backLinkBox = await backLink.boundingBox();
        if (backLinkBox && canvasBox) {
          // Back link should be in top-left area, not overlapped by canvas
          expect(backLinkBox.y + backLinkBox.height).toBeLessThan(
            canvasBox.y + 20,
          ); // Small buffer
        }

        // Check controls hint is visible and positioned correctly
        const controlsHint = page.locator("#controls-hint");
        await expect(controlsHint).toBeVisible();

        const hintBox = await controlsHint.boundingBox();
        if (hintBox) {
          // Controls hint should be near bottom center
          expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(
            VIEWPORT_HEIGHT - 10,
          ); // Near bottom
          expect(hintBox.x).toBeGreaterThanOrEqual(0);
          expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(VIEWPORT_WIDTH);
        }

        // Check action button has correct text and size
        const actionButton = page.locator(`button[data-action="action"]`);
        await expect(actionButton).toBeVisible();
        await expect(actionButton).toHaveText(game.actionText);

        const actionBox = await actionButton.boundingBox();
        expect(actionBox).toBeTruthy();
        if (actionBox) {
          // Action button should be at least 44x44 CSS px
          expect(actionBox.width).toBeGreaterThanOrEqual(44);
          expect(actionBox.height).toBeGreaterThanOrEqual(44);
        }

        // Check pause button exists and has reasonable size
        const pauseButton = page.locator(`button[data-action="pause"]`);
        await expect(pauseButton).toBeVisible();

        const pauseBox = await pauseButton.boundingBox();
        expect(pauseBox).toBeTruthy();
        if (pauseBox) {
          // Pause button should be at least 44x44 CSS px
          expect(pauseBox.width).toBeGreaterThanOrEqual(44);
          expect(pauseBox.height).toBeGreaterThanOrEqual(44);
        }

        // Game-specific control checks
        if (game.name === "Cannonball Clash") {
          // Cannonball should show up/down semantics
          const upButton = page.locator(`button[data-action="up"]`);
          const downButton = page.locator(`button[data-action="down"]`);
          await expect(upButton).toBeVisible();
          await expect(downButton).toBeVisible();

          // Check they have appropriate labels (▲/▼ or similar)
          const upLabel = await upButton.textContent();
          const downLabel = await downButton.textContent();
          expect(upLabel).toMatch(/[▲↑]/); // Up triangle or arrow
          expect(downLabel).toMatch(/[▼↓]/); // Down triangle or arrow
        } else if (game.name === "Treasure Cove") {
          // Treasure Cove should show left/right semantics
          const leftButton = page.locator(`button[data-action="left"]`);
          const rightButton = page.locator(`button[data-action="right"]`);
          await expect(leftButton).toBeVisible();
          await expect(rightButton).toBeVisible();

          // Check they have appropriate labels (◀▶ or similar)
          const leftLabel = await leftButton.textContent();
          const rightLabel = await rightButton.textContent();
          expect(leftLabel).toMatch(/[◀←]/); // Left triangle or arrow
          expect(rightLabel).toMatch(/[▶→]/); // Right triangle or arrow
        }

        // Take screenshot for visual review (optional)
        // await page.screenshot({ path: `test-results/${game.name.replace(/\s+/g, '-')}-layout.png` });
      });
    });
  }
});
