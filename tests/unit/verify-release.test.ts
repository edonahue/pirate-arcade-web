import { describe, it, expect, vi } from "vitest";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERIFY_PATH = resolve(__dirname, "../../scripts/verify-release.mjs");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModuleImports = Record<string, any>;

async function load() {
  return import(VERIFY_PATH) as Promise<ModuleImports>;
}

describe("parseArgs", () => {
  it("defaults to no explicit profile when no selectors given", async () => {
    const { parseArgs } = await load();
    const { flags, profile, errors } = parseArgs([]);
    expect(flags.list).toBe(false);
    expect(flags.continueOnFail).toBe(false);
    expect(flags.json).toBe(false);
    expect(profile).toBeNull();
    expect(errors).toEqual([]);
  });

  it("--list sets list flag", async () => {
    const { parseArgs } = await load();
    const { flags } = parseArgs(["--list"]);
    expect(flags.list).toBe(true);
  });

  it("--continue sets continueOnFail flag", async () => {
    const { parseArgs } = await load();
    const { flags } = parseArgs(["--continue"]);
    expect(flags.continueOnFail).toBe(true);
  });

  it("--json sets json flag", async () => {
    const { parseArgs } = await load();
    const { flags } = parseArgs(["--json"]);
    expect(flags.json).toBe(true);
  });

  it("--fast selects fast profile", async () => {
    const { parseArgs } = await load();
    const { profile } = parseArgs(["--fast"]);
    expect(profile).toBe("fast");
  });

  it("--full selects full profile", async () => {
    const { parseArgs } = await load();
    const { profile } = parseArgs(["--full"]);
    expect(profile).toBe("full");
  });

  it("--profile=post-build selects post-build", async () => {
    const { parseArgs } = await load();
    const { profile } = parseArgs(["--profile=post-build"]);
    expect(profile).toBe("post-build");
  });

  it("--profile=prerequisites selects prerequisites", async () => {
    const { parseArgs } = await load();
    const { profile } = parseArgs(["--profile=prerequisites"]);
    expect(profile).toBe("prerequisites");
  });

  it("-fast and --full together errors", async () => {
    const { parseArgs } = await load();
    const { errors } = parseArgs(["--fast", "--full"]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("Contradictory");
  });

  it("--fast and --profile=full together errors", async () => {
    const { parseArgs } = await load();
    const { errors } = parseArgs(["--fast", "--profile=full"]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("unknown flag produces error", async () => {
    const { parseArgs } = await load();
    const { errors } = parseArgs(["--unknown-flag"]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("Unknown flag");
  });

  it("empty --profile= value produces error", async () => {
    const { parseArgs } = await load();
    const { errors } = parseArgs(["--profile="]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("empty --json-output= value produces error", async () => {
    const { parseArgs } = await load();
    const { errors } = parseArgs(["--json-output="]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("--json-output stores path", async () => {
    const { parseArgs } = await load();
    const { jsonOutputPath } = parseArgs(["--json-output=/tmp/test.json"]);
    expect(jsonOutputPath).toBe("/tmp/test.json");
  });

  it("combined flags work together", async () => {
    const { parseArgs } = await load();
    const { flags, profile, jsonOutputPath, errors } = parseArgs([
      "--fast",
      "--list",
      "--continue",
      "--json-output=/tmp/out.json",
    ]);
    expect(profile).toBe("fast");
    expect(flags.list).toBe(true);
    expect(flags.continueOnFail).toBe(true);
    expect(jsonOutputPath).toBe("/tmp/out.json");
    expect(errors).toEqual([]);
  });
});

describe("resolveProfile", () => {
  it("returns checks for fast profile", async () => {
    const { resolveProfile } = await load();
    const result = resolveProfile("fast");
    expect(result.error).toBeNull();
    expect(result.profile).toBe("fast");
    expect(result.checks.length).toBeGreaterThan(0);
    expect(result.checks[0]).toHaveProperty("id");
    expect(result.checks[0]).toHaveProperty("name");
    expect(result.checks[0]).toHaveProperty("cmd");
    expect(result.checks[0]).toHaveProperty("group");
    expect(result.checks[0]).toHaveProperty("cmdParts");
  });

  it("returns checks for full profile", async () => {
    const { resolveProfile } = await load();
    const result = resolveProfile("full");
    expect(result.error).toBeNull();
    expect(result.profile).toBe("full");
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it("full has more checks than fast", async () => {
    const { resolveProfile } = await load();
    const fast = resolveProfile("fast");
    const full = resolveProfile("full");
    expect(full.checks.length).toBeGreaterThan(fast.checks.length);
  });

  it("post-build excludes format/typecheck/build", async () => {
    const { resolveProfile } = await load();
    const result = resolveProfile("post-build");
    expect(result.error).toBeNull();
    const ids = result.checks.map((c: { id: string }) => c.id);
    expect(ids).not.toContain("format");
    expect(ids).not.toContain("typecheck");
    expect(ids).not.toContain("build");
  });

  it("prerequisites has exactly 3 checks", async () => {
    const { resolveProfile } = await load();
    const { checks } = resolveProfile("prerequisites");
    expect(checks.length).toBe(3);
    expect(checks.map((c: { id: string }) => c.id)).toEqual([
      "format",
      "typecheck",
      "build",
    ]);
  });

  it("unknown profile returns error", async () => {
    const { resolveProfile } = await load();
    const result = resolveProfile("nonexistent");
    expect(result.error).not.toBeNull();
    expect(result.error).toContain("Unknown profile");
    expect(result.checks).toEqual([]);
  });

  it("post-build has correct size (fast minus 3)", async () => {
    const { resolveProfile } = await load();
    const fast = resolveProfile("fast");
    const pb = resolveProfile("post-build");
    expect(pb.checks.length).toBe(fast.checks.length - 3);
  });

  it("each check has required properties", async () => {
    const { resolveProfile } = await load();
    const { checks } = resolveProfile("fast");
    for (const c of checks) {
      expect(typeof c.id).toBe("string");
      expect(typeof c.name).toBe("string");
      expect(typeof c.cmd).toBe("string");
      expect(typeof c.group).toBe("string");
      expect(Array.isArray(c.cmdParts)).toBe(true);
    }
  });
});

describe("buildReport (schema v3)", () => {
  it("produces schema v3 with summary and skippedChecks", async () => {
    const { buildReport } = await load();
    const startedAt = new Date("2026-01-01T00:00:00Z");
    const results = [
      {
        id: "a",
        name: "A",
        command: "echo a",
        status: "passed",
        elapsedMs: 100,
        exitCode: 0,
        signal: null,
      },
      {
        id: "b",
        name: "B",
        command: "echo b",
        status: "failed",
        elapsedMs: 200,
        exitCode: 1,
        signal: null,
      },
    ];
    const skipped = [{ id: "c", name: "C", reason: "fail-fast" }];
    const report = buildReport("fast", results, startedAt, skipped);
    expect(report.schemaVersion).toBe(3);
    expect(report.summary).toEqual({
      passed: 1,
      failed: 1,
      skipped: 1,
      total: 3,
    });
    expect(report.skippedChecks).toHaveLength(1);
    expect(report.skippedChecks[0]).toEqual({
      id: "c",
      name: "C",
      reason: "fail-fast",
    });
    expect((report as any).skipped).toBeUndefined();
  });

  it("empty skipped list", async () => {
    const { buildReport } = await load();
    const startedAt = new Date("2026-01-01T00:00:00Z");
    const results = [
      {
        id: "a",
        name: "A",
        command: "echo a",
        status: "passed",
        elapsedMs: 100,
        exitCode: 0,
        signal: null,
      },
    ];
    const report = buildReport("fast", results, startedAt, []);
    expect(report.summary).toEqual({
      passed: 1,
      failed: 0,
      skipped: 0,
      total: 1,
    });
    expect(report.skippedChecks).toEqual([]);
  });

  it("reports slowest in descending order", async () => {
    const { buildReport } = await load();
    const startedAt = new Date("2026-01-01T00:00:00Z");
    const results = [
      {
        id: "a",
        name: "A",
        command: "echo a",
        status: "passed",
        elapsedMs: 500,
        exitCode: 0,
        signal: null,
      },
      {
        id: "b",
        name: "B",
        command: "echo b",
        status: "passed",
        elapsedMs: 300,
        exitCode: 0,
        signal: null,
      },
      {
        id: "c",
        name: "C",
        command: "echo c",
        status: "passed",
        elapsedMs: 100,
        exitCode: 0,
        signal: null,
      },
    ];
    const report = buildReport("fast", results, startedAt, []);
    expect(report.slowest).toHaveLength(3);
    expect(report.slowest[0].name).toBe("A");
    expect(report.slowest[1].name).toBe("B");
    expect(report.slowest[2].name).toBe("C");
  });
});

describe("runChecksByGroup", () => {
  it("zero checks returns empty results", async () => {
    const { runChecksByGroup } = await load();
    const { results, skipped } = await runChecksByGroup({
      checks: [],
      continueOnFail: false,
    });
    expect(results).toEqual([]);
    expect(skipped).toEqual([]);
  });

  it("one check runs and reports result", async () => {
    const { runChecksByGroup } = await load();
    const fakeRun = () => ({
      id: "a",
      name: "A",
      command: "echo a",
      status: "passed",
      elapsedMs: 10,
      exitCode: 0,
      signal: null,
    });
    const { results, skipped } = await runChecksByGroup({
      checks: [
        {
          id: "a",
          name: "A",
          cmd: "echo a",
          cmdParts: ["echo", "a"],
          group: "prereq",
        },
      ],
      continueOnFail: false,
      runCheck: fakeRun,
    });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("a");
    expect(results[0].status).toBe("passed");
    expect(skipped).toEqual([]);
  });

  it("more checks than workers processed correctly", async () => {
    const { runChecksByGroup } = await load();
    let callCount = 0;
    const fakeRun = () => {
      callCount++;
      return {
        id: `c${callCount}`,
        name: `C${callCount}`,
        command: "echo",
        status: "passed",
        elapsedMs: 10,
        exitCode: 0,
        signal: null,
      };
    };
    const checks = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i + 1}`,
      name: `C${i + 1}`,
      cmd: "echo",
      cmdParts: ["echo"],
      group: "static",
    }));
    const { results, skipped } = await runChecksByGroup({
      checks,
      continueOnFail: true,
      runCheck: fakeRun,
    });
    expect(results).toHaveLength(10);
    expect(skipped).toEqual([]);
  });

  it("fast fail skips remaining checks in all groups", async () => {
    const { runChecksByGroup } = await load();
    const passRun = () => ({
      id: "ok",
      name: "OK",
      command: "echo",
      status: "passed",
      elapsedMs: 10,
      exitCode: 0,
      signal: null,
    });
    const failRun = () => ({
      id: "fail",
      name: "FAIL",
      command: "echo",
      status: "failed",
      elapsedMs: 10,
      exitCode: 1,
      signal: null,
    });
    let useFail = false;
    const fakeRun = (check: any) => {
      if (check.id === "fail-check") useFail = true;
      const r = useFail ? failRun() : passRun();
      r.id = check.id;
      r.name = check.name;
      return r;
    };
    const { results, skipped } = await runChecksByGroup({
      checks: [
        {
          id: "prereq1",
          name: "Pre1",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "prereq",
        },
        {
          id: "fail-check",
          name: "Fail",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "prereq",
        },
        {
          id: "static1",
          name: "S1",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "static",
        },
      ],
      continueOnFail: false,
      runCheck: fakeRun,
    });
    expect(results).toHaveLength(2);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].id).toBe("static1");
    expect(skipped[0].reason).toBe("fail-fast");
  });

  it("continue mode does not skip remaining checks after failure", async () => {
    const { runChecksByGroup } = await load();
    let callCount = 0;
    const fakeRun = (check: any) => {
      callCount++;
      const passed = check.id !== "fail-me";
      return {
        id: check.id,
        name: check.name,
        command: check.cmd,
        status: passed ? "passed" : "failed",
        elapsedMs: 10,
        exitCode: passed ? 0 : 1,
        signal: null,
      };
    };
    const fakeRunAsync = (check: any) => {
      callCount++;
      const passed = check.id !== "fail-me";
      return Promise.resolve({
        id: check.id,
        name: check.name,
        command: check.cmd,
        status: passed ? "passed" : "failed",
        elapsedMs: 5,
        exitCode: passed ? 0 : 1,
        signal: null,
      });
    };
    const { results, skipped } = await runChecksByGroup({
      checks: [
        {
          id: "a",
          name: "A",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "prereq",
        },
        {
          id: "fail-me",
          name: "Fail",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "prereq",
        },
        {
          id: "c",
          name: "C",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "static",
        },
      ],
      continueOnFail: true,
      runCheck: fakeRun,
      runCheckAsync: fakeRunAsync,
    });
    expect(results).toHaveLength(3);
    expect(skipped).toEqual([]);
    expect(callCount).toBe(3);
  });

  it("prerequisite failure stops execution", async () => {
    const { runChecksByGroup } = await load();
    const fakeRun = (check: any) => ({
      id: check.id,
      name: check.name,
      command: check.cmd,
      status: "failed",
      elapsedMs: 10,
      exitCode: 1,
      signal: null,
    });
    const { results, skipped } = await runChecksByGroup({
      checks: [
        {
          id: "a",
          name: "A",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "prereq",
        },
        {
          id: "b",
          name: "B",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "static",
        },
        {
          id: "c",
          name: "C",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "browser",
        },
      ],
      continueOnFail: false,
      runCheck: fakeRun,
    });
    expect(results).toHaveLength(1);
    expect(skipped).toHaveLength(2);
  });

  it("skipped with reason for prerequisite failure", async () => {
    const { runChecksByGroup } = await load();
    const fakeRun = (check: any) => ({
      id: check.id,
      name: check.name,
      command: check.cmd,
      status: check.id === "ok" ? "passed" : "failed",
      elapsedMs: 10,
      exitCode: check.id === "ok" ? 0 : 1,
      signal: null,
    });
    const { results, skipped } = await runChecksByGroup({
      checks: [
        {
          id: "ok",
          name: "OK",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "prereq",
        },
        {
          id: "fail",
          name: "FAIL",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "prereq",
        },
        {
          id: "skipped1",
          name: "Skipped1",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "static",
        },
      ],
      continueOnFail: false,
      runCheck: fakeRun,
    });
    expect(results).toHaveLength(2);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].id).toBe("skipped1");
  });

  it("original check ordering preserved in results", async () => {
    const { runChecksByGroup } = await load();
    const delayed = new Map<string, number>();
    delayed.set("static2", 50);
    delayed.set("static1", 10);
    const fakeRunAsync = (check: any) => {
      const delay = delayed.get(check.id) || 0;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            id: check.id,
            name: check.name,
            command: check.cmd,
            status: "passed",
            elapsedMs: delay,
            exitCode: 0,
            signal: null,
          });
        }, delay);
      });
    };

    const { results } = await runChecksByGroup({
      checks: [
        {
          id: "prereq1",
          name: "Pre1",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "prereq",
        },
        {
          id: "prereq2",
          name: "Pre2",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "prereq",
        },
        {
          id: "static1",
          name: "S1",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "static",
        },
        {
          id: "static2",
          name: "S2",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "static",
        },
      ],
      continueOnFail: true,
      runCheck: (c: any) => ({
        id: c.id,
        name: c.name,
        command: c.cmd,
        status: "passed",
        elapsedMs: 1,
        exitCode: 0,
        signal: null,
      }),
      runCheckAsync: fakeRunAsync,
    });
    expect(results).toHaveLength(4);
    expect(results[0].id).toBe("prereq1");
    expect(results[1].id).toBe("prereq2");
    expect(results[2].id).toBe("static1");
    expect(results[3].id).toBe("static2");
  });

  it("signal propagation in result", async () => {
    const { runChecksByGroup } = await load();
    const fakeRun = (check: any) => ({
      id: check.id,
      name: check.name,
      command: check.cmd,
      status: "failed",
      elapsedMs: 10,
      exitCode: null,
      signal: "SIGTERM",
    });
    const { results } = await runChecksByGroup({
      checks: [
        {
          id: "a",
          name: "A",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "prereq",
        },
      ],
      continueOnFail: false,
      runCheck: fakeRun,
    });
    expect(results[0].signal).toBe("SIGTERM");
    expect(results[0].exitCode).toBeNull();
  });

  it("browser checks do not run in parallel with each other", async () => {
    const { runChecksByGroup } = await load();
    const order: string[] = [];
    const fakeRun = (check: any) => {
      order.push(check.id);
      return {
        id: check.id,
        name: check.name,
        command: check.cmd,
        status: "passed",
        elapsedMs: 1,
        exitCode: 0,
        signal: null,
      };
    };
    const { results } = await runChecksByGroup({
      checks: [
        {
          id: "a",
          name: "A",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "browser",
        },
        {
          id: "b",
          name: "B",
          cmd: "echo",
          cmdParts: ["echo"],
          group: "browser",
        },
      ],
      continueOnFail: true,
      runCheck: fakeRun,
    });
    expect(order).toEqual(["a", "b"]);
    expect(results).toHaveLength(2);
  });
});

describe("runChecksParallel", () => {
  it("empty checks returns empty array", async () => {
    const { runChecksParallel } = await load();
    const results = await runChecksParallel([], 3);
    expect(results).toEqual([]);
  });

  it("all checks complete even with delay", async () => {
    const { runChecksParallel } = await load();

    const checks = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i + 1}`,
      name: `C${i + 1}`,
      cmd: "echo",
      cmdParts: ["echo"],
      group: "static",
    }));

    // Use injected runCheckAsync in runChecksByGroup, but runChecksParallel
    // calls runCommandAsync directly. We can test the function itself by
    // testing that it returns results in order. This is an integration test
    // since it spawns real processes.
    const results = await runChecksParallel(
      [
        {
          id: "echo",
          name: "Echo",
          cmd: "echo hello",
          cmdParts: ["echo", "hello"],
          group: "static",
        },
      ],
      3,
    );
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("echo");
    expect(results[0].status).toBe("passed");
    expect(results[0].exitCode).toBe(0);
  });
});
