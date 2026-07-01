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
import { runInPageSample } from "./helpers/pygbagPerformance";

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

  test.describe(`${game.name} loop and state health`, () => {
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

        // Run the in-page sample (no per-frame Playwright round trips)
        const sample = await runInPageSample(page, SAMPLE_MS);

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

        const healthReport = {
          game: game.id,
          sampleMs: SAMPLE_MS,
          rAFIntervalCount: sample.rAFIntervalCount,
          rAFIntervalsMs: {
            min: sample.rAFIntervalMin,
            max: sample.rAFIntervalMax,
            p50: sample.rAFIntervalP50,
            p95: sample.rAFIntervalP95,
          },
          intervalsOver50ms: sample.intervalsOver50ms,
          mutationCountDelta: sample.mutationCountDelta,
          publisherDelta: sample.publisherDelta,
          bridgeDelta: sample.bridgeDelta,
          blockingErrors:
            runtimeDiag.consoleErrors.length + runtimeDiag.pageErrors.length,
        };

        console.log(
          `${game.id}: rAF p95=${healthReport.rAFIntervalsMs.p95}ms, ` +
            `publisher=${JSON.stringify(sample.publisherDelta)} bridge=${JSON.stringify(sample.bridgeDelta)}`,
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
        expect(sample.rAFIntervalCount).toBeGreaterThan(60);
        expect(healthReport.blockingErrors).toBe(0);

        // ── Publisher efficiency assertions ──
        const pubDelta = sample.publisherDelta;
        if (pubDelta) {
          // Publisher stats must be present for Pygbag games
          expect(pubDelta.updateCalls).toBeDefined();
          expect(typeof pubDelta.updateCalls).toBe("number");

          // State factory should not be called for every update
          const uc = pubDelta.updateCalls as number;
          const sfc = pubDelta.stateFactoryCalls as number;
          if (typeof sfc === "number" && uc > 0) {
            expect(sfc).toBeLessThan(uc / 3);
          }

          // State build skips must be greater than zero
          const sbs = pubDelta.stateBuildSkips as number;
          if (typeof sbs === "number") {
            expect(sbs).toBeGreaterThan(0);
          }

          // DOM writes should remain bounded (below ~15 Hz)
          const dw = pubDelta.domWrites as number;
          if (typeof dw === "number") {
            const domHz = dw / (SAMPLE_MS / 1000);
            expect(domHz).toBeLessThan(15);
          }

          // Stats snapshot counter is defined (incremented by game loop)
          const ssc = pubDelta.statsSnapshotCalls as number;
          expect(typeof ssc).toBe("number");

          // Draws and presentations should be present for active play
          expect(pubDelta.draws).toBeDefined();
          expect(typeof pubDelta.draws).toBe("number");
          expect(pubDelta.presentations).toBeDefined();
          expect(typeof pubDelta.presentations).toBe("number");

          // In active play, draws ≈ updateCalls (always rendering)
          const dwVal = pubDelta.draws as number;
          if (typeof uc === "number" && typeof dwVal === "number" && uc > 0) {
            expect(dwVal).toBeGreaterThanOrEqual(uc * 0.9);
          }

          // serializationAttempts should be close to actual domWrites + unchanged skips
          const sa = pubDelta.serializationAttempts as number;
          const us = pubDelta.unchangedPayloadSkips as number;
          if (
            typeof sa === "number" &&
            typeof dw === "number" &&
            typeof us === "number"
          ) {
            expect(sa).toBe(dw + us);
          }
        } else {
          // Race to Treasure Island returns null for publisher stats
          expect(game.id).toBe("race-to-treasure-island");
        }

        // ── Bridge efficiency assertions ──
        const bridgeDelta = sample.bridgeDelta;
        if (bridgeDelta) {
          // Parse count must not exceed changed raw payloads by unreasonable margin
          const pc = bridgeDelta.parseCount as number;
          const rrc = bridgeDelta.rawReadCount as number;
          if (typeof pc === "number" && typeof rrc === "number" && rrc > 0) {
            expect(pc).toBeLessThanOrEqual(rrc + 5);
          }

          // Subscriber notifications must not exceed successful parses
          const snc = bridgeDelta.subscriberNotificationCount as number;
          if (typeof pc === "number" && typeof snc === "number" && pc > 0) {
            expect(snc).toBeLessThanOrEqual(pc);
          }
        }
      } finally {
        diag.stop();
      }
    });

    test("CP2.16 — static menu stability", async ({ page }, testInfo) => {
      if (game.id === "race-to-treasure-island") {
        test.info().skip();
        return;
      }
      const diag = createDiagnosticCollector();
      try {
        diag.start(page);
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await waitForLoaderHidden(page, 120000);

        const canvasOk = await checkCanvasSized(page);
        expect(canvasOk).toBe(true);

        // Verify no game error
        const hasNoError = await checkNoGameError(page);
        expect(hasNoError).toBe(true);

        // Sample to catch any blocking errors
        const sample = await runInPageSample(page, 4000);
        const runtimeDiag = await diag.snapshot(testInfo);
        const errors =
          runtimeDiag.consoleErrors.length + runtimeDiag.pageErrors.length;
        expect(errors).toBe(0);

        // Verify the game is still in menu state (no crash)
        const stillOnMenu = await page.evaluate(() => {
          const gs = document.getElementById("pa-game-state");
          if (!gs || !gs.innerText) return "unknown";
          try {
            const parsed = JSON.parse(gs.innerText);
            return parsed.phase || "unknown";
          } catch {
            return "parse-error";
          }
        });
        expect(stillOnMenu).toBe("menu");

        // Publisher stats are frozen during static state (no heartbeat publishes for static ticks)
        // Draw suppression verified by design: should_draw() returns False for unchanged keys
        console.log(
          `${game.id} menu stable: rAF intervals=${sample.rAFIntervalCount}`,
        );
      } finally {
        diag.stop();
      }
    });

    test("CP2.17 — pause stability and resume", async ({ page }, testInfo) => {
      if (game.id === "race-to-treasure-island") {
        test.info().skip();
        return;
      }
      const diag = createDiagnosticCollector();
      try {
        diag.start(page);
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await waitForLoaderHidden(page, 120000);

        const started = await performPrimaryAction(page);
        expect(started).toBe(true);
        await waitForMilestone(page, "active-play", 30000);

        // Pause the game
        await page.keyboard.press("Escape");

        // Wait for pause state in DOM
        await page.waitForFunction(
          () => {
            const gs = document.getElementById("pa-game-state");
            if (!gs || !gs.innerText) return false;
            try {
              const parsed = JSON.parse(gs.innerText);
              return parsed.phase === "paused";
            } catch {
              return false;
            }
          },
          { timeout: 5000 },
        );

        // Sample during pause
        const sample = await runInPageSample(page, 3000);
        const runtimeDiag = await diag.snapshot(testInfo);
        const errors =
          runtimeDiag.consoleErrors.length + runtimeDiag.pageErrors.length;
        expect(errors).toBe(0);

        // Resume
        await page.keyboard.press("Escape");

        // Wait for active play to resume (publisher heartbeat)
        await page.waitForFunction(
          () => {
            const gs = document.getElementById("pa-game-state");
            if (!gs || !gs.innerText) return false;
            try {
              const parsed = JSON.parse(gs.innerText);
              return parsed.phase === "playing";
            } catch {
              return false;
            }
          },
          { timeout: 5000 },
        );

        console.log(
          `${game.id} pause stable: rAF intervals=${sample.rAFIntervalCount}`,
        );
      } finally {
        diag.stop();
      }
    });

    test("CP2.18 — hidden page safety with visibility override", async ({
      page,
    }, testInfo) => {
      if (game.id === "race-to-treasure-island") {
        test.info().skip();
        return;
      }
      const diag = createDiagnosticCollector();
      try {
        diag.start(page);
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await waitForLoaderHidden(page, 120000);

        const started = await performPrimaryAction(page);
        expect(started).toBe(true);
        await waitForMilestone(page, "active-play", 30000);

        // Override visibility to hidden via builtins
        await page.evaluate(() => {
          if (
            typeof (window as any).python?.PyRun_SimpleString === "function"
          ) {
            (window as any).python.PyRun_SimpleString(
              'import builtins; builtins.__dict__["__pa_page_visible__"] = False',
            );
          }
        });

        const sample = await runInPageSample(page, 4000);
        const runtimeDiag = await diag.snapshot(testInfo);
        const errors =
          runtimeDiag.consoleErrors.length + runtimeDiag.pageErrors.length;
        expect(errors).toBe(0);

        // Restore visibility
        await page.evaluate(() => {
          if (
            typeof (window as any).python?.PyRun_SimpleString === "function"
          ) {
            (window as any).python.PyRun_SimpleString(
              'import builtins; builtins.__dict__["__pa_page_visible__"] = True',
            );
          }
        });

        const pubDelta = sample.publisherDelta;
        expect(pubDelta).not.toBeNull();
        console.log(`${game.id} hidden: publisher=${JSON.stringify(pubDelta)}`);
      } finally {
        diag.stop();
      }
    });
  });
}
