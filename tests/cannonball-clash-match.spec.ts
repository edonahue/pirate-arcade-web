import { test, expect } from "./helpers/browserGame";
import {
  waitForPygbagRuntime,
  readGameState,
  sendKeysAndRequireResponse,
} from "./helpers/browserGame";

const GAME_PATH = "/play/cannonball-clash/";
const ACTION_KEY = "Enter";

test.describe("Cannonball Clash match gameplay", () => {
  test("start game produces non-zero ball speed and playable state", async ({
    page,
  }, testInfo) => {
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
    await page.waitForTimeout(2000);

    const state = await readGameState(page);
    expect(state).not.toBeNull();
    expect(state?.phase).toBe("playing");

    const ballSpeed = await page.evaluate(() => {
      const gs = (window as any).PirateArcadeGameState?.getState?.();
      return gs?.ballSpeed ?? 0;
    });
    expect(ballSpeed).toBeGreaterThan(0);
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

    await page.locator("canvas#canvas").click({ position: { x: 10, y: 10 } });
    await page.locator("canvas#canvas").focus();
    await page.keyboard.press(ACTION_KEY);
    await page.waitForTimeout(1000);

    const response = await sendKeysAndRequireResponse(page, ["ArrowUp"], 3000);
    expect(response.responded).toBe(true);
    expect(response.signal).toBeTruthy();
  });
});
