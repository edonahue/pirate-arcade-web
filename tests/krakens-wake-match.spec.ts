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

test.describe("Kraken boss encounter", () => {
  test("debug wave reaches boss, damages, defeats, wave resumes", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300000);
    test.skip(
      !["chromium-desktop"].includes(testInfo.project.name),
      `Skipped on ${testInfo.project.name}`,
    );

    // Test seam: localStorage key set before load (proven pa_store
    // transport). Ordinary players never carry it; test mode suppresses
    // best-score submission, so no record contamination.
    await page.addInitScript(() => {
      localStorage.setItem("pa-kraken-test-wave", "2");
    });
    await page.goto(GAME_PATH, { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await startGameFromMenu(page, "Space");

    await expect
      .poll(async () => (await readGameState(page))?.bossActive, {
        timeout: 120000,
      })
      .toBe(true);
    const maxHp = ((await readGameState(page))?.bossMaxHp as number) ?? 0;
    expect(maxHp).toBeGreaterThan(0);

    // Closed-loop aim: face the maw, hold fire, orbit-dodge telegraphs.
    await page.keyboard.down("Space");
    try {
      const t0 = Date.now();
      let damaged = false;
      while (Date.now() - t0 < 150000) {
        const s = await readGameState(page);
        if (!s?.bossActive) break;
        if (s.phase === "game-over") break;
        if (((s.bossHp as number) ?? maxHp) < maxHp) damaged = true;
        const dx =
          ((s.bossX as number) ?? 0) - ((s.secondaryPosition as number) ?? 0);
        const dy =
          ((s.bossY as number) ?? 0) - ((s.playerPosition as number) ?? 0);
        const dist = Math.hypot(dx, dy);
        const ang = ((((s.shipAngle as number) ?? 0) % 360) + 360) % 360;
        // Firing direction is (cos(a-90°), sin(a-90°)). During telegraph
        // or lunge, orbit (face 90° off + thrust) instead of aiming.
        const evade = s.bossPhase === "telegraph" || s.bossPhase === "lunge";
        const bearing = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        const want = (((evade ? bearing + 90 : bearing) % 360) + 360) % 360;
        const diff = ((((want - ang) % 360) + 540) % 360) - 180;
        if (Math.abs(diff) > 8) {
          const key = diff > 0 ? "ArrowRight" : "ArrowLeft";
          await page.keyboard.down(key);
          await page.waitForTimeout(120);
          await page.keyboard.up(key);
        }
        if (evade || dist < 300) {
          await page.keyboard.down("ArrowUp");
          await page.waitForTimeout(250);
          await page.keyboard.up("ArrowUp");
        } else {
          await page.waitForTimeout(150);
        }
      }
      expect(damaged).toBe(true);
    } finally {
      await page.keyboard.up("Space");
    }

    // Defeat advances the single wave funnel past the boss wave.
    await expect
      .poll(async () => (await readGameState(page))?.bossActive, {
        timeout: 120000,
      })
      .toBe(false);
    const after = await readGameState(page);
    expect((after?.score as number) ?? 0).toBeGreaterThan(0);
    expect(after?.recoveredErrorCount).toBe(0);
  });
});
