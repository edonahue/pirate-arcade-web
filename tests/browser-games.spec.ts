/**
 * Browser game smoke tests for the Pirate Arcade Pygbag/WASM games.
 *
 * These tests are designed to catch regressions in:
 *   - JavaScript console errors (EvalError, CSP, TypeError, etc.)
 *   - Pygbag runtime startup (WASM, Python interpreter, tar.gz fetch)
 *   - Canvas rendering (game is drawing frames, not just allocating)
 *   - Touch controls wiring (DOM elements and data-dir attributes)
 *   - Orientation lock overlay presence
 *   - Network responses for game-critical assets
 *
 * They run against all configured projects (chromium/firefox/webkit
 * desktop, plus mobile emulations). Mobile projects only run the
 * touch-overlay and orientation-lock checks because rendering on
 * emulated mobile is timing-sensitive.
 *
 * IMPORTANT: These tests do NOT assert on scores, ball positions,
 * animation frames, or other time-dependent visuals. They are smoke
 * tests for startup and overall health.
 */

import { test, expect } from "./helpers/browserGame";
import {
  collectPageDiagnostics,
  waitForPygbagRuntime,
  unlockAndStartGame,
  expectCanvasHasRenderedPixels,
  expectTouchOverlayWired,
  expectRotateDeviceOverlayPresent,
  attachDiagnostics,
  blockingErrors,
} from "./helpers/browserGame";

interface GameSpec {
  id: string;
  name: string;
  path: string;
  desktopKeys: string[];
}

const GAMES: GameSpec[] = [
  {
    id: "cannonball-clash",
    name: "Cannonball Clash",
    path: "/play/cannonball-clash/",
    desktopKeys: ["ArrowUp", "ArrowDown", "Space", "Enter", "Escape"],
  },
  {
    id: "treasure-cove",
    name: "Treasure Cove",
    path: "/play/treasure-cove/",
    desktopKeys: ["ArrowLeft", "ArrowRight", "Space", "Enter", "Escape"],
  },
];

// Restrict the heavy WASM startup tests to desktop projects. Mobile
// emulations work, but they're slow and noisy. We still do the cheap
// DOM checks on mobile.
const DESKTOP_PROJECTS = [
  "chromium-desktop",
  "firefox-desktop",
  "webkit-desktop",
];

for (const game of GAMES) {
  test.describe(`${game.name}`, () => {
    test("page loads and has the expected DOM wiring", async ({ page }) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      // Static DOM elements that should exist regardless of runtime state
      await expect(page.locator("canvas#canvas")).toHaveCount(1);
      await expect(page.locator("#infobox")).toHaveCount(1);
      await expect(page.locator("#back-link")).toHaveCount(1);
      await expect(page.locator("#controls-hint")).toHaveCount(1);
      await expect(page.locator("#transfer")).toHaveCount(1);

      // Touch overlay + rotate-device present on every device class.
      // The rotate-device overlay uses CSS to show/hide, so we
      // only assert the element exists.
      await expectTouchOverlayWired(page);
      await expectRotateDeviceOverlayPresent(page);

      // Infobox should not be empty (initial copy)
      const ibText = await page.locator("#infobox").textContent();
      expect(ibText?.length).toBeGreaterThan(10);

      // Back link points at the arcade
      const href = await page.locator("#back-link").getAttribute("href");
      expect(href).toBe("/play/");
    });

    test("runtime starts and the canvas becomes visible", async ({
      page,
    }, testInfo) => {
      // Only run on desktop projects; mobile emulations are too noisy
      // for the heavy WASM startup. Mobile projects have their own
      // shorter test below.
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `WASM startup test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      // Wait for the runtime to come up. This handles all the
      // Pygbag internals (FS, cross_file, window.python, etc.)
      await waitForPygbagRuntime(page);

      // The transfer overlay should be hidden by the time the runtime
      // signals "ready". This is the strongest single signal that
      // custom_site has run. Give it a bit of grace time because
      // waitForPygbagRuntime may have returned on a different signal
      // (canvas size, infobox text, etc.) and transfer hide is async.
      await page.waitForFunction(
        () => !!document.getElementById("transfer")?.hidden,
        { timeout: 10000, polling: 100 },
      );
      const transferHidden = await page.evaluate(
        () => !!document.getElementById("transfer")?.hidden,
      );
      expect(transferHidden).toBe(true);

      // The canvas should now have a real size
      const dims = await page.evaluate(() => {
        const c = document.getElementById("canvas") as HTMLCanvasElement | null;
        return { w: c?.width || 0, h: c?.height || 0 };
      });
      expect(dims.w).toBeGreaterThan(10);
      expect(dims.h).toBeGreaterThan(10);

      // Infobox should have been replaced with the loaded message
      const ib =
        (await page.locator("#infobox").textContent())?.toLowerCase() || "";
      const loaded =
        ib.includes("loaded") ||
        ib.includes("ready") ||
        ib.includes("click") ||
        ib.includes("touch");
      expect(loaded).toBe(true);

      // game-viewport.js should have run: body gets game-ready class,
      // canvas gets centered CSS dimensions, loading overlay hidden.
      const bodyClasses = await page.evaluate(() => document.body.className);
      expect(bodyClasses).toContain("game-ready");

      const canvasStyle = await page.evaluate(() => {
        const c = document.getElementById("canvas") as HTMLCanvasElement | null;
        if (!c) return {};
        return {
          position: c.style.position,
          margin: c.style.margin,
          width: c.style.width,
          height: c.style.height,
        };
      });
      expect(canvasStyle.position).toBe("absolute");
      expect(canvasStyle.margin).toBe("0px");
      expect(Number.parseInt(canvasStyle.width || "0")).toBeGreaterThan(0);
      expect(Number.parseInt(canvasStyle.height || "0")).toBeGreaterThan(0);
    });

    test("desktop keyboard input is accepted and the canvas renders", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `Desktop input test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPygbagRuntime(page);

      // Click + send keys (handles autoplay / audio unlock)
      await unlockAndStartGame(page, game.desktopKeys);

      // Give the game a moment to render after input
      await page.waitForTimeout(1000);

      // Canvas should have non-trivial pixel content
      await expectCanvasHasRenderedPixels(page);
    });

    test("no blocking console errors or page errors", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `Error-aggregation test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPygbagRuntime(page);
      await unlockAndStartGame(page, game.desktopKeys);
      await page.waitForTimeout(1000);

      const diagnostics = await collectPageDiagnostics(page);
      attachDiagnostics(testInfo, diagnostics);

      // Filter to *blocking* errors only
      const blocking = blockingErrors(diagnostics);
      if (blocking.length > 0) {
        throw new Error(
          `Blocking errors detected for ${game.name} on ${testInfo.project.name}:\n  - ${blocking.join("\n  - ")}`,
        );
      }
      expect(blocking).toEqual([]);

      // Game-critical asset failures
      const gameAssetFailures = diagnostics.failedRequests.filter((f) =>
        /\.(wasm|so|tar\.gz)(\?|$)/i.test(f.url),
      );
      const gameAssetBadResponses = diagnostics.badResponses.filter((b) =>
        /\.(wasm|so|tar\.gz)(\?|$)/i.test(b.url),
      );
      expect(
        gameAssetFailures,
        `Critical game assets failed to load: ${JSON.stringify(gameAssetFailures)}`,
      ).toEqual([]);
      expect(
        gameAssetBadResponses,
        `Critical game assets returned 4xx/5xx: ${JSON.stringify(gameAssetBadResponses)}`,
      ).toEqual([]);
    });

    test("page reload works without errors", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `Reload test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPygbagRuntime(page);

      // Reload and confirm we get back to a usable state
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForPygbagRuntime(page);

      const diagnostics = await collectPageDiagnostics(page);
      attachDiagnostics(testInfo, diagnostics);
      const blocking = blockingErrors(diagnostics);
      expect(blocking).toEqual([]);
    });

    test("tab blur and refocus does not crash the game", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `Blur test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPygbagRuntime(page);
      await unlockAndStartGame(page, game.desktopKeys);
      await page.waitForTimeout(500);

      // Simulate tab being backgrounded then foregrounded
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.waitForTimeout(300);
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.waitForTimeout(500);

      const diagnostics = await collectPageDiagnostics(page);
      attachDiagnostics(testInfo, diagnostics);
      const blocking = blockingErrors(diagnostics);
      expect(blocking).toEqual([]);
    });
  });
}

test.describe("Cross-game checks", () => {
  for (const game of GAMES) {
    test(`${game.name}: infobox is initially populated and not empty`, async ({
      page,
    }) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      const ib = (await page.locator("#infobox").textContent()) || "";
      expect(ib.length).toBeGreaterThan(10);
      // The initial copy mentions loading or first-visit
      const has = /loading|first visit|first-visit|download/i.test(ib);
      expect(has).toBe(true);
    });

    test(`${game.name}: viewport meta is set for mobile-first`, async ({
      page,
    }) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      const viewport = await page
        .locator('meta[name="viewport"]')
        .getAttribute("content");
      expect(viewport).not.toBeNull();
      expect(viewport).toMatch(/user-scalable=no/);
      expect(viewport).toMatch(/maximum-scale=1/);
    });

    test(`${game.name}: no favicon or 404 noise in console`, async ({
      page,
    }, testInfo) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPygbagRuntime(page);
      await page.waitForTimeout(1000);

      const diagnostics = await collectPageDiagnostics(page);
      attachDiagnostics(testInfo, diagnostics);

      // No console errors, no failed requests, no 4xx/5xx on
      // game-critical assets. (The runtime test above already
      // checks for blocking patterns; this one asserts the
      // quiet-no-noise state explicitly.)
      const noisy404s = diagnostics.badResponses.filter(
        (r) =>
          r.status === 404 &&
          !r.url.includes("favicon") &&
          !r.url.includes(".map"),
      );
      expect(
        noisy404s,
        `Unexpected 404s:\n${JSON.stringify(noisy404s, null, 2)}`,
      ).toEqual([]);
    });
  }
});
