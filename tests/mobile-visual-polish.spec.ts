import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "Small iPhone", width: 360, height: 780 },
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 13", width: 390, height: 844 },
  { name: "iPhone 13 Pro Max", width: 430, height: 932 },
  { name: "iPhone 13 Landscape", width: 844, height: 390 },
  { name: "iPad Portrait", width: 768, height: 1024 },
  { name: "iPad Landscape", width: 1024, height: 768 },
  { name: "Desktop", width: 1280, height: 900 },
];

const MOBILE_VP_NAMES = ["Small iPhone", "iPhone 13", "iPhone 13 Pro Max"];

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

    test(`${viewport.name} - Build Log nav item is visible`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const buildLogLink = page.locator(
        '.site-nav a[data-nav-key="build-log"]',
      );
      await expect(buildLogLink).toBeVisible();

      const text = await buildLogLink.textContent();
      expect(text?.trim()).toBeTruthy();
    });

    test(`${viewport.name} - Build Log abbreviates at narrow widths`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const buildLogLink = page.locator(
        '.site-nav a[data-nav-key="build-log"]',
      );

      if (viewport.width <= 480) {
        const fontSize = await buildLogLink.evaluate((el) => {
          return window.getComputedStyle(el).fontSize;
        });
        expect(fontSize).toBe("0px");
      }
    });

    test(`${viewport.name} - nav items are all visible and sized`, async ({
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
      expect(count).toBe(5);

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
    test(`${viewport.name} - game card footer stacks as column`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/play/", { waitUntil: "domcontentloaded" });

      const footer = page.locator(".game-card__footer").first();
      await expect(footer).toBeVisible();

      const flexDir = await footer.evaluate((el) => {
        return window.getComputedStyle(el).flexDirection;
      });
      expect(flexDir).toBe("column");
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

  for (const viewport of VIEWPORTS.filter((v) => v.width > 640)) {
    test(`${viewport.name} - game card footer uses row layout`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/play/", { waitUntil: "domcontentloaded" });

      const footer = page.locator(".game-card__footer").first();
      await expect(footer).toBeVisible();

      const flexDir = await footer.evaluate((el) => {
        return window.getComputedStyle(el).flexDirection;
      });
      expect(flexDir).toBe("row");
    });
  }
});

test.describe("Badge colors on parchment", () => {
  for (const viewport of VIEWPORTS.filter((v) => v.width <= 640)) {
    test(`${viewport.name} - touch difficulty badges have visible colors`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/play/", { waitUntil: "domcontentloaded" });

      for (const cls of [
        "game-card__touch-difficulty--easy",
        "game-card__touch-difficulty--medium",
        "game-card__touch-difficulty--harder",
      ]) {
        const badge = page.locator(`.${cls}`).first();
        const count = await badge.count();
        if (count === 0) continue;

        const color = await badge.evaluate((el) => {
          return window.getComputedStyle(el).color;
        });

        expect(color).not.toBe("rgba(0, 0, 0, 0)");
        expect(color).not.toBe("");
      }
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

const THEME_COLORS = {
  dark: {
    paperBadgeAvailable: "rgb(20, 10, 4)",
    paperBadgeEasy: "rgb(20, 10, 4)",
    paperBadgeMedium: "rgb(20, 10, 4)",
    paperBadgeHarder: "rgb(20, 10, 4)",
  },
  light: {
    paperBadgeAvailable: "rgb(26, 18, 8)",
    paperBadgeEasy: "rgb(26, 18, 8)",
    paperBadgeMedium: "rgb(26, 18, 8)",
    paperBadgeHarder: "rgb(26, 18, 8)",
  },
};

test.describe("Light/Dark theme readability", () => {
  for (const theme of ["dark", "light"] as const) {
    test(`${theme} theme - badges readable on parchment`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/play/", { waitUntil: "domcontentloaded" });

      if (theme === "light") {
        await page.evaluate(() => {
          document.documentElement.dataset.theme = "light";
        });
        await page.waitForTimeout(100);
      }

      const badge = page.locator(".status-badge").first();
      await expect(badge).toBeVisible();
    });

    test(`${theme} theme - touch difficulty badges use correct colors`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/play/", { waitUntil: "domcontentloaded" });

      if (theme === "light") {
        await page.evaluate(() => {
          document.documentElement.dataset.theme = "light";
        });
        await page.waitForTimeout(100);
      }

      const expected = THEME_COLORS[theme];

      for (const [cls, expectedColor] of [
        ["game-card__touch-difficulty--easy", expected.paperBadgeEasy],
        ["game-card__touch-difficulty--medium", expected.paperBadgeMedium],
        ["game-card__touch-difficulty--harder", expected.paperBadgeHarder],
      ]) {
        const badge = page.locator(`.${cls}`).first();
        const count = await badge.count();
        if (count === 0) continue;

        const color = await badge.evaluate((el) => {
          return window.getComputedStyle(el).color;
        });

        expect(color).toBe(expectedColor);
      }
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

test.describe("Mobile screenshot comparison", () => {
  for (const vpName of MOBILE_VP_NAMES) {
    const vp = VIEWPORTS.find((v) => v.name === vpName)!;

    test(`${vpName} - home page screenshots match`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot(`${vpName}-home.png`, {
        maxDiffPixels: 500,
        animations: "disabled",
      });
    });

    test(`${vpName} - play page screenshots match`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/play/", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot(`${vpName}-play.png`, {
        maxDiffPixels: 500,
        animations: "disabled",
      });
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
          expect(box.width).toBeLessThanOrEqual(viewport.width);
          expect(box.height).toBeGreaterThan(0);
        }
      }
    });

    test(`${viewport.name} - recommended-first cards stack without overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const cards = page.locator(".recommended-first__card");
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(1);

      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        await expect(card).toBeVisible();

        const box = await card.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.width).toBeLessThanOrEqual(viewport.width);
          expect(box.height).toBeGreaterThan(0);
          expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        }
      }
    });
  }
});
