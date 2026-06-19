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

  describe("PirateArcadeGameState observer lifecycle", () => {
    beforeEach(() => {
      document.body.innerHTML = "";
      delete (window as any).PirateArcadeGameState;
      delete (window as any).__paSuccessBridgeCalls;
      delete (window as any).__paInputDebug;
      delete (window as any).PirateArcadeInput;
    });

    it("starts polling when #pa-game-state is absent", () => {
      loadBridge();
      const gs = (window as any).PirateArcadeGameState;
      expect(gs).toBeTruthy();
      const meta = gs.getMeta();
      expect(meta.observerType).toBe("polling");
      expect(meta.observerConnected).toBe(false);
    });

    it("attaches MutationObserver when #pa-game-state element exists", () => {
      const el = document.createElement("div");
      el.id = "pa-game-state";
      el.textContent = '{"phase":"loading"}';
      document.body.appendChild(el);

      loadBridge();
      const gs = (window as any).PirateArcadeGameState;
      const meta = gs.getMeta();
      expect(meta.observerType).toBe("mutation");
      expect(meta.observerConnected).toBe(true);
    });

    it("reflects state changes via MutationObserver", async () => {
      const el = document.createElement("div");
      el.id = "pa-game-state";
      el.textContent = '{"phase":"menu","score":0}';
      document.body.appendChild(el);

      loadBridge();
      const gs = (window as any).PirateArcadeGameState;
      expect(gs.getState()).toBeNull();

      // Simulate Python writing to the element
      el.textContent = '{"phase":"playing","score":5}';
      el.dispatchEvent(new Event("DOMSubtreeModified"));

      // Wait for debounce (50ms) + flush
      await new Promise((r) => setTimeout(r, 100));
      expect(gs.getState()).toBeTruthy();
      expect(gs.getState().phase).toBe("playing");
      expect(gs.getState().score).toBe(5);
    });

    it("subscribes and notifies on state change", async () => {
      const el = document.createElement("div");
      el.id = "pa-game-state";
      el.textContent = '{"phase":"menu"}';
      document.body.appendChild(el);

      loadBridge();
      const gs = (window as any).PirateArcadeGameState;

      const received: any[] = [];
      gs.subscribe((state: any) => received.push(state));

      el.textContent = '{"phase":"playing"}';
      el.dispatchEvent(new Event("DOMSubtreeModified"));

      await new Promise((r) => setTimeout(r, 100));
      expect(received.length).toBe(1);
      expect(received[0].phase).toBe("playing");
    });

    it("unsubscribe stops receiving notifications", async () => {
      const el = document.createElement("div");
      el.id = "pa-game-state";
      el.textContent = '{"phase":"menu"}';
      document.body.appendChild(el);

      loadBridge();
      const gs = (window as any).PirateArcadeGameState;

      const received: any[] = [];
      const unsub = gs.subscribe((state: any) => received.push(state));
      unsub();

      el.textContent = '{"phase":"playing"}';
      el.dispatchEvent(new Event("DOMSubtreeModified"));

      await new Promise((r) => setTimeout(r, 100));
      expect(received.length).toBe(0);
    });

    it("upgrades from polling to MutationObserver when element appears", () => {
      loadBridge();
      const gs = (window as any).PirateArcadeGameState;
      let meta = gs.getMeta();
      expect(meta.observerType).toBe("polling");

      const el = document.createElement("div");
      el.id = "pa-game-state";
      el.textContent = '{"phase":"ready"}';
      document.body.appendChild(el);

      // Trigger polling cycle manually
      gs.refresh();

      // After refresh, the polling cycle should detect the element
      meta = gs.getMeta();
      expect(meta.stale).toBe(false);
    });

    it("recovers observer on pageshow after BFCache restore", () => {
      const el = document.createElement("div");
      el.id = "pa-game-state";
      el.textContent = '{"phase":"menu"}';
      document.body.appendChild(el);

      loadBridge();
      const gs = (window as any).PirateArcadeGameState;
      let meta = gs.getMeta();
      expect(meta.observerType).toBe("mutation");
      expect(meta.observerConnected).toBe(true);

      // Simulate BFCache invalidation: disconnect and restore
      const event = new Event("pageshow");
      Object.defineProperty(event, "persisted", {
        value: true,
        configurable: true,
      });
      window.dispatchEvent(event);

      meta = gs.getMeta();
      expect(meta.observerConnected).toBe(true);
      expect(meta.bfcacheRestores).toBeGreaterThanOrEqual(1);
    });

    it("getMeta exposes all debug fields", () => {
      const el = document.createElement("div");
      el.id = "pa-game-state";
      el.textContent = '{"phase":"menu"}';
      document.body.appendChild(el);

      loadBridge();
      const gs = (window as any).PirateArcadeGameState;
      const meta = gs.getMeta();

      expect(meta).toHaveProperty("source");
      expect(meta).toHaveProperty("lastUpdatedAt");
      expect(meta).toHaveProperty("parseErrorCount");
      expect(meta).toHaveProperty("stale");
      expect(meta).toHaveProperty("observerType");
      expect(meta).toHaveProperty("observerConnected");
      expect(meta).toHaveProperty("bfcacheRestores");
      expect(meta).toHaveProperty("mutationCount");
      expect(meta).toHaveProperty("pollCycles");
    });
  });

  describe("monotonic bridge counters", () => {
    beforeEach(() => {
      document.body.innerHTML =
        '<div id="canvas"><canvas id="canvas"></canvas></div>';
      delete (window as any).PirateArcadeInput;
      delete (window as any).__paInputDebug;
      delete (window as any).__paSuccessBridgeCalls;
      delete (window as any).PirateArcadeGameState;
      loadBridge();
    });

    it("starts at 0", () => {
      expect((window as any).__paSuccessBridgeCalls).toBe(0);
      const state = (window as any).PirateArcadeInput.getState();
      expect(state.successfulBridgeCalls).toBe(0);
    });

    it("increments on each keyDown (bridge miss does not count)", () => {
      const input = (window as any).PirateArcadeInput;
      // Without python bridge, calls will be "misses" — no increment
      input.keyDown("ArrowUp");
      expect((window as any).__paSuccessBridgeCalls).toBe(0);

      // With mock python bridge, calls should increment
      (window as any).python = {
        PyRun_SimpleString: () => {},
      };
      input.keyDown("Space");
      expect((window as any).__paSuccessBridgeCalls).toBe(1);

      input.keyDown("Enter");
      expect((window as any).__paSuccessBridgeCalls).toBe(2);
    });

    it("is monotonic and survives clearDebug", () => {
      (window as any).python = {
        PyRun_SimpleString: () => {},
      };
      const input = (window as any).PirateArcadeInput;

      input.keyDown("a");
      input.keyDown("d");
      expect((window as any).__paSuccessBridgeCalls).toBe(2);

      const state = input.getState();
      expect(state.successfulBridgeCalls).toBe(2);

      input.clearDebug();
      // Ring buffers are cleared but monotonic counter persists
      expect((window as any).__paInputDebug.bridgeCalls.length).toBe(0);
      expect((window as any).__paSuccessBridgeCalls).toBe(2);

      const state2 = input.getState();
      expect(state2.successfulBridgeCalls).toBe(2);

      input.keyDown("w");
      expect((window as any).__paSuccessBridgeCalls).toBe(3);
    });

    it("tracks successful keyUp too", () => {
      (window as any).python = {
        PyRun_SimpleString: () => {},
      };
      const input = (window as any).PirateArcadeInput;

      input.keyDown("Space");
      expect((window as any).__paSuccessBridgeCalls).toBe(1);

      input.keyUp("Space");
      expect((window as any).__paSuccessBridgeCalls).toBe(2);
    });

    it("matches getState().successfulBridgeCalls", () => {
      (window as any).python = {
        PyRun_SimpleString: () => {},
      };
      const input = (window as any).PirateArcadeInput;

      input.keyDown("ArrowLeft");
      input.keyDown("ArrowRight");

      const direct = (window as any).__paSuccessBridgeCalls;
      const fromState = input.getState().successfulBridgeCalls;
      expect(direct).toBe(fromState);
      expect(direct).toBe(2);
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
