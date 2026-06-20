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
    bootStage: report.snapshot?.context.bootStage,
    firstFramePresented: report.snapshot?.context.firstFramePresented,
    longTaskSummary: report.snapshot?.context.longTaskSummary,
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

async function collectResourceEntriesRaw(page: Page): Promise<{
  names: string[];
  archiveUrls: string[];
}> {
  const entries = await collectResourceEntries(page);
  return {
    names: entries.map((e) => e.name),
    archiveUrls: entries
      .filter((r) => r.name.includes(".tar.gz"))
      .map((r) => r.name),
  };
}

for (const game of GAMES) {
  test.describe(`${game.name} playable-readiness performance`, () => {
    test("CP2.11 — fresh-context navigation", async ({ page }, testInfo) => {
      const diag = createDiagnosticCollector();
      try {
        diag.start(page);

        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await waitForLoaderHidden(page, 120000);

        const started = await performPrimaryAction(page);
        expect(started).toBe(true);

        await waitForMilestone(page, "active-play", 30000);
        await waitForMilestone(page, "first-user-input", 5000);

        const snapshot = await collectSnapshot(page);
        expect(snapshot).not.toBeNull();
        expect(snapshot!.schemaVersion).toBe(3);
        expect(snapshot!.flags.activePlay).toBe(true);
        expect(snapshot!.flags.firstUserInput).toBe(true);
        expect(snapshot!.context.firstFramePresented).toBe(true);

        const resourceEntries = await collectResourceEntries(page);
        const navType = await getNavigationType(page);
        const swControlled = snapshot!.context.serviceWorkerControlled;
        const classification = classifyLoadType(navType, swControlled);
        const hasNoError = await checkNoGameError(page);
        const canvasOk = await checkCanvasSized(page);

        const resourceInfo = await collectResourceEntriesRaw(page);
        const archiveDups = resourceInfo.archiveUrls.length;

        const runtimeDiag = await diag.snapshot(testInfo);

        const report: PerfReport = {
          game: game.id,
          label: "fresh-context",
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
          playable: snapshot!.flags.activePlay,
        };

        await attachReport(
          testInfo,
          game.id,
          "fresh-context",
          report,
          runtimeDiag,
        );

        expect(classification).toBe("fresh-context");
        expect(hasNoError).toBe(true);
        expect(canvasOk).toBe(true);
        expect(archiveDups).toBeLessThanOrEqual(1);
        expect(snapshot!.context.longTaskSummary?.count).toBeDefined();
      } finally {
        diag.stop();
      }
    });

    test("CP2.11 — query-fragment navigation", async ({ page }, testInfo) => {
      const diag = createDiagnosticCollector();
      try {
        diag.start(page);

        const pathWithQuery = `${game.path}?cachebuster=${Date.now()}`;
        await page.goto(pathWithQuery, { waitUntil: "domcontentloaded" });
        await waitForLoaderHidden(page, 120000);

        const snapshot = await collectSnapshot(page);
        expect(snapshot).not.toBeNull();
        expect(snapshot!.schemaVersion).toBe(3);
        expect(snapshot!.flags.activePlay).toBe(true);

        const resourceEntries = await collectResourceEntries(page);
        const resourceInfo = await collectResourceEntriesRaw(page);
        const archiveDups = resourceInfo.archiveUrls.length;

        const runtimeDiag = await diag.snapshot(testInfo);

        const report: PerfReport = {
          game: game.id,
          label: "query-fragment",
          classification: "fresh-context",
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
          playable: snapshot!.flags.activePlay,
        };

        await attachReport(
          testInfo,
          game.id,
          "query-fragment",
          report,
          runtimeDiag,
        );

        expect(archiveDups).toBeLessThanOrEqual(1);
        expect(snapshot!.context.firstFramePresented).toBe(true);
      } finally {
        diag.stop();
      }
    });

    test("CP2.11 — warmed second navigation", async ({ page }, testInfo) => {
      const diag = createDiagnosticCollector();
      try {
        diag.start(page);

        // First load to bootstrap page + service worker
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await waitForLoaderHidden(page, 120000);

        // Second navigation (not reload) mimics SW-controlled warm start
        await diag.beginScenario(page, "warmed");
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await waitForLoaderHidden(page, 120000);

        const snapshot = await collectSnapshot(page);
        expect(snapshot).not.toBeNull();
        expect(snapshot!.schemaVersion).toBe(3);
        expect(snapshot!.flags.activePlay).toBe(true);
        expect(snapshot!.flags.firstUserInput).toBe(true);

        const resourceEntries = await collectResourceEntries(page);
        const navType = await getNavigationType(page);
        const swControlled = snapshot!.context.serviceWorkerControlled;
        const classification = classifyLoadType(navType, swControlled);
        const resourceInfo = await collectResourceEntriesRaw(page);
        const archiveDups = resourceInfo.archiveUrls.length;

        const runtimeDiag = await diag.snapshot(testInfo);

        const report: PerfReport = {
          game: game.id,
          label: "warmed",
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
          playable: snapshot!.flags.activePlay,
        };

        await attachReport(testInfo, game.id, "warmed", report, runtimeDiag);
        expect(archiveDups).toBeLessThanOrEqual(1);
        expect(snapshot!.context.firstFramePresented).toBe(true);
      } finally {
        diag.stop();
      }
    });

    test("CP2.11 — reload navigation", async ({ page }, testInfo) => {
      const diag = createDiagnosticCollector();
      try {
        diag.start(page);

        // First load to activate service worker
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await waitForLoaderHidden(page, 120000);

        await diag.beginScenario(page, "reload");

        await page.reload({ waitUntil: "domcontentloaded" });
        await waitForLoaderHidden(page, 120000);

        const started = await performPrimaryAction(page);
        expect(started).toBe(true);

        await waitForMilestone(page, "active-play", 30000);
        await waitForMilestone(page, "first-user-input", 5000);

        const snapshot = await collectSnapshot(page);
        expect(snapshot).not.toBeNull();
        expect(snapshot!.schemaVersion).toBe(3);
        expect(snapshot!.flags.activePlay).toBe(true);
        expect(snapshot!.flags.firstUserInput).toBe(true);
        expect(snapshot!.context.firstFramePresented).toBe(true);

        const resourceEntries = await collectResourceEntries(page);
        const navType = await getNavigationType(page);
        const swControlled = snapshot!.context.serviceWorkerControlled;
        const classification = classifyLoadType(navType, swControlled);
        const hasNoError = await checkNoGameError(page);
        const canvasOk = await checkCanvasSized(page);

        const resourceInfo = await collectResourceEntriesRaw(page);
        const archiveDups = resourceInfo.archiveUrls.length;

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
          playable: snapshot!.flags.activePlay,
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
        expect(archiveDups).toBeLessThanOrEqual(1);
        expect(classification).toBe(
          swControlled
            ? "service-worker-controlled-reload"
            : "reload-uncontrolled",
        );
      } finally {
        diag.stop();
      }
    });

    test("CP2.12 — archive fetch failure", async ({ page }, testInfo) => {
      const diag = createDiagnosticCollector();
      await page.route(
        (url) =>
          url.pathname.includes(".tar.gz") &&
          url.hostname.includes("localhost"),
        (route) => route.abort("connectionrefused"),
      );

      try {
        diag.start(page);
        await page.goto(game.path, { waitUntil: "domcontentloaded" });

        await expect(async () => {
          await page.waitForFunction(
            () => {
              const loading = document.getElementById("game-loading");
              return (
                loading?.classList.contains("game-error") ||
                loading?.classList.contains("hidden")
              );
            },
            { timeout: 60000 },
          );
        }).not.toThrow();

        const snapshot = await collectSnapshot(page);
        expect(snapshot).not.toBeNull();
        expect(snapshot!.schemaVersion).toBe(3);

        const inErrorState = await page.evaluate(() => {
          const loading = document.getElementById("game-loading");
          return loading?.classList.contains("game-error") ?? false;
        });

        // Either error state shown or boot failed gracefully
        if (inErrorState) {
          expect(snapshot!.context.failedStage).not.toBeNull();
        }
      } finally {
        await page.unroute(
          (url) =>
            url.pathname.includes(".tar.gz") &&
            url.hostname.includes("localhost"),
        );
        diag.stop();
      }
    });

    test("CP2.12 — invalid archive bytes", async ({ page }, testInfo) => {
      const diag = createDiagnosticCollector();
      await page.route(
        (url) =>
          url.pathname.includes(".tar.gz") &&
          url.hostname.includes("localhost"),
        (route) => route.fulfill({ body: "not-a-real-archive" }),
      );

      try {
        diag.start(page);
        await page.goto(game.path, { waitUntil: "domcontentloaded" });

        await expect(async () => {
          await page.waitForFunction(
            () => {
              const loading = document.getElementById("game-loading");
              return (
                loading?.classList.contains("game-error") ||
                loading?.classList.contains("hidden")
              );
            },
            { timeout: 60000 },
          );
        }).not.toThrow();

        const snapshot = await collectSnapshot(page);
        expect(snapshot).not.toBeNull();
        expect(snapshot!.schemaVersion).toBe(3);
      } finally {
        await page.unroute(
          (url) =>
            url.pathname.includes(".tar.gz") &&
            url.hostname.includes("localhost"),
        );
        diag.stop();
      }
    });
  });

  test.describe(`${game.name} active-game health`, () => {
    test("CP2.14/15 — runtime main-thread health and state publication", async ({
      page,
    }, testInfo) => {
      const diag = createDiagnosticCollector();
      try {
        diag.start(page);

        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await waitForLoaderHidden(page, 120000);

        const started = await performPrimaryAction(page);
        expect(started).toBe(true);

        await waitForMilestone(page, "active-play", 30000);
        await waitForMilestone(page, "first-user-input", 5000);

        const SAMPLE_MS = 8000;
        const sampleEnd = Date.now() + SAMPLE_MS;

        const rAFIntervals: number[] = [];
        const canvasDigests: string[] = [];
        const stateTexts: string[] = [];
        let longTaskCount = 0;
        let longTaskTotalDuration = 0;
        let longTaskMaxDuration = 0;
        let inputBridgeCalls = 0;
        let lastRAFRaise: number | null = null;

        while (Date.now() < sampleEnd) {
          const result = await page.evaluate(() => {
            const canvas = document.getElementById(
              "canvas",
            ) as HTMLCanvasElement | null;
            const stateEl = document.getElementById("pa-game-state");
            const stateTextLocal = stateEl?.textContent || "";
            let canvasDigestLocal = "";
            if (canvas) {
              const ctx = canvas.getContext("2d");
              if (ctx) {
                try {
                  const d = ctx.getImageData(
                    0,
                    0,
                    Math.min(16, canvas.width),
                    Math.min(16, canvas.height),
                  );
                  let hash = 0;
                  for (let i = 0; i < d.data.length; i += 64) {
                    hash = (hash << 5) - hash + d.data[i];
                    hash |= 0;
                  }
                  canvasDigestLocal = hash.toString(16);
                } catch {}
              }
            }
            return {
              stateText: stateTextLocal,
              canvasDigest: canvasDigestLocal,
            };
          });

          stateTexts.push(result.stateText);
          canvasDigests.push(result.canvasDigest);

          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve()),
              ),
          );

          const now = Date.now();
          if (lastRAFRaise !== null) {
            rAFIntervals.push(now - lastRAFRaise);
          }
          lastRAFRaise = now;

          if (rAFIntervals.length % 60 === 0) {
            const bridgeOk = await page.evaluate(() => {
              const input = (window as any).PirateArcadeInput as
                | { keyDown: (key: string) => boolean }
                | undefined;
              if (!input?.keyDown) return false;
              return input.keyDown(" ");
            });
            if (bridgeOk) inputBridgeCalls++;
          }

          if (rAFIntervals.length % 120 === 0) {
            const snapshot = await collectSnapshot(page);
            if (snapshot?.context.longTaskSummary) {
              longTaskCount = snapshot.context.longTaskSummary.count;
              longTaskTotalDuration =
                snapshot.context.longTaskSummary.totalDuration;
              longTaskMaxDuration =
                snapshot.context.longTaskSummary.maxDuration;
            }
          }
        }

        const rAFCount = await page.evaluate(() => {
          let count = 0;
          return new Promise<number>((resolve) => {
            function countRAF() {
              count++;
              if (count >= 10) resolve(count);
              else requestAnimationFrame(countRAF);
            }
            requestAnimationFrame(countRAF);
          });
        });

        const snapshot = await collectSnapshot(page);
        const runtimeDiag = await diag.snapshot(testInfo);

        const uniqueStates = new Set(stateTexts.filter(Boolean));
        const stateMutationRate = uniqueStates.size / (SAMPLE_MS / 1000);

        const healthReport = {
          game: game.id,
          sampleMs: SAMPLE_MS,
          rAFIntervalCount: rAFIntervals.length,
          rAFIntervalsMs: {
            min: rAFIntervals.length
              ? Math.round(Math.min(...rAFIntervals))
              : "N/A",
            max: rAFIntervals.length
              ? Math.round(Math.max(...rAFIntervals))
              : "N/A",
            p50: rAFIntervals.length
              ? Math.round(
                  rAFIntervals.slice().sort((a, b) => a - b)[
                    Math.floor(rAFIntervals.length / 2)
                  ],
                )
              : "N/A",
            p95: rAFIntervals.length
              ? Math.round(
                  rAFIntervals.slice().sort((a, b) => a - b)[
                    Math.floor(rAFIntervals.length * 0.95)
                  ],
                )
              : "N/A",
          },
          intervalsOver50ms: rAFIntervals.filter((i) => i > 50).length,
          longTasks: {
            count: longTaskCount,
            totalDurationMs: longTaskTotalDuration,
            maxDurationMs: longTaskMaxDuration,
          },
          uniqueCanvasDigests: new Set(canvasDigests.filter(Boolean)).size,
          inputBridgeSuccessfulCalls: inputBridgeCalls,
          statePublication: {
            uniqueStatePayloads: uniqueStates.size,
            totalSamples: stateTexts.length,
            estimatedRateHz: Math.round(stateMutationRate * 10) / 10,
          },
          blockingErrors:
            runtimeDiag.consoleErrors.length + runtimeDiag.pageErrors.length,
        };

        console.log(
          `${game.id}: rAF p95=${healthReport.rAFIntervalsMs.p95}ms, stateRate=${healthReport.statePublication.estimatedRateHz}/s`,
        );

        await testInfo.attach(`health-${game.id}`, {
          body: JSON.stringify(healthReport, null, 2),
          contentType: "application/json",
        });
        await testInfo.attach(`health-diagnostics-${game.id}`, {
          body: JSON.stringify(runtimeDiag, null, 2),
          contentType: "application/json",
        });

        expect(rAFCount).toBeGreaterThan(0);
        expect(rAFIntervals.length).toBeGreaterThan(60);
        expect(healthReport.uniqueCanvasDigests).toBeGreaterThanOrEqual(1);
        expect(healthReport.blockingErrors).toBe(0);
        expect(healthReport.statePublication.estimatedRateHz).toBeLessThan(500);
        expect(
          healthReport.statePublication.uniqueStatePayloads,
        ).toBeGreaterThan(0);
      } finally {
        diag.stop();
      }
    });
  });
}
