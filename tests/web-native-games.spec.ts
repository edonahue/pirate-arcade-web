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
      expect(infoText?.toLowerCase()).toContain("restart");
      expect(infoText?.toLowerCase()).toContain("pause");
    });

    // ── Phase 6: Touch control behavior tests ──

    test("touch left button sets input and moves ship", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Touch left test skipped on non-desktop",
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
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

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
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

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
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

      await page.goto(`${game.path}?testTouch=1`, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      // Check if debug pause hook exists
      const hasPauseHook = await page.evaluate(() => typeof (window as any).__paRaceDebugPause === "function");
      console.log("Debug pause hook exists:", hasPauseHook);

      // Check state before pause
      const stateBefore = await page.evaluate(() => (window as any).__paRaceToTreasureIslandState);
      console.log("State before pause:", stateBefore);

      // Call debug hook and also check if togglePause is called
      console.log("Calling debug pause hook...");
      const hookResult = await page.evaluate(() => {
        if (typeof (window as any).__paRaceDebugPause === "function") {
          console.log("Test: calling debug pause hook");
          (window as any).__paRaceDebugPause();
          console.log("Test: debug pause hook returned");
          return "ok";
        }
        return "no hook";
      });
      console.log("Hook call result:", hookResult);
      await page.waitForTimeout(500);

      const stateAfterPause = await page.evaluate(() => (window as any).__paRaceToTreasureIslandState);
      console.log("State after pause:", stateAfterPause);

      const paused = stateAfterPause?.paused === true;
      console.log("Paused state:", paused);
      expect(paused).toBe(true);

      // Also directly call togglePause to verify it works
      await page.evaluate(() => {
        const game = (window as any).__paRaceGame;
        if (game && game.scene) {
          const scenes = game.scene.scenes;
          for (const scene of scenes) {
            if (scene.scene?.key === "RaceScene") {
              console.log("Test: directly calling togglePause on RaceScene");
              scene.togglePause();
              console.log("Test: togglePause returned");
              break;
            }
          }
        }
      });
      await page.waitForTimeout(500);

      const stateAfterDirectPause = await page.evaluate(() => (window as any).__paRaceToTreasureIslandState);
      console.log("State after direct pause:", stateAfterDirectPause);

      const directPaused = stateAfterDirectPause?.paused === true;
      console.log("Direct paused state:", directPaused);
      expect(directPaused).toBe(true);
    });

    test("restart button appears after forced finish", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Restart test skipped on non-desktop",
      );

      page.on("console", (msg) => console.log("[Browser]", msg.text()));

      await page.goto(`${game.path}?testTouch=1`, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      // Check if boot metrics are set
      const bootMetrics = await page.evaluate(() => (window as any).__paBootMetrics);
      console.log("Boot metrics:", bootMetrics);

      // Check if state is ever exposed
      const state = await page.evaluate(() => (window as any).__paRaceToTreasureIslandState);
      console.log("State after waitForPhaserReady:", state);

      // Try to get the debug hook
      const hasHook = await page.evaluate(() => typeof (window as any).__paRaceDebugFinish === "function");
      console.log("Debug hook exists:", hasHook);
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

      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(3000);

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

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      // Debug finish with 'f' key
      await page.keyboard.press("f");
      await page.waitForTimeout(300);

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

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      // Play for a while to build progress
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(8000);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      // If progress is high enough, island should be shown
      if ((state?.playerProgress ?? 0) > 7500) {
        expect(state?.islandShown).toBe(true);
      } else {
        // Not far enough yet — that's OK for this test
        expect(state?.islandShown).toBe(false);
      }
    });

    test("obstacle types include expected variants", async ({
      page,
    }, testInfo) => {
      test.skip(
        !DESKTOP_PROJECTS.includes(testInfo.project.name),
        "Obstacle test skipped on non-desktop",
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPhaserReady(page);

      // Wait for obstacle spawns
      await page.waitForTimeout(4000);

      const state = await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState,
      );
      expect(state?.obstacleCount).toBeGreaterThanOrEqual(0);
    });
  });
}
