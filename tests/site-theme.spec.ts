import { test, expect } from "@playwright/test";

test.describe("Site Visual Theme", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Homepage renders main sections", async ({ page }) => {
    await page.goto("/");

    // Check main sections exist
    await expect(page.locator("h1.hero__title")).toContainText("PIRATE ARCADE");
    await expect(page.locator("h2.section__title").first()).toContainText(
      "Choose Your Adventure",
    );
    await expect(page.locator("h2.section__title").nth(1)).toContainText(
      "Play in Browser Now",
    );
    await expect(page.locator("h2.section__title").nth(2)).toContainText(
      "Free AI, Local Hardware, Open Source",
    );

    // Check game cards are visible
    await expect(
      page.locator('article:has-text("Cannonball Clash") h3 a'),
    ).toBeVisible();
    await expect(
      page.locator('article:has-text("Treasure Cove") h3 a'),
    ).toBeVisible();
    await expect(
      page.locator('article:has-text("Kraken\'s Wake") h3 a'),
    ).toBeVisible();
    await expect(
      page.locator('article:has-text("Port Royale Tycoon") h3 a'),
    ).toBeVisible();

    // Check browser-play CTAs — all three browser-playable games
    await expect(page.locator("text=Play in Browser →")).toHaveCount(3);
  });

  test("Play page shows browser-playable games", async ({ page }) => {
    await page.goto("/play/");

    // Should show the two browser-playable games prominently - use game card titles
    await expect(
      page.locator('article:has-text("Cannonball Clash") h3 a'),
    ).toBeVisible();
    await expect(
      page.locator('article:has-text("Treasure Cove") h3 a'),
    ).toBeVisible();

    // Check for desktop-only labels — only Port Royale Tycoon is desktop-only
    await expect(page.locator("text=Desktop app available")).toHaveCount(1);
  });

  test("Play page prewarm fires on game card interaction", async ({ page }) => {
    await page.goto("/play/");

    // Hover over Cannonball Clash link — prewarm should fire
    const cbLink = page.locator('a[data-game-id="cannonball-clash"]').first();
    await expect(cbLink).toBeVisible();

    // Trigger pointerenter to fire prewarm
    await cbLink.dispatchEvent("pointerenter");
    await page.waitForTimeout(500);

    // Check that prewarm state was set
    const prewarmed = await page.evaluate(() => {
      const state = (window as any).__paGamePrewarmInstalled;
      return state !== undefined;
    });
    expect(prewarmed).toBe(true);
  });

  test("About page loads", async ({ page }) => {
    await page.goto("/about/");
    await expect(page.locator("h1.section__title")).toContainText(
      "The Project",
    );
    await expect(page.locator("h2.section__title")).toContainText("Made by");
  });

  test("Build log page loads", async ({ page }) => {
    await page.goto("/build-log/");
    await expect(page.locator("h1.section__title")).toContainText("Build Log");
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
