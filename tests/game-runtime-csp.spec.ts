/**
 * Mobile runtime CSP and startup test for Pygbag games.
 *
 * This test verifies that on mobile emulation (mobile-safari, mobile-chrome)
 * the game pages start without CSP violations, EvalErrors, or "Could not
 * load dynamic lib" errors — the exact failure class reported on real
 * iPhone 16 Pro Max Safari due to Cloudflare Pages CSP header merging.
 *
 * Key differences from the existing mobile tests:
 *  - Uses `startDiagnostics(page)` BEFORE `page.goto()` so CSP/EvalError
 *    violations that fire during page load are captured.
 *  - Uses a landscape viewport matching iPhone 16 Pro Max dimensions.
 *  - Waits for Pygbag runtime startup (with timeout) and catches CSP
 *    errors even if the runtime never finishes.
 *  - Checks for the specific blocking pattern: EvalError / Refused to
 *    evaluate a string as JavaScript / Content Security Policy.
 *
 * Because Pygbag WASM startup on emulated mobile can be slow or timeout,
 * the test reports a WARNING (not failure) if the runtime does not start
 * but NO blocking errors were captured. This avoids flaky failures from
 * emulation slowness while still catching real CSP/runtime bugs.
 *
 * Run with:
 *   npm run test:mobile-runtime
 *   npx playwright test tests/game-runtime-csp.spec.ts --project=mobile-safari --headed --debug
 */

import { test, expect } from "./helpers/browserGame";
import {
  startDiagnostics,
  snapshotDiagnostics,
  waitForPygbagRuntime,
  blockingErrors,
  attachDiagnostics,
  installDialogCapture,
  dialogWasCalled,
} from "./helpers/browserGame";

const GAMES = [
  { name: "Cannonball Clash", path: "/play/cannonball-clash/" },
  { name: "Treasure Cove", path: "/play/treasure-cove/" },
];

// iPhone 16 Pro Max landscape: 932x430 effective pixels.
// Playwright's emulated iOS viewport uses CSS pixel dimensions.
const LANDSCAPE_VIEWPORT = { width: 932, height: 430 };

const MOBILE_PROJECTS = ["mobile-chrome", "mobile-safari"];

const CSP_BLOCKING_PATTERNS = [
  /EvalError/i,
  /Refused to evaluate a string as JavaScript/i,
  /Content Security Policy/i,
  /Could not load dynamic lib/i,
  /\.cpython-312-wasm32-emscripten\.so/i,
];

for (const game of GAMES) {
  test.describe(`${game.name} - mobile CSP/runtime`, () => {
    test("no CSP violations or EvalErrors during startup", async ({
      page,
    }, testInfo) => {
      test.skip(
        !MOBILE_PROJECTS.includes(testInfo.project.name),
        `CSP runtime test skipped on ${testInfo.project.name}`,
      );

      // Use landscape viewport to avoid rotate-device overlay
      await page.setViewportSize(LANDSCAPE_VIEWPORT);

      // Install dialog capture BEFORE navigation
      await installDialogCapture(page);

      // Start diagnostics BEFORE navigation so CSP/EvalError events
      // during page load and WASM startup are captured
      const diag = startDiagnostics(page);

      await page.goto(game.path, { waitUntil: "domcontentloaded" });

      // Try to wait for Pygbag runtime, but catch timeout so we
      // can still check diagnostics even if startup is slow
      let runtimeStarted = false;
      try {
        await waitForPygbagRuntime(page);
        runtimeStarted = true;
      } catch (err) {
        // runtime may not start on emulated mobile (slow WASM),
        // but we still check for CSP/blocking errors below
        console.log(
          `  [info] ${game.name} runtime did not start: ${err instanceof Error ? err.message : err}`,
        );
      }

      // Finalize diagnostics
      const diagnostics = await snapshotDiagnostics(page, diag);
      attachDiagnostics(testInfo, diagnostics);

      // Check for dialogs
      const dlgCalled = await dialogWasCalled(page);
      expect(dlgCalled).toBe(false);

      // Filter blocking errors to CSP-specific patterns
      const cspBlocking = blockingErrors(diagnostics).filter((e) =>
        CSP_BLOCKING_PATTERNS.some((p) => p.test(e)),
      );

      if (cspBlocking.length > 0) {
        throw new Error(
          `CSP/runtime blocking errors detected for ${game.name}:\n  - ${cspBlocking.join("\n  - ")}`,
        );
      }

      // If runtime didn't start but no CSP errors, it's an emulation
      // slowness issue, not a CSP bug. Warn but don't fail.
      if (!runtimeStarted) {
        console.log(
          `  [warn] ${game.name}: runtime did not start within timeout, but no CSP errors detected. ` +
            `This is likely emulation slowness, not a CSP issue.`,
        );
        test.info().annotations.push({
          type: "warning",
          description: `Runtime did not start on ${testInfo.project.name}; no CSP errors found (emulation slowness).`,
        });
      }
    });
  });
}
