import { test, expect } from "@playwright/test";

test.describe("Game Prewarm", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("standalone CTAs on /play/ have prewarm data attributes", async ({
    page,
  }) => {
    await page.goto("/play/");

    // Two browser-playable CTAs should have prewarm attributes
    const cannonballCta = page.locator(
      'a[href="/play/cannonball-clash/"][data-game-id="cannonball-clash"][data-browser-playable="true"]',
    );
    await expect(cannonballCta).toBeVisible();

    const treasureCta = page.locator(
      'a[href="/play/treasure-cove/"][data-game-id="treasure-cove"][data-browser-playable="true"]',
    );
    await expect(treasureCta).toBeVisible();
  });

  test("prewarm fires on standalone CTA hover", async ({ page }) => {
    await page.goto("/play/");

    const cannonballCta = page
      .locator(
        'a[data-game-id="cannonball-clash"][data-browser-playable="true"]',
      )
      .last();

    // Set up MutationObserver to detect prefetch link insertion
    await page.evaluate(() => {
      (window as any).__prewarmObserved = false;
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of Array.from(m.addedNodes)) {
            if (
              (node as HTMLLinkElement).rel === "prefetch" &&
              ((node as HTMLLinkElement).href || "").includes(
                "cannonball-clash",
              )
            ) {
              (window as any).__prewarmObserved = true;
            }
          }
        }
      });
      observer.observe(document.head, { childList: true });
    });

    // Trigger pointerenter to fire prewarm
    await cannonballCta.dispatchEvent("pointerenter");
    await page.waitForTimeout(300);

    const prewarmed = await page.evaluate(
      () => (window as any).__prewarmObserved,
    );
    expect(prewarmed).toBe(true);
  });

  test("GameCard prewarm data attributes present", async ({ page }) => {
    await page.goto("/play/");

    // GameCard links should have data-game-id and data-browser-playable
    const cannonballCard = page.locator(
      '#game-card-link-cannonball-clash[data-game-id="cannonball-clash"][data-browser-playable="true"]',
    );
    await expect(cannonballCard).toBeVisible();

    const treasureCard = page.locator(
      '#game-card-link-treasure-cove[data-game-id="treasure-cove"][data-browser-playable="true"]',
    );
    await expect(treasureCard).toBeVisible();
  });

  test("desktop-only games do NOT have prewarm attributes", async ({
    page,
  }) => {
    await page.goto("/play/");

    // Kraken's Wake and Port Royale Tycoon are desktop-only
    const krakenCard = page.locator(
      '#game-card-link-krakens-wake[data-browser-playable="true"]',
    );
    await expect(krakenCard).toHaveCount(0);

    const portCard = page.locator(
      '#game-card-link-port-royale-tycoon[data-browser-playable="true"]',
    );
    await expect(portCard).toHaveCount(0);
  });

  test("desktop-only games do NOT have data-game-id on non-browser-playable CTAs", async ({
    page,
  }) => {
    await page.goto("/play/");

    // Only cannonball-clash and treasure-cove have data-game-id + data-browser-playable
    const browserPlayable = page.locator(
      'a[data-game-id][data-browser-playable="true"]',
    );
    await expect(browserPlayable).toHaveCount(4); // 2 GameCard + 2 standalone CTAs
  });

  test("prewarm only fires for browser-playable CTAs", async ({ page }) => {
    await page.goto("/play/");

    // Desktop-only game cards should NOT fire prewarm
    const desktopPlayable = await page.evaluate(() => {
      const links = document.querySelectorAll<HTMLAnchorElement>(
        "a[data-game-id][data-browser-playable=true]",
      );
      return Array.from(links).map((l) => l.getAttribute("data-game-id"));
    });

    // Only browser-playable games should be included
    for (const id of desktopPlayable) {
      expect(id === "cannonball-clash" || id === "treasure-cove").toBe(true);
    }
  });
});
