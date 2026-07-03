import { test, expect } from "@playwright/test";
import { waitForPygbagRuntime } from "./helpers/browserGame";

test("diagnose TC boot", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      errors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));

  await page.goto("/play/treasure-cove/", { waitUntil: "domcontentloaded" });

  // Check initial infobox
  const infobox = await page.locator("#infobox").textContent();
  console.log("Initial infobox:", infobox);

  const loading = await page.locator("#game-loading").isVisible();
  console.log("Loading overlay visible:", loading);

  // Wait a bit and check infobox again
  await page.waitForTimeout(5000);
  const infobox2 = await page.locator("#infobox").textContent();
  console.log("Infobox after 5s:", infobox2);

  const canvas = await page.locator("canvas#canvas").boundingBox();
  console.log("Canvas size:", canvas);

  // Check console errors
  console.log("Console errors:", errors);
});
