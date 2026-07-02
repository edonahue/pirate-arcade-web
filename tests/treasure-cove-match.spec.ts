import { test, expect } from "./helpers/browserGame";
import {
  waitForPygbagRuntime,
  unlockAndStartGame,
  readGameState,
  expectCanvasHasRenderedPixels,
} from "./helpers/browserGame";
import {
  createDiagnosticCollector,
  blockingErrors,
} from "./helpers/diagnostics";

const GAME_PATH = "/play/treasure-cove/";
const ACTION_KEY = "Space";
const DESKTOP_KEYS = ["ArrowLeft", "ArrowRight", "Space", "Enter", "Escape"];

test.describe("Treasure Cove match lifecycle", () => {
  test("Start Game launches ball and produces non-zero speed", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await unlockAndStartGame(page, DESKTOP_KEYS, ACTION_KEY);

    await page.waitForTimeout(2000);

    const state = await readGameState(page);
    expect(state).not.toBeNull();
    expect(state?.phase).toBe("playing");

    const ballLaunched = await page.evaluate(() => {
      const gs = (window as any).PirateArcadeGameState?.getState?.();
      return gs?.ballLaunched ?? false;
    });
    expect(ballLaunched).toBe(true);

    const ballSpeeds = await page.evaluate(() => {
      const gs = (window as any).PirateArcadeGameState?.getState?.();
      return gs?.ballSpeeds ?? [];
    });
    expect(ballSpeeds.length).toBeGreaterThan(0);
    expect(ballSpeeds[0]).toBeGreaterThan(0);

    await expectCanvasHasRenderedPixels(page);
  });

  test("no blocking console errors during match startup", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    const collector = createDiagnosticCollector();
    collector.start(page);
    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await unlockAndStartGame(page, DESKTOP_KEYS, ACTION_KEY);
    await page.waitForTimeout(2000);

    const snapshot = await collector.snapshot(testInfo);
    await collector.attach(testInfo, "startup", snapshot);

    const blocking = blockingErrors(snapshot);
    expect(blocking).toEqual([]);

    const gameAssetFailures = snapshot.failedRequests.filter((f) =>
      /\.(wasm|so|tar\.gz)(\?|$)/i.test(f),
    );
    const gameAssetBadResponses = snapshot.badResponses.filter((b) =>
      /\.(wasm|so|tar\.gz)(\?|$)/i.test(b.url),
    );
    expect(gameAssetFailures).toEqual([]);
    expect(gameAssetBadResponses).toEqual([]);
  });

  test("tab blur and refocus does not crash the game", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    const collector = createDiagnosticCollector();
    collector.start(page);
    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await unlockAndStartGame(page, DESKTOP_KEYS, ACTION_KEY);
    await page.waitForTimeout(500);

    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForTimeout(500);

    const snapshot = await collector.snapshot(testInfo);
    await collector.attach(testInfo, "blur-refocus", snapshot);
    const blocking = blockingErrors(snapshot);
    expect(blocking).toEqual([]);
  });

  test("canvas renders after starting a match", async ({ page }, testInfo) => {
    test.setTimeout(300000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await unlockAndStartGame(page, DESKTOP_KEYS, ACTION_KEY);

    await page.waitForTimeout(1000);
    await expectCanvasHasRenderedPixels(page);
  });
});
