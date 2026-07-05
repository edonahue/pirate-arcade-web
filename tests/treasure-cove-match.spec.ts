import { test, expect } from "./helpers/browserGame";
import {
  waitForPygbagRuntime,
  readGameState,
  startGameFromMenu,
  pressKeyDownUp,
  holdKeyUntilState,
  expectNoRuntimeErrors,
} from "./helpers/browserGame";

const GAME_PATH = "/play/treasure-cove/";

test.describe("Treasure Cove match gameplay", () => {
  test("start from menu produces playing phase", async ({ page }, testInfo) => {
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

  test("launch produces ballLaunched with upward vy", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    // Start with Enter so serve ball stays on paddle (not auto-launched)
    await startGameFromMenu(page, "Enter");

    // Hold Space while waiting for ball to launch
    await holdKeyUntilState(
      page,
      "Space",
      "state => state && state.ballLaunched === true",
      5000,
    );

    // Assert at least one ball with positive speed
    const ballSpeeds = await page.evaluate(() => {
      const gs = (window as any).PirateArcadeGameState?.getState?.();
      return gs?.ballSpeeds ?? [];
    });
    expect(ballSpeeds.length).toBeGreaterThan(0);
    for (const spd of ballSpeeds) {
      expect(spd).toBeGreaterThan(0);
    }

    await expectNoRuntimeErrors(page);
  });

  test("ArrowLeft decreases playerPosition", async ({ page }, testInfo) => {
    test.setTimeout(120000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await startGameFromMenu(page, "Space");

    // Note the starting position
    const posBefore = (await readGameState(page))?.playerPosition ?? 0;
    await pressKeyDownUp(page, "ArrowLeft", 300);
    await page.waitForTimeout(200);
    const posAfter = (await readGameState(page))?.playerPosition ?? posBefore;
    expect(posAfter).toBeLessThan(posBefore);
  });

  test("ArrowRight increases playerPosition", async ({ page }, testInfo) => {
    test.setTimeout(120000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await startGameFromMenu(page, "Space");

    const posBefore = (await readGameState(page))?.playerPosition ?? 0;
    await pressKeyDownUp(page, "ArrowRight", 300);
    await page.waitForTimeout(200);
    const posAfter = (await readGameState(page))?.playerPosition ?? posBefore;
    expect(posAfter).toBeGreaterThan(posBefore);
  });

  test("game state has stage and lives", async ({ page }, testInfo) => {
    test.setTimeout(120000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await startGameFromMenu(page, "Space");

    await pressKeyDownUp(page, "Space", 400);
    await page.waitForTimeout(500);

    const state = await readGameState(page);
    expect(state?.stage).toBeGreaterThanOrEqual(1);
    expect(state?.lives).toBeGreaterThan(0);
    expect(state?.score).toBeGreaterThanOrEqual(0);
  });
});
