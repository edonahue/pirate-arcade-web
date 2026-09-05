import { test, expect } from "./helpers/browserGame";
import {
  waitForPygbagRuntime,
  readGameState,
  expectGamePhase,
} from "./helpers/browserGame";

const DESKTOP_PROJECTS = ["chromium-desktop"];

type LooseState = Record<string, unknown> | null;

async function readBest(page: any, field: string): Promise<number> {
  const state = (await readGameState(page)) as LooseState;
  const value = state?.[field];
  return typeof value === "number" ? value : 0;
}

async function readStoredBest(page: any, key: string): Promise<number | null> {
  return page.evaluate((k: string) => {
    const raw = localStorage.getItem(k);
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? null : n;
  }, key);
}

test.describe("personal-best persistence", () => {
  test("Treasure Cove: full run sets best, survives reload, worse run keeps it", async ({
    page,
  }, testInfo) => {
    test.skip(
      !DESKTOP_PROJECTS.includes(testInfo.project.name),
      `skipped on ${testInfo.project.name}`,
    );

    await page.goto("/play/treasure-cove/");
    await waitForPygbagRuntime(page);
    await expectGamePhase(page, "menu");
    await page.keyboard.press("Enter");
    await expectGamePhase(page, "playing");

    // Park the paddle and drain three lives; brick hits on the way count.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(9000);
      const phase = ((await readGameState(page)) as LooseState)?.phase;
      if (phase === "game-over") break;
    }
    await expectGamePhase(page, "game-over", 60000);

    const endState = (await readGameState(page)) as LooseState;
    const score = (endState?.score as number) ?? 0;
    const newBest = endState?.newBest === true;
    const stored = await readStoredBest(page, "pa-treasure-score");
    // Relationship holds regardless of the exact score achieved.
    expect(stored).toBe(score > 0 ? score : null);
    expect(newBest).toBe(score > 0);

    // Reload: the record must still be there and shown in menu state.
    await page.reload();
    await waitForPygbagRuntime(page);
    await expectGamePhase(page, "menu");
    expect(await readStoredBest(page, "pa-treasure-score")).toBe(stored);
    expect(await readBest(page, "bestScore")).toBe(stored ?? 0);
  });

  test("Treasure Cove: worse run does not replace or re-flag best", async ({
    page,
  }, testInfo) => {
    test.skip(
      !DESKTOP_PROJECTS.includes(testInfo.project.name),
      `skipped on ${testInfo.project.name}`,
    );

    await page.addInitScript(() => {
      localStorage.setItem("pa-treasure-score", "99999");
    });
    await page.goto("/play/treasure-cove/");
    await waitForPygbagRuntime(page);
    await expectGamePhase(page, "menu");
    expect(await readBest(page, "bestScore")).toBe(99999);

    await page.keyboard.press("Enter");
    await expectGamePhase(page, "playing");
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(9000);
      const phase = ((await readGameState(page)) as LooseState)?.phase;
      if (phase === "game-over") break;
    }
    await expectGamePhase(page, "game-over", 60000);

    const endState = (await readGameState(page)) as LooseState;
    expect(endState?.newBest).toBe(false);
    expect(await readStoredBest(page, "pa-treasure-score")).toBe(99999);
  });

  test("Kraken's Wake: seeded best restores into menu state", async ({
    page,
  }, testInfo) => {
    test.skip(
      !DESKTOP_PROJECTS.includes(testInfo.project.name),
      `skipped on ${testInfo.project.name}`,
    );

    await page.addInitScript(() => {
      localStorage.setItem(
        "pa-kraken-scores",
        JSON.stringify({ asteroids: { score: 1500 } }),
      );
    });
    await page.goto("/play/krakens-wake/");
    await waitForPygbagRuntime(page);
    await expectGamePhase(page, "menu");
    expect(await readBest(page, "bestScore")).toBe(1500);
  });

  test("Cannonball Clash: seeded rally restores into menu state", async ({
    page,
  }, testInfo) => {
    test.skip(
      !DESKTOP_PROJECTS.includes(testInfo.project.name),
      `skipped on ${testInfo.project.name}`,
    );

    await page.addInitScript(() => {
      localStorage.setItem("pa-cannonball-rally", "9");
    });
    await page.goto("/play/cannonball-clash/");
    await waitForPygbagRuntime(page);
    await expectGamePhase(page, "menu");
    expect(await readBest(page, "bestRally")).toBe(9);
  });

  test("Race: record-setting loss persists best and flags NEW BEST", async ({
    page,
  }, testInfo) => {
    test.skip(
      !DESKTOP_PROJECTS.includes(testInfo.project.name),
      `skipped on ${testInfo.project.name}`,
    );

    await page.goto("/play/race-to-treasure-island/", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("#game-container", {
      state: "attached",
      timeout: 15000,
    });
    await page.waitForFunction(
      () => {
        const gc = document.getElementById("game-container");
        const canvas = gc?.querySelector("canvas");
        return !!canvas && !!(window as any).__paBootMetrics?.["game-ready"];
      },
      undefined,
      { timeout: 60000 },
    );

    await page.evaluate(() => localStorage.removeItem("pa-race-best"));
    await page.evaluate(() => {
      if (typeof (window as any).__paRaceDebugSetScore === "function") {
        (window as any).__paRaceDebugSetScore(500);
      }
    });
    await page.evaluate(() => {
      if (typeof (window as any).__paRaceDebugSetRivalProgress === "function") {
        (window as any).__paRaceDebugSetRivalProgress(10000);
      }
    });

    await page.waitForFunction(
      () => !!(window as any).__paRaceToTreasureIslandState?.finished,
      undefined,
      { timeout: 60000 },
    );
    const snap = await page.evaluate(
      () => (window as any).__paRaceToTreasureIslandState,
    );
    expect(snap.playerWon).toBe(false);
    expect(snap.score).toBe(500);
    expect(snap.isNewBest).toBe(true);
    expect(snap.bestScore).toBe(500);

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pa-race-best") || "{}"),
    );
    expect(stored.score).toBe(500);
  });
});
