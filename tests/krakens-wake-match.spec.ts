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
    await expectNoRuntimeErrors(page);
  });

  test("ArrowRight changes shipAngle", async ({ page }, testInfo) => {
    test.setTimeout(120000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await startGameFromMenu(page, "Space");

    const angleBefore = (await readGameState(page))?.shipAngle ?? 0;
    // Hold ArrowRight to turn starboard
    await pressKeyDownUp(page, "ArrowRight", 400);
    await page.waitForTimeout(200);
    const angleAfter = (await readGameState(page))?.shipAngle ?? angleBefore;
    expect(angleAfter).not.toBe(angleBefore);
  });

  test("ArrowLeft changes shipAngle opposite direction", async ({
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

    // First turn right to establish a baseline
    await pressKeyDownUp(page, "ArrowLeft", 300);
    await page.waitForTimeout(100);
    const angleAfterLeft = (await readGameState(page))?.shipAngle ?? 0;

    // Then turn right from that position
    await pressKeyDownUp(page, "ArrowRight", 300);
    await page.waitForTimeout(100);
    const angleAfterRight =
      (await readGameState(page))?.shipAngle ?? angleAfterLeft;

    // Turning left then right should produce different angles
    expect(angleAfterRight).not.toBe(angleAfterLeft);
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
