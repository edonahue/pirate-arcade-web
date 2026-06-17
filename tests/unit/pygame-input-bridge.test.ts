import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadBridge(): void {
  const code = readFileSync(
    resolve(__dirname, "../../public/play/shared/pygame-input-bridge.js"),
    "utf-8",
  );
  const origPython = (window as any).python;
  (window as any).python = undefined;
  try {
    const fn = new Function(code);
    fn();
  } finally {
    (window as any).python = origPython;
  }
}

describe("pygame-input-bridge", () => {
  beforeEach(() => {
    // Reset DOM state
    document.body.innerHTML = "";
    // Clean up globals set by the bridge
    delete (window as any).PirateArcadeInput;
    delete (window as any).PirateArcadeLoading;
    delete (window as any).__paInputDebug;
  });

  describe("normalizeKey", () => {
    it("normalizes Space variants", () => {
      loadBridge();
      const input = (window as any).PirateArcadeInput;
      // Indirect test: normalizeKey is internal,
      // but keyDown calls it so we can observe the result
      input.keyDown("space");
      input.keyDown(" ");
      input.keyDown("Space");
      const calls = (
        (window as any).__paInputDebug.bridgeCalls as any[]
      ).filter((c: any) => c.down);
      expect(calls.length).toBe(3);
      calls.forEach((c: any) => expect(c.key).toBe("Space"));
    });

    it("normalizes ArrowUp variants", () => {
      loadBridge();
      const input = (window as any).PirateArcadeInput;
      input.keyDown("up");
      input.keyDown("Up");
      input.keyDown("ArrowUp");
      const calls = (
        (window as any).__paInputDebug.bridgeCalls as any[]
      ).filter((c: any) => c.down);
      expect(calls.length).toBe(3);
      calls.forEach((c: any) => expect(c.key).toBe("ArrowUp"));
    });

    it("normalizes Enter/Escape variants", () => {
      loadBridge();
      const input = (window as any).PirateArcadeInput;
      input.keyDown("Enter");
      input.keyDown("return");
      input.keyDown("Escape");
      input.keyDown("esc");
      const calls = (
        (window as any).__paInputDebug.bridgeCalls as any[]
      ).filter((c: any) => c.down);
      expect(calls[0].key).toBe("Enter");
      expect(calls[1].key).toBe("Enter");
      expect(calls[2].key).toBe("Escape");
      expect(calls[3].key).toBe("Escape");
    });

    it("passes unknown keys through unchanged", () => {
      loadBridge();
      const input = (window as any).PirateArcadeInput;
      input.keyDown("a");
      input.keyDown("ArrowRocket");
      const calls = (
        (window as any).__paInputDebug.bridgeCalls as any[]
      ).filter((c: any) => c.down);
      expect(calls[0].key).toBe("a");
      expect(calls[1].key).toBe("ArrowRocket");
    });
  });

  describe("PirateArcadeInput API", () => {
    beforeEach(() => {
      loadBridge();
    });

    it("is defined and has expected methods", () => {
      const pai = (window as any).PirateArcadeInput;
      expect(pai).toBeTruthy();
      expect(typeof pai.keyDown).toBe("function");
      expect(typeof pai.keyUp).toBe("function");
      expect(typeof pai.tap).toBe("function");
      expect(typeof pai.getDebug).toBe("function");
      expect(typeof pai.clearDebug).toBe("function");
    });

    it("logs bridge calls on keyDown", () => {
      const input = (window as any).PirateArcadeInput;
      input.keyDown("ArrowUp");
      const calls = (window as any).__paInputDebug.bridgeCalls;
      expect(calls.length).toBe(1);
      expect(calls[0].key).toBe("ArrowUp");
      expect(calls[0].down).toBe(true);
    });

    it("logs bridge calls on keyUp", () => {
      const input = (window as any).PirateArcadeInput;
      input.keyUp("ArrowDown");
      const calls = (window as any).__paInputDebug.bridgeCalls;
      expect(calls.length).toBe(1);
      expect(calls[0].key).toBe("ArrowDown");
      expect(calls[0].down).toBe(false);
    });

    it("tap calls keyDown then keyUp with delay", async () => {
      const input = (window as any).PirateArcadeInput;
      input.tap("Space", 50);
      const calls = (window as any).__paInputDebug.bridgeCalls;
      expect(calls.length).toBe(1);
      expect(calls[0].key).toBe("Space");
      expect(calls[0].down).toBe(true);

      // After holdMs, keyUp should fire
      await new Promise((r) => setTimeout(r, 100));
      const after = (window as any).__paInputDebug.bridgeCalls;
      expect(after.length).toBe(2);
      expect(after[1].down).toBe(false);
    });

    it("tap defaults to 200ms hold when holdMs is not provided", async () => {
      const input = (window as any).PirateArcadeInput;
      input.tap("Enter");
      const calls = (window as any).__paInputDebug.bridgeCalls;
      expect(calls.length).toBe(1);
      expect(calls[0].key).toBe("Enter");
      expect(calls[0].down).toBe(true);

      // Should still be held at 50ms (200ms hold means keyUp at ~200ms)
      await new Promise((r) => setTimeout(r, 50));
      const mid = (window as any).__paInputDebug.bridgeCalls;
      expect(mid.length).toBe(1);

      // keyUp should fire after hold expires
      await new Promise((r) => setTimeout(r, 250));
      const after = (window as any).__paInputDebug.bridgeCalls;
      expect(after.length).toBe(2);
      expect(after[1].down).toBe(false);
    });

    it("keyDown dispatches DOM KeyboardEvent fallback", () => {
      const canvas = document.createElement("canvas");
      canvas.id = "canvas";
      document.body.appendChild(canvas);

      const keSpy = { count: 0 };
      canvas.addEventListener("keydown", () => {
        keSpy.count++;
      });

      const input = (window as any).PirateArcadeInput;
      input.keyDown("Enter");

      expect(keSpy.count).toBeGreaterThan(0);
    });

    it("clearDebug resets logs", () => {
      const input = (window as any).PirateArcadeInput;
      input.keyDown("a");
      input.keyDown("b");
      expect((window as any).__paInputDebug.bridgeCalls.length).toBeGreaterThan(
        0,
      );
      input.clearDebug();
      expect((window as any).__paInputDebug.bridgeCalls.length).toBe(0);
    });
  });

  describe("PirateArcadeLoading — not redefined by bridge", () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="game-loading">
          <div class="loader-title">Loading</div>
          <div id="game-loading-detail"></div>
        </div>`;
    });

    it("bridge does not redefine PirateArcadeLoading after pygbag-loading.js", () => {
      // Simulate pygbag-loading.js loading first
      (window as any).PirateArcadeLoading = {
        set: () => {},
        ready: () => {},
        error: () => {},
        isReady: () => false,
        _marker: "pygbag-loading",
      };
      const before = (window as any).PirateArcadeLoading;
      loadBridge();
      const after = (window as any).PirateArcadeLoading;
      expect(after).toBe(before);
      expect(after._marker).toBe("pygbag-loading");
    });
  });

  describe("key normalization (unit)", () => {
    // Extract the normalizeKey logic for direct testing
    function normalizeKey(k: string): string {
      if (k === " " || k === "Space" || k === "space") return "Space";
      if (k === "Enter" || k === "Return" || k === "return") return "Enter";
      if (k === "Escape" || k === "Esc" || k === "esc") return "Escape";
      if (k === "ArrowUp" || k === "Up" || k === "up") return "ArrowUp";
      if (k === "ArrowDown" || k === "Down" || k === "down") return "ArrowDown";
      if (k === "ArrowLeft" || k === "Left" || k === "left") return "ArrowLeft";
      if (k === "ArrowRight" || k === "Right" || k === "right")
        return "ArrowRight";
      return k;
    }

    it("normalizes all space forms to Space", () => {
      expect(normalizeKey(" ")).toBe("Space");
      expect(normalizeKey("Space")).toBe("Space");
      expect(normalizeKey("space")).toBe("Space");
    });

    it("normalizes arrow variants", () => {
      expect(normalizeKey("up")).toBe("ArrowUp");
      expect(normalizeKey("Up")).toBe("ArrowUp");
      expect(normalizeKey("ArrowUp")).toBe("ArrowUp");
      expect(normalizeKey("down")).toBe("ArrowDown");
      expect(normalizeKey("left")).toBe("ArrowLeft");
      expect(normalizeKey("right")).toBe("ArrowRight");
    });

    it("normalizes enter/escape variants", () => {
      expect(normalizeKey("Enter")).toBe("Enter");
      expect(normalizeKey("Return")).toBe("Enter");
      expect(normalizeKey("return")).toBe("Enter");
      expect(normalizeKey("Escape")).toBe("Escape");
      expect(normalizeKey("Esc")).toBe("Escape");
      expect(normalizeKey("esc")).toBe("Escape");
    });

    it("passes through lowercase letter keys", () => {
      expect(normalizeKey("a")).toBe("a");
      expect(normalizeKey("w")).toBe("w");
      expect(normalizeKey("s")).toBe("s");
      expect(normalizeKey("d")).toBe("d");
      expect(normalizeKey("p")).toBe("p");
    });

    it("passes through unknown strings unchanged", () => {
      expect(normalizeKey("F1")).toBe("F1");
      expect(normalizeKey("Shift")).toBe("Shift");
    });
  });
});
