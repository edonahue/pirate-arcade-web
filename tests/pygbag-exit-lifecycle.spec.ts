/**
 * Lifecycle regression tests (Pygbag + Race).
 *
 * Tests real behavior end to end: loading state machine, lifecycle API
 * (disposer/idempotent/navigation), ESC pause/resume, pause-menu Quit to
 * Menu staying internal with replay, menu/result ESC exits to the Arcade
 * hub, Race result lifecycle, Back-link navigation, and a collection
 * tour with browser-Back re-entry.
 *
 * Contract under test:
 *   internal menu + ESC → hub | play + ESC → pause | paused + ESC → resume
 *   pause Quit to Menu → internal menu | menu Start → new match
 *   result + primary → new match | result + ESC → hub
 *   shell Back link (any state) → hub
 */

import { test, expect } from "./helpers/browserGame";
import {
  waitForPygbagRuntime,
  holdKeyUntilState,
  waitForGamePhase,
  startGameFromMenu,
  readGameState,
  expectNoRuntimeErrors,
  expectNoStrandedGameRuntime,
} from "./helpers/browserGame";

// ── Helpers ───────────────────────────────────────────────────
async function goToGame(page: any, gameId: string) {
  await page.goto(`/play/${gameId}/`);
  await waitForPygbagRuntime(page);
}

async function getLoadingState(page: any) {
  return page.evaluate(() => (window as any).PirateArcadeLoading.getState());
}

async function getLifecycleState(page: any) {
  return page.evaluate(() => (window as any).PirateArcadeLifecycle.getState());
}

// ── Loading API ───────────────────────────────────────────────
test.describe("PirateArcadeLoading", () => {
  test("ready() hides #game-loading", async ({ page }) => {
    await goToGame(page, "cannonball-clash");

    const state = await getLoadingState(page);
    expect(state.ready).toBe(true);

    const hidden = await page.evaluate(() => {
      const el = document.getElementById("game-loading");
      return el ? el.classList.contains("hidden") : false;
    });
    expect(hidden).toBe(true);
  });

  test("loading state reports elementPresent=false when element removed from DOM", async ({
    page,
  }) => {
    await goToGame(page, "cannonball-clash");

    await page.evaluate(() => {
      const el = document.getElementById("game-loading");
      if (el) el.remove();
    });

    const state = await getLoadingState(page);
    expect(state.elementPresent).toBe(false);
    expect(state.elementVisible).toBe(false);
  });
});

// ── Lifecycle API ─────────────────────────────────────────────
test.describe("PirateArcadeLifecycle API", () => {
  test("exists on window with ownership marker", async ({ page }) => {
    await goToGame(page, "cannonball-clash");

    const info = await page.evaluate(() => {
      const lc = (window as any).PirateArcadeLifecycle;
      return {
        exists: !!lc,
        owned: lc?.__pirateArcadeOwned,
        hasInit: typeof lc?.init === "function",
        hasAddDisposer: typeof lc?.addDisposer === "function",
        hasRemoveDisposer: typeof lc?.removeDisposer === "function",
        hasDispose: typeof lc?.dispose === "function",
        hasExitToArcade: typeof lc?.exitToArcade === "function",
        hasGetState: typeof lc?.getState === "function",
      };
    });

    expect(info.exists).toBe(true);
    expect(info.owned).toBe(true);
    expect(info.hasInit).toBe(true);
    expect(info.hasAddDisposer).toBe(true);
    expect(info.hasRemoveDisposer).toBe(true);
    expect(info.hasDispose).toBe(true);
    expect(info.hasExitToArcade).toBe(true);
    expect(info.hasGetState).toBe(true);
  });

  test("getState returns correct shape and initialized phase", async ({
    page,
  }) => {
    await goToGame(page, "cannonball-clash");

    const s = await getLifecycleState(page);
    expect(s).toHaveProperty("phase");
    expect(s).toHaveProperty("disposed");
    expect(s).toHaveProperty("intentionalExit");
    expect(s).toHaveProperty("exitReason");
    expect(s).toHaveProperty("navigationDone");
    expect(s).toHaveProperty("disposerCount");
    expect(s).toHaveProperty("disposalErrorCount");
    expect(s).toHaveProperty("visibilityChangeCount");
    expect(typeof s.phase).toBe("string");
    expect(typeof s.disposed).toBe("boolean");
    expect(typeof s.disposerCount).toBe("number");

    expect(s.phase).toBe("initialized");
    expect(s.disposed).toBe(false);
  });

  test("addDisposer increases disposerCount", async ({ page }) => {
    await goToGame(page, "cannonball-clash");

    const before = await getLifecycleState(page);
    await page.evaluate(() => {
      (window as any).PirateArcadeLifecycle.addDisposer(() => {});
    });
    const after = await getLifecycleState(page);
    expect(after.disposerCount).toBe(before.disposerCount + 1);
  });

  test("removeDisposer decreases disposerCount", async ({ page }) => {
    await goToGame(page, "cannonball-clash");

    const fnName = "__testRemoveFn";
    await page.evaluate((name) => {
      (window as any)[name] = () => {};
      (window as any).PirateArcadeLifecycle.addDisposer((window as any)[name]);
    }, fnName);

    const afterAdd = await getLifecycleState(page);
    expect(afterAdd.disposerCount).toBeGreaterThanOrEqual(1);

    await page.evaluate((name) => {
      (window as any).PirateArcadeLifecycle.removeDisposer(
        (window as any)[name],
      );
    }, fnName);

    const afterRemove = await getLifecycleState(page);
    expect(afterRemove.disposerCount).toBe(afterAdd.disposerCount - 1);
  });

  test("dispose runs registered disposers exactly once", async ({ page }) => {
    await goToGame(page, "cannonball-clash");

    await page.evaluate(() => {
      (window as any).__disposerRuns = 0;
      (window as any).PirateArcadeLifecycle.addDisposer(() => {
        (window as any).__disposerRuns++;
      });
      (window as any).PirateArcadeLifecycle.addDisposer(() => {
        (window as any).__disposerRuns++;
      });
    });

    await page.evaluate(() => {
      (window as any).PirateArcadeLifecycle.dispose();
    });

    const runs = await page.evaluate(() => (window as any).__disposerRuns);
    expect(runs).toBe(2);
  });

  test("dispose is idempotent (second call is no-op)", async ({ page }) => {
    await goToGame(page, "cannonball-clash");

    await page.evaluate(() => {
      (window as any).__disposerRuns = 0;
      (window as any).PirateArcadeLifecycle.addDisposer(() => {
        (window as any).__disposerRuns++;
      });
      (window as any).PirateArcadeLifecycle.dispose();
      (window as any).PirateArcadeLifecycle.dispose();
    });

    const runs = await page.evaluate(() => (window as any).__disposerRuns);
    expect(runs).toBe(1);

    const s = await getLifecycleState(page);
    expect(s.disposed).toBe(true);
    expect(s.disposerCount).toBe(0);
  });

  test("throwing disposer increments disposalErrorCount and does not stop later disposers", async ({
    page,
  }) => {
    await goToGame(page, "cannonball-clash");

    await page.evaluate(() => {
      (window as any).__lifecycleTestResults = [];
      (window as any).PirateArcadeLifecycle.addDisposer(() => {
        throw new Error("boom");
      });
      (window as any).PirateArcadeLifecycle.addDisposer(() => {
        (window as any).__lifecycleTestResults.push("second-ran");
      });
      (window as any).PirateArcadeLifecycle.dispose();
    });

    const s = await getLifecycleState(page);
    expect(s.disposalErrorCount).toBeGreaterThanOrEqual(1);

    const results = await page.evaluate(
      () => (window as any).__lifecycleTestResults,
    );
    expect(results).toContain("second-ran");
  });

  test("visibilitychange increments diagnostics but does NOT dispose", async ({
    page,
  }) => {
    await goToGame(page, "cannonball-clash");

    const before = await getLifecycleState(page);

    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        get: () => true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    const after = await getLifecycleState(page);
    expect(after.visibilityChangeCount).toBeGreaterThanOrEqual(
      before.visibilityChangeCount + 1,
    );
    expect(after.disposed).toBe(false);
    expect(after.phase).toBe("initialized");
  });

  test("addDisposer then dispose clears; state reflects progression", async ({
    page,
  }) => {
    await goToGame(page, "cannonball-clash");

    const s0 = await getLifecycleState(page);
    expect(s0.disposed).toBe(false);

    await page.evaluate(() => {
      (window as any).PirateArcadeLifecycle.addDisposer(() => {});
      (window as any).PirateArcadeLifecycle.dispose();
    });

    const s1 = await getLifecycleState(page);
    expect(s1.disposed).toBe(true);
    expect(s1.disposerCount).toBe(0);
  });
});

// ── Per-game UI contract ──────────────────────────────────────
const BROWSER_GAMES = ["cannonball-clash", "treasure-cove", "krakens-wake"];

test.describe("Per-game UI basics", () => {
  for (const gameId of BROWSER_GAMES) {
    test(`${gameId}: loading reaches ready`, async ({ page }) => {
      await goToGame(page, gameId);
      const s = await getLoadingState(page);
      expect(s.ready).toBe(true);
    });

    test(`${gameId}: #game-loading hidden after boot`, async ({ page }) => {
      await goToGame(page, gameId);
      const hidden = await page.evaluate(() => {
        const el = document.getElementById("game-loading");
        return el ? el.classList.contains("hidden") : false;
      });
      expect(hidden).toBe(true);
    });

    test(`${gameId}: #infobox hidden after boot`, async ({ page }) => {
      await goToGame(page, gameId);
      const info = await page.evaluate(() => {
        const el = document.getElementById("infobox");
        if (!el) return { exists: false };
        const cs = window.getComputedStyle(el);
        return {
          exists: true,
          ariaHidden: el.getAttribute("aria-hidden"),
          display: cs.display,
          textContent: el.textContent || "",
        };
      });
      expect(info.exists).toBe(true);
      expect(info.ariaHidden).toBe("true");
      expect(info.display).toBe("none");
    });

    test(`${gameId}: visibilitychange does NOT dispose`, async ({ page }) => {
      await goToGame(page, gameId);

      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          get: () => true,
          configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      const s = await getLifecycleState(page);
      expect(s.disposed).toBe(false);
      expect(s.phase).toBe("initialized");
    });
  }
});

// ── ESC pause/resume contract ────────────────────────────────
// Trusted keyboard delivery (page.keyboard) reaches Pygame exactly once.
// Proves the full chain: DOM input → Pygame event → _handle_key →
// published phase. Python unit tests still own state-machine semantics;
// these tests own the live chain.
test.describe("Pygbag ESC pause/resume", () => {
  for (const gameId of BROWSER_GAMES) {
    test(`${gameId}: ESC pauses and ESC resumes`, async ({ page }) => {
      test.setTimeout(120000);
      await goToGame(page, gameId);
      await startGameFromMenu(
        page,
        gameId === "cannonball-clash" ? "Enter" : "Space",
      );

      await page.keyboard.press("Escape");
      await waitForGamePhase(page, "paused");
      await expectNoStrandedGameRuntime(page, gameId);

      await page.keyboard.press("Escape");
      await waitForGamePhase(page, "playing");
      await expectNoStrandedGameRuntime(page, gameId);
      await expectNoRuntimeErrors(page);
    });
  }

  test("bridge Escape tap pauses exactly once (no double delivery)", async ({
    page,
  }) => {
    test.setTimeout(120000);
    // Regression: the DOM fallback used to fire unconditionally alongside
    // the Python bridge, toggling pause twice (pause then instant resume).
    // PirateArcadeInput.tap must produce exactly one KEYDOWN.
    await goToGame(page, "treasure-cove");
    await startGameFromMenu(page, "Space");

    await page.evaluate(() =>
      (window as any).PirateArcadeInput.tap("Escape", 120),
    );
    await waitForGamePhase(page, "paused");
    // Still paused after the key-up lands: no phantom second toggle.
    await page.waitForTimeout(800);
    expect((await readGameState(page))?.phase).toBe("paused");
    await expectNoStrandedGameRuntime(page, "treasure-cove");

    // Touch uses the same path (releaseAll + Escape tap).
    await page.evaluate(() => (window as any).PirateArcadeInput.pause());
    await waitForGamePhase(page, "playing");
    await expectNoStrandedGameRuntime(page, "treasure-cove");
    await expectNoRuntimeErrors(page);
  });
});

// ── Quit to Menu stays internal, replay works ─────────────────
// Pause-menu "Quit to Menu" must show the game's own title menu with the
// runtime alive, and a new match must start from it.
const QUIT_MENU_DOWNS: Record<string, number> = {
  "cannonball-clash": 5,
  "treasure-cove": 4,
  "krakens-wake": 4,
};

test.describe("Pygbag Quit to Menu", () => {
  for (const gameId of BROWSER_GAMES) {
    test(`${gameId}: Quit to Menu shows internal menu, replay works`, async ({
      page,
    }) => {
      test.setTimeout(180000);
      await goToGame(page, gameId);
      await startGameFromMenu(
        page,
        gameId === "cannonball-clash" ? "Enter" : "Space",
      );

      await page.keyboard.press("Escape");
      await waitForGamePhase(page, "paused");

      const downs = QUIT_MENU_DOWNS[gameId];
      for (let i = 0; i < downs; i++) {
        await page.keyboard.press("s");
        await page.waitForTimeout(300);
      }
      await page.keyboard.press("Space");
      await waitForGamePhase(page, "menu");
      // Runtime must be alive: boot never saw a run() return.
      await expectNoStrandedGameRuntime(page, gameId);
      const urlAfterQuit = page.url();
      expect(urlAfterQuit).toContain(`/play/${gameId}/`);

      // Second match starts from the internal menu.
      await page.keyboard.press("Space");
      await waitForGamePhase(page, "playing");
      await expectNoStrandedGameRuntime(page, gameId);
      await expectNoRuntimeErrors(page);
    });
  }
});

// ── Menu ESC exits to the Arcade hub ─────────────────────────
test.describe("Pygbag menu ESC exits", () => {
  for (const gameId of BROWSER_GAMES) {
    test(`${gameId}: ESC on internal menu navigates to hub`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await goToGame(page, gameId);
      // No start: the internal title menu is showing.
      await page.keyboard.press("Escape");
      await page.waitForURL(
        (url) => {
          const u = url.toString();
          return u.includes("/play/") && !u.includes(`/play/${gameId}/`);
        },
        { timeout: 15000 },
      );
      expect(page.url()).toContain("/play/");
    });
  }
});

// ── Game-over ESC exits to the Arcade hub ────────────────────
// Treasure Cove reaches game-over fastest deterministically: park the
// paddle in the corner so every ball drains, serving with Space each round.
test.describe("Pygbag game-over ESC exits", () => {
  test("treasure-cove: game-over ESC navigates to hub", async ({ page }) => {
    test.setTimeout(420000);
    await goToGame(page, "treasure-cove");
    await startGameFromMenu(page, "Space");

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

    await page.keyboard.press("Escape");
    await page.waitForURL(
      (url) => {
        const u = url.toString();
        return u.includes("/play/") && !u.includes("/play/treasure-cove/");
      },
      { timeout: 15000 },
    );
    expect(page.url()).toContain("/play/");
  });
});

// ── Race lifecycle (web-native; no Pygbag run-return) ──────
// Race boots straight into countdown→race (no internal menu).
// Contract: active ESC pauses, paused ESC resumes, result ESC exits
// to the hub, Enter restarts, Back link exits.
async function goToRace(page: any, query = "") {
  await page.goto(`/play/race-to-treasure-island/${query}`);
  await page.waitForFunction(
    () => !!(window as any).__paBootMetrics?.["game-ready"],
    null,
    { timeout: 60000 },
  );
}

async function readRaceState(page: any) {
  return page.evaluate(() => JSON.parse((window as any).__pa_game_state_json));
}

test.describe("Race lifecycle", () => {
  test("ESC pauses and resumes an active race", async ({ page }) => {
    test.setTimeout(180000);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    await goToRace(page, "?skipCountdown&testMode");
    await page.locator("#game-container canvas").click({ timeout: 15000 });
    await page.waitForFunction(
      () =>
        JSON.parse((window as any).__pa_game_state_json).phase === "playing",
      null,
      { timeout: 30000 },
    );

    // Rival progress advances while racing; frozen while paused.
    // (playerPosition/secondaryPosition are the player ship's Y/X and
    // only move when steering, so rival progress is the activity signal.)
    const rivalProgress = () =>
      page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState?.rivalProgress,
      );
    const running = await rivalProgress();
    await page.waitForTimeout(1000);
    const runningLater = await rivalProgress();
    expect(runningLater).not.toBe(running);

    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => JSON.parse((window as any).__pa_game_state_json).phase === "paused",
      null,
      { timeout: 15000 },
    );
    const frozen = await page.evaluate(
      () => (window as any).__paRaceToTreasureIslandState?.rivalProgress,
    );
    await page.waitForTimeout(1000);
    expect(
      await page.evaluate(
        () => (window as any).__paRaceToTreasureIslandState?.rivalProgress,
      ),
    ).toBe(frozen);

    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () =>
        JSON.parse((window as any).__pa_game_state_json).phase === "playing",
      null,
      { timeout: 15000 },
    );
    expect(pageErrors).toEqual([]);
  });

  test("result ESC navigates to hub, Enter restarts", async ({ page }) => {
    test.setTimeout(180000);
    await goToRace(page, "?skipCountdown&testMode");
    await page.locator("#game-container canvas").click({ timeout: 15000 });
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
  });

  test("result Enter restarts the race", async ({ page }) => {
    test.setTimeout(180000);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    await goToRace(page, "?skipCountdown&testMode");
    await page.locator("#game-container canvas").click({ timeout: 15000 });
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

// ── Collection tour: hub → each game → hub ───────────────────
// Catches init/disposer/stale-state bugs that isolated fresh-page
// tests cannot: every entry must boot, start, play, and exit cleanly.
test.describe("Collection tour", () => {
  test("hub → all four games → hub, then Back-button re-entry", async ({
    page,
  }) => {
    test.setTimeout(600000);
    const tour = [
      { id: "cannonball-clash", startKey: "Enter", pygbag: true },
      { id: "treasure-cove", startKey: "Space", pygbag: true },
      { id: "krakens-wake", startKey: "Space", pygbag: true },
      { id: "race-to-treasure-island", startKey: "Enter", pygbag: false },
    ];
    for (const game of tour) {
      if (game.pygbag) {
        await goToGame(page, game.id);
        await startGameFromMenu(page, game.startKey);
        await waitForGamePhase(page, "playing");
      } else {
        await goToRace(page, "?skipCountdown&testMode");
        await page.locator("#game-container canvas").click({ timeout: 15000 });
        await page.waitForFunction(
          () =>
            JSON.parse((window as any).__pa_game_state_json).phase ===
            "playing",
          null,
          { timeout: 30000 },
        );
      }
      await expectNoStrandedGameRuntime(page, game.id);
      await page.locator("#back-link").click();
      await page.waitForURL(
        (url) => {
          const u = url.toString();
          return u.includes("/play/") && !u.includes(`/play/${game.id}/`);
        },
        { timeout: 15000 },
      );
    }

    // Browser Back returns to a usable game page: start again, no reload.
    const tourErrors: string[] = [];
    page.on("pageerror", (err) => tourErrors.push(String(err)));
    await page.goBack();
    expect(page.url()).toContain("/play/race-to-treasure-island/");
    await page.locator("#game-container canvas").click({ timeout: 15000 });
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () =>
        JSON.parse((window as any).__pa_game_state_json).phase === "playing",
      null,
      { timeout: 30000 },
    );
    expect(tourErrors).toEqual([]);
  });
});

// ── Back link ─────────────────────────────────────────────────
test.describe("Back to Arcade link", () => {
  for (const gameId of BROWSER_GAMES) {
    test(`${gameId}: Back to Arcade navigates to hub`, async ({ page }) => {
      await goToGame(page, gameId);

      const backLink = page.locator("#back-link");
      await expect(backLink).toBeVisible();
      await backLink.click();

      await page.waitForURL(
        (url) => {
          const u = url.toString();
          return u.includes("/play/") && !u.includes(`/play/${gameId}/`);
        },
        { timeout: 5000 },
      );

      const url = page.url();
      expect(url).toContain("/play/");
      expect(url).not.toContain(`/play/${gameId}/`);
    });
  }
});
