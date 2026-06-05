import { test, expect } from "@playwright/test";

test.describe("Site Visual Theme", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Homepage renders main sections", async ({ page }) => {
    await page.goto("/");

    // Check main sections exist
    await expect(page.locator("text=PIRATE ARCADE")).toBeVisible();
    await expect(page.locator("text=Choose Your Adventure")).toBeVisible();
    await expect(page.locator("text=Play in Browser Now")).toBeVisible();
    await expect(page.locator("text=The Experiment")).toBeVisible();

    // Check game cards are visible
    await expect(page.locator("text=Cannonball Clash")).toBeVisible();
    await expect(page.locator("text=Treasure Cove")).toBeVisible();
    await expect(page.locator("text=Kraken's Wake")).toBeVisible();
    await expect(page.locator("text=Port Royale Tycoon")).toBeVisible();

    // Check browser-play CTAs
    await expect(page.locator("text=Play in Browser →")).toHaveCount(2);
  });

  test("Play page shows browser-playable games", async ({ page }) => {
    await page.goto("/play/");

    // Should show the two browser-playable games prominently
    await expect(page.locator("text=Cannonball Clash")).toBeVisible();
    await expect(page.locator("text=Treasure Cove")).toBeVisible();

    // Check for desktop-only labels
    await expect(page.locator("text=Desktop app available")).toHaveCount(2);
  });

  test("Play page prewarm fires on game card interaction", async ({ page }) => {
    await page.goto("/play/");

    // Hover over Cannonball Clash link — prewarm should fire
    const cbLink = page.locator('a[data-game-id="cannonball-clash"]').first();
    await expect(cbLink).toBeVisible();

    // Set up preload link detector
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
    await cbLink.dispatchEvent("pointerenter");
    await page.waitForTimeout(300);

    const prewarmed = await page.evaluate(
      () => (window as any).__prewarmObserved,
    );
    expect(prewarmed).toBe(true);
  });

  test("About page loads", async ({ page }) => {
    await page.goto("/about/");
    await expect(page.locator("text=ABOUT")).toBeVisible();
    await expect(page.locator("text=Made by")).toBeVisible();
  });

  test("Build log page loads", async ({ page }) => {
    await page.goto("/build-log/");
    await expect(page.locator("text=BUILD LOG")).toBeVisible();
  });

  test("No horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const hasOverflow = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      );
    });

    expect(hasOverflow).toBe(false);
  });

  test("Header/nav does not overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const header = page.locator("header");
    const nav = page.locator("nav");

    await expect(header).toBeVisible();
    await expect(nav).toBeVisible();

    const headerBox = await header.boundingBox();
    const navBox = await nav.boundingBox();
    const viewport = page.viewportSize();

    // Viewport should not be null as we set it explicitly, but add safety check for TypeScript
    if (viewport !== null) {
      if (headerBox !== null) {
        expect(headerBox.width).toBeLessThanOrEqual(viewport.width);
      }
      if (navBox !== null) {
        expect(navBox.width).toBeLessThanOrEqual(viewport.width);
      }
    }
  });
});
