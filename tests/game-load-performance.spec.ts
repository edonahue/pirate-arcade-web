import { test, expect } from "@playwright/test";
import { loadPybagGames } from "./helpers/gameRegistry";
import {
  classifyLoadType,
  summarizeResources,
  buildArchiveEvidence,
  type PerfSnapshot,
  type ResourceEntry,
  type PerfReport,
  type LoadClassification,
} from "./helpers/performanceReport";
import { createDiagnosticCollector } from "./helpers/runtimeDiagnostics";

const GAMES = loadPybagGames();

async function collectSnapshot(page: any): Promise<PerfSnapshot | null> {
  return page.evaluate(() => {
    const pm = (window as any).PirateArcadeMetrics;
    if (!pm || typeof pm.snapshot !== "function") return null;
    return pm.snapshot();
  });
}

async function collectResourceEntries(page: any): Promise<ResourceEntry[]> {
  return page.evaluate(() => {
    return performance.getEntriesByType("resource").map((e: any) => ({
      name: e.name,
      duration: e.duration,
      initiatorType: e.initiatorType,
      transferSize: e.transferSize,
      encodedBodySize: e.encodedBodySize,
      decodedBodySize: e.decodedBodySize,
      nextHopProtocol: e.nextHopProtocol || "",
    }));
  });
}

async function performPrimaryAction(page: any): Promise<boolean> {
  return page.evaluate(() => {
    const actions = (window as any).PirateArcadeActions;
    if (!actions || typeof actions.performPrimary !== "function") return false;
    actions.performPrimary();
    return true;
  });
}

async function waitForMilestone(
  page: any,
  milestone: string,
  timeoutMs: number,
): Promise<void> {
  await page.waitForFunction(
    (m: string) => {
      const pm = (window as any).PirateArcadeMetrics;
      return (
        pm &&
        typeof pm.snapshot === "function" &&
        pm.snapshot().marks[m] !== undefined
      );
    },
    milestone,
    { timeout: timeoutMs },
  );
}

async function waitForLoaderHidden(
  page: any,
  timeoutMs: number,
): Promise<void> {
  await page.waitForFunction(
    () => {
      const overlay = document.getElementById("game-loading");
      return !overlay || overlay.classList.contains("hidden");
    },
    { timeout: timeoutMs },
  );
}

async function getNavigationType(page: any): Promise<string> {
  return page.evaluate(() => {
    const entries = performance.getEntriesByType("navigation");
    return entries.length > 0 ? (entries[0] as any).type : "unknown";
  });
}

async function checkNoGameError(page: any): Promise<boolean> {
  return page.evaluate(() => {
    const loading = document.getElementById("game-loading");
    return loading ? !loading.classList.contains("game-error") : true;
  });
}

async function checkCanvasSized(page: any): Promise<boolean> {
  return page.evaluate(() => {
    const c = document.getElementById("canvas");
    return c
      ? (c as HTMLCanvasElement).width > 100 &&
          (c as HTMLCanvasElement).height > 100
      : false;
  });
}

function buildPlayableReport(
  game: string,
  label: string,
  classification: LoadClassification,
  snapshot: PerfSnapshot | null,
  resourceEntries: ResourceEntry[],
  observedRequests: Array<{ url: string; status: number | null }>,
  redirectSummaries: Array<{ url: string; redirectCount: number }>,
): PerfReport {
  const resourceByType = summarizeResources(resourceEntries);
  const network = buildArchiveEvidence(
    resourceEntries,
    observedRequests,
    redirectSummaries,
  );
  return {
    game,
    label,
    classification,
    snapshot,
    resources: {
      entries: resourceEntries,
      byType: resourceByType,
    },
    network,
    playable: snapshot?.flags.activePlay ?? false,
  };
}

function attachReport(
  testInfo: any,
  gameId: string,
  label: string,
  report: PerfReport,
) {
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
    `${gameId} (${label}/${report.classification}):`,
    JSON.stringify(summary, null, 2),
  );
  testInfo.attach(`perf-${gameId}-${label}`, {
    body: JSON.stringify(summary, null, 2),
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

      try {
        await waitForMilestone(page, "first-user-input", 5000);
      } catch {
        // first-user-input is informational — may not fire if bridge
        // unavailable at the moment of the first primary action
      }

      const snapshot = await collectSnapshot(page);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.schemaVersion).toBe(1);
      expect(snapshot!.flags.activePlay).toBe(true);

      const resourceEntries = await collectResourceEntries(page);
      const navType = await getNavigationType(page);
      const swControlled = snapshot!.context.serviceWorkerControlled;
      const classification = classifyLoadType(navType, swControlled);
      const hasNoError = await checkNoGameError(page);
      const canvasOk = await checkCanvasSized(page);
      const runtimeDiag = await diag.snapshot(testInfo);

      const observedRequests =
        runtimeDiag.network.archiveRequestCount > 0
          ? [{ url: game.path, status: 200 }]
          : [];

      const report = buildPlayableReport(
        game.id,
        "first-navigation",
        classification,
        snapshot,
        resourceEntries,
        observedRequests,
        [],
      );

      attachReport(testInfo, game.id, "first-navigation", report);
      testInfo.attach(`diagnostics-${game.id}-first-navigation`, {
        body: JSON.stringify(runtimeDiag, null, 2),
        contentType: "application/json",
      });

      // Critical assertions
      expect(classification).toBe("fresh-context");
      expect(hasNoError).toBe(true);
      expect(canvasOk).toBe(true);

      // Assert active-play was reached
      expect(report.playable).toBe(true);
    });

    test("reload navigation", async ({ page }, testInfo) => {
      const diag = createDiagnosticCollector();
      diag.start(page);

      // First load to activate service worker
      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForLoaderHidden(page, 120000);
      await performPrimaryAction(page);
      try {
        await waitForMilestone(page, "active-play", 30000);
      } catch {
        /* ok */
      }

      // Reload for the measured scenario
      await page.reload({ waitUntil: "domcontentloaded" });

      await waitForLoaderHidden(page, 120000);

      const started = await performPrimaryAction(page);
      expect(started).toBe(true);

      await waitForMilestone(page, "active-play", 30000);

      try {
        await waitForMilestone(page, "first-user-input", 5000);
      } catch {
        /* informational */
      }

      const snapshot = await collectSnapshot(page);
      expect(snapshot).not.toBeNull();

      const resourceEntries = await collectResourceEntries(page);
      const navType = await getNavigationType(page);
      const swControlled = snapshot!.context.serviceWorkerControlled;
      const classification = classifyLoadType(navType, swControlled);
      const hasNoError = await checkNoGameError(page);
      const canvasOk = await checkCanvasSized(page);
      const runtimeDiag = await diag.snapshot(testInfo);

      const report = buildPlayableReport(
        game.id,
        "reload-navigation",
        classification,
        snapshot,
        resourceEntries,
        [],
        [],
      );

      attachReport(testInfo, game.id, "reload-navigation", report);
      testInfo.attach(`diagnostics-${game.id}-reload-navigation`, {
        body: JSON.stringify(runtimeDiag, null, 2),
        contentType: "application/json",
      });

      // Critical assertions — same contract as first navigation
      expect(hasNoError).toBe(true);
      expect(canvasOk).toBe(true);
      expect(report.playable).toBe(true);

      // Log transfer characteristics (informational)
      const archiveByType = report.resources.byType["archive"];
      if (archiveByType) {
        console.log(
          `${game.id} reload archive: ${archiveByType.count} entries, ` +
            `${archiveByType.totalTransferSize} bytes transfer, ` +
            `${archiveByType.totalEncodedSize} bytes encoded`,
        );
      }
    });
  });
}
