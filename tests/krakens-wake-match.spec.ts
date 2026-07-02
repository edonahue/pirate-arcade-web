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

const GAME_PATH = "/play/krakens-wake/";
const ACTION_KEY = "Space";
const DESKTOP_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "Enter",
  "Escape",
];

test.describe("Kraken's Wake match lifecycle", () => {
  test("Start Game produces active ship and non-zero projectile count", async ({
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

    const shipAngle = await page.evaluate(() => {
      const gs = (window as any).PirateArcadeGameState?.getState?.();
      return gs?.shipAngle;
    });
    expect(shipAngle).toBeDefined();
    expect(typeof shipAngle).toBe("number");

    const projectileCount = await page.evaluate(() => {
      const gs = (window as any).PirateArcadeGameState?.getState?.();
      return gs?.projectileCount ?? 0;
    });
    expect(projectileCount).toBeGreaterThanOrEqual(0);

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
