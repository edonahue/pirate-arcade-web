/**
 * Authoritative diagnostic collector for game-load tests.
 * Replaces browserGame.ts diagnostic functions.
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

/** Schema-versioned snapshot from window.PirateArcadeMetrics.snapshot() */
export interface BootMetricsSnapshot {
  schemaVersion: number;
  marks: Record<string, number>;
  /** Durations are strictly finite numbers — no booleans or other types */
  durations: Record<string, number>;
  flags: { activePlay: boolean; firstUserInput: boolean };
  context: { url: string; serviceWorkerControlled: boolean };
}

/** Typed interface for window.PirateArcadeMetrics */
export interface PirateArcadeMetrics {
  mark(name: string): void;
  markOnce(name: string): number | undefined;
  measure(name: string, startMark: string, endMark: string): number | undefined;
  get(): Record<string, number>;
  clear(): void;
  getMarks(): Record<string, number>;
  snapshot(): BootMetricsSnapshot;
  computeDurations(): void;
  markPlayable(): void;
  isPlayable(): boolean;
  markActivePlay(): void;
  markFirstUserInput(): void;
}

/** Typed interface for window.PirateArcadeGameState */
export interface PirateArcadeGameState {
  refresh(): void;
  getState(): Record<string, unknown>;
  subscribe(cb: (state: Record<string, unknown>) => void): void;
}

/** Retrieve typed PirateArcadeMetrics snapshot from a page */
export async function getBootMetrics(
  page: Page,
): Promise<BootMetricsSnapshot | null> {
  return page.evaluate(() => {
    const pm = (window as any).PirateArcadeMetrics as
      | PirateArcadeMetrics
      | undefined;
    if (!pm || typeof pm.snapshot !== "function") return null;
    return pm.snapshot();
  });
}

/** Check if PirateArcadeMetrics is available on the page */
export async function hasBootMetrics(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return typeof (window as any).PirateArcadeMetrics?.snapshot === "function";
  });
}

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
  /** Begin a new named scenario (resets scenario-scoped ring buffers). */
  beginScenario(name: string): void;
  /** Take a snapshot of current page state + captured events. */
  snapshot(testInfo: TestInfo): Promise<RuntimeSnapshot>;
  /** Attach snapshot to test report and detach listeners. */
  attach(
    testInfo: TestInfo,
    scenarioName: string,
    snapshot?: RuntimeSnapshot,
  ): Promise<void>;
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
  metrics: BootMetricsSnapshot | Record<string, unknown> | null;
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

export function blockingErrors(diag: {
  consoleErrors: string[];
  pageErrors: string[];
}): string[] {
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

function clearRing<T>(arr: T[]): void {
  arr.length = 0;
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
      const chain: string[] = [];
      let current = request.redirectedFrom();
      while (current) {
        chain.unshift(current.url());
        current = current.redirectedFrom();
      }
      redirectMap.set(url, chain);
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
      // Cannot determine worker provenance from Cloudflare headers alone
      servedFromWorker = null;
    }
    // Default: null/unknown when Playwright cannot determine provenance
    // Only true with positive evidence, false only with reliable negative evidence

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
        })
        .catch(() => {
          swAtStart = null;
        });

      attachHandlers(page);
    },

    beginScenario(name: string) {
      clearRing(consoleErrors);
      clearRing(consoleWarnings);
      clearRing(pageErrors);
      clearRing(failedRequests);
      clearRing(badResponses);
      clearRing(observations);
      redirectMap.clear();
      swAtEnd = null;
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
        getBootMetrics(p).catch(() => null),
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
            const gs = (window as any).PirateArcadeGameState as
              | PirateArcadeGameState
              | undefined;
            if (!gs) return null;
            return {
              state: gs.getState ? gs.getState() : null,
              meta: (gs as any).getMeta ? (gs as any).getMeta() : null,
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

    async attach(
      testInfo: TestInfo,
      scenarioName: string,
      existingSnapshot?: RuntimeSnapshot,
    ): Promise<void> {
      const snap = existingSnapshot ?? (await this.snapshot(testInfo));
      const summary = {
        scenario: scenarioName,
        canvasSize: "see-full-diagnostics",
        loadingState: snap.loadingState,
        consoleErrorCount: snap.consoleErrors.length,
        pageErrorCount: snap.pageErrors.length,
        failedRequestCount: snap.failedRequests.length,
        badResponseCount: snap.badResponses.length,
        observationCount: snap.observations.length,
        navigation: snap.navigation,
      };
      await testInfo.attach(`${scenarioName}-diagnostics-summary`, {
        body: JSON.stringify(summary, null, 2),
        contentType: "application/json",
      });
      await testInfo.attach(`${scenarioName}-diagnostics-full`, {
        body: JSON.stringify(snap, null, 2),
        contentType: "application/json",
      });
      this.stop();
    },
  };
}
