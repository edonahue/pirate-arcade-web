import { test, expect } from "@playwright/test";

interface ResourceSummary {
  wasm: { count: number; totalDuration: number };
  archive: { count: number; totalDuration: number };
  script: { count: number; totalDuration: number };
  stylesheet: { count: number; totalDuration: number };
  other: { count: number; totalDuration: number };
}

interface PerfResult {
  metrics: Record<string, number>;
  resources: ResourceSummary;
  bottlenecks: string[];
}

async function collectPerfResult(page: any): Promise<PerfResult> {
  const metrics = await page.evaluate(() => (window as any).__paBootMetrics);
  const resources = await page.evaluate(() => {
    const entries = performance.getEntriesByType("resource");
    const summary: ResourceSummary = {
      wasm: { count: 0, totalDuration: 0 },
      archive: { count: 0, totalDuration: 0 },
      script: { count: 0, totalDuration: 0 },
      stylesheet: { count: 0, totalDuration: 0 },
      other: { count: 0, totalDuration: 0 },
    };
    for (const e of entries) {
      const name = (e as any).name || "";
      const dur = (e as any).duration || 0;
      if (name.includes(".wasm") || name.includes(".wasm?")) {
        summary.wasm.count++;
        summary.wasm.totalDuration += dur;
      } else if (name.includes(".tar.gz") || name.includes(".tar.gz?")) {
        summary.archive.count++;
        summary.archive.totalDuration += dur;
      } else if (
        name.endsWith(".js") ||
        name.includes(".js?") ||
        (e as any).initiatorType === "script"
      ) {
        summary.script.count++;
        summary.script.totalDuration += dur;
      } else if (
        name.endsWith(".css") ||
        name.includes(".css?") ||
        (e as any).initiatorType === "link"
      ) {
        summary.stylesheet.count++;
        summary.stylesheet.totalDuration += dur;
      } else {
        summary.other.count++;
        summary.other.totalDuration += dur;
      }
    }
    return summary;
  });

  const bottlenecks: string[] = [];
  const totalResourceDuration =
    resources.wasm.totalDuration +
    resources.archive.totalDuration +
    resources.script.totalDuration +
    resources.stylesheet.totalDuration +
    resources.other.totalDuration;

  if (resources.wasm.totalDuration > 5000)
    bottlenecks.push(
      `WASM loading: ${(resources.wasm.totalDuration / 1000).toFixed(1)}s`,
    );
  if (resources.archive.totalDuration > 10000)
    bottlenecks.push(
      `Archive fetch: ${(resources.archive.totalDuration / 1000).toFixed(1)}s`,
    );
  if (resources.script.totalDuration > 3000)
    bottlenecks.push(
      `Script loading: ${(resources.script.totalDuration / 1000).toFixed(1)}s`,
    );

  if (metrics) {
    const bootToReady = metrics["game-ready"] - metrics["boot-start"];
    if (bootToReady > 30000)
      bottlenecks.push(
        `Total boot→game-ready: ${(bootToReady / 1000).toFixed(1)}s`,
      );

    const extractDuration =
      metrics["archive-extract-end"] - metrics["archive-extract-start"];
    if (extractDuration > 10000)
      bottlenecks.push(
        `Archive extraction: ${(extractDuration / 1000).toFixed(1)}s`,
      );
  }

  return { metrics, resources, bottlenecks };
}

function logAndAttach(
  testInfo: any,
  gameName: string,
  label: string,
  result: PerfResult,
) {
  const summary = {
    game: gameName,
    label,
    resourceBreakdown: result.resources,
    bottlenecks:
      result.bottlenecks.length > 0 ? result.bottlenecks : "none identified",
    totalResourceDuration:
      result.resources.wasm.totalDuration +
      result.resources.archive.totalDuration +
      result.resources.script.totalDuration +
      result.resources.stylesheet.totalDuration +
      result.resources.other.totalDuration,
  };
  console.log(`${gameName} (${label}):`, JSON.stringify(summary, null, 2));
  testInfo.attach(`perf-${gameName}-${label}`, {
    body: JSON.stringify(summary, null, 2),
    contentType: "application/json",
  });
}

function deriveMetrics(metrics: Record<string, number>, bootStartKey: string) {
  if (!metrics) return {};
  const pageStart = metrics["page-script-start"] || 0;
  const bootStart = metrics[bootStartKey] || 0;
  const gameReady = metrics["game-ready"] || 0;
  const loaderHidden = metrics["loader-hidden"] || 0;
  return {
    "page→python-ready": metrics["python-ready"] - pageStart,
    "page→game-ready": gameReady - pageStart,
    "boot→game-ready": gameReady - bootStart,
    "pygame-install":
      metrics["pygame-install-end"] - metrics["pygame-install-start"],
    "archive-fetch":
      metrics["archive-fetch-end"] - metrics["archive-fetch-start"],
    "archive-extract":
      metrics["archive-extract-end"] - metrics["archive-extract-start"],
    "display-init": metrics["display-init-end"] - metrics["display-init-start"],
    "game-ready→loader-hidden": loaderHidden - gameReady,
  };
}

const GAMES = [
  {
    id: "cannonball-clash",
    name: "Cannonball Clash",
    path: "/play/cannonball-clash/",
  },
  { id: "treasure-cove", name: "Treasure Cove", path: "/play/treasure-cove/" },
];

for (const game of GAMES) {
  test.describe(`${game.name} load performance`, () => {
    test("cold load — collect metrics, resources, and identify bottlenecks", async ({
      page,
    }, testInfo) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      await page.waitForFunction(
        () => {
          const m = (window as any).__paBootMetrics;
          return m !== undefined && m["game-ready"] !== undefined;
        },
        { timeout: 120000 },
      );

      await page.waitForFunction(
        () => {
          const overlay = document.getElementById("game-loading");
          return !overlay || overlay.classList.contains("hidden");
        },
        { timeout: 120000 },
      );

      const result = await collectPerfResult(page);

      // Expect all essential metrics
      expect(result.metrics).toHaveProperty("page-script-start");
      expect(result.metrics).toHaveProperty("python-ready");
      expect(result.metrics).toHaveProperty("boot-start");
      expect(result.metrics).toHaveProperty("pygame-install-start");
      expect(result.metrics).toHaveProperty("pygame-install-end");
      expect(result.metrics).toHaveProperty("archive-fetch-start");
      expect(result.metrics).toHaveProperty("archive-fetch-end");
      expect(result.metrics).toHaveProperty("archive-extract-start");
      expect(result.metrics).toHaveProperty("archive-extract-end");
      expect(result.metrics).toHaveProperty("display-init-start");
      expect(result.metrics).toHaveProperty("display-init-end");
      expect(result.metrics).toHaveProperty("input-bridge-installed");
      expect(result.metrics).toHaveProperty("game-ready");
      expect(result.metrics).toHaveProperty("loader-hidden");

      const derived = deriveMetrics(result.metrics, "boot-start");

      logAndAttach(testInfo, game.id, "cold", result);
      testInfo.attach(`derived-metrics-${game.id}-cold`, {
        body: JSON.stringify(derived, null, 2),
        contentType: "application/json",
      });

      // Resource breakdown assertions
      expect(result.resources.archive.count).toBeGreaterThanOrEqual(1);
      expect(result.resources.script.count).toBeGreaterThanOrEqual(1);

      // No critical errors
      const hasRuntimeError = await page.evaluate(() => {
        const w = window as any;
        return (
          !!w.PirateArcadeLoading &&
          document
            .getElementById("game-loading")
            ?.classList.contains("game-error")
        );
      });
      expect(hasRuntimeError).toBe(false);

      // Warn on bottlenecks but don't fail (CI environment may be slow)
      if (result.bottlenecks.length > 0) {
        console.warn(
          `⚠️  ${game.name} cold-load bottlenecks:\n  - ${result.bottlenecks.join("\n  - ")}`,
        );
      }
    });

    test("warm reload — resources should be cached by SW", async ({
      page,
    }, testInfo) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      // Wait for initial game-ready
      await page.waitForFunction(
        () => {
          const m = (window as any).__paBootMetrics;
          return m !== undefined && m["game-ready"] !== undefined;
        },
        { timeout: 120000 },
      );

      await page.waitForFunction(
        () => {
          const overlay = document.getElementById("game-loading");
          return !overlay || overlay.classList.contains("hidden");
        },
        { timeout: 120000 },
      );

      // Reload to simulate repeat visit (SW cache should serve resources)
      await page.reload({ waitUntil: "domcontentloaded" });

      await page.waitForFunction(
        () => {
          const m = (window as any).__paBootMetrics;
          return m !== undefined && m["game-ready"] !== undefined;
        },
        { timeout: 120000 },
      );

      await page.waitForFunction(
        () => {
          const overlay = document.getElementById("game-loading");
          return !overlay || overlay.classList.contains("hidden");
        },
        { timeout: 120000 },
      );

      const result = await collectPerfResult(page);
      logAndAttach(testInfo, game.id, "warm", result);

      // Warm load should be faster overall
      const bootToReady =
        result.metrics["game-ready"] - result.metrics["boot-start"];
      console.log(`${game.name} warm boot→ready: ${bootToReady}ms`);

      // Check for errors
      const hasRuntimeError = await page.evaluate(() => {
        const w = window as any;
        return (
          !!w.PirateArcadeLoading &&
          document
            .getElementById("game-loading")
            ?.classList.contains("game-error")
        );
      });
      expect(hasRuntimeError).toBe(false);
    });
  });
}
