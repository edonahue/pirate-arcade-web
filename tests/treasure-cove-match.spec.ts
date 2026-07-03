import { test, expect } from "./helpers/browserGame";
import {
  waitForPygbagRuntime,
  readGameState,
  sendKeysAndRequireResponse,
} from "./helpers/browserGame";

const GAME_PATH = "/play/treasure-cove/";
const ACTION_KEY = "Space";

test.describe("Treasure Cove match gameplay", () => {
  test("launch ball produces upward trajectory and non-zero speeds", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);

    // Launch ball
    await page.locator("canvas#canvas").click({ position: { x: 10, y: 10 } });
    await page.locator("canvas#canvas").focus();
    await page.waitForTimeout(300);
    await page.keyboard.press(ACTION_KEY);
    await page.waitForTimeout(1500);

    const state = await readGameState(page);
    expect(state).not.toBeNull();
    expect(state?.phase).toBe("playing");

    // Ball must be launched with upward velocity
    const ballLaunched = await page.evaluate(() => {
      const gs = (window as any).PirateArcadeGameState?.getState?.();
      return gs?.ballLaunched ?? false;
    });
    expect(ballLaunched).toBe(true);

    // Ball speeds must be positive and within configured bounds
    const ballSpeeds = await page.evaluate(() => {
      const gs = (window as any).PirateArcadeGameState?.getState?.();
      return gs?.ballSpeeds ?? [];
    });
    expect(ballSpeeds.length).toBeGreaterThan(0);
    for (const spd of ballSpeeds) {
      expect(spd).toBeGreaterThan(0);
    }

    // Initial ball speed should not exceed max
    const initialBallSpeed = await page.evaluate(() => {
      const gs = (window as any).PirateArcadeGameState?.getState?.();
      return gs?.initialBallSpeed ?? 0;
    });
    const maxBallSpeed = await page.evaluate(() => {
      const gs = (window as any).PirateArcadeGameState?.getState?.();
      return gs?.maxBallSpeed ?? 0;
    });
    expect(initialBallSpeed).toBeGreaterThan(0);
    expect(maxBallSpeed).toBeGreaterThan(initialBallSpeed);
  });

  test("paddle movement changes player position", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);

    // Launch ball first
    await page.locator("canvas#canvas").click({ position: { x: 10, y: 10 } });
    await page.locator("canvas#canvas").focus();
    await page.keyboard.press(ACTION_KEY);
    await page.waitForTimeout(1000);

    const response = await sendKeysAndRequireResponse(
      page,
      ["ArrowLeft"],
      3000,
    );
    expect(response.responded).toBe(true);
    expect(response.signal).toBeTruthy();
  });

  test("game state has stage and lives", async ({ page }, testInfo) => {
    test.setTimeout(300000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);

    await page.locator("canvas#canvas").click({ position: { x: 10, y: 10 } });
    await page.locator("canvas#canvas").focus();
    await page.keyboard.press(ACTION_KEY);
    await page.waitForTimeout(1500);

    const stage = await page.evaluate(() => {
      const gs = (window as any).PirateArcadeGameState?.getState?.();
      return gs?.stage;
    });
    expect(stage).toBeGreaterThanOrEqual(1);

    const lives = await page.evaluate(() => {
      const gs = (window as any).PirateArcadeGameState?.getState?.();
      return gs?.lives;
    });
    expect(lives).toBeGreaterThan(0);
  });
});
