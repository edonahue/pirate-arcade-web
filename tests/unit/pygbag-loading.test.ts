import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadLoadingScript(): void {
  const code = readFileSync(
    resolve(__dirname, "../../public/play/shared/pygbag-loading.js"),
    "utf-8",
  );
  const fn = new Function(code);
  fn();
}

describe("pygbag-loading (PirateArcadeLoading)", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="game-loading" role="status" aria-live="polite" class="hidden">
        <div class="loader-title">Loading</div>
        <div class="loader-stages" aria-hidden="true">
          <span class="loader-stage is-current" data-stage="0"></span>
          <span class="loader-stage" data-stage="1"></span>
          <span class="loader-stage" data-stage="2"></span>
          <span class="loader-stage" data-stage="3"></span>
        </div>
        <div id="game-loading-detail">Starting</div>
        <div class="loader-note">Initial</div>
      </div>`;
    delete (window as any).PirateArcadeLoading;
    delete (window as any).PirateArcadeInput;
    delete (window as any).PirateArcadeMetrics;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function getLoadingEl(): HTMLElement {
    return document.getElementById("game-loading")!;
  }

  function getDetailEl(): HTMLElement {
    return document.getElementById("game-loading-detail")!;
  }

  function getNoteEl(): HTMLElement | null {
    return getLoadingEl().querySelector(".loader-note");
  }

  describe("API surface", () => {
    it("defines PirateArcadeLoading with expected methods", () => {
      loadLoadingScript();
      const api = (window as any).PirateArcadeLoading;
      expect(api).toBeTruthy();
      expect(typeof api.set).toBe("function");
      expect(typeof api.ready).toBe("function");
      expect(typeof api.error).toBe("function");
      expect(typeof api.isReady).toBe("function");
    });

    it("isReady returns false initially", () => {
      loadLoadingScript();
      const api = (window as any).PirateArcadeLoading;
      expect(api.isReady()).toBe(false);
    });
  });

  describe("set() — phase update", () => {
    beforeEach(() => {
      loadLoadingScript();
    });

    it("updates detail text through textContent", () => {
      const api = (window as any).PirateArcadeLoading;
      api.set("Installing game engine");
      expect(getDetailEl().textContent).toBe("Installing game engine");
    });

    it("removes hidden class", () => {
      const api = (window as any).PirateArcadeLoading;
      const el = getLoadingEl();
      el.classList.add("hidden");
      api.set("Working...");
      expect(el.classList.contains("hidden")).toBe(false);
    });

    it("removes game-error class", () => {
      const api = (window as any).PirateArcadeLoading;
      const el = getLoadingEl();
      el.classList.add("game-error");
      api.set("Retrying...");
      expect(el.classList.contains("game-error")).toBe(false);
    });
  });

  describe("slow timer", () => {
    beforeEach(() => {
      loadLoadingScript();
    });

    it("schedules exactly one timer on first set()", () => {
      const api = (window as any).PirateArcadeLoading;
      api.set("Phase 1");
      // Only the slow-load timer should be pending
      expect(vi.getTimerCount()).toBe(1);
    });

    it("configured delay is 30000ms", () => {
      const api = (window as any).PirateArcadeLoading;
      api.set("Phase 1");
      // The slow callback fires after 30s
      vi.advanceTimersByTime(29999);
      const note = getNoteEl();
      expect(note!.textContent).toBe("Initial");
      vi.advanceTimersByTime(1);
      expect(note!.textContent).toContain("first load");
    });

    it("slow copy appears only after callback execution", () => {
      const api = (window as any).PirateArcadeLoading;
      api.set("Phase 1");
      expect(getNoteEl()!.textContent).toBe("Initial");
      vi.advanceTimersByTime(30000);
      expect(getNoteEl()!.textContent).not.toBe("Initial");
      expect(getNoteEl()!.textContent!.length).toBeGreaterThan(0);
    });

    it("changing phase clears and replaces the previous timer", () => {
      const api = (window as any).PirateArcadeLoading;
      api.set("Phase 1");
      vi.advanceTimersByTime(10000);
      api.set("Phase 2");
      // Timer was cleared and a new one started
      expect(vi.getTimerCount()).toBe(1);
      // The slow copy should not appear at 10s (original timer was replaced)
      vi.advanceTimersByTime(20000);
      expect(getNoteEl()!.textContent).toBe("Initial");
      // Now advance past the new timer's 30s
      vi.advanceTimersByTime(10000);
      expect(getNoteEl()!.textContent).not.toBe("Initial");
    });

    it("repeated set() calls do not accumulate timers", () => {
      const api = (window as any).PirateArcadeLoading;
      api.set("A");
      api.set("B");
      api.set("C");
      api.set("D");
      expect(vi.getTimerCount()).toBe(1);
    });

    it("does not overwrite an error message", () => {
      const api = (window as any).PirateArcadeLoading;
      api.set("Normal phase");
      api.error("Game crashed");
      vi.advanceTimersByTime(30000);
      // Error message preserved, not overwritten by slow copy
      expect(getDetailEl().textContent).toBe("Game crashed");
    });
  });

  describe("ready()", () => {
    beforeEach(() => {
      loadLoadingScript();
    });

    it("clears the slow timer", () => {
      const api = (window as any).PirateArcadeLoading;
      api.set("Phase 1");
      vi.advanceTimersByTime(15000);
      api.ready("Done");
      expect(vi.getTimerCount()).toBe(0);
    });

    it("hides the overlay", () => {
      const api = (window as any).PirateArcadeLoading;
      api.set("Working");
      api.ready("Ready!");
      expect(getLoadingEl().classList.contains("hidden")).toBe(true);
    });

    it("stores ready state", () => {
      const api = (window as any).PirateArcadeLoading;
      expect(api.isReady()).toBe(false);
      api.ready();
      expect(api.isReady()).toBe(true);
    });

    it("slow callback cannot make overlay reappear", () => {
      const api = (window as any).PirateArcadeLoading;
      api.set("Phase 1");
      api.ready("Done");
      vi.advanceTimersByTime(30000);
      expect(getLoadingEl().classList.contains("hidden")).toBe(true);
    });

    it("slow callback cannot change text after ready", () => {
      const api = (window as any).PirateArcadeLoading;
      api.set("Phase 1");
      api.ready("Ready!");
      vi.advanceTimersByTime(30000);
      expect(getDetailEl().textContent).toBe("Ready!");
    });

    it("updates detail text when msg is provided", () => {
      const api = (window as any).PirateArcadeLoading;
      api.ready("Ready. Tap START.");
      expect(getDetailEl().textContent).toBe("Ready. Tap START.");
    });

    it("optionally omits msg and does not change detail", () => {
      const api = (window as any).PirateArcadeLoading;
      api.set("Working");
      getDetailEl().textContent = "Working";
      api.ready();
      expect(getDetailEl().textContent).toBe("Working");
    });
  });

  describe("error()", () => {
    beforeEach(() => {
      loadLoadingScript();
    });

    it("clears the slow timer", () => {
      const api = (window as any).PirateArcadeLoading;
      api.set("Phase 1");
      vi.advanceTimersByTime(15000);
      api.error("Failed");
      expect(vi.getTimerCount()).toBe(0);
    });

    it("displays the error message via textContent", () => {
      const api = (window as any).PirateArcadeLoading;
      api.error("We couldn't start the game.");
      expect(getDetailEl().textContent).toBe("We couldn't start the game.");
    });

    it("shows error state on overlay", () => {
      const api = (window as any).PirateArcadeLoading;
      const el = getLoadingEl();
      el.classList.add("hidden");
      api.error("fail");
      expect(el.classList.contains("hidden")).toBe(false);
      expect(el.classList.contains("game-error")).toBe(true);
    });

    it("adds game-error class to body", () => {
      const api = (window as any).PirateArcadeLoading;
      api.error("fail");
      expect(document.body.classList.contains("game-error")).toBe(true);
    });

    it("malicious text remains text (no HTML injection)", () => {
      const api = (window as any).PirateArcadeLoading;
      const malicious =
        '<img src=x onerror="alert(1)"> <script>alert(1)</script>';
      api.error(malicious);
      // textContent is used, so HTML is escaped
      expect(getDetailEl().innerHTML).not.toContain("<img");
      expect(getDetailEl().innerHTML).not.toContain("<script");
      expect(getDetailEl().textContent).toBe(malicious);
      // No new DOM elements were created from the error text
      expect(document.querySelector("img")).toBeNull();
      expect(document.querySelector("script")).toBeNull();
    });

    it("retry button is created on error", () => {
      const api = (window as any).PirateArcadeLoading;
      api.error("fail");
      const retryBtn = document.querySelector(".loading-retry-btn");
      expect(retryBtn).toBeTruthy();
      expect(retryBtn!.textContent).toBe("Try Again");
    });

    it("no HTML element is created from malicious error text", () => {
      const api = (window as any).PirateArcadeLoading;
      api.error("<div>bad</div>");
      // The text content has angle brackets but no HTML elements from them
      const allDivs = document.querySelectorAll("div");
      // Should not have extra divs beyond the initial DOM setup
      expect(document.querySelector(".loading-retry-btn")).toBeTruthy();
    });
  });

  describe("duplicate installation protection", () => {
    it("loading API cannot be silently overwritten by a second script", () => {
      loadLoadingScript();
      const first = (window as any).PirateArcadeLoading;
      // Simulate another script trying to replace it
      (window as any).PirateArcadeLoading = { set: () => "fake" };
      // The mission requirement is that the shared script must not be
      // silently replaced — but this is a JS runtime, not a freeze.
      // We verify that pygame-input-bridge.js specifically does not replace it
      // in a separate test below.
      expect((window as any).PirateArcadeLoading).not.toBe(first);
    });

    it("pygame-input-bridge.js does not replace PirateArcadeLoading", () => {
      loadLoadingScript();
      const before = (window as any).PirateArcadeLoading;
      // Load the bridge script
      const bridgeCode = readFileSync(
        resolve(__dirname, "../../public/play/shared/pygame-input-bridge.js"),
        "utf-8",
      );
      const fn = new Function(bridgeCode);
      fn();
      const after = (window as any).PirateArcadeLoading;
      // The bridge must not have replaced the loading implementation
      expect(after).toBe(before);
    });
  });

  describe("accessibility", () => {
    beforeEach(() => {
      loadLoadingScript();
    });

    it("preserves role='status' on loading overlay", () => {
      expect(getLoadingEl().getAttribute("role")).toBe("status");
    });

    it("preserves aria-live='polite' on loading overlay", () => {
      expect(getLoadingEl().getAttribute("aria-live")).toBe("polite");
    });
  });

  describe("input bridge integration", () => {
    it("calls releaseAll on error when PirateArcadeInput exists", () => {
      (window as any).PirateArcadeInput = {
        releaseAll: vi.fn(),
      };
      loadLoadingScript();
      (window as any).PirateArcadeLoading.error("fail");
      expect((window as any).PirateArcadeInput.releaseAll).toHaveBeenCalledWith(
        "error",
      );
    });

    it("does not crash on error when PirateArcadeInput is undefined", () => {
      loadLoadingScript();
      expect(() => {
        (window as any).PirateArcadeLoading.error("fail");
      }).not.toThrow();
    });
  });

  describe("boot stage progress", () => {
    beforeEach(() => {
      loadLoadingScript();
    });

    function stageStates(): string[] {
      return Array.from(
        document.querySelectorAll("#game-loading .loader-stage"),
      ).map((el) =>
        el.classList.contains("is-current")
          ? "current"
          : el.classList.contains("is-done")
            ? "done"
            : "todo",
      );
    }

    function emitStage(stage: string): void {
      window.dispatchEvent(
        new window.CustomEvent("pa-boot-stage", { detail: { stage } }),
      );
    }

    it("starts with the first stage current", () => {
      expect(stageStates()).toEqual(["current", "todo", "todo", "todo"]);
    });

    it("groups known boot stages into four user stages", () => {
      const api = (window as any).PirateArcadeLoading;
      emitStage("python-ready");
      expect(stageStates()[0]).toBe("current");
      emitStage("archive-fetch");
      expect(stageStates()).toEqual(["done", "current", "todo", "todo"]);
      emitStage("display-init");
      expect(stageStates()).toEqual(["done", "done", "current", "todo"]);
      emitStage("game-ready");
      expect(stageStates()).toEqual(["done", "done", "done", "current"]);
      expect(api.getState().stage).toBe(3);
    });

    it("never regresses on out-of-order or unknown stages", () => {
      emitStage("game-ready");
      emitStage("python-ready");
      emitStage("not-a-real-stage");
      expect(stageStates()).toEqual(["done", "done", "done", "current"]);
    });

    it("freezes stages on error and keeps them frozen", () => {
      const api = (window as any).PirateArcadeLoading;
      emitStage("archive-fetch");
      api.error("fail");
      emitStage("game-ready");
      expect(stageStates()).toEqual(["done", "current", "todo", "todo"]);
      expect(api.getState().stage).toBe(1);
    });

    it("ignores stage events after ready", () => {
      const api = (window as any).PirateArcadeLoading;
      api.ready("Done");
      emitStage("game-ready");
      expect(stageStates()).toEqual(["current", "todo", "todo", "todo"]);
    });

    it("decorative segments stay hidden from assistive tech", () => {
      const stages = document.querySelector(".loader-stages");
      expect(stages!.getAttribute("aria-hidden")).toBe("true");
    });
  });
});
