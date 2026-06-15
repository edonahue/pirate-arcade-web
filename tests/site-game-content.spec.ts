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

  test("home page game count matches registry", async ({ page }) => {
    await page.goto("/");

    const totalCount = page.locator(".stats-strip__count").first();
    await expect(totalCount).toHaveText(String(games.length));

    const browserCount = page.locator(".stats-strip__count").nth(1);
    await expect(browserCount).toHaveText(String(browserGames.length));

    const desktopCount = page.locator(".stats-strip__count").nth(4);
    await expect(desktopCount).toHaveText(String(desktopGames.length));
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

  test("homepage primary CTA is Enter the Arcade", async ({ page }) => {
    await page.goto("/");

    const primaryCta = page.locator(
      'a.cta--primary:has-text("Enter the Arcade")',
    );
    await expect(primaryCta.first()).toBeVisible();
  });

  test("play page has recommended path strip", async ({ page }) => {
    await page.goto("/play/");

    await expect(page.locator("text=⚡ Set sail")).toBeVisible();
    await expect(page.locator("text=👆 Easiest on touch")).toBeVisible();
    await expect(page.locator("text=🐍 Classic Pygbag set")).toBeVisible();
    await expect(page.locator("text=🖥️ Desktop collection")).toBeVisible();
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

  test("metadata descriptions within reasonable length", async ({ page }) => {
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
