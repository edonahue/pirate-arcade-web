// Game loading performance tests
import { test, expect } from "@playwright/test";

// Test configuration
const GAMES = [
  { name: "Cannonball Clash", path: "/play/cannonball-clash/" },
  { name: "Treasure Cove", path: "/play/treasure-cove/" },
  { name: "Kraken's Wake", path: "/play/krakens-wake/" },
];

test.describe("Game Loading Performance", () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage to simulate cold load
    await page.context().clearCookies();
    try {
      await page.evaluate(() => {
        try { localStorage.clear(); } catch (e) {}
        try { sessionStorage.clear(); } catch (e) {}
      });
    } catch (e) {
      // Ignore storage clearing errors
    }
  });

  for (const game of GAMES) {
    test(`should load ${game.name} within reasonable time`, async ({
      page,
    }) => {
      // Navigate to game page
      const response = await page.goto(game.path);
      expect(response).toBeOK();
      expect(response.status()).toBeLessThan(400);

      // Wait for metrics to be available
      await page.waitForFunction(
        () => {
          return window.__paBootMetrics !== undefined;
        },
        { timeout: 60000 },
      ); // 60 second timeout for boot

      // Wait for loading overlay to be removed
      await page.waitForFunction(
        () => {
          const overlay = document.getElementById(
            "pirate-arcade-loading-overlay",
          );
          return !overlay || overlay.style.display === "none";
        },
        { timeout: 60000 },
      );

      // Collect metrics
      const metrics = await page.evaluate(() => {
        return window.__paBootMetrics;
      });

      // Attach metrics to test report
      await test.attach(`boot-metrics-${game.name}`, {
        body: JSON.stringify(metrics, null, 2),
        contentType: "application/json",
      });

      // Basic sanity checks
      expect(metrics).toHaveProperty("boot-start");
      expect(metrics).toHaveProperty("game-ready");
      expect(metrics).toHaveProperty("loader-hidden");

      // Ensure timing makes sense
      const bootStart = metrics["boot-start"];
      const gameReady = metrics["game-ready"];
      const loaderHidden = metrics["loader-hidden"];

      expect(gameReady).toBeGreaterThan(bootStart);
      expect(loaderHidden).toBeGreaterThanOrEqual(gameReady);

      // Log timing for visibility
      console.log(`${game.name} boot time: ${(gameReady - bootStart) / 1000}s`);
      console.log(
        `${game.name} loader hidden: ${(loaderHidden - bootStart) / 1000}s`,
      );

      // Soft assertions for performance (warn but don't fail)
      const totalLoadTime = loaderHidden - bootStart;
      if (totalLoadTime > 60000) {
        // 60 seconds
        test.warn(`Slow load time detected: ${totalLoadTime / 1000}s`);
      }
    });
  }
});
