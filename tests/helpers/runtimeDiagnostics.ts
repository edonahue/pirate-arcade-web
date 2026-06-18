import type { Page, TestInfo, Request, Response } from "@playwright/test";
import type { PerfSnapshot, RuntimeDiagnostics } from "./performanceReport";

const MAX_CONSOLE = 50;
const MAX_ERRORS = 20;
const MAX_REQUESTS = 50;
const MAX_OBSERVATIONS = 100;

export interface RequestObservation {
  requestUrl: string;
  resourceType: string;
  method: string;
  scenarioId: string | null;
  redirectChain: string[];
  responseUrl: string;
  responseStatus: number | null;
  servedFromWorker: boolean | null;
  failure: string | null;
  timestamp: number;
}

function pushRing<T>(arr: T[], max: number, item: T): void {
  if (arr.length >= max) arr.shift();
  arr.push(item);
}

export interface DiagnosticCollector {
  start(page: Page): void;
  beginScenario(name: string): void;
  snapshot(testInfo: TestInfo): Promise<RuntimeDiagnostics>;
  stop(): void;
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
  const observations: RequestObservation[] = [];

  let currentPage: Page | null = null;
  let swAtStart: boolean | null = null;
  let handlersAttached = false;
  let currentScenario: string | null = null;

  // Tracing redirect chains
  const redirectMap = new Map<string, string[]>();
  const seenBefore = new Set<string>();

  function onConsole(msg: { type: () => string; text: () => string }) {
    pushRing(consoleEntries, MAX_CONSOLE, {
      level: msg.type(),
      text: msg.text().slice(0, 500),
      timestamp: Date.now(),
    });
  }

  function onPageError(err: Error) {
    pushRing(pageErrors, MAX_ERRORS, {
      message: err.message.slice(0, 500),
      stack: err.stack?.slice(0, 500),
      timestamp: Date.now(),
    });
  }

  function onRequest(request: Request) {
    const url = request.url();
    if (!url.includes(".tar.gz")) return;
    redirectMap.set(
      url,
      request.redirectedFrom()?.url() ? [request.redirectedFrom()!.url()] : [],
    );
  }

  function onRequestFailed(request: Request) {
    pushRing(failedRequests, MAX_REQUESTS, {
      url: request.url().slice(0, 500),
      failure: request.failure()?.errorText ?? null,
      timestamp: Date.now(),
    });
    pushRing(observations, MAX_OBSERVATIONS, {
      requestUrl: request.url().slice(0, 500),
      resourceType: request.resourceType(),
      method: request.method(),
      scenarioId: currentScenario,
      redirectChain: redirectMap.get(request.url()) || [],
      responseUrl: request.url().slice(0, 500),
      responseStatus: null,
      servedFromWorker: null,
      failure: request.failure()?.errorText ?? null,
      timestamp: Date.now(),
    });
  }

  function onResponse(response: Response) {
    const url = response.url();
    const request = response.request();

    if (url.includes(".tar.gz")) {
      pushRing(archiveRequests, MAX_REQUESTS, {
        url: url.slice(0, 500),
        status: response.status(),
        timestamp: Date.now(),
      });
      const canonical = url.split("?")[0];
      redirectCounts.set(canonical, (redirectCounts.get(canonical) || 0) + 1);
    }

    // Only observe game-related requests (Pygbag archives, HTML, shared scripts)
    if (!url.includes(".tar.gz") && !url.includes("/play/")) return;

    const redirectChain = redirectMap.get(url) || [];

    // Determine if response was served via worker
    let servedFromWorker: boolean | null = null;
    const headers = response.headers();
    if ("x-service-worker" in headers) {
      servedFromWorker = true;
    } else if ("cf-cache-status" in headers) {
      servedFromWorker = null; // Cloudflare cache — ambiguous
    } else {
      servedFromWorker = false;
    }

    pushRing(observations, MAX_OBSERVATIONS, {
      requestUrl: request.url().slice(0, 500),
      resourceType: request.resourceType(),
      method: request.method(),
      scenarioId: currentScenario,
      redirectChain,
      responseUrl: url.slice(0, 500),
      responseStatus: response.status(),
      servedFromWorker,
      failure: null,
      timestamp: Date.now(),
    });
  }

  function attachHandlers(page: Page) {
    page.on("console", onConsole);
    page.on("pageerror", onPageError);
    page.on("request", onRequest);
    page.on("requestfailed", onRequestFailed);
    page.on("response", onResponse);
  }

  function detachHandlers(page: Page) {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("request", onRequest);
    page.off("requestfailed", onRequestFailed);
    page.off("response", onResponse);
  }

  return {
    start(page: Page) {
      if (handlersAttached) return;
      handlersAttached = true;
      currentPage = page;

      // Capture SW status at start (best-effort async)
      page
        .evaluate(() => !!navigator.serviceWorker?.controller)
        .then((controlled) => {
          swAtStart = controlled;
        });

      attachHandlers(page);
    },

    beginScenario(name: string) {
      currentScenario = name;
    },

    stop() {
      if (currentPage && handlersAttached) {
        detachHandlers(currentPage);
        handlersAttached = false;
      }
      currentPage = null;
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
          observations,
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
        observations,
      };
    },
  };
}
