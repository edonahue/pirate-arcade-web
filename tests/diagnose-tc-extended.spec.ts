import { test, expect } from "@playwright/test";
import { waitForPygbagRuntime } from "./helpers/browserGame";

test("diagnose TC boot extended", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      errors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));

  await page.goto("/play/treasure-cove/", { waitUntil: "domcontentloaded" });

  // Check initial states
  const infobox = await page.locator("#infobox").textContent();
  console.log("Initial infobox:", infobox);

  const loading = await page.locator("#game-loading").isVisible();
  console.log("Loading overlay visible (initial):", loading);

  // Wait for runtime
  try {
    await waitForPygbagRuntime(page);
    console.log("waitForPygbagRuntime completed");
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.log("waitForPygbagRuntime error:", e.message);
    } else {
      console.log("waitForPygbagRuntime error:", String(e));
    }
  }

  // Check states after runtime
  const infobox2 = await page.locator("#infobox").textContent();
  console.log("Infobox after runtime:", infobox2);

  const loading2 = await page.locator("#game-loading").isVisible();
  console.log("Loading overlay visible (after runtime):", loading2);

  const canvas = await page.locator("canvas#canvas").boundingBox();
  console.log("Canvas size:", canvas);

  // Check infobox visibility and styling
  const infoboxStyles = await page.locator("#infobox").evaluate((el) => {
    return {
      display: getComputedStyle(el).display,
      visibility: getComputedStyle(el).visibility,
      opacity: getComputedStyle(el).opacity,
      hidden: el.hasAttribute("hidden"),
    };
  });
  console.log("Infobox styles:", infoboxStyles);

  // Check loading overlay styling
  const loadingStyles = await page.locator("#game-loading").evaluate((el) => {
    return {
      display: getComputedStyle(el).display,
      visibility: getComputedStyle(el).visibility,
      opacity: getComputedStyle(el).opacity,
      className: el.className,
    };
  });
  console.log("Loading overlay styles:", loadingStyles);

  // Check console errors
  console.log("Console errors:", errors);
});
