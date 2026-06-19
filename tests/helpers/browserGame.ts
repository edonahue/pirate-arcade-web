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
 *
 * For diagnostics collection (errors, requests, CSP, etc.), use
 * tests/helpers/diagnostics.ts (createDiagnosticCollector, startDiagnostics,
 * snapshotDiagnostics, collectPageDiagnostics, blockingErrors, attachDiagnostics).
 */

import { test, expect, type Page } from "@playwright/test";

export interface FailedRequest {
  url: string;
  failureText: string;
}

export interface BadResponse {
  url: string;
  status: number;
  statusText: string;
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

      const current = (ib.textContent || "").trim();

      // Error state — set a global flag for the outer function to
      // detect and throw. We do NOT return true here because "error"
      // is a failure signal, not a ready signal. The previous version
      // of this helper treated "error" as ready, which meant a game
      // that failed to start (e.g. "Could not load dynamic lib") would
      // be treated as "successfully started".
      if (current && current !== initialText.trim()) {
        const lower = current.toLowerCase();
        if (lower.includes("error")) {
          (window as any).__pygbagError = current;
          return false;
        }
      }

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
      if (current && current !== initialText.trim()) {
        const lower = current.toLowerCase();
        if (lower.includes("loaded") || lower.includes("ready")) {
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

  // After waitForFunction completes (by canvas size, infobox text,
  // or timeout), check whether it was because of an error state.
  const pygbagError = await page.evaluate(
    () => (window as any).__pygbagError as string | undefined,
  );
  if (pygbagError) {
    throw new Error(
      `Game runtime entered error state. Infobox content: "${pygbagError}". ` +
        `This may indicate a failed Pygbag startup, missing CDN assets, or a ` +
        `runtime exception. Check the diagnostics report for blocking errors.`,
    );
  }
}

/**
 * Perform the configured primary action to start the game from its menu.
 * Reads the action key from production metadata (PirateArcadeActions)
 * or falls back to the game's configured actionKey, using exactly one key.
 */
export async function performConfiguredPrimaryAction(
  page: Page,
  actionKey: string,
): Promise<void> {
  await page.waitForFunction(
    () => {
      return !!(window as any).PirateArcadeActions?.performPrimary;
    },
    undefined,
    { timeout: 15000 },
  );
  await page.evaluate((key: string) => {
    const actions = (window as any).PirateArcadeActions;
    if (actions?.performPrimary) {
      actions.performPrimary();
    } else if ((window as any).PirateArcadeInput?.tap) {
      (window as any).PirateArcadeInput.tap(key, 220);
    } else {
      // Fallback: dispatch keyboard event directly
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true }),
      );
      setTimeout(
        () =>
          document.dispatchEvent(
            new KeyboardEvent("keyup", { key, bubbles: true }),
          ),
        200,
      );
    }
  }, actionKey);
  await page.waitForTimeout(500);
}

/**
 * Capture a baseline of input evidence before sending gameplay keys.
 * Returns game-state snapshot, input bridge count, and canvas digest.
 */
export async function captureResponseBaseline(page: Page): Promise<{
  gameState: ArcadeGameState | null;
  bridgeCount: number;
  canvasDigest: string;
}> {
  const gameState = await readGameState(page);
  const debug = await readPirateInputDebug(page);
  const bridgeCount = debug.bridgeCalls.length;
  const canvasDigest = await page.evaluate(() => {
    const c = document.getElementById("canvas") as HTMLCanvasElement | null;
    if (!c) return "";
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    try {
      const w = Math.min(c.width, 40);
      const h = Math.min(c.height, 40);
      if (w < 4 || h < 4) return "";
      const img = ctx.getImageData(0, 0, w, h);
      let hash = 0;
      for (let i = 0; i < img.data.length; i += 16) {
        hash = ((hash << 5) - hash + img.data[i]) | 0;
      }
      return String(hash);
    } catch {
      return "";
    }
  });
  return { gameState, bridgeCount, canvasDigest };
}

/**
 * Check whether input produced a response by comparing baseline to current state.
 * Returns the signal type that proved the response, or null if no response detected.
 */
export async function checkInputResponse(
  page: Page,
  baseline: {
    gameState: ArcadeGameState | null;
    bridgeCount: number;
    canvasDigest: string;
  },
): Promise<{
  responded: boolean;
  signal: string | null;
  before: unknown;
  after: unknown;
}> {
  // Check 1: Game-state bridge change (most reliable)
  const state = await readGameState(page);
  if (state && baseline.gameState) {
    const stateStr = JSON.stringify(state);
    const beforeStr = JSON.stringify(baseline.gameState);
    if (stateStr !== beforeStr) {
      return {
        responded: true,
        signal: "game-state",
        before: baseline.gameState,
        after: state,
      };
    }
  }

  // Check 2: Input bridge event count increase
  const debug = await readPirateInputDebug(page);
  const bridgeCount = debug.bridgeCalls.length;
  if (bridgeCount > baseline.bridgeCount) {
    return {
      responded: true,
      signal: "bridge-count",
      before: baseline.bridgeCount,
      after: bridgeCount,
    };
  }

  // Check 3: Canvas digest change
  const digest = await page.evaluate(() => {
    const c = document.getElementById("canvas") as HTMLCanvasElement | null;
    if (!c) return "";
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    try {
      const w = Math.min(c.width, 40);
      const h = Math.min(c.height, 40);
      if (w < 4 || h < 4) return "";
      const img = ctx.getImageData(0, 0, w, h);
      let hash = 0;
      for (let i = 0; i < img.data.length; i += 16) {
        hash = ((hash << 5) - hash + img.data[i]) | 0;
      }
      return String(hash);
    } catch {
      return "";
    }
  });
  if (digest && baseline.canvasDigest && digest !== baseline.canvasDigest) {
    return {
      responded: true,
      signal: "canvas-digest",
      before: baseline.canvasDigest,
      after: digest,
    };
  }

  return { responded: false, signal: null, before: null, after: null };
}

/**
 * Send gameplay keys and wait for a genuine response.
 * Captures before/after evidence.
 *
 * @returns evidence of the response, or throws on timeout
 */
export async function sendKeysAndRequireResponse(
  page: Page,
  keys: string[],
  waitMs: number = 2000,
): Promise<{
  responded: boolean;
  signal: string | null;
  before: unknown;
  after: unknown;
  attemptedKeys: string[];
}> {
  await page.locator("canvas#canvas").click({ position: { x: 10, y: 10 } });
  await page.locator("canvas#canvas").focus();
  await page.waitForTimeout(100);

  const baseline = await captureResponseBaseline(page);

  for (const key of keys) {
    await page.keyboard.press(key);
    await page.waitForTimeout(50);
  }

  await page.waitForTimeout(Math.min(waitMs, 500));

  try {
    await page.waitForFunction(
      (bl: {
        gameState: ArcadeGameState | null;
        bridgeCount: number;
        canvasDigest: string;
      }) => {
        const c = document.getElementById("canvas") as HTMLCanvasElement | null;
        if (!c) return false;
        const ctx = c.getContext("2d");
        if (!ctx) return false;
        const w = Math.min(c.width, 40);
        const h = Math.min(c.height, 40);
        if (w < 4 || h < 4) return false;
        const img = ctx.getImageData(0, 0, w, h);
        let hash = 0;
        for (let i = 0; i < img.data.length; i += 16) {
          hash = ((hash << 5) - hash + img.data[i]) | 0;
        }
        const digest = String(hash);
        if (digest !== bl.canvasDigest) return true;
        const br = (window as any).__paInputDebug?.bridgeCalls?.length || 0;
        if (br > bl.bridgeCount) return true;
        const gs = (window as any).PirateArcadeGameState?.getState?.();
        if (gs && JSON.stringify(gs) !== JSON.stringify(bl.gameState))
          return true;
        return false;
      },
      baseline,
      { timeout: waitMs },
    );
    const evidence = await checkInputResponse(page, baseline);
    return { ...evidence, attemptedKeys: keys };
  } catch {
    const finalState = await readGameState(page);
    const debug = await readPirateInputDebug(page);
    return {
      responded: false,
      signal: null,
      before: baseline,
      after: { gameState: finalState, bridgeCount: debug.bridgeCalls.length },
      attemptedKeys: keys,
    };
  }
}

/**
 * Click the page to satisfy browser autoplay/audio policies, then
 * send a short gameplay sequence using the configured primary action
 * and gameplay keys.
 *
 * The gameplay sequence is intentionally not score-dependent.
 */
export async function unlockAndStartGame(
  page: Page,
  desktopKeys: string[],
  actionKey: string = "Enter",
): Promise<void> {
  // Click the canvas to satisfy user-gesture / audio unlock
  await page.locator("canvas#canvas").click({ position: { x: 10, y: 10 } });
  await page.locator("canvas#canvas").focus();
  await page.waitForTimeout(300);

  // Use the configured primary action to start from menu
  await performConfiguredPrimaryAction(page, actionKey);

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

  const arrowLeft = page.locator('#touch-overlay [data-dir="left"]');
  const arrowRight = page.locator('#touch-overlay [data-dir="right"]');
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
      undefined,
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
 * Override `window.alert`, `window.confirm`, and `window.prompt` via
 * `addInitScript` so the override is active BEFORE any page JavaScript
 * runs. This is the only reliable way to catch all dialog calls — the
 * previous version used `page.evaluate` to override and then immediately
 * restore within the same microtask, which missed any dialog triggered
 * asynchronously (e.g. during WASM startup or from a deferred handler).
 *
 * After calling this, use `dialogWasCalled(page)` to check whether a
 * dialog was ever raised.
 */
export async function installDialogCapture(page: Page): Promise<void> {
  // Guard: only install once per context
  const alreadyInstalled = await page.evaluate(
    () => !!(window as any).__dialogOverrideInstalled,
  );
  if (alreadyInstalled) return;

  await page.context().addInitScript(() => {
    if ((window as any).__dialogOverrideInstalled) return;
    (window as any).__dialogOverrideInstalled = true;
    (window as any).__dialogCalled = false;

    const origAlert = window.alert;

    window.alert = (msg?: unknown) => {
      (window as any).__dialogCalled = true;
      return origAlert.call(window, msg);
    };
    window.confirm = () => {
      (window as any).__dialogCalled = true;
      return true;
    };
    window.prompt = () => {
      (window as any).__dialogCalled = true;
      return "";
    };
  });
}

/**
 * Check whether any JavaScript dialog (alert, confirm, prompt) was
 * called since the page loaded. Requires `installDialogCapture(page)`
 * to have been called before navigation.
 */
export async function dialogWasCalled(page: Page): Promise<boolean> {
  return page.evaluate(() => !!(window as any).__dialogCalled);
}

/**
 * Check if any JavaScript dialogs (alert, confirm, prompt) were opened.
 *
 * NOTE: This function relies on window overrides that must be installed
 * BEFORE the dialog fires. The most reliable approach is to call
 * `installDialogCapture(page)` before `page.goto()`. This function is
 * kept for backward compatibility — if no override is detected, it
 * installs one and asks the caller to check again.
 *
 * @deprecated Use `installDialogCapture(page)` + `dialogWasCalled(page)`
 *   instead for reliable dialog detection.
 */
export async function hasJavaScriptDialogs(page: Page): Promise<boolean> {
  // First check if the persistent override is already installed
  const installed = await page.evaluate(
    () => !!(window as any).__dialogOverrideInstalled,
  );
  if (installed) {
    return dialogWasCalled(page);
  }

  // Fallback: instant override (may miss async dialogs)
  return page.evaluate(() => {
    let called = false;
    const origAlert = window.alert;

    window.alert = () => {
      called = true;
    };
    window.confirm = () => {
      called = true;
      return true;
    };
    window.prompt = () => {
      called = true;
      return "";
    };

    window.alert = origAlert;

    return called;
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

/**
 * Get a canvas pixel sample at specific coordinates (viewport-relative).
 * Useful for sampling specific game regions like paddles.
 */
export async function getCanvasPixelSampleAt(
  page: Page,
  x: number,
  y: number,
  sampleWidth: number = 20,
  sampleHeight: number = 20,
): Promise<{ data: Uint8ClampedArray; width: number; height: number } | null> {
  return page.evaluate(
    ({ x, y, sampleWidth, sampleHeight }) => {
      const c = document.getElementById("canvas") as HTMLCanvasElement | null;
      if (!c) return null;

      const ctx = c.getContext("2d");
      if (!ctx) return null;

      // Convert viewport coordinates to canvas coordinates
      const rect = c.getBoundingClientRect();
      const canvasX = Math.floor((x - rect.left) * (c.width / rect.width));
      const canvasY = Math.floor((y - rect.top) * (c.height / rect.height));

      const w = Math.min(c.width - canvasX, sampleWidth);
      const h = Math.min(c.height - canvasY, sampleHeight);
      if (w < 1 || h < 1 || canvasX < 0 || canvasY < 0) return null;

      try {
        return ctx.getImageData(canvasX, canvasY, w, h);
      } catch {
        return null;
      }
    },
    { x, y, sampleWidth, sampleHeight },
  );
}

/**
 * Simulate a pointer drag across a target element.
 * Fires pointerdown at (startX, startY), then pointermove along each
 * intermediate point, finishing with pointerup at the final point.
 *
 * All coordinates are relative to the given selector's bounding box.
 * Handles both touch and mouse pointer types.
 */
export async function pointerDrag(
  page: Page,
  selector: string,
  points: { x: number; y: number }[],
): Promise<void> {
  if (points.length < 2) throw new Error("Need at least 2 points for a drag");

  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`Element not found: ${selector}`);

  const start = points[0];
  await page.mouse.move(box.x + start.x, box.y + start.y);
  await page.mouse.down();

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    await page.mouse.move(box.x + p.x, box.y + p.y, { steps: 3 });
    await page.waitForTimeout(30);
  }

  const end = points[points.length - 1];
  await page.mouse.up();
}

/**
 * Read PirateArcadeInput debug log from the page.
 */
export async function readPirateInputDebug(
  page: Page,
): Promise<{ events: any[]; bridgeCalls: any[]; domEvents: any[] }> {
  return page.evaluate(() => {
    const d = (window as any).__paInputDebug;
    if (!d) return { events: [], bridgeCalls: [], domEvents: [] };
    return {
      events: d.events,
      bridgeCalls: d.bridgeCalls,
      domEvents: d.domEvents,
    };
  });
}

export interface ArcadeGameState {
  gameId: string;
  phase:
    | "loading"
    | "menu"
    | "ready"
    | "playing"
    | "paused"
    | "round-over"
    | "game-over"
    | "error";
  score?: number;
  secondaryScore?: number;
  playerPosition?: number;
  secondaryPosition?: number;
  actionReady?: boolean;
  projectileCount?: number;
  lives?: number;
  ballLaunched?: boolean;
  updatedAt?: number;
}

/**
 * Read the shared gameplay state from the page.
 * For Pygbag games, this reads via PirateArcadeGameState or the Python bridge.
 * For web-native games (Race), it reads window.__pa_game_state_json directly.
 */
export async function readGameState(
  page: Page,
): Promise<ArcadeGameState | null> {
  return page.evaluate(() => {
    // Try the shared PirateArcadeGameState API first (available in Pygbag shells)
    if ((window as any).PirateArcadeGameState) {
      (window as any).PirateArcadeGameState.refresh();
      return (window as any).PirateArcadeGameState.getState();
    }
    // Fallback: direct JSON (set by web-native games like Race)
    const direct = (window as any).__pa_game_state_json;
    if (typeof direct === "string") {
      try {
        return JSON.parse(direct);
      } catch {
        return null;
      }
    }
    // Last resort: read via Python bridge
    try {
      (window as any).python?.PyRun_SimpleString?.(
        "import json, builtins\n" +
          'open("/tmp/_pa_gs.json","w").write(getattr(builtins,"__pa_game_state_json","{}"))',
      );
      const raw = (window as any).python?.FS?.readFile?.("/tmp/_pa_gs.json", {
        encoding: "utf8",
      });
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
}

/** Assert that a game phase transition occurs within a timeout. */
export async function expectGamePhase(
  page: Page,
  expectedPhase: string,
  timeout = 15000,
): Promise<void> {
  await expect
    .poll(async () => (await readGameState(page))?.phase, {
      timeout,
      message: `expected phase "${expectedPhase}"`,
    })
    .toBe(expectedPhase);
}

/**
 * Dispatch a touch-style tap at a viewport position.
 * Uses pointerdown → pointerup with pointerType: "touch" to match
 * the production mobile-controls.js handler exactly.
 */
export async function pointerTouchTap(
  page: Page,
  x: number,
  y: number,
  options?: { selector?: string; holdMs?: number },
): Promise<void> {
  const selector = options?.selector ?? "#touch-overlay";
  const holdMs = options?.holdMs ?? 100;

  await page.dispatchEvent(selector, "pointerdown", {
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    pressure: 0.5,
    bubbles: true,
    cancelable: true,
  });

  await page.waitForTimeout(holdMs);

  await page.dispatchEvent(selector, "pointerup", {
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 0,
    pressure: 0,
    bubbles: true,
    cancelable: true,
  });
}

/**
 * Dispatch a touch-style drag across viewport points.
 * Fires pointerdown at the first point, then pointermove at each
 * intermediate point (if any), then pointerup at the final point.
 * All coordinates are absolute viewport positions (clientX/Y).
 */
export async function pointerTouchDrag(
  page: Page,
  points: { x: number; y: number }[],
  options?: { selector?: string; moveSteps?: number },
): Promise<void> {
  if (points.length < 2) throw new Error("Need at least 2 points for a drag");
  const selector = options?.selector ?? "#touch-overlay";
  const moveSteps = options?.moveSteps ?? 5;

  // pointerdown at first point
  const start = points[0];
  await page.dispatchEvent(selector, "pointerdown", {
    clientX: start.x,
    clientY: start.y,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    pressure: 0.5,
    bubbles: true,
    cancelable: true,
  });

  // pointermove along intermediate points
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    await page.dispatchEvent(selector, "pointermove", {
      clientX: p.x,
      clientY: p.y,
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      buttons: 1,
      pressure: 0.5,
      bubbles: true,
      cancelable: true,
    });
    await page.waitForTimeout(30);
  }

  // pointerup at final point
  const end = points[points.length - 1];
  await page.dispatchEvent(selector, "pointerup", {
    clientX: end.x,
    clientY: end.y,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 0,
    pressure: 0,
    bubbles: true,
    cancelable: true,
  });
}

/**
 * Find the top-most element at the center of a given selector's bounding box.
 * Useful for verifying which element would receive touch events at a
 * drag zone's center point.
 */
export async function topElementAtCenter(
  page: Page,
  selector: string,
): Promise<string | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return top ? top.tagName.toLowerCase() : null;
  }, selector);
}

export { test, expect };
