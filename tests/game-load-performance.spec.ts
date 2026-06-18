import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface GameEntry {
  id: string;
  name: string;
  path: string;
}

function loadPybagGames(): GameEntry[] {
  const gamesPath = resolve(__dirname, "../src/data/games.json");
  const games = JSON.parse(readFileSync(gamesPath, "utf-8"));
  return games
    .filter(
      (g: any) => g.engine === "pygbag" && g.status === "browser-playable",
    )
    .map((g: any) => ({ id: g.id, name: g.title, path: g.browserUrl }));
}

const GAMES = loadPybagGames();

interface PerfSnapshot {
  schemaVersion: number;
  marks: Record<string, number | undefined>;
  durations: Record<string, number | undefined>;
  flags: { activePlay: boolean; firstUserInput: boolean };
  context: { url: string; serviceWorkerControlled: boolean };
}

interface ResourceEntry {
  name: string;
  duration: number;
  initiatorType: string;
  transferSize: number;
  encodedBodySize: number;
}

interface TypeSummary {
  count: number;
  totalDuration: number;
  totalSize: number;
}

interface PerfReport {
  game: string;
  label: string;
  classification: string;
  snapshot: PerfSnapshot | null;
  resources: {
    entries: ResourceEntry[];
    byType: Record<string, TypeSummary>;
    duplicateArchives: string[];
  };
  playable: boolean;
}

async function collectSnapshot(page: any): Promise<PerfSnapshot | null> {
  return page.evaluate(() => {
    const pm = (window as any).PirateArcadeMetrics;
    if (!pm || typeof pm.snapshot !== "function") return null;
    return pm.snapshot();
  });
}

async function collectResources(page: any): Promise<ResourceEntry[]> {
  return page.evaluate(() => {
    return performance.getEntriesByType("resource").map((e: any) => ({
      name: e.name,
      duration: e.duration,
      initiatorType: e.initiatorType,
      transferSize: e.transferSize,
      encodedBodySize: e.encodedBodySize,
    }));
  });
}

function detectDuplicateArchives(resources: ResourceEntry[]): string[] {
  const archiveUrls = resources
    .filter((r) => r.name.includes(".tar.gz"))
    .map((r) => r.name.split("?")[0]);
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const url of archiveUrls) {
    if (seen.has(url)) dupes.push(url);
    seen.add(url);
  }
  return dupes;
}

function classifyResources(
  entries: ResourceEntry[],
): Record<string, TypeSummary> {
  const byType: Record<string, TypeSummary> = {};
  for (const e of entries) {
    let type = "other";
    if (e.name.includes(".wasm")) type = "wasm";
    else if (e.name.includes(".tar.gz")) type = "archive";
    else if (e.name.endsWith(".js") || e.initiatorType === "script")
      type = "script";
    else if (e.name.endsWith(".css") || e.initiatorType === "link")
      type = "stylesheet";
    if (!byType[type])
      byType[type] = { count: 0, totalDuration: 0, totalSize: 0 };
    byType[type].count++;
    byType[type].totalDuration += e.duration;
    byType[type].totalSize += e.transferSize;
  }
  return byType;
}

function classifyLoadType(navType: string, swControlled: boolean): string {
  if (navType === "reload" || navType === "back_forward") {
    return swControlled
      ? "service-worker-controlled-reload"
      : "browser-cache-reload";
  }
  return swControlled ? "service-worker-controlled-navigate" : "fresh-context";
}

async function performPrimary(page: any): Promise<boolean> {
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
): Promise<boolean> {
  try {
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
    return true;
  } catch {
    return false;
  }
}

async function waitForLoaderHidden(
  page: any,
  timeoutMs: number,
): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        const overlay = document.getElementById("game-loading");
        return !overlay || overlay.classList.contains("hidden");
      },
      { timeout: timeoutMs },
    );
    return true;
  } catch {
    return false;
  }
}

function logReport(
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
      duplicateArchives: report.resources.duplicateArchives,
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
    test("cold load — truthy playable-readiness telemetry", async ({
      page,
    }, testInfo) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      const loaderHidden = await waitForLoaderHidden(page, 120000);
      expect(loaderHidden).toBe(true);

      const started = await performPrimary(page);
      expect(started).toBe(true);

      const activePlayReached = await waitForMilestone(
        page,
        "active-play",
        30000,
      );

      await waitForMilestone(page, "first-user-input", 5000);

      const snapshot = await collectSnapshot(page);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.schemaVersion).toBe(1);
      expect(snapshot!.flags.activePlay).toBe(true);
      expect(activePlayReached).toBe(true);

      const resources = await collectResources(page);

      const navEntry = await page.evaluate(() => {
        const entries = performance.getEntriesByType("navigation");
        return entries.length > 0 ? (entries[0] as any).type : "unknown";
      });
      const swControlled = snapshot!.context.serviceWorkerControlled;
      const classification = classifyLoadType(navEntry, swControlled);

      const dupes = detectDuplicateArchives(resources);

      const resourceByType = classifyResources(resources);
      const report: PerfReport = {
        game: game.id,
        label: "cold",
        classification,
        snapshot,
        resources: {
          entries: resources,
          byType: resourceByType,
          duplicateArchives: dupes,
        },
        playable: snapshot!.flags.activePlay,
      };

      logReport(testInfo, game.id, "cold", report);

      expect(report.resources.duplicateArchives).toHaveLength(0);

      const hasError = await page.evaluate(() => {
        const loading = document.getElementById("game-loading");
        return loading ? loading.classList.contains("game-error") : false;
      });
      expect(hasError).toBe(false);

      const canvasSized = await page.evaluate(() => {
        const c = document.getElementById("canvas");
        return c
          ? (c as HTMLCanvasElement).width > 100 &&
              (c as HTMLCanvasElement).height > 100
          : false;
      });
      expect(canvasSized).toBe(true);
    });

    test("warm reload — service-worker-cached metrics", async ({
      page,
    }, testInfo) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await waitForLoaderHidden(page, 120000);

      await page.reload({ waitUntil: "domcontentloaded" });

      const loaderHidden = await waitForLoaderHidden(page, 120000);
      expect(loaderHidden).toBe(true);

      const started = await performPrimary(page);
      expect(started).toBe(true);

      const activePlayReached = await waitForMilestone(
        page,
        "active-play",
        30000,
      );

      const snapshot = await collectSnapshot(page);
      expect(snapshot).not.toBeNull();

      const resources = await collectResources(page);

      const navEntry = await page.evaluate(() => {
        const entries = performance.getEntriesByType("navigation");
        return entries.length > 0 ? (entries[0] as any).type : "unknown";
      });
      const swControlled = snapshot!.context.serviceWorkerControlled;
      const classification = classifyLoadType(navEntry, swControlled);

      const dupes = detectDuplicateArchives(resources);
      const resourceByType = classifyResources(resources);

      const report: PerfReport = {
        game: game.id,
        label: "warm",
        classification,
        snapshot,
        resources: {
          entries: resources,
          byType: resourceByType,
          duplicateArchives: dupes,
        },
        playable: activePlayReached,
      };

      logReport(testInfo, game.id, "warm", report);

      expect(report.resources.duplicateArchives).toHaveLength(0);

      const hasError = await page.evaluate(() => {
        const loading = document.getElementById("game-loading");
        return loading ? loading.classList.contains("game-error") : false;
      });
      expect(hasError).toBe(false);

      if (swControlled) {
        const archiveSize = resourceByType["archive"]?.totalSize || 0;
        console.log(
          `${game.id} warm archive total transfer: ${archiveSize} bytes (0 = from cache)`,
        );
      }
    });
  });
}
