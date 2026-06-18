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
});
