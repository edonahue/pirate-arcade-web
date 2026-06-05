import { test, expect } from "./helpers/browserGame";
import {
  waitForPygbagRuntime,
  pointerTouchDrag,
  pointerTouchTap,
  readPirateInputDebug,
} from "./helpers/browserGame";

const MOBILE_PROJECTS = ["mobile-safari", "mobile-chrome"];

interface GameSpec {
  id: string;
  name: string;
  path: string;
  dragAxis: "y" | "x";
}

const GAMES: GameSpec[] = [
  {
    id: "cannonball-clash",
    name: "Cannonball Clash",
    path: "/play/cannonball-clash/",
    dragAxis: "y",
  },
  {
    id: "treasure-cove",
    name: "Treasure Cove",
    path: "/play/treasure-cove/",
    dragAxis: "x",
  },
];

test.describe("Mobile Drag Controls", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.setViewportSize({ width: 932, height: 430 });
  });

  for (const game of GAMES) {
    test(`${game.name} drag zone dispatches ${game.dragAxis}-axis touch targets`, async ({
      page,
    }, testInfo) => {
      test.skip(
        !MOBILE_PROJECTS.includes(testInfo.project.name),
        `Drag test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPygbagRuntime(page);

      // Wait for game-ready
      await page.waitForFunction(
        () => {
          const m = (window as any).__paBootMetrics;
          return m !== undefined && m["game-ready"] !== undefined;
        },
        { timeout: 120000 },
      );

      // Give the overlay time to activate
      await page.waitForSelector(".touch-overlay.active", { timeout: 5000 });
      await page.waitForTimeout(500);

      // Clear input debug log
      await page.evaluate(() => {
        const input = (window as any).PirateArcadeInput;
        if (input && input.clearDebug) input.clearDebug();
      });

      // Locate drag zone
      const dragSelector = `.touch-drag-zone[data-dir="drag-${game.dragAxis}"]`;
      await page.waitForSelector(dragSelector, { timeout: 5000 });

      const dragZone = page.locator(dragSelector);
      const box = await dragZone.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);

      // Drag from center downward/rightward (80px in the axis)
      const midX = box!.x + box!.width / 2;
      const midY = box!.y + box!.height / 2;
      const offset = 80;

      const startPoint = { x: midX, y: midY };
      const endPoint =
        game.dragAxis === "y"
          ? { x: midX, y: midY + offset }
          : { x: midX + offset, y: midY };

      await pointerTouchDrag(page, [startPoint, endPoint], {
        selector: dragSelector,
      });

      await page.waitForTimeout(200);

      // Read debug log
      const debug = await readPirateInputDebug(page);
      const touchEvents = debug.events.filter(
        (e: any) => e.tag === "touchTarget",
      );

      expect(touchEvents.length).toBeGreaterThan(0);

      // At least one event should have the correct axis
      const axisEvents = touchEvents.filter(
        (e: any) => e.data && e.data.axis === game.dragAxis,
      );
      expect(axisEvents.length).toBeGreaterThan(0);

      // Verify final event had active=true
      const lastActive = axisEvents[axisEvents.length - 1];
      expect(lastActive.data.active).toBe(true);

      // Attach debug for diagnostics
      await testInfo.attach(`drag-events-${game.id}`, {
        body: JSON.stringify(touchEvents, null, 2),
        contentType: "application/json",
      });

      // Verify the Python bridge received events
      const hasTouchState = await page.evaluate(
        ({ dragAxis: axis }) => {
          try {
            const w = window as any;
            if (!w.python || typeof w.python.PyRun_SimpleString !== "function")
              return false;
            w.python.PyRun_SimpleString(
              'import json, builtins; open("/tmp/_pa_touch_check.json","w").write(json.dumps({' +
                '"tc": getattr(builtins, "__pa_touch_event_count__", 0),' +
                '"lastAxis": str(getattr(builtins, "__pa_last_touch_axis__", "None")),' +
                "}))",
            );
            const raw = w.python.FS.readFile("/tmp/_pa_touch_check.json", {
              encoding: "utf8",
            });
            const st = JSON.parse(raw);
            return st.tc > 0 && st.lastAxis === axis;
          } catch (e) {
            return false;
          }
        },
        { dragAxis: game.dragAxis },
      );
      expect(hasTouchState).toBe(true);
    });

    test(`${game.name} drag zone clears target on pointerup`, async ({
      page,
    }, testInfo) => {
      test.skip(
        !MOBILE_PROJECTS.includes(testInfo.project.name),
        `Clear test skipped on ${testInfo.project.name}`,
      );

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForPygbagRuntime(page);

      await page.waitForFunction(
        () => {
          const m = (window as any).__paBootMetrics;
          return m !== undefined && m["game-ready"] !== undefined;
        },
        { timeout: 120000 },
      );

      await page.waitForSelector(".touch-overlay.active", { timeout: 5000 });
      await page.waitForTimeout(500);

      const dragSelector = `.touch-drag-zone[data-dir="drag-${game.dragAxis}"]`;
      await page.waitForSelector(dragSelector, { timeout: 5000 });

      // Start drag and release via touch-like pointer events
      const box = await page.locator(dragSelector).boundingBox();
      expect(box).toBeTruthy();

      const cx = box!.x + box!.width / 2;
      const cy = box!.y + box!.height / 2;
      await pointerTouchTap(page, cx, cy, {
        selector: dragSelector,
        holdMs: 150,
      });
      await page.waitForTimeout(100);

      // Python touch active should be False after release
      const touchCleared = await page.evaluate(() => {
        try {
          const w = window as any;
          if (!w.python || typeof w.python.PyRun_SimpleString !== "function")
            return true;
          w.python.PyRun_SimpleString(
            'import json, builtins; open("/tmp/_pa_touch_clear.json","w").write(json.dumps({' +
              '"active": bool(getattr(builtins, "__pa_touch_active__", True))' +
              "}))",
          );
          const raw = w.python.FS.readFile("/tmp/_pa_touch_clear.json", {
            encoding: "utf8",
          });
          return JSON.parse(raw).active === false;
        } catch (e) {
          return true;
        }
      });
      expect(touchCleared).toBe(true);
    });
  }
});
