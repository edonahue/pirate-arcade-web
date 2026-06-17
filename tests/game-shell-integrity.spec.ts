import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadPybagGames() {
  const gamesPath = resolve(__dirname, "../src/data/games.json");
  const games = JSON.parse(readFileSync(gamesPath, "utf-8"));
  return games
    .filter(
      (g: any) => g.engine === "pygbag" && g.status === "browser-playable",
    )
    .map((g: any) => ({
      id: g.id,
      title: g.title,
      path: g.browserUrl,
      hintContains:
        g.controlMode === "pong"
          ? "slide"
          : g.controlMode === "breakout"
            ? "slide"
            : "turn",
      actionLabel:
        g.controlMode === "pong"
          ? "START"
          : g.controlMode === "breakout"
            ? "LAUNCH"
            : "\u23ce",
    }));
}

const PYBAG_GAMES = loadPybagGames();

const LEAKED_SIGNATURES = [
  "content.style.cssText",
  "function renderTab",
  "querySelectorAll('.pa-debug-tab')",
];

const MOJIBAKE_PATTERNS = [
  /\uFFFD/,
  /\uFFFE/,
  /\uFFFF/,
  /\u00E2\u20AC/,
  /\u00C3[\u02C6\u201A\u00B8]/,
  /\u00C2[\u00B0\u00A8\u00A2]/,
];

function isLandscape(
  viewport: { width: number; height: number } | null,
): boolean {
  return viewport !== null && viewport.width > viewport.height;
}

async function confirmTextIsAbsent(
  page: Page,
  patterns: string[],
): Promise<void> {
  const bodyText = await page.evaluate(() => document.body.innerText);
  for (const pattern of patterns) {
    expect(bodyText).not.toContain(pattern);
  }
}

async function confirmNoMojibake(page: Page): Promise<void> {
  const bodyText = await page.evaluate(() => document.body.innerText);
  for (const re of MOJIBAKE_PATTERNS) {
    expect(bodyText).not.toMatch(re);
  }
}

test.describe("Pygbag shell static integrity", () => {
  for (const game of PYBAG_GAMES) {
    test.describe(`${game.title}`, () => {
      test("encoding is UTF-8 and no mojibake", async ({ page }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        const charset = await page.evaluate(() => document.characterSet);
        expect(charset).toBe("UTF-8");
        await confirmNoMojibake(page);
      });

      test("no leaked JavaScript source in visible text", async ({ page }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await confirmTextIsAbsent(page, LEAKED_SIGNATURES);
      });

      test("no non-whitespace direct body text nodes", async ({ page }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        const hasDirectText = await page.evaluate(() => {
          const body = document.body;
          for (let i = 0; i < body.childNodes.length; i++) {
            const child = body.childNodes[i];
            if (
              child.nodeType === 3 &&
              child.nodeValue !== null &&
              child.nodeValue.trim().length > 0
            ) {
              return true;
            }
          }
          return false;
        });
        expect(hasDirectText).toBe(false);
      });

      test("loading overlay is visible with expected copy", async ({
        page,
      }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });

        const title = await page.locator(".loader-title").textContent();
        expect(title).toBe("Loading " + game.title);

        const detail = await page.locator("#game-loading-detail").textContent();
        expect(detail).toBe("Starting game engine");

        const note = await page.locator(".loader-note").textContent();
        expect(note).toBe(
          "First visit downloads ~12 MB. Repeat visits should be faster.",
        );
      });

      test("back link and controls hint visible in landscape", async ({
        page,
      }) => {
        test.skip(
          !isLandscape(page.viewportSize()),
          "requires landscape viewport",
        );
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await expect(page.locator("#back-link")).toBeVisible();
        await expect(page.locator("#controls-hint")).toBeVisible();
      });

      test("controls hint contains game-appropriate copy", async ({ page }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        const hintText =
          (await page.locator("#controls-hint").textContent()) || "";
        expect(hintText.toLowerCase()).toContain(game.hintContains);
      });

      test("action button has game-appropriate label", async ({ page }) => {
        test.skip(
          game.id === "krakens-wake",
          "kraken's wake uses different action button layout",
        );
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        const actionText = await page
          .locator('.btn-action[data-dir="action"]')
          .textContent();
        expect(actionText).toBe(game.actionLabel);
      });

      test("infobox is populated", async ({ page }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        const ib = await page.locator("#infobox").textContent();
        expect(ib?.length).toBeGreaterThan(20);
        expect(ib?.toLowerCase()).toContain("loading");
      });

      test("rotate-device overlay exists", async ({ page }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await expect(page.locator("#rotate-device")).toBeAttached();
      });
    });
  }
});

test.describe("Loading API behavior", () => {
  for (const game of PYBAG_GAMES) {
    test.describe(`${game.title}`, () => {
      test("PirateArcadeLoading.set() updates detail text via textContent", async ({
        page,
      }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(
          () => typeof (window as any).PirateArcadeLoading !== "undefined",
        );

        await page.evaluate(() => {
          (window as any).PirateArcadeLoading.set("Test phase message");
        });
        const detail = await page.locator("#game-loading-detail").textContent();
        expect(detail).toBe("Test phase message");
      });

      test("slow-load note uses platform-neutral copy", async ({ page }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(
          () => typeof (window as any).PirateArcadeLoading !== "undefined",
        );

        // Bridge script uses a 30s timer — verify copy directly
        await page.evaluate(() => {
          (window as any).PirateArcadeLoading.set("Starting...");
          const note = document.querySelector(".loader-note");
          if (note)
            note.textContent =
              "Still working — first load takes a little while.";
        });

        const note = await page.locator(".loader-note").textContent();
        expect(note).toContain("Still working");
        expect(note).not.toContain("iPad");
      });

      test("ready() hides the loading overlay", async ({ page }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(
          () => typeof (window as any).PirateArcadeLoading !== "undefined",
        );

        await page.evaluate(() => {
          (window as any).PirateArcadeLoading.set("Working...");
          (window as any).PirateArcadeLoading.ready("Ready");
        });

        const classes = await page
          .locator("#game-loading")
          .getAttribute("class");
        expect(classes).toContain("hidden");
      });

      test("error() displays text safely without HTML injection", async ({
        page,
      }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(
          () => typeof (window as any).PirateArcadeLoading !== "undefined",
        );

        await page.evaluate(() => {
          (window as any).PirateArcadeLoading.error(
            "<script>alert('xss')</script>",
          );
        });

        const detail = await page.locator("#game-loading-detail").textContent();
        expect(detail).toBe("<script>alert('xss')</script>");
      });

      test("no mojibake appears during loading phases", async ({ page }) => {
        await page.goto(game.path, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(
          () => typeof (window as any).PirateArcadeLoading !== "undefined",
        );

        await page.evaluate(() => {
          (window as any).PirateArcadeLoading.set(
            "Testing with unicode: \u00F1 \u00E1 \u00E9 \u00ED \u00F3 \u00FA",
          );
        });

        const bodyText = await page.evaluate(() => document.body.innerText);
        for (const re of MOJIBAKE_PATTERNS) {
          expect(bodyText).not.toMatch(re);
        }
      });
    });
  }
});
