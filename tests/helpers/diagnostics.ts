/**
 * Authoritative diagnostic collector for game-load tests.
 *
 * Design:
 * - Schema-versioned runtime snapshots (v3 — scenario, canvas, user-agent, visibility)
 * - Scenario partitioning via beginScenario() for reload tests
 * - Real request observations with redirect chain traversal
 * - Service-worker visibility tracking (unknown/null, never false)
 * - Monotonic collector lifetime vs scenario-scoped ring buffers
 * - Explicit snapshot reuse: snapshot() for assertions, attach() for reports
 */

import type { Page, TestInfo, Request, Response } from "@playwright/test";

// ── Configuration ────────────────────────────────────────────────

const MAX_CONSOLE = 50;
const MAX_ERRORS = 20;
const MAX_FAILED = 20;
const MAX_BAD_RESPONSES = 20;
const MAX_OBSERVATIONS = 100;
const MAX_REDIRECT_CHAIN_DEPTH = 20;

// ── Types ────────────────────────────────────────────────────────

/** Schema-versioned snapshot from window.PirateArcadeMetrics.snapshot() */
export interface BootMetricsSnapshot {
  schemaVersion: number;
  marks: Record<string, number>;
  durations: Record<string, number>;
  flags: { activePlay: boolean; firstUserInput: boolean };
  context: {
    url: string;
    serviceWorkerControlled: boolean;
    bootStage: string;
    failedStage: string | null;
    firstFramePresented: boolean;
    archiveUrl: string | null;
    archiveByteLength: number | null;
    runtimeScriptUrl: string | null;
    longTaskSummary: {
      count: number;
      totalDuration: number;
      maxDuration: number;
    };
  };
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
  setBootStage(stage: string): void;
  getBootStage(): string;
  setFailedStage(stage: string, errorMessage?: string): void;
  getFailedStage(): string | null;
  markFirstFramePresented(): void;
  hasFirstFrame(): boolean;
  setArchiveUrl(url: string): void;
  setArchiveByteLength(bytes: number): void;
  setRuntimeScriptUrl(url: string): void;
}

/** Typed interface for window.PirateArcadeGameState */
export interface PirateArcadeGameState {
  refresh(): void;
  getState(): Record<string, unknown>;
  subscribe(cb: (state: Record<string, unknown>) => void): () => void;
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
  /** Attach event listeners. Call before page.goto(). */
  start(page: Page): void;
  /** Begin a new named scenario — clears scenario-scoped state. Async to recapture SW state. */
  beginScenario(page: Page, name: string): Promise<void>;
  /** Take a snapshot of current page state + captured events. */
  snapshot(testInfo: TestInfo): Promise<RuntimeSnapshot>;
  /** Attach a snapshot to the test report. Accepts optional pre-existing snapshot. */
  attach(
    testInfo: TestInfo,
    scenarioName: string,
    snapshot?: RuntimeSnapshot,
    options?: { stop?: boolean },
  ): Promise<void>;
  /** Shortcut: capture + attach in one call. */
  captureAndAttach(testInfo: TestInfo, scenarioName: string): Promise<void>;
  /** Detach listeners and release page reference. */
  stop(): void;
}

export interface RuntimeSnapshot {
  schemaVersion: number;
  scenario: {
    name: string;
    startedAt: string;
    capturedAt: string;
    elapsedMs: number;
  };
  url: string;
  project: string;
  userAgent: string;
  documentVisibility: string;
  navigation: {
    type: string;
    serviceWorkerAtStart: boolean | null;
    serviceWorkerAtEnd: boolean | null;
  };
  loading: {
    state: string;
    text: string;
    infoboxText: string;
  };
  canvas: {
    present: boolean;
    intrinsicWidth: number;
    intrinsicHeight: number;
    cssWidth: number;
    cssHeight: number;
    display: string;
    visibility: string;
    visible: boolean;
  };
  gameState: unknown;
  gameStateMeta: unknown;
  metrics: BootMetricsSnapshot | null;
  observations: RequestObservation[];
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  failedRequests: string[];
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

// ── Ring buffer helpers ────────────────────────────────────────

function pushRing<T>(arr: T[], max: number, item: T): void {
  if (arr.length >= max) arr.shift();
  arr.push(item);
}

function clearRing<T>(arr: T[]): void {
  arr.length = 0;
}

// ── Redirect chain traversal ───────────────────────────────────

function captureRedirectChain(request: Request): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current = request.redirectedFrom();
  let depth = 0;
  while (current && depth < MAX_REDIRECT_CHAIN_DEPTH) {
    const url = current.url();
    if (seen.has(url)) break; // cycle detection
    seen.add(url);
    chain.unshift(url);
    current = current.redirectedFrom();
    depth++;
  }
  return chain;
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
  let scenarioStartedAt: number | null = null;

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
      const chain = captureRedirectChain(request);
      const finalUrl = request.url();
      // Store under the final URL so onResponse/onRequestFailed can retrieve it
      (request as any).__paRedirectChain = chain;
    }
  }

  function onRequestFailed(request: Request) {
    const url = request.url();
    const failure = request.failure()?.errorText ?? null;
    const chain = (request as any).__paRedirectChain || [];
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
      redirectChain: chain,
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

    const status = response.status();
    if (status >= 400) {
      pushRing(badResponses, MAX_BAD_RESPONSES, {
        url: url.slice(0, 500),
        status,
        statusText: response.statusText().slice(0, 100),
        timestamp: Date.now(),
      });
    }

    if (!url.includes(".tar.gz") && !url.includes("/play/")) return;

    const chain = (request as any).__paRedirectChain || [];

    let servedFromWorker: boolean | null = null;
    const headers = Object.fromEntries(Object.entries(response.headers()));
    if ("x-service-worker" in headers) {
      servedFromWorker = true;
    }

    pushRing(observations, MAX_OBSERVATIONS, {
      requestUrl: request.url().slice(0, 500),
      resourceType: request.resourceType(),
      method: request.method(),
      scenarioId: currentScenario,
      redirectChain: chain,
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

  /** Build the page-evaluated portion of a snapshot. */
  async function collectPageState(page: Page) {
    return Promise.all([
      getBootMetrics(page).catch(() => null),
      page
        .evaluate(() => {
          const entries = performance.getEntriesByType("navigation");
          return entries.length > 0 ? (entries[0] as any).type : "unknown";
        })
        .catch(() => "unknown" as string),
      page
        .evaluate(() => {
          const el = document.getElementById("game-loading");
          if (!el) return { state: "missing", text: "" };
          return {
            state: el.classList.contains("game-error")
              ? "error"
              : el.classList.contains("hidden")
                ? "hidden"
                : "visible",
            text: el.textContent?.trim() || "",
          };
        })
        .catch(() => ({ state: "unknown" as string, text: "" })),
      page
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
      page
        .evaluate(() => {
          const sw = navigator.serviceWorker?.controller;
          return sw ? true : sw === null ? false : null;
        })
        .catch(() => null),
      page.evaluate(() => navigator.userAgent).catch(() => "unknown"),
      page
        .evaluate(() => {
          const c = document.getElementById(
            "canvas",
          ) as HTMLCanvasElement | null;
          if (!c) {
            return {
              present: false,
              intrinsicWidth: 0,
              intrinsicHeight: 0,
              cssWidth: 0,
              cssHeight: 0,
              display: "none",
              visibility: "hidden",
              visible: false,
            };
          }
          const rect = c.getBoundingClientRect();
          const style = window.getComputedStyle(c);
          return {
            present: true,
            intrinsicWidth: c.width,
            intrinsicHeight: c.height,
            cssWidth: Math.round(rect.width),
            cssHeight: Math.round(rect.height),
            display: style.display,
            visibility: style.visibility,
            visible:
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 0 &&
              rect.height > 0,
          };
        })
        .catch(() => ({
          present: false,
          intrinsicWidth: 0,
          intrinsicHeight: 0,
          cssWidth: 0,
          cssHeight: 0,
          display: "unknown",
          visibility: "unknown",
          visible: false,
        })),
      page
        .evaluate(() => {
          const ib = document.getElementById("infobox") as HTMLElement | null;
          return ib?.textContent?.trim() || "";
        })
        .catch(() => ""),
      page
        .evaluate(() => document.visibilityState)
        .catch(() => "unknown" as string),
    ]);
  }

  return {
    start(page: Page) {
      if (handlersAttached) return;
      handlersAttached = true;
      currentPage = page;

      page
        .evaluate(() => {
          const sw = navigator.serviceWorker?.controller;
          return sw ? true : sw === null ? false : null;
        })
        .then((controlled) => {
          swAtStart = controlled;
        })
        .catch(() => {
          swAtStart = null;
        });

      attachHandlers(page);
    },

    async beginScenario(page: Page, name: string) {
      clearRing(consoleErrors);
      clearRing(consoleWarnings);
      clearRing(pageErrors);
      clearRing(failedRequests);
      clearRing(badResponses);
      clearRing(observations);
      swAtEnd = null;
      currentScenario = name;
      scenarioStartedAt = Date.now();

      if (page && !page.isClosed()) {
        try {
          const sw = await page.evaluate(() => {
            const ctrl = navigator.serviceWorker?.controller;
            return ctrl ? true : ctrl === null ? false : null;
          });
          swAtStart = sw;
        } catch {
          swAtStart = null;
        }
      }
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
      const capturedAt = Date.now();
      const elapsedMs =
        scenarioStartedAt != null ? capturedAt - scenarioStartedAt : 0;

      if (!p) {
        return {
          schemaVersion: 3,
          scenario: {
            name: currentScenario || "unknown",
            startedAt: scenarioStartedAt
              ? new Date(scenarioStartedAt).toISOString()
              : "",
            capturedAt: new Date(capturedAt).toISOString(),
            elapsedMs,
          },
          url: "unknown",
          project: testInfo.project.name,
          userAgent: "unknown",
          documentVisibility: "unknown",
          navigation: {
            type: "unknown",
            serviceWorkerAtStart: swAtStart,
            serviceWorkerAtEnd: null,
          },
          loading: { state: "unknown", text: "", infoboxText: "" },
          canvas: {
            present: false,
            intrinsicWidth: 0,
            intrinsicHeight: 0,
            cssWidth: 0,
            cssHeight: 0,
            display: "unknown",
            visibility: "unknown",
            visible: false,
          },
          gameState: null,
          gameStateMeta: null,
          metrics: null,
          observations: [],
          consoleErrors: consoleErrors.filter(
            (e) => !isHarmlessConsoleError(e),
          ),
          consoleWarnings: [...consoleWarnings],
          pageErrors: [...pageErrors],
          failedRequests: failedRequests.map((f) => f.url),
          badResponses: [...badResponses],
        };
      }

      const [
        metrics,
        navType,
        loadingInfo,
        gameStateResult,
        swAtEndResult,
        uaResult,
        canvasInfo,
        infoText,
        visibilityState,
      ] = await collectPageState(p);

      swAtEnd = swAtEndResult;

      return {
        schemaVersion: 3,
        scenario: {
          name: currentScenario || "unknown",
          startedAt: scenarioStartedAt
            ? new Date(scenarioStartedAt).toISOString()
            : "",
          capturedAt: new Date(capturedAt).toISOString(),
          elapsedMs,
        },
        url: p.url(),
        project: testInfo.project.name,
        userAgent: uaResult as string,
        documentVisibility: visibilityState as string,
        navigation: {
          type: navType as string,
          serviceWorkerAtStart: swAtStart,
          serviceWorkerAtEnd: swAtEnd,
        },
        loading: {
          state: (loadingInfo as any).state,
          text: (loadingInfo as any).text,
          infoboxText: infoText as string,
        },
        canvas: canvasInfo as RuntimeSnapshot["canvas"],
        gameState: (gameStateResult as any)?.state ?? null,
        gameStateMeta: (gameStateResult as any)?.meta ?? null,
        metrics,
        observations: [...observations],
        consoleErrors: consoleErrors.filter((e) => !isHarmlessConsoleError(e)),
        consoleWarnings: [...consoleWarnings],
        pageErrors: [...pageErrors],
        failedRequests: failedRequests.map((f) => f.url),
        badResponses: [...badResponses],
      };
    },

    async attach(
      testInfo: TestInfo,
      scenarioName: string,
      existingSnapshot?: RuntimeSnapshot,
      options?: { stop?: boolean },
    ): Promise<void> {
      const snap = existingSnapshot ?? (await this.snapshot(testInfo));
      const summary = {
        scenario: scenarioName,
        elapsedMs: snap.scenario.elapsedMs,
        canvasPresent: snap.canvas.present,
        canvasSize: snap.canvas.visible
          ? `${snap.canvas.cssWidth}x${snap.canvas.cssHeight}`
          : "hidden",
        loadingState: snap.loading.state,
        loadingText: snap.loading.text.slice(0, 100),
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
      if (options?.stop) {
        this.stop();
      }
    },

    async captureAndAttach(
      testInfo: TestInfo,
      scenarioName: string,
    ): Promise<void> {
      const snap = await this.snapshot(testInfo);
      await this.attach(testInfo, scenarioName, snap);
    },
  };
}
