import type { Page, TestInfo, Request, Response } from "@playwright/test";
import type { PerfSnapshot, RuntimeDiagnostics } from "./performanceReport";

const MAX_CONSOLE = 50;
const MAX_ERRORS = 20;
const MAX_REQUESTS = 50;

export interface DiagnosticCollector {
  start(page: Page): void;
  snapshot(testInfo: TestInfo): Promise<RuntimeDiagnostics>;
}

export function createDiagnosticCollector(): DiagnosticCollector {
  const consoleEntries: Array<{
    level: string;
    text: string;
    timestamp: number;
  }> = [];
  const pageErrors: Array<{
    message: string;
    stack?: string;
    timestamp: number;
  }> = [];
  const failedRequests: Array<{
    url: string;
    failure: string | null;
    timestamp: number;
  }> = [];
  const archiveRequests: Array<{
    url: string;
    status: number | null;
    timestamp: number;
  }> = [];
  const redirectCounts = new Map<string, number>();

  let currentPage: Page | null = null;
  let swAtStart: boolean | null = null;
  let handlersAttached = false;

  function onConsole(msg: { type: () => string; text: () => string }) {
    if (consoleEntries.length >= MAX_CONSOLE) return;
    consoleEntries.push({
      level: msg.type(),
      text: msg.text().slice(0, 500),
      timestamp: Date.now(),
    });
  }

  function onPageError(err: Error) {
    if (pageErrors.length >= MAX_ERRORS) return;
    pageErrors.push({
      message: err.message.slice(0, 500),
      stack: err.stack?.slice(0, 500),
      timestamp: Date.now(),
    });
  }

  function onRequestFailed(request: Request) {
    if (failedRequests.length >= MAX_REQUESTS) return;
    failedRequests.push({
      url: request.url().slice(0, 500),
      failure: request.failure()?.errorText ?? null,
      timestamp: Date.now(),
    });
  }

  function onResponse(response: Response) {
    const url = response.url();
    if (!url.includes(".tar.gz")) return;
    if (archiveRequests.length >= MAX_REQUESTS) return;
    archiveRequests.push({
      url: url.slice(0, 500),
      status: response.status(),
      timestamp: Date.now(),
    });
    const canonical = url.split("?")[0];
    redirectCounts.set(canonical, (redirectCounts.get(canonical) || 0) + 1);
  }

  return {
    start(page: Page) {
      if (handlersAttached) return;
      handlersAttached = true;
      currentPage = page;

      // Capture SW status at start
      page
        .evaluate(() => !!navigator.serviceWorker?.controller)
        .then((controlled) => {
          swAtStart = controlled;
        });

      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      page.on("requestfailed", onRequestFailed);
      page.on("response", onResponse);
    },

    async snapshot(testInfo: TestInfo): Promise<RuntimeDiagnostics> {
      const p = currentPage;
      if (!p) {
        return {
          schemaVersion: 1,
          url: "unknown",
          project: testInfo.project.name,
          navigation: {
            type: "unknown",
            serviceWorkerAtStart: swAtStart,
            serviceWorkerAtEnd: null,
          },
          runtime: {
            loadingState: "unknown",
            gameState: null,
            gameStateMeta: null,
            metrics: null,
          },
          network: {
            failedRequestCount: failedRequests.length,
            archiveRequestCount: archiveRequests.length,
            redirectCounts: Object.fromEntries(redirectCounts),
          },
          errors: {
            pageErrorCount: pageErrors.length,
            consoleErrorCount: consoleEntries.filter(
              (e) => e.level === "error" || e.level === "assert",
            ).length,
            consoleWarningCount: consoleEntries.filter(
              (e) => e.level === "warning",
            ).length,
          },
        };
      }

      const [metrics, navType, loadingState, gameState, swAtEnd] =
        await Promise.all([
          p
            .evaluate(() => {
              const pm = (window as any).PirateArcadeMetrics;
              if (!pm || typeof pm.snapshot !== "function") return null;
              return pm.snapshot() as PerfSnapshot;
            })
            .catch(() => null),
          p
            .evaluate(() => {
              const entries = performance.getEntriesByType("navigation");
              return entries.length > 0 ? (entries[0] as any).type : "unknown";
            })
            .catch(() => "unknown" as string),
          p
            .evaluate(() => {
              const el = document.getElementById("game-loading");
              if (!el) return "missing";
              if (el.classList.contains("game-error")) return "error";
              if (el.classList.contains("hidden")) return "hidden";
              return "visible";
            })
            .catch(() => "unknown" as string),
          p
            .evaluate(() => {
              const gs = (window as any).PirateArcadeGameState;
              if (!gs) return null;
              return {
                state: gs.getState ? gs.getState() : null,
                meta: gs.getMeta ? gs.getMeta() : null,
              };
            })
            .catch(() => null),
          p
            .evaluate(() => !!navigator.serviceWorker?.controller)
            .catch(() => false),
        ]);

      return {
        schemaVersion: 1,
        url: p.url(),
        project: testInfo.project.name,
        navigation: {
          type: navType,
          serviceWorkerAtStart: swAtStart,
          serviceWorkerAtEnd: swAtEnd,
        },
        runtime: {
          loadingState,
          gameState: gameState?.state ?? null,
          gameStateMeta: gameState?.meta ?? null,
          metrics,
        },
        network: {
          failedRequestCount: failedRequests.length,
          archiveRequestCount: archiveRequests.length,
          redirectCounts: Object.fromEntries(redirectCounts),
        },
        errors: {
          pageErrorCount: pageErrors.length,
          consoleErrorCount: consoleEntries.filter(
            (e) => e.level === "error" || e.level === "assert",
          ).length,
          consoleWarningCount: consoleEntries.filter(
            (e) => e.level === "warning",
          ).length,
        },
      };
    },
  };
}
