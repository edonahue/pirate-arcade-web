import { describe, it, expect } from "vitest";
import { tooling, modelRuns } from "../../src/data/experiment";

// Currency contracts for the public experiment record: every row must
// declare whether it describes the current stack or a historical session,
// and current rows must not carry known-stale version/size claims.
// Historical rows (old model sessions, build-log-adjacent notes) are
// exempt by design — history is never rewritten to match the present.
describe("experiment currency", () => {
  it("every tooling row declares current or historical status", () => {
    expect(tooling.length).toBeGreaterThan(0);
    for (const entry of tooling) {
      expect(["current", "historical"]).toContain(entry.status);
    }
  });

  it("every model run declares a historical or current era", () => {
    expect(modelRuns.length).toBeGreaterThan(0);
    for (const run of modelRuns) {
      expect(["historical", "current"]).toContain(run.era);
    }
  });

  it("current tooling rows carry no known-stale version or size claims", () => {
    const stale = ["Phaser 3", "Astro 6", "12 MB"];
    for (const entry of tooling.filter((e) => e.status === "current")) {
      const text = [...entry.usedFor, entry.notes].join("\n");
      for (const marker of stale) {
        expect(text).not.toContain(marker);
      }
    }
  });
});
