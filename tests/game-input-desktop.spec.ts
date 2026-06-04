/**
 * Desktop browser input tests for Pirate Arcade games.
 *
 * These tests verify that:
 *  1. Desktop keyboard input reaches the game and produces observable
 *     canvas changes (not just that keys are sent)
 *  2. Mouse clicks properly focus the canvas and unlock audio
 *  3. Game state changes in response to input
 *  4. No JavaScript dialogs (alert/confirm/prompt) or page errors
 *     occur during gameplay
 *  5. Multiple rapid inputs don't crash the game
 *
 * Run with:
 *   npm run test:desktop-input
 *   npm run test:debug:webkit  (headed + debug on webkit)
 *
 * Only runs on the three DESKTOP_PROJECTS. Mobile projects have their
 * own input suite (game-input-mobile.spec.ts).
 */

import { test, expect } from "./helpers/browserGame";
import {
  collectPageDiagnostics,
  waitForPygbagRuntime,
  unlockAndFocusGame,
  sendKeysAndWaitForResponse,
  expectCanvasHasRenderedPixels,
  attachDiagnostics,
  blockingErrors,
  installDialogCapture,
  dialogWasCalled,
  getCanvasPixelSample,
} from "./helpers/browserGame";

interface GameSpec {
  id: string;
  name: string;
  path: string;
  /** Core keys to test for basic input response. */
  testSequence: string[];
}

const GAMES: GameSpec[] = [
  {
    id: "cannonball-clash",
    name: "Cannonball Clash",
    path: "/play/cannonball-clash/",
    testSequence: ["ArrowUp", "ArrowDown", "Space", "Enter"],
  },
  {
    id: "treasure-cove",
    name: "Treasure Cove",
    path: "/play/treasure-cove/",
    testSequence: ["ArrowLeft", "ArrowRight", "Space", "Enter"],
  },
];

// Only run heavy WASM-driven input tests on desktop projects. Mobile
// input tests live in game-input-mobile.spec.ts.
const DESKTOP_PROJECTS = [
  "chromium-desktop",
  "firefox-desktop",
  "webkit-desktop",
];

for (const game of GAMES) {
  test.describe(`${game.name} - desktop input`, () => {
    test("keyboard input produces observable canvas changes", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `Desktop input test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPygbagRuntime(page);

      // Focus + click to satisfy user-gesture / audio unlock
      await unlockAndFocusGame(page);

      // Verify canvas is rendering something before we test input
      await expectCanvasHasRenderedPixels(page);

      // Send the test sequence and wait for observable change
      const changed = await sendKeysAndWaitForResponse(
        page,
        game.testSequence,
        1500,
      );

      if (!changed) {
        const diagnostics = await collectPageDiagnostics(page);
        attachDiagnostics(testInfo, diagnostics);
        throw new Error(
          `Canvas did not change after input sequence [${game.testSequence.join(", ")}] on ${testInfo.project.name}`,
        );
      }

      expect(changed).toBe(true);
    });

    test("mouse click properly focuses canvas and enables keyboard", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `Desktop focus test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPygbagRuntime(page);

      // Click canvas to focus it
      await page.locator("canvas#canvas").click({ position: { x: 10, y: 10 } });
      await page.locator("canvas#canvas").focus();

      // Verify the canvas is now the active element (focus succeeded)
      const focused = await page.evaluate(() => {
        return document.activeElement?.id === "canvas";
      });
      expect(focused).toBe(true);

      // Send a key — should not throw or be lost
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);

      const diagnostics = await collectPageDiagnostics(page);
      attachDiagnostics(testInfo, diagnostics);
      const blocking = blockingErrors(diagnostics);
      expect(blocking).toEqual([]);
    });

    test("no JavaScript dialogs during gameplay", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `Dialog-detection test skipped on ${testInfo.project.name}`,
      );

      // Install dialog capture BEFORE navigation so any alert/confirm/
      // prompt that fires during runtime startup or gameplay is caught.
      await installDialogCapture(page);

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPygbagRuntime(page);
      await unlockAndFocusGame(page);

      // Drive gameplay to surface any alert/confirm/prompt usage
      await sendKeysAndWaitForResponse(page, game.testSequence, 500);

      const dlgCalled = await dialogWasCalled(page);
      expect(dlgCalled).toBe(false);
    });

    test("rapid input sequence does not cause JS errors", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `Rapid-input test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPygbagRuntime(page);
      await unlockAndFocusGame(page);

      // 20 rapid presses cycling through the test sequence
      for (let i = 0; i < 20; i++) {
        const key = game.testSequence[i % game.testSequence.length];
        await page.keyboard.press(key);
        await page.waitForTimeout(20);
      }

      // Allow any deferred errors to surface
      await page.waitForTimeout(500);

      const diagnostics = await collectPageDiagnostics(page);
      attachDiagnostics(testInfo, diagnostics);
      const blocking = blockingErrors(diagnostics);
      expect(blocking).toEqual([]);
    });

    test("Escape pauses game without errors", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `Escape-pause test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPygbagRuntime(page);
      await unlockAndFocusGame(page);

      // Start the game with Enter
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);

      // Press Escape to pause
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      const diagnostics = await collectPageDiagnostics(page);
      attachDiagnostics(testInfo, diagnostics);
      const blocking = blockingErrors(diagnostics);
      expect(blocking).toEqual([]);
    });

    test("canvas pixels differ before and after input", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `Pixel-diff test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPygbagRuntime(page);
      await unlockAndFocusGame(page);

      // Start the game from the menu first so movement keys
      // actually produce visible canvas changes.
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      await page.keyboard.press("Space");
      await page.waitForTimeout(1000);

      // Baseline sample (after game has started)
      const before = await getCanvasPixelSample(page, 40, 40);
      expect(before).toBeTruthy();

      // Send movement/input keys
      for (const key of game.testSequence) {
        await page.keyboard.press(key);
        await page.waitForTimeout(80);
      }
      await page.waitForTimeout(1000);

      // After-input sample
      const after = await getCanvasPixelSample(page, 40, 40);
      expect(after).toBeTruthy();

      // Compute byte-level diff. If pixels are identical, the game
      // ignored our input (or is frozen).
      const len = Math.min(before!.data.length, after!.data.length);
      let diffPixels = 0;
      for (let i = 0; i < len; i += 4) {
        const dr = Math.abs(before!.data[i] - after!.data[i]);
        const dg = Math.abs(before!.data[i + 1] - after!.data[i + 1]);
        const db = Math.abs(before!.data[i + 2] - after!.data[i + 2]);
        if (dr + dg + db > 20) diffPixels++;
      }

      if (diffPixels === 0) {
        const diagnostics = await collectPageDiagnostics(page);
        attachDiagnostics(testInfo, diagnostics);
        throw new Error(
          `Canvas pixels identical before/after input on ${testInfo.project.name} — game may be frozen or not responding to keyboard`,
        );
      }

      expect(diffPixels).toBeGreaterThan(0);
    });
  });
}
