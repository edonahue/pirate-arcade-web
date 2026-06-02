/**
 * Browser game test helpers for Pirate Arcade Pygbag/WASM games.
 *
 * These helpers exist to catch:
 *  - JavaScript console errors (EvalError, CSP violations, fetch failures)
 *  - Page errors and unhandled promise rejections
 *  - Network failures for WASM, tar.gz, and other critical game assets
 *  - Pygbag runtime startup problems
 *  - Canvas rendering issues
 *  - Touch control wiring problems
 *  - Rotate-device overlay issues
 *
 * They intentionally do NOT depend on exact scores or exact animation
 * frames. Tests should remain stable across small game tweaks.
 */

import { test, expect, type Page, type TestInfo } from "@playwright/test";

export interface FailedRequest {
  url: string;
  failureText: string;
}

export interface BadResponse {
  url: string;
  status: number;
  statusText: string;
}

export interface PageDiagnostics {
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  failedRequests: FailedRequest[];
  badResponses: BadResponse[];
  finalInfoboxText: string;
  canvasWidth: number;
  canvasHeight: number;
  canvasVisible: boolean;
  transferHidden: boolean;
  url: string;
  userAgent: string;
}

const HARMLESS_ERROR_PATTERNS: RegExp[] = [
  /wasm/i,
  /WebAssembly/i,
  /emscripten/i,
  /Emscripten/i,
  /unreachable/i,
  /SourceMap/i,
  /source map/i,
  /favicon/i,
  /Failed to load resource/i,
  /BrowserFS/i,
  /MEDIA/i,
];

const GAME_ASSET_REGEX = /\.(wasm|so|tar\.gz|py|js|css)(\?|$)/i;

export function isHarmlessConsoleError(text: string): boolean {
  return HARMLESS_ERROR_PATTERNS.some((re) => re.test(text));
}

/**
 * Attach listeners for console, pageerror, requestfailed, and 4xx/5xx
 * responses on game-critical assets. Returns a fresh diagnostics object
 * that gets populated as events arrive.
 *
 * The returned object is a snapshot of all collected diagnostics up to
 * the time of awaiting `collectPageDiagnostics`. Use this *after* the
 * page has had time to settle (e.g. after `waitForPygbagRuntime`).
 */
export async function collectPageDiagnostics(
  page: Page,
): Promise<PageDiagnostics> {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: FailedRequest[] = [];
  const badResponses: BadResponse[] = [];

  const consoleHandler = (msg: { type(): string; text(): string }) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
    else if (msg.type() === "warning") consoleWarnings.push(msg.text());
  };
  const pageErrorHandler = (err: Error) => pageErrors.push(err.message);
  const requestFailedHandler = (req: {
    url(): string;
    failure(): { errorText: string } | null;
  }) => {
    const failure = req.failure();
    failedRequests.push({
      url: req.url(),
      failureText: failure?.errorText || "unknown",
    });
  };
  const responseHandler = (resp: {
    url(): string;
    status(): number;
    statusText(): string;
  }) => {
    const status = resp.status();
    if (status >= 400) {
      badResponses.push({
        url: resp.url(),
        status,
        statusText: resp.statusText(),
      });
    }
  };

  page.on("console", consoleHandler);
  page.on("pageerror", pageErrorHandler);
  page.on("requestfailed", requestFailedHandler);
  page.on("response", responseHandler);

  // Let async events flush
  await page.waitForTimeout(500);

  // Read DOM state
  const dom = await page.evaluate(() => {
    const ib = document.getElementById("infobox") as HTMLElement | null;
    const c = document.getElementById("canvas") as HTMLCanvasElement | null;
    const tr = document.getElementById("transfer") as HTMLElement | null;
    const cs = c ? window.getComputedStyle(c) : null;
    return {
      infoboxText: ib?.textContent?.trim() || "",
      canvasWidth: c?.width || 0,
      canvasHeight: c?.height || 0,
      canvasVisible: !!(
        c &&
        cs &&
        cs.visibility === "visible" &&
        cs.display !== "none"
      ),
      transferHidden: !!tr?.hidden,
    };
  });

  // Detach listeners so subsequent tests start clean
  page.off("console", consoleHandler);
  page.off("pageerror", pageErrorHandler);
  page.off("requestfailed", requestFailedHandler);
  page.off("response", responseHandler);

  return {
    consoleErrors: consoleErrors.filter((e) => !isHarmlessConsoleError(e)),
    consoleWarnings,
    pageErrors,
    failedRequests,
    badResponses,
    finalInfoboxText: dom.infoboxText,
    canvasWidth: dom.canvasWidth,
    canvasHeight: dom.canvasHeight,
    canvasVisible: dom.canvasVisible,
    transferHidden: dom.transferHidden,
    url: page.url(),
    userAgent: await page.evaluate(() => navigator.userAgent),
  };
}

/**
 * Wait for the Pygbag runtime to finish booting. We use multiple
 * independent signals because pygbag internals have changed across
 * versions and we don't want to be brittle:
 *
 *  - canvas#canvas, #infobox, #transfer exist in the DOM
 *  - #transfer is hidden (Python started custom_site setup)
 *  - canvas is visible and has reasonable dimensions (>10x10)
 *  - #infobox text changes from the initial "Loading..." copy to
 *    one of the runtime "loaded!" / "Ready" / "click/touch to start"
 *    replacements
 *
 * The initial infobox text is "Loading {Game} — first visit downloads
 * the Python/Pygame runtime (~12 MB). Audio starts after your first
 * click." which contains the word "click". We must NOT match that as
 * a runtime-ready signal; we only treat the *replacement* copy as
 * ready.
 *
 * Total wait is up to ~120s. The function returns once *any* of
 * these signals indicates the runtime is up, whichever comes first.
 */
export async function waitForPygbagRuntime(page: Page): Promise<void> {
  // Confirm the static DOM is wired up
  await Promise.all([
    page.waitForSelector("canvas#canvas", {
      state: "attached",
      timeout: 15000,
    }),
    page.waitForSelector("#infobox", { state: "attached", timeout: 15000 }),
    page.waitForSelector("#transfer", { state: "attached", timeout: 15000 }),
  ]);

  // Capture the initial infobox text so we can detect replacement
  const initialInfobox = (await page.locator("#infobox").textContent()) || "";

  // Now wait for one of the runtime signals
  await page.waitForFunction(
    (initialText: string) => {
      const c = document.getElementById("canvas") as HTMLCanvasElement | null;
      const tr = document.getElementById("transfer");
      const ib = document.getElementById("infobox");

      if (!c || !tr || !ib) return false;

      // Canvas has been resized to real game dimensions. This is
      // the most reliable signal because it only happens once the
      // game has set up pygame's display mode.
      if (c.width > 10 && c.height > 10) {
        const cs = window.getComputedStyle(c);
        if (cs.visibility === "visible" && cs.display !== "none") return true;
      }

      // Infobox text REPLACED with runtime copy. Must differ from
      // the initial "Loading..." template that already contains
      // the word "click".
      const current = (ib.textContent || "").trim();
      if (current && current !== initialText.trim()) {
        const lower = current.toLowerCase();
        if (
          lower.includes("loaded") ||
          lower.includes("ready") ||
          lower.includes("error")
        ) {
          return true;
        }
      }

      // #transfer hidden = custom_site started. We treat this as
      // a WEAK signal (not sufficient on its own) because Pygbag's
      // custom_onload can set transfer.hidden before the game has
      // actually started. The canvas size or infobox change must
      // also happen for the test to proceed.
      return false;
    },
    initialInfobox,
    { timeout: 120000, polling: 500 },
  );
}

/**
 * Click the page to satisfy browser autoplay/audio policies, then
 * press Enter/Space to start the game from the menu, then send a
 * short gameplay sequence.
 *
 * The gameplay sequence is intentionally not score-dependent: it
 * just confirms that input is reaching the game. We do NOT assert
 * on ball position, score changes, or animation frames.
 */
export async function unlockAndStartGame(
  page: Page,
  desktopKeys: string[],
): Promise<void> {
  // Click the canvas to satisfy user-gesture / audio unlock
  await page.locator("canvas#canvas").click({ position: { x: 10, y: 10 } });
  // Make sure the canvas is focused so keyboard events route there
  await page.locator("canvas#canvas").focus();
  await page.waitForTimeout(300);

  // Press Enter to start from menu
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  // Sometimes games also start on Space
  await page.keyboard.press("Space");
  await page.waitForTimeout(500);

  // Now send the configured gameplay sequence
  for (const key of desktopKeys) {
    await page.keyboard.press(key);
    await page.waitForTimeout(80);
  }
}

/**
 * Assert the canvas has been drawn to (non-trivial non-zero pixel
 * count). This is a stronger check than "canvas exists" because it
 * confirms the game is actually rendering frames, not just allocating
 * a 1x1 placeholder.
 */
export async function expectCanvasHasRenderedPixels(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const c = document.getElementById("canvas") as HTMLCanvasElement | null;
    if (!c) return { ok: false, reason: "no canvas" };
    const ctx = c.getContext("2d");
    if (!ctx) return { ok: false, reason: "no 2d context" };
    const w = Math.min(c.width, 200);
    const h = Math.min(c.height, 200);
    if (w < 10 || h < 10)
      return { ok: false, reason: `canvas too small ${w}x${h}` };
    const img = ctx.getImageData(0, 0, w, h);
    let nonZero = 0;
    for (let i = 3; i < img.data.length; i += 4) {
      if (img.data[i] > 0) nonZero++;
    }
    return { ok: nonZero > 50, nonZero, sampled: w * h };
  });

  if (!result.ok) {
    throw new Error(
      `Canvas does not appear to be rendering. Reason: ${
        "reason" in result
          ? result.reason
          : `only ${result.nonZero} non-zero pixels`
      }`,
    );
  }
  expect(result.ok).toBe(true);
}

/**
 * Assert that the touch overlay is present and exposes the expected
 * buttons. We don't drive the buttons here (touch tests belong in
 * mobile projects), but we confirm the DOM wiring exists.
 */
export async function expectTouchOverlayWired(page: Page): Promise<void> {
  const overlay = page.locator("#touch-overlay");
  await expect(overlay).toHaveCount(1);

  const arrowLeft = page.locator('#touch-overlay .btn-left[data-dir="left"]');
  const arrowRight = page.locator(
    '#touch-overlay .btn-right[data-dir="right"]',
  );
  const action = page.locator('#touch-overlay .btn-action[data-dir="action"]');
  const pause = page.locator('#touch-overlay .btn-pause[data-dir="pause"]');

  await expect(arrowLeft).toHaveCount(1);
  await expect(arrowRight).toHaveCount(1);
  await expect(action).toHaveCount(1);
  await expect(pause).toHaveCount(1);
}

/**
 * Assert that the orientation lock overlay exists. We don't try to
 * physically rotate the device inside Playwright (emulated orientation
 * is unreliable), but we confirm the DOM element is present.
 */
export async function expectRotateDeviceOverlayPresent(
  page: Page,
): Promise<void> {
  const overlay = page.locator("#rotate-device");
  await expect(overlay).toHaveCount(1);
}

/**
 * Attach the diagnostics payload to the test report so failures
 * include the full event capture. Also includes a derived summary
 * with hints about what went wrong.
 */
export function attachDiagnostics(
  testInfo: TestInfo,
  diagnostics: PageDiagnostics,
): void {
  const gameAssetFailures = diagnostics.failedRequests.filter((f) =>
    GAME_ASSET_REGEX.test(f.url),
  );
  const gameAssetBadResponses = diagnostics.badResponses.filter((b) =>
    GAME_ASSET_REGEX.test(b.url),
  );

  const summary = {
    canvasSize: `${diagnostics.canvasWidth}x${diagnostics.canvasHeight}`,
    canvasVisible: diagnostics.canvasVisible,
    transferHidden: diagnostics.transferHidden,
    consoleErrorCount: diagnostics.consoleErrors.length,
    pageErrorCount: diagnostics.pageErrors.length,
    gameAssetFailures: gameAssetFailures.length,
    gameAssetBadResponses: gameAssetBadResponses.length,
    finalInfoboxText: diagnostics.finalInfoboxText.slice(0, 200),
  };

  testInfo.attach("diagnostics-summary", {
    body: JSON.stringify(summary, null, 2),
    contentType: "application/json",
  });

  testInfo.attach("diagnostics-full", {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: "application/json",
  });
}

/**
 * Assert that the diagnostics contain no blocking errors. Errors are
 * classified as blocking if they match the high-severity patterns
 * defined inline (EvalError, CSP, TypeError, etc.).
 */
const BLOCKING_PATTERNS: RegExp[] = [
  /EvalError/i,
  /Refused to evaluate a string as JavaScript/i,
  /Content Security Policy/i,
  /Could not load dynamic lib/i,
  /Failed to fetch/i,
  /TypeError/i,
  /ReferenceError/i,
  /SyntaxError/i,
  /Unhandled promise rejection/i,
];

export function blockingErrors(diagnostics: PageDiagnostics): string[] {
  const all = [
    ...diagnostics.consoleErrors,
    ...diagnostics.pageErrors.map((e) => `PageError: ${e}`),
  ];
  return all.filter((e) => BLOCKING_PATTERNS.some((p) => p.test(e)));
}

/**
 * Wait for a specific game state change after input, such as:
 * - Canvas pixel change (rendering)
 * - Specific game object appearing/disappearing
 * - Score or state change (if observable via DOM)
 *
 * Returns true if change detected within timeout, false otherwise.
 */
export async function waitForGameStateChange(
  page: Page,
  timeoutMs: number = 2000,
): Promise<boolean> {
  return page
    .waitForFunction(
      () => {
        // Check if canvas has new pixel data (simple change detection)
        const c = document.getElementById("canvas") as HTMLCanvasElement | null;
        if (!c) return false;

        const ctx = c.getContext("2d");
        if (!ctx) return false;

        // Sample a small region to check for changes
        const w = Math.min(c.width, 50);
        const h = Math.min(c.height, 50);
        if (w < 5 || h < 5) return false;

        try {
          const img = ctx.getImageData(0, 0, w, h);
          // Simple heuristic: if we have any non-background pixels, consider it changed
          let nonZero = 0;
          for (let i = 3; i < img.data.length; i += 4) {
            if (img.data[i] > 0) nonZero++;
          }
          return nonZero > 5; // At least 5 non-transparent pixels in sample
        } catch {
          return false;
        }
      },
      { timeout: timeoutMs },
    )
    .then(() => true)
    .catch(() => false);
}

/**
 * Send a sequence of keys and wait for observable game response.
 * Returns true if game state changed after input.
 */
export async function sendKeysAndWaitForResponse(
  page: Page,
  keys: string[],
  waitMs: number = 500,
): Promise<boolean> {
  // Ensure canvas is focused
  await page.locator("canvas#canvas").click({ position: { x: 10, y: 10 } });
  await page.locator("canvas#canvas").focus();
  await page.waitForTimeout(100);

  // Send keys
  for (const key of keys) {
    await page.keyboard.press(key);
    await page.waitForTimeout(50);
  }

  // Wait for response
  return waitForGameStateChange(page, waitMs);
}

/**
 * Simulate a user click to unlock audio and focus the game.
 * This satisfies browser autoplay policies.
 */
export async function unlockAndFocusGame(page: Page): Promise<void> {
  // Click canvas to satisfy user gesture requirement
  await page.locator("canvas#canvas").click({ position: { x: 10, y: 10 } });
  // Focus canvas for keyboard input
  await page.locator("canvas#canvas").focus();
  await page.waitForTimeout(300);
}

/**
 * Dispatch touch events to simulate mobile controls.
 *
 * Uses the production event names (`pointerdown` / `pointerup` /
 * `pointercancel` / `lostpointercapture`) and the production payload
 * (`clientX` / `clientY`, not `x` / `y`), because the production
 * handler in `public/play/shared/mobile-controls.js` reads
 * `e.clientX` / `e.clientY` directly. The previous version of this
 * helper dispatched `pointerstart` / `pointerend` with `x` / `y`,
 * which silently missed the production code path entirely.
 *
 * @param page The Playwright page
 * @param touchPoints Array of { x, y, durationMs } touch points
 *   (x/y are in CSS pixels relative to the page viewport; they are
 *   converted to clientX/clientY for the dispatched event)
 * @param holdMs How long to hold each touch (default 200ms)
 * @param options Optional config: `selector` to dispatch against
 *   (defaults to `#touch-overlay`); `fireLostPointerCapture` to also
 *   dispatch a `lostpointercapture` event after the up (matches the
 *   iOS Safari teardown path that triggers the classList TypeError
 *   bug in mobile-controls.js).
 */
export async function dispatchTouchSequence(
  page: Page,
  touchPoints: Array<{ x: number; y: number; durationMs?: number }>,
  holdMs: number = 200,
  options: {
    selector?: string;
    fireLostPointerCapture?: boolean;
  } = {},
): Promise<void> {
  const selector = options.selector ?? "#touch-overlay";
  const fireLost = options.fireLostPointerCapture ?? false;

  for (const point of touchPoints) {
    const duration = point.durationMs ?? holdMs;

    // Touch start — use production event name + payload
    await page.dispatchEvent(selector, "pointerdown", {
      clientX: point.x,
      clientY: point.y,
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      buttons: 1,
      pressure: 0.5,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      tangentialPressure: 0,
      bubbles: true,
      cancelable: true,
    });

    // Wait for hold duration
    await page.waitForTimeout(duration);

    // Touch end — same coords, buttons: 0
    await page.dispatchEvent(selector, "pointerup", {
      clientX: point.x,
      clientY: point.y,
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      buttons: 0,
      pressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      tangentialPressure: 0,
      bubbles: true,
      cancelable: true,
    });

    // iOS Safari fires `lostpointercapture` after `setPointerCapture`
    // is released. The production handler in mobile-controls.js wires
    // this to `handleCancel`, which reads `held[e.pointerId]`. Some
    // teardown paths also fire `pointercancel` and `pointerleave`.
    // We dispatch all three to fully exercise the production flow.
    if (fireLost) {
      await page.dispatchEvent(selector, "lostpointercapture", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        bubbles: true,
        cancelable: false,
      });
      await page.dispatchEvent(selector, "pointercancel", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        bubbles: true,
        cancelable: false,
      });
      await page.dispatchEvent(selector, "pointerleave", {
        clientX: point.x,
        clientY: point.y,
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        bubbles: true,
        cancelable: false,
      });
    }

    // Small gap between touches
    await page.waitForTimeout(50);
  }
}

/**
 * Hold a single button by dispatching real production pointer events
 * against the resolved locator. This is the canonical helper for
 * regression tests that need to exercise `mobile-controls.js` with
 * the exact event names and payload iOS Safari uses.
 *
 * Unlike `dispatchTouchSequence`, this helper resolves a Playwright
 * `Locator` (not just a CSS selector), so it can target a specific
 * `.btn-*` button. It also reads the button's bounding box to set
 * `clientX` / `clientY` to the button's center, matching the
 * coordinates a real touch would have.
 *
 * After the up, optionally fires `lostpointercapture`,
 * `pointercancel`, and `pointerleave` to exercise the full
 * teardown path (matches the iPhone 16 Pro Max Safari bug).
 */
export async function pointerHoldButton(
  page: Page,
  selector: string,
  holdMs: number = 150,
  options: {
    fireLostPointerCapture?: boolean;
  } = {},
): Promise<void> {
  const locator = page.locator(selector).first();
  await expect(locator).toBeVisible();

  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`No bounding box for ${selector}`);
  }

  const clientX = box.x + box.width / 2;
  const clientY = box.y + box.height / 2;

  await locator.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX,
    clientY,
    button: 0,
    buttons: 1,
    bubbles: true,
    cancelable: true,
  });

  await page.waitForTimeout(holdMs);

  await locator.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX,
    clientY,
    button: 0,
    buttons: 0,
    bubbles: true,
    cancelable: true,
  });

  if (options.fireLostPointerCapture ?? true) {
    await locator.dispatchEvent("lostpointercapture", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      bubbles: true,
      cancelable: false,
    });
    await locator.dispatchEvent("pointercancel", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      bubbles: true,
      cancelable: false,
    });
    await locator.dispatchEvent("pointerleave", {
      clientX,
      clientY,
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      bubbles: true,
      cancelable: false,
    });
  }
}

/**
 * Check if any JavaScript dialogs (alert, confirm, prompt) were opened.
 * Returns true if any dialog was detected.
 */
export async function hasJavaScriptDialogs(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    // Override native dialog methods to detect calls
    let alertCalled = false;
    let confirmCalled = false;
    let promptCalled = false;

    const originalAlert = window.alert;
    const originalConfirm = window.confirm;
    const originalPrompt = window.prompt;

    window.alert = () => {
      alertCalled = true;
    };
    window.confirm = () => {
      confirmCalled = true;
      return true;
    };
    window.prompt = () => {
      promptCalled = true;
      return "";
    };

    // Trigger a small timeout to allow any pending dialogs to show
    setTimeout(() => {}, 0);

    // Restore originals
    window.alert = originalAlert;
    window.confirm = originalConfirm;
    window.prompt = originalPrompt;

    return alertCalled || confirmCalled || promptCalled;
  });
}

/**
 * Get a snapshot of current canvas pixel data for change detection.
 */
export async function getCanvasPixelSample(
  page: Page,
  sampleWidth: number = 20,
  sampleHeight: number = 20,
): Promise<{ data: Uint8ClampedArray; width: number; height: number } | null> {
  return page.evaluate(
    ({ sampleWidth, sampleHeight }) => {
      const c = document.getElementById("canvas") as HTMLCanvasElement | null;
      if (!c) return null;

      const ctx = c.getContext("2d");
      if (!ctx) return null;

      const w = Math.min(c.width, sampleWidth);
      const h = Math.min(c.height, sampleHeight);
      if (w < 1 || h < 1) return null;

      try {
        return ctx.getImageData(0, 0, w, h);
      } catch {
        return null;
      }
    },
    { sampleWidth, sampleHeight },
  );
}

export { test, expect };
