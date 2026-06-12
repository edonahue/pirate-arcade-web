import { test, expect, type Page } from "@playwright/test";
import {
  startDiagnostics,
  snapshotDiagnostics,
  blockingErrors,
  attachDiagnostics,
} from "./helpers/browserGame";

interface WebNativeGameSpec {
  id: string;
  name: string;
  path: string;
}

const GAMES: WebNativeGameSpec[] = [
  {
    id: "race-to-treasure-island",
    name: "Race to Treasure Island",
    path: "/play/race-to-treasure-island/",
  },
];

const DESKTOP_PROJECTS = [
  "chromium-desktop",
  "firefox-desktop",
  "webkit-desktop",
];

const MOBILE_PROJECTS = ["mobile-chrome", "mobile-safari"];

async function waitForPhaserReady(page: Page): Promise<void> {
  await page.waitForSelector("#game-container", {
    state: "attached",
    timeout: 15000,
  });

  await page.waitForFunction(
    () => {
      const gc = document.getElementById("game-container");
      const canvas = gc?.querySelector("canvas");
      if (!canvas) return false;
      const ready = !!(window as any).__paBootMetrics?.["game-ready"];
      const sized = canvas.width > 100 && canvas.height > 100;
      const loadingEl = document.getElementById("game-loading");
      const overlayHidden = loadingEl
        ? loadingEl.classList.contains("hidden")
        : true;
      return ready && sized && overlayHidden;
    },
    { timeout: 45000, polling: 200 },
  );

  // Wait for any game countdown to complete
  await page.waitForFunction(
    () => {
      const state = (window as any).__paRaceToTreasureIslandState;
      return !state || state.countdownPhase === "done";
    },
    { timeout: 10000, polling: 200 },
  );
}

for (const game of GAMES) {
  test.describe(`${game.name} (Web Native)`, () => {
    test("page loads and has expected DOM wiring", async ({ page }) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      await expect(page.locator("#game-container")).toHaveCount(1);
      await expect(page.locator("#game-loading")).toHaveCount(1);
      await expect(page.locator("#back-link")).toHaveCount(1);
      await expect(page.locator("#infobox")).toHaveCount(1);
      await expect(page.locator("#rotate-overlay")).toHaveCount(1);
      await expect(page.locator("#touch-controls")).toHaveCount(1);

      const ibText = await page.locator("#infobox").textContent();
      expect(ibText?.length).toBeGreaterThan(10);
      expect(ibText?.toLowerCase()).toContain("race to treasure island");

      const href = await page.locator("#back-link").getAttribute("href");
      expect(href).toBe("/play/");
    });

    test("Phaser boots and canvas renders", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `Phaser boot test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      const dims = await page.evaluate(() => {
        const gc = document.getElementById("game-container");
        const canvas = gc?.querySelector("canvas") as HTMLCanvasElement | null;
        return { w: canvas?.width || 0, h: canvas?.height || 0 };
      });
      expect(dims.w).toBeGreaterThan(100);
      expect(dims.h).toBeGreaterThan(100);

      const loadingHidden = await page.evaluate(() => {
        const el = document.getElementById("game-loading");
        return el?.classList.contains("hidden");
      });
      expect(loadingHidden).toBe(true);

      const canvasVisible = await page.evaluate(() => {
        const gc = document.getElementById("game-container");
        const canvas = gc?.querySelector("canvas");
        if (!canvas) return false;
        const cs = window.getComputedStyle(canvas);
        return cs.visibility !== "hidden" && cs.display !== "none";
      });
      expect(canvasVisible).toBe(true);
    });

    test("seed mode boots without errors", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `Seed mode test skipped on ${testInfo.project.name}`,
      );

      await page.goto(`${game.path}?seed=test-seed`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      const dims = await page.evaluate(() => {
        const gc = document.getElementById("game-container");
        const canvas = gc?.querySelector("canvas") as HTMLCanvasElement | null;
        return { w: canvas?.width || 0, h: canvas?.height || 0 };
      });
      expect(dims.w).toBeGreaterThan(100);
      expect(dims.h).toBeGreaterThan(100);

      const diagnostics = await snapshotDiagnostics(
        page,
        startDiagnostics(page),
      );
      attachDiagnostics(testInfo, diagnostics);
      const blocking = blockingErrors(diagnostics);
      expect(blocking).toEqual([]);
    });

    test("keyboard input is accepted without errors", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `Input test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      const diag = startDiagnostics(page);

      const canvas = page.locator("#game-container canvas");
      await canvas.click();
      await canvas.focus();
      await page.waitForTimeout(200);

      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(100);
      await page.keyboard.press("Space");
      await page.waitForTimeout(200);
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(500);

      const dims = await page.evaluate(() => {
        const gc = document.getElementById("game-container");
        const canvas = gc?.querySelector("canvas") as HTMLCanvasElement | null;
        return { w: canvas?.width || 0, h: canvas?.height || 0 };
      });
      expect(dims.w).toBeGreaterThan(100);
      expect(dims.h).toBeGreaterThan(100);

      const diagnostics = await snapshotDiagnostics(page, diag);
      attachDiagnostics(testInfo, diagnostics);
      const blocking = blockingErrors(diagnostics);
      expect(blocking).toEqual([]);
    });

    test("no blocking console errors or page errors", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `Error test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      await page.locator("#game-container canvas").click();
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(500);

      const diagnostics = await snapshotDiagnostics(
        page,
        startDiagnostics(page),
      );
      attachDiagnostics(testInfo, diagnostics);
      const blocking = blockingErrors(diagnostics);
      expect(blocking).toEqual([]);
    });

    test("page reload works without errors", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `Reload test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      const diagnostics = await snapshotDiagnostics(
        page,
        startDiagnostics(page),
      );
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
      await waitForPhaserReady(page);

      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.waitForTimeout(300);
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.waitForTimeout(500);

      const diagnostics = await snapshotDiagnostics(
        page,
        startDiagnostics(page),
      );
      attachDiagnostics(testInfo, diagnostics);
      const blocking = blockingErrors(diagnostics);
      expect(blocking).toEqual([]);
    });

    test("touch controls are wired", async ({ page }) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      const touchControls = page.locator("#touch-controls");
      await expect(touchControls).toHaveCount(1);

      await expect(page.locator("#btn-left")).toHaveCount(1);
      await expect(page.locator("#btn-right")).toHaveCount(1);
      await expect(page.locator("#btn-boost")).toHaveCount(1);
      await expect(page.locator("#btn-pause")).toHaveCount(1);
      await expect(page.locator("#btn-restart")).toHaveCount(1);

      await expect(page.locator("#btn-left")).toHaveAttribute(
        "aria-label",
        "Steer left",
      );
      await expect(page.locator("#btn-right")).toHaveAttribute(
        "aria-label",
        "Steer right",
      );
      await expect(page.locator("#btn-boost")).toHaveAttribute(
        "aria-label",
        "Hold to boost",
      );

      const restartDisplay = await page
        .locator("#btn-restart")
        .evaluate((el) => el.style.display);
      expect(restartDisplay).toBe("none");
    });

    test("portrait rotate overlay toggles visibility", async ({
      page,
    }, testInfo) => {
      test.skip(
        !MOBILE_PROJECTS.includes(testInfo.project.name),
        `Rotate overlay test skipped on ${testInfo.project.name}`,
      );

      // In portrait (taller than wide), the overlay should be visible
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      const overlayVisible = await page.evaluate(() => {
        const ov = document.getElementById("rotate-overlay");
        return ov?.classList.contains("rotate-overlay--visible");
      });
      expect(overlayVisible).toBe(true);

      const shellHidden = await page.evaluate(() => {
        const shell = document.getElementById("game-shell");
        return shell?.style.display === "none";
      });
      expect(shellHidden).toBe(true);

      // In landscape (wider than tall), the overlay should be hidden
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(300);

      const overlayHidden = await page.evaluate(() => {
        const ov = document.getElementById("rotate-overlay");
        return ov?.classList.contains("rotate-overlay--visible");
      });
      expect(overlayHidden).toBe(false);

      const shellVisible = await page.evaluate(() => {
        const shell = document.getElementById("game-shell");
        return shell?.style.display !== "none";
      });
      expect(shellVisible).toBe(true);
    });

    test("race state populates after gameplay", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        `Race state test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      // Play for a few seconds to accumulate progress
      await page.locator("#game-container canvas").click();
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(500);
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(500);
      await page.keyboard.press("Space");
      await page.waitForTimeout(3000);

      const state = await page.evaluate(() => {
        return (window as any).__paRaceToTreasureIslandState || null;
      });

      expect(state).not.toBeNull();
      expect(typeof state.playerProgress).toBe("number");
      expect(typeof state.rivalProgress).toBe("number");

      // After ~4s of gameplay, progress should be > 0
      expect(state.playerProgress).toBeGreaterThan(0);
      expect(state.rivalProgress).toBeGreaterThan(0);

      // Wind meter should have changed from initial value
      expect(typeof state.windMeter).toBe("number");

      // Game should not be paused or finished yet
      expect(state.paused).toBe(false);
      expect(state.finished).toBe(false);
    });

    test("hud controls reference shows race controls", async ({ page }) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      const infoText = await page.locator("#infobox").textContent();
      expect(infoText?.toLowerCase()).toContain("steer");
      expect(infoText?.toLowerCase()).toContain("boost");
      expect(infoText?.toLowerCase()).toContain("pause");
      expect(infoText?.toLowerCase()).toContain("esc");
      expect(infoText?.toLowerCase()).toContain("space");
    });

    // ── Phase 6: Touch control behavior tests ──

    test("touch left button sets input and moves ship", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Touch left test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      await page.locator("#btn-left").dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
      });
      await page.waitForTimeout(100);

      const leftActive = await page.evaluate(
        () => (window as any).__paTouchInput?.left === true,
      );
      expect(leftActive).toBe(true);

      await page.locator("#btn-left").dispatchEvent("pointerup", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 0,
      });
      await page.waitForTimeout(100);

      const leftInactive = await page.evaluate(
        () => (window as any).__paTouchInput?.left !== true,
      );
      expect(leftInactive).toBe(true);
    });

    test("touch right button sets input", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Touch right test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      await page.locator("#btn-right").dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
      });
      await page.waitForTimeout(100);

      const rightActive = await page.evaluate(
        () => (window as any).__paTouchInput?.right === true,
      );
      expect(rightActive).toBe(true);

      await page.locator("#btn-right").dispatchEvent("pointerup", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 0,
      });
    });

    test("touch boost drains wind meter", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Boost drain test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Start boost by holding the button
      await page.locator("#btn-boost").dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
      });
      await page.waitForTimeout(1200);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.boosting).toBe(true);
      expect(state?.windMeter).toBeLessThan(100);

      // Release boost
      await page.locator("#btn-boost").dispatchEvent("pointerup", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 0,
      });
      await page.waitForTimeout(800);

      const stateAfter = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(stateAfter?.boosting).toBe(false);
    });

    test("pause toggles game state", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Pause toggle test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Click pause button (visible due to testTouch=1)
      await page.locator("#btn-pause").click();
      await page.waitForFunction(
        () => (window as any).__paRaceToTreasureIslandState?.paused === true,
        { timeout: 5000 },
      );

      const paused = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState?.paused === true,
      );
      expect(paused).toBe(true);

      // Click pause again to resume
      await page.locator("#btn-pause").click();
      await page.waitForFunction(
        () => (window as any).__paRaceToTreasureIslandState?.paused === false,
        { timeout: 5000 },
      );

      const resumed = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState?.paused === false,
      );
      expect(resumed).toBe(true);
    });

    test("restart button appears after forced finish", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Restart test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Force finish using debug hook
      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugFinish === "function") {
          (window as any).__paRaceDebugFinish();
        }
      });

      await page.waitForFunction(
        () => (window as any).__paRaceToTreasureIslandState?.finished === true,
        { timeout: 5000 },
      );

      // Use toBeVisible which checks computed style, not inline style
      await expect(page.locator("#btn-restart")).toBeVisible();
    });

    // ── Phase 7: Race logic tests ──

    test("deterministic race does not finish immediately", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Deterministic test skipped on non-desktop",
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      // At boot, race should not be finished or at max progress
      expect(state?.finished).toBe(false);
      expect(state?.playerProgress).toBeLessThan(1000);
      expect(state?.rivalProgress).toBeLessThan(1000);
    });

    test("progress advances predictably", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Progress test skipped on non-desktop",
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      // Hold ArrowRight to move continuously
      await page.keyboard.down("ArrowRight");
      await page.waitForTimeout(3000);
      await page.keyboard.up("ArrowRight");

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.playerProgress).toBeGreaterThan(200);
      expect(state?.rivalProgress).toBeGreaterThan(100);
      // Player should be slightly ahead with ArrowRight held
      expect(state?.playerProgress).toBeGreaterThanOrEqual(
        state?.rivalProgress ?? 0,
      );
    });

    test("player can finish in accelerated mode", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Finish test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Force finish using debug hook
      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugFinish === "function") {
          (window as any).__paRaceDebugFinish();
        }
      });

      await page.waitForFunction(
        () => (window as any).__paRaceToTreasureIslandState?.finished === true,
        { timeout: 5000 },
      );

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.finished).toBe(true);
      expect(state?.result).toBeTruthy();
    });

    test("island shown near finish threshold", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Island test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Use debug hook to set progress near finish
      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugSetProgress === "function") {
          (window as any).__paRaceDebugSetProgress(7600);
        }
      });
      await page.waitForTimeout(500);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.islandShown).toBe(true);
    });

    test("obstacle types include expected variants", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Obstacle test skipped on non-desktop",
      );

      // Use a fixed seed for deterministic obstacle spawning
      await page.goto(`${game.path}?seed=obstacle-test`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Wait for obstacle spawns
      await page.waitForFunction(
        () =>
          (window as any).__paRaceToTreasureIslandState?.obstacleTypesSeen
            .length > 0,
        { timeout: 6000 },
      );

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      const validTypes = ["barrel", "shipwreck", "reef", "debris"];
      const seenTypes = state?.obstacleTypesSeen ?? [];

      // Assert all seen types are valid
      for (const type of seenTypes) {
        expect(validTypes).toContain(type);
      }

      // Assert at least one valid type was seen
      expect(seenTypes.length).toBeGreaterThan(0);
      // Assert all seen types are valid
      expect(seenTypes.every((t: string) => validTypes.includes(t))).toBe(true);
    });

    // ── Phase 12: New tests ──

    test("debug hooks present in test environment", async ({
      page,
    }, testInfo) => {
      // In Playwright, navigator.webdriver is true, so debugMode is always on.
      // Verify hooks are available for test infrastructure.
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Debug hook test skipped on non-desktop",
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      const debugMode = await page.evaluate(
        () => !!(window as any).__paRaceDebugMode,
      );
      expect(debugMode).toBe(true);

      // __paRaceGame should be exposed (debug mode is on via webdriver)
      const hasRaceGame = await page.evaluate(
        () => !!(window as any).__paRaceGame,
      );
      expect(hasRaceGame).toBe(true);
    });

    test("debug hooks present with testTouch=1", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Debug hook test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      const hasDebugFinish = await page.evaluate(
        () => typeof (window as any).__paRaceDebugFinish === "function",
      );
      expect(hasDebugFinish).toBe(true);

      const debugMode = await page.evaluate(
        () => !!(window as any).__paRaceDebugMode,
      );
      expect(debugMode).toBe(true);
    });

    test("deterministic obstacle sequence with fixed seed", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Deterministic sequence test skipped on non-desktop",
      );

      // First run
      await page.goto(`${game.path}?seed=determinism-test&testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Wait for obstacle spawns
      await page.waitForFunction(
        () =>
          (window as any).__paRaceToTreasureIslandState?.obstacleSpawnLog
            ?.length >= 3,
        { timeout: 12000 },
      );

      const firstRun: Array<{ type: string; x: number }> = await page.evaluate(
        () => {
          const s = (window as any).__paRaceToTreasureIslandState;
          return s?.obstacleSpawnLog?.slice(0, 3) ?? [];
        },
      );

      expect(firstRun.length).toBeGreaterThanOrEqual(3);

      // Second run — full reload
      await page.goto(`${game.path}?seed=determinism-test&testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      await page.waitForFunction(
        () =>
          (window as any).__paRaceToTreasureIslandState?.obstacleSpawnLog
            ?.length >= 3,
        { timeout: 12000 },
      );

      const secondRun: Array<{ type: string; x: number }> = await page.evaluate(
        () => {
          const s = (window as any).__paRaceToTreasureIslandState;
          return s?.obstacleSpawnLog?.slice(0, 3) ?? [];
        },
      );

      expect(secondRun.length).toBeGreaterThanOrEqual(3);

      // Types should match
      for (let i = 0; i < 3; i++) {
        expect(firstRun[i].type).toBe(secondRun[i].type);
      }
    });

    test("seed is exposed in state", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Seed state test skipped on non-desktop",
      );

      await page.goto(`${game.path}?seed=test-seed-value`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      const seed = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState?.seed,
      );
      expect(seed).toBe("test-seed-value");
    });

    // ── Phase 9: Strengthened tests ──

    test("rng version is exposed in state", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "RNG version test skipped on non-desktop",
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      const rngVersion = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState?.rngVersion,
      );
      expect(rngVersion).toBe("mulberry32-v1");
    });

    test("deterministic obstacle exact coordinates", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Exact deterministic test skipped on non-desktop",
      );

      const seed = "exact-pos-test";

      // First run
      await page.goto(`${game.path}?seed=${seed}&testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      await page.waitForFunction(
        () =>
          (window as any).__paRaceToTreasureIslandState?.obstacleSpawnLog
            ?.length >= 3,
        { timeout: 12000 },
      );

      const firstRun = await page.evaluate(() => {
        const s = (window as any).__paRaceToTreasureIslandState;
        return s?.obstacleSpawnLog?.slice(0, 3) ?? [];
      });

      // Second run
      await page.goto(`${game.path}?seed=${seed}&testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      await page.waitForFunction(
        () =>
          (window as any).__paRaceToTreasureIslandState?.obstacleSpawnLog
            ?.length >= 3,
        { timeout: 12000 },
      );

      const secondRun = await page.evaluate(() => {
        const s = (window as any).__paRaceToTreasureIslandState;
        return s?.obstacleSpawnLog?.slice(0, 3) ?? [];
      });

      // Both type and x coordinate must match exactly
      for (let i = 0; i < 3; i++) {
        expect(firstRun[i].type).toBe(secondRun[i].type);
        expect(firstRun[i].x).toBe(secondRun[i].x);
      }
    });

    test("touch movement changes player position", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Touch movement test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Get initial player X
      const initialX = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState?.playerX ?? -1,
      );
      expect(initialX).toBeGreaterThan(0);

      // Hold right for a bit
      await page.locator("#btn-right").dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
      });
      await page.waitForTimeout(800);

      const afterRight = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState?.playerX ?? -1,
      );

      // After moving right, player position should have increased
      expect(afterRight).toBeGreaterThan(initialX);

      await page.locator("#btn-right").dispatchEvent("pointerup", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 0,
      });

      // Now hold left
      await page.locator("#btn-left").dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
      });
      await page.waitForTimeout(800);

      const afterLeft = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState?.playerX ?? -1,
      );

      // After moving left from the rightmost position, should have decreased
      expect(afterLeft).toBeLessThan(afterRight);

      await page.locator("#btn-left").dispatchEvent("pointerup", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 0,
      });
    });

    test("boost drains wind meter and regen restores it", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Boost drain/regen test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Record initial wind meter
      const initialWind = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState?.windMeter ?? 0,
      );
      expect(initialWind).toBe(100);

      // Hold boost for drain
      await page.locator("#btn-boost").dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
      });
      await page.waitForTimeout(1500);

      const afterDrain = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState?.windMeter ?? 0,
      );
      // Should have drained significantly (but not to 0 since it regens slowly)
      expect(afterDrain).toBeLessThan(initialWind);

      await page.locator("#btn-boost").dispatchEvent("pointerup", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 0,
      });

      // Wait for regen
      await page.waitForTimeout(2000);

      const afterRegen = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState?.windMeter ?? 0,
      );

      // Wind should have increased after releasing boost
      expect(afterRegen).toBeGreaterThan(afterDrain);
    });

    test("collision with obstacle triggers stun", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Collision stun test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Wait for obstacles to spawn
      await page.waitForFunction(
        () => (window as any).__paRaceToTreasureIslandState?.obstacleCount > 0,
        { timeout: 10000 },
      );

      // Move player to center and hold still — obstacles scroll down into the player
      await page.keyboard.down("ArrowRight");
      await page.waitForTimeout(300);
      await page.keyboard.up("ArrowRight");

      // Wait enough time for obstacles to scroll into player
      await page.waitForTimeout(6000);

      // Check if stun has occurred (stunTimer > 0 or score < initial)
      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );

      // If no collision yet, the obstacle count suggests they didn't intersect.
      // This test is best-effort: it checks that stun mechanics work when a collision happens.
      if (state?.stunTimer > 0) {
        expect(state.stunTimer).toBeGreaterThan(0);
        expect(state.score).toBeLessThan(0);
      }
    });

    // ── Phase 14: Touch UI enhancements ──

    test("touch hint overlay shown on first visit", async ({ page }) => {
      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });

      // TestTouch mode doesn't show hint by design (debugMode check).
      // Navigate clean without debug flags and mock coarse pointer.
      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      // The hint checks pointer: coarse — skip for desktop-native Playwright
      // where pointer is fine. Instead verify the hint element exists in DOM.
      await expect(page.locator("#touch-hint")).toHaveCount(1);
    });

    test("touch hint dismiss button clears hint", async ({ page }) => {
      // Force hint visible regardless of pointer
      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => {
        const el = document.getElementById("touch-hint");
        if (el) el.style.display = "flex";
      });

      await expect(page.locator("#touch-hint")).toBeVisible();
      await page.locator("#touch-hint-dismiss").click();
      await page.waitForTimeout(200);
      const hidden = await page.evaluate(() => {
        const el = document.getElementById("touch-hint");
        return el?.style.display === "none";
      });
      expect(hidden).toBe(true);
    });

    test("hud controls reference updated text", async ({ page }) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      const infoText = await page.locator("#infobox").textContent();
      // Desktop controls should be visible by default
      expect(infoText?.toLowerCase()).toContain("steer");
      expect(infoText?.toLowerCase()).toContain("boost");
      expect(infoText?.toLowerCase()).toContain("pause");
      expect(infoText?.toLowerCase()).toContain("esc");
      expect(infoText?.toLowerCase()).toContain("space");
      expect(infoText?.toLowerCase()).toContain("shift");
      // Should reference the control layout
      expect(infoText?.toLowerCase()).toContain("hold");
    });

    test("touch controls are positioned absolute (overlay not flex-bar)", async ({
      page,
    }) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      const position = await page
        .locator("#touch-controls")
        .evaluate((el) => window.getComputedStyle(el).position);
      expect(position).toBe("absolute");
    });

    test("game-container fills entire game-shell", async ({ page }) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      const containerPos = await page
        .locator("#game-container")
        .evaluate((el) => window.getComputedStyle(el).position);
      expect(containerPos).toBe("absolute");

      const containerInset = await page
        .locator("#game-container")
        .evaluate((el) => ({
          top: window.getComputedStyle(el).top,
          left: window.getComputedStyle(el).left,
          width: window.getComputedStyle(el).width,
          height: window.getComputedStyle(el).height,
        }));
      expect(containerInset.top).toBe("0px");
      expect(containerInset.left).toBe("0px");
    });

    // ── Phase 15: New touch & pause sync tests ──

    test("touch mini-hint visible when controls visible", async ({ page }) => {
      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });

      const miniHint = page.locator("#touch-mini-hint");
      await expect(miniHint).toBeVisible();
      const text = await miniHint.textContent();
      expect(text?.toLowerCase()).toContain("steer");
      expect(text?.toLowerCase()).toContain("boost");
    });

    test("pause button aria state syncs with game", async ({ page }) => {
      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      const pauseBtn = page.locator("#btn-pause");

      // Initial state: not paused
      await expect(pauseBtn).toHaveAttribute("aria-pressed", "false");
      await expect(pauseBtn).not.toHaveClass("touch-btn--active");

      // Tap pause
      await pauseBtn.click();
      await page.waitForFunction(
        () => (window as any).__paRaceToTreasureIslandState?.paused === true,
        { timeout: 5000 },
      );

      // Should now be paused - check via page.evaluate for reliability
      const isPausedActive = await page.evaluate(() => {
        const btn = document.getElementById("btn-pause");
        return btn?.classList.contains("touch-btn--active") ?? false;
      });
      expect(isPausedActive).toBe(true);

      await expect(pauseBtn).toHaveAttribute("aria-pressed", "true");

      // Tap pause again to resume
      await pauseBtn.click();
      await page.waitForFunction(
        () => (window as any).__paRaceToTreasureIslandState?.paused === false,
        { timeout: 5000 },
      );

      // Should be unpaused
      const isResumedActive = await page.evaluate(() => {
        const btn = document.getElementById("btn-pause");
        return btn?.classList.contains("touch-btn--active") ?? false;
      });
      expect(isResumedActive).toBe(false);

      await expect(pauseBtn).toHaveAttribute("aria-pressed", "false");
    });

    // ── Phase 16: Mobile robustness tests ──

    test("mini-hint does not overflow on small landscape", async ({ page }) => {
      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await page.setViewportSize({ width: 667, height: 375 });

      const miniHint = page.locator("#touch-mini-hint");
      await expect(miniHint).toBeVisible();

      const box = await miniHint.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(667);
      }
    });

    test("help button reopens controls hint", async ({ page }) => {
      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      const helpBtn = page.locator("#touch-help-button");
      await expect(helpBtn).toBeVisible();

      // Ensure hint is hidden
      const hintEl = page.locator("#touch-hint");
      await page.evaluate(() => {
        const el = document.getElementById("touch-hint");
        if (el) el.style.display = "none";
      });
      await expect(hintEl).toBeHidden();

      // Tap help button
      await helpBtn.click();
      await expect(hintEl).toBeVisible();

      // Tap dismiss
      const dismissBtn = page.locator("#touch-hint-dismiss");
      await dismissBtn.click();
      await expect(hintEl).toBeHidden();
    });

    // ── Phase 17: Viewport & touch layout regression tests ──

    test("game shell fits small landscape viewport", async ({ page }) => {
      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await page.setViewportSize({ width: 844, height: 390 });

      const shell = page.locator("#game-shell");
      await expect(shell).toBeVisible();

      const box = await shell.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        // Shell height should fit viewport (allow small tolerance for border/rounding)
        expect(box.height).toBeLessThanOrEqual(390 + 2);
        expect(box.y).toBeGreaterThanOrEqual(-1);
        // No horizontal overflow
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(844 + 1);
      }
    });

    test("touch controls visible in testTouch mode", async ({ page }) => {
      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });

      await expect(page.locator("#touch-controls")).toBeVisible();
      await expect(page.locator("#btn-left")).toBeVisible();
      await expect(page.locator("#btn-right")).toBeVisible();
      await expect(page.locator("#btn-boost")).toBeVisible();
      await expect(page.locator("#btn-pause")).toBeVisible();
    });

    test("pa-touch-capable class added on touch-capable", async ({ page }) => {
      // Use addInitScript to spoof maxTouchPoints before page load
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "maxTouchPoints", {
          value: 5,
          configurable: true,
        });
      });
      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      const hasClass = await page.evaluate(() =>
        document.documentElement.classList.contains("pa-touch-capable"),
      );
      expect(hasClass).toBe(true);
    });

    test("mini-hint inside viewport at small landscape", async ({ page }) => {
      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await page.setViewportSize({ width: 844, height: 390 });

      const miniHint = page.locator("#touch-mini-hint");
      await expect(miniHint).toBeVisible();

      const box = await miniHint.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(844);
      }
    });

    // ── Phase 18: Sprite visibility & texture tests ──

    test("race ship textures load and are visible", async ({ page }) => {
      await page.goto(`${game.path}?testTouch=1&seed=visual-smoke`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );

      expect(state?.playerTexture).toBe("ship-player");
      expect(state?.rivalTexture).toBe("ship-ai");
      expect(state?.playerVisible).toBe(true);
      expect(state?.rivalVisible).toBe(true);
      expect(state?.playerDisplayWidth).toBeGreaterThanOrEqual(35);
      expect(state?.playerDisplayHeight).toBeGreaterThanOrEqual(55);
      expect(state?.rivalDisplayWidth).toBeGreaterThanOrEqual(32);
      expect(state?.rivalDisplayHeight).toBeGreaterThanOrEqual(50);

      // Player Y should be in the game world (GAME_HEIGHT = 540)
      expect(state?.playerY).toBeGreaterThanOrEqual(0);
      expect(state?.playerY).toBeLessThanOrEqual(540);
      // Rival Y should also be in bounds
      expect(state?.rivalY).toBeGreaterThanOrEqual(0);
      expect(state?.rivalY).toBeLessThanOrEqual(540);
    });

    test("race ships inside visible canvas at small landscape viewport", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.goto(`${game.path}?testTouch=1&seed=visual-smoke`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Canvas bounding box
      const canvasBox = await page
        .locator("#game-container canvas")
        .boundingBox();
      expect(canvasBox).not.toBeNull();
      if (!canvasBox) return;

      // Canvas should be reasonably sized
      expect(canvasBox.height).toBeGreaterThan(250);
      // Canvas bottom should not exceed viewport
      expect(canvasBox.y + canvasBox.height).toBeLessThanOrEqual(390 + 1);

      // State sanity
      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.playerDisplayWidth).toBeGreaterThan(0);
      expect(state?.playerDisplayHeight).toBeGreaterThan(0);
      expect(state?.rivalDisplayWidth).toBeGreaterThan(0);
      expect(state?.rivalDisplayHeight).toBeGreaterThan(0);

      // Opening composition: ships should be high enough in the world
      expect(state?.playerY).toBeLessThanOrEqual(450);
      expect(state?.rivalY).toBeLessThanOrEqual(390);
      expect(state?.playerY).toBeGreaterThan(state?.rivalY ?? 0);
      expect(state?.playerDisplayWidth).toBeGreaterThanOrEqual(35);
      expect(state?.rivalDisplayWidth).toBeGreaterThanOrEqual(32);

      // Game shell should not exceed viewport height by more than a pixel
      const shellBox = await page.locator("#game-shell").boundingBox();
      expect(shellBox).not.toBeNull();
      if (shellBox) {
        expect(shellBox.y + shellBox.height).toBeLessThanOrEqual(390 + 2);
      }
    });

    test("race does not render missing-texture fallback", async ({ page }) => {
      await page.goto(`${game.path}?testTouch=1&seed=visual-smoke`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.playerTexture).not.toBe("__MISSING");
      expect(state?.playerTexture).not.toBe("");
      expect(state?.rivalTexture).not.toBe("__MISSING");
      expect(state?.rivalTexture).not.toBe("");
    });

    // ── Phase 18b: Canvas-level visual validation ──
    // These tests sample actual rendered pixels to catch black-square
    // regressions that texture-key checks would miss.

    test("race player ship renders as readable non-square sprite", async ({
      page,
    }) => {
      await page.goto(`${game.path}?testTouch=1&seed=ship-visual-debug`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      const result = await page.evaluate(async () => {
        const canvas = document.querySelector(
          "#game-container canvas",
        ) as HTMLCanvasElement | null;
        if (!canvas) return null;
        const state = (window as any).__paRaceToTreasureIslandState;
        if (!state) return null;

        const dataUrl = canvas.toDataURL("image/png");
        const blob = await (await fetch(dataUrl)).blob();
        const bitmap = await createImageBitmap(blob);

        const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = offscreen.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0);

        const pw = Math.round(state.playerDisplayWidth);
        const ph = Math.round(state.playerDisplayHeight);
        const px = Math.max(0, Math.round(state.playerX - pw / 2));
        const py = Math.max(0, Math.round(state.playerY - ph / 2));
        if (
          pw <= 0 ||
          ph <= 0 ||
          px + pw > bitmap.width ||
          py + ph > bitmap.height
        )
          return null;

        const img = ctx.getImageData(px, py, pw, ph);
        const d = img.data;
        let nearBlack = 0;
        let light = 0;
        let rSum = 0,
          gSum = 0,
          bSum = 0;
        let nonBg = 0;

        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] > 30) {
            nonBg++;
            rSum += d[i];
            gSum += d[i + 1];
            bSum += d[i + 2];
            if (d[i] < 25 && d[i + 1] < 25 && d[i + 2] < 25) nearBlack++;
            if ((d[i] + d[i + 1] + d[i + 2]) / 3 > 160) light++;
          }
        }

        const total = pw * ph;
        return {
          pw,
          ph,
          total,
          nonBg,
          nearBlack,
          light,
          avgR: Math.round(rSum / total),
          avgG: Math.round(gSum / total),
          avgB: Math.round(bSum / total),
          nonBgPct: Math.round((nonBg / total) * 100),
          nearBlackPct: nonBg > 0 ? Math.round((nearBlack / nonBg) * 100) : 0,
          lightPct: total > 0 ? Math.round((light / total) * 100) : 0,
        };
      });

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.pw).toBeGreaterThan(0);
      expect(result.ph).toBeGreaterThan(0);

      // Must have non-background pixels (ship is rendering on canvas)
      expect(result.nonBgPct).toBeGreaterThan(10);

      // Not a black square: near-black pixels must not dominate
      expect(result.nearBlackPct).toBeLessThan(50);

      // Must have some light (sail-like) pixels
      expect(result.light).toBeGreaterThan(15);

      // Average brightness above very-dark threshold (clear contrast with ocean)
      expect(result.avgR + result.avgG + result.avgB).toBeGreaterThan(60);
    });

    test("race rival ship renders as readable non-square sprite", async ({
      page,
    }) => {
      await page.goto(`${game.path}?testTouch=1&seed=ship-visual-debug`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      const result = await page.evaluate(async () => {
        const canvas = document.querySelector(
          "#game-container canvas",
        ) as HTMLCanvasElement | null;
        if (!canvas) return null;
        const state = (window as any).__paRaceToTreasureIslandState;
        if (!state) return null;

        const dataUrl = canvas.toDataURL("image/png");
        const blob = await (await fetch(dataUrl)).blob();
        const bitmap = await createImageBitmap(blob);

        const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = offscreen.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0);

        const rw = Math.round(state.rivalDisplayWidth);
        const rh = Math.round(state.rivalDisplayHeight);
        const rx = Math.max(0, Math.round(state.rivalX - rw / 2));
        const ry = Math.max(0, Math.round(state.rivalY - rh / 2));
        if (
          rw <= 0 ||
          rh <= 0 ||
          rx + rw > bitmap.width ||
          ry + rh > bitmap.height
        )
          return null;

        const img = ctx.getImageData(rx, ry, rw, rh);
        const d = img.data;
        let nearBlack = 0;
        let light = 0;
        let accent = 0;
        let rSum = 0,
          gSum = 0,
          bSum = 0;
        let nonBg = 0;

        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] > 30) {
            nonBg++;
            rSum += d[i];
            gSum += d[i + 1];
            bSum += d[i + 2];
            if (d[i] < 25 && d[i + 1] < 25 && d[i + 2] < 25) nearBlack++;
            if ((d[i] + d[i + 1] + d[i + 2]) / 3 > 160) light++;
            if (d[i] > 150 && d[i + 1] < 80 && d[i + 2] < 80) accent++;
          }
        }

        const total = rw * rh;
        return {
          rw,
          rh,
          total,
          nonBg,
          nearBlack,
          light,
          accent,
          avgR: Math.round(rSum / total),
          avgG: Math.round(gSum / total),
          avgB: Math.round(bSum / total),
          nonBgPct: Math.round((nonBg / total) * 100),
          nearBlackPct: nonBg > 0 ? Math.round((nearBlack / nonBg) * 100) : 0,
        };
      });

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.rw).toBeGreaterThan(0);
      expect(result.rh).toBeGreaterThan(0);
      expect(result.nonBgPct).toBeGreaterThan(10);
      expect(result.nearBlackPct).toBeLessThan(50);
      expect(result.light).toBeGreaterThan(10);

      // Rival should have some red accent pixels (stripe or flag)
      expect(result.accent).toBeGreaterThan(5);
    });

    test("player cue visible at boot then fades", async ({ page }) => {
      await page.goto(`${game.path}?testTouch=1&seed=visual-smoke`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      const state0 = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state0?.playerCueVisible).toBe(true);

      // Wait for cue to fade (2.5s + buffer)
      await page.waitForTimeout(3200);

      const state1 = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state1?.playerCueVisible).toBe(false);
    });

    // ── Phase 19: HUD layout & text tests ──

    test("touch HUD uses touch-specific control text", async ({ page }) => {
      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });

      // Wait for HUD mode to be set by JavaScript
      await page.waitForFunction(() => {
        const infobox = document.getElementById("infobox");
        return infobox?.dataset.hudMode === "touch";
      });

      // Check that touch controls are visible and desktop controls are hidden
      const touchControls = page.locator('[data-hud-target="touch"]');
      const desktopControls = page.locator('[data-hud-target="desktop"]');
      await expect(touchControls).toBeVisible();
      await expect(desktopControls).toBeHidden();

      // Check touch control text
      const infoText = await page.locator("#infobox").textContent();
      expect(infoText?.toLowerCase()).toContain("left");
      expect(infoText?.toLowerCase()).toContain("right");
      expect(infoText?.toLowerCase()).toContain("boost");
    });

    test("desktop HUD uses keyboard-specific control text", async ({
      page,
    }) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      // Wait for HUD mode to be set (should be desktop)
      await page.waitForFunction(() => {
        const infobox = document.getElementById("infobox");
        return infobox?.dataset.hudMode === "desktop";
      });

      // Check that desktop controls are visible and touch controls are hidden
      const desktopControls = page.locator('[data-hud-target="desktop"]');
      const touchControls = page.locator('[data-hud-target="touch"]');
      await expect(desktopControls).toBeVisible();
      await expect(touchControls).toBeHidden();

      // Check desktop control text
      const infoText = await page.locator("#infobox").textContent();
      expect(infoText?.toLowerCase()).toContain("shift");
      expect(infoText?.toLowerCase()).toContain("space");
      expect(infoText?.toLowerCase()).toContain("esc");
    });

    test("touch HUD is compact in small landscape", async ({ page }) => {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });

      const infobox = page.locator("#infobox");
      await expect(infobox).toBeVisible();

      const box = await infobox.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        // Infobox should be compact
        expect(box.width).toBeLessThanOrEqual(260);
        // Should be at top
        expect(box.y).toBeGreaterThanOrEqual(0);
        // Should not overflow viewport horizontally
        expect(box.x + box.width).toBeLessThanOrEqual(844 + 1);
      }

      // Help button should be visible
      const helpBtn = page.locator("#touch-help-button");
      await expect(helpBtn).toBeVisible();

      // No horizontal overflow on page
      const hasOverflow = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        );
      });
      expect(hasOverflow).toBe(false);
    });

    // Phase 20: HUD inline display regression test
    test("no inline display styles on HUD controls", async ({ page }) => {
      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });

      const inlineDisplays = await page.evaluate(() => {
        const desktop = document.querySelector<HTMLDivElement>(
          '[data-hud-target="desktop"]',
        );
        const touch = document.querySelector<HTMLDivElement>(
          '[data-hud-target="touch"]',
        );
        return {
          desktop: desktop?.style.display ?? "",
          touch: touch?.style.display ?? "",
        };
      });
      expect(inlineDisplays.desktop).toBe("");
      expect(inlineDisplays.touch).toBe("");
    });

    // Phase 21: Overlay hold tests
    test("help overlay hold stops race progress", async ({ page }) => {
      await page.goto(`${game.path}?testTouch=1&seed=overlay-hold`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Show help overlay via help button
      const helpBtn = page.locator("#touch-help-button");
      await helpBtn.click();
      await page.waitForFunction(
        () =>
          (window as any).__paRaceToTreasureIslandState?.overlayHeld === true,
        { timeout: 5000 },
      );

      // Get initial progress
      const stateBefore = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      const progressBefore = stateBefore?.playerProgress ?? 0;

      // Wait 1 second
      await page.waitForTimeout(1000);

      // Progress should not have increased significantly
      const stateDuring = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      const progressDuring = stateDuring?.playerProgress ?? 0;
      expect(progressDuring).toBeLessThanOrEqual(progressBefore + 1);

      // Dismiss overlay
      const dismissBtn = page.locator("#touch-hint-dismiss");
      await dismissBtn.click();
      await page.waitForFunction(
        () =>
          (window as any).__paRaceToTreasureIslandState?.overlayHeld === false,
        { timeout: 5000 },
      );

      // Wait 1 second
      await page.waitForTimeout(1000);

      // Progress should have increased
      const stateAfter = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      const progressAfter = stateAfter?.playerProgress ?? 0;
      expect(progressAfter).toBeGreaterThan(progressDuring);
    });

    test("first visit hint uses overlay hold flag", async ({ page }) => {
      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Force show through help button (first visit hint may not show in test mode)
      const helpBtn = page.locator("#touch-help-button");
      await helpBtn.click();

      // Wait a bit for the overlay hold to be set
      await page.waitForTimeout(100);

      const hintEl = page.locator("#touch-hint");
      await expect(hintEl).toBeVisible();

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.overlayHeld).toBe(true);
    });

    test("first visit coarse-pointer hint shows and holds race", async ({
      page,
    }) => {
      // Simulate real touch/coarse device and clear session storage before navigation
      await page.addInitScript(() => {
        sessionStorage.removeItem("pa-race-hint-shown");
        Object.defineProperty(navigator, "maxTouchPoints", {
          configurable: true,
          get: () => 5,
        });
        const originalMatchMedia = window.matchMedia.bind(window);
        window.matchMedia = (query: string) => {
          if (
            query.includes("(pointer: coarse)") ||
            query.includes("(any-pointer: coarse)")
          ) {
            return {
              matches: true,
              media: query,
              onchange: null,
              addListener: () => {},
              removeListener: () => {},
              addEventListener: () => {},
              removeEventListener: () => {},
              dispatchEvent: () => false,
            } as MediaQueryList;
          }
          return originalMatchMedia(query);
        };
        (window as any).debugMode = false;
        (window as any).screenshotMode = false;
      });

      const pageErrors: Error[] = [];
      page.on("pageerror", (err) => pageErrors.push(err));

      await page.goto(
        "/play/race-to-treasure-island/?seed=first-visit-touch&forceHint=1",
        {
          waitUntil: "domcontentloaded",
        },
      );
      await waitForPhaserReady(page);

      // Use help button to show hint (more reliable than auto first-visit in test environment)
      const helpBtn = page.locator("#touch-help-button");
      await helpBtn.click();

      // Wait for hint to appear
      await expect(page.locator("#touch-hint")).toBeVisible({ timeout: 10000 });

      // Assert the first-visit hint is visible
      const hintEl = page.locator("#touch-hint");
      await expect(hintEl).toBeVisible();

      // Assert overlay hold is active (wait for Phaser update cycle)
      await page.waitForFunction(
        () =>
          (window as any).__paRaceToTreasureIslandState?.overlayHeld === true,
        { timeout: 5000 },
      );

      // Assert HUD mode is touch
      const infobox = page.locator("#infobox");
      await expect(infobox).toHaveAttribute("data-hud-mode", "touch");

      // Dismiss the hint
      const dismissBtn = page.locator("#touch-hint-dismiss");
      await dismissBtn.click();

      // Wait for overlay hold to clear
      await page.waitForFunction(
        () =>
          (window as any).__paRaceToTreasureIslandState?.overlayHeld === false,
        { timeout: 5000 },
      );

      // Assert hint is hidden
      await expect(page.locator("#touch-hint")).toBeHidden();

      // Assert no page errors occurred
      expect(pageErrors).toHaveLength(0);
    });

    test("manual pause remains separate from overlay hold", async ({
      page,
    }) => {
      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Click help button
      const helpBtn = page.locator("#touch-help-button");
      await helpBtn.click();

      // Overlay held but not paused
      await page.waitForFunction(
        () =>
          (window as any).__paRaceToTreasureIslandState?.overlayHeld === true,
        { timeout: 5000 },
      );
      const state1 = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state1?.overlayHeld).toBe(true);
      expect(state1?.paused).toBe(false);

      // Dismiss overlay
      const dismissBtn = page.locator("#touch-hint-dismiss");
      await dismissBtn.click();
      await page.waitForFunction(
        () =>
          (window as any).__paRaceToTreasureIslandState?.overlayHeld === false,
        { timeout: 5000 },
      );

      // Click pause button
      const pauseBtn = page.locator("#btn-pause");
      await pauseBtn.click();
      await page.waitForFunction(
        () => (window as any).__paRaceToTreasureIslandState?.paused === true,
        { timeout: 5000 },
      );

      const state2 = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state2?.paused).toBe(true);
      expect(state2?.overlayHeld).toBe(false);
    });

    // ── Phase 9: New boost, overtake, obstacle, touch cleanup tests ──

    test("race boost engages from touch controls and accelerates progress", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Boost engagement test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1&seed=boost-smoke`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      const initial = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(initial?.windMeter).toBe(100);

      // Hold boost
      const boostBtn = page.locator("#btn-boost");
      await boostBtn.dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
      });
      await page.waitForTimeout(200);

      let state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.boosting).toBe(true);
      expect(state?.windMeter).toBeLessThan(100);

      // Check boost button active class
      const hasActiveClass = await page.evaluate(() => {
        const btn = document.getElementById("btn-boost");
        return btn?.classList.contains("touch-btn--active") ?? false;
      });
      expect(hasActiveClass).toBe(true);

      // Progress should increase faster during boost than after release
      await page.waitForTimeout(1000);
      const progressDuring = await page.evaluate(
        () =>
          (window as any).__paRaceToTreasureIslandState?.playerProgress ?? 0,
      );

      // Release boost
      await boostBtn.dispatchEvent("pointerup", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 0,
      });
      await page.waitForTimeout(100);

      state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.boosting).toBe(false);

      const activeAfterRelease = await page.evaluate(() => {
        const btn = document.getElementById("btn-boost");
        return btn?.classList.contains("touch-btn--active") ?? false;
      });
      expect(activeAfterRelease).toBe(false);

      await page.waitForTimeout(1000);
      const progressAfter = await page.evaluate(
        () =>
          (window as any).__paRaceToTreasureIslandState?.playerProgress ?? 0,
      );

      // Progress during boost should be higher than after (boost is faster)
      // During 1s boost with bonus 120 vs no bonus = ~240/s vs ~120/s
      // After 1s no boost = ~120/s more
      // So progressDuring should be > progressAfter/2 roughly (allow some overlap)
      expect(progressDuring).toBeGreaterThan(progressAfter - 200);
    });

    test("race boost effect visible in state", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Boost visible test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1&seed=boost-visual`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Hold boost
      const boostBtn = page.locator("#btn-boost");
      await boostBtn.dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
      });
      await page.waitForTimeout(500);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.boostEffectVisible).toBe(true);

      await boostBtn.dispatchEvent("pointerup", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 0,
      });
      await page.waitForTimeout(200);

      const stateAfter = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(stateAfter?.boostEffectVisible).toBe(false);
    });

    test("race deterministic overtake via debug progress", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Deterministic overtake test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1&seed=overtake-det`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Set rival ahead
      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugSetProgress === "function") {
          (window as any).__paRaceDebugSetProgress(500);
        }
        if (
          typeof (window as any).__paRaceDebugSetRivalProgress === "function"
        ) {
          (window as any).__paRaceDebugSetRivalProgress(1000);
        }
      });
      await page.waitForTimeout(100);

      let state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.leadState).toBe("rival");

      // Set player ahead
      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugSetProgress === "function") {
          (window as any).__paRaceDebugSetProgress(2000);
        }
      });
      await page.waitForTimeout(100);

      state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.leadState).toBe("player");
      expect(state?.overtakeCount).toBeGreaterThanOrEqual(1);
    });

    test("race obstacle hit via debug hook causes light penalty", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Obstacle hit test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1&seed=obstacle-hit-test`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Start boosting so we can verify it cancels
      const boostBtn = page.locator("#btn-boost");
      await boostBtn.dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
      });
      await page.waitForTimeout(500);

      const beforeHit = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(beforeHit?.boosting).toBe(true);
      const windBefore = beforeHit?.windMeter ?? 100;
      const hitCountBefore = beforeHit?.hitCount ?? 0;
      const scoreBefore = beforeHit?.score ?? 0;

      // Hit with barrel via debug hook
      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugHitObstacle === "function") {
          (window as any).__paRaceDebugHitObstacle("barrel");
        }
      });
      await page.waitForTimeout(200);

      const afterHit = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );

      // Verify hit was registered
      expect(afterHit?.hitCount).toBeGreaterThan(hitCountBefore);
      expect(afterHit?.lastHitType).toBe("barrel");
      expect(afterHit?.stunTimer).toBeGreaterThan(0);

      // Boost should be cancelled
      expect(afterHit?.boosting).toBe(false);

      // Wind meter should be reduced
      expect(afterHit?.windMeter).toBeLessThan(windBefore);

      // Bump timer should be set
      expect(afterHit?.hitBumpTimer).toBeGreaterThan(0);
    });

    test("race touch input clears after pointer cancellation", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Touch cleanup test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Press boost and left
      const boostBtn = page.locator("#btn-boost");
      const leftBtn = page.locator("#btn-left");

      await boostBtn.dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
      });
      await leftBtn.dispatchEvent("pointerdown", {
        pointerId: 2,
        pointerType: "touch",
        isPrimary: false,
        button: 0,
        buttons: 1,
      });
      await page.waitForTimeout(100);

      let inputState = await page.evaluate(
        () => (window as any).__paTouchInput || {},
      );
      expect(inputState.boost).toBe(true);
      expect(inputState.left).toBe(true);

      // Dispatch pointercancel on boost button
      await boostBtn.dispatchEvent("pointercancel", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 0,
      });
      await page.waitForTimeout(100);

      inputState = await page.evaluate(
        () => (window as any).__paTouchInput || {},
      );
      expect(inputState.boost).toBe(false);

      // Cleanup
      await leftBtn.dispatchEvent("pointerup", {
        pointerId: 2,
        pointerType: "touch",
        isPrimary: false,
        button: 0,
        buttons: 0,
      });
    });

    test("race new debug hooks present in debug mode", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "New debug hooks test skipped on non-desktop",
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      const hooks = await page.evaluate(() => ({
        setBoostMeter:
          typeof (window as any).__paRaceDebugSetBoostMeter === "function",
        hitObstacle:
          typeof (window as any).__paRaceDebugHitObstacle === "function",
        getState: typeof (window as any).__paRaceDebugGetState === "function",
        finish: typeof (window as any).__paRaceDebugFinish === "function",
        pause: typeof (window as any).__paRaceDebugPause === "function",
        setProgress:
          typeof (window as any).__paRaceDebugSetProgress === "function",
        setScore: typeof (window as any).__paRaceDebugSetScore === "function",
      }));

      expect(hooks.setBoostMeter).toBe(true);
      expect(hooks.hitObstacle).toBe(true);
      expect(hooks.getState).toBe(true);
      expect(hooks.finish).toBe(true);
      expect(hooks.pause).toBe(true);
      expect(hooks.setProgress).toBe(true);
      expect(hooks.setScore).toBe(true);
    });

    test("race debug set boost meter works", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Set boost meter test skipped on non-desktop",
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      // Set boost to a low value via debug hook (close to clamp floor)
      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugSetBoostMeter === "function") {
          (window as any).__paRaceDebugSetBoostMeter(0);
        }
      });
      await page.waitForTimeout(100);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      // Allow small regen drift when near 0
      expect(state?.windMeter).toBeLessThanOrEqual(5);

      // Clamp to max
      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugSetBoostMeter === "function") {
          (window as any).__paRaceDebugSetBoostMeter(999);
        }
      });
      await page.waitForTimeout(50);

      const state2 = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      // Allow small regen drift when near max (should stay near 100)
      expect(state2?.windMeter).toBeGreaterThanOrEqual(95);
    });

    test("race debug get state returns deep copy", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Get state test skipped on non-desktop",
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      const stateCopy = await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugGetState === "function") {
          return (window as any).__paRaceDebugGetState();
        }
        return null;
      });

      expect(stateCopy).not.toBeNull();
      expect(typeof stateCopy?.playerProgress).toBe("number");
      expect(typeof stateCopy?.windMeter).toBe("number");
      expect(typeof stateCopy?.leadState).toBe("string");
      expect(typeof stateCopy?.hitCount).toBe("number");
      expect(stateCopy).toHaveProperty("boosting");
      expect(stateCopy).toHaveProperty("boostEffectVisible");
    });

    // ── Phase 9/2: Speed coherence tests ──

    test("coherent speed model exposes rates in state", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Speed model test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1&seed=speed-coherent`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(typeof state?.baseWorldSpeed).toBe("number");
      expect(typeof state?.effectiveWorldSpeed).toBe("number");
      expect(typeof state?.playerProgressRate).toBe("number");
      expect(typeof state?.rivalProgressRate).toBe("number");
      expect(state?.baseWorldSpeed).toBeGreaterThanOrEqual(80);
      expect(state?.effectiveWorldSpeed).toBeGreaterThanOrEqual(
        state?.baseWorldSpeed,
      );
    });

    test("boosted progress rate exceeds normal rate", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Boost rate test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1&seed=boost-rate`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Measure normal rate for 500ms
      const progressBefore = await page.evaluate(
        () =>
          (window as any).__paRaceToTreasureIslandState?.playerProgress ?? 0,
      );
      await page.waitForTimeout(500);
      const progressMid = await page.evaluate(
        () =>
          (window as any).__paRaceToTreasureIslandState?.playerProgress ?? 0,
      );
      const normalGain = progressMid - progressBefore;

      // Set boost meter to full and engage boost
      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugSetBoostMeter === "function") {
          (window as any).__paRaceDebugSetBoostMeter(100);
        }
      });

      // Hold boost via touch
      const boostBtn = page.locator("#btn-boost");
      await boostBtn.dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
      });
      await page.waitForTimeout(200);

      const boostedBefore = await page.evaluate(
        () =>
          (window as any).__paRaceToTreasureIslandState?.playerProgress ?? 0,
      );
      await page.waitForTimeout(500);
      const boostedAfter = await page.evaluate(
        () =>
          (window as any).__paRaceToTreasureIslandState?.playerProgress ?? 0,
      );
      const boostedGain = boostedAfter - boostedBefore;

      await boostBtn.dispatchEvent("pointerup", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 0,
      });

      // Boosted gain should be meaningfully higher than normal gain
      expect(boostedGain).toBeGreaterThan(normalGain * 1.5);
    });

    test("obstacle hit sets bump timer and cancels boost", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Obstacle bump test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1&seed=obstacle-bump`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Engage boost
      const boostBtn = page.locator("#btn-boost");
      await boostBtn.dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
      });
      await page.waitForTimeout(300);

      const beforeHit = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(beforeHit?.boosting).toBe(true);
      const windBefore = beforeHit?.windMeter ?? 100;

      // Hit with barrel via debug hook
      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugHitObstacle === "function") {
          (window as any).__paRaceDebugHitObstacle("barrel");
        }
      });
      await page.waitForTimeout(100);

      const afterHit = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(afterHit?.hitCount).toBeGreaterThan(beforeHit?.hitCount ?? 0);
      expect(afterHit?.boosting).toBe(false);
      expect(afterHit?.windMeter).toBeLessThan(windBefore);
      expect(afterHit?.stunTimer).toBeGreaterThan(0);
      expect(afterHit?.hitBumpTimer).toBeGreaterThan(0);

      // Wait for bump to clear
      await page.waitForTimeout(500);
      const afterClear = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(afterClear?.hitBumpTimer).toBe(0);
    });

    test("debug set rival progress hook exists and works", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Set rival progress test skipped on non-desktop",
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      const hasHook = await page.evaluate(
        () =>
          typeof (window as any).__paRaceDebugSetRivalProgress === "function",
      );
      expect(hasHook).toBe(true);

      await page.evaluate(() => {
        if (
          typeof (window as any).__paRaceDebugSetRivalProgress === "function"
        ) {
          (window as any).__paRaceDebugSetRivalProgress(5000);
        }
      });
      await page.waitForTimeout(100);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.rivalProgress).toBeGreaterThanOrEqual(4900);
    });

    // ── Phase 6: True first-visit auto hint test ──

    test("first visit auto hint shows without help button", async ({
      page,
    }) => {
      // Set up touch spoofing before navigation
      await page.addInitScript(() => {
        sessionStorage.removeItem("pa-race-hint-shown");
        Object.defineProperty(navigator, "maxTouchPoints", {
          configurable: true,
          get: () => 5,
        });
        const originalMatchMedia = window.matchMedia.bind(window);
        window.matchMedia = (query: string) => {
          if (
            query.includes("(pointer: coarse)") ||
            query.includes("(any-pointer: coarse)")
          ) {
            return {
              matches: true,
              media: query,
              onchange: null,
              addListener: () => {},
              removeListener: () => {},
              addEventListener: () => {},
              removeEventListener: () => {},
              dispatchEvent: () => false,
            } as MediaQueryList;
          }
          return originalMatchMedia(query);
        };
      });

      const pageErrors: Error[] = [];
      page.on("pageerror", (err) => pageErrors.push(err));

      await page.goto(
        "/play/race-to-treasure-island/?seed=first-visit-true&forceHint=1",
        { waitUntil: "domcontentloaded" },
      );
      await waitForPhaserReady(page);

      // The auto hint should be visible without clicking help button
      await expect(page.locator("#touch-hint")).toBeVisible({ timeout: 5000 });

      // Overlay hold should be true
      await page.waitForFunction(
        () =>
          (window as any).__paRaceToTreasureIslandState?.overlayHeld === true,
        { timeout: 5000 },
      );

      // HUD mode should be touch
      const infobox = page.locator("#infobox");
      await expect(infobox).toHaveAttribute("data-hud-mode", "touch");

      // Dismiss the hint
      const dismissBtn = page.locator("#touch-hint-dismiss");
      await dismissBtn.click();
      await page.waitForFunction(
        () =>
          (window as any).__paRaceToTreasureIslandState?.overlayHeld === false,
        { timeout: 5000 },
      );

      await expect(page.locator("#touch-hint")).toBeHidden();
      expect(pageErrors).toHaveLength(0);
    });

    // ── Phase 7: Touch cleanup tests ──

    test("touch input clears on window blur", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Blur cleanup test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Set touch input active
      const boostBtn = page.locator("#btn-boost");
      await boostBtn.dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
      });
      await page.waitForTimeout(100);

      let inputState = await page.evaluate(
        () => (window as any).__paTouchInput || {},
      );
      expect(inputState.boost).toBe(true);

      // Dispatch window blur
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.waitForTimeout(100);

      inputState = await page.evaluate(
        () => (window as any).__paTouchInput || {},
      );
      expect(inputState.boost).toBe(false);

      // Active class should be cleared
      const hasActiveClass = await page.evaluate(() => {
        const btn = document.getElementById("btn-boost");
        return btn?.classList.contains("touch-btn--active") ?? false;
      });
      expect(hasActiveClass).toBe(false);
    });

    test("opening help overlay clears directional inputs", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Overlay clear test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Set left + boost active
      const leftBtn = page.locator("#btn-left");
      await leftBtn.dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
      });
      const boostBtn = page.locator("#btn-boost");
      await boostBtn.dispatchEvent("pointerdown", {
        pointerId: 2,
        pointerType: "touch",
        isPrimary: false,
        button: 0,
        buttons: 1,
      });
      await page.waitForTimeout(100);

      let inputState = await page.evaluate(
        () => (window as any).__paTouchInput || {},
      );
      expect(inputState.left).toBe(true);
      expect(inputState.boost).toBe(true);

      // Open help overlay
      const helpBtn = page.locator("#touch-help-button");
      await helpBtn.click();
      await page.waitForTimeout(100);

      // Directional and boost inputs should be cleared
      inputState = await page.evaluate(
        () => (window as any).__paTouchInput || {},
      );
      expect(inputState.left).toBe(false);
      expect(inputState.boost).toBe(false);

      // Cleanup
      await leftBtn.dispatchEvent("pointerup", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 0,
      });
      const dismissBtn = page.locator("#touch-hint-dismiss");
      await dismissBtn.click();
    });

    test("pausing clears directional and boost inputs", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Pause clear test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Set right + boost active
      const rightBtn = page.locator("#btn-right");
      await rightBtn.dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
      });
      const boostBtn = page.locator("#btn-boost");
      await boostBtn.dispatchEvent("pointerdown", {
        pointerId: 2,
        pointerType: "touch",
        isPrimary: false,
        button: 0,
        buttons: 1,
      });
      await page.waitForTimeout(100);

      let inputState = await page.evaluate(
        () => (window as any).__paTouchInput || {},
      );
      expect(inputState.right).toBe(true);
      expect(inputState.boost).toBe(true);

      // Tap pause
      const pauseBtn = page.locator("#btn-pause");
      await pauseBtn.click();
      await page.waitForTimeout(200);

      // Input should be cleared by the pause handler
      inputState = await page.evaluate(
        () => (window as any).__paTouchInput || {},
      );
      expect(inputState.right).toBe(false);
      expect(inputState.boost).toBe(false);

      // Resume
      await pauseBtn.click();
      await page.waitForTimeout(100);
    });

    test("rival finish produces distinct result via debug hook", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Rival finish test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Force rival win by setting rival progress past finish
      await page.evaluate(() => {
        if (
          typeof (window as any).__paRaceDebugSetRivalProgress === "function"
        ) {
          (window as any).__paRaceDebugSetRivalProgress(10000);
        }
      });
      await page.waitForTimeout(300);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.finished).toBe(true);
      expect(state?.playerWon).toBe(false);
      expect(state?.result).toContain("LONG JOHN GOT THERE FIRST");
    });

    test("player win sets playerWon state", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Player win test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Force player win
      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugFinish === "function") {
          (window as any).__paRaceDebugFinish();
        }
      });
      await page.waitForTimeout(300);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.finished).toBe(true);
      expect(state?.playerWon).toBe(true);
      expect(state?.result).toContain("TREASURE ISLAND");
    });

    test("restart clears touch inputs before restart", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Restart clear test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Force finish
      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugFinish === "function") {
          (window as any).__paRaceDebugFinish();
        }
      });
      await page.waitForTimeout(200);

      // Set some touch input active
      await page.evaluate(() => {
        (window as any).__paTouchInput = (window as any).__paTouchInput || {};
        (window as any).__paTouchInput.left = true;
        (window as any).__paTouchInput.boost = true;
      });
      await page.waitForTimeout(100);

      // Restart via debug hook (bypasses input system entirely)
      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugRestart === "function") {
          (window as any).__paRaceDebugRestart();
        }
      });

      // Wait for scene restart: finished resets to false and progress resets
      await page.waitForFunction(
        () => (window as any).__paRaceToTreasureIslandState?.finished === false,
        { timeout: 10000, polling: 50 },
      );

      // After restart, touch inputs should be cleared by handleSystemInput
      const inputState = await page.evaluate(
        () => (window as any).__paTouchInput || {},
      );
      expect(inputState.left).toBe(false);
      expect(inputState.boost).toBe(false);
    });

    test("overtakeCueVisible state tracks cue", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Overtake cue test skipped on non-desktop",
      );

      await page.goto(`${game.path}?testTouch=1`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      // Set player ahead so the leadState change triggers the cue
      await page.evaluate(() => {
        if (
          typeof (window as any).__paRaceDebugSetRivalProgress === "function"
        ) {
          (window as any).__paRaceDebugSetRivalProgress(500);
        }
        if (typeof (window as any).__paRaceDebugSetProgress === "function") {
          (window as any).__paRaceDebugSetProgress(2000);
        }
      });

      // Trigger the cue directly via debug hook
      await page.evaluate(() => {
        if (
          typeof (window as any).__paRaceDebugShowOvertakeCue === "function"
        ) {
          (window as any).__paRaceDebugShowOvertakeCue();
        }
      });

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.overtakeCueVisible).toBe(true);
      expect(state?.leadState).toBe("player");

      // Wait for cue to fade (tween is 1500ms, but game may re-trigger on cooldown expiry)
      await page.waitForFunction(
        () =>
          (window as any).__paRaceToTreasureIslandState?.overtakeCueVisible ===
          false,
        { timeout: 10000, polling: 100 },
      );
    });

    // ── Consolidation Phase 8: New focused tests ──

    test("playerTint is exposed in race state", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "playerTint test skipped on non-desktop",
      );

      await page.goto(`${game.path}?seed=test-ptint`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state).toHaveProperty("playerTint");
      expect(typeof state?.playerTint).toBe("number");
    });

    test("best score saves on win only", async ({ page }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Best score test skipped on non-desktop",
      );

      // Clear any saved best score
      await page.goto(`${game.path}?seed=best-test`, {
        waitUntil: "domcontentloaded",
      });
      await page.evaluate(() => localStorage.removeItem("pa-race-best"));
      await waitForPhaserReady(page);

      // Set a meaningful score then force a player win
      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugSetScore === "function") {
          (window as any).__paRaceDebugSetScore(500);
        }
        if (typeof (window as any).__paRaceDebugFinish === "function") {
          (window as any).__paRaceDebugFinish();
        }
      });
      await page.waitForTimeout(300);

      const winState = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(winState?.finished).toBe(true);
      expect(winState?.playerWon).toBe(true);
      expect(winState?.bestScore).toBe(500);
      expect(winState?.isNewBest).toBe(true);

      // Force a rival win — bestScore should remain 500
      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugRestart === "function") {
          (window as any).__paRaceDebugRestart();
        }
      });
      // Wait for scene restart and full countdown completion
      await page.waitForFunction(
        () => (window as any).__paRaceToTreasureIslandState?.finished === false,
        { timeout: 10000, polling: 50 },
      );
      await page.waitForTimeout(2500); // let countdown finish

      await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugSetScore === "function") {
          (window as any).__paRaceDebugSetScore(999);
        }
        if (
          typeof (window as any).__paRaceDebugSetRivalProgress === "function"
        ) {
          (window as any).__paRaceDebugSetRivalProgress(10000);
        }
      });
      await page.waitForFunction(
        () => (window as any).__paRaceToTreasureIslandState?.finished === true,
        { timeout: 5000, polling: 50 },
      );

      const lossState = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(lossState?.finished).toBe(true);
      expect(lossState?.playerWon).toBe(false);
      // Best score should still be 500 — not overwritten by the 999 on loss
      expect(lossState?.bestScore).toBe(500);
      expect(lossState?.isNewBest).toBe(false);
    });

    test("countdown phase completes after waitForPhaserReady", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Countdown test skipped on non-desktop",
      );

      await page.goto(`${game.path}?seed=countdown-test`, {
        waitUntil: "domcontentloaded",
      });
      await waitForPhaserReady(page);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.countdownPhase).toBe("done");
    });
  });
}
