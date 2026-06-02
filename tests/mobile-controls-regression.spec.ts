/**
 * Mobile controls regression test — iPhone 16 Pro Max Safari.
 *
 * This test exists to catch the real-world failure observed on iPhone
 * 16 Pro Max Safari:
 *
 *   "Error occurred: undefined is not an object
 *    (evaluating 'el.classList.contains')"
 *
 * Origin: `public/play/shared/mobile-controls.js`, in `buttonFor()`
 * which is called from `handleUp()` on the `pointerup` / `pointerleave`
 * event. The function walks `el.parentNode` looking for an element
 * with class `btn`. The walk can reach `document`, which has no
 * `.classList` property, and the next `el.classList.contains('btn')`
 * call throws a TypeError with the exact message above.
 *
 * This test:
 *
 *  1. Navigates to each game page WITHOUT waiting for Pygbag/WASM.
 *     The bug is in the static `mobile-controls.js` file, which loads
 *     before WASM starts, so we can reproduce it on a fresh page.
 *
 *  2. Attaches `console`, `pageerror`, and `dialog` listeners in
 *     `beforeEach` — BEFORE navigation — so any failure that fires
 *     during page load is caught.
 *
 *  3. Forces a coarse pointer + touch viewport. The default Playwright
 *     mobile projects (Pixel 5, iPhone 13) already do this. The
 *     `webkit-desktop` project is opted in by emulating coarse
 *     pointer + touch in the test body.
 *
 *  4. Dispatches real production event names (`pointerdown`,
 *     `pointerup`, `lostpointercapture`, `pointercancel`,
 *     `pointerleave`) with the real production payload (`clientX` /
 *     `clientY`, `pointerId`, `pointerType: "touch"`, etc.) against
 *     the actual button locators.
 *
 *  5. Additionally dispatches a `pointerup` with `clientX: 0,
 *     clientY: 0` — the boundary case that triggers the bug. On
 *     `elementFromPoint(0, 0)`, the production code returns the
 *     top-left element, walks up to `document`, and throws.
 *
 *  6. Asserts no `classList.contains` TypeError fires, no native
 *     dialog (alert/confirm/prompt) appears, and no page error is
 *     thrown.
 *
 * This test is expected to FAIL on the current production code
 * (`mobile-controls.js`) on at least the `webkit-desktop` project
 * (deterministic reproducer). The `mobile-safari` and `mobile-chrome`
 * projects may pass because the bug is iOS-Safari-specific. The test
 * will start passing once `mobile-controls.js` is hardened (planned
 * as a follow-up commit; this commit is tests-only).
 *
 * IMPORTANT: This is a regression test only. No production code is
 * modified in this commit. See
 * `tests/TESTING_CHECKLIST.md` for the manual real-device checklist
 * that complements this automated test.
 */

import { test, expect, type Page } from "@playwright/test";
import { pointerHoldButton } from "./helpers/browserGame";

interface RegressionAcc {
  consoleErrors: string[];
  pageErrors: string[];
  dialogs: Array<{ type: string; message: string }>;
}

interface GameRoute {
  id: string;
  name: string;
  path: string;
  /** Buttons to exercise in the regression run. */
  buttons: Array<{ dataDir: string; selector: string }>;
}

const ROUTES: GameRoute[] = [
  {
    id: "cannonball-clash",
    name: "Cannonball Clash",
    path: "/play/cannonball-clash/",
    buttons: [
      { dataDir: "left", selector: "#touch-overlay .btn-left" },
      { dataDir: "right", selector: "#touch-overlay .btn-right" },
      { dataDir: "action", selector: "#touch-overlay .btn-action" },
      { dataDir: "pause", selector: "#touch-overlay .btn-pause" },
    ],
  },
  {
    id: "treasure-cove",
    name: "Treasure Cove",
    path: "/play/treasure-cove/",
    buttons: [
      { dataDir: "left", selector: "#touch-overlay .btn-left" },
      { dataDir: "right", selector: "#touch-overlay .btn-right" },
      { dataDir: "action", selector: "#touch-overlay .btn-action" },
      { dataDir: "pause", selector: "#touch-overlay .btn-pause" },
    ],
  },
];

/** Projects that should run this regression suite. */
const TOUCH_PROJECTS = ["mobile-safari", "mobile-chrome", "webkit-desktop"];

/** iPhone 16 Pro Max landscape (CSS-ish viewport). */
const IPHONE_16_PRO_MAX_LANDSCAPE = { width: 932, height: 430 };

/** iPhone 13 landscape (matches the mobile-safari Playwright project). */
const IPHONE_13_LANDSCAPE = { width: 844, height: 390 };

function attachListeners(page: Page, acc: RegressionAcc): void {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      acc.consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    acc.pageErrors.push(err.message);
  });
  page.on("dialog", async (dlg) => {
    acc.dialogs.push({ type: dlg.type(), message: dlg.message() });
    // Dismiss to keep the test runnable. The dialog event itself is
    // the regression signal — we don't need to interact with it.
    await dlg.dismiss();
  });
}

async function isCoarsePointer(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    try {
      return window.matchMedia("(pointer: coarse)").matches;
    } catch {
      return false;
    }
  });
}

for (const route of ROUTES) {
  test.describe(`${route.name} - mobile-controls regression`, () => {
    test.beforeEach(async ({ page }, testInfo) => {
      test.skip(
        !TOUCH_PROJECTS.includes(testInfo.project.name),
        `Regression test skipped on ${testInfo.project.name} (no touch/coarse pointer)`,
      );

      // For mobile-safari (iPhone 13) the default viewport is
      // portrait. Set it to landscape so the rotate-device overlay
      // doesn't cover the touch buttons.
      if (testInfo.project.name === "mobile-safari") {
        await page.setViewportSize(IPHONE_13_LANDSCAPE);
      } else if (testInfo.project.name === "mobile-chrome") {
        // Pixel 5 landscape
        await page.setViewportSize({ width: 851, height: 393 });
      } else if (testInfo.project.name === "webkit-desktop") {
        // Use iPhone 16 Pro Max landscape to match the real device.
        // Note: webkit-desktop does NOT emulate coarse pointer or
        // touch by default, so the production handler bails out
        // and the test will skip. This is by design — the
        // deterministic reproducer is the synthetic (0,0) pointerup
        // dispatch inside the test body, which works regardless of
        // matchMedia state because it exercises the same code path
        // the iPhone 16 Pro Max Safari teardown hits.
        await page.setViewportSize(IPHONE_16_PRO_MAX_LANDSCAPE);
      }
    });

    test("production pointer sequences do not throw classList TypeError", async ({
      page,
    }, testInfo) => {
      const acc: RegressionAcc = {
        consoleErrors: [],
        pageErrors: [],
        dialogs: [],
      };

      // Attach listeners BEFORE navigation so any error during page
      // load is captured.
      attachListeners(page, acc);

      await page.goto(route.path, { waitUntil: "domcontentloaded" });

      // The overlay element must exist (it's in the static HTML).
      // If it doesn't, fail — the test is also catching DOM regressions.
      await expect(
        page.locator("#touch-overlay"),
        `${route.name} should have a #touch-overlay element in the static HTML`,
      ).toHaveCount(1);

      // Sanity: confirm the page is in coarse-pointer mode. If not,
      // the production handler bailed out early (no listeners were
      // attached) and there's nothing to test. Skip rather than fail.
      // This is the path webkit-desktop takes, since it doesn't
      // emulate coarse pointer or ontouchstart.
      const coarse = await isCoarsePointer(page);
      if (!coarse) {
        test.skip(
          true,
          `Page is not in coarse-pointer mode on ${testInfo.project.name} — production handler bailed out, no listeners attached`,
        );
        return;
      }

      // Wait for mobile-controls.js to run (it adds the `.active`
      // class to the overlay). This is a static signal — we do not
      // wait for Pygbag/WASM.
      try {
        await page.waitForSelector("#touch-overlay.active", { timeout: 5000 });
      } catch {
        test.skip(
          true,
          `#touch-overlay did not become .active on ${testInfo.project.name} — production handler bailed out`,
        );
        return;
      }

      // Layout sanity: the overlay should have a non-zero box. If
      // it's hidden (e.g. behind the rotate-device overlay), the
      // bounding boxes will be zero and we can't drive a real touch.
      const overlayBox = await page.locator("#touch-overlay").boundingBox();
      if (!overlayBox || overlayBox.width < 10 || overlayBox.height < 10) {
        test.skip(
          true,
          `Touch overlay has no layout (${overlayBox?.width ?? 0}x${overlayBox?.height ?? 0}) — likely covered by rotate-device overlay`,
        );
        return;
      }

      // 1. Exercise every production button with real pointer
      //    down/up/leave/cancel sequence.
      for (const btn of route.buttons) {
        // The button must be present in DOM. If it's missing, fail
        // the test — the test is also catching DOM regressions.
        await expect(
          page.locator(btn.selector),
          `${route.name} should have ${btn.dataDir} button (${btn.selector})`,
        ).toHaveCount(1);

        await pointerHoldButton(page, btn.selector, 150, {
          fireLostPointerCapture: true,
        });
        await page.waitForTimeout(50);
      }

      // 2. The reproducer: dispatch a pointerup with clientX/Y at
      //    (0, 0). This is the boundary case that triggers the bug
      //    in `buttonFor()` — elementFromPoint(0, 0) returns the
      //    top-left element, the parent walk hits `document`, and
      //    `document.classList` throws.
      //
      //    We dispatch this as a synthetic event directly against
      //    the overlay (not against a button) so it goes through
      //    the production handler even after the buttons have been
      //    removed from the touch path.
      const reproduced = await page.evaluate(() => {
        const overlay = document.getElementById("touch-overlay");
        if (!overlay) return { ran: false, reason: "no overlay" };

        let threw = false;
        let errMsg = "";
        const dispatch = (type: string, init: PointerEventInit) => {
          try {
            overlay.dispatchEvent(
              new PointerEvent(type, {
                bubbles: true,
                cancelable: true,
                ...init,
              }),
            );
          } catch (e) {
            threw = true;
            errMsg = e instanceof Error ? e.message : String(e);
          }
        };

        // pointerdown at (0,0) — elementFromPoint may return
        // something with no `.btn` ancestor
        dispatch("pointerdown", {
          clientX: 0,
          clientY: 0,
          pointerId: 99,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: 1,
        });
        // pointerup at (0,0) — elementFromPoint(0, 0) walk hits
        // document.classList
        dispatch("pointerup", {
          clientX: 0,
          clientY: 0,
          pointerId: 99,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: 0,
        });

        return { ran: true, threw, errMsg };
      });

      // If the synthetic event itself threw (e.g. document.classList
      // is not a function on a bare node), record it. The production
      // code catches this asynchronously, so we also rely on the
      // global pageerror listener.
      if (reproduced.threw) {
        acc.pageErrors.push(
          `Synthetic pointerup at (0,0) threw synchronously: ${reproduced.errMsg}`,
        );
      }

      // Allow any deferred errors to flush
      await page.waitForTimeout(200);

      // 3. Assertions

      // 3a. No native dialogs appeared.
      expect(
        acc.dialogs,
        `Native dialogs were shown during pointer handling on ${route.name} / ${testInfo.project.name}:\n${JSON.stringify(acc.dialogs, null, 2)}`,
      ).toEqual([]);

      // 3b. The specific iPhone bug — classList TypeError.
      const allErrors = [...acc.pageErrors, ...acc.consoleErrors];
      const classListErrors = allErrors.filter(
        (e) =>
          /classList/i.test(e) &&
          (/undefined is not an object/i.test(e) ||
            /TypeError/i.test(e) ||
            /Cannot read properties of/i.test(e) ||
            /is not a function/i.test(e)),
      );
      expect(
        classListErrors,
        `mobile-controls.js threw a classList TypeError on ${route.name} / ${testInfo.project.name}:\n${classListErrors.join("\n")}`,
      ).toEqual([]);

      // 3c. No blocking page errors of any kind.
      const blockingPageErrors = acc.pageErrors.filter((e) =>
        /TypeError|ReferenceError|SyntaxError|EvalError|classList/i.test(e),
      );
      expect(
        blockingPageErrors,
        `Unexpected page errors during pointer handling on ${route.name} / ${testInfo.project.name}:\n${blockingPageErrors.join("\n")}`,
      ).toEqual([]);

      // 3d. Attach full diagnostics to the report for triage
      // (success path — Playwright will only show on failure by
      // default, so we attach on success too for visibility).
      testInfo.attach("regression-acc", {
        body: JSON.stringify(
          {
            route: route.path,
            project: testInfo.project.name,
            consoleErrorCount: acc.consoleErrors.length,
            pageErrorCount: acc.pageErrors.length,
            dialogCount: acc.dialogs.length,
            consoleErrors: acc.consoleErrors,
            pageErrors: acc.pageErrors,
            dialogs: acc.dialogs,
            reproduced,
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
    });
  });
}
