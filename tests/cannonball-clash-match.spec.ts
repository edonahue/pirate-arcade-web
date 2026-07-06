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

  // Pause via Escape is covered by Python unit tests
  // (test_cannonball_clash.py::TestCannonballClashExitSemantics).
  // The PirateArcadeInput bridge (keyDown → PyRun_SimpleString
  // → __pa_post_key → _handle_key) delivers Escape to the game
  // state machine in WASM, but the published game-state phase
  // transition is not reliably observable in headless Playwright.
  // Python unit tests provide deterministic state-machine proof.
});
