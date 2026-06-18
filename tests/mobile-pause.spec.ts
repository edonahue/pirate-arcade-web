import { test, expect } from "@playwright/test";
import { loadPybagGameDetails } from "./helpers/gameRegistry";

interface PirateArcadeInput {
  tap(key: string, holdMs?: number): void;
  pause(): void;
  keyDown(key: string): void;
  keyUp(key: string): void;
  setTouchTarget(axis: string, value: number, active: boolean): void;
  clearTouchTarget(): void;
}

declare global {
  interface Window {
    PirateArcadeInput?: PirateArcadeInput;
  }
}

const GAMES = loadPybagGameDetails().map((g) => ({
  id: g.id,
  path: g.path,
}));

test.describe("mobile pause button", () => {
  for (const game of GAMES) {
    test.describe(game.id, () => {
      test("pause button exists in DOM with correct data-dir", async ({
        page,
      }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });

        const pauseBtn = page.locator(".btn-pause");
        await expect(pauseBtn).toHaveCount(1);
        await expect(pauseBtn).toHaveAttribute("data-dir", "pause");
      });

      test("pause button is inside touch-overlay", async ({ page }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });

        const count = await page.evaluate(() => {
          const overlay = document.getElementById("touch-overlay");
          if (!overlay) return -1;
          return overlay.querySelectorAll(".btn-pause").length;
        });
        expect(count).toBe(1);
      });

      test("controls-hint mentions PAUSE", async ({ page }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });

        await expect(page.locator("#controls-hint")).toContainText("PAUSE", {
          timeout: 5000,
        });
      });
    });
  }
});

test.describe("PirateArcadeInput.pause()", () => {
  test("PirateArcadeInput.pause exists and sends Escape", async ({ page }) => {
    await page.goto("/play/cannonball-clash/", {
      waitUntil: "domcontentloaded",
    });

    const hasPause = await page.evaluate(() => {
      return typeof window.PirateArcadeInput?.pause === "function";
    });
    expect(hasPause).toBe(true);

    const escapeCalls = await page.evaluate(() => {
      const calls: Array<{ method: string; key?: string }> = [];
      const input = window.PirateArcadeInput;
      if (!input) return calls;
      const origTap = input.tap.bind(input);
      input.tap = (k: string, ms?: number) => {
        calls.push({ method: "tap", key: k });
        return origTap(k, ms);
      };
      input.pause();
      return calls;
    });
    expect(escapeCalls.length).toBeGreaterThanOrEqual(1);
    expect(escapeCalls[0].method).toBe("tap");
    expect(escapeCalls[0].key).toBe("Escape");
  });

  test("PirateArcadeInput.pause does not throw", async ({ page }) => {
    await page.goto("/play/cannonball-clash/", {
      waitUntil: "domcontentloaded",
    });

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.evaluate(() => {
      window.PirateArcadeInput?.pause();
    });
    await page.waitForTimeout(300);

    expect(errors).toEqual([]);
  });
});
