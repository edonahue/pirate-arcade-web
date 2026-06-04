# Testing

This document describes the Playwright test harness for the Pirate Arcade
website, with a focus on the browser games. For the **manual real-device
smoke checklist** (iOS Safari, Android Chrome, etc.), see
[`tests/TESTING_CHECKLIST.md`](tests/TESTING_CHECKLIST.md).

---

## Overview

The test suite uses [Playwright](https://playwright.dev) Test with
TypeScript. It runs against a real build of the site served by
`astro preview` (port 4327), so it exercises the production code path
including the static-asset build.

> **Important:** `astro preview` does NOT serve Cloudflare Pages
> `_headers` rules. CSP testing is done via a static parser
> (`scripts/check-cloudflare-headers.mjs`) that simulates Cloudflare's
> matching algorithm. See "CSP headers" below for the rationale.

The suite is structured around two axes:

| Axis   | Concern                                                         |
| ------ | --------------------------------------------------------------- |
| Health | Page loads, Pygbag runtime starts, canvas renders, no JS errors |
| Input  | Keyboard, mouse, touch actually reach the game and change state |

The second axis is the focus of the second-pass test-quality upgrade
(see [`tests/game-input-desktop.spec.ts`](tests/game-input-desktop.spec.ts)
and [`tests/game-input-mobile.spec.ts`](tests/game-input-mobile.spec.ts)).

---

## Quick start

```bash
# Full Playwright run (all projects, all suites)
npm run test:e2e

# Health-only smoke (works on all 5 projects, ~1-2 min on Chromium)
npm run test:browser-games

# Desktop keyboard/mouse input coverage
npm run test:desktop-input

# Mobile touch/orientation coverage
npm run test:mobile-input

# Accessibility (axe-core)
npm run test:a11y

# Headed + debug on WebKit (useful for Safari-specific issues)
npm run test:debug:webkit

# Headed + debug on emulated iPhone Safari
npm run test:debug:mobile

# Game loading performance (measures cold-start phase timings)
npm run test:game-performance

# Game loading performance in headed mode (watch the boot)
npm run test:game-performance:headed

# Mobile touch playability (tap/hold movement, action buttons)
npm run test:mobile-playability

# Mobile layout (canvas positioning, touch control sizing)
npm run test:mobile-layout

# Mobile runtime CSP check (no EvalError on game routes)
npm run test:mobile-runtime

# Mobile controls regression (iOS Safari classList.contains bug)
npm run test:mobile-regression

# Audit browser game archives for size, suspicious files
npm run audit:game-archives

# HTML report of the most recent run
npm run test:e2e:report
```

All of the above scripts run against the **chromium-desktop** project by
default unless a `--project=...` flag is passed. To target a different
project explicitly, pass `--project=firefox-desktop` (or any project
name from `playwright.config.ts`).

---

## Test architecture

```
playwright.config.ts            # 5 projects + webServer (astro preview)
tests/
  helpers/
    browserGame.ts              # Shared helpers (diagnostics, runtime, input)
  browser-games.spec.ts         # Health/smoke (~18 tests)
  game-input-desktop.spec.ts    # Desktop keyboard/mouse (~12 tests)
  game-input-mobile.spec.ts     # Mobile touch/orientation (~15 tests)
  a11y.spec.ts                  # Accessibility (axe-core, ~7 tests)
  TESTING_CHECKLIST.md          # Manual real-device checklist
```

### Projects

`playwright.config.ts` defines five browser projects:

- `chromium-desktop` — Desktop Chrome (Playwright `Desktop Chrome`)
- `firefox-desktop` — Desktop Firefox
- `webkit-desktop` — Desktop Safari (Playwright `Desktop Safari`)
- `mobile-chrome` — Pixel 5 profile
- `mobile-safari` — iPhone 13 profile

> **Mobile emulation is not real-device testing.** Playwright's device
> descriptors emulate viewport, user-agent, and pointer characteristics,
> but they do not reproduce:
>
> - iOS Safari's stricter autoplay policy
> - Real GPU rasterization differences (affects WASM performance)
> - iOS-specific Pygbag/WASM edge cases
> - Real touch gesture timing (real devices have a longer "tap" threshold)
> - Hardware-mediated orientation events
>
> Use the Playwright suite as a CI-friendly smoke baseline, then run
> [`tests/TESTING_CHECKLIST.md`](tests/TESTING_CHECKLIST.md) on real
> hardware before each release.

### WebServer

The Playwright config runs `npm run build && npm run preview` against
port 4327 before tests start. If a server is already running on that
port (`reuseExistingServer: true`), Playwright reuses it. This makes
debugging with `npm run preview` outside of Playwright convenient.

### Workers

`workers: 1` and `fullyParallel: false` are set in the config because
Pygbag/WASM startups are CPU- and network-heavy. Parallel WASM
downloads hit CDN rate limits and can be flaky. The total runtime is
~1-2 minutes on Chromium for the full suite, which is acceptable.

---

## What each test catches

### `tests/browser-games.spec.ts` (health/smoke)

- **Page load**: DOM wiring (canvas, infobox, back-link, controls-hint,
  transfer, touch-overlay, rotate-device) is present immediately on
  page load.
- **Runtime startup**: Pygbag downloads, Python interpreter loads,
  canvas resizes to game dimensions, infobox text changes from
  "Loading..." to the runtime replacement.
- **Canvas rendering**: pixel sample shows non-trivial non-zero pixels
  (game is actually drawing frames, not just allocating a 1×1
  placeholder).
- **No blocking errors**: `EvalError`, `TypeError`, `ReferenceError`,
  `SyntaxError`, `Content Security Policy`, `Failed to fetch`,
  `Unhandled promise rejection`, and `Could not load dynamic lib` are
  treated as blocking. Other console errors are filtered as harmless
  (wasm/emscripten/source-map/favicon).
- **Game-critical asset failures**: `.wasm`, `.so`, `.tar.gz`
  responses that fail or return 4xx/5xx are surfaced explicitly.
- **Reload / blur+refocus**: reloading the page or simulating tab
  blur/refocus does not crash the game.

### `tests/game-input-desktop.spec.ts` (desktop input)

- **Keyboard input produces observable canvas changes**: after pressing
  the test sequence, the canvas pixel sample differs from the
  baseline. If the pixels are identical, the game ignored the input
  (or is frozen).
- **Mouse click properly focuses canvas and enables keyboard**: after
  `canvas#canvas` is clicked, `document.activeElement` is `#canvas`,
  and subsequent keypresses reach the game without errors.
- **No JavaScript dialogs during gameplay**: a runtime override of
  `window.alert/confirm/prompt` confirms no popup calls.
- **Rapid input sequence does not cause JS errors**: 20 rapid
  keypresses cycle through the test sequence; the diagnostics snapshot
  has no blocking errors.
- **Escape pauses game without errors**: press Enter, then Escape; no
  exceptions, no page errors.
- **Canvas pixels differ before and after input**: byte-level
  comparison of two 40×40 samples, one taken before and one after the
  input sequence. If they are identical, the game is not responding
  to keyboard.

### `tests/game-input-mobile.spec.ts` (mobile input)

- **Touch overlay is present and wired correctly**: every game has
  the `#touch-overlay` with the four expected buttons
  (`btn-left`, `btn-right`, `btn-action`, `btn-pause`).
- **Touch button taps do not cause JS errors**: each touch scenario
  (left arrow, right arrow, action, pause) is dispatched, and
  diagnostics after each one are clean.
- **No JavaScript dialogs during mobile gameplay**: same alert/
  confirm/prompt guard as desktop.
- **Rapid tap sequence does not cause JS errors**: 8 rapid taps
  cycling through the touch scenarios; no blocking errors.
- **Orientation lock overlay is present and CSS-controlled**: both
  `#rotate-device` and `#game-wrap` exist; in emulated landscape
  the overlay is hidden and the game is visible.
- **Asteroids-mode (Kraken's Wake)**: dedicated sub-describe for
  `data-controls="asteroids"`. Verifies the touch overlay reports
  the asteroids mode and the thrust/fire buttons exist.

### `tests/a11y.spec.ts` (accessibility)

- Uses `@axe-core/playwright` to scan each game page on three states
  (initial, runtime-ready, during gameplay) and the `/play/` index.
- Asserts no **critical** or **serious** WCAG 2.1 AA violations.
- Three rules are explicitly disabled with documented rationale:
  - `color-contrast` — tiny fixed-position dev overlays
  - `meta-viewport` — `user-scalable=no` is required for Pygbag canvases
  - `region` — overlays above the canvas are not in landmark regions

---

## Helpers (`tests/helpers/browserGame.ts`)

The shared helpers cover three categories:

### Diagnostics collection

- `startDiagnostics(page)` — attaches listeners for `console`,
  `pageerror`, `requestfailed`, and `response`; returns a mutable
  `PageDiagnostics` object that live-updates as events arrive.
  **Call before `page.goto()`** to capture CSP/EvalError violations
  that fire during page load.
- `snapshotDiagnostics(page, diag)` — finalizes a diagnostics object
  started by `startDiagnostics`. Detaches listeners, reads DOM state
  (infobox, canvas dimensions, etc.), and returns the populated
  snapshot. Call after the page has settled.
- `collectPageDiagnostics(page)` — **deprecated.** Wrapper around
  `startDiagnostics` + `snapshotDiagnostics` that attaches listeners
  after the page has already loaded. Prefer the explicit pair for
  tests that need to catch startup errors.
- `attachDiagnostics(testInfo, diagnostics)` — attaches both a
  human-readable summary and the full payload to the Playwright
  report, so failure triage has the full event capture.
- `blockingErrors(diagnostics)` — filters diagnostics to high-severity
  patterns (EvalError, CSP, TypeError, etc.).

### Runtime detection

- `waitForPygbagRuntime(page)` — waits for any of: `#transfer` hidden,
  canvas resized to >10×10 and visible, infobox text replaced with
  "loaded"/"ready"/"error". Initial "Loading..." text is captured
  before the wait so it isn't matched as "ready".
- `expectCanvasHasRenderedPixels(page)` — reads a 200×200 (or full
  canvas, whichever is smaller) pixel sample and asserts >50
  non-transparent pixels.

### Input verification (second-pass additions)

- `waitForGameStateChange(page, timeoutMs)` — polls the canvas and
  reports whether the pixel sample is non-trivial.
- `sendKeysAndWaitForResponse(page, keys, waitMs)` — clicks the
  canvas, focuses, presses each key, then waits for a state change.
- `unlockAndFocusGame(page)` — single click + focus + brief wait
  (browser autoplay policies).
- `dispatchTouchSequence(page, touchPoints, holdMs)` — dispatches
  `pointerstart` and `pointerend` events to `#touch-overlay`,
  matching the pointer event handlers in
  `public/play/shared/mobile-controls.js`.
- `getCanvasPixelSample(page, w, h)` — returns `ImageData` for byte-
  level before/after comparison.
- `hasJavaScriptDialogs(page)` — temporarily overrides
  `window.alert/confirm/prompt` and reports whether any were called.

---

## CSP headers

The game pages require `'unsafe-eval'` in their `script-src` CSP directive
because Pygbag uses `eval()` internally for dynamic WASM module loading.
Non-game routes (home page, arcade index) do NOT need `'unsafe-eval'`.

The CSP is configured in `public/_headers`, which is only interpreted by
Cloudflare Pages — not by `astro preview`. This created a subtle bug:

### Root cause: Cloudflare merges, browser enforces strictest

When a URL matches multiple `_headers` rules, Cloudflare **merges** headers
from all matching rules. Previously, the global `/*` CSP (without
`'unsafe-eval'`) was merged with the `/play/cannonball-clash/*` CSP (with
`'unsafe-eval'`). The browser received TWO `Content-Security-Policy`
headers and enforced the **stricter** one, which blocked `eval()`.

### Fix: `!` prefix to detach inherited CSP

Each game route now uses:

```
/play/cannonball-clash/*
  ! Content-Security-Policy
  Content-Security-Policy: ...game CSP with 'unsafe-eval'...
```

The `! Content-Security-Policy` line tells Cloudflare "do not inherit
the CSP from less specific rules." The subsequent `Content-Security-Policy`
line sets the correct game CSP. Only one effective CSP reaches the browser.

Three URL variants are covered for each game (directory path, `index.html`
file, and `*` glob) to handle all possible Cloudflare matching behaviors.

### Testing

- **`npm run test:check-headers`** — runs a static parser
  (`scripts/check-cloudflare-headers.mjs`) that simulates Cloudflare's
  `_headers` matching algorithm and asserts correct CSP per route.
- **`npm run test:live-headers`** — fetches the deployed site and checks
  the live `Content-Security-Policy` header (manual, post-deploy).
- **`npm run test:mobile-runtime`** — a Playwright test on mobile-safari
  and mobile-chrome that navigates to each game in landscape, starts
  diagnostics BEFORE page load, and asserts no CSP/EvalError violations.

### Why `astro preview` did not catch this

Astro's built-in preview server serves static files but does NOT interpret
Cloudflare Pages `_headers`. Our Playwright suite could not detect the
CSP header merging bug because the game pages loaded successfully during
local preview. The bug only manifested on Cloudflare Pages.

---

## Debugging a failing test

1. **Read the error context.** Each failing test gets a
   `diagnostics-summary` and `diagnostics-full` attachment in the HTML
   report. Open them in `npx playwright show-report` (or
   `npm run test:e2e:report`).
2. **Re-run headed with debug.**
   ```bash
   npm run test:debug:webkit    # desktop Safari
   npm run test:debug:mobile    # emulated iPhone Safari
   ```
3. **Use `--grep` to isolate a single test.**
   ```bash
   npx playwright test tests/game-input-desktop.spec.ts \
     --project=chromium-desktop \
     --grep "keyboard input produces"
   ```
4. **Check the saved trace and video.** Both are retained on failure
   under `test-results/`.

---

## Real-device testing (manual)

Playwright emulation covers most regressions, but it does **not** catch:

- iOS Safari audio policy differences
- Real touch event timing (emulated events are instant)
- iOS-specific Pygbag/WASM behavior
- Hardware-mediated orientation changes
- Real GPU rasterization performance

For these, see [`tests/TESTING_CHECKLIST.md`](tests/TESTING_CHECKLIST.md).
It walks through what to check on a real iPhone, Android device, and
iPad before each release.

---

## When to add a new test

- **Behavior changed in production code?** Add a regression test in
  the appropriate spec file. The two input specs are good homes for
  any change to keyboard/mouse/touch handling.
- **New browser game added?** Update the `GAMES` array in both input
  specs and the `browser-games.spec.ts` smoke spec.
- **New CSP directive or CDN URL?** Update `tests/TESTING_CHECKLIST.md`
  and consider adding a dedicated CSP test in `browser-games.spec.ts`.
- **New mobile control mode** (e.g. a third `data-controls` value)?
  Add a sub-describe in `game-input-mobile.spec.ts` mirroring the
  existing asteroids-mode section.
