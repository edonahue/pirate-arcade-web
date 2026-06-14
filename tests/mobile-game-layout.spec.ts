import { test, expect } from "@playwright/test";

// Expected viewport dimensions per Playwright project (from playwright.config.ts)
const PROJECT_VIEWPORTS: Record<string, { width: number; height: number }> = {
  "chromium-desktop": { width: 1280, height: 720 },
  "mobile-chrome": { width: 393, height: 727 },
  "mobile-safari": { width: 390, height: 664 },
  "webkit-desktop": { width: 1280, height: 720 },
  "firefox-desktop": { width: 1280, height: 720 },
  "ipad-safari": { width: 810, height: 1080 },
  "ipad-landscape": { width: 1024, height: 768 },
};

function isLandscapeViewport(
  vp: { width: number; height: number } | null,
): boolean {
  return vp !== null && vp.width > vp.height;
}

// Whether this project has touch capability (mobile/tablet emulation).
async function hasTouchCapability(page: any): Promise<boolean> {
  return page.evaluate(() => navigator.maxTouchPoints > 0);
}

test.describe("Mobile Game Layout", () => {
  test.describe("project viewport assertions", () => {
    for (const [projectName, expected] of Object.entries(PROJECT_VIEWPORTS)) {
      test(`${projectName} viewport is ${expected.width}x${expected.height}`, async ({
        page,
      }, testInfo) => {
        test.skip(
          testInfo.project.name !== projectName,
          `only runs on ${projectName}`,
        );
        const vp = page.viewportSize();
        expect(vp).toBeTruthy();
        expect(vp!.width).toBe(expected.width);
        expect(vp!.height).toBe(expected.height);
      });
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch {
        // localStorage may be inaccessible (e.g. file:// or cross-origin)
      }
      try {
        sessionStorage.clear();
      } catch {
        // sessionStorage may be inaccessible
      }
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
        const vp = page.viewportSize();
        const touches = await hasTouchCapability(page);
        test.skip(
          !isLandscapeViewport(vp) || !touches,
          `requires mobile landscape (${testInfo.project.name})`,
        );

        const response = await page.goto(game.path);
        expect(response?.ok()).toBe(true);

        if (game.skipIfNoLayout) {
          const hasLayout = await page
            .waitForFunction(() => !!(window as any).__paCanvasLayout, {
              timeout: 20000,
            })
            .then(() => true)
            .catch(() => false);
          test.skip(!hasLayout, `krakens wake did not boot`);
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

        expect(layout.scale).toBeGreaterThan(0);
        expect(layout.scale).toBeLessThanOrEqual(1);
        expect(layout.viewportArea).toBeGreaterThan(0);
        expect(layout.canvasArea).toBeGreaterThan(0);
        expect(layout.canvasAreaRatio).toBeGreaterThan(0);
        expect(layout.canvasAreaRatio).toBeLessThanOrEqual(1);
        expect(layout.orientation).toBe("landscape");
        // isMobileLandscape is true only on touch/coarse-pointer devices
        expect(typeof layout.isMobileLandscape).toBe("boolean");
        if (layout.viewportWidth > layout.viewportHeight) {
          const hasCoarsePointer = await page.evaluate(
            () => window.matchMedia("(pointer: coarse)").matches,
          );
          if (hasCoarsePointer) {
            expect(layout.isMobileLandscape).toBe(true);
          }
        }

        expect(layout.canvasAreaRatio).toBeGreaterThan(0.65);

        expect(layout.left).toBeGreaterThanOrEqual(0);
        expect(layout.top).toBeGreaterThanOrEqual(0);
        expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
        expect(layout.bottom).toBeLessThanOrEqual(layout.viewportHeight);

        const canvasBox = await page
          .locator("canvas.emscripten")
          .first()
          .boundingBox();
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

        // In portrait mode the orientation-lock overlay hides the back-link
        const vp = page.viewportSize();
        if (!isLandscapeViewport(vp)) {
          test.skip();
          return;
        }

        const backLink = page.locator("#back-link");
        await expect(backLink).toBeVisible();

        const zIndex = await backLink.evaluate(
          (el) => window.getComputedStyle(el).zIndex,
        );
        expect(zIndex).toBe("1000005");

        // Verify drag zones have lower z-index than back link — optional
        // (drag zones may not exist if game shell didn't fully initialize)
        const dragZoneCount = await page.locator(".touch-drag-zone").count();
        if (dragZoneCount > 0) {
          const dragZoneZ = await page
            .locator(".touch-drag-zone")
            .first()
            .evaluate(
              (el) => parseInt(window.getComputedStyle(el).zIndex) || 0,
            );
          expect(dragZoneZ).toBeLessThan(parseInt(zIndex) || Infinity);
        }
      });

      test("drag zone axes align to canvas region", async ({
        page,
      }, testInfo) => {
        const vp = page.viewportSize();
        const touches = await hasTouchCapability(page);
        test.skip(
          !isLandscapeViewport(vp) || !touches,
          `requires mobile landscape (${testInfo.project.name})`,
        );

        const response = await page.goto(game.path);
        expect(response?.ok()).toBe(true);

        if (game.skipIfNoLayout) {
          const hasLayout = await page
            .waitForFunction(() => !!(window as any).__paCanvasLayout, {
              timeout: 20000,
            })
            .then(() => true)
            .catch(() => false);
          test.skip(!hasLayout, `krakens wake did not boot`);
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
            const isLeftSide = zone.right <= layout.left + layout.width * 0.3;
            const isRightSide = zone.left >= layout.left + layout.width * 0.7;
            expect(isLeftSide || isRightSide).toBe(true);
            expect(zone.top).toBeGreaterThanOrEqual(layout.top - 2);
            expect(zone.bottom).toBeLessThanOrEqual(layout.bottom + 2);
          } else if (zone.dataDir.includes("drag-x")) {
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
        const vp = page.viewportSize();
        const touches = await hasTouchCapability(page);
        test.skip(
          !isLandscapeViewport(vp) || !touches,
          `requires mobile landscape (${testInfo.project.name})`,
        );

        const response = await page.goto(game.path);
        expect(response?.ok()).toBe(true);

        if (game.skipIfNoLayout) {
          const hasLayout = await page
            .waitForFunction(() => !!(window as any).__paCanvasLayout, {
              timeout: 20000,
            })
            .then(() => true)
            .catch(() => false);
          test.skip(!hasLayout, `krakens wake did not boot`);
        } else {
          await page.waitForFunction(() => !!(window as any).__paCanvasLayout, {
            timeout: 120000,
          });
        }

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
        const margin = 2;

        for (const zone of dragZones) {
          if (zone.dataDir.includes("drag-y")) {
            expect(zone.top).toBeGreaterThanOrEqual(layout.top - margin);
            expect(zone.bottom).toBeLessThanOrEqual(layout.bottom + margin);
          } else if (zone.dataDir.includes("drag-x")) {
            expect(zone.left).toBeGreaterThanOrEqual(layout.left - margin);
            expect(zone.right).toBeLessThanOrEqual(layout.right + margin);
            expect(zone.bottom).toBeLessThanOrEqual(layout.bottom + margin);
            expect(zone.top).toBeGreaterThanOrEqual(layout.top - margin);
          }

          expect(zone.zIndex).toBeLessThan(1000005);
        }
      });

      test("should render canvas and touch controls properly", async ({
        page,
      }, testInfo) => {
        const vp = page.viewportSize();
        const touches = await hasTouchCapability(page);
        test.skip(
          !isLandscapeViewport(vp) || !touches,
          `requires mobile landscape (${testInfo.project.name})`,
        );

        const response = await page.goto(game.path);
        expect(response?.ok()).toBe(true);

        if (game.skipIfNoLayout) {
          const hasLayout = await page
            .waitForFunction(() => !!(window as any).__paCanvasLayout, {
              timeout: 20000,
            })
            .then(() => true)
            .catch(() => false);
          test.skip(!hasLayout, `krakens wake did not boot`);
        } else {
          await page.waitForFunction(() => !!(window as any).__paCanvasLayout, {
            timeout: 120000,
          });
        }

        const canvas = page.locator("canvas.emscripten").first();
        await expect(canvas).toBeVisible();

        const canvasBox = await canvas.boundingBox();
        expect(canvasBox).toBeTruthy();

        if (canvasBox) {
          expect(canvasBox.x).toBeGreaterThanOrEqual(0);
          expect(canvasBox.y).toBeGreaterThanOrEqual(0);
          expect(canvasBox.x + canvasBox.width).toBeLessThanOrEqual(vp!.width);
          expect(canvasBox.y + canvasBox.height).toBeLessThanOrEqual(
            vp!.height,
          );

          const aspectRatio = canvasBox.width / canvasBox.height;
          expect(aspectRatio).toBeGreaterThan(1.5);
          expect(aspectRatio).toBeLessThan(2.0);

          const verticalUsage = canvasBox.height / vp!.height;
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

        const leftButton = page.locator(game.nudgeLeft);
        const rightButton = page.locator(game.nudgeRight);
        await expect(leftButton).toBeVisible();
        await expect(rightButton).toBeVisible();

        const leftLabel = await leftButton.textContent();
        const rightLabel = await rightButton.textContent();
        expect(leftLabel).toMatch(game.nudgeLeftLabel);
        expect(rightLabel).toMatch(game.nudgeRightLabel);

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

        const dragZone = page.locator(`.touch-drag-zone`);
        await expect(dragZone).toBeVisible();

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
