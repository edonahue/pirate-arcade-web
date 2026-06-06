import { test, expect } from "./helpers/browserGame";
import { pointerTouchTap, pointerHoldButton } from "./helpers/browserGame";

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

        await page.waitForFunction(
          () => {
            return document.getElementById("game-loading") !== null;
          },
          { timeout: 5000 },
        );

        const loadingEl = page.locator("#game-loading");
        await expect(loadingEl).toBeVisible({ timeout: 5000 });

        await expect(page.locator("#game-loading-detail")).toContainText(
          "Starting Python runtime…",
        );

        await page.waitForFunction(
          () => {
            const overlay = document.getElementById("game-loading");
            return !overlay || overlay.classList.contains("hidden");
          },
          { timeout: 130000 },
        );

        await testInfo.attach(`loading-complete-${game.id}`, {
          body: JSON.stringify({ ready: true }),
          contentType: "application/json",
        });
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

        await testInfo.attach(`input-debug-${game.id}`, {
          body: JSON.stringify(debug),
          contentType: "application/json",
        });
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
            const overlay = document.getElementById("game-loading");
            return !overlay || overlay.classList.contains("hidden");
          },
          { timeout: 130000 },
        );

        const canvas = page.locator("canvas.emscripten:not([hidden])");
        await expect(canvas).toBeVisible({ timeout: 10000 });

        const sel = '.btn-action[data-dir="action"]';
        const btn = page.locator(sel);
        await btn.waitFor({ state: "visible", timeout: 10000 });

        const box = await btn.boundingBox();
        if (!box) {
          test.skip(true, "action button not visible");
          return;
        }

        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        await pointerTouchTap(page, cx, cy, { selector: sel, holdMs: 100 });
        await page.waitForTimeout(500);

        const actionCalls: BridgeCall[] = await page.evaluate(function (aks) {
          var d = (window as any).__paInputDebug;
          if (!d || !d.bridgeCalls) return [];
          return d.bridgeCalls.filter(function (c: { key: string }) {
            return aks.indexOf(c.key) >= 0;
          });
        }, game.actionKeys);

        const enterDown = actionCalls.some((c) => c.key === "Enter" && c.down);
        const spaceDown = actionCalls.some((c) => c.key === "Space" && c.down);
        expect(enterDown || spaceDown).toBe(true);

        await testInfo.attach(`action-calls-${game.id}`, {
          body: JSON.stringify(actionCalls),
          contentType: "application/json",
        });
      });

      test("movement keys hold triggers bridge calls", async ({
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
            const overlay = document.getElementById("game-loading");
            return !overlay || overlay.classList.contains("hidden");
          },
          { timeout: 130000 },
        );

        const canvas = page.locator("canvas.emscripten:not([hidden])");
        await expect(canvas).toBeVisible({ timeout: 10000 });

        const prevCalls: number = await page.evaluate(() => {
          return (window as any).__paInputDebug?.bridgeCalls?.length || 0;
        });

        for (const move of game.movement) {
          const sel = `.btn[data-dir="${move.dir}"]`;
          const btn = page.locator(sel);
          await btn.waitFor({ state: "visible", timeout: 10000 });

          await pointerHoldButton(page, sel, 400);
          await page.waitForTimeout(200);
        }

        const afterCalls: number = await page.evaluate(() => {
          return (window as any).__paInputDebug?.bridgeCalls?.length || 0;
        });

        const bridgeCalls: BridgeCall[] = await page.evaluate(() => {
          return (window as any).__paInputDebug?.bridgeCalls || [];
        });

        expect(afterCalls).toBeGreaterThan(prevCalls);

        await testInfo.attach(`bridge-calls-${game.id}`, {
          body: JSON.stringify(bridgeCalls),
          contentType: "application/json",
        });
      });
    });
  }
});
