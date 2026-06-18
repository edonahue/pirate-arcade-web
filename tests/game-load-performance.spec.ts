import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { loadPybagGames } from "./helpers/gameRegistry";
import {
  classifyLoadType,
  summarizeResources,
  buildArchiveEvidence,
  type PerfSnapshot,
  type ResourceEntry,
  type PerfReport,
} from "./helpers/performanceReport";
import type { RuntimeSnapshot } from "./helpers/diagnostics";
import {
  createDiagnosticCollector,
  getBootMetrics,
} from "./helpers/diagnostics";

const GAMES = loadPybagGames();

async function collectSnapshot(page: Page): Promise<PerfSnapshot | null> {
  return getBootMetrics(page) as Promise<PerfSnapshot | null>;
}

async function collectResourceEntries(page: Page): Promise<ResourceEntry[]> {
  return page.evaluate(() => {
    return performance
      .getEntriesByType("resource")
      .map((e: PerformanceEntry) => {
        const r = e as PerformanceResourceTiming;
        return {
          name: r.name,
          duration: r.duration,
          initiatorType: r.initiatorType,
          transferSize: r.transferSize,
          encodedBodySize: r.encodedBodySize,
          decodedBodySize: r.decodedBodySize,
          nextHopProtocol: r.nextHopProtocol || "",
        };
      });
  });
}

async function performPrimaryAction(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const actions = (window as any).PirateArcadeActions as
      | { performPrimary: () => void }
      | undefined;
    if (!actions?.performPrimary) return false;
    actions.performPrimary();
    return true;
  });
}

async function waitForMilestone(
  page: Page,
  milestone: string,
  timeoutMs: number,
): Promise<void> {
  try {
    await page.waitForFunction(
      (m: string) => {
        const pm = (window as any).PirateArcadeMetrics as
          | {
              snapshot: () => { marks: Record<string, number> };
            }
          | undefined;
        return pm?.snapshot?.().marks?.[m] !== undefined;
      },
      milestone,
      { timeout: timeoutMs },
    );
  } catch (err) {
    const url = page.url();
    let snapshot: string | null = null;
    try {
      const s = await page.evaluate(async () => {
        const pm = (window as any).PirateArcadeMetrics as
          | { snapshot: () => unknown }
          | undefined;
        if (!pm?.snapshot) return null;
        return JSON.stringify(pm.snapshot(), null, 2);
      });
      snapshot = s;
    } catch {
      snapshot = "(failed to capture)";
    }
    let loadingState = "unknown";
    try {
      loadingState = await page.evaluate(() => {
        const el = document.getElementById("game-loading");
        if (!el) return "missing";
        if (el.classList.contains("game-error")) return "error";
        if (el.classList.contains("hidden")) return "hidden";
        return "visible";
      });
    } catch {}
    throw new Error(
      `waitForMilestone("${milestone}") timed out after ${timeoutMs}ms\n` +
        `URL: ${url}\nLoading state: ${loadingState}\n` +
        `Latest metrics snapshot:\n${snapshot}`,
    );
  }
}

async function waitForLoaderHidden(
  page: Page,
  timeoutMs: number,
): Promise<void> {
  try {
    await page.waitForFunction(
      () => {
        const overlay = document.getElementById("game-loading");
        return !overlay || overlay.classList.contains("hidden");
      },
      undefined,
      { timeout: timeoutMs },
    );
  } catch (err) {
    const url = page.url();
    let snapshot: string | null = null;
    try {
      const s = await page.evaluate(async () => {
        const pm = (window as any).PirateArcadeMetrics as
          | { snapshot: () => unknown }
          | undefined;
        if (!pm?.snapshot) return null;
        return JSON.stringify(pm.snapshot(), null, 2);
      });
      snapshot = s;
    } catch {
      snapshot = "(failed to capture)";
    }
    throw new Error(
      `waitForLoaderHidden timed out after ${timeoutMs}ms\n` +
        `URL: ${url}\nLatest metrics snapshot:\n${snapshot}`,
    );
  }
}

async function getNavigationType(page: Page): Promise<string> {
  return page.evaluate(() => {
    const entries = performance.getEntriesByType("navigation");
    return entries.length > 0 ? (entries[0] as any).type : "unknown";
  });
}

async function checkNoGameError(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const loading = document.getElementById("game-loading");
    return loading ? !loading.classList.contains("game-error") : true;
  });
}

async function checkCanvasSized(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const c = document.getElementById("canvas");
    return c
      ? (c as HTMLCanvasElement).width > 100 &&
          (c as HTMLCanvasElement).height > 100
      : false;
  });
}

async function attachReport(
  testInfo: TestInfo,
  gameId: string,
  label: string,
  report: PerfReport,
  runtimeDiag: RuntimeSnapshot,
): Promise<void> {
  const summary = {
    game: report.game,
    label,
    classification: report.classification,
    milestones: {
      "page-script-start": report.snapshot?.marks["page-script-start"],
      "game-ready": report.snapshot?.marks["game-ready"],
      "loader-hidden": report.snapshot?.marks["loader-hidden"],
      "active-play": report.snapshot?.marks["active-play"],
      "first-user-input": report.snapshot?.marks["first-user-input"],
    },
    durations: report.snapshot?.durations,
    flags: report.snapshot?.flags,
    resources: {
      byType: report.resources.byType,
    },
    network: {
      archiveRequests: report.network.requests,
      duplicateStatus: report.network.duplicateStatus,
    },
    playable: report.playable,
  };
  console.log(
    `${gameId} (${label}/${report.classification}): activePlay=${report.playable}`,
  );
  await testInfo.attach(`perf-${gameId}-${label}`, {
    body: JSON.stringify(summary, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach(`diagnostics-${gameId}-${label}`, {
    body: JSON.stringify(runtimeDiag, null, 2),
    contentType: "application/json",
  });
}

for (const game of GAMES) {
  test.describe(`${game.name} playable-readiness performance`, () => {
    test("first navigation", async ({ page }, testInfo) => {
      const diag = createDiagnosticCollector();
      diag.start(page);

      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForLoaderHidden(page, 120000);

      const started = await performPrimaryAction(page);
      expect(started).toBe(true);

      await waitForMilestone(page, "active-play", 30000);
      await waitForMilestone(page, "first-user-input", 5000);

      const snapshot = await collectSnapshot(page);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.schemaVersion).toBe(1);
      expect(snapshot!.flags.activePlay).toBe(true);
      expect(snapshot!.flags.firstUserInput).toBe(true);

      const resourceEntries = await collectResourceEntries(page);
      const navType = await getNavigationType(page);
      const swControlled = snapshot!.context.serviceWorkerControlled;
      const classification = classifyLoadType(navType, swControlled);
      const hasNoError = await checkNoGameError(page);
      const canvasOk = await checkCanvasSized(page);

      const runtimeDiag = await diag.snapshot(testInfo);

      const report: PerfReport = {
        game: game.id,
        label: "first-navigation",
        classification,
        snapshot,
        resources: {
          entries: resourceEntries,
          byType: summarizeResources(resourceEntries),
        },
        network: buildArchiveEvidence(
          resourceEntries,
          runtimeDiag.observations || [],
          [],
        ),
        playable: true,
      };

      await attachReport(
        testInfo,
        game.id,
        "first-navigation",
        report,
        runtimeDiag,
      );

      expect(classification).toBe("fresh-context");
      expect(hasNoError).toBe(true);
      expect(canvasOk).toBe(true);
    });

    test("reload navigation", async ({ page }, testInfo) => {
      const diag = createDiagnosticCollector();
      diag.start(page);

      // First load to activate service worker
      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForLoaderHidden(page, 120000);

      // Begin a new scenario for the reload measurement
      diag.beginScenario("reload");

      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForLoaderHidden(page, 120000);

      const started = await performPrimaryAction(page);
      expect(started).toBe(true);

      await waitForMilestone(page, "active-play", 30000);
      await waitForMilestone(page, "first-user-input", 5000);

      const snapshot = await collectSnapshot(page);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.flags.activePlay).toBe(true);
      expect(snapshot!.flags.firstUserInput).toBe(true);

      const resourceEntries = await collectResourceEntries(page);
      const navType = await getNavigationType(page);
      const swControlled = snapshot!.context.serviceWorkerControlled;
      const classification = classifyLoadType(navType, swControlled);
      const hasNoError = await checkNoGameError(page);
      const canvasOk = await checkCanvasSized(page);

      const runtimeDiag = await diag.snapshot(testInfo);

      const report: PerfReport = {
        game: game.id,
        label: "reload-navigation",
        classification,
        snapshot,
        resources: {
          entries: resourceEntries,
          byType: summarizeResources(resourceEntries),
        },
        network: buildArchiveEvidence(
          resourceEntries,
          runtimeDiag.observations || [],
          [],
        ),
        playable: true,
      };

      await attachReport(
        testInfo,
        game.id,
        "reload-navigation",
        report,
        runtimeDiag,
      );

      expect(hasNoError).toBe(true);
      expect(canvasOk).toBe(true);
    });
  });
}
