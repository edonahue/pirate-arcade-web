/**
 * Authoritative diagnostic collector for game-load tests.
 * Replaces browserGame.ts diagnostic functions and runtimeDiagnostics.ts.
 *
 * Design:
 * - Ring buffers for all captures (most recent N, bounded)
 * - Scenario partitioning via beginScenario() for reload tests
 * - Real request observations with redirect chains
 * - Service-worker visibility tracking
 * - Clean start()/stop() lifecycle with proper listener management
 */

import type { Page, TestInfo, Request, Response } from "@playwright/test";

// ── Configuration ────────────────────────────────────────────────

const MAX_CONSOLE = 50;
const MAX_ERRORS = 20;
const MAX_FAILED = 20;
const MAX_BAD_RESPONSES = 20;
const MAX_OBSERVATIONS = 100;

// ── Types ────────────────────────────────────────────────────────

export interface FailedRequest {
  url: string;
  failureText: string;
  timestamp?: number;
}

export interface BadResponse {
  url: string;
  status: number;
  statusText: string;
  timestamp?: number;
}

export interface PageDiagnostics {
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  failedRequests: FailedRequest[];
  badResponses: BadResponse[];
  observations: RequestObservation[];
  finalInfoboxText: string;
  canvasWidth: number;
  canvasHeight: number;
  canvasVisible: boolean;
  transferHidden: boolean;
  url: string;
  userAgent: string;
}

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

export interface DiagnosticCollector {
  /** Attach listeners. Call before page.goto(). */
  start(page: Page): void;
  /** Begin a new named scenario (resets scenario-scoped counters). */
  beginScenario(name: string): void;
  /** Take a snapshot of current page state + captured events. */
  snapshot(testInfo: TestInfo): Promise<RuntimeSnapshot>;
  /** Detach listeners and release page reference. */
  stop(): void;
}

export interface RuntimeSnapshot {
  schemaVersion: number;
  url: string;
  project: string;
  navigation: {
    type: string;
    serviceWorkerAtStart: boolean | null;
    serviceWorkerAtEnd: boolean | null;
  };
  loadingState: string;
  gameState: Record<string, unknown> | null;
  gameStateMeta: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  observations: RequestObservation[];
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  failedRequests: FailedRequest[];
  badResponses: BadResponse[];
}

// ── Harmless/blocking error classification ──────────────────────

const BLOCKING_PATTERNS: RegExp[] = [
  /EvalError/i,
  /Refused to evaluate a string as JavaScript/i,
  /Content Security Policy/i,
  /Could not load dynamic lib/i,
  /Failed to fetch/i,
  /TypeError/i,
  /ReferenceError/i,
  /SyntaxError/i,
  /Unhandled promise rejection/i,
];

const HARMLESS_PATTERNS: RegExp[] = [
  /wasm/i,
  /WebAssembly/i,
  /emscripten/i,
  /Emscripten/i,
  /unreachable/i,
  /SourceMap/i,
  /source map/i,
  /favicon/i,
  /Failed to load resource/i,
  /BrowserFS/i,
  /MEDIA/i,
];

export function isHarmlessConsoleError(text: string): boolean {
  if (BLOCKING_PATTERNS.some((re) => re.test(text))) return false;
  return HARMLESS_PATTERNS.some((re) => re.test(text));
}

export function blockingErrors(diag: PageDiagnostics): string[] {
  const all = [
    ...diag.consoleErrors,
    ...diag.pageErrors.map((e) => `PageError: ${e}`),
  ];
  return all.filter((e) => BLOCKING_PATTERNS.some((p) => p.test(e)));
}

// ── Ring buffer push helper ────────────────────────────────────

function pushRing<T>(arr: T[], max: number, item: T): void {
  if (arr.length >= max) arr.shift();
  arr.push(item);
}

// ── Diagnostic collector factory ────────────────────────────────

export function createDiagnosticCollector(): DiagnosticCollector {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: FailedRequest[] = [];
  const badResponses: BadResponse[] = [];
  const observations: RequestObservation[] = [];

  let currentPage: Page | null = null;
  let swAtStart: boolean | null = null;
  let swAtEnd: boolean | null = null;
  let handlersAttached = false;
  let currentScenario: string | null = null;

  // Tracing redirect chains
  const redirectMap = new Map<string, string[]>();

  function onConsole(msg: { type: () => string; text: () => string }) {
    if (msg.type() === "error")
      pushRing(consoleErrors, MAX_CONSOLE, msg.text().slice(0, 500));
    else if (msg.type() === "warning")
      pushRing(consoleWarnings, MAX_CONSOLE, msg.text().slice(0, 500));
  }

  function onPageError(err: Error) {
    pushRing(pageErrors, MAX_ERRORS, err.message.slice(0, 500));
  }

  function onRequest(request: Request) {
    const url = request.url();
    if (url.includes(".tar.gz") || url.includes("/play/")) {
      redirectMap.set(
        url,
        request.redirectedFrom()?.url()
          ? [request.redirectedFrom()!.url()]
          : [],
      );
    }
  }

  function onRequestFailed(request: Request) {
    const url = request.url();
    const failure = request.failure()?.errorText ?? null;
    pushRing(failedRequests, MAX_FAILED, {
      url: url.slice(0, 500),
      failureText: failure || "unknown",
      timestamp: Date.now(),
    });
    pushRing(observations, MAX_OBSERVATIONS, {
      requestUrl: url.slice(0, 500),
      resourceType: request.resourceType(),
      method: request.method(),
      scenarioId: currentScenario,
      redirectChain: redirectMap.get(url) || [],
      responseUrl: url.slice(0, 500),
      responseStatus: null,
      servedFromWorker: null,
      failure,
      timestamp: Date.now(),
    });
  }

  function onResponse(response: Response) {
    const url = response.url();
    const request = response.request();

    // Track bad responses
    const status = response.status();
    if (status >= 400) {
      pushRing(badResponses, MAX_BAD_RESPONSES, {
        url: url.slice(0, 500),
        status,
        statusText: response.statusText().slice(0, 100),
        timestamp: Date.now(),
      });
    }

    // Only observe game-related requests
    if (!url.includes(".tar.gz") && !url.includes("/play/")) return;

    const redirectChain = redirectMap.get(url) || [];

    let servedFromWorker: boolean | null = null;
    const headers = Object.fromEntries(Object.entries(response.headers()));
    if ("x-service-worker" in headers) {
      servedFromWorker = true;
    } else if ("cf-cache-status" in headers) {
      servedFromWorker = null;
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
      responseStatus: status,
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

    async snapshot(testInfo: TestInfo): Promise<RuntimeSnapshot> {
      const p = currentPage;
      if (!p) {
        return {
          schemaVersion: 2,
          url: "unknown",
          project: testInfo.project.name,
          navigation: {
            type: "unknown",
            serviceWorkerAtStart: swAtStart,
            serviceWorkerAtEnd: null,
          },
          loadingState: "unknown",
          gameState: null,
          gameStateMeta: null,
          metrics: null,
          observations: [],
          consoleErrors: consoleErrors.filter(
            (e) => !isHarmlessConsoleError(e),
          ),
          consoleWarnings: [...consoleWarnings],
          pageErrors: [...pageErrors],
          failedRequests: [...failedRequests],
          badResponses: [...badResponses],
        };
      }

      const [
        metrics,
        navType,
        loadingState,
        gameState,
        swAtEndResult,
        uaResult,
        canvasSize,
        infoText,
      ] = await Promise.all([
        p
          .evaluate(() => {
            const pm = (window as any).PirateArcadeMetrics;
            if (!pm || typeof pm.snapshot !== "function") return null;
            return pm.snapshot() as Record<string, unknown>;
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
        p.evaluate(() => navigator.userAgent).catch(() => "unknown"),
        p
          .evaluate(() => {
            const c = document.getElementById(
              "canvas",
            ) as HTMLCanvasElement | null;
            return c ? { w: c.width, h: c.height } : { w: 0, h: 0 };
          })
          .catch(() => ({ w: 0, h: 0 })),
        p
          .evaluate(() => {
            const ib = document.getElementById("infobox") as HTMLElement | null;
            return ib?.textContent?.trim() || "";
          })
          .catch(() => ""),
      ]);

      swAtEnd = swAtEndResult;

      return {
        schemaVersion: 2,
        url: p.url(),
        project: testInfo.project.name,
        navigation: {
          type: navType,
          serviceWorkerAtStart: swAtStart,
          serviceWorkerAtEnd: swAtEnd,
        },
        loadingState,
        gameState: (gameState as any)?.state ?? null,
        gameStateMeta: (gameState as any)?.meta ?? null,
        metrics,
        observations: [...observations],
        consoleErrors: consoleErrors.filter((e) => !isHarmlessConsoleError(e)),
        consoleWarnings: [...consoleWarnings],
        pageErrors: [...pageErrors],
        failedRequests: [...failedRequests],
        badResponses: [...badResponses],
      };
    },
  };
}

// ── Legacy compatibility ───────────────────────────────────────

/**
 * Start collecting diagnostics on a page.
 * @deprecated Use createDiagnosticCollector().start() instead.
 */
export function startDiagnostics(page: Page): PageDiagnostics {
  const diag: PageDiagnostics = {
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
    observations: [],
    finalInfoboxText: "",
    canvasWidth: 0,
    canvasHeight: 0,
    canvasVisible: false,
    transferHidden: false,
    url: "",
    userAgent: "",
  };

  const consoleHandler = (msg: { type(): string; text(): string }) => {
    if (msg.type() === "error")
      pushRing(diag.consoleErrors, MAX_CONSOLE, msg.text());
    else if (msg.type() === "warning")
      pushRing(diag.consoleWarnings, MAX_CONSOLE, msg.text());
  };
  const pageErrorHandler = (err: Error) =>
    pushRing(diag.pageErrors, MAX_ERRORS, err.message);
  const requestFailedHandler = (req: {
    url(): string;
    failure(): { errorText: string } | null;
  }) => {
    const failure = req.failure();
    pushRing(diag.failedRequests, MAX_FAILED, {
      url: req.url(),
      failureText: failure?.errorText || "unknown",
    });
  };
  const responseHandler = (resp: {
    url(): string;
    status(): number;
    statusText(): string;
  }) => {
    const status = resp.status();
    if (status >= 400) {
      pushRing(diag.badResponses, MAX_BAD_RESPONSES, {
        url: resp.url(),
        status,
        statusText: resp.statusText(),
      });
    }
  };

  page.on("console", consoleHandler);
  page.on("pageerror", pageErrorHandler);
  page.on("requestfailed", requestFailedHandler);
  page.on("response", responseHandler);

  (page as any).__diag_handlers = {
    consoleHandler,
    pageErrorHandler,
    requestFailedHandler,
    responseHandler,
  };

  return diag;
}

/**
 * @deprecated Use createDiagnosticCollector().snapshot() + collector.stop() instead.
 */
export async function snapshotDiagnostics(
  page: Page,
  diag: PageDiagnostics,
): Promise<PageDiagnostics> {
  const handlers = (page as any).__diag_handlers;
  if (handlers) {
    page.off("console", handlers.consoleHandler);
    page.off("pageerror", handlers.pageErrorHandler);
    page.off("requestfailed", handlers.requestFailedHandler);
    page.off("response", handlers.responseHandler);
    delete (page as any).__diag_handlers;
  }

  await page.waitForTimeout(500);

  const dom = await page.evaluate(() => {
    const ib = document.getElementById("infobox") as HTMLElement | null;
    const c = document.getElementById("canvas") as HTMLCanvasElement | null;
    const tr = document.getElementById("transfer") as HTMLElement | null;
    const cs = c ? window.getComputedStyle(c) : null;
    return {
      infoboxText: ib?.textContent?.trim() || "",
      canvasWidth: c?.width || 0,
      canvasHeight: c?.height || 0,
      canvasVisible: !!(
        c &&
        cs &&
        cs.visibility === "visible" &&
        cs.display !== "none"
      ),
      transferHidden: !!tr?.hidden,
    };
  });

  return {
    consoleErrors: diag.consoleErrors.filter((e) => !isHarmlessConsoleError(e)),
    consoleWarnings: diag.consoleWarnings,
    pageErrors: diag.pageErrors,
    failedRequests: diag.failedRequests,
    badResponses: diag.badResponses,
    observations: [],
    finalInfoboxText: dom.infoboxText,
    canvasWidth: dom.canvasWidth,
    canvasHeight: dom.canvasHeight,
    canvasVisible: dom.canvasVisible,
    transferHidden: dom.transferHidden,
    url: page.url(),
    userAgent: await page.evaluate(() => navigator.userAgent),
  };
}

/**
 * @deprecated Use createDiagnosticCollector() with proper start/stop lifecycle.
 */
export async function collectPageDiagnostics(
  page: Page,
): Promise<PageDiagnostics> {
  const diag = startDiagnostics(page);
  return snapshotDiagnostics(page, diag);
}

/**
 * Attach diagnostics payload to test report.
 */
export function attachDiagnostics(
  testInfo: TestInfo,
  diagnostics: PageDiagnostics,
): void {
  const summary = {
    canvasSize: `${diagnostics.canvasWidth}x${diagnostics.canvasHeight}`,
    canvasVisible: diagnostics.canvasVisible,
    transferHidden: diagnostics.transferHidden,
    consoleErrorCount: diagnostics.consoleErrors.length,
    pageErrorCount: diagnostics.pageErrors.length,
    failedRequestCount: diagnostics.failedRequests.length,
    badResponseCount: diagnostics.badResponses.length,
    finalInfoboxText: diagnostics.finalInfoboxText.slice(0, 200),
  };
  testInfo.attach("diagnostics-summary", {
    body: JSON.stringify(summary, null, 2),
    contentType: "application/json",
  });
  testInfo.attach("diagnostics-full", {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: "application/json",
  });
}
