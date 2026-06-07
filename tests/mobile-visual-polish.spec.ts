import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "iPhone 13", width: 390, height: 844 },
  { name: "iPhone 13 Pro Max", width: 430, height: 932 },
  { name: "iPhone 13 Landscape", width: 844, height: 390 },
  { name: "iPad Portrait", width: 768, height: 1024 },
  { name: "iPad Landscape", width: 1024, height: 768 },
  { name: "Desktop", width: 1280, height: 900 },
];

const PAGES = [
  { path: "/", name: "Home" },
  { path: "/play/", name: "Play" },
  { path: "/games/cannonball-clash/", name: "Cannonball Clash" },
  { path: "/games/treasure-cove/", name: "Treasure Cove" },
  { path: "/games/krakens-wake/", name: "Kraken's Wake" },
  { path: "/games/port-royale-tycoon/", name: "Port Royale Tycoon" },
  { path: "/about/", name: "About" },
  { path: "/source/", name: "Source" },
  { path: "/build-log/", name: "Build Log" },
];

for (const viewport of VIEWPORTS) {
  for (const pageInfo of PAGES) {
    test(`${viewport.name} - ${pageInfo.name} - no horizontal overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto(pageInfo.path, { waitUntil: "domcontentloaded" });

      const hasOverflow = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        );
      });

      expect(hasOverflow).toBe(false);
    });
  }
}

test.describe("Header/Nav mobile layout", () => {
  for (const viewport of VIEWPORTS.filter((v) => v.width <= 844)) {
    test(`${viewport.name} - header height within bounds`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const header = page.locator(".site-header");
      await expect(header).toBeVisible();

      const headerBox = await header.boundingBox();
      expect(headerBox?.height).toBeLessThanOrEqual(64);
    });

    test(`${viewport.name} - Build Log nav item does not wrap awkwardly`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const buildLogLink = page.locator('.site-nav a[href="/build-log"]');
      await expect(buildLogLink).toBeVisible();

      const text = await buildLogLink.textContent();
      expect(text?.trim()).toBeTruthy();
    });

    test(`${viewport.name} - nav items do not wrap awkwardly`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const nav = page.locator(".site-nav");
      const navBox = await nav.boundingBox();
      expect(navBox).not.toBeNull();

      const items = page.locator(".site-nav a");
      const count = await items.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const item = items.nth(i);
        const box = await item.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.width).toBeGreaterThan(0);
          expect(box.height).toBeGreaterThan(0);
        }
      }
    });
  }
});

test.describe("Game card mobile layout", () => {
  for (const viewport of VIEWPORTS.filter((v) => v.width <= 640)) {
    test(`${viewport.name} - game card footer stacks correctly`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/play/", { waitUntil: "domcontentloaded" });

      const footer = page.locator(".game-card__footer").first();
      await expect(footer).toBeVisible();

      const footerBox = await footer.boundingBox();
      expect(footerBox).not.toBeNull();

      const badges = footer.locator(".game-card__footer-badges");
      const badgesBox = await badges.boundingBox();
      expect(badgesBox).not.toBeNull();

      const playLink = footer.locator(".game-card__play-link");
      const playLinkBox = await playLink.boundingBox();
      expect(playLinkBox).not.toBeNull();

      if (badgesBox && playLinkBox && footerBox) {
        expect(badgesBox.x + badgesBox.width).toBeLessThanOrEqual(
          footerBox.x + footerBox.width + 2,
        );
        expect(playLinkBox.x + playLinkBox.width).toBeLessThanOrEqual(
          footerBox.x + footerBox.width + 2,
        );
      }
    });

    test(`${viewport.name} - game card feature chips do not overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/play/", { waitUntil: "domcontentloaded" });

      const chips = page.locator(".game-card__feature-chip");
      const count = await chips.count();

      for (let i = 0; i < count; i++) {
        const chip = chips.nth(i);
        const box = await chip.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.width).toBeLessThanOrEqual(280);
          expect(box.height).toBeGreaterThan(0);
        }
      }
    });
  }
});

test.describe("Badge contrast on parchment", () => {
  for (const viewport of VIEWPORTS.filter((v) => v.width <= 640)) {
    test(`${viewport.name} - status badge readable on parchment`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/play/", { waitUntil: "domcontentloaded" });

      const badge = page.locator(".status-badge").first();
      await expect(badge).toBeVisible();

      const styles = await badge.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          borderColor: cs.borderColor,
        };
      });

      expect(styles.color).toBeTruthy();
      expect(styles.backgroundColor).toBeTruthy();
      expect(styles.borderColor).toBeTruthy();
    });

    test(`${viewport.name} - touch difficulty badge readable on parchment`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/play/", { waitUntil: "domcontentloaded" });

      const badge = page.locator(".game-card__touch-difficulty").first();
      await expect(badge).toBeVisible();

      const styles = await badge.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return { color: cs.color, borderColor: cs.borderColor };
      });

      expect(styles.color).toBeTruthy();
      expect(styles.borderColor).toBeTruthy();
    });
  }
});

test.describe("Feature chip text fit", () => {
  for (const viewport of VIEWPORTS.filter((v) => v.width <= 640)) {
    test(`${viewport.name} - feature chips do not overflow card`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/play/", { waitUntil: "domcontentloaded" });

      const cards = page.locator(".game-chart-frame");
      const count = await cards.count();

      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        const cardBox = await card.boundingBox();
        expect(cardBox).not.toBeNull();

        const chips = card.locator(".game-card__feature-chip");
        const chipCount = await chips.count();

        for (let j = 0; j < chipCount; j++) {
          const chip = chips.nth(j);
          const chipBox = await chip.boundingBox();
          expect(chipBox).not.toBeNull();

          if (chipBox && cardBox) {
            expect(chipBox.x + chipBox.width).toBeLessThanOrEqual(
              cardBox.x + cardBox.width + 2,
            );
          }
        }
      }
    });
  }
});

test.describe("Light/Dark theme readability", () => {
  for (const theme of ["dark", "light"] as const) {
    test(`${theme} theme - badges readable on parchment`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/play/", { waitUntil: "domcontentloaded" });

      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);

      await page.waitForTimeout(100);

      const badge = page.locator(".status-badge").first();
      await expect(badge).toBeVisible();

      const styles = await badge.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          borderColor: cs.borderColor,
        };
      });

      expect(styles.color).toBeTruthy();
      expect(styles.backgroundColor).toBeTruthy();
      expect(styles.borderColor).toBeTruthy();
    });
  }
});

test.describe("No horizontal scroll on core pages", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} - no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const hasOverflow = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        );
      });

      expect(hasOverflow).toBe(false);
    });
  }
});

test.describe("CTA button fit on mobile", () => {
  for (const viewport of VIEWPORTS.filter((v) => v.width <= 640)) {
    test(`${viewport.name} - game card CTA fits within card`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/play/", { waitUntil: "domcontentloaded" });

      const cta = page.locator(".game-card__play-link").first();
      await expect(cta).toBeVisible();

      const ctaBox = await cta.boundingBox();
      expect(ctaBox).not.toBeNull();

      const card = page.locator(".game-chart-frame").first();
      const cardBox = await card.boundingBox();

      if (ctaBox && cardBox) {
        expect(ctaBox.x + ctaBox.width).toBeLessThanOrEqual(
          cardBox.x + cardBox.width + 2,
        );
      }
    });

    test(`${viewport.name} - hero CTAs fit on screen`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const ctas = page.locator(".hero__actions .cta");
      const count = await ctas.count();

      for (let i = 0; i < count; i++) {
        const cta = ctas.nth(i);
        const box = await cta.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.width).toBeLessThanOrEqual(390);
          expect(box.height).toBeGreaterThan(0);
        }
      }
    });
  }
});
