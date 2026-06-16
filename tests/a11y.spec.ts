import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

interface GameSpec {
  id: string;
  name: string;
  path: string;
  desktopKeys: string[];
  pygbag: boolean;
}

const GAMES: GameSpec[] = [
  {
    id: "cannonball-clash",
    name: "Cannonball Clash",
    path: "/play/cannonball-clash/",
    desktopKeys: ["ArrowUp", "ArrowDown", "Space", "Enter", "Escape"],
    pygbag: true,
  },
  {
    id: "treasure-cove",
    name: "Treasure Cove",
    path: "/play/treasure-cove/",
    desktopKeys: ["ArrowLeft", "ArrowRight", "Space", "Enter", "Escape"],
    pygbag: true,
  },
  {
    id: "krakens-wake",
    name: "Kraken's Wake",
    path: "/play/krakens-wake/",
    desktopKeys: [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "Space",
      "Enter",
      "Escape",
    ],
    pygbag: true,
  },
  {
    id: "race-to-treasure-island",
    name: "Race to Treasure Island",
    path: "/play/race-to-treasure-island/",
    desktopKeys: ["ArrowLeft", "ArrowRight", "Shift", "Space", "Escape"],
    pygbag: false,
  },
];

const STATIC_PAGES = ["/", "/play/", "/about/", "/source/", "/credits/"];

async function runA11yScan(page: Page, testName: string) {
  const results = await new AxeBuilder({ page })
    .exclude("canvas")
    .exclude("#pyconsole")
    .disableRules(["color-contrast", "meta-viewport", "region"])
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

    if (game.pygbag) {
      test("DOM after Pygbag runtime starts has no critical blockers", async ({
        page,
      }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });

        await page.waitForFunction(
          () => document.getElementById("transfer")?.hidden === true,
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

        await page
          .locator("canvas#canvas")
          .click({ position: { x: 10, y: 10 } });
        await page.locator("canvas#canvas").focus();
        for (const key of game.desktopKeys) {
          await page.keyboard.press(key);
          await page.waitForTimeout(50);
        }
        await page.waitForTimeout(500);

        await runA11yScan(page, `${game.name} during gameplay`);
      });
    }
  });
}

for (const pagePath of STATIC_PAGES) {
  test.describe(`${pagePath} static page accessibility`, () => {
    test("has no critical a11y violations", async ({ page }) => {
      await page.goto(pagePath, { waitUntil: "domcontentloaded" });
      const results = await new AxeBuilder({ page })
        .disableRules(["color-contrast"])
        .analyze();
      const critical = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      if (critical.length > 0) {
        throw new Error(
          `Critical a11y issues on ${pagePath}:\n${JSON.stringify(critical, null, 2)}`,
        );
      }
      expect(critical).toEqual([]);
    });
  });
}

test.describe("Game detail page accessibility", () => {
  const detailPaths = [
    "/games/cannonball-clash/",
    "/games/treasure-cove/",
    "/games/krakens-wake/",
    "/games/race-to-treasure-island/",
    "/games/port-royale-tycoon/",
  ];

  for (const path of detailPaths) {
    test(`${path} has no critical a11y violations`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const results = await new AxeBuilder({ page })
        .disableRules(["color-contrast"])
        .analyze();
      const critical = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      if (critical.length > 0) {
        throw new Error(
          `Critical a11y issues on ${path}:\n${JSON.stringify(critical, null, 2)}`,
        );
      }
      expect(critical).toEqual([]);
    });
  }
});

test.describe("Keyboard navigation smoke", () => {
  test("homepage tab sequence focuses visible elements", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const focusable = page.locator(
      'a, button, [tabindex]:not([tabindex="-1"])',
    );
    await expect(focusable.first()).toBeVisible();

    // Tab through first 10 focusable elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(100);

      const active = page.locator(":focus");
      const count = await active.count();
      expect(count).toBeGreaterThanOrEqual(1);

      const visible = await active.first().isVisible();
      expect(visible).toBe(true);
    }
  });

  test("/play/ tab sequence does not trap focus", async ({ page }) => {
    await page.goto("/play/", { waitUntil: "domcontentloaded" });

    // Tab through first 20 focusable elements to check for focus trap
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(50);

      const active = page.locator(":focus");
      const count = await active.count();
      expect(count).toBeGreaterThanOrEqual(1);

      const tagName = await active.first().evaluate((el) => el.tagName);
      // Should always be a focusable element, never the body
      expect(tagName.toLowerCase()).not.toBe("body");
    }
  });
});
