import { test, expect } from "./helpers/browserGame";

test.describe("Mobile Navigation Controls", () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 12/13 Pro size

  test("Back to Arcade link works on Cannonball Clash", async ({ page }) => {
    await page.goto("/play/cannonball-clash/");
    await page.waitForSelector("#canvas", { state: "attached" });

    // Wait for initial loading to complete
    await page.waitForFunction(
      () => !document.querySelector("#game-loading:not(.hidden)"),
    );

    // Get Back link bounding box
    const backLink = page.locator("#back-link");
    await expect(backLink).toBeVisible();

    const box = await backLink.boundingBox();
    expect(box).toBeTruthy();

    if (!box) return;

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Verify Back link is topmost element at its center
    const topElementInfo = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return { id: "", className: "", tagName: "" };

        return {
          id: el.id || "",
          className: el.className || "",
          tagName: el.tagName || "",
          closestBackLink: !!el.closest("#back-link"),
          closestTouchOverlay: !!el.closest(".touch-overlay"),
          closestDragZone: !!el.closest(".touch-drag-zone"),
        };
      },
      { x: centerX, y: centerY },
    );

    expect(topElementInfo.closestBackLink).toBe(true);
    expect(topElementInfo.closestTouchOverlay).toBe(false);
    expect(topElementInfo.closestDragZone).toBe(false);

    // Tap the Back link
    await backLink.click();

    // Should navigate to arcade page
    await expect(page).toHaveURL(/\/play\/?$/);
    await expect(page.locator("text=Cannonball Clash")).toBeVisible();
    await expect(page.locator("text=Treasure Cove")).toBeVisible();
  });

  test("Back to Arcade link works on Treasure Cove", async ({ page }) => {
    await page.goto("/play/treasure-cove/");
    await page.waitForSelector("#canvas", { state: "attached" });

    // Wait for initial loading to complete
    await page.waitForFunction(
      () => !document.querySelector("#game-loading:not(.hidden)"),
    );

    // Get Back link bounding box
    const backLink = page.locator("#back-link");
    await expect(backLink).toBeVisible();

    const box = await backLink.boundingBox();
    expect(box).toBeTruthy();

    if (!box) return;

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Verify Back link is topmost element at its center
    const topElementInfo = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return { id: "", className: "", tagName: "" };

        return {
          id: el.id || "",
          className: el.className || "",
          tagName: el.tagName || "",
          closestBackLink: !!el.closest("#back-link"),
          closestTouchOverlay: !!el.closest(".touch-overlay"),
          closestDragZone: !!el.closest(".touch-drag-zone"),
        };
      },
      { x: centerX, y: centerY },
    );

    expect(topElementInfo.closestBackLink).toBe(true);
    expect(topElementInfo.closestTouchOverlay).toBe(false);
    expect(topElementInfo.closestDragZone).toBe(false);

    // Tap the Back link
    await backLink.click();

    // Should navigate to arcade page
    await expect(page).toHaveURL(/\/play\/?$/);
    await expect(page.locator("text=Cannonball Clash")).toBeVisible();
    await expect(page.locator("text=Treasure Cove")).toBeVisible();
  });
});
