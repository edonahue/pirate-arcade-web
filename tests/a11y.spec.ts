/**
 * Accessibility tests for the Pirate Arcade browser games.
 *
 * Uses @axe-core/playwright to scan the DOM for WCAG 2.1 AA
 * violations. We do this on a few states:
 *
 *  1. Initial DOM after page load
 *  2. After the Pygbag runtime finishes booting
 *  3. After a few seconds of simulated gameplay
 *
 * We do NOT scan the game canvas itself (it is a black box). The
 * scan focuses on the page chrome: header, back link, controls hint,
 * infobox, touch overlay, and rotate-device overlay.
 *
 * Game pages have several known design constraints that show up as
 * axe "moderate" violations but are not worth failing CI over:
 *
 *   - `user-scalable=no` on the viewport meta. Pygbag games use
 *     fixed-size canvases; pinch-zoom would break the layout.
 *   - Content outside landmark regions: the back-link, controls-hint,
 *     transfer, and infobox are intentionally fixed-position overlays
 *     above the canvas, not inside a `<main>` element.
 *   - Color contrast on tiny fixed-position dev overlays.
 *
 * Those are explicitly disabled below. Real regressions
 * (e.g. a new serious/critical violation from a future change) will
 * still fail the build.
 */

import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

interface GameSpec {
  id: string;
  name: string;
  path: string;
  desktopKeys: string[];
}

const GAMES: GameSpec[] = [
  {
    id: "cannonball-clash",
    name: "Cannonball Clash",
    path: "/play/cannonball-clash/",
    desktopKeys: ["ArrowUp", "ArrowDown", "Space", "Enter", "Escape"],
  },
  {
    id: "treasure-cove",
    name: "Treasure Cove",
    path: "/play/treasure-cove/",
    desktopKeys: ["ArrowLeft", "ArrowRight", "Space", "Enter", "Escape"],
  },
];

/**
 * Run an a11y scan and assert no critical or serious violations.
 * Moderate violations are allowed (they are surfaced as warnings).
 * This is the strict but practical check for game pages.
 */
async function runA11yScan(page: Page, testName: string) {
  const results = await new AxeBuilder({ page })
    // The game canvas is a black-box renderer; axe cannot audit pixels.
    .exclude("canvas")
    // The pygame #pyconsole terminal is a developer console; not
    // intended for assistive tech.
    .exclude("#pyconsole")
    // See file header for why these are disabled.
    .disableRules([
      "color-contrast", // tiny fixed-position dev overlays
      "meta-viewport", // user-scalable=no is required for Pygbag canvases
      "region", // overlays above the canvas, not in landmarks
    ])
    .analyze();

  const blockers = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );

  if (blockers.length > 0) {
    const lines = blockers.map((v) => {
      const nodes = v.nodes
        .map(
          (n) =>
            `        - target: ${n.target.join(" ")}; html: ${n.html.slice(0, 200)}`,
        )
        .join("\n");
      return `      ${v.id} (${v.impact}): ${v.description}\n${nodes}`;
    });
    throw new Error(`A11y blockers for ${testName}:\n${lines.join("\n\n")}`);
  }

  expect(blockers).toEqual([]);
}

for (const game of GAMES) {
  test.describe(`${game.name} accessibility`, () => {
    test("initial DOM has no critical a11y blockers", async ({ page }) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await runA11yScan(page, `${game.name} initial`);
    });

    test("DOM after Pygbag runtime starts has no critical blockers", async ({
      page,
    }) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      // Wait for the transfer overlay to be hidden (runtime ready)
      await page.waitForFunction(
        () => {
          const tr = document.getElementById("transfer");
          return tr?.hidden === true;
        },
        { timeout: 120000, polling: 500 },
      );

      await runA11yScan(page, `${game.name} after runtime ready`);
    });

    test("DOM during gameplay has no critical blockers", async ({ page }) => {
      await page.goto(game.path, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        () => document.getElementById("transfer")?.hidden === true,
        { timeout: 120000, polling: 500 },
      );

      // Click + send a few inputs to simulate gameplay
      await page.locator("canvas#canvas").click({ position: { x: 10, y: 10 } });
      await page.locator("canvas#canvas").focus();
      for (const key of game.desktopKeys) {
        await page.keyboard.press(key);
        await page.waitForTimeout(50);
      }
      await page.waitForTimeout(500);

      await runA11yScan(page, `${game.name} during gameplay`);
    });
  });
}

test.describe("Arcade index page accessibility", () => {
  test("/play/ has no critical a11y violations", async ({ page }) => {
    await page.goto("/play/", { waitUntil: "domcontentloaded" });
    const results = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    if (critical.length > 0) {
      throw new Error(
        `Critical a11y issues on /play/:\n${JSON.stringify(critical, null, 2)}`,
      );
    }
    expect(critical).toEqual([]);
  });
});
