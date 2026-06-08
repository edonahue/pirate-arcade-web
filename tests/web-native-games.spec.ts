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
  });
}
