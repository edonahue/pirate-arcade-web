import { test, expect } from "./helpers/browserGame";

const MOBILE_PROJECTS = ["mobile-chrome", "mobile-safari"];

interface BridgeCall {
  key: string;
  down: boolean;
  ok: boolean;
  ts: number;
}

const GAMES = [
  {
    id: "cannonball-clash",
    name: "Cannonball Clash",
    path: "/play/cannonball-clash/",
    controls: "pong",
    actionKeys: ["Enter", "Space"],
    movement: [
      { dir: "left", keys: ["ArrowUp", "w"] },
      { dir: "right", keys: ["ArrowDown", "s"] },
    ],
  },
  {
    id: "treasure-cove",
    name: "Treasure Cove",
    path: "/play/treasure-cove/",
    controls: "breakout",
    actionKeys: ["Enter", "Space"],
    movement: [
      { dir: "left", keys: ["ArrowLeft", "a"] },
      { dir: "right", keys: ["ArrowRight", "d"] },
    ],
  },
];

test.describe("mobile touch playability", () => {
  for (const game of GAMES) {
    test.describe(game.name, () => {
      test("loading overlay shows status and hides after ready", async ({
        page,
      }, testInfo) => {
        test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "skipped");

        await page.setViewportSize({ width: 932, height: 430 });
        await page.goto(game.path, { waitUntil: "domcontentloaded" });

        const loadingEl = page.locator("#game-loading");
        await expect(loadingEl).toBeVisible({ timeout: 3000 });
        await expect(page.locator("#game-loading .loader-title")).toContainText(
          game.name.split(" ")[0],
        );
        await expect(page.locator("#game-loading-detail")).not.toBeEmpty();

        await expect(loadingEl).toHaveClass(/hidden/, { timeout: 130000 });
      });

      test("bridge is installed and debug log exists", async ({
        page,
      }, testInfo) => {
        test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "skipped");

        await page.setViewportSize({ width: 932, height: 430 });
        await page.goto(game.path, { waitUntil: "domcontentloaded" });

        await page.waitForFunction(() => !!(window as any).PirateArcadeInput, {
          timeout: 130000,
        });

        const hasDebug = await page.evaluate(
          () => !!(window as any).__paInputDebug,
        );
        expect(hasDebug).toBe(true);

        const debug = await page.evaluate(
          () => (window as any).__paInputDebug as { bridgeCalls: BridgeCall[] },
        );
        expect(debug.bridgeCalls).toBeDefined();
      });

      test("action button dispatches Enter and Space via bridge", async ({
        page,
      }, testInfo) => {
        test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "skipped");

        await page.setViewportSize({ width: 932, height: 430 });
        await page.goto(game.path, { waitUntil: "domcontentloaded" });

        await page.waitForFunction(() => !!(window as any).PirateArcadeInput, {
          timeout: 130000,
        });

        await page.waitForFunction(
          () => {
            var el = document.getElementById("game-loading");
            return !el || el.classList.contains("hidden");
          },
          { timeout: 30000 },
        );

        const sel = '#touch-overlay .btn-action[data-dir="action"]';
        const btn = page.locator(sel);
        await btn.waitFor({ state: "visible", timeout: 5000 });

        const box = await btn.boundingBox();
        if (!box) {
          test.skip(true, "action button not visible");
          return;
        }

        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        await page.dispatchEvent(sel, "pointerdown", {
          clientX: cx,
          clientY: cy,
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: 1,
          bubbles: true,
          cancelable: true,
        });
        await page.waitForTimeout(100);
        await page.dispatchEvent(sel, "pointerup", {
          clientX: cx,
          clientY: cy,
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: 0,
          bubbles: true,
          cancelable: true,
        });
        await page.waitForTimeout(300);

        const actionKeys = game.actionKeys;
        const calls: BridgeCall[] = await page.evaluate(function (aks) {
          var d = (window as any).__paInputDebug;
          if (!d || !d.bridgeCalls) return [];
          return d.bridgeCalls.filter(function (c: { key: string }) {
            return aks.indexOf(c.key) >= 0;
          });
        }, actionKeys);

        expect(calls.length).toBeGreaterThan(0);
        var lastDown = calls.filter(function (c: BridgeCall) {
          return c.down;
        });
        expect(lastDown.length).toBeGreaterThan(0);
      });

      test("movement keys are held via bridge", async ({ page }, testInfo) => {
        test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "skipped");

        await page.setViewportSize({ width: 932, height: 430 });
        await page.goto(game.path, { waitUntil: "domcontentloaded" });

        await page.waitForFunction(() => !!(window as any).PirateArcadeInput, {
          timeout: 130000,
        });
        await page.waitForFunction(
          () => {
            var el = document.getElementById("game-loading");
            return !el || el.classList.contains("hidden");
          },
          { timeout: 30000 },
        );

        await page.waitForTimeout(500);

        for (const move of game.movement) {
          const sel = '#touch-overlay .btn[data-dir="' + move.dir + '"]';
          const btn = page.locator(sel);
          await btn.waitFor({ state: "visible", timeout: 5000 });

          const box = await btn.boundingBox();
          if (!box) {
            test.skip(true, move.dir + " button not visible");
            return;
          }

          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;

          await page.dispatchEvent(sel, "pointerdown", {
            clientX: cx,
            clientY: cy,
            pointerId: 3,
            pointerType: "touch",
            isPrimary: true,
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true,
          });
          await page.waitForTimeout(500);
          await page.dispatchEvent(sel, "pointerup", {
            clientX: cx,
            clientY: cy,
            pointerId: 3,
            pointerType: "touch",
            isPrimary: true,
            button: 0,
            buttons: 0,
            bubbles: true,
            cancelable: true,
          });
          await page.waitForTimeout(200);

          var allCalls = await page.evaluate(function () {
            var d = (window as any).__paInputDebug;
            if (!d || !d.bridgeCalls) return [];
            return d.bridgeCalls.map(function (c: BridgeCall) {
              return { key: c.key, down: c.down };
            });
          });

          var expectedKeys = move.keys;
          var matching = allCalls.filter(function (c: { key: string }) {
            return expectedKeys.indexOf(c.key) >= 0;
          });
          var foundDown = matching.some(function (c: { down: boolean }) {
            return c.down;
          });

          expect(
            foundDown,
            move.dir +
              " button should dispatch keyDown for " +
              expectedKeys.join(" or "),
          ).toBe(true);
        }
      });
    });
  }
});
