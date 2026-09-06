import { describe, it, expect } from "vitest";
import {
  getPlayerProgressRate,
  getRivalProgressRate,
  getLeadState,
} from "../../src/games/race-to-treasure-island/helpers";
import { RACE_TUNING as T } from "../../src/games/race-to-treasure-island/tuning";

describe("race progress rates", () => {
  it("player base pace beats rival base pace narrowly", () => {
    const player = getPlayerProgressRate(80, false, false);
    const rival = getRivalProgressRate(80, false);
    expect(player).toBe(120);
    // Rival must pressure but not match a clean no-boost run outright.
    expect(rival).toBeGreaterThan(110);
    expect(player - rival).toBeLessThan(30);
  });

  it("rival surge/breather adjust symmetrically around base", () => {
    const base = getRivalProgressRate(100, false);
    const surge = getRivalProgressRate(100, false, true, false);
    const breather = getRivalProgressRate(100, false, false, true);
    expect(surge - base).toBe(T.aiSurgeBonus);
    expect(base - breather).toBe(T.aiBreatherPenalty);
  });

  it("mistake penalty still applies during surge", () => {
    const a = getRivalProgressRate(100, true, true, false);
    const b = getRivalProgressRate(100, false, true, false);
    expect(b - a).toBe(40);
  });

  it("scroll scaling preserved for both racers", () => {
    expect(getPlayerProgressRate(200, false, false)).toBe(180);
    expect(getRivalProgressRate(200, false)).toBe(
      T.aiBaseRate + (200 - T.baseScrollSpeed) * 0.45,
    );
  });

  it("stun halves player progress", () => {
    expect(getPlayerProgressRate(80, false, true)).toBeCloseTo(
      120 * T.stunSteerFactor,
      9,
    );
  });

  it("lead thresholds unchanged", () => {
    expect(getLeadState(201)).toBe("player");
    expect(getLeadState(-201)).toBe("rival");
    expect(getLeadState(0)).toBe("tied");
  });
});

describe("race pressure tuning", () => {
  it("scheduled pressure constants are coherent", () => {
    expect(T.aiSurgeDuration).toBe(4000);
    expect(T.aiBreatherDuration).toBe(4000);
    expect(T.aiSurgeEvery).toBe(2500);
    // A full surge is worth less than one treasure-route wind refill.
    expect((T.aiSurgeBonus * T.aiSurgeDuration) / 1000).toBeLessThan(200);
  });

  it("treasure wind restore is bounded", () => {
    expect(T.treasureWindRestore).toBeGreaterThan(0);
    expect(T.treasureWindRestore).toBeLessThanOrEqual(T.boostMax / 2);
  });

  it("win bonus keeps historical scale", () => {
    expect(T.winBonus).toBe(300);
  });
});
