/**
 * Pygbag performance sampling helper.
 *
 * Provides typed structures and an in-page sampler that runs entirely inside
 * the browser page (no per-frame Playwright round trips). Returns publisher
 * counters, bridge counters, and rAF statistics in one compact result.
 */

import type { Page } from "@playwright/test";

// ── Publisher counters (from Python builtins) ─────────────────────

export interface PublisherCounters {
  updateCalls: number;
  eventChanges: number;
  intervalSkips: number;
  serializationAttempts: number;
  unchangedPayloadSkips: number;
  builtinsWrites: number;
  domWrites: number;
  domWriteFailures: number;
  forcedWrites: number;
  heartbeatWrites: number;
  configuredActiveHz: number;
  lastWriteReason: string | null;
  stateFactoryCalls: number;
  statsSnapshotCalls: number;
  activeTicks: number;
  staticTicks: number;
  stateBuildSkips: number;
  draws: number;
  presentations: number;
  [key: string]: unknown;
}

// ── Bridge counters (from PirateArcadeGameState.getMeta()) ────────

export interface BridgeMeta {
  source: string | null;
  lastUpdatedAt: number | null;
  parseErrorCount: number;
  stale: boolean;
  observerType: string;
  observerConnected: boolean;
  bfcacheRestores: number;
  mutationCount: number;
  pollCycles: number;
  rawReadCount: number;
  unchangedRawSkips: number;
  parseCount: number;
  subscriberNotificationCount: number;
  [key: string]: unknown;
}

// ── Counter deltas ────────────────────────────────────────────────

export interface CounterDeltas {
  [key: string]: unknown;
}

// ── Health sample result ──────────────────────────────────────────

export interface HealthSampleResult {
  rAFIntervals: number[];
  rAFIntervalCount: number;
  rAFIntervalMin: number | null;
  rAFIntervalMax: number | null;
  rAFIntervalP50: number | null;
  rAFIntervalP95: number | null;
  intervalsOver50ms: number;
  mutationCountDelta: number;
  publisherBefore: PublisherCounters | null;
  publisherAfter: PublisherCounters | null;
  publisherDelta: CounterDeltas | null;
  bridgeBefore: BridgeMeta | null;
  bridgeAfter: BridgeMeta | null;
  bridgeDelta: CounterDeltas | null;
}

// ── In-page sampler ───────────────────────────────────────────────

/**
 * Run a health sample entirely inside the browser page.
 *
 * Starts one requestAnimationFrame loop that records rAF intervals.
 * Captures publisher and bridge counters before and after the sample.
 * Returns a compact result object with no per-frame Playwright crossings.
 *
 * @param page - Playwright page
 * @param sampleMs - duration of the sample in milliseconds
 */
export async function runInPageSample(
  page: Page,
  sampleMs: number,
): Promise<HealthSampleResult> {
  const result = (await page.evaluate(async (ms: number) => {
    const startTime = performance.now();
    const endTime = startTime + ms;
    const rAFIntervals: number[] = [];
    let lastRAFTime: number | null = null;

    const gs = (window as any).PirateArcadeGameState;
    const getPubStats =
      gs && typeof gs.getPublisherStats === "function"
        ? () => gs.getPublisherStats()
        : () => null;
    const getMeta =
      gs && typeof gs.getMeta === "function" ? () => gs.getMeta() : () => null;

    const pubBefore = getPubStats();
    const bridgeBefore = getMeta();
    const mutationCountStart =
      bridgeBefore && typeof bridgeBefore.mutationCount === "number"
        ? bridgeBefore.mutationCount
        : 0;

    return new Promise((resolve) => {
      function frame() {
        const now = performance.now();
        if (lastRAFTime !== null) {
          rAFIntervals.push(now - lastRAFTime);
        }
        lastRAFTime = now;

        if (now >= endTime) {
          const pubAfter = getPubStats();
          const bridgeAfter = getMeta();
          const mutationCountEnd =
            bridgeAfter && typeof bridgeAfter.mutationCount === "number"
              ? bridgeAfter.mutationCount
              : 0;

          const sorted = [...rAFIntervals].sort((a, b) => a - b);
          const len = sorted.length;
          const computeDelta = (
            after: Record<string, unknown> | null,
            before: Record<string, unknown> | null,
          ) => {
            if (!after || !before) return null;
            const delta: Record<string, unknown> = {};
            for (const key of Object.keys(after)) {
              if (
                typeof after[key] === "number" &&
                typeof before[key] === "number"
              ) {
                delta[key] = (after[key] as number) - (before[key] as number);
              } else {
                delta[key] = after[key];
              }
            }
            return delta;
          };

          resolve({
            rAFIntervals,
            rAFIntervalCount: len,
            rAFIntervalMin: len > 0 ? Math.round(sorted[0]) : null,
            rAFIntervalMax: len > 0 ? Math.round(sorted[len - 1]) : null,
            rAFIntervalP50:
              len > 0 ? Math.round(sorted[Math.floor(len / 2)]) : null,
            rAFIntervalP95:
              len > 0 ? Math.round(sorted[Math.floor(len * 0.95)]) : null,
            intervalsOver50ms: rAFIntervals.filter((i) => i > 50).length,
            mutationCountDelta: mutationCountEnd - mutationCountStart,
            publisherBefore: pubBefore,
            publisherAfter: pubAfter,
            publisherDelta: computeDelta(pubAfter, pubBefore),
            bridgeBefore: bridgeBefore,
            bridgeAfter: bridgeAfter,
            bridgeDelta: computeDelta(bridgeAfter, bridgeBefore),
          });
          return;
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }, sampleMs)) as HealthSampleResult;

  return result;
}
