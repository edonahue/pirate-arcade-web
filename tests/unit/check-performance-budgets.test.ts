import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

function writeNonText(path: string, sizeBytes: number) {
  writeFileSync(path, randomBytes(sizeBytes));
}

// Writes a text file with low compressibility
function writeLowCompressText(path: string, sizeBytes: number) {
  writeFileSync(path, randomBytes(sizeBytes).toString("base64"));
}

const MODULE_PATH = "../../scripts/check-performance-budgets.mjs";

async function load() {
  return import(MODULE_PATH) as Promise<{
    checkDirectory: Function;
    runBudgets: Function;
    formatResults: Function;
    getGzippedSizeKB: Function;
    BUDGETS: Record<string, Record<string, number | string[]>>;
  }>;
}

describe("getGzippedSizeKB", () => {
  it("returns a positive number for a text file", async () => {
    const { getGzippedSizeKB } = await load();
    const size = getGzippedSizeKB(join(__dirname, "../../package.json"));
    expect(size).toBeGreaterThan(0);
  });
});

describe("checkDirectory", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "budget-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns zeroes for empty directory", async () => {
    const { checkDirectory } = await load();
    const result = checkDirectory(tmpDir, {});
    expect(result.totalKB).toBe(0);
    expect(result.maxSingleKB).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("accumulates file sizes", async () => {
    const { checkDirectory } = await load();
    writeNonText(join(tmpDir, "a.bin"), 2000);
    writeNonText(join(tmpDir, "b.bin"), 3000);
    const result = checkDirectory(tmpDir, {});
    expect(result.totalKB).toBeGreaterThan(4); // 5KB raw
    expect(result.maxSingleKB).toBeGreaterThan(2);
    expect(result.errors).toEqual([]);
  });

  it("reports single file exceeding maxSingleKB", async () => {
    const { checkDirectory } = await load();
    writeNonText(join(tmpDir, "big.bin"), 50000);
    const result = checkDirectory(tmpDir, { maxSingleKB: 20 });
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0]).toContain("exceeds single file limit");
  });

  it("accumulates subdirectory sizes into parent total", async () => {
    const { checkDirectory } = await load();
    const subDir = join(tmpDir, "sub");
    mkdirSync(subDir, { recursive: true });
    writeNonText(join(subDir, "a.bin"), 5000);
    writeNonText(join(tmpDir, "root.bin"), 3000);
    const rootResult = checkDirectory(tmpDir, {});
    expect(rootResult.totalKB).toBeGreaterThan(7); // 8KB raw should be >7KB
    expect(rootResult.maxSingleKB).toBeGreaterThan(4); // 5KB file should be >4KB
  });

  it("skips excluded subdirectories", async () => {
    const { checkDirectory } = await load();
    const ignoredDir = join(tmpDir, "node_modules");
    mkdirSync(ignoredDir, { recursive: true });
    writeNonText(join(ignoredDir, "big.bin"), 999999);
    writeNonText(join(tmpDir, "small.bin"), 100);
    const result = checkDirectory(tmpDir, { exclude: ["node_modules"] });
    expect(result.totalKB).toBeGreaterThan(0);
    expect(result.totalKB).toBeLessThan(10); // 100 bytes only
  });

  it("reports total exceeding maxTotalKB", async () => {
    const { checkDirectory } = await load();
    writeNonText(join(tmpDir, "a.bin"), 30000);
    writeNonText(join(tmpDir, "b.bin"), 30000);
    const result = checkDirectory(tmpDir, { maxTotalKB: 10 });
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0]).toContain("exceeds limit of");
  });

  it("reports HTML exceeding maxHtmlKB", async () => {
    const { checkDirectory } = await load();
    writeLowCompressText(join(tmpDir, "index.html"), 200000);
    const result = checkDirectory(tmpDir, { maxHtmlKB: 10 });
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0]).toContain("exceeds HTML limit");
  });

  it("reports JS exceeding maxJsKB", async () => {
    const { checkDirectory } = await load();
    writeLowCompressText(join(tmpDir, "bundle.js"), 200000);
    const result = checkDirectory(tmpDir, { maxJsKB: 20 });
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0]).toContain("exceeds JS limit");
  });

  it("reports CSS exceeding maxCssKB", async () => {
    const { checkDirectory } = await load();
    writeLowCompressText(join(tmpDir, "styles.css"), 200000);
    const result = checkDirectory(tmpDir, { maxCssKB: 20 });
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0]).toContain("exceeds CSS limit");
  });

  it("handles missing directory gracefully", async () => {
    const { checkDirectory } = await load();
    const result = checkDirectory("/nonexistent/path", { maxTotalKB: 100 });
    expect(result.totalKB).toBe(0);
    expect(result.errors).toEqual([]);
  });
});

describe("runBudgets", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "budget-run-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns passed=true when no budget violations", async () => {
    const { runBudgets } = await load();
    const budgets = {
      sub: { maxTotalKB: 1000, maxSingleKB: 500 },
    };
    mkdirSync(join(tmpDir, "sub"));
    writeFileSync(join(tmpDir, "sub", "a.html"), "small");
    const result = runBudgets(budgets, tmpDir);
    expect(result.passed).toBe(true);
    expect(result.results.length).toBe(1);
    expect(result.results[0].passed).toBe(true);
  });

  it("returns passed=false on violation", async () => {
    const { runBudgets } = await load();
    const budgets = {
      sub: { maxTotalKB: 1, maxSingleKB: 1 },
    };
    mkdirSync(join(tmpDir, "sub"));
    writeNonText(join(tmpDir, "sub", "big.bin"), 50000);
    const result = runBudgets(budgets, tmpDir);
    expect(result.passed).toBe(false);
    expect(result.results[0].passed).toBe(false);
  });

  it("includes timestamp in output", async () => {
    const { runBudgets } = await load();
    const result = runBudgets({}, tmpDir);
    expect(result.timestamp).toBeDefined();
    expect(typeof result.timestamp).toBe("string");
  });
});

describe("formatResults", () => {
  it("formats passed results", async () => {
    const { formatResults } = await load();
    const output = formatResults({
      passed: true,
      results: [
        {
          dir: "test",
          totalKB: 10.5,
          maxSingleKB: 5.2,
          passed: true,
          errors: [],
        },
      ],
      timestamp: "2025-01-01",
    });
    expect(output).toContain("Performance Budget Results");
    expect(output).not.toContain("failed");
  });

  it("formats failed results with errors", async () => {
    const { formatResults } = await load();
    const output = formatResults({
      passed: false,
      results: [
        {
          dir: "test",
          totalKB: 100,
          maxSingleKB: 50,
          passed: false,
          errors: ["test/big.js exceeds limit"],
        },
      ],
      timestamp: "2025-01-01",
    });
    expect(output).toContain("Some performance budget checks failed");
    expect(output).toContain("exceeds limit");
  });
});
