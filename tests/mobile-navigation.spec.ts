import { test, expect } from "@playwright/test";

test.describe("Mobile Navigation", () => {
  test.use({ viewport: { width: 932, height: 430 } });

  const GAMES = [
    { name: "Cannonball Clash", path: "/play/cannonball-clash/" },
    { name: "Treasure Cove", path: "/play/treasure-cove/" },
  ];

  for (const game of GAMES) {
    test.describe(game.name, () => {
      test("Back link is present and visible before runtime", async ({
        page,
      }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });

        const backLink = page.locator("#back-link");
        await expect(backLink).toBeVisible({ timeout: 5000 });
        await expect(backLink).toHaveText(/← Back to Arcade/i);
      });

      test("Back link is present after touch overlay activates", async ({
        page,
      }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });

        // Wait for the touch overlay to activate (static signal, no Pygbag needed)
        try {
          await page.waitForSelector("#touch-overlay.active", {
            timeout: 5000,
          });
        } catch {
          // Some projects may not activate touch overlay — still check back link
        }

        const backLink = page.locator("#back-link");
        await expect(backLink).toBeVisible();
      });

      test("elementFromPoint at back-link center resolves to #back-link", async ({
        page,
      }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });

        const backLink = page.locator("#back-link");
        await expect(backLink).toBeVisible();

        const topElement = await page.evaluate(() => {
          const el = document.getElementById("back-link");
          if (!el) return null;
          const box = el.getBoundingClientRect();
          const cx = box.left + box.width / 2;
          const cy = box.top + box.height / 2;
          const top = document.elementFromPoint(cx, cy);
          if (!top) return null;
          // Walk up to find #back-link or data-no-touch-control
          let current = top as HTMLElement | null;
          while (current) {
            if (
              current.id === "back-link" ||
              current.getAttribute("data-no-touch-control") !== null
            ) {
              return current.id || current.tagName;
            }
            current = current.parentElement;
          }
          return top.id || top.tagName;
        });

        expect(topElement).toBe("back-link");
      });

      test("tapping Back link navigates to /play/", async ({ page }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });

        const backLink = page.locator("#back-link");
        await expect(backLink).toBeVisible();

        // Use Playwright tap for realistic mobile gesture
        await backLink.tap();

        // Wait for navigation to /play/
        await page.waitForURL("**/play/", { timeout: 5000 });
        expect(page.url()).toContain("/play/");
      });
    });
  }
});
