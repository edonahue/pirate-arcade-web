/**
 * Pygbag lifecycle regression tests.
 *
 * Tests real behavior: loading state machine, lifecycle API
 * (disposer/idempotent/navigation), exit semantics, and per-game
 * UI contract.
 */

import { test, expect } from "./helpers/browserGame";
import {
  waitForPygbagRuntime,
  holdKeyUntilState,
  waitForGamePhase,
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

// ── Treasure Cove: Quit to Menu stays internal ─────────────────
// NOTE: These tests depend on Escape KEYDOWN which Pygbag does not
// process in headless Chromium (Pygbag's SDL1 queue does not map
// Escape keyCode 27 in headless mode, and the Python bridge cannot
// reach the game instance from PyRun_SimpleString in WASM sandbox).
test.describe("Treasure Cove exit semantics", () => {
  async function quitToMenu(page: any) {
    await goToGame(page, "treasure-cove");

    // Start game and wait for playing phase
    await page.keyboard.press("Enter");
    await waitForGamePhase(page, "playing", 10000);

    // Pause by holding Escape until phase changes.
    // Fall back to DOM keydown if Python bridge is unavailable.
    await holdKeyUntilState(page, "Escape", "state => state && state.phase === 'paused'", 5000);

    // Quit to Menu is the 5th pause menu item (0-indexed: 4).
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(80);
    }
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }

  test.skip("pause Quit to Menu stays in Treasure Cove URL", async ({ page }) => {
    await quitToMenu(page);

    const url = page.url();
    expect(url).toContain("/play/treasure-cove/");
  });

  test.skip("pause Quit to Menu does not trigger error or dispose", async ({
    page,
  }) => {
    await quitToMenu(page);

    const ls = await getLoadingState(page);
    expect(ls.errored).toBe(false);

    const lcState = await getLifecycleState(page);
    expect(lcState.disposed).toBe(false);
  });

  test.skip("pause Quit to Menu returns to menu phase", async ({ page }) => {
    await quitToMenu(page);

    const gs = await page.evaluate(() => {
      const gs = (window as any).PirateArcadeGameState?.getState?.();
      return gs ?? null;
    });
    expect(gs).not.toBeNull();
    expect(gs.phase).toBe("menu");
    expect(gs.actionReady).toBe(true);
  });

  test.skip("can restart from menu after pause Quit to Menu", async ({ page }) => {
    await quitToMenu(page);

    await page.keyboard.press("Space");
    await waitForGamePhase(page, "playing", 10000);
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

      await page.waitForTimeout(800);

      const url = page.url();
      expect(url).toContain("/play/");
      expect(url).not.toContain(`/play/${gameId}/`);
    });
  }
});
