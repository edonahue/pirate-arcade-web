/**
 * Performance report types and pure helpers for game load telemetry.
 * All functions are synchronous and testable without a browser.
 */

// ── Types ─────────────────────────────────────────────────────

export interface PerfSnapshot {
  schemaVersion: number;
  marks: Record<string, number | undefined>;
  durations: Record<string, number | undefined>;
  flags: { activePlay: boolean; firstUserInput: boolean };
  context: { url: string; serviceWorkerControlled: boolean };
}

export interface ResourceEntry {
  name: string;
  duration: number;
  initiatorType: string;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  nextHopProtocol: string;
}

export interface ResourceSummary {
  count: number;
  totalDuration: number;
  totalTransferSize: number;
  totalEncodedSize: number;
  totalDecodedSize: number;
}

export interface ArchiveRequestEvidence {
  url: string;
  status: number | null;
  wasObserved: boolean;
  resourceTimingCount: number;
  redirectCount: number;
}

export type DuplicateStatus = "true" | "false" | "unknown";

export type LoadClassification =
  | "fresh-context"
  | "service-worker-controlled-navigation"
  | "service-worker-controlled-reload"
  | "reload-uncontrolled"
  | "unknown";

export type TransferClassification =
  | "positive-transfer"
  | "zero-transfer-cache-compatible"
  | "size-unavailable"
  | "cross-origin-restricted"
  | "service-worker-response";

export interface NetworkSummary {
  requests: ArchiveRequestEvidence[];
  duplicateStatus: DuplicateStatus;
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

export interface RuntimeDiagnostics {
  schemaVersion: number;
  url: string;
  project: string;
  navigation: {
    type: string;
    serviceWorkerAtStart: boolean | null;
    serviceWorkerAtEnd: boolean | null;
  };
  runtime: {
    loadingState: string;
    gameState: Record<string, unknown> | null;
    gameStateMeta: Record<string, unknown> | null;
    metrics: PerfSnapshot | null;
  };
  network: {
    failedRequestCount: number;
    archiveRequestCount: number;
    redirectCounts?: Record<string, number>;
  };
  errors: {
    pageErrorCount: number;
    consoleErrorCount: number;
    consoleWarningCount: number;
  };
  observations?: RequestObservation[];
}

export interface PerfReport {
  game: string;
  label: string;
  classification: LoadClassification;
  snapshot: PerfSnapshot | null;
  resources: {
    entries: ResourceEntry[];
    byType: Record<string, ResourceSummary>;
  };
  network: NetworkSummary;
  playable: boolean;
}

// ── Resource classification ───────────────────────────────────

export function classifyResourceType(
  url: string,
  initiatorType: string,
): string {
  if (url.includes(".wasm")) return "wasm";
  if (url.includes(".tar.gz")) return "archive";
  if (url.endsWith(".js") || initiatorType === "script") return "script";
  if (
    url.endsWith(".css") ||
    initiatorType === "link" ||
    initiatorType === "css"
  )
    return "stylesheet";
  return "other";
}

export function summarizeResources(
  entries: ResourceEntry[],
): Record<string, ResourceSummary> {
  const byType: Record<string, ResourceSummary> = {};
  for (const e of entries) {
    const type = classifyResourceType(e.name, e.initiatorType);
    if (!byType[type]) {
      byType[type] = {
        count: 0,
        totalDuration: 0,
        totalTransferSize: 0,
        totalEncodedSize: 0,
        totalDecodedSize: 0,
      };
    }
    byType[type].count++;
    byType[type].totalDuration += e.duration;
    byType[type].totalTransferSize += e.transferSize >= 0 ? e.transferSize : 0;
    byType[type].totalEncodedSize +=
      e.encodedBodySize >= 0 ? e.encodedBodySize : 0;
    byType[type].totalDecodedSize +=
      e.decodedBodySize >= 0 ? e.decodedBodySize : 0;
  }
  return byType;
}

// ── Load classification ───────────────────────────────────────

export function classifyLoadType(
  navType: string,
  swControlled: boolean,
): LoadClassification {
  if (navType === "reload" || navType === "back_forward") {
    return swControlled
      ? "service-worker-controlled-reload"
      : "reload-uncontrolled";
  }
  return swControlled
    ? "service-worker-controlled-navigation"
    : "fresh-context";
}

// ── Transfer size interpretation ──────────────────────────────

export function classifyTransferSize(
  entry: ResourceEntry,
): TransferClassification {
  if (
    entry.nextHopProtocol === "h2" ||
    entry.nextHopProtocol.startsWith("http/")
  ) {
    if (entry.transferSize > 0) return "positive-transfer";
    if (entry.transferSize === 0) return "zero-transfer-cache-compatible";
    return "size-unavailable";
  }
  if (entry.transferSize < 0) return "cross-origin-restricted";
  if (entry.transferSize >= 0)
    return entry.transferSize > 0
      ? "positive-transfer"
      : "zero-transfer-cache-compatible";
  return "size-unavailable";
}

// ── Duplicate archive detection (conservative) ────────────────

export function detectDuplicateArchives(
  entries: ResourceEntry[],
): DuplicateStatus {
  // Use exact URLs (including version query) — do not strip
  const archiveUrls = entries
    .filter((r) => r.name.includes(".tar.gz"))
    .map((r) => r.name);

  if (archiveUrls.length <= 1) return "false";

  // More than one Resource Timing entry does not automatically mean
  // a duplicate network download — preload + fetch is one download.
  // Without request-level evidence, report "unknown".
  return "unknown";
}

// ── Archive request evidence from both sources ────────────────

export function buildArchiveEvidence(
  resourceEntries: ResourceEntry[],
  observedRequests: RequestObservation[],
  redirectSummaries: Array<{ url: string; redirectCount: number }>,
): NetworkSummary {
  const archiveTimings = resourceEntries.filter((r) =>
    r.name.includes(".tar.gz"),
  );
  const byUrl = new Map<string, ArchiveRequestEvidence>();

  for (const entry of archiveTimings) {
    const existing = byUrl.get(entry.name) || {
      url: entry.name,
      status: null,
      wasObserved: false,
      resourceTimingCount: 0,
      redirectCount: 0,
    };
    existing.resourceTimingCount++;
    byUrl.set(entry.name, existing);
  }

  for (const obs of observedRequests) {
    if (!obs.requestUrl.includes(".tar.gz")) continue;
    const existing = byUrl.get(obs.requestUrl) || {
      url: obs.requestUrl,
      status: null,
      wasObserved: true,
      resourceTimingCount: 0,
      redirectCount: 0,
    };
    existing.status = obs.responseStatus;
    existing.wasObserved = true;
    byUrl.set(obs.requestUrl, existing);
  }

  for (const redir of redirectSummaries) {
    const existing = byUrl.get(redir.url);
    if (existing) existing.redirectCount = redir.redirectCount;
  }

  const requests = Array.from(byUrl.values());

  // Conservative duplicate: check observations for multiple successful
  // non-redirect network responses for same exact versioned URL
  const archiveObservations = observedRequests.filter(
    (o) =>
      o.requestUrl.includes(".tar.gz") &&
      o.responseStatus !== null &&
      o.responseStatus < 400 &&
      o.redirectChain.length === 0,
  );
  const seen = new Set<string>();
  let hasDuplicate = false;
  for (const o of archiveObservations) {
    if (seen.has(o.requestUrl)) {
      hasDuplicate = true;
      break;
    }
    seen.add(o.requestUrl);
  }

  const duplicateStatus: DuplicateStatus = hasDuplicate
    ? "true"
    : requests.length > 0 && archiveObservations.length > 0
      ? "false"
      : "unknown";

  return { requests, duplicateStatus };
}

// ── Canonical URL (strip query for display, not for identity) ─

export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url.split("?")[0];
  }
}
