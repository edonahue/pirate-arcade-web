import { test, expect } from "./helpers/browserGame";
import {
  waitForPygbagRuntime,
  readGameState,
  startGameFromMenu,
  pressKeyDownUp,
  expectNoRuntimeErrors,
} from "./helpers/browserGame";

const GAME_PATH = "/play/cannonball-clash/";

test.describe("Cannonball Clash match gameplay", () => {
  test("start from menu produces ball speed and playing phase", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await startGameFromMenu(page, "Enter");

    const state = await readGameState(page);
    expect(state?.phase).toBe("playing");
    expect(state?.ballSpeed).toBeGreaterThan(0);
    await expectNoRuntimeErrors(page);
  });

  test("ArrowDown moves player paddle down", async ({ page }, testInfo) => {
    test.setTimeout(120000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await startGameFromMenu(page, "Enter");

    const posBefore = (await readGameState(page))?.playerPosition ?? 0;
    await pressKeyDownUp(page, "ArrowDown", 400);
    await page.waitForTimeout(50);
    const posAfter = (await readGameState(page))?.playerPosition ?? posBefore;
    // CC y-axis: down = higher y value (inverted screen coords)
    expect(posAfter).toBeGreaterThan(posBefore);
  });

  test("ArrowUp moves player paddle up", async ({ page }, testInfo) => {
    test.setTimeout(120000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await startGameFromMenu(page, "Enter");

    // First move down so we can detect upward movement
    await pressKeyDownUp(page, "ArrowDown", 200);
    await page.waitForTimeout(50);
    const posAfterDown = (await readGameState(page))?.playerPosition ?? 0;

    await pressKeyDownUp(page, "ArrowUp", 400);
    await page.waitForTimeout(50);
    const posAfterUp =
      (await readGameState(page))?.playerPosition ?? posAfterDown;
    expect(posAfterUp).toBeLessThan(posAfterDown);
  });

  // The Fever grant itself (paddle 150px at tier 10) is proven
  // deterministically by Python unit tests (TestFeverReinforcement):
  // organic 10-hit rallies are not reliably reachable through a
  // 120ms-poll browser control loop (measured: prediction tracking
  // peaks below tier 10; parked play never leaves tier 0). This test
  // proves the tier machinery, publication, reset, and input end to end.
  // The debug rally seed (pa-pong-test-rally) parks one hit below the
  // target so the next real return crosses it through the production
  // tier-up path. One-shot consumed at boot; ordinary players never
  // carry it. (Organic 10-hit rallies proved unreachable through a
  // 120ms-poll control loop in measurement, so the grant mechanics
  // ride the seam while tier publication is proven on live rallies.)
  test("seeded Fever rally grants reinforcement mid-point", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.addInitScript(() => {
      localStorage.setItem("pa-pong-test-rally", "10");
    });
    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await startGameFromMenu(page, "Enter");

    // One-shot: the seed is consumed at boot, never lingering in storage.
    const seedLeft = await page.evaluate(() =>
      localStorage.getItem("pa-pong-test-rally"),
    );
    expect(seedLeft).toBeNull();

    // Every point starts parked at a 9-rally: the first real player
    // return crosses 10 through the production tier-up branch.
    await expect
      .poll(async () => (await readGameState(page))?.rallyTier, {
        timeout: 60000,
      })
      .toBe(10);
    const fever = await readGameState(page);
    expect(fever?.playerPaddleHeight).toBe(150);

    // Abandon position (hold to the top rail): the point ends, the grant
    // resets with it. Parking in place can self-sustain the rally.
    await page.keyboard.down("ArrowUp");
    try {
      await expect
        .poll(async () => (await readGameState(page))?.playerPaddleHeight, {
          timeout: 120000,
        })
        .toBe(100);
    } finally {
      await page.keyboard.up("ArrowUp");
    }

    // Input still works after the Fever point: ensure a live rally
    // (ball moving, not a point-transition freeze), then verify the
    // paddle answers the keys.
    const live = await readGameState(page);
    if (live?.phase !== "playing") {
      await pressKeyDownUp(page, "Enter", 200);
      await expect
        .poll(async () => (await readGameState(page))?.phase, {
          timeout: 15000,
        })
        .toBe("playing");
    }
    await expect
      .poll(async () => (await readGameState(page))?.ballSpeed, {
        timeout: 15000,
      })
      .toBeGreaterThan(0);
    const posBefore = (await readGameState(page))?.playerPosition ?? 0;
    await pressKeyDownUp(page, "ArrowDown", 400);
    await page.waitForTimeout(50);
    const posAfter = (await readGameState(page))?.playerPosition ?? posBefore;
    expect(posAfter).not.toBe(posBefore);
  });

  // Pause via Escape is covered by Python unit tests
  // (test_cannonball_clash.py::TestCannonballClashExitSemantics).
  // The PirateArcadeInput bridge (keyDown → PyRun_SimpleString
  // → __pa_post_key → _handle_key) delivers Escape to the game
  // state machine in WASM, but the published game-state phase
  // transition is not reliably observable in headless Playwright.
  // Python unit tests provide deterministic state-machine proof.
});
