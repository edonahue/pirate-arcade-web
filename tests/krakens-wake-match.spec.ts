import { test, expect } from "./helpers/browserGame";
import {
  waitForPygbagRuntime,
  readGameState,
  sendKeysAndRequireResponse,
} from "./helpers/browserGame";

const GAME_PATH = "/play/krakens-wake/";
const ACTION_KEY = "Space";

test.describe("Kraken's Wake match gameplay", () => {
  test("ship turns in response to directional input", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);

    // Start game
    await page.locator("canvas#canvas").click({ position: { x: 10, y: 10 } });
    await page.locator("canvas#canvas").focus();
    await page.keyboard.press(ACTION_KEY);
    await page.waitForTimeout(1500);

    const state = await readGameState(page);
    expect(state).not.toBeNull();
    expect(state?.phase).toBe("playing");

    // Turn ship right and verify response
    const response = await sendKeysAndRequireResponse(
      page,
      ["ArrowRight"],
      3000,
    );
    expect(response.responded).toBe(true);
  });

  test("ship angle is defined after starting", async ({ page }, testInfo) => {
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

    const shipAngle = await page.evaluate(() => {
      const gs = (window as any).PirateArcadeGameState?.getState?.();
      return gs?.shipAngle;
    });
    expect(shipAngle).toBeDefined();
    expect(typeof shipAngle).toBe("number");

    const lives = await page.evaluate(() => {
      const gs = (window as any).PirateArcadeGameState?.getState?.();
      return gs?.lives;
    });
    expect(lives).toBeGreaterThan(0);
  });
});
