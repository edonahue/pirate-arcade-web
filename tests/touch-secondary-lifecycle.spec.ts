/**
 * Touch secondary-control lifecycle contract.
 *
 * The pause-slot button is phase-aware: its label, accessible name, and
 * action all follow the published game phase. A visible control must
 * truthfully describe what activating it will do:
 *
 *   Pygbag: menu/game-over → ARCADE (explicit hub exit)
 *           playing → PAUSE | paused → RESUME
 *   Race:   playing → PAUSE | paused → RESUME | result → ARCADE
 *
 * Keyboard ESC/P split is covered on desktop projects; pointer-flow
 * touch behavior needs a touch-capable project (mobile-controls.js
 * only installs with coarse pointer or touch support).
 */
import { test, expect } from "./helpers/browserGame";
import {
  waitForPygbagRuntime,
  readGameState,
  waitForGamePhase,
  pointerHoldButton,
  expectNoStrandedGameRuntime,
  expectNoRuntimeErrors,
} from "./helpers/browserGame";

const TOUCH_PROJECTS = ["mobile-chrome", "mobile-safari"];

function skipUnlessTouch(testInfo: any) {
  test.skip(
    !TOUCH_PROJECTS.includes(testInfo.project.name),
    `Touch secondary test skipped on ${testInfo.project.name}`,
  );
}

async function landscape(page: any) {
  await page.setViewportSize({ width: 812, height: 375 });
}

async function secondaryButton(page: any) {
  return page.evaluate(() => {
    const btn = document.querySelector(
      '#touch-overlay .btn-pause[data-dir="pause"]',
    );
    if (!btn) return null;
    return {
      text: btn.textContent,
      aria: btn.getAttribute("aria-label"),
    };
  });
}

async function tapSecondary(page: any) {
  // No teardown-event cascade: production acts on pointerdown, and extra
  // synthetic teardown events only add flake surface.
  await pointerHoldButton(
    page,
    '#touch-overlay .btn-pause[data-dir="pause"]',
    150,
    { fireLostPointerCapture: false },
  );
}

// Fire only pointerdown: pause-slot actions trigger on button press, and
// exit actions navigate away (a pointerup would race the unload).
async function tapDownSecondary(page: any) {
  const locator = page
    .locator('#touch-overlay .btn-pause[data-dir="pause"]')
    .first();
  await locator.waitFor({ state: "visible", timeout: 15000 });
  const box = await locator.boundingBox();
  if (!box) throw new Error("No bounding box for touch secondary");
  await locator.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
    button: 0,
    buttons: 1,
    bubbles: true,
    cancelable: true,
  });
  await page.waitForTimeout(150);
}

async function expectHub(page: any, gameId: string) {
  await page.waitForURL(
    (url: URL) => {
      const u = url.toString();
      return u.includes("/play/") && !u.includes(`/play/${gameId}/`);
    },
    // Full-page navigation; generous headroom for loaded shared runners.
    { timeout: 30000 },
  );
  expect(page.url()).toContain("/play/");
}

// Start via the touch action button: canvas clicks are intercepted by
// the touch overlay on touch projects. Kraken hides its action button
// (menu confirm is keyboard-only there), so it starts via keyboard.
async function startViaTouch(page: any, gameId: string) {
  if (gameId === "krakens-wake") {
    await page.keyboard.press("Space");
  } else {
    await pointerHoldButton(
      page,
      '#touch-overlay .btn-action[data-dir="action"]',
      150,
      { fireLostPointerCapture: false },
    );
  }
  await waitForGamePhase(page, "playing");
}

// ── Pygbag secondary matrix ──────────────────────────────────
const PYGBAG_GAMES = [
  { id: "cannonball-clash", startKey: "Enter" },
  { id: "treasure-cove", startKey: "Space" },
  { id: "krakens-wake", startKey: "Space" },
];

test.describe("Pygbag touch secondary control", () => {
  for (const game of PYGBAG_GAMES) {
    test(`${game.id}: menu secondary is ARCADE and exits to hub`, async ({
      page,
    }, testInfo) => {
      skipUnlessTouch(testInfo);
      test.setTimeout(120000);
      await landscape(page);
      await page.goto(`/play/${game.id}/`, { waitUntil: "domcontentloaded" });
      await waitForPygbagRuntime(page);
      await page.waitForTimeout(1500);

      const btn = await secondaryButton(page);
      expect(btn?.text).toBe("ARCADE");
      expect(btn?.aria).toBe("Back to Arcade");

      await tapDownSecondary(page);
      await expectHub(page, game.id);
    });

    test(`${game.id}: playing PAUSE, paused RESUME via touch`, async ({
      page,
    }, testInfo) => {
      skipUnlessTouch(testInfo);
      test.setTimeout(180000);
      await landscape(page);
      await page.goto(`/play/${game.id}/`, { waitUntil: "domcontentloaded" });
      await waitForPygbagRuntime(page);
      await startViaTouch(page, game.id);

      expect((await secondaryButton(page))?.text).toBe("PAUSE");
      await tapSecondary(page);
      await waitForGamePhase(page, "paused");
      const resumed = await secondaryButton(page);
      expect(resumed?.text).toBe("RESUME");
      expect(resumed?.aria).toBe("Resume");

      await tapSecondary(page);
      await waitForGamePhase(page, "playing");
      expect((await secondaryButton(page))?.text).toBe("PAUSE");
      await expectNoStrandedGameRuntime(page, game.id);
      await expectNoRuntimeErrors(page);
    });
  }

  test("treasure-cove: game-over secondary is ARCADE and exits to hub", async ({
    page,
  }, testInfo) => {
    skipUnlessTouch(testInfo);
    test.setTimeout(420000);
    await landscape(page);
    await page.goto("/play/treasure-cove/", { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await startViaTouch(page, "treasure-cove");

    // Organic game-over: corner-park the paddle so every ball drains.
    // Serves use trusted keyboard (proven path); only the final exit
    // uses the touch secondary under test.
    await page.keyboard.down("ArrowLeft");
    try {
      const deadline = Date.now() + 300000;
      for (;;) {
        const state = await readGameState(page);
        if (state?.phase === "game-over") break;
        if (Date.now() > deadline) {
          throw new Error("timed out waiting for game-over");
        }
        if (!state?.ballLaunched) {
          await page.keyboard.press("Space");
        }
        await page.waitForTimeout(2000);
      }
    } finally {
      await page.keyboard.up("ArrowLeft").catch(() => {});
    }

    const btn = await secondaryButton(page);
    expect(btn?.text).toBe("ARCADE");
    expect(btn?.aria).toBe("Back to Arcade");

    await tapDownSecondary(page);
    await expectHub(page, "treasure-cove");
  });

  test("touch secondary never strands the runtime (krakens-wake)", async ({
    page,
  }, testInfo) => {
    skipUnlessTouch(testInfo);
    test.setTimeout(180000);
    await landscape(page);
    await page.goto("/play/krakens-wake/", { waitUntil: "domcontentloaded" });
    await waitForPygbagRuntime(page);
    await startViaTouch(page, "krakens-wake");
    await tapSecondary(page);
    await waitForGamePhase(page, "paused");
    await expectNoStrandedGameRuntime(page, "krakens-wake");
    await tapSecondary(page);
    await waitForGamePhase(page, "playing");
    await expectNoStrandedGameRuntime(page, "krakens-wake");
    await expectNoRuntimeErrors(page);
  });
});

// ── Race keyboard ESC/P split (desktop-safe) ─────────────────
test.describe("Race keyboard ESC/P split", () => {
  async function goToRace(page: any) {
    // Landscape: the rotate prompt hides game content on portrait phones.
    await landscape(page);
    await page.goto("/play/race-to-treasure-island/?skipCountdown&testMode", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(
      () => !!(window as any).__paBootMetrics?.["game-ready"],
      null,
      { timeout: 60000 },
    );
    await page.locator("#game-container canvas").click({ timeout: 15000 });
    await page.waitForFunction(
      () =>
        JSON.parse((window as any).__pa_game_state_json).phase === "playing",
      null,
      { timeout: 30000 },
    );
  }

  test("P pauses and resumes but never navigates from result", async ({
    page,
  }) => {
    test.setTimeout(180000);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    await goToRace(page);

    await page.keyboard.press("p");
    await page.waitForFunction(
      () => JSON.parse((window as any).__pa_game_state_json).phase === "paused",
      null,
      { timeout: 15000 },
    );
    await page.waitForTimeout(500);
    await page.keyboard.press("p");
    await page.waitForFunction(
      () =>
        JSON.parse((window as any).__pa_game_state_json).phase === "playing",
      null,
      { timeout: 15000 },
    );

    await page.evaluate(() => (window as any).__paRaceDebugFinish());
    await page.waitForFunction(
      () =>
        JSON.parse((window as any).__pa_game_state_json).phase === "game-over",
      null,
      { timeout: 15000 },
    );
    const before = page.url();
    await page.keyboard.press("p");
    await page.waitForTimeout(1000);
    expect(page.url()).toBe(before);
    expect(
      JSON.parse(
        await page.evaluate(() => (window as any).__pa_game_state_json),
      ).phase,
    ).toBe("game-over");
    expect(pageErrors).toEqual([]);
  });

  test("ESC navigates from result to hub", async ({ page }) => {
    test.setTimeout(180000);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    await goToRace(page);
    await page.evaluate(() => (window as any).__paRaceDebugFinish());
    await page.waitForFunction(
      () =>
        JSON.parse((window as any).__pa_game_state_json).phase === "game-over",
      null,
      { timeout: 15000 },
    );

    await page.keyboard.press("Escape");
    await page.waitForURL(
      (url) => {
        const u = url.toString();
        return (
          u.includes("/play/") && !u.includes("/play/race-to-treasure-island/")
        );
      },
      { timeout: 15000 },
    );
    expect(page.url()).toContain("/play/");
    expect(pageErrors).toEqual([]);
  });

  test("Enter restarts from result", async ({ page }) => {
    test.setTimeout(180000);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    await goToRace(page);
    await page.evaluate(() => (window as any).__paRaceDebugFinish());
    await page.waitForFunction(
      () =>
        JSON.parse((window as any).__pa_game_state_json).phase === "game-over",
      null,
      { timeout: 15000 },
    );

    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () =>
        JSON.parse((window as any).__pa_game_state_json).phase === "playing",
      null,
      { timeout: 15000 },
    );
    expect(pageErrors).toEqual([]);
  });
});

// ── Race touch secondary (touch project) ─────────────────────
test.describe("Race touch secondary control", () => {
  test("result secondary reads ARCADE and exits; mid-race pauses", async ({
    page,
  }, testInfo) => {
    skipUnlessTouch(testInfo);
    test.setTimeout(180000);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    await landscape(page);
    await page.goto("/play/race-to-treasure-island/?skipCountdown&testMode", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(
      () => !!(window as any).__paBootMetrics?.["game-ready"],
      null,
      { timeout: 60000 },
    );

    const pauseBtn = page.locator("#btn-pause").first();
    await pauseBtn.waitFor({ state: "visible", timeout: 15000 });
    await pointerHoldButton(page, "#btn-pause", 150, {
      fireLostPointerCapture: false,
    });
    await page.waitForFunction(
      () => JSON.parse((window as any).__pa_game_state_json).phase === "paused",
      null,
      { timeout: 15000 },
    );
    await pointerHoldButton(page, "#btn-pause", 150, {
      fireLostPointerCapture: false,
    });
    await page.waitForFunction(
      () =>
        JSON.parse((window as any).__pa_game_state_json).phase === "playing",
      null,
      { timeout: 15000 },
    );

    await page.evaluate(() => (window as any).__paRaceDebugFinish());
    await page.waitForFunction(
      () =>
        JSON.parse((window as any).__pa_game_state_json).phase === "game-over",
      null,
      { timeout: 15000 },
    );
    const label = await page.evaluate(() => ({
      text: document
        .getElementById("btn-pause")
        ?.querySelector(".touch-btn__label")?.textContent,
      iconHidden:
        (
          document
            .getElementById("btn-pause")
            ?.querySelector(".touch-btn__icon") as HTMLElement | null
        )?.style.display === "none",
      aria: document.getElementById("btn-pause")?.getAttribute("aria-label"),
    }));
    expect(label.text).toBe("ARCADE");
    expect(label.iconHidden).toBe(true);
    expect(label.aria).toBe("Back to Arcade");

    await pointerHoldButton(page, "#btn-pause", 150, {
      fireLostPointerCapture: false,
    });
    await page.waitForURL(
      (url) => {
        const u = url.toString();
        return (
          u.includes("/play/") && !u.includes("/play/race-to-treasure-island/")
        );
      },
      { timeout: 15000 },
    );
    expect(page.url()).toContain("/play/");
    expect(pageErrors).toEqual([]);
  });
});
