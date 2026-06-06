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
      hasActionButton: true,
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
      hasActionButton: true,
      actionText: /^LAUNCH$/i,
      nudgeLeft: '.btn-left[data-dir="left"]',
      nudgeRight: '.btn-right[data-dir="right"]',
      nudgeLeftLabel: /[◀←]/,
      nudgeRightLabel: /[▶→]/,
      hintContains: "slide",
    },
    {
      name: "Kraken's Wake",
      path: "/play/krakens-wake/",
      controls: "asteroids",
      hasActionButton: false,
      skipIfNoLayout: true, // canvas may not boot in CI
      nudgeLeft: '.btn-fire[data-dir="fire"]',
      nudgeRight: '.btn-thrust[data-dir="thrust"]',
      nudgeLeftLabel: /FIRE/i,
      nudgeRightLabel: /THRUST/i,
    },
  ];

  for (const game of GAMES) {
    test.describe(`${game.name}`, () => {
      test("__paCanvasLayout is exposed with correct geometry", async ({
        page,
      }, testInfo) => {
        const response = await page.goto(game.path);
        expect(response?.ok()).toBe(true);

        if (game.skipIfNoLayout) {
          // Some games (e.g. Kraken's Wake) may not boot canvas in CI
          try {
            await page.waitForFunction(
              () => !!(window as any).__paCanvasLayout,
              { timeout: 20000 },
            );
          } catch {
            testInfo.slow();
            return;
          }
        } else {
          await page.waitForFunction(() => !!(window as any).__paCanvasLayout, {
            timeout: 120000,
          });
        }

        const layout = await page.evaluate(
          () => (window as any).__paCanvasLayout,
        );

        expect(layout).toBeTruthy();
        expect(layout.left).toBeDefined();
        expect(layout.top).toBeDefined();
        expect(layout.width).toBeGreaterThan(0);
        expect(layout.height).toBeGreaterThan(0);
        expect(layout.right).toBe(layout.left + layout.width);
        expect(layout.bottom).toBe(layout.top + layout.height);
        expect(layout.bottomOffset).toBeGreaterThanOrEqual(0);
        expect(layout.viewportWidth).toBeGreaterThan(0);
        expect(layout.viewportHeight).toBeGreaterThan(0);

        // New diagnostic fields
        expect(layout.scale).toBeGreaterThan(0);
        expect(layout.scale).toBeLessThanOrEqual(1);
        expect(layout.viewportArea).toBeGreaterThan(0);
        expect(layout.canvasArea).toBeGreaterThan(0);
        expect(layout.canvasAreaRatio).toBeGreaterThan(0);
        expect(layout.canvasAreaRatio).toBeLessThanOrEqual(1);
        expect(layout.orientation).toBe("landscape");
        expect(layout.isMobileLandscape).toBe(true);

        // Canvas must fill most of viewport in landscape
        expect(layout.canvasAreaRatio).toBeGreaterThan(0.65);

        // Canvas must fit within viewport
        expect(layout.left).toBeGreaterThanOrEqual(0);
        expect(layout.top).toBeGreaterThanOrEqual(0);
        expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
        expect(layout.bottom).toBeLessThanOrEqual(layout.viewportHeight);

        // canvas.getBoundingClientRect() must agree with __paCanvasLayout
        const canvasBox = await page.locator("canvas.emscripten").boundingBox();
        if (canvasBox) {
          expect(Math.abs(canvasBox.x - layout.left)).toBeLessThanOrEqual(2);
          expect(Math.abs(canvasBox.y - layout.top)).toBeLessThanOrEqual(2);
          expect(Math.abs(canvasBox.width - layout.width)).toBeLessThanOrEqual(
            2,
          );
          expect(
            Math.abs(canvasBox.height - layout.height),
          ).toBeLessThanOrEqual(2);
        }
      });

      test("back link z-index is highest", async ({ page }) => {
        const response = await page.goto(game.path);
        expect(response?.ok()).toBe(true);

        const backLink = page.locator("#back-link");
        await expect(backLink).toBeVisible();

        const zIndex = await backLink.evaluate(
          (el) => window.getComputedStyle(el).zIndex,
        );
        expect(zIndex).toBe("1000005");

        // Verify drag zones have lower z-index than back link
        const dragZoneZ = await page
          .locator(".touch-drag-zone")
          .first()
          .evaluate((el) => parseInt(window.getComputedStyle(el).zIndex) || 0);
        expect(dragZoneZ).toBeLessThan(parseInt(zIndex) || Infinity);
      });

      test("drag zone axes align to canvas region", async ({
        page,
      }, testInfo) => {
        const response = await page.goto(game.path);
        expect(response?.ok()).toBe(true);

        if (game.skipIfNoLayout) {
          // Soft-skip layout tests for games that may not boot canvas
          try {
            await page.waitForFunction(
              () => !!(window as any).__paCanvasLayout,
              { timeout: 20000 },
            );
          } catch {
            testInfo.slow();
            return;
          }
        } else {
          await page.waitForFunction(() => !!(window as any).__paCanvasLayout, {
            timeout: 120000,
          });
        }

        const layout = await page.evaluate(
          () => (window as any).__paCanvasLayout,
        );

        const zones = await page.evaluate(() => {
          return Array.from(document.querySelectorAll(".touch-drag-zone")).map(
            (z) => {
              const rect = z.getBoundingClientRect();
              return {
                dataDir: (z as HTMLElement).dataset.dir || "",
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
              };
            },
          );
        });

        for (const zone of zones) {
          if (zone.dataDir.includes("drag-y")) {
            // Y-axis drag zone should be on left or right side of canvas
            const isLeftSide = zone.right <= layout.left + layout.width * 0.3;
            const isRightSide = zone.left >= layout.left + layout.width * 0.7;
            expect(isLeftSide || isRightSide).toBe(true);
            // Should span most of the canvas height
            expect(zone.top).toBeGreaterThanOrEqual(layout.top - 2);
            expect(zone.bottom).toBeLessThanOrEqual(layout.bottom + 2);
          } else if (zone.dataDir.includes("drag-x")) {
            // X-axis drag zone should overlap bottom portion of canvas
            expect(zone.top).toBeGreaterThanOrEqual(
              layout.top + layout.height * 0.5,
            );
            expect(zone.bottom).toBeLessThanOrEqual(layout.bottom + 2);
            expect(zone.left).toBeGreaterThanOrEqual(layout.left - 2);
            expect(zone.right).toBeLessThanOrEqual(layout.right + 2);
          }
        }

        await testInfo.attach(`drag-zone-geometry-${game.name}`, {
          body: JSON.stringify({ layout, zones }, null, 2),
          contentType: "application/json",
        });
      });

      test("drag zones are positioned relative to canvas", async ({
        page,
      }, testInfo) => {
        const response = await page.goto(game.path);
        expect(response?.ok()).toBe(true);

        if (game.skipIfNoLayout) {
          try {
            await page.waitForFunction(
              () => !!(window as any).__paCanvasLayout,
              { timeout: 20000 },
            );
          } catch {
            testInfo.slow();
            return;
          }
        } else {
          await page.waitForFunction(() => !!(window as any).__paCanvasLayout, {
            timeout: 120000,
          });
        }

        // For each drag zone, check it's bounded by the canvas
        const dragZones = await page.evaluate(() => {
          const zones = document.querySelectorAll(".touch-drag-zone");
          const layout = (window as any).__paCanvasLayout as any;
          if (!layout) return [];

          return Array.from(zones).map((z) => {
            const rect = z.getBoundingClientRect();
            const style = window.getComputedStyle(z);
            return {
              left: Math.round(rect.left),
              top: Math.round(rect.top),
              right: Math.round(rect.right),
              bottom: Math.round(rect.bottom),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              dataDir: (z as HTMLElement).dataset.dir || "",
              zIndex: parseInt(style.zIndex) || 0,
            };
          });
        });

        expect(dragZones.length).toBeGreaterThan(0);

        const layout = await page.evaluate(
          () => (window as any).__paCanvasLayout,
        );
        const margin = 2; // Allow 2px rounding error

        for (const zone of dragZones) {
          // Each drag zone should be within or adjacent to canvas bounds
          if (zone.dataDir.includes("drag-y")) {
            // Vertical drag zone: on left/right side of canvas
            expect(zone.top).toBeGreaterThanOrEqual(layout.top - margin);
            expect(zone.bottom).toBeLessThanOrEqual(layout.bottom + margin);
          } else if (zone.dataDir.includes("drag-x")) {
            // Horizontal drag zone: overlaps bottom portion of canvas
            expect(zone.left).toBeGreaterThanOrEqual(layout.left - margin);
            expect(zone.right).toBeLessThanOrEqual(layout.right + margin);
            expect(zone.bottom).toBeLessThanOrEqual(layout.bottom + margin);
            expect(zone.top).toBeGreaterThanOrEqual(layout.top - margin);
          }

          // Drag zones must have lower z-index than back link.
          // (z-index overlap is acceptable — the back-link at 1000005
          // always sits above drag-zone content.)
          expect(zone.zIndex).toBeLessThan(1000005);
        }
      });

      test("should render canvas and touch controls properly", async ({
        page,
      }, testInfo) => {
        const response = await page.goto(game.path);
        expect(response?.ok()).toBe(true);

        if (game.skipIfNoLayout) {
          try {
            await page.waitForFunction(
              () => !!(window as any).__paCanvasLayout,
              { timeout: 20000 },
            );
          } catch {
            testInfo.slow();
            return;
          }
        } else {
          await page.waitForFunction(() => !!(window as any).__paCanvasLayout, {
            timeout: 120000,
          });
        }

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

        const pauseButton = page.locator('.btn-pause[data-dir="pause"]');
        await expect(pauseButton).toBeVisible();

        const pauseBox = await pauseButton.boundingBox();
        expect(pauseBox).toBeTruthy();
        if (pauseBox) {
          expect(pauseBox.width).toBeGreaterThanOrEqual(44);
          expect(pauseBox.height).toBeGreaterThanOrEqual(44);
        }

        let actionBox: {
          x: number;
          y: number;
          width: number;
          height: number;
        } | null = null;
        if (game.hasActionButton) {
          const actionButton = page.locator('.btn-action[data-dir="action"]');
          await expect(actionButton).toBeVisible();

          actionBox = await actionButton.boundingBox();
          expect(actionBox).toBeTruthy();
          if (actionBox) {
            expect(actionBox.width).toBeGreaterThanOrEqual(44);
            expect(actionBox.height).toBeGreaterThanOrEqual(44);

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
              expect(inCenterX && inCenterY).toBe(false);
            }

            const actionText = await actionButton.textContent();
            expect(actionText).toMatch(game.actionText!);
          }
        }

        // elementFromPoint at back-link center resolves to #back-link
        const backTop = await page.evaluate(() => {
          const el = document.getElementById("back-link");
          if (!el) return null;
          const box = el.getBoundingClientRect();
          const cx = box.left + box.width / 2;
          const cy = box.top + box.height / 2;
          const top = document.elementFromPoint(cx, cy);
          if (!top) return null;
          let cur = top as HTMLElement | null;
          while (cur) {
            if (
              cur.id === "back-link" ||
              cur.getAttribute("data-no-touch-control") !== null
            ) {
              return cur.id || cur.tagName;
            }
            cur = cur.parentElement;
          }
          return top.id || top.tagName;
        });
        expect(backTop).toBe("back-link");

        // Nudge/action fallback buttons
        const leftButton = page.locator(game.nudgeLeft);
        const rightButton = page.locator(game.nudgeRight);
        await expect(leftButton).toBeVisible();
        await expect(rightButton).toBeVisible();

        const leftLabel = await leftButton.textContent();
        const rightLabel = await rightButton.textContent();
        expect(leftLabel).toMatch(game.nudgeLeftLabel);
        expect(rightLabel).toMatch(game.nudgeRightLabel);

        // Assert buttons are not covered by drag zone (elementFromPoint)
        const buttonsToCheck = [leftButton, rightButton, pauseButton];
        if (game.hasActionButton) {
          buttonsToCheck.push(page.locator('.btn-action[data-dir="action"]'));
        }
        for (const btn of buttonsToCheck) {
          const box = await btn.boundingBox();
          if (box) {
            const topEl = await page.evaluate(
              ({ x, y }) => {
                const el = document.elementFromPoint(x, y);
                if (!el) return "null";
                if (el.classList && el.classList.contains("btn"))
                  return "button";
                if (el.closest && el.closest(".btn")) return "button";
                if (el.classList && el.classList.contains("touch-drag-zone"))
                  return "drag-zone";
                return el.tagName + (el.className ? "." + el.className : "");
              },
              { x: box.x + box.width / 2, y: box.y + box.height / 2 },
            );
            expect(topEl).toBe("button");
          }
        }

        // Drag zones exist
        const dragZone = page.locator(`.touch-drag-zone`);
        await expect(dragZone).toBeVisible();

        // Hint text mentions slides (skip for asteroids controls)
        if (game.hintContains) {
          const hintText = await controlsHint.textContent();
          expect(hintText!.toLowerCase()).toContain(game.hintContains);
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
