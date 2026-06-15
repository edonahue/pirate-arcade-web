import { test, expect } from "@playwright/test";

test.describe("Site Visual Theme", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Homepage renders main sections", async ({ page }) => {
    await page.goto("/");

    // Check main sections exist
    await expect(page.locator("h1.hero__title")).toContainText("PIRATE ARCADE");
    await expect(page.locator("h2.section__title").first()).toContainText(
      "Games",
    );
    await expect(page.locator("h2.section__title").nth(1)).toContainText(
      "Race to Treasure",
    );
    await expect(page.locator("h2.section__title").nth(2)).toContainText(
      "Play in Browser Now",
    );
    await expect(page.locator("h2.section__title").nth(3)).toContainText(
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
    await expect(page.locator("text=Play in Browser →")).toHaveCount(4);
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
    await expect(page.locator("h2.section__title").last()).toContainText(
      "Made by",
    );
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

test.describe("Chart Overlay", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("chart overlay exists and is inaccessible", async ({ page }) => {
    await page.goto("/");

    const overlay = page.locator(".chart-overlay");
    await expect(overlay).toHaveCount(1);
    await expect(overlay).toHaveAttribute("aria-hidden", "true");
    await expect(overlay).toHaveAttribute("focusable", "false");

    const pe = await overlay.evaluate(
      (el) => window.getComputedStyle(el).pointerEvents,
    );
    expect(pe).toBe("none");
  });

  test("chart-overlay groups exist at desktop width", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".chart-grid-lines")).toBeVisible();
    await expect(page.locator(".compass-rose")).toBeVisible();
    await expect(page.locator(".x-marks")).toBeVisible();
    await expect(page.locator(".mermaid-glyph")).toBeVisible();
    await expect(page.locator(".treasure-chest-glyph")).toBeVisible();
  });

  test("chart overlay visible in dark and light themes", async ({ page }) => {
    await page.goto("/");

    // Dark
    await expect(page.locator(".chart-overlay")).toBeVisible();

    // Switch to light
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light";
    });
    await page.waitForTimeout(100);
    await expect(page.locator(".chart-overlay")).toBeVisible();
  });

  test("chart overlay is simplified on mobile (≤480px)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    // Chart still present
    const overlay = page.locator(".chart-overlay");
    await expect(overlay).toBeAttached();

    // Dense motifs are hidden
    await expect(page.locator(".compass-rose")).toBeHidden();
    await expect(page.locator(".mermaid-glyph")).toBeHidden();
    await expect(page.locator(".treasure-chest-glyph")).toBeHidden();
    await expect(page.locator(".chart-rhumb-lines")).toBeHidden();

    // Grid lines still rendered
    await expect(page.locator(".chart-grid-lines")).toBeAttached();

    // No horizontal overflow with chart present
    const hasOverflow = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      );
    });
    expect(hasOverflow).toBe(false);
  });
});

test.describe("Game Detail Page", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("Race detail page has prominent Play CTA above fold", async ({
    page,
  }) => {
    await page.goto("/games/race-to-treasure-island/");

    const heroCta = page.locator(".game-detail__hero-cta a");
    await expect(heroCta).toBeVisible();
    await expect(heroCta).toHaveText(/Play in Browser/i);

    // Verify it's above the screenshot (above fold)
    const ctaBox = await heroCta.boundingBox();
    expect(ctaBox?.y).toBeLessThan(500);
  });

  test("Race detail screenshot is clickable", async ({ page }) => {
    await page.goto("/games/race-to-treasure-island/");

    const screenshotLink = page.locator(".game-detail__screenshot-link");
    await expect(screenshotLink).toBeVisible();

    const href = await screenshotLink.getAttribute("href");
    expect(href).toBe("/play/race-to-treasure-island/");
  });

  test("Cannonball Clash detail page has Play CTA", async ({ page }) => {
    await page.goto("/games/cannonball-clash/");

    const heroCta = page.locator(".game-detail__hero-cta a");
    await expect(heroCta).toBeVisible();
    await expect(heroCta).toHaveText(/Play in Browser/i);

    const screenshotLink = page.locator(".game-detail__screenshot-link");
    await expect(screenshotLink).toBeVisible();
  });

  test("Desktop-only game has no hero Play CTA or clickable screenshot", async ({
    page,
  }) => {
    await page.goto("/games/port-royale-tycoon/");

    const heroCta = page.locator(".game-detail__hero-cta");
    await expect(heroCta).toHaveCount(0);

    const screenshotLink = page.locator(".game-detail__screenshot-link");
    await expect(screenshotLink).toHaveCount(0);
  });

  test("Game detail screenshot has play overlay for browser games", async ({
    page,
  }) => {
    await page.goto("/games/race-to-treasure-island/");

    const screenshotLink = page.locator(".game-detail__screenshot-link");
    await expect(screenshotLink).toBeVisible();

    const overlay = screenshotLink.locator(".game-detail__screenshot-overlay");
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveText(/Play in Browser/i);

    // Verify it's inside the link
    const href = await screenshotLink.getAttribute("href");
    expect(href).toBe("/play/race-to-treasure-island/");
  });

  test("Game detail screenshot overlay works for Pygbag games too", async ({
    page,
  }) => {
    await page.goto("/games/cannonball-clash/");

    const screenshotLink = page.locator(".game-detail__screenshot-link");
    await expect(screenshotLink).toBeVisible();

    const overlay = screenshotLink.locator(".game-detail__screenshot-overlay");
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveText(/Play in Browser/i);
  });

  test("Screenshot overlay is visible by default on browser games", async ({
    page,
  }) => {
    await page.goto("/games/race-to-treasure-island/");

    const screenshotLink = page.locator(".game-detail__screenshot-link");
    await expect(screenshotLink).toBeVisible();

    const overlay = screenshotLink.locator(".game-detail__screenshot-overlay");
    await expect(overlay).toBeVisible();

    // Should be visible without hover (opacity > 0)
    const opacity = await overlay.evaluate(
      (el) => window.getComputedStyle(el).opacity,
    );
    expect(parseFloat(opacity)).toBeGreaterThan(0.5);

    // Hover should increase opacity
    await screenshotLink.hover();
    await page.waitForTimeout(100);
    const hoverOpacity = await overlay.evaluate(
      (el) => window.getComputedStyle(el).opacity,
    );
    expect(parseFloat(hoverOpacity)).toBeGreaterThanOrEqual(0.9);

    const href = await screenshotLink.getAttribute("href");
    expect(href).toBe("/play/race-to-treasure-island/");
  });
});
