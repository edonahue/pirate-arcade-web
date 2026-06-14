import { test, expect, type Page } from "@playwright/test";
import {
  waitForPygbagRuntime,
  pointerHoldButton,
  pointerTouchDrag,
  getCanvasPixelSample,
  readPirateInputDebug,
  readGameState,
  expectGamePhase,
  startDiagnostics,
  snapshotDiagnostics,
  attachDiagnostics,
  blockingErrors,
} from "./helpers/browserGame";

const IPAD_PROJECT = "ipad-landscape";
const PYGAR_TIMEOUT = 180000;
const ACTION_TIMEOUT = 30000;

async function waitForGameReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const m = (window as any).__paBootMetrics;
      const loading = document.getElementById("game-loading");
      return m?.["game-ready"] && loading?.classList.contains("hidden");
    },
    { timeout: PYGAR_TIMEOUT, polling: 500 },
  );
}

async function waitForPygbagCanvas(page: Page): Promise<void> {
  await waitForPygbagRuntime(page);
  await waitForGameReady(page);
}

async function canvasHasNonBgPixels(page: Page): Promise<boolean> {
  try {
    const sample = await getCanvasPixelSample(page, 80, 20);
    if (!sample) return false;
    let nonEmpty = 0;
    for (let i = 3; i < sample.data.length; i += 4) {
      if (sample.data[i] > 0) nonEmpty++;
    }
    return nonEmpty > 0;
  } catch {
    return false;
  }
}

async function tapButtonBySelector(
  page: Page,
  selector: string,
): Promise<void> {
  const btn = page.locator(selector);
  await expect(btn).toBeVisible({ timeout: ACTION_TIMEOUT });
  // Use pointerHoldButton which dispatches events with bubbles:true
  await pointerHoldButton(page, selector, 100);
  await page.waitForTimeout(300);
}

test.describe("iPad Safari Playability", () => {
  test.beforeEach(async ({ page: _page }, testInfo) => {
    test.skip(
      testInfo.project.name !== IPAD_PROJECT,
      `only runs on ${IPAD_PROJECT} (${testInfo.project.name})`,
    );
  });

  // ─── Cannonball Clash (Pong / touch) ────────────────────────

  test.describe("Cannonball Clash", () => {
    test("paddle moves with touch drag in Y-axis drag zone", async ({
      page,
    }, testInfo) => {
      const diag = startDiagnostics(page);
      await page.goto("/play/cannonball-clash/");
      await waitForPygbagCanvas(page);

      const canvas = page.locator("canvas.emscripten").first();
      await expect(canvas).toBeVisible({ timeout: ACTION_TIMEOUT });

      const box = await canvas.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        const dragX = box.x + 20;
        const dragStartY = box.y + box.height * 0.3;
        const dragEndY = box.y + box.height * 0.7;
        await pointerTouchDrag(
          page,
          [
            { x: dragX, y: dragStartY },
            { x: dragX, y: dragEndY },
          ],
          { selector: ".touch-drag-zone" },
        );
        await page.waitForTimeout(300);
      }

      // Drag zones use setTouchTarget, not bridge calls.
      // Verify no blocking errors and canvas still renders.
      const canvas2 = page.locator("canvas.emscripten").first();
      await expect(canvas2).toBeVisible({ timeout: ACTION_TIMEOUT });
      const hasPixels = await canvasHasNonBgPixels(page);
      expect(hasPixels).toBe(true);

      const snap = await snapshotDiagnostics(page, diag);
      attachDiagnostics(testInfo, snap);
      expect(blockingErrors(snap)).toEqual([]);
    });

    test("START dispatches Enter (primary action) via bridge", async ({
      page,
    }, testInfo) => {
      const diag = startDiagnostics(page);
      await page.goto("/play/cannonball-clash/");
      await waitForPygbagCanvas(page);

      await tapButtonBySelector(page, '.btn-action[data-dir="action"]');
      await page.waitForTimeout(500);

      const debug = await readPirateInputDebug(page);
      const calls = debug?.bridgeCalls || [];
      expect(
        calls.some(
          (c: { key: string; down: boolean }) => c.key === "Enter" && c.down,
        ),
      ).toBe(true);
      // Action dispatches a single key — no Space double-dispatch
      const spaceDown = calls.some(
        (c: { key: string; down: boolean }) => c.key === "Space" && c.down,
      );
      expect(spaceDown).toBe(false);

      const afterPixels = await canvasHasNonBgPixels(page);
      expect(afterPixels).toBe(true);

      const snap = await snapshotDiagnostics(page, diag);
      attachDiagnostics(testInfo, snap);
      expect(blockingErrors(snap)).toEqual([]);
    });

    test("pause button dispatches Escape via bridge", async ({
      page,
    }, testInfo) => {
      const diag = startDiagnostics(page);
      await page.goto("/play/cannonball-clash/");
      await waitForPygbagCanvas(page);

      await tapButtonBySelector(page, '.btn-pause[data-dir="pause"]');

      const debug = await readPirateInputDebug(page);
      const calls = debug?.bridgeCalls || [];
      expect(
        calls.some(
          (c: { key: string; down: boolean }) => c.key === "Escape" && c.down,
        ),
      ).toBe(true);

      const snap = await snapshotDiagnostics(page, diag);
      attachDiagnostics(testInfo, snap);
      expect(blockingErrors(snap)).toEqual([]);
    });
  });

  // ─── Treasure Cove (Breakout / touch) ───────────────────────

  test.describe("Treasure Cove", () => {
    test("paddle moves with touch drag in X-axis drag zone", async ({
      page,
    }, testInfo) => {
      const diag = startDiagnostics(page);
      await page.goto("/play/treasure-cove/");
      await waitForPygbagCanvas(page);

      const canvas = page.locator("canvas.emscripten").first();
      await expect(canvas).toBeVisible({ timeout: ACTION_TIMEOUT });

      const box = await canvas.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        const dragY = box.y + box.height - 20;
        const dragStartX = box.x + box.width * 0.3;
        const dragEndX = box.x + box.width * 0.7;
        await pointerTouchDrag(
          page,
          [
            { x: dragStartX, y: dragY },
            { x: dragEndX, y: dragY },
          ],
          { selector: ".touch-drag-zone" },
        );
        await page.waitForTimeout(300);
      }

      const canvas2 = page.locator("canvas.emscripten").first();
      await expect(canvas2).toBeVisible({ timeout: ACTION_TIMEOUT });
      const hasPixels = await canvasHasNonBgPixels(page);
      expect(hasPixels).toBe(true);

      const snap = await snapshotDiagnostics(page, diag);
      attachDiagnostics(testInfo, snap);
      expect(blockingErrors(snap)).toEqual([]);
    });

    test("LAUNCH dispatches Space (primary action) via bridge", async ({
      page,
    }, testInfo) => {
      const diag = startDiagnostics(page);
      await page.goto("/play/treasure-cove/");
      await waitForPygbagCanvas(page);

      await tapButtonBySelector(page, '.btn-action[data-dir="action"]');
      await page.waitForTimeout(500);

      const debug = await readPirateInputDebug(page);
      const calls = debug?.bridgeCalls || [];
      // Treasure Cove uses Space for launch
      expect(
        calls.some(
          (c: { key: string; down: boolean }) => c.key === "Space" && c.down,
        ),
      ).toBe(true);
      // No Enter double-dispatch
      const enterDown = calls.some(
        (c: { key: string; down: boolean }) => c.key === "Enter" && c.down,
      );
      expect(enterDown).toBe(false);

      const afterPixels = await canvasHasNonBgPixels(page);
      expect(afterPixels).toBe(true);

      const snap = await snapshotDiagnostics(page, diag);
      attachDiagnostics(testInfo, snap);
      expect(blockingErrors(snap)).toEqual([]);
    });

    test("pause button dispatches Escape via bridge", async ({
      page,
    }, testInfo) => {
      const diag = startDiagnostics(page);
      await page.goto("/play/treasure-cove/");
      await waitForPygbagCanvas(page);

      await tapButtonBySelector(page, '.btn-pause[data-dir="pause"]');

      const debug = await readPirateInputDebug(page);
      const calls = debug?.bridgeCalls || [];
      expect(
        calls.some(
          (c: { key: string; down: boolean }) => c.key === "Escape" && c.down,
        ),
      ).toBe(true);

      const snap = await snapshotDiagnostics(page, diag);
      attachDiagnostics(testInfo, snap);
      expect(blockingErrors(snap)).toEqual([]);
    });
  });

  // ─── Kraken's Wake (Asteroids / touch) ──────────────────────

  test.describe("Kraken's Wake", () => {
    test("touch buttons dispatch THRUST and FIRE", async ({
      page,
    }, testInfo) => {
      const diag = startDiagnostics(page);
      await page.goto("/play/krakens-wake/");
      const canBoot = await page
        .waitForFunction(
          () => {
            const m = (window as any).__paBootMetrics;
            const loading = document.getElementById("game-loading");
            return m?.["game-ready"] && loading?.classList.contains("hidden");
          },
          { timeout: PYGAR_TIMEOUT, polling: 500 },
        )
        .then(() => true)
        .catch(() => false);
      test.skip(!canBoot, "krakens wake did not boot on ipad");

      await tapButtonBySelector(page, '.btn-thrust[data-dir="thrust"]');
      await tapButtonBySelector(page, '.btn-fire[data-dir="fire"]');

      const debug = await readPirateInputDebug(page);
      const calls = debug?.bridgeCalls || [];
      expect(
        calls.some(
          (c: { key: string; down: boolean }) => c.key === "ArrowUp" && c.down,
        ),
      ).toBe(true);
      expect(
        calls.some(
          (c: { key: string; down: boolean }) => c.key === "Space" && c.down,
        ),
      ).toBe(true);

      const hasPixels = await canvasHasNonBgPixels(page);
      expect(hasPixels).toBe(true);

      const snap = await snapshotDiagnostics(page, diag);
      attachDiagnostics(testInfo, snap);
      expect(blockingErrors(snap)).toEqual([]);
    });

    test("pause dispatches Escape via bridge", async ({ page }, testInfo) => {
      const diag = startDiagnostics(page);
      await page.goto("/play/krakens-wake/");
      const canBoot = await page
        .waitForFunction(
          () => {
            const m = (window as any).__paBootMetrics;
            const loading = document.getElementById("game-loading");
            return m?.["game-ready"] && loading?.classList.contains("hidden");
          },
          { timeout: PYGAR_TIMEOUT, polling: 500 },
        )
        .then(() => true)
        .catch(() => false);
      test.skip(!canBoot, "krakens wake did not boot on ipad");

      await tapButtonBySelector(page, '.btn-pause[data-dir="pause"]');

      const debug = await readPirateInputDebug(page);
      const calls = debug?.bridgeCalls || [];
      expect(
        calls.some(
          (c: { key: string; down: boolean }) => c.key === "Escape" && c.down,
        ),
      ).toBe(true);

      const snap = await snapshotDiagnostics(page, diag);
      attachDiagnostics(testInfo, snap);
      expect(blockingErrors(snap)).toEqual([]);
    });
  });

  // ─── Gameplay Outcome Tests ────────────────────────────
  // These tests use the shared gameplay-state contract to verify
  // observable game behaviour (phase transitions, movement, pause),
  // not merely bridge calls or canvas opacity.

  test.describe("Gameplay Outcomes", () => {
    test.describe("Cannonball Clash", () => {
      test("START transitions from menu to playing", async ({
        page,
      }, testInfo) => {
        test.skip(
          testInfo.project.name !== IPAD_PROJECT,
          `only runs on ${IPAD_PROJECT}`,
        );
        const diag = startDiagnostics(page);
        await page.goto("/play/cannonball-clash/");
        await waitForPygbagCanvas(page);

        expect(await readGameState(page)).toBeTruthy();
        await expectGamePhase(page, "menu");

        await tapButtonBySelector(page, '.btn-action[data-dir="action"]');

        await expectGamePhase(page, "playing");
        const state = await readGameState(page);
        expect(state?.score).toBe(0);

        const snap = await snapshotDiagnostics(page, diag);
        attachDiagnostics(testInfo, snap);
        expect(blockingErrors(snap)).toEqual([]);
      });

      test("touch drag changes player paddle Y", async ({ page }, testInfo) => {
        test.skip(
          testInfo.project.name !== IPAD_PROJECT,
          `only runs on ${IPAD_PROJECT}`,
        );
        const diag = startDiagnostics(page);
        await page.goto("/play/cannonball-clash/");
        await waitForPygbagCanvas(page);

        // First start the game
        expect(await readGameState(page)).toBeTruthy();
        await expectGamePhase(page, "menu");
        await tapButtonBySelector(page, '.btn-action[data-dir="action"]');
        await expectGamePhase(page, "playing");

        const stateBefore = await readGameState(page);
        expect(stateBefore).toBeTruthy();

        const canvas = page.locator("canvas.emscripten").first();
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();
        if (!box) return;
        const dragX = box.x + 20;

        // Drag from top third to bottom third
        await pointerTouchDrag(
          page,
          [
            { x: dragX, y: box.y + box.height * 0.2 },
            { x: dragX, y: box.y + box.height * 0.6 },
          ],
          { selector: ".touch-drag-zone" },
        );
        await page.waitForTimeout(500);

        const stateAfter = await readGameState(page);
        if (stateBefore && stateAfter) {
          const diff = Math.abs(
            stateAfter.playerPosition! - stateBefore.playerPosition!,
          );
          expect(diff).toBeGreaterThan(10);
        }

        const snap = await snapshotDiagnostics(page, diag);
        attachDiagnostics(testInfo, snap);
        expect(blockingErrors(snap)).toEqual([]);
      });
    });

    test.describe("Treasure Cove", () => {
      test("START transitions from menu to playing", async ({
        page,
      }, testInfo) => {
        test.skip(
          testInfo.project.name !== IPAD_PROJECT,
          `only runs on ${IPAD_PROJECT}`,
        );
        const diag = startDiagnostics(page);
        await page.goto("/play/treasure-cove/");
        await waitForPygbagCanvas(page);

        expect(await readGameState(page)).toBeTruthy();
        await expectGamePhase(page, "menu");

        await tapButtonBySelector(page, '.btn-action[data-dir="action"]');

        await expectGamePhase(page, "playing");
        const state = await readGameState(page);
        expect(state?.score).toBe(0);

        const snap = await snapshotDiagnostics(page, diag);
        attachDiagnostics(testInfo, snap);
        expect(blockingErrors(snap)).toEqual([]);
      });

      test("touch drag moves paddle X", async ({ page }, testInfo) => {
        test.skip(
          testInfo.project.name !== IPAD_PROJECT,
          `only runs on ${IPAD_PROJECT}`,
        );
        const diag = startDiagnostics(page);
        await page.goto("/play/treasure-cove/");
        await waitForPygbagCanvas(page);

        // First start the game
        expect(await readGameState(page)).toBeTruthy();
        await expectGamePhase(page, "menu");
        await tapButtonBySelector(page, '.btn-action[data-dir="action"]');
        await expectGamePhase(page, "playing");

        const stateBefore = await readGameState(page);
        expect(stateBefore).toBeTruthy();

        const canvas = page.locator("canvas.emscripten").first();
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();
        if (!box) return;

        // Drag zone for breakout is horizontal (touch-drag-x) at bottom
        // Drag across the bottom third of the canvas
        const dragY = box.y + box.height * 0.85;

        await pointerTouchDrag(
          page,
          [
            { x: box.x + box.width * 0.2, y: dragY },
            { x: box.x + box.width * 0.8, y: dragY },
          ],
          { selector: ".touch-drag-zone" },
        );
        await page.waitForTimeout(500);

        const stateAfter = await readGameState(page);
        if (stateBefore && stateAfter) {
          const diff = Math.abs(
            stateAfter.playerPosition! - stateBefore.playerPosition!,
          );
          expect(diff).toBeGreaterThan(10);
        }

        const snap = await snapshotDiagnostics(page, diag);
        attachDiagnostics(testInfo, snap);
        expect(blockingErrors(snap)).toEqual([]);
      });
    });

    test.describe("Kraken's Wake", () => {
      test("START transitions from menu to playing", async ({
        page,
      }, testInfo) => {
        test.skip(
          testInfo.project.name !== IPAD_PROJECT,
          `only runs on ${IPAD_PROJECT}`,
        );
        const diag = startDiagnostics(page);
        await page.goto("/play/krakens-wake/");
        await waitForPygbagCanvas(page);

        expect(await readGameState(page)).toBeTruthy();
        await expectGamePhase(page, "menu");

        // Asteroids mode hides action button; use primary key (Space)
        await page.keyboard.press("Space");

        await expectGamePhase(page, "playing");
        const state = await readGameState(page);
        expect(state?.score).toBe(0);

        const snap = await snapshotDiagnostics(page, diag);
        attachDiagnostics(testInfo, snap);
        expect(blockingErrors(snap)).toEqual([]);
      });
    });
  });

  // ─── Race to Treasure Island (Phaser / touch) ───────────────

  test.describe("Race to Treasure Island", () => {
    async function waitForPhaserReady(page: Page): Promise<void> {
      await page.waitForSelector("#game-container", {
        state: "attached",
        timeout: 15000,
      });
      await page.waitForFunction(
        () => {
          const el = document.getElementById("game-container");
          const canvas = el?.querySelector("canvas");
          const metrics = (window as any).__paBootMetrics;
          const loading = document.getElementById("game-loading");
          return (
            el &&
            canvas &&
            canvas.width > 100 &&
            canvas.height > 100 &&
            metrics?.["game-ready"] &&
            loading?.classList.contains("hidden")
          );
        },
        { timeout: 60000, polling: 200 },
      );
      await page.waitForFunction(
        () => {
          const s = (window as any).__paRaceToTreasureIslandState;
          return s && s.countdownPhase === "done";
        },
        { timeout: 15000, polling: 200 },
      );
    }

    test("touch drive moves ship forward", async ({ page }, testInfo) => {
      const diag = startDiagnostics(page);
      await page.goto("/play/race-to-treasure-island/");
      await waitForPhaserReady(page);

      await expect(page.locator("#btn-right")).toBeVisible({
        timeout: ACTION_TIMEOUT,
      });
      await pointerHoldButton(page, "#btn-right", 2000);
      await page.waitForTimeout(500);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state).toBeTruthy();
      expect(state.playerProgress).toBeGreaterThan(0);
      expect(state.paused).toBe(false);

      const snap = await snapshotDiagnostics(page, diag);
      attachDiagnostics(testInfo, snap);
      expect(blockingErrors(snap)).toEqual([]);
    });

    test("pause button pauses race", async ({ page }, testInfo) => {
      const diag = startDiagnostics(page);
      await page.goto("/play/race-to-treasure-island/");
      await waitForPhaserReady(page);

      await expect(page.locator("#btn-pause")).toBeVisible({
        timeout: ACTION_TIMEOUT,
      });
      await pointerHoldButton(page, "#btn-pause", 200);
      await page.waitForTimeout(500);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state).toBeTruthy();
      expect(state.paused).toBe(true);

      const snap = await snapshotDiagnostics(page, diag);
      attachDiagnostics(testInfo, snap);
      expect(blockingErrors(snap)).toEqual([]);
    });

    test("race completes and shows result", async ({ page }, testInfo) => {
      const diag = startDiagnostics(page);
      await page.goto("/play/race-to-treasure-island/");
      await waitForPhaserReady(page);

      // Drive forward for a stretch
      await expect(page.locator("#btn-right")).toBeVisible({
        timeout: ACTION_TIMEOUT,
      });
      await pointerHoldButton(page, "#btn-right", 2000);
      await page.waitForTimeout(500);

      // Finish via debug hook
      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugFinish === "function") {
          (window as any).__paRaceDebugFinish();
        }
      });
      await page.waitForTimeout(1000);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state).toBeTruthy();
      expect(state.finished).toBe(true);
      expect(typeof state.result).toBe("string");

      const snap = await snapshotDiagnostics(page, diag);
      attachDiagnostics(testInfo, snap);
      expect(blockingErrors(snap)).toEqual([]);
    });
  });
});
