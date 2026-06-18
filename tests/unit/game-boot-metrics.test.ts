import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { PirateArcadeMetrics } from "../helpers/diagnostics";

function getMetrics(): PirateArcadeMetrics {
  const m = (window as any).PirateArcadeMetrics as
    | PirateArcadeMetrics
    | undefined;
  if (!m) throw new Error("PirateArcadeMetrics not loaded");
  return m;
}

function loadMetrics(): void {
  const code = readFileSync(
    resolve(__dirname, "../../public/play/shared/game-boot-metrics.js"),
    "utf-8",
  );
  const fn = new Function(code);
  fn();
}

describe("game-boot-metrics", () => {
  beforeEach(() => {
    delete (window as any).PirateArcadeMetrics;
    delete (window as any).__paBootMetrics;
  });

  it("exposes PirateArcadeMetrics with expected methods", () => {
    loadMetrics();
    const m = getMetrics();
    expect(typeof m.mark).toBe("function");
    expect(typeof m.measure).toBe("function");
    expect(typeof m.get).toBe("function");
    expect(typeof m.clear).toBe("function");
    expect(typeof m.getMarks).toBe("function");
    expect(typeof m.computeDurations).toBe("function");
  });

  it("mark records a metric", () => {
    loadMetrics();
    getMetrics().mark("test-start");
    const marks = getMetrics().getMarks();
    expect(marks["test-start"]).toBeGreaterThan(0);
  });

  it("mark updates __paBootMetrics", () => {
    loadMetrics();
    getMetrics().mark("my-mark");
    expect((window as any).__paBootMetrics["my-mark"]).toBeGreaterThan(0);
  });

  it("measure computes difference between two marks", () => {
    loadMetrics();
    const m = getMetrics();
    m.mark("start");
    m.mark("end");
    const dur = m.measure("total", "start", "end");
    expect(dur).toBeGreaterThan(0);
    const all = m.get();
    expect(all["total"]).toBe(dur);
  });

  it("measure returns undefined when a mark is missing", () => {
    loadMetrics();
    const m = getMetrics();
    m.mark("a");
    const dur = m.measure("a-to-b", "a", "b");
    expect(dur).toBeUndefined();
  });

  it("clear resets all metrics", () => {
    loadMetrics();
    const m = getMetrics();
    m.mark("test");
    m.clear();
    expect(m.get()).toEqual({});
    expect(m.getMarks()).toEqual({});
  });

  it("computeDurations calculates standard durations from available marks", () => {
    loadMetrics();
    const m = getMetrics();
    m.mark("page-script-start");
    m.mark("python-ready");
    m.mark("pygame-install-start");
    m.mark("pygame-install-end");
    m.mark("archive-fetch-start");
    m.mark("archive-fetch-end");
    m.mark("archive-extract-start");
    m.mark("archive-extract-end");
    m.mark("display-init-start");
    m.mark("display-init-end");
    m.mark("game-ready");
    m.mark("loader-hidden");
    m.computeDurations();
    const all = m.get();
    expect(all["total-to-python-ready"]).toBeGreaterThan(0);
    expect(all["pygame-install-duration"]).toBeGreaterThanOrEqual(0);
    expect(all["archive-fetch-duration"]).toBeGreaterThanOrEqual(0);
    expect(all["archive-extract-duration"]).toBeGreaterThanOrEqual(0);
    expect(all["display-init-duration"]).toBeGreaterThanOrEqual(0);
    expect(all["total-to-game-ready"]).toBeGreaterThan(0);
    expect(all["total-to-loader-hidden"]).toBeGreaterThan(0);
  });

  it("computeDurations only computes for marks that exist", () => {
    loadMetrics();
    const m = getMetrics();
    m.mark("page-script-start");
    m.mark("game-ready");
    m.mark("loader-hidden");
    m.computeDurations();
    const all = m.get();
    expect(all["total-to-game-ready"]).toBeGreaterThan(0);
    expect(all["total-to-loader-hidden"]).toBeGreaterThan(0);
    expect(all["pygame-install-duration"]).toBeUndefined();
  });

  it("marks page-script-start on load", () => {
    loadMetrics();
    const marks = getMetrics().getMarks();
    expect(marks["page-script-start"]).toBeGreaterThan(0);
  });

  // ── Store separation ──────────────────────────────────────────

  it("marks and durations are disjoint stores", () => {
    loadMetrics();
    const m = getMetrics();
    m.mark("a");
    m.mark("b");
    m.measure("a-to-b", "a", "b");
    const marks = m.getMarks();
    const durs = m.get();
    // Marks contain timestamps, not duration names
    expect(typeof marks["a"]).toBe("number");
    expect(marks["a-to-b"]).toBeUndefined();
    // Durations contain numbers, not timestamps
    expect(typeof durs["a-to-b"]).toBe("number");
    expect(durs["a"]).toBeUndefined();
    expect(durs["b"]).toBeUndefined();
  });

  it("durations contain only finite numbers", () => {
    loadMetrics();
    const m = getMetrics();
    m.mark("start");
    m.mark("end");
    m.measure("dur", "start", "end");
    const durs = m.get();
    for (var key in durs) {
      if (Object.prototype.hasOwnProperty.call(durs, key)) {
        expect(typeof durs[key]).toBe("number");
        expect(isFinite(durs[key])).toBe(true);
      }
    }
  });

  it("flags contain only booleans", () => {
    loadMetrics();
    const m = getMetrics();
    var snap = m.snapshot();
    expect(typeof snap.flags.activePlay).toBe("boolean");
    expect(typeof snap.flags.firstUserInput).toBe("boolean");
    // active-play is a mark, not a flag
    m.markActivePlay();
    snap = m.snapshot();
    expect(typeof snap.flags.activePlay).toBe("boolean");
    expect(snap.flags.activePlay).toBe(true);
    // durations have no booleans
    expect(snap.durations["playable"]).toBeUndefined();
  });

  it("active play makes isPlayable() true", () => {
    loadMetrics();
    const m = getMetrics();
    expect(m.isPlayable()).toBe(false);
    m.markActivePlay();
    expect(m.isPlayable()).toBe(true);
  });

  it("markPlayable delegates to active play and is idempotent", () => {
    loadMetrics();
    const m = getMetrics();
    expect(m.isPlayable()).toBe(false);
    m.markPlayable();
    expect(m.isPlayable()).toBe(true);
    var snap = m.snapshot();
    expect(typeof snap.durations["playable"]).toBe("undefined"); // never in durations
    expect(snap.marks["active-play"]).toBeGreaterThan(0);
    // second call is idempotent
    m.markPlayable();
    expect(m.snapshot().marks["active-play"]).toBe(snap.marks["active-play"]);
  });

  it("markActivePlay is idempotent", () => {
    loadMetrics();
    const m = getMetrics();
    m.markActivePlay();
    var first = m.snapshot().marks["active-play"];
    m.markActivePlay();
    var second = m.snapshot().marks["active-play"];
    expect(second).toBe(first);
  });

  it("markOnce preserves first timestamp on repeat calls", () => {
    loadMetrics();
    const m = getMetrics();
    m.markOnce("unique-event");
    var first = m.getMarks()["unique-event"];
    expect(first).toBeGreaterThan(0);
    m.markOnce("unique-event");
    var second = m.getMarks()["unique-event"];
    expect(second).toBe(first);
  });

  it("clear removes JS state and flat mirror", () => {
    loadMetrics();
    const m = getMetrics();
    m.mark("test");
    m.mark("other");
    m.measure("test-dur", "test", "other");
    m.markActivePlay();
    m.clear();
    expect(m.get()).toEqual({});
    expect(m.getMarks()).toEqual({});
    expect(m.isPlayable()).toBe(false);
    expect((window as any).__paBootMetrics).toEqual({});
  });

  it("flat __paBootMetrics still readable for legacy consumers", () => {
    loadMetrics();
    const m = getMetrics();
    m.mark("game-ready");
    m.markActivePlay();
    const flat = (window as any).__paBootMetrics;
    expect(typeof flat["game-ready"]).toBe("number");
    expect(flat.flags.activePlay).toBe(true);
  });

  it("snapshot schema version is 2", () => {
    loadMetrics();
    const m = getMetrics();
    expect(m.snapshot().schemaVersion).toBe(2);
  });
});
