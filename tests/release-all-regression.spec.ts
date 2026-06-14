import { test, expect } from "@playwright/test";

test.describe("releaseAll regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/play/cannonball-clash/", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(
      () => !!(window as any).PirateArcadeInput,
      null,
      { timeout: 10000 },
    );
  });

  test("clears held keys", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).PirateArcadeInput.keyDown("Enter");
    });
    expect(
      await page.evaluate(
        () => (window as any).PirateArcadeInput.getState().heldCount,
      ),
    ).toBe(1);

    await page.evaluate(() => {
      (window as any).PirateArcadeInput.releaseAll("test");
    });
    expect(
      await page.evaluate(
        () => (window as any).PirateArcadeInput.getState().heldCount,
      ),
    ).toBe(0);
  });

  test("records reason and increments count", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).PirateArcadeInput.releaseAll("blur");
    });
    let state = await page.evaluate(() =>
      (window as any).PirateArcadeInput.getState(),
    );
    expect(state.releaseReason).toBe("blur");
    expect(state.releaseCount).toBeGreaterThanOrEqual(1);

    await page.evaluate(() => {
      (window as any).PirateArcadeInput.releaseAll("visibility");
    });
    state = await page.evaluate(() =>
      (window as any).PirateArcadeInput.getState(),
    );
    expect(state.releaseReason).toBe("visibility");
    expect(state.releaseCount).toBeGreaterThanOrEqual(2);
  });

  test("emits keyUp via bridge for held keys", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).PirateArcadeInput.keyDown("ArrowUp");
      (window as any).PirateArcadeInput.keyDown("ArrowDown");
    });

    await page.evaluate(() => {
      (window as any).PirateArcadeInput.releaseAll("test");
    });

    const ups = await page.evaluate(() => {
      return (
        (window as any).__paInputDebug?.bridgeCalls?.filter(
          (c: any) => !c.down,
        ) || []
      );
    });
    const releasedKeys = ups.map((c: any) => c.key);
    expect(releasedKeys).toContain("ArrowUp");
    expect(releasedKeys).toContain("ArrowDown");
  });

  test("does not destroy debug logs", async ({ page }) => {
    // Tap a key to generate debug entries
    await page.evaluate(() => {
      (window as any).PirateArcadeInput.keyDown("Enter");
    });

    const eventCountBefore = await page.evaluate(
      () => (window as any).__paInputDebug?.events?.length || 0,
    );
    expect(eventCountBefore).toBeGreaterThan(0);

    await page.evaluate(() => {
      (window as any).PirateArcadeInput.releaseAll("test");
    });

    const eventCountAfter = await page.evaluate(
      () => (window as any).__paInputDebug?.events?.length || 0,
    );
    // Debug events should survive — releaseAll adds at least 1 event
    expect(eventCountAfter).toBeGreaterThanOrEqual(eventCountBefore);
  });

  test("safe when no keys held", async ({ page }) => {
    // Ensure no keys are held
    await page.evaluate(() => {
      (window as any).PirateArcadeInput.releaseAll("test");
    });

    const errored: string | null = await page.evaluate(() => {
      try {
        (window as any).PirateArcadeInput.releaseAll("test");
        return null;
      } catch (e: any) {
        return e.message;
      }
    });
    expect(errored).toBeNull();
  });

  test("blur event triggers mobileReleaseAll which calls releaseAll", async ({
    page,
  }, testInfo) => {
    // This test verifies mobile-controls.js lifecycle wiring, which only
    // activates on devices with a coarse pointer or touch support (desktop
    // Chromium has neither). Skip on non-touch projects.
    test.skip(
      !testInfo.project.name.includes("mobile") &&
        !testInfo.project.name.includes("ipad"),
      "mobile-controls only wires on touch devices",
    );

    await page.evaluate(() => {
      (window as any).PirateArcadeInput.keyDown("Enter");
    });
    expect(
      await page.evaluate(
        () => (window as any).PirateArcadeInput.getState().heldCount,
      ),
    ).toBe(1);

    await page.evaluate(() => {
      window.dispatchEvent(new Event("blur"));
    });
    await page.waitForTimeout(50);

    const state = await page.evaluate(() =>
      (window as any).PirateArcadeInput.getState(),
    );
    expect(state.heldCount).toBe(0);
    expect(state.releaseReason).toBe("blur");
  });
});
