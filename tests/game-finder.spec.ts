import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const games: any[] = JSON.parse(
  readFileSync(join(__dirname, "../src/data/games.json"), "utf-8"),
);

const browserGames = games.filter((g) => g.status === "browser-playable");
const instantGame = browserGames.find((g) => g.engine === "phaser");
const touchGame = browserGames.find((g) => g.touchDifficulty === "easy");
const harderGame = browserGames.find((g) => g.touchDifficulty === "harder");

for (const [name, game] of Object.entries({
  instantGame,
  touchGame,
  harderGame,
})) {
  if (!game) throw new Error(`Missing registry fixture: ${name}`);
}

test.describe("Game Finder", () => {
  test("renders semantic registry-derived default and fallback", async ({
    page,
  }) => {
    await page.goto("/play/");
    const finder = page.locator("#start-here section.game-finder");
    await expect(finder).toBeVisible();
    await expect(finder.locator("h2")).toBeVisible();

    const fieldsets = finder.locator("fieldset");
    await expect(fieldsets).toHaveCount(3);
    for (const fs of await fieldsets.all()) {
      await expect(fs.locator("legend")).toBeVisible();
      await expect(fs.locator("select")).toBeVisible();
    }

    const result = finder.locator(".game-finder__result");
    await expect(result).toHaveAttribute("aria-live", "polite");

    const title = result.locator(".game-finder__title");
    const cta = result.locator(".game-finder__cta");
    await expect(title).toHaveText(instantGame!.title);
    await expect(cta).toHaveAttribute("href", instantGame!.browserUrl);
    await expect(cta).toHaveAttribute("data-game-id", instantGame!.id);

    await expect(page.locator(".recommended-path")).toBeVisible();
  });

  test("updates deterministic recommendations and launch metadata", async ({
    page,
  }) => {
    await page.goto("/play/");
    const finder = page.locator("#start-here section.game-finder");
    const result = finder.locator(".game-finder__result");
    const title = result.locator(".game-finder__title");
    const cta = result.locator(".game-finder__cta");

    await finder.locator('select[name="control"]').selectOption("touch");
    await expect(title).toHaveText(touchGame!.title);
    await expect(cta).toHaveAttribute("href", touchGame!.browserUrl);
    await expect(cta).toHaveAttribute("data-game-id", touchGame!.id);
    await expect(cta).toHaveAttribute("data-game-launch", "true");
    await expect(cta).toHaveAttribute("data-game-page", touchGame!.browserUrl);

    await page.reload();
    await finder.locator('select[name="load"]').selectOption("instant");
    await expect(title).toHaveText(instantGame!.title);
    await expect(cta).toHaveAttribute("href", instantGame!.browserUrl);
    await expect(cta).toHaveAttribute("data-game-id", instantGame!.id);
    await expect(cta).toHaveAttribute("data-game-launch", "true");
    await expect(cta).toHaveAttribute(
      "data-game-page",
      instantGame!.browserUrl,
    );

    await page.reload();
    await finder.locator('select[name="challenge"]').selectOption("harder");
    await expect(title).toHaveText(harderGame!.title);
    await expect(cta).toHaveAttribute("href", harderGame!.browserUrl);
    await expect(cta).toHaveAttribute("data-game-id", harderGame!.id);
    await expect(cta).toHaveAttribute("data-game-launch", "true");
    await expect(cta).toHaveAttribute("data-game-page", harderGame!.browserUrl);
  });

  test("works from keyboard without mobile overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/play/");
    const finder = page.locator("#start-here section.game-finder");
    const result = finder.locator(".game-finder__result");
    const title = result.locator(".game-finder__title");
    const cta = result.locator(".game-finder__cta");

    const controlSelect = finder.locator('select[name="control"]');
    await controlSelect.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowDown");
    await expect(title).toHaveText(touchGame!.title);

    const challengeSelect = finder.locator('select[name="challenge"]');
    await challengeSelect.focus();
    await page.keyboard.press("End");
    await expect(result).toBeVisible();
    await expect(title).toBeVisible();
    await expect(cta).toBeVisible();
    await expect(finder.locator('select[name="control"]')).toBeVisible();
    await expect(finder.locator('select[name="load"]')).toBeVisible();
    await expect(challengeSelect).toBeVisible();

    const ctaBox = await cta.boundingBox();
    expect(ctaBox?.height).toBeGreaterThanOrEqual(44);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(true);
  });
});
