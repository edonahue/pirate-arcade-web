import { describe, it, expect } from "vitest";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERIFY_PATH = resolve(__dirname, "../../scripts/verify-release.mjs");

interface VerifyCheck {
  id: string;
  name: string;
  cmd: string;
  phase: string;
  slow: boolean;
}

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
    expect(result.checks[0]).toHaveProperty("phase");
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
      expect(typeof c.phase).toBe("string");
      expect(typeof c.slow).toBe("boolean");
    }
  });
});
