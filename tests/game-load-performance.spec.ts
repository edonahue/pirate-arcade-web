import { test, expect } from "@playwright/test";

test.describe("Game Load Performance", () => {
  test("should load Cannonball Clash with proper metrics", async ({ page }) => {
    await page.goto("/play/cannonball-clash/");
    await page.waitForFunction(
      () => {
        const m = (window as any).__paBootMetrics;
        return m !== undefined && m["game-ready"] !== undefined;
      },
      { timeout: 120000 },
    );

    await page.waitForFunction(
      () => {
        const overlay = document.getElementById("game-loading");
        return !overlay || overlay.classList.contains("hidden");
      },
      { timeout: 120000 },
    );

    const metrics = await page.evaluate(() => (window as any).__paBootMetrics);

    // Check that all expected metrics are present
    expect(metrics).toHaveProperty("page-script-start");
    expect(metrics).toHaveProperty("pythons-js-requested");
    expect(metrics).toHaveProperty("python-ready");
    expect(metrics).toHaveProperty("boot-start");
    expect(metrics).toHaveProperty("pygame-install-start");
    expect(metrics).toHaveProperty("pygame-install-end");
    expect(metrics).toHaveProperty("archive-fetch-start");
    expect(metrics).toHaveProperty("archive-fetch-end");
    expect(metrics).toHaveProperty("archive-extract-start");
    expect(metrics).toHaveProperty("archive-extract-end");
    expect(metrics).toHaveProperty("display-init-start");
    expect(metrics).toHaveProperty("display-init-end");
    expect(metrics).toHaveProperty("input-bridge-installed");
    expect(metrics).toHaveProperty("game-ready");
    expect(metrics).toHaveProperty("loader-hidden");

    // Compute derived metrics
    const totalPageToPythonReady =
      metrics["python-ready"] - metrics["page-script-start"];
    const totalBootToGameReady = metrics["game-ready"] - metrics["boot-start"];
    const pygameInstallDuration =
      metrics["pygame-install-end"] - metrics["pygame-install-start"];
    const archiveFetchDuration =
      metrics["archive-fetch-end"] - metrics["archive-fetch-start"];
    const archiveExtractDuration =
      metrics["archive-extract-end"] - metrics["archive-extract-start"];
    const displayInitDuration =
      metrics["display-init-end"] - metrics["display-init-start"];
    const readyToLoaderHidden =
      metrics["loader-hidden"] - metrics["game-ready"];

    // Log metrics for review
    console.log("Cannonball Clash Metrics:", {
      "Total page to Python ready (ms)": totalPageToPythonReady,
      "Total boot to game ready (ms)": totalBootToGameReady,
      "Pygame install duration (ms)": pygameInstallDuration,
      "Archive fetch duration (ms)": archiveFetchDuration,
      "Archive extract duration (ms)": archiveExtractDuration,
      "Display init duration (ms)": displayInitDuration,
      "Ready to loader hidden (ms)": readyToLoaderHidden,
    });

    // Attach metrics as JSON for CI
    await page.evaluate(() => {
      window.lastTestMetrics = {
        game: "cannonball-clash",
        metrics: window.PirateArcadeMetrics
          ? window.PirateArcadeMetrics.getAll()
          : {},
      };
    });

    // Attach network summary (using only valid PerformanceEntry properties)
    await page.evaluate(() => {
      window.lastTestNetworkSummary = window.performance
        .getEntriesByType("resource")
        .map((entry) => ({
          name: entry.name,
          entryType: entry.entryType,
          initiatorType: (entry.initiatorType as string) || "",
          duration: entry.duration,
          startTime: entry.startTime,
        }));
    });

    // Basic sanity checks - these should be fast after warm load
    // Note: We don't fail on strict thresholds yet, just log warnings
    if (totalPageToPythonReady > 30000) {
      console.warn(
        `⚠️  Slow total page to Python ready: ${totalPageToPythonReady}ms`,
      );
    }
    if (pygameInstallDuration > 15000) {
      console.warn(`⚠️  Slow pygame install: ${pygameInstallDuration}ms`);
    }

    // Check for critical errors
    const hasRuntimeError = await page.evaluate(() => {
      return (
        !!window.PirateArcadeLoading &&
        document
          .getElementById("game-loading")
          ?.classList.contains("game-error")
      );
    });
    expect(hasRuntimeError).toBe(false);
  });

  test("should load Treasure Cove with proper metrics", async ({ page }) => {
    await page.goto("/play/treasure-cove/");
    await page.waitForFunction(
      () => {
        const m = (window as any).__paBootMetrics;
        return m !== undefined && m["game-ready"] !== undefined;
      },
      { timeout: 120000 },
    );

    await page.waitForFunction(
      () => {
        const overlay = document.getElementById("game-loading");
        return !overlay || overlay.classList.contains("hidden");
      },
      { timeout: 120000 },
    );

    const metrics = await page.evaluate(() => (window as any).__paBootMetrics);

    // Check that all expected metrics are present
    expect(metrics).toHaveProperty("page-script-start");
    expect(metrics).toHaveProperty("pythons-js-requested");
    expect(metrics).toHaveProperty("python-ready");
    expect(metrics).toHaveProperty("boot-start");
    expect(metrics).toHaveProperty("pygame-install-start");
    expect(metrics).toHaveProperty("pygame-install-end");
    expect(metrics).toHaveProperty("archive-fetch-start");
    expect(metrics).toHaveProperty("archive-fetch-end");
    expect(metrics).toHaveProperty("archive-extract-start");
    expect(metrics).toHaveProperty("archive-extract-end");
    expect(metrics).toHaveProperty("display-init-start");
    expect(metrics).toHaveProperty("display-init-end");
    expect(metrics).toHaveProperty("input-bridge-installed");
    expect(metrics).toHaveProperty("game-ready");
    expect(metrics).toHaveProperty("loader-hidden");

    // Compute derived metrics
    const totalPageToPythonReady =
      metrics["python-ready"] - metrics["page-script-start"];
    const totalBootToGameReady = metrics["game-ready"] - metrics["boot-start"];
    const pygameInstallDuration =
      metrics["pygame-install-end"] - metrics["pygame-install-start"];
    const archiveFetchDuration =
      metrics["archive-fetch-end"] - metrics["archive-fetch-start"];
    const archiveExtractDuration =
      metrics["archive-extract-end"] - metrics["archive-extract-start"];
    const displayInitDuration =
      metrics["display-init-end"] - metrics["display-init-start"];
    const readyToLoaderHidden =
      metrics["loader-hidden"] - metrics["game-ready"];

    // Log metrics for review
    console.log("Treasure Cove Metrics:", {
      "Total page to Python ready (ms)": totalPageToPythonReady,
      "Total boot to game ready (ms)": totalBootToGameReady,
      "Pygame install duration (ms)": pygameInstallDuration,
      "Archive fetch duration (ms)": archiveFetchDuration,
      "Archive extract duration (ms)": archiveExtractDuration,
      "Display init duration (ms)": displayInitDuration,
      "Ready to loader hidden (ms)": readyToLoaderHidden,
    });

    // Attach metrics as JSON for CI
    await page.evaluate(() => {
      window.lastTestMetrics = {
        game: "treasure-cove",
        metrics: window.PirateArcadeMetrics
          ? window.PirateArcadeMetrics.getAll()
          : {},
      };
    });

    // Attach network summary (using only valid PerformanceEntry properties)
    await page.evaluate(() => {
      window.lastTestNetworkSummary = window.performance
        .getEntriesByType("resource")
        .map((entry) => ({
          name: entry.name,
          entryType: entry.entryType,
          initiatorType: (entry.initiatorType as string) || "",
          duration: entry.duration,
          startTime: entry.startTime,
        }));
    });

    // Basic sanity checks
    if (totalPageToPythonReady > 30000) {
      console.warn(
        `⚠️  Slow total page to Python ready: ${totalPageToPythonReady}ms`,
      );
    }
    if (pygameInstallDuration > 15000) {
      console.warn(`⚠️  Slow pygame install: ${pygameInstallDuration}ms`);
    }

    // Check for critical errors
    const hasRuntimeError = await page.evaluate(() => {
      return (
        !!window.PirateArcadeLoading &&
        document
          .getElementById("game-loading")
          ?.classList.contains("game-error")
      );
    });
    expect(hasRuntimeError).toBe(false);
  });
});
