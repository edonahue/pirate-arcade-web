import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Game {
  id: string;
  title: string;
  status: string;
  engine?: string;
}

const games: Game[] = JSON.parse(
  readFileSync(join(__dirname, "..", "src/data/games.json"), "utf-8"),
);

const BROWSER_PLAYABLE = games
  .filter((g) => g.status === "browser-playable")
  .map((g) => ({ id: g.id, name: g.title, engine: g.engine ?? "pygbag" }));

const DESKTOP_ONLY = games
  .filter((g) => g.status === "desktop-available")
  .map((g) => ({ id: g.id, name: g.title }));

const assetVersionsSrc = readFileSync(
  join(__dirname, "..", "scripts/game-asset-versions.mjs"),
  "utf-8",
);
const ASSET_VERSION_MATCH = assetVersionsSrc.match(
  /export\s+const\s+ASSET_VERSION\s*=\s*"([^"]+)"/,
);
const ASSET_VERSION = ASSET_VERSION_MATCH ? ASSET_VERSION_MATCH[1] : "unknown";

test.describe("Game Prewarm", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("prewarm installer is active and repeated hover does not duplicate URLs", async ({
    page,
  }) => {
    await page.goto("/play/");

    // Verify the prewarm installer flag is set
    const installed = await page.evaluate(
      () => !!(window as any).__paGamePrewarmInstalled,
    );
    expect(installed).toBe(true);

    // Verify Cannonball Clash is a Pygbag game
    const cannonballGame = BROWSER_PLAYABLE.find(
      (g) => g.id === "cannonball-clash",
    );
    expect(cannonballGame).toBeDefined();
    expect(cannonballGame!.engine).toBe("pygbag");

    // Trigger pointerenter
    const cannonballCta = page
      .locator(
        'a[data-game-id="cannonball-clash"][data-browser-playable="true"]',
      )
      .last();

    await cannonballCta.dispatchEvent("pointerenter");
    await page.waitForTimeout(300);

    // First intent creates exactly one prefetch for page and one for archive
    const prefetchUrls = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('link[rel="prefetch"]'))
        .filter((l) =>
          (l as HTMLLinkElement).href?.includes("cannonball-clash"),
        )
        .map((l) => (l as HTMLLinkElement).href);
    });
    expect(prefetchUrls).toHaveLength(2);
    const pageUrl = prefetchUrls.find(
      (u) => u.includes("/play/cannonball-clash/") && !u.includes(".tar.gz"),
    );
    const archiveUrl = prefetchUrls.find((u) => u.includes(".tar.gz"));
    expect(pageUrl).toBeDefined();
    expect(archiveUrl).toBeDefined();
    expect(archiveUrl).toMatch(
      new RegExp(`cannonball-clash\\.tar\\.gz\\?v=${ASSET_VERSION}$`),
    );

    // Repeated pointerenter creates no additional copies
    await cannonballCta.dispatchEvent("pointerenter");
    await page.waitForTimeout(300);

    const prefetchUrlsAfterRepeat = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('link[rel="prefetch"]'))
        .filter((l) =>
          (l as HTMLLinkElement).href?.includes("cannonball-clash"),
        )
        .map((l) => (l as HTMLLinkElement).href);
    });
    expect(prefetchUrlsAfterRepeat).toEqual(prefetchUrls);
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
        if (game.engine === "pygbag") {
          expect(archiveUrl).toMatch(
            new RegExp(`${game.id}\\.tar\\.gz\\?v=${ASSET_VERSION}$`),
          );
        } else {
          expect(archiveUrl).toBe("");
        }
      }
    }
  });

  test("standalone CTAs have prewarm data attributes", async ({ page }) => {
    await page.goto("/play/");

    for (const game of BROWSER_PLAYABLE) {
      const standaloneCta = page.locator(
        `a[href="/play/${game.id}/"][data-game-id="${game.id}"][data-browser-playable="true"]`,
      );
      await expect(standaloneCta.first()).toBeVisible();
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

  /** Installs a mock SW controller that captures WARM_CACHE messages. */
  async function mockServiceWorkerController(page: any) {
    await page.addInitScript(() => {
      const mockController = {
        postMessage: (msg: any) => {
          if (msg.type === "WARM_CACHE") {
            (window as any).__paWarmCacheMessages =
              (window as any).__paWarmCacheMessages || [];
            (window as any).__paWarmCacheMessages.push(msg);
          }
        },
      };
      Object.defineProperty(navigator, "serviceWorker", {
        value: { controller: mockController },
        writable: true,
        configurable: true,
      });
    });
  }

  test("WARM_CACHE payload includes page and versioned archive URLs (Pygbag)", async ({
    page,
  }) => {
    await mockServiceWorkerController(page);
    await page.goto("/play/");

    // Trigger prewarm on a browser-playable CTA (Cannonball Clash - Pygbag)
    const cannonballCta = page
      .locator(
        'a[data-game-id="cannonball-clash"][data-browser-playable="true"]',
      )
      .last();
    await cannonballCta.dispatchEvent("pointerenter");
    await page.waitForTimeout(300);

    // Verify the WARM_CACHE message was captured
    const messages = await page.evaluate(
      () => (window as any).__paWarmCacheMessages || [],
    );
    expect(messages).not.toBeNull();
    expect(messages).toHaveLength(1);

    const msg = messages[0];
    expect(msg.type).toBe("WARM_CACHE");
    expect(msg.urls).toHaveLength(2);

    // Extract page URL and archive URL
    const urls = new Set(msg.urls);
    const gamePageUrl = `/play/cannonball-clash/`;
    const archiveUrl = `/play/cannonball-clash/cannonball-clash.tar.gz?v=${ASSET_VERSION}`;

    expect(urls.has(gamePageUrl)).toBe(true);
    expect(urls.has(archiveUrl)).toBe(true);

    // No empty URL, no unrelated game URLs
    expect(msg.urls.some((u: string) => u === "")).toBe(false);
    expect(
      msg.urls.some((u: string) => u.includes("race-to-treasure-island")),
    ).toBe(false);
    expect(msg.urls.some((u: string) => u.includes("treasure-cove"))).toBe(
      false,
    );
    expect(msg.urls.some((u: string) => u.includes("krakens-wake"))).toBe(
      false,
    );
  });

  test("WARM_CACHE payload includes page only (Phaser)", async ({ page }) => {
    await mockServiceWorkerController(page);
    await page.goto("/play/");

    // Trigger prewarm on a browser-playable CTA (Race to Treasure Island - Phaser)
    const raceCta = page
      .locator(
        'a[data-game-id="race-to-treasure-island"][data-browser-playable="true"]',
      )
      .last();
    await raceCta.dispatchEvent("pointerenter");
    await page.waitForTimeout(300);

    // Verify the WARM_CACHE message was captured
    const messages = await page.evaluate(
      () => (window as any).__paWarmCacheMessages || [],
    );
    expect(messages).not.toBeNull();
    expect(messages).toHaveLength(1);

    const msg = messages[0];
    expect(msg.type).toBe("WARM_CACHE");
    expect(msg.urls).toHaveLength(1);

    const urls = new Set(msg.urls);
    const racePageUrl = `/play/race-to-treasure-island/`;

    expect(urls.has(racePageUrl)).toBe(true);

    // No .tar.gz URL, no empty URL, no unrelated game URLs
    expect(msg.urls.some((u: string) => u.includes("tar.gz"))).toBe(false);
    expect(msg.urls.some((u: string) => u === "")).toBe(false);
    expect(msg.urls.some((u: string) => u.includes("cannonball-clash"))).toBe(
      false,
    );
    expect(msg.urls.some((u: string) => u.includes("treasure-cove"))).toBe(
      false,
    );
    expect(msg.urls.some((u: string) => u.includes("krakens-wake"))).toBe(
      false,
    );
  });

  test("graceful degradation when no service worker controller", async ({
    page,
  }) => {
    // Ensure no service worker controller
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "serviceWorker", {
        value: { controller: null },
        writable: true,
        configurable: true,
      });
    });

    await page.goto("/play/");

    // Verify the DOM side still works (prefetch links) still works
    const cannonballCta = page
      .locator(
        'a[data-game-id="cannonball-clash"][data-browser-playable="true"]',
      )
      .last();
    await cannonballCta.dispatchEvent("pointerenter");
    await page.waitForTimeout(300);

    // DOM prefetching still occurs
    const prefetched = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('link[rel="prefetch"]')).some(
        (l) => (l as HTMLLinkElement).href?.includes("cannonball-clash"),
      );
    });
    expect(prefetched).toBe(true);

    // No WARM_CACHE message expected
    const messages = await page.evaluate(
      () => (window as any).__paWarmCacheMessages || [],
    );
    expect(messages).toHaveLength(0);
  });

  test("only browser-playable game IDs are in the CTA selector", async ({
    page,
  }) => {
    await page.goto("/play/");

    const browserPlayableIds = await page.evaluate(() => {
      const links = document.querySelectorAll<HTMLAnchorElement>(
        "a[data-game-id][data-browser-playable=true]",
      );
      return Array.from(links).map((l) => l.getAttribute("data-game-id"));
    });

    const expectedIds = BROWSER_PLAYABLE.map((g) => g.id);
    for (const id of browserPlayableIds) {
      expect(expectedIds.includes(id!)).toBe(true);
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

  test("detail links are not treated as launches", async ({ page }) => {
    await page.goto("/play/");

    const screenshotLink = page
      .locator('[data-game-id="cannonball-clash"].game-card__image')
      .first();
    await expect(screenshotLink).not.toHaveAttribute("target", "_blank");
    await expect(screenshotLink).not.toHaveAttribute(
      "data-game-launch",
      "true",
    );

    const launchLink = page
      .locator('[data-game-launch="true"][data-game-id="cannonball-clash"]')
      .first();
    await expect(launchLink).toBeVisible();
    await expect(launchLink).toHaveAttribute("data-browser-playable", "true");
    await expect(launchLink).toHaveAttribute(
      "data-game-title",
      "Cannonball Clash",
    );
    await expect(launchLink).toHaveAttribute("target", "_blank");

    const rel = await launchLink.getAttribute("rel");
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");

    // In-page recommendation anchors should not have launch semantics
    await expect(
      page.locator('a[href="#desktop-collection"][data-game-launch]'),
    ).toHaveCount(0);

    // In-page anchor without _blank
    const desktopAnchor = page.locator('a[href="#desktop-collection"]');
    await expect(desktopAnchor).not.toHaveAttribute("target", "_blank");
    await expect(desktopAnchor).not.toHaveAttribute("data-game-launch", "true");
  });
});
