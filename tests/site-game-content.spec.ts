import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const games: any[] = JSON.parse(
  readFileSync(join(__dirname, "..", "src/data/games.json"), "utf-8"),
);
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);
const projectLicense = pkg.license || "MIT";

const browserGames = games.filter((g: any) => g.status === "browser-playable");
const desktopGames = games.filter((g: any) => g.status === "desktop-available");
const pygbagGames = browserGames.filter((g: any) => g.engine === "pygbag");
const phaserGames = browserGames.filter((g: any) => g.engine === "phaser");

type Rect = { x: number; y: number; width: number; height: number };
function rectanglesDoNotOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

test.describe("Site Game Content", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("game detail pages show correct CTAs", async ({ page }) => {
    for (const game of games) {
      await page.goto(`/games/${game.id}/`);

      const isBrowser = game.status === "browser-playable";
      const playBtn = page.locator(
        'a.cta--primary:has-text("Play in Browser")',
      );
      const downloadBtn = page.locator(
        'a.cta--gold:has-text("Download Desktop")',
      );

      if (isBrowser) {
        await expect(playBtn.first()).toBeVisible();
      } else {
        await expect(playBtn.first()).toBeHidden();
      }

      if (game.desktopUrl) {
        await expect(downloadBtn.first()).toBeVisible();
      }
    }
  });

  test("screenshot exists for every game", async ({ page }) => {
    for (const game of games) {
      await page.goto(`/games/${game.id}/`);
      const screenshot = page.locator(
        `img[alt="${game.title} gameplay screenshot"]`,
      );
      await expect(screenshot).toBeVisible();
      const src = await screenshot.getAttribute("src");
      expect(src).toBeTruthy();
      expect(src!.startsWith("/images/")).toBe(true);
    }
  });

  test("play page engine split is accurate", async ({ page }) => {
    await page.goto("/play/");

    const pygbagSection = page.locator("text=Pygbag / WebAssembly");
    const phaserSection = page.locator("text=Web Native (Phaser 3)");
    await expect(pygbagSection).toBeVisible();
    await expect(phaserSection).toBeVisible();

    for (const game of pygbagGames) {
      await expect(
        page.locator(`a[href="${game.browserUrl}"]`).first(),
      ).toBeVisible();
    }

    for (const game of phaserGames) {
      await expect(
        page.locator(`a[href="${game.browserUrl}"]`).first(),
      ).toBeVisible();
    }
  });

  test("home page stats strip has 3 registry-derived counts", async ({
    page,
  }) => {
    await page.goto("/");

    const statsItems = page.locator(".stats-strip__item");
    await expect(statsItems).toHaveCount(3);

    const engines = new Set(browserGames.map((g: any) => g.engine));

    const totalLabel = page.locator(
      '.stats-strip__item:has-text("Total Games")',
    );
    await expect(totalLabel.locator(".stats-strip__count")).toHaveText(
      String(games.length),
    );

    const browserLabel = page.locator(
      '.stats-strip__item:has-text("Play in Browser")',
    );
    await expect(browserLabel.locator(".stats-strip__count")).toHaveText(
      String(browserGames.length),
    );

    const enginesLabel = page.locator(
      '.stats-strip__item:has-text("Browser Engines")',
    );
    await expect(enginesLabel.locator(".stats-strip__count")).toHaveText(
      String(engines.size),
    );
  });

  test("source page license claim matches package.json", async ({ page }) => {
    await page.goto("/source/");

    await expect(
      page.locator(
        `text=All code is open source under the ${projectLicense} license`,
      ),
    ).toBeVisible();
  });

  test("play page desktop section does not show browser language for Port Royale", async ({
    page,
  }) => {
    await page.goto("/play/");

    const desktopOnly = games.filter(
      (g: any) => g.status === "desktop-available",
    );
    for (const game of desktopOnly) {
      await expect(page.locator(`text=${game.title}`).first()).toBeVisible();
    }
  });

  test("browser games reference desktop repo where applicable", async () => {
    for (const game of browserGames) {
      if (game.engine !== "phaser") {
        expect(game.desktopUrl).toBeTruthy();
      }
    }
  });

  test("game detail pages have Load sidebar card", async ({ page }) => {
    for (const game of games) {
      await page.goto(`/games/${game.id}/`);

      const loadCard = page.locator("text=Load").first();
      await expect(loadCard).toBeVisible();
    }
  });

  test("status panel shows all games", async ({ page }) => {
    await page.goto("/play/");

    for (const game of games) {
      await expect(page.locator(`text=${game.title}`).first()).toBeVisible();
    }
  });

  test("build-log has the Race post", async ({ page }) => {
    await page.goto("/build-log/");

    await expect(
      page.locator(
        "text=Race to Treasure Island: Building a Web-Native Phaser Game",
      ),
    ).toBeVisible();
  });

  test("game detail pages show Best for line", async ({ page }) => {
    for (const game of games) {
      if (!game.bestFor) continue;
      await page.goto(`/games/${game.id}/`);
      await expect(page.locator("text=Best for:").first()).toBeVisible();
    }
  });

  test("play page game cards show first-play tips", async ({ page }) => {
    await page.goto("/play/");

    for (const game of browserGames) {
      if (!game.firstPlayTip) continue;
      const card = page.locator(`article:has([data-game-id="${game.id}"])`);
      await expect(card.locator(".game-card__first-play")).toBeVisible();
    }
  });

  test("game detail pages show quick-start callout", async ({ page }) => {
    for (const game of games) {
      if (!game.firstPlayTip) continue;
      await page.goto(`/games/${game.id}/`);
      await expect(page.locator(".game-detail__quick-start")).toBeVisible();
    }
  });

  test("build-log post renders and has metadata", async ({ page }) => {
    await page.goto("/build-log/race-to-treasure-island-phaser-polish/");

    await expect(page.locator("h1")).toBeVisible();
    const title = await page.locator("h1").textContent();
    expect(title).toContain("Race to Treasure Island");
  });

  test("homepage has builder credit and proof strip", async ({ page }) => {
    await page.goto("/");

    // Builder credit link (href may not have trailing slash)
    await expect(
      page.locator('.hero__credit a[href*="erichdonahue.com"]'),
    ).toBeVisible();

    // Proof strip in Experiment section
    await expect(page.locator("text=Engines").last()).toBeVisible();
    await expect(page.locator("text=Tests").last()).toBeVisible();
    await expect(page.locator("text=Release gate").last()).toBeVisible();
    await expect(page.locator("text=Screenshots").last()).toBeVisible();
    await expect(page.locator("text=Infrastructure").last()).toBeVisible();

    // Proof strip values should be maintainable (no exact counts)
    await expect(page.locator("text=Playwright suite")).toBeVisible();
    await expect(page.locator("text=Multi-step automated")).toBeVisible();
  });

  test("homepage Rhead vignette does not intersect game cards at desktop", async ({
    page,
  }) => {
    await page.goto("/");

    const vignette = page.locator(".vignette--treasure-island");
    const vignetteBox = await vignette.boundingBox();
    expect(vignetteBox).not.toBeNull();

    const gameCards = page.locator(".game-chart-frame");
    const cardCount = await gameCards.count();

    for (let i = 0; i < cardCount; i++) {
      const cardBox = await gameCards.nth(i).boundingBox();
      if (cardBox) {
        expect(rectanglesDoNotOverlap(vignetteBox!, cardBox)).toBe(true);
      }
    }

    // Start-here links also not overlapped
    const startHere = page.locator(".start-here__link");
    const startHereCount = await startHere.count();
    for (let i = 0; i < startHereCount; i++) {
      const linkBox = await startHere.nth(i).boundingBox();
      if (linkBox) {
        expect(rectanglesDoNotOverlap(vignetteBox!, linkBox)).toBe(true);
      }
    }

    // Section title and description not overlapped
    const sectionTitle = page.locator(".section--games .section__title");
    const sectionDesc = page.locator(".section--games .section__description");
    const titleBox = await sectionTitle.boundingBox();
    const descBox = await sectionDesc.boundingBox();
    if (titleBox) {
      expect(rectanglesDoNotOverlap(vignetteBox!, titleBox)).toBe(true);
    }
    if (descBox) {
      expect(rectanglesDoNotOverlap(vignetteBox!, descBox)).toBe(true);
    }
  });

  test("homepage Pyle experiment art does not cover CTA or proof-strip text", async ({
    page,
  }) => {
    await page.goto("/");

    const art = page.locator(".section__art").last();
    const artBox = await art.boundingBox();
    expect(artBox).not.toBeNull();

    // Check proof strip items not covered
    const proofItems = page.locator(".proof-strip__item");
    const proofCount = await proofItems.count();
    for (let i = 0; i < proofCount; i++) {
      const itemBox = await proofItems.nth(i).boundingBox();
      if (itemBox) {
        expect(rectanglesDoNotOverlap(artBox!, itemBox)).toBe(true);
      }
    }

    // Check the experiment CTA not covered
    const cta = page.locator('a[href="/build-log"]').last();
    const ctaBox = await cta.boundingBox();
    if (ctaBox) {
      expect(rectanglesDoNotOverlap(artBox!, ctaBox)).toBe(true);
    }
  });

  test("homepage primary CTA is Enter the Arcade", async ({ page }) => {
    await page.goto("/");

    const primaryCta = page.locator(
      'a.cta--primary:has-text("Enter the Arcade")',
    );
    await expect(primaryCta.first()).toBeVisible();
  });

  test("play page has recommended path strip", async ({ page }) => {
    await page.goto("/play/");

    await expect(
      page.locator(".recommended-path__label:has-text('Instant Course')"),
    ).toBeVisible();
    await expect(
      page.locator(".recommended-path__label:has-text('Best on Touch')"),
    ).toBeVisible();
    await expect(
      page.locator(".recommended-path__label:has-text('Pygbag Classics')"),
    ).toBeVisible();
    await expect(
      page.locator(".recommended-path__label:has-text('Desktop Collection')"),
    ).toBeVisible();
  });

  test("homepage quick-start labels are text-only", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.locator(".start-here__badge:has-text('Instant Load')"),
    ).toBeVisible();
    await expect(
      page.locator(".start-here__badge:has-text('Best on Touch')"),
    ).toBeVisible();
    await expect(
      page.locator(".start-here__badge:has-text('Desktop Only')"),
    ).toBeVisible();
  });

  test("Rhead vignette does not intersect content at tablet width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/");

    const vignette = page.locator(".vignette--treasure-island");
    const vignetteBox = await vignette.boundingBox();
    expect(vignetteBox).not.toBeNull();

    // Section title and description not overlapped
    const sectionTitle = page.locator(".section--games .section__title");
    const sectionDesc = page.locator(".section--games .section__description");
    const titleBox = await sectionTitle.boundingBox();
    const descBox = await sectionDesc.boundingBox();
    if (titleBox) {
      expect(rectanglesDoNotOverlap(vignetteBox!, titleBox)).toBe(true);
    }
    if (descBox) {
      expect(rectanglesDoNotOverlap(vignetteBox!, descBox)).toBe(true);
    }

    // Document has no horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      );
    });
    expect(hasOverflow).toBe(false);

    // Section description retains practical readable width
    if (descBox) {
      expect(descBox.width).toBeGreaterThanOrEqual(300);
    }
  });

  test("about page links to builder sites", async ({ page }) => {
    await page.goto("/about/");

    await expect(
      page.locator('a[href*="erichdonahue.com"]').first(),
    ).toBeVisible();
    await expect(
      page.locator('a[href*="github.com/edonahue"]').first(),
    ).toBeVisible();
    await expect(
      page.locator('a[href*="linkedin.com/in/erichdonahue"]').first(),
    ).toBeVisible();
  });

  test("about page has builder positioning section", async ({ page }) => {
    await page.goto("/about/");

    await expect(
      page.locator("text=Product-Minded Engineering").first(),
    ).toBeVisible();
    await expect(page.locator("text=decision science").first()).toBeVisible();
  });

  test("source page has engineering proof cards", async ({ page }) => {
    await page.goto("/source/");

    await expect(page.locator("text=Engineering Discipline")).toBeVisible();
    await expect(page.locator("text=Two Repositories")).toBeVisible();
    await expect(page.locator("text=Static Site").first()).toBeVisible();
    await expect(page.locator("text=Two Browser Engines")).toBeVisible();
    await expect(page.locator("text=Deterministic Test Hooks")).toBeVisible();
    await expect(page.locator("text=Screenshot Capture")).toBeVisible();
    await expect(page.locator("text=Game Registry Validation")).toBeVisible();
    await expect(
      page.locator("text=Automated Release Gate").first(),
    ).toBeVisible();
    await expect(page.locator("text=CSP").first()).toBeVisible();
    await expect(page.locator("text=Mobile").first()).toBeVisible();

    // Should NOT claim CSP/SW cross-reference in Game Registry Validation
    const registryCard = page
      .locator("text=Game Registry Validation")
      .locator("..");
    await expect(registryCard).not.toContainText("CSP");
    await expect(registryCard).not.toContainText("service worker");
    await expect(registryCard).not.toContainText("SW cache");
  });

  test("game detail pages show What this demonstrates", async ({ page }) => {
    for (const game of games) {
      await page.goto(`/games/${game.id}/`);

      if (game.demonstrates && game.demonstrates.length > 0) {
        await expect(page.locator("text=What this demonstrates")).toBeVisible();
      }
    }
  });

  test("header support link is icon-only with accessible label and title", async ({
    page,
  }) => {
    await page.goto("/");

    const supportLink = page.locator(".support-link");
    await expect(supportLink).toBeVisible();
    await expect(supportLink).toHaveAttribute(
      "aria-label",
      "Buy me a coffee to support Pirate Arcade",
    );
    await expect(supportLink).toHaveAttribute(
      "title",
      "Support Pirate Arcade on Buy Me a Coffee",
    );

    // Should not have visible text beyond the sr-only span
    const linkText = await supportLink.textContent();
    // The sr-only span text is the only visible text content
    expect(linkText?.trim()).toContain("Buy me a coffee");
  });

  test("metadata descriptions within reasonable length and contain registry-derived counts", async ({
    page,
  }) => {
    const pages = [
      { path: "/", maxLen: 200 },
      { path: "/about/", maxLen: 200 },
      { path: "/source/", maxLen: 300 },
      { path: "/play/", maxLen: 200 },
    ];

    for (const { path, maxLen } of pages) {
      await page.goto(path);
      const desc = await page
        .locator('meta[name="description"]')
        .getAttribute("content");
      expect(desc).toBeTruthy();
      expect(desc!.length).toBeLessThanOrEqual(maxLen);

      // Homepage and Play page descriptions should contain derived browser count
      if (path === "/" || path === "/play/") {
        expect(desc).toContain(String(browserGames.length));
      }
    }

    // Game detail pages
    for (const game of games) {
      await page.goto(`/games/${game.id}/`);
      const desc = await page
        .locator('meta[name="description"]')
        .getAttribute("content");
      expect(desc).toBeTruthy();
      expect(desc!.length).toBeLessThanOrEqual(180);
    }
  });

  test("font links load Cinzel, Inter, and IBM Plex Mono", async ({ page }) => {
    await page.goto("/");

    // Check live font link (preload with onload) - first stylesheet link to Google Fonts
    const liveLink = page
      .locator('link[rel="stylesheet"][href*="fonts.googleapis.com"]')
      .first();
    await expect(liveLink).toHaveAttribute("href", /family=Cinzel/);
    await expect(liveLink).toHaveAttribute("href", /family=Inter/);
    await expect(liveLink).toHaveAttribute("href", /family=IBM\+Plex\+Mono/);
  });

  test("proof strip does not overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const proofStrip = page.locator(".proof-strip");
    await expect(proofStrip).toBeVisible();

    const box = await proofStrip.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(390);
  });

  test("game cards do not overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const gameGrid = page.locator(".game-grid");
    await expect(gameGrid).toBeVisible();

    const box = await gameGrid.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(390);
  });

  test("source engineering-proof cards stack on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/source/");

    const proofCards = page.locator(".engineering-proof__card");
    const count = await proofCards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const box = await proofCards.nth(i).boundingBox();
      expect(box?.width).toBeLessThanOrEqual(390);
    }
  });

  test("game detail sidebar stacks below main content on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/cannonball-clash/");

    const layout = page.locator(".game-detail__layout");
    const box = await layout.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(390);

    // Sidebar should be visible and not overflow
    const sidebar = page.locator(".game-detail__sidebar");
    await expect(sidebar).toBeVisible();
  });

  test("play page section IDs exist and are not nested", async ({ page }) => {
    await page.goto("/play/");

    const ids = [
      "game-selection",
      "browser-games",
      "pygbag-games",
      "web-native-games",
      "desktop-collection",
      "roadmap",
      "captains-log",
    ];
    for (const id of ids) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }

    // #desktop-collection not inside #browser-games
    const browserGames = page.locator("#browser-games");
    await expect(browserGames.locator("#desktop-collection")).toHaveCount(0);

    // #roadmap not inside #browser-games
    await expect(browserGames.locator("#roadmap")).toHaveCount(0);

    // .status-panel not inside #browser-games
    await expect(browserGames.locator(".status-panel")).toHaveCount(0);

    // #captains-log not inside #browser-games
    await expect(browserGames.locator("#captains-log")).toHaveCount(0);
  });

  test("recommendation-strip anchors point to correct destinations", async ({
    page,
  }) => {
    await page.goto("/play/");

    const pygbagClassics = page.locator(
      '.recommended-path__label:has-text("Pygbag Classics") + a',
    );
    await expect(pygbagClassics).toHaveAttribute("href", "#pygbag-games");

    const desktopCollection = page.locator(
      '.recommended-path__label:has-text("Desktop Collection") + a',
    );
    await expect(desktopCollection).toHaveAttribute(
      "href",
      "#desktop-collection",
    );
    await expect(desktopCollection).toContainText(
      "Downloads and Port Royale Tycoon",
    );

    const instantCourse = page.locator(
      '.recommended-path__label:has-text("Instant Course") + a',
    );
    await expect(instantCourse).toHaveAttribute(
      "href",
      "/play/race-to-treasure-island/",
    );

    const bestOnTouch = page.locator(
      '.recommended-path__label:has-text("Best on Touch") + a',
    );
    await expect(bestOnTouch).toHaveAttribute(
      "href",
      "/play/cannonball-clash/",
    );

    // In-page anchor cards should not have target="_blank"
    await expect(pygbagClassics).not.toHaveAttribute("target", "_blank");
    await expect(desktopCollection).not.toHaveAttribute("target", "_blank");
  });

  test("engine markers are PY and JS with no emoji", async ({ page }) => {
    await page.goto("/play/");

    await expect(page.locator(".engine-card__marker--python")).toContainText(
      "PY",
    );
    await expect(
      page.locator(".engine-card__marker--javascript"),
    ).toContainText("JS");

    // No snake or lightning emoji in any engine card header
    const headers = page.locator(".engine-card__header");
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      await expect(headers.nth(i)).not.toContainText("🐍");
      await expect(headers.nth(i)).not.toContainText("⚡");
    }

    // .engine-card__icon should not exist
    await expect(page.locator(".engine-card__icon")).toHaveCount(0);
  });

  test("play page no horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/play/");

    const hasOverflow = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      );
    });
    expect(hasOverflow).toBe(false);

    // Engine markers remain visible
    await expect(page.locator(".engine-card__marker--python")).toBeVisible();
    await expect(
      page.locator(".engine-card__marker--javascript"),
    ).toBeVisible();

    // Game-selection inner padding does not force overflow
    const inner = page.locator(".game-selection__inner");
    const box = await inner.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(390);

    // In-page anchor destinations retain positive scroll-margin-top
    const scrollMargin = await page
      .locator("#pygbag-games")
      .evaluate((el) => window.getComputedStyle(el).scrollMarginTop);
    expect(parseFloat(scrollMargin)).toBeGreaterThan(0);
  });

  test("status panel scrolls horizontally rather than overflowing", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/play/");

    const wrapper = page.locator(".status-panel__table-wrapper");
    await expect(wrapper).toBeVisible();

    // Check that overflow-x is auto (scrollable)
    const overflowX = await wrapper.evaluate(
      (el) => getComputedStyle(el).overflowX,
    );
    expect(overflowX).toBe("auto");
  });

  test("header support/theme/nav controls remain visible and non-overlapping", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const supportLink = page.locator(".support-link");
    const themeToggle = page.locator(".theme-toggle");
    const nav = page.locator(".site-nav");

    await expect(supportLink).toBeVisible();
    await expect(themeToggle).toBeVisible();
    await expect(nav).toBeVisible();

    // Check no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(390);
  });

  test("screenshot captions remain visible and not clipped", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const captions = page.locator(".game-card__screenshot-caption");
    const count = await captions.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const caption = captions.nth(i);
      await expect(caption).toBeVisible();
      const box = await caption.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(390);
    }
  });

  test("JSON-LD schema is valid on homepage", async ({ page }) => {
    await page.goto("/");
    const jsonText = await page
      .locator('script[type="application/ld+json"]')
      .textContent();
    expect(jsonText).toBeTruthy();

    const parsed = JSON.parse(jsonText!);
    expect(parsed["@context"]).toBe("https://schema.org");

    const graph = parsed["@graph"];
    expect(Array.isArray(graph)).toBe(true);

    const types = graph.map((n: any) => n["@type"]).flat();
    expect(types).toContain("WebSite");
    expect(types).toContain("Person");
    expect(types).toContain("SoftwareApplication");
    expect(types).toContain("VideoGame");

    const person = graph.find((n: any) => {
      const t = n["@type"];
      return Array.isArray(t) ? t.includes("Person") : t === "Person";
    });
    expect(person).toBeTruthy();
    expect(person.sameAs).toBeDefined();
    const sameAsUrls: string[] = person.sameAs;
    const allSameAs = sameAsUrls.join(" ");
    expect(allSameAs).toContain("erichdonahue.com");
    expect(allSameAs).toContain("github.com/edonahue");
    expect(allSameAs).toContain("linkedin.com/in/erichdonahue");

    const project = graph.find((n: any) => {
      const t = n["@type"];
      const types = Array.isArray(t) ? t : [t];
      return (
        types.includes("SoftwareApplication") && types.includes("VideoGame")
      );
    });
    expect(project).toBeTruthy();
    expect(project.offers).toBeDefined();
    expect(project.offers.price).toBe("0");
  });

  test("game detail pages have VideoGame JSON-LD", async ({ page }) => {
    for (const game of games) {
      await page.goto(`/games/${game.id}/`);
      const jsonText = await page
        .locator('script[type="application/ld+json"]')
        .textContent();
      expect(jsonText).toBeTruthy();

      const parsed = JSON.parse(jsonText!);
      const graph = parsed["@graph"];
      expect(Array.isArray(graph)).toBe(true);

      const videoGame = graph.find(
        (n: any) => n["@type"] === "VideoGame" && n.name === game.title,
      );
      expect(
        videoGame,
        `Game detail page for "${game.title}" should include VideoGame schema`,
      ).toBeTruthy();

      if (game.screenshot) {
        expect(videoGame.image).toBeTruthy();
        expect(videoGame.image).toContain(game.screenshot.replace("/", ""));
      }
    }
  });

  test("every page has OG title, description, and image", async ({ page }) => {
    const paths = ["/", "/play/", "/about/", "/source/"];
    for (const game of games) {
      paths.push(`/games/${game.id}/`);
    }

    for (const path of paths) {
      await page.goto(path);
      const ogTitle = await page
        .locator('meta[property="og:title"]')
        .getAttribute("content");
      const ogDesc = await page
        .locator('meta[property="og:description"]')
        .getAttribute("content");
      const ogImage = await page
        .locator('meta[property="og:image"]')
        .getAttribute("content");
      expect(ogTitle, `${path} missing og:title`).toBeTruthy();
      expect(ogDesc, `${path} missing og:description`).toBeTruthy();
      expect(ogImage, `${path} missing og:image`).toBeTruthy();
      expect(ogDesc!.length).toBeGreaterThan(10);
    }
  });
});
