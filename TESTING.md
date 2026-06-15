# Testing

**This file documents the Playwright test harness.** For the manual
real-device smoke checklist, see
[`tests/TESTING_CHECKLIST.md`](tests/TESTING_CHECKLIST.md).

For the **Post-Change Hardening Pass** checklist (CI checks, version
apply, local parity, cache validation, archive audit), run:

```bash
# Apply current versions to static files
npm run apply:game-versions

# Run the full validation suite
npm run test:service-worker
npm run test:archive-parity
npm run audit:game-archives
npm run test:css-tokens

# Compare repo against live site (post-deploy, informational)
ALLOW_STALE_LIVE=1 npm run test:live-parity
```

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

# Game visual theming checks (ship/longboat visuals, pixel sampling)
npm run test:game-theming

# Game archive/source parity check (ensure tarball matches source —
# covers cannonball-clash (pong/), treasure-cove (breakout/), and
# krakens-wake (asteroids/))
npm run test:archive-parity

# Game asset versioning validation (ensure ?v= queries are in sync,
# read-only — does NOT mutate files)
npm run test:game-versions

# Service worker compatibility + cache versioning + HTML consistency
# (classic SW, no top-level imports, WARM_CACHE lifecycle, correct
# CACHE_VERSION, archive network-first strategy, ?v= queries)
npm run test:service-worker

# Site visual smoke tests (homepage, play, about, build-log)
npm run test:site-theme

# Game prewarm verification (standalone CTAs, GameCard, WARM_CACHE, single-installer, dedup)
npm run test:game-prewarm

# CSS token validation (ensure all var() references are defined)
npm run test:css-tokens

# Dependency hygiene (check for misclassified deps)
npm run check:dependency-hygiene

# Mobile touch playability (tap/hold movement, action buttons)
npm run test:mobile-playability

# Mobile layout (canvas positioning, touch control sizing)
npm run test:mobile-layout

# Mobile navigation (back-to-arcade link)
npm run test:mobile-navigation

# Mobile runtime CSP check (no EvalError on game routes)
npm run test:mobile-runtime

# Mobile controls regression (iOS Safari classList.contains bug)
npm run test:mobile-regression

# Mobile visual polish (header/nav, game card footer stacking, badge contrast, feature chip overflow, CTA fit)
npm run test:visual-polish

# Audit browser game archives for size, suspicious files
npm run audit:game-archives

# Mobile pause regression
npm run test:mobile-pause

# Live/repo parity check (informational, ALLOW_STALE_LIVE=1 to skip failures)
npm run test:live-parity

# Screenshot assets — IHDR/format/size/distinctness validator (no deps)
npm run test:screenshot-assets

# Refresh production screenshots (real browser-gameplay frames, 1280x720 PNG)
npm run capture:screenshots

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
playwright.config.ts            # 7 projects + webServer (astro preview)
tests/
  helpers/
    browserGame.ts              # Shared helpers (diagnostics, runtime, input, touch)
  browser-games.spec.ts         # Health/smoke (~18 tests)
  game-input-desktop.spec.ts    # Desktop keyboard/mouse (~12 tests)
  game-input-mobile.spec.ts     # Mobile touch/orientation (~15 tests)
  game-load-performance.spec.ts # Cold/warm load metrics, resource breakdown
  game-theming.spec.ts          # Visual theming: ship/longboat source markers, archive parity,
                                #   paddle color diversity, pixel rendering, Kraken's Wake CI skip
  game-prewarm.spec.ts          # Prewarm data attributes + WARM_CACHE + single-installer + dedup
  site-theme.spec.ts            # Visual smoke + prewarm verification
  mobile-visual-polish.spec.ts # Mobile visual layout/contrast (header, nav, game card footer, badges, chips, CTAs)
  mobile-game-layout.spec.ts    # Canvas positioning, touch control sizing
  mobile-navigation.spec.ts    # Back-to-Arcade link visibility and navigation
  mobile-drag-controls.spec.ts  # Drag-zone input verification
  mobile-touch-playability.spec.ts # Tap/hold/action button E2E
  mobile-controls-regression.spec.ts # iOS Safari classList.contains bug
  a11y.spec.ts                  # Accessibility (axe-core, ~7 tests)
  TESTING_CHECKLIST.md          # Manual real-device checklist
```

### Projects

`playwright.config.ts` defines seven browser projects:

- `chromium-desktop` — Desktop Chrome (Playwright `Desktop Chrome`)
- `firefox-desktop` — Desktop Firefox
- `webkit-desktop` — Desktop Safari (Playwright `Desktop Safari`)
- `mobile-chrome` — Pixel 5 profile
- `mobile-safari` — iPhone 13 profile
- `ipad-safari` — iPad Safari (portrait)
- `ipad-landscape` — iPad Safari (landscape)

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
- `dispatchTouchSequence(page, touchPoints, holdMs, options?)` — dispatches
  `pointerdown`/`pointerup` events to `#touch-overlay`,
  matching the pointer event handlers in
  `public/play/shared/mobile-controls.js`. Can also fire
  `lostpointercapture`/`pointercancel`/`pointerleave` for regression
  coverage (iPhone Safari teardown bug).
- `pointerHoldButton(page, selector, holdMs, options?)` — dispatches
  pointer events against a specific button locator, using its bounding
  box for `clientX/clientY`. Fire optional `lostpointercapture` teardown.
- `getCanvasPixelSample(page, w, h)` — returns `ImageData` for byte-
  level before/after comparison.
- `pointerTouchTap(page, x, y, options?)` — dispatches
  `pointerdown`/`pointerup` with `pointerType: "touch"` at absolute
  viewport coordinates. For tapping buttons at known positions.
- `pointerTouchDrag(page, points, options?)` — dispatches
  `pointerdown` at first point, `pointermove` at each intermediate,
  `pointerup` at final point. All coords are absolute viewport
  `clientX/clientY`. Use for simulating drag-zone interactions.
- `topElementAtCenter(page, selector)` — finds the top-most element
  at the center of a selector's bounding box. Useful for verifying
  which element receives touch events at drag-zone center points.
- `installDialogCapture(page)` — overrides `window.alert/confirm/prompt`
  via `addInitScript` before any page JS runs. Call BEFORE `page.goto()`.
- `dialogWasCalled(page)` — checks whether any dialog was raised.
- `hasJavaScriptDialogs(page)` — **deprecated.** Temporarily overrides
  `window.alert/confirm/prompt` and reports whether any were called.
  Prefer `installDialogCapture` + `dialogWasCalled`.

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
- Hardware-mediated orientation events
- Real GPU rasterization performance

For these, see [`tests/TESTING_CHECKLIST.md`](tests/TESTING_CHECKLIST.md).
It walks through what to check on a real iPhone, Android device, and
iPad before each release.

---

## Browser game screenshots

The 4 production browser-game screenshots
(`public/images/screenshot-{cannonball-clash,treasure-cove,krakens-wake,race-to-treasure-island}.png`)
are committed static assets at 1280×720. They are NOT generated at
build time or on user devices — they are refreshed manually when a
game's visuals, theming, or boot path changes.

### Capture (real in-game frames)

```sh
npm run capture:screenshots
```

Chained as: `astro build && node scripts/capture-browser-game-screenshots.mjs`.

The script (`scripts/capture-browser-game-screenshots.mjs`):

1. Starts `astro preview` on `127.0.0.1:4321` (override with
   `PA_CAPTURE_HOST` / `PA_CAPTURE_PORT`).
2. For each of the 4 browser-playable games, launches a headless Chromium context at
   `1280×720` viewport, navigates to `/play/<id>/`, clicks once to
   unlock audio and create a user gesture for autoplay, waits for:
   - `__paBootMetrics["game-ready"]` set
   - `#game-loading.hidden` class added
   - `canvas#canvas` sized (>100×100) and `visibility: visible`
3. Hides the shell UI overlays (`#back-link`, `#controls-hint`,
   `#infobox`, `#touch-overlay`), presses the per-game start key
   (Enter for cannonball & krakens, Space for treasure), waits 3s for
   a few gameplay frames to render, re-hides any UI that re-appeared.
4. Reads `canvas.toDataURL("image/png")` in the page, decodes the
   dataURL in Node, resizes the 1600×900 internal frame down to
   1280×720 via Sharp (already a dependency), and writes the PNG.
5. Stops `astro preview` (always).

Per-game start key, ready-timeout (90s), and post-start settle (3s)
are constants at the top of the script. Console errors during
capture are logged but non-fatal; the "PyMain: BrowserFS not found"
warning is expected (Pygbag internal noise).

### Validate (no-dep PNG IHDR parser)

```sh
npm run test:screenshot-assets
```

Asserts for each of the 4 browser PNGs:

- File exists at the expected path.
- File size is 5 KB – 2 MB.
- Valid PNG signature (8-byte magic).
- IHDR width ≥ 1280, height ≥ 720, aspect within 2% of 16:9.
- Bit depth 8, color type 2 (RGB) or 6 (RGBA).
- All 4 are byte-distinct (SHA-256 mismatch check).

Exits 0 on success, 1 on any failure. Included in
`verify:release:fast`.

### When to refresh

- A game gained or lost a major visual element (e.g. new paddle
  shape, new brick row, new nebula).
- A game's boot path changed and the previous screenshot might be a
  loading screen or stale state.
- A Pygbag/pythons.js version bump changed canvas behavior
  (resolution, alpha channel, etc.).

Do not refresh for small gameplay tuning — the validator is strict
on dimensions/ratio but the screenshots stay valid across minor
visual tweaks.

### Port Royale Tycoon

Desktop-only. The desktop screenshot in
`public/images/screenshot-port-royale-tycoon.png` is produced by
`scripts/capture-screenshots.py` (SDL_VIDEODRIVER=dummy + Pillow).
**Do not capture it from `/play/`** — there is no browser shell for
that game.

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

---

## Recent changes (2025-06-14)

### Debug panel (`public/play/shared/debug-panel.js`, `debug-panel.css`)

A unified debug panel for all Pygbag game shells. Activates via `?debug=1` or `?debugPanel=1`. Provides 5 tabs:

1. **Input Bridge** — held keys, event log, bridge calls, DOM events
2. **Python Bridge** — key/touch event counts, last key, bridge availability
3. **Game State** — live state from DOM bridge (`#pa-game-state`)
4. **Boot Metrics** — `__paBootMetrics` timings
5. **Actions** — quick buttons: Release Inputs, Copy Diagnostics, Reload, Back to Arcade

Features: tab persistence, auto-refresh (500ms), close lifecycle cleanup, iPad-safe layout, copy-to-clipboard diagnostics.

### Game-state bridge (`public/play/shared/pygame-input-bridge.js`)

Python→JS bridge now uses a DOM element (`#pa-game-state`) written via Pygbag's `_w` proxy. Replaces broken file-I/O path.

- **Read order:** `window.__pa_game_state_json` → `#pa-game-state` → Python file fallback
- **Bridge metadata:** `PirateArcadeGameState.getMeta()` returns `{ source, lastUpdatedAt, parseErrorCount, stale }`
- **Python writers** in each game's `_update()` push state to `_w["pa-game-state"].innerText`

### Ball speed tuning

- **Pong (Cannonball Clash):** `BALL_SPEED_INITIAL` 500 → 650
- **Breakout (Treasure Cove):** `BALL_BREAKOUT_SPEED` 450 → 650
- Progression unchanged: Pong `BALL_SPEED_INCREMENT=0.05`, `BALL_MAX_SPEED=1200`; Breakout `BALL_BREAKOUT_SPEED_INCREMENT=0.02`, `BALL_BREAKOUT_MAX_SPEED=800`
- Rally counting added to Pong (`rallyCount` resets per round)

### Pending tap timer tracking

`PirateArcadeInput.tap()` now tracks timers in `_pendingTaps`. `releaseAll(reason)` cancels all pending taps to prevent delayed duplicate key-ups. `getState()` exposes `pendingTapKeys` and `pendingTapCount`.

### Action labels

`PirateArcadeActions.getLabel()` returns phase-aware labels:

- **Menu:** `START` (Pong/Asteroids), `LAUNCH` (Breakout)
- **Playing:** `ACTION` (Pong), `LAUNCH` (Breakout), `FIRE` (Asteroids)
- **Game-over:** `PLAY AGAIN`
  Labels update automatically via `PirateArcadeGameState` subscription in `mobile-controls.js`.

### iPad test cleanup

- Removed conditional assertions (`if (stateBefore && stateAfter)`)
- Removed early returns after required assertions (`if (!box) return`)
- All outcome tests now require explicit state and numeric diffs

## Recent changes (2025-06-14)

### Treasure Cove — Fortress Siege + 3-stage system

- **Data model**: `self.ball` → `self.balls: list[Ball]`, `self.stage` (1-3), `self.max_stage=3`
- **Stage speeds**: 650 (Stage 1 Outer Wall) → 700 (Stage 2 Inner Fortress) → 750 (Stage 3 Treasure Vault)
- **4 brick types**: Standard (1-hit), Reinforced (2-hit, `BRICK_REINFORCED=1`), Powder-Keg (`BRICK_POWDER_KEG=2`, chain-explosion 1.5× grid radius, max 20 bricks), Treasure (`BRICK_TREASURE=3`, drops falling pickup)
- **Falling pickups** (`Pickup` class in `pickup.py`): Multiball (gold, creates 2 extra balls), Wide Paddle (cyan, 1.6× width, 8s), Slow Seas (green, 72% speed, 6s). Fall speed 180, lifetime 8s, label banner on collection.
- **Multi-ball**: `ball.clone()` with ±30–45° angle offsets, 3-ball cap, life lost only on final ball
- **Stage transition**: `stage_transition_phase` ("breached"→2s→"enter"→1.5s→playing), `run_complete` flag
- **HUD**: Stage (1/3), ball count when >1, power-up remaining time, crew lives (♠), score popups, flash panel

### Cannonball Clash — Rally Fever + Cursed Powder

- **Rally Fever**: Milestones at rally 5/10/15/20 (`RALLY_MILESTONES=[5,10,15,20]`); labels: RALLY 5, CANNONBALL FEVER, HIGH SEAS RALLY, LEGENDARY RALLY; ball glow tint tiers (gold→orange→red→magenta); trail length and particle count increase per tier
- **Cursed Powder**: `POWERUP_TYPE_CURSED_POWDER=1`, shrinks AI paddle to 65% height for 7s (purple icon/visual), timer refresh on recollect
- **Two pickup types**: Large paddle (gold chest) and Cursed Powder (purple icon, `POWERUP_SYMBOLS`)
- **AI paddle**: Height restored on timer expiry, pulse border while shrunk
- **Extended game state bridge**: `currentRally`, `longestRally`, `rallyTier`, `powerupType`, `aiShrinkActive`, `aiShrinkRemainingMs`

### Game state bridge (extended)

Both games now expose extended JSON dumps with:

- Treasure Cove: `stage`, `maxStage`, `ballsActive`, `ballSpeeds`, `underlyingBallSpeed`, `effectiveBallSpeed`, `bricksRemaining`, `standardBricksRemaining`, `reinforcedBricksRemaining`, `powderKegsRemaining`, `treasureBricksRemaining`, `fallingPickupCount`, `lastPickupType`, `widePaddleActive`, `widePaddleRemainingMs`, `slowMotionActive`, `slowMotionRemainingMs`, `stageTransitionActive`
- Cannonball Clash: `currentRally`, `longestRally`, `rallyTier`, `powerupType`, `aiShrinkActive`, `aiShrinkRemainingMs`
