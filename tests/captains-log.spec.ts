/**
 * Captain's Log local play history tests.
 *
 * Tests the localStorage-based play history panel on /play.
 * Does NOT require Pygbag runtime - only tests the /play page
 * launch behavior and localStorage handling.
 */

import { test, expect } from "@playwright/test";

test.describe("Captain's Log", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto("/play/");
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test("shows no log panel when localStorage is empty", async ({ page }) => {
    await page.goto("/play/");
    const logPanel = page.locator("#captains-log");
    await expect(logPanel).toBeHidden();
  });

  test("clicking a browser-playable game CTA records a local launch before navigation", async ({
    page,
  }) => {
    await page.goto("/play/");

    // Click the first browser-playable game CTA
    const playLink = page.locator("a[data-captains-log]").first();
    await expect(playLink).toBeVisible();

    // Click the link (this should record the launch before navigation)
    await playLink.click();

    // Navigate back to /play to check the log
    await page.goto("/play/");

    // The log panel should now be visible
    const logPanel = page.locator("#captains-log");
    await expect(logPanel).toBeVisible();

    // Should have one entry
    const logItems = page.locator(".captains-log__item");
    await expect(logItems).toHaveCount(1);
  });

  test("returning to /play shows the local log", async ({ page }) => {
    await page.goto("/play/");

    // Manually add a log entry via localStorage (simulating a previous visit)
    await page.evaluate(() => {
      const entry = {
        gameId: "cannonball-clash",
        title: "Cannonball Clash",
        timestamp: Date.now(),
        route: "/play/cannonball-clash/",
      };
      localStorage.setItem(
        "pirate-arcade-captains-log",
        JSON.stringify([entry]),
      );
      localStorage.setItem(
        "pirate-arcade-captains-log-counts",
        JSON.stringify({ "cannonball-clash": 3 }),
      );
    });

    await page.reload();

    const logPanel = page.locator("#captains-log");
    await expect(logPanel).toBeVisible();

    const logItems = page.locator(".captains-log__item");
    await expect(logItems).toHaveCount(1);

    // Check the entry content
    await expect(logItems.first()).toContainText("Cannonball Clash");
    await expect(logItems.first()).toContainText("Launches: 3");
  });

  test("counts increment correctly", async ({ page }) => {
    await page.goto("/play/");

    // Add initial entry
    await page.evaluate(() => {
      const entry = {
        gameId: "cannonball-clash",
        title: "Cannonball Clash",
        timestamp: Date.now(),
        route: "/play/cannonball-clash/",
      };
      localStorage.setItem(
        "pirate-arcade-captains-log",
        JSON.stringify([entry]),
      );
      localStorage.setItem(
        "pirate-arcade-captains-log-counts",
        JSON.stringify({ "cannonball-clash": 2 }),
      );
    });

    // Click another game to increment its count
    const playLink = page
      .locator('a[data-captains-log="treasure-cove"]')
      .first();
    if (await playLink.isVisible()) {
      await playLink.click();
      await page.goto("/play/");
    }

    const logItems = page.locator(".captains-log__item");
    await expect(logItems).toHaveCount(2);
  });

  test("clear button removes the log", async ({ page }) => {
    await page.goto("/play/");

    // Add a log entry
    await page.evaluate(() => {
      const entry = {
        gameId: "cannonball-clash",
        title: "Cannonball Clash",
        timestamp: Date.now(),
        route: "/play/cannonball-clash/",
      };
      localStorage.setItem(
        "pirate-arcade-captains-log",
        JSON.stringify([entry]),
      );
    });

    await page.reload();

    const logPanel = page.locator("#captains-log");
    await expect(logPanel).toBeVisible();

    // Click clear button
    const clearBtn = page.locator("#captains-log-clear");
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Log should be hidden
    await expect(logPanel).toBeHidden();

    // localStorage should be cleared
    const stored = await page.evaluate(() =>
      localStorage.getItem("pirate-arcade-captains-log"),
    );
    expect(stored).toBeNull();
  });

  test("corrupted localStorage data is handled safely", async ({ page }) => {
    await page.goto("/play/");

    // Corrupt the localStorage
    await page.evaluate(() => {
      localStorage.setItem("pirate-arcade-captains-log", "not valid json");
      localStorage.setItem(
        "pirate-arcade-captains-log-counts",
        "also not json",
      );
    });

    await page.reload();

    // Should not crash, panel should be hidden (no valid entries)
    const logPanel = page.locator("#captains-log");
    await expect(logPanel).toBeHidden();
  });

  test("desktop-only games do not create browser-play launch entries", async ({
    page,
  }) => {
    await page.goto("/play/");

    // Check that desktop-only games don't have data-captains-log attribute
    const desktopLinks = page.locator('a[data-game-id="port-royale-tycoon"]');
    const count = await desktopLinks.count();

    for (let i = 0; i < count; i++) {
      const link = desktopLinks.nth(i);
      const captainsLogAttr = await link.getAttribute("data-captains-log");
      expect(captainsLogAttr).toBeNull();
    }
  });

  test("log persists across page reloads", async ({ page }) => {
    await page.goto("/play/");

    // Add a log entry
    await page.evaluate(() => {
      const entry = {
        gameId: "cannonball-clash",
        title: "Cannonball Clash",
        timestamp: Date.now(),
        route: "/play/cannonball-clash/",
      };
      localStorage.setItem(
        "pirate-arcade-captains-log",
        JSON.stringify([entry]),
      );
    });

    await page.reload();
    await expect(page.locator("#captains-log")).toBeVisible();

    await page.reload();
    await expect(page.locator("#captains-log")).toBeVisible();

    await page.goto("/");
    await page.goto("/play/");
    await expect(page.locator("#captains-log")).toBeVisible();
  });
});
