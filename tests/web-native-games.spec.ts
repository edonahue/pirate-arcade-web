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
      await expect(page.locator("#controls-hint")).toHaveCount(1);
      await expect(page.locator("#infobox")).toHaveCount(1);

      const ibText = await page.locator("#infobox").textContent();
      expect(ibText?.length).toBeGreaterThan(10);

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
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(100);
      await page.keyboard.press("Space");
      await page.waitForTimeout(100);
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(100);
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
  });
}
