import { test, expect } from "@playwright/test";

interface CapturedKeyEvent {
  type: string;
  key: string;
  code: string;
  keyCode: number;
  target: "window" | "document";
}

const TOUCH_PROJECTS = ["mobile-chrome", "mobile-safari"];

const GAMES = [
  {
    id: "cannonball-clash",
    name: "Cannonball Clash",
    controls: "pong",
    dirs: {
      left: { keys: ["ArrowUp", "w"], codes: ["ArrowUp", "KeyW"] },
      right: { keys: ["ArrowDown", "s"], codes: ["ArrowDown", "KeyS"] },
    },
  },
  {
    id: "treasure-cove",
    name: "Treasure Cove",
    controls: "breakout",
    dirs: {
      left: { keys: ["ArrowLeft", "a"], codes: ["ArrowLeft", "KeyA"] },
      right: { keys: ["ArrowRight", "d"], codes: ["ArrowRight", "KeyD"] },
    },
  },
];

test.describe("mobile controls dispatch", () => {
  for (const game of GAMES) {
    test(`${game.name} events reach window and document`, async ({
      page,
    }, testInfo) => {
      test.skip(!TOUCH_PROJECTS.includes(testInfo.project.name), "skipped");

      await page.context().addInitScript(function () {
        (window as any).__capturedKeys = [];
        function capture(e: KeyboardEvent) {
          (window as any).__capturedKeys.push({
            type: e.type,
            key: e.key,
            code: e.code,
            keyCode: e.keyCode,
            target: e.currentTarget === window ? "window" : "document",
          });
        }
        window.addEventListener("keydown", capture);
        window.addEventListener("keyup", capture);
        document.addEventListener("keydown", capture);
        document.addEventListener("keyup", capture);
      });

      // Landscape so #rotate-device stays hidden
      await page.setViewportSize({ width: 932, height: 430 });

      await page.goto("/play/" + game.id + "/", {
        waitUntil: "domcontentloaded",
      });

      // Hide #game-loading so it doesn't intercept pointer events
      await page.evaluate(function () {
        var gl = document.getElementById("game-loading");
        if (gl) gl.style.display = "none";
      });
      await page.waitForTimeout(200);

      const active = await page.evaluate(function () {
        var o = document.getElementById("touch-overlay");
        return o && o.classList.contains("active");
      });
      if (!active) {
        test.skip(true, "touch-overlay not active");
        return;
      }

      // Interact with left/right/action/pause buttons
      for (const dir of ["left", "right", "action", "pause"]) {
        const sel = '#touch-overlay .btn[data-dir="' + dir + '"]';
        const box = await page.locator(sel).boundingBox();
        if (!box) continue;
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
        await page.waitForTimeout(100);
      }

      const captured: CapturedKeyEvent[] = await page.evaluate(function () {
        return (window as any).__capturedKeys || [];
      });

      expect(captured.length).toBeGreaterThan(0);

      // Verify Space uses code "Space" not " "
      const spaceEvents = captured.filter(function (e: CapturedKeyEvent) {
        return e.key === " ";
      });
      for (const ev of spaceEvents) {
        expect(ev.code).toBe("Space");
      }

      // Verify events reached window
      const windowEvents = captured.filter(function (e: CapturedKeyEvent) {
        return e.target === "window";
      });
      expect(windowEvents.length).toBeGreaterThan(0);

      // Verify per-game directional mappings
      const direction = game.dirs;
      for (const [dirName, mapping] of Object.entries(direction)) {
        for (const expectedKey of mapping.keys) {
          for (const evType of ["keydown", "keyup"]) {
            const match = captured.find(function (e: CapturedKeyEvent) {
              return e.key === expectedKey && e.type === evType;
            });
            expect(
              match,
              dirName + " dispatches " + expectedKey + " on " + evType,
            ).toBeTruthy();
          }
        }
      }
    });
  }
});
