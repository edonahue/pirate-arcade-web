import { test, expect } from "./helpers/browserGame";
import {
  waitForPygbagRuntime,
  readGameState,
  startGameFromMenu,
  pressKeyDownUp,
  holdKeyUntilState,
  expectNoRuntimeErrors,
} from "./helpers/browserGame";

const GAME_PATH = "/play/krakens-wake/";

test.describe("Kraken's Wake match gameplay", () => {
  test("start from menu produces playing phase with defined shipAngle", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await startGameFromMenu(page, "Space");

    const state = await readGameState(page);
    expect(state?.phase).toBe("playing");
    expect(typeof state?.shipAngle).toBe("number");
    expect(state?.lives).toBeGreaterThan(0);
    // recoveredErrorCount should be 0 after clean startup
    expect(state?.recoveredErrorCount).toBe(0);
    await expectNoRuntimeErrors(page);
  });

  test("ArrowRight changes shipAngle positive (starboard)", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await startGameFromMenu(page, "Space");

    const angleBefore = (await readGameState(page))?.shipAngle ?? 0;
    // Hold ArrowRight to turn starboard (positive direction)
    await pressKeyDownUp(page, "ArrowRight", 400);
    await page.waitForTimeout(50);
    const angleAfter = (await readGameState(page))?.shipAngle ?? angleBefore;
    expect(angleAfter).toBeGreaterThan(angleBefore);
    // Error count should remain 0
    const state = await readGameState(page);
    expect(state?.recoveredErrorCount).toBe(0);
  });

  test("ArrowLeft changes shipAngle negative (port)", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await startGameFromMenu(page, "Space");

    // First establish baseline
    await pressKeyDownUp(page, "ArrowLeft", 300);
    await page.waitForTimeout(50);
    const angleAfterLeft = (await readGameState(page))?.shipAngle ?? 0;

    // Now turn right from that position - should increase angle
    await pressKeyDownUp(page, "ArrowRight", 300);
    await page.waitForTimeout(50);
    const angleAfterRight =
      (await readGameState(page))?.shipAngle ?? angleAfterLeft;

    // Turning right should increase angle from left-turned position
    expect(angleAfterRight).toBeGreaterThan(angleAfterLeft);
    // Error count should remain 0
    const state = await readGameState(page);
    expect(state?.recoveredErrorCount).toBe(0);
  });

  test("Space fire increases projectileCount", async ({ page }, testInfo) => {
    test.setTimeout(120000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    // Start with Enter so firing key isn't consumed during menu transition
    await startGameFromMenu(page, "Enter");

    // Hold Space while waiting for projectile to appear
    await holdKeyUntilState(
      page,
      "Space",
      "state => state && state.projectileCount > 0",
      5000,
    );
    // Error count should remain 0 after firing
    const state = await readGameState(page);
    expect(state?.recoveredErrorCount).toBe(0);
  });

  test("expect no runtime errors", async ({ page }, testInfo) => {
    test.setTimeout(120000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await startGameFromMenu(page, "Space");
    await expectNoRuntimeErrors(page);
  });
});
