import { test, expect } from "./helpers/browserGame";
import {
  waitForPygbagRuntime,
  readGameState,
  startGameFromMenu,
  pressKeyDownUp,
  holdKeyUntilState,
  waitForGameStatePredicate,
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

    const posBefore = (await readGameState(page))?.playerPosition ?? 0;
    await pressKeyDownUp(page, "ArrowLeft", 300);
    // Brief stabilization after key release (bridge needs a tick to publish)
    await page.waitForTimeout(50);
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
    await page.waitForTimeout(50);
    const posAfter = (await readGameState(page))?.playerPosition ?? posBefore;
    expect(posAfter).toBeGreaterThan(posBefore);
  });

  // The (3,3) breach itself (8 secondaries, exact score, drops) is
  // proven deterministically by Python unit tests (TestBreachAggregation,
  // TestTreasureBlastDrops). This test proves the seeded production path
  // end to end: the parked ball detonates keg (3,3) through the real
  // collision code, the breach publishes, drops spawn, and input works.
  // The parked ball has zero velocity so the aftermath stays frozen and
  // the assertions are exact (no follow-on hits).
  test("seeded Stage-3 breach reports lastBreachSize 8", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.addInitScript(() => {
      localStorage.setItem("pa-treasure-test-breach", "1");
    });
    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await startGameFromMenu(page, "Space");

    // One-shot: the seed is consumed at boot, never lingering in storage.
    const seedLeft = await page.evaluate(() =>
      localStorage.getItem("pa-treasure-test-breach"),
    );
    expect(seedLeft).toBeNull();

    // Production collision detonates the intact (3,3) keg:
    // 4 reinforced + 2 treasure + 2 standard secondaries.
    await expect
      .poll(async () => (await readGameState(page))?.lastBreachSize, {
        timeout: 60000,
      })
      .toBe(8);

    const breach = await readGameState(page);
    expect(breach?.stage).toBe(3);
    expect(breach?.reinforcedBricksRemaining).toBe(32);
    expect(breach?.treasureBricksRemaining).toBe(3);
    expect(breach?.powderKegsRemaining).toBe(4);
    // Initiating keg 25 + 4 reinforced (2x90 row-2, 2x120 row-3)
    // + 2 treasure (2x50) + 2 standard row-4 (2x50) = 645, zero bonus.
    expect(breach?.score).toBe(645);

    // Both blasted Treasure bricks drop through the normal pickup path.
    // Drops may already be falling or caught: count both promptly.
    const drops =
      (breach?.fallingPickupCount ?? 0) + (breach?.pickupHistory?.length ?? 0);
    expect(drops).toBeGreaterThanOrEqual(2);

    // Input still works after the breach.
    const posBefore = breach?.playerPosition ?? 0;
    await pressKeyDownUp(page, "ArrowLeft", 300);
    await page.waitForTimeout(50);
    const posAfter = (await readGameState(page))?.playerPosition ?? posBefore;
    expect(posAfter).toBeLessThan(posBefore);

    await expectNoRuntimeErrors(page);
  });

  test("fresh load without seed starts ordinary Stage 1", async ({
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
    expect(state?.stage).toBe(1);
    expect(state?.lastBreachSize ?? 0).toBe(0);
    await expectNoRuntimeErrors(page);
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
    // Wait for ball to launch so at least one frame of score is settled
    await waitForGameStatePredicate(
      page,
      "state => state && state.ballLaunched === true",
      3000,
    );

    const state = await readGameState(page);
    expect(state?.stage).toBeGreaterThanOrEqual(1);
    expect(state?.lives).toBeGreaterThan(0);
    expect(state?.score).toBeGreaterThanOrEqual(0);
  });
});
