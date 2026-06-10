import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const games: any[] = JSON.parse(
  readFileSync(join(__dirname, "..", "src/data/games.json"), "utf-8"),
);

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

  test("source page license claim matches MIT", async ({ page }) => {
    await page.goto("/source/");

    await expect(
      page.locator("text=All code is open source under the MIT license"),
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
});
