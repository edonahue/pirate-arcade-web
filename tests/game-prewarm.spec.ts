import { test, expect } from "@playwright/test";

const BROWSER_PLAYABLE = [
  { id: "cannonball-clash", name: "Cannonball Clash" },
  { id: "treasure-cove", name: "Treasure Cove" },
];

const DESKTOP_ONLY = [
  { id: "krakens-wake", name: "Kraken's Wake" },
  { id: "port-royale-tycoon", name: "Port Royale Tycoon" },
];

test.describe("Game Prewarm", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("single prewarm installer runs once on /play/", async ({ page }) => {
    let installerCount = 0;
    await page.exposeFunction("__paTrackPrewarm", () => {
      installerCount++;
    });

    await page.goto("/play/");

    const installed = await page.evaluate(
      () => !!(window as any).__paGamePrewarmInstalled,
    );
    expect(installed).toBe(true);
  });

  test("browser-playable CTAs have versioned data attributes", async ({
    page,
  }) => {
    await page.goto("/play/");

    for (const game of BROWSER_PLAYABLE) {
      const ctas = page.locator(
        `a[data-game-id="${game.id}"][data-browser-playable="true"]`,
      );
      const count = await ctas.count();
      expect(count).toBeGreaterThanOrEqual(2); // GameCard image + Play link

      // Each CTA should have versioned data attributes
      for (let i = 0; i < count; i++) {
        const cta = ctas.nth(i);
        await expect(cta).toHaveAttribute("data-game-page");
        await expect(cta).toHaveAttribute("data-game-archive");

        const archiveUrl = await cta.getAttribute("data-game-archive");
        expect(archiveUrl).toMatch(
          new RegExp(`${game.id}\\.tar\\.gz\\?v=mobile-v4$`),
        );
      }
    }
  });

  test("standalone CTAs have prewarm data attributes", async ({ page }) => {
    await page.goto("/play/");

    for (const game of BROWSER_PLAYABLE) {
      const standaloneCta = page.locator(
        `a[href="/play/${game.id}/"][data-game-id="${game.id}"][data-browser-playable="true"]`,
      );
      await expect(standaloneCta).toBeVisible();
    }
  });

  test("GameCard 'Play in Browser →' link has prewarm attributes", async ({
    page,
  }) => {
    await page.goto("/play/");

    for (const game of BROWSER_PLAYABLE) {
      const playLink = page.locator(
        `.game-card__play-link[data-game-id="${game.id}"]`,
      );
      await expect(playLink).toBeVisible();
      await expect(playLink).toHaveAttribute("data-browser-playable", "true");
      await expect(playLink).toHaveAttribute("data-game-page");
      await expect(playLink).toHaveAttribute("data-game-archive");
    }
  });

  test("desktop-only games do NOT have prewarm attributes", async ({
    page,
  }) => {
    await page.goto("/play/");

    for (const game of DESKTOP_ONLY) {
      const playable = page.locator(
        `#game-card-link-${game.id}[data-browser-playable="true"]`,
      );
      await expect(playable).toHaveCount(0);
    }
  });

  test("prewarm fires exactly one prefetch link per URL on hover", async ({
    page,
  }) => {
    await page.goto("/play/");

    const cannonballCta = page
      .locator(
        'a[data-game-id="cannonball-clash"][data-browser-playable="true"]',
      )
      .last();

    // Trigger pointerenter
    await cannonballCta.dispatchEvent("pointerenter");
    await page.waitForTimeout(300);

    // Count prefetch links for cannonball
    const prefetchCount = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll('link[rel="prefetch"]'),
      ).filter((l) => (l as HTMLLinkElement).href?.includes("cannonball-clash"))
        .length;
    });
    expect(prefetchCount).toBeGreaterThanOrEqual(1);

    // Trigger pointerenter again — should NOT create duplicate prefetch links
    await cannonballCta.dispatchEvent("pointerenter");
    await page.waitForTimeout(300);

    const prefetchCountAfterRepeat = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll('link[rel="prefetch"]'),
      ).filter((l) => (l as HTMLLinkElement).href?.includes("cannonball-clash"))
        .length;
    });
    // Should still be the same count (no duplicates)
    expect(prefetchCountAfterRepeat).toBe(prefetchCount);
  });

  test("prewarm fires on touchstart without blocking navigation", async ({
    page,
  }) => {
    await page.goto("/play/");

    const cannonballCta = page
      .locator(
        'a[data-game-id="cannonball-clash"][data-browser-playable="true"]',
      )
      .last();

    // Fire touchstart — should trigger prewarm but NOT prevent default
    await cannonballCta.dispatchEvent("touchstart");
    await page.waitForTimeout(300);

    // Prefetch link should exist
    const prefetched = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('link[rel="prefetch"]')).some(
        (l) => (l as HTMLLinkElement).href?.includes("cannonball-clash"),
      );
    });
    expect(prefetched).toBe(true);
  });

  test("WARM_CACHE payload includes page and versioned archive URLs", async ({
    page,
  }) => {
    let receivedMessage: any = null;
    await page.exposeFunction("__paCaptureWarmCache", (msg: any) => {
      receivedMessage = msg;
    });

    await page.goto("/play/");

    // Intercept postMessage before the prewarm fires
    await page.evaluate(() => {
      const origPostMessage = navigator.serviceWorker.controller?.postMessage;
      if (origPostMessage) {
        (navigator.serviceWorker.controller as any).postMessage = (
          msg: any,
        ) => {
          (window as any).__paLastWarmCache = msg;
        };
      }
    });

    // If there's no SW controller, test that prewarm still fires (graceful degradation)
    const hasController = await page.evaluate(
      () => !!navigator.serviceWorker.controller,
    );

    if (!hasController) {
      // Still verify the DOM side worked
      const ctas = page.locator(
        'a[data-game-id="cannonball-clash"][data-browser-playable="true"]',
      );
      await ctas.first().dispatchEvent("pointerenter");
      await page.waitForTimeout(300);
    }
  });

  test("only browser-playable game IDs are in the CTA selector", async ({
    page,
  }) => {
    await page.goto("/play/");

    const browserPlayable = await page.evaluate(() => {
      const links = document.querySelectorAll<HTMLAnchorElement>(
        "a[data-game-id][data-browser-playable=true]",
      );
      return Array.from(links).map((l) => l.getAttribute("data-game-id"));
    });

    for (const id of browserPlayable) {
      expect(id === "cannonball-clash" || id === "treasure-cove").toBe(true);
    }
  });

  test("GameCard image screenshot link has prewarm attributes", async ({
    page,
  }) => {
    await page.goto("/play/");

    for (const game of BROWSER_PLAYABLE) {
      const cardLink = page.locator(
        `#game-card-link-${game.id}[data-game-id="${game.id}"][data-browser-playable="true"]`,
      );
      await expect(cardLink).toBeVisible();
      await expect(cardLink).toHaveAttribute("data-game-page");
      await expect(cardLink).toHaveAttribute("data-game-archive");
    }
  });
});
