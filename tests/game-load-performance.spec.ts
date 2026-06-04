import { test, expect } from "@playwright/test";

type BootMetrics = Record<string, number>;

const GAMES = [
  { name: "Cannonball Clash", path: "/play/cannonball-clash/" },
  { name: "Treasure Cove", path: "/play/treasure-cove/" },
];

test.describe("Game Loading Performance", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    try {
      await page.evaluate(() => {
        try {
          localStorage.clear();
        } catch (e) {}
        try {
          sessionStorage.clear();
        } catch (e) {}
      });
    } catch (e) {
      // Ignore storage clearing errors
    }
  });

  for (const game of GAMES) {
    test(`should load ${game.name} within reasonable time`, async ({
      page,
    }, testInfo) => {
      const response = await page.goto(game.path);
      expect(response?.ok()).toBe(true);
      expect(response?.status()).toBeLessThan(400);

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

      const metrics = await page.evaluate(
        () => (window as any).__paBootMetrics as BootMetrics,
      );

      await testInfo.attach(`boot-metrics-${game.name}`, {
        body: JSON.stringify(metrics, null, 2),
        contentType: "application/json",
      });

      expect(metrics).toHaveProperty("boot-start");
      expect(metrics).toHaveProperty("game-ready");
      expect(metrics).toHaveProperty("loader-hidden");

      const bootStart = metrics["boot-start"];
      const gameReady = metrics["game-ready"];
      const loaderHidden = metrics["loader-hidden"];

      expect(gameReady).toBeGreaterThan(bootStart);
      expect(loaderHidden).toBeGreaterThanOrEqual(gameReady);

      console.log(`${game.name} boot time: ${(gameReady - bootStart) / 1000}s`);
      console.log(
        `${game.name} loader hidden: ${(loaderHidden - bootStart) / 1000}s`,
      );

      const totalLoadTime = loaderHidden - bootStart;
      if (totalLoadTime > 60000) {
        testInfo.annotations.push({
          type: "performance",
          description: `Slow load time detected: ${(totalLoadTime / 1000).toFixed(1)}s`,
        });
      }
    });
  }
});
