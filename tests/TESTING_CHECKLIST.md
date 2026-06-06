# Manual Real-Device Smoke Test Checklist

This is a companion to the Playwright test suite in
`tests/browser-games.spec.ts` and `tests/a11y.spec.ts`. Playwright
emulates iOS Safari and Android Chrome, but real devices behave
differently for several things that matter for these games:

- Audio autoplay policies are stricter on real iOS Safari
- Touch event timing, gesture model, and overscroll behave differently
- Pygbag/WASM has known issues on real iOS that emulated WebKit masks
- Orientation lock CSS `@media (orientation: portrait)` is reliable
  on emulated mobile, but real device orientation transitions have
  timing quirks
- Hardware acceleration / GPU rasterization differences affect WASM
  performance

Use this checklist before each release to catch what automation misses.

## When to run this checklist

- Before merging a change to Pygbag CDN version
- Before merging a change to `public/_headers` (CSP)
- Before merging a change to `public/play/shared/mobile-controls.js`
- Before merging a change to `public/play/shared/mobile-controls.css`
- Before each Cloudflare Pages deploy that touches `public/play/`

## Devices to test

At minimum, run through this on:

- iPhone (latest iOS, Safari) - real device, not simulator
- Android (latest, Chrome) - real device
- iPad (latest iOS, Safari) - real device
- Desktop (Chrome, Firefox, Safari) - any of these is fine

## Per-game, per-device checklist

### 1. Page load (cold cache)

- [ ] Open the game URL in a private/incognito window
- [ ] Confirm the page returns 200 (no 404 or 5xx)
- [ ] Confirm the Python/Pygame runtime download starts within 5 seconds
- [ ] Confirm the progress bar reaches 100%
- [ ] Note the wall-clock time from page open to first frame; should
      be under 60 seconds on a typical broadband connection

### 2. Initial DOM state

- [ ] `#infobox` is centered on screen and shows the loading message
- [ ] `#back-link` is in the top-left, fixed, and links to `/play/`
- [ ] `#controls-hint` is at the bottom-center, fixed
- [ ] `#canvas` exists and is 1x1 pixels initially
- [ ] On mobile: `#rotate-device` overlay is hidden in landscape
- [ ] On mobile: `#touch-overlay` is visible after the runtime starts

### 3. Game start (user gesture)

- [ ] Tap or click the canvas
- [ ] Audio is unlocked (try: hit a wall, fire a cannon, etc.)
- [ ] Press Enter to start a new game (from menu)
- [ ] Game state transitions from menu -> playing within 2 seconds

### 4. Cannonball Clash - desktop controls

- [ ] `ArrowUp` / `W` moves the right paddle up
- [ ] `ArrowDown` / `S` moves the right paddle down
- [ ] `Space` pauses and resumes
- [ ] `Escape` pauses and resumes
- [ ] `Enter` confirms menu options

### 5. Cannonball Clash - mobile touch controls

- [ ] Drag zone on left side of screen allows sliding ship up/down
- [ ] `▲ ▼` nudge buttons appear on left and move ship up/down
- [ ] `START` pill button (lower-right, not center) works for menu confirm
- [ ] `START` is NOT a large orange circle centered over the canvas
- [ ] `❚❚` (pause) button toggles pause
- [ ] Tap `START` then slide vertically on the drag zone to control paddle
- [ ] After gameplay starts, `START` fades away (opacity 0, pointer-events none)
- [ ] Touch-and-hold is responsive (no 500ms delay between tap and hold)
- [ ] Verify that ArrowDown is NOT dispatched when pressing the up nudge
      button (Pong mode only dispatches ArrowUp/ArrowDown, not ArrowLeft/ArrowRight)

### 6. Treasure Cove - desktop controls

- [ ] `ArrowLeft` / `A` moves the paddle left
- [ ] `ArrowRight` / `D` moves the paddle right
- [ ] `Space` launches the ball
- [ ] `Escape` pauses and resumes
- [ ] `Enter` confirms menu options

### 7. Treasure Cove - mobile touch controls

- [ ] Drag zone on bottom of screen allows sliding longboat left/right
- [ ] `◀ ▶` nudge buttons appear and move the longboat left/right on hold
      (game-aware `data-controls="breakout"`)
- [ ] `LAUNCH` pill button (lower-right, not center) launches ball
- [ ] `LAUNCH` is NOT a large orange circle centered over the canvas
- [ ] `❚❚` toggles pause
- [ ] Verify that ArrowUp/ArrowDown are NOT dispatched when pressing
      left/right (Breakout mode only dispatches ArrowLeft/ArrowRight)
- [ ] Verify that sliding the drag zone moves the longboat smoothly

### 8. Kraken's Wake - desktop controls

- [ ] `ArrowLeft` / `A` rotates the ship port (counter-clockwise)
- [ ] `ArrowRight` / `D` rotates the ship starboard (clockwise)
- [ ] `ArrowUp` / `W` applies thrust
- [ ] `Space` fires cannons
- [ ] `Escape` pauses and resumes
- [ ] `P` toggles pause
- [ ] `Enter` confirms menu options

### 9. Kraken's Wake - mobile touch controls

- [ ] `◀ ▶` rotation nudge buttons appear and rotate ship on hold
- [ ] `THRUST` button (lower-right, large circle) applies thrust on hold
- [ ] `FIRE` button (bottom-center) fires cannons
- [ ] `❚❚` pause button toggles pause
- [ ] `▲ ▼` menu navigation buttons work in menu/pause screens
- [ ] After ship destruction, the game-over/menu state is navigable via touch
- [ ] Pause + resume via touch does not leave stuck thrust or rotation

### 10. Pause button (all games, special attention)

- [ ] On each game, tap `❚❚` during gameplay
- [ ] Confirm the pause overlay/menu appears (game is visibly paused)
- [ ] Tap `❚❚` again (or tap Resume) to unpause
- [ ] Game state resumes correctly (no stuck keys, no frozen frame)
- [ ] Repeat sequence: play → pause → resume → play (3 cycles)
- [ ] Pause does not trigger any movement/action/drag zone behavior
- [ ] `#back-link` remains tappable while pause overlay is showing
- [ ] On Kraken's Wake specifically: pause then fire/thrust still works after resume
- [ ] On Cannonball Clash specifically: pause then paddle movement still works after resume
- [ ] On Treasure Cove specifically: pause then paddle movement and ball launch still work after resume

### 11. Audio

- [ ] First user interaction unlocks audio (browser policy)
- [ ] Sound effects are audible during gameplay
- [ ] No audio before user interaction (verify with audio panel
      showing "blocked" or silence)
- [ ] Audio remains consistent after pausing and resuming
- [ ] Audio resumes after switching tabs and returning

### 9. Loading overlay and viewport fitting (mobile only)

- [ ] On first load, `#game-loading` overlay is centered with spinner
      and title text
- [ ] After the game loads, the overlay fades away and the canvas is
      visible with correct aspect ratio (16:9, not stretched)
- [ ] On iPhone Safari landscape (~932 CSS px wide), the canvas should
      have inset CSS width/height to maintain 16:9, not `100%` width
- [ ] Rotating the device re-fits the canvas within 500ms
- [ ] The `#game-loading` does not re-appear during gameplay
- [ ] On desktop: loading overlay should NOT appear (no `mobile-touch`
      class on body, `game-viewport.js` still runs and fits canvas if
      touch is not detected, but the overlay is hidden immediately)

### 10. Orientation lock (mobile only)

- [ ] Hold the device in portrait -> rotate-device overlay appears
- [ ] Rotate to landscape -> overlay disappears
- [ ] Game is paused / hidden while in portrait
- [ ] Game resumes when rotating back to landscape

### 11. Background/foreground

- [ ] Switch to another app for 10 seconds, then return
- [ ] Game is still running, no error overlay
- [ ] Audio resumed appropriately (paused if other app uses audio)
- [ ] Repeat with the device locked, then unlocked

### 12. Reload and refresh

- [ ] Reload the page (F5 / pull-to-refresh)
- [ ] Runtime downloads again from cache (should be <5s on warm cache)
- [ ] Game starts cleanly
- [ ] No console errors in Web Inspector / DevTools

### 13. Performance

- [ ] Frame rate is smooth (>30 FPS typical) on a mid-range device
- [ ] No visible stuttering during normal gameplay
- [ ] Memory usage stays stable over 5 minutes of play
      (check in browser dev tools)

### 14. Network errors

- [ ] Open DevTools Network tab
- [ ] All requests return 2xx (or expected redirects)
- [ ] No 4xx / 5xx on critical assets (tar.gz, wasm, css, js)
- [ ] No CSP violation reports in the console

### 14b. Caching behavior

- [ ] First cold load: game archive is fetched from network (Status 200)
- [ ] After SW install completes, reload the page
- [ ] Second load: game archive is served from cache (Status 200, `(from ServiceWorker)`)
- [ ] JS/CSS should show `(from ServiceWorker)` on repeat visits
- [ ] HTML page should show `(from ServiceWorker)` with `(from cache)` only if offline
- [ ] All SW-cached assets show correct cache strategy behavior

### 15. Debug mode (`?debugTouch=1`)

Append `?debugTouch=1` to any game URL to enable visual outlines and
console logging for touch controls. Example:

    https://pirate-arcade.com/play/krakens-wake/?debugTouch=1

This adds:

- Yellow outline on Back link area
- Cyan outline on drag zones
- Green outline on nudge buttons
- Yellow outline on action buttons
- Magenta outline on pause buttons
- Console logs for each touch event handler

Use this to:

- Verify the pause button receives pointer events
- Check if Back link is intercepting touches near the pause button
- Confirm drag zone boundaries don't overlap the pause button
- Log the exact sequence of pointer events during a tap

### 16. CSP headers

- [ ] Open DevTools -> Network -> click the page request
- [ ] Inspect Response Headers
- [ ] `Content-Security-Policy` is present
- [ ] For `/play/cannonball-clash/`, `/play/treasure-cove/`, and
      `/play/krakens-wake/`: the CSP includes
      `script-src ... 'unsafe-eval' ...` (required for Pygbag runtime)
- [ ] The CSP for game routes does NOT contain a comma-separated
      duplicate from the global `/*` rule (if it does, the `!` detach
      in `_headers` is broken)
- [ ] No `unsafe-eval` leaks to other routes (e.g. `/`, `/play/`)

### 17. CSP fix verification (post-`_headers` deployment)

- [ ] Open `https://pirate-arcade.com/play/cannonball-clash/` in a
      private tab after cache clear
- [ ] Open DevTools Console; confirm no `EvalError: Refused to evaluate
a string as JavaScript` error
- [ ] Confirm no `Content Security Policy` console errors
- [ ] Confirm the Pygbag runtime download starts (progress bar visible)
- [ ] If the game still does not load, capture the exact CSP header:
      `js
fetch(location.href).then(r => console.log(r.headers.get('content-security-policy')))
`
      The header should contain `'unsafe-eval'` exactly once; if it
      appears in a comma-merged list, the `!` detach is not working.
- [ ] Repeat for `/play/treasure-cove/`
- [ ] Run `node scripts/check-live-game-headers.mjs` from the repo

## Reporting issues

If you find a regression, capture:

- Device + OS version + browser version
- URL of the game
- Time to first frame
- Console errors / warnings
- Network failures
- Screenshot or screen recording
- A clear "Expected" vs "Actual" description

File as a GitHub issue with the label `bug: real-device` and link to
the relevant Playwright test if it should have caught this.

## Why Playwright is not enough

These specific things are NOT covered by the Playwright suite:

- iOS audio policy edge cases (real device, not emulated WebKit)
- Touch event timing (Playwright's tap is synthetic and instant)
- Hardware GPU behavior differences
- iOS Safari WASM JIT restrictions (real iOS throttles WASM)
- Background app behavior on iOS (Pygbag specifically)
- Pygbag `cross_file` fetch on real device (mobile Safari can be
  stricter about `fetch()` on cross-origin)
- Cloudflare Pages `_headers` header merging (same-CSP-policy stacking
  bug — `astro preview` does not serve `_headers`)

## Cold-load expectations

Cold loads (first visit, empty cache) are inherently slow because:

- The Pygbag/WASM runtime (~12 MB) must be downloaded from the CDN
- CPython must compile and initialize inside the WASM sandbox
- Pygame must be pip-installed from a prebuilt wheel
- The game archive must be fetched, extracted, and imported

On a typical broadband connection:

- desktop Chromium: 10–30s to `game-ready`
- emulated mobile: 20–60s to `game-ready`
- real device mobile: 30–90s (iOS Safari is slower due to WASM JIT limits)

Warm loads (service worker cached, runtime cached by browser):

- desktop: 3–8s
- mobile: 5–15s

Phase timing can be inspected via `window.__paBootMetrics` in the browser
console or attached to Playwright test reports.

## Boot phase metrics

The metrics API (`window.PirateArcadeMetrics`) records these phases:

| Mark name                | When                             |
| ------------------------ | -------------------------------- |
| `page-script-start`      | Inline script begins             |
| `pythons-js-requested`   | Pygbag script tag loads          |
| `python-ready`           | Python interpreter is available  |
| `boot-start`             | Python `boot()` coroutine starts |
| `pygame-install-start`   | `pip_install("pygame")` starts   |
| `archive-fetch-start`    | Game archive fetch starts        |
| `pygame-install-end`     | Pygame install completes         |
| `archive-fetch-end`      | Archive download completes       |
| `archive-extract-start`  | tar.gz extraction begins         |
| `archive-extract-end`    | Extraction completes             |
| `display-init-end`       | `pygame.display.set_mode()` done |
| `input-bridge-installed` | Python key bridge is wired       |
| `game-object-created`    | Game class instantiated          |
| `game-ready`             | Game is ready to run             |
| `loader-hidden`          | Loading overlay hidden           |

Computed durations:

- `pygame-install-duration`, `archive-fetch-duration`,
  `archive-extract-duration`, `display-init-duration`,
  `total-to-python-ready`, `total-to-game-ready`,
  `total-to-loader-hidden`

The Playwright suite catches:

- DOM regression (missing elements, broken classes)
- WASM/Pygbag startup on desktop Chromium / Firefox / WebKit
- Console error pattern regressions (TypeError, CSP, etc.)
- Touch overlay element wiring
- Basic keyboard input routing
- a11y violations via axe-core
- Lighthouse performance regressions (via `@lhci/cli`)

### CSP/header gap: how we compensate

Because Playwright runs against `astro preview` (not Cloudflare), CSP
header merging bugs are invisible to normal browser tests. We use two
compensations:

1. **Static parser** (`scripts/check-cloudflare-headers.mjs`) — simulates
   Cloudflare's `_headers` matching algorithm, reads `public/_headers`,
   and asserts correct CSP per route. Run with `npm run test:check-headers`.
2. **Live header checker** (`scripts/check-live-game-headers.mjs`) — fetches
   the deployed site and inspects the actual `Content-Security-Policy`
   header. Run manually after each deploy.

---

## Post-Change Hardening Pass

Run these after any change to `public/sw.js`, game HTML files, asset
versions, mobile controls, or prewarm logic:

```bash
# 1. Apply current versions to static files
npm run apply:game-versions

# 2. Validate (static checks — no browser required)
npm run test:service-worker         # SW compat + cache versioning + HTML consistency
npm run test:archive-parity         # source matches shipped tarballs
npm run audit:game-archives         # archive size / suspicious file scan
npm run test:css-tokens             # all CSS var() references defined
npm run check:dependency-hygiene    # dep classification (dev vs runtime)

# 3. Browser E2E checks (chromium-desktop)
npm run test:site-theme             # visual smoke + prewarm verification
npm run test:game-prewarm           # prewarm data attributes + WARM_CACHE
npm run test:game-performance       # cold/warm load metrics

# 4. Mobile E2E checks
npm run test:mobile-layout          # canvas positioning, touch control sizing, __paCanvasLayout
npm run test:mobile-navigation      # back-to-arcade link visibility + tap
npm run test:mobile-drag            # drag-zone input (touch-like PointerEvents)
npm run test:mobile-playability     # tap/hold/action button E2E
npm run test:mobile-regression      # iOS Safari classList.contains bug
npm run test:mobile-input           # touch/orientation

# 5. Compare repo against live site (post-deploy, informational)
ALLOW_STALE_LIVE=1 npm run test:live-parity
```

### What each check guards against

| Check                      | Guards against                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test:service-worker`      | Broken SW (top-level imports, wrong cache name, WARM_CACHE lifecycle, ?v= queries)                                                                                  |
| `apply:game-versions`      | Stale version queries after bumping `game-asset-versions.mjs`                                                                                                       |
| `test:archive-parity`      | Source code changes not reflected in shipped archives                                                                                                               |
| `audit:game-archives`      | Suspicious files (`.DS_Store`, `.git/`, test files) in game tarballs                                                                                                |
| `test:css-tokens`          | Undefined CSS custom properties causing silent rendering issues                                                                                                     |
| `check:dependency-hygiene` | Misclassified dev dependencies leaking into runtime                                                                                                                 |
| `test:game-prewarm`        | Missing prewarm data attributes on CTAs, non-browser-playable prewarm bugs, duplicate prefetch links, version mismatch in data-game-archive, single-installer guard |
| `test:mobile-layout`       | Canvas-bound drag zones, `__paCanvasLayout` geometry, back-link z-index, drag-zone axis alignment to canvas region                                                  |
| `test:live-parity`         | Live site drift from repo — local checks are blocking, live is informational                                                                                        |

### Key patterns (WARM_CACHE, prewarm, touch helpers)

- **Centralized `/play/` prewarm**: A single `<script>` in `src/pages/play.astro` handles all prewarm logic. It uses `define:vars` to inject `ASSET_VERSION` (the build-time source of truth from `scripts/game-asset-versions.mjs`). It guards against duplicate installation via `window.__paGamePrewarmInstalled`. On `pointerenter`/`focus`/`touchstart` (passive, no `preventDefault()`), it inserts `<link rel="prefetch">` tags and sends a `WARM_CACHE` postMessage. Duplicate events per game ID are deduplicated. The old per-GameCard script was removed to prevent duplicate listeners and hardcoded versions.
- **WARM_CACHE lifecycle**: The SW's `message` listener must be at **top-level scope** (not nested inside `activate`). It validates same-origin, normalizes relative URLs, caches only HTTP 200 responses, and posts `WARM_CACHE_RESULT` back to the client. See `scripts/check-service-worker-compat.mjs` for the exact assertions.
- **`/play/` prewarm**: Browser-playable game CTAs (both GameCard and standalone) have `data-game-id`, `data-browser-playable="true"`, `data-game-page` (same-origin game URL), and `data-game-archive` (versioned `.tar.gz` URL). Hovering/focusing/touching triggers a single `<link rel="prefetch">` insertion per URL and a `WARM_CACHE` postMessage to the SW controller. Desktop-only games (`kraken`, `port-royale`) never fire prewarm.
- **Why `preventDefault()` is NOT called on `touchstart`**: The centralized prewarm script uses `{ passive: true }` for `touchstart`. Calling `preventDefault()` would block mobile navigation — the browser would not follow the link after the touch. Prewarm is opportunistic, not blocking.
- **Mobile touch helpers**: Use `pointerTouchTap`, `pointerTouchDrag`, and `pointerHoldButton` (all in `tests/helpers/browserGame.ts`) to dispatch `PointerEvent`s with `pointerType: "touch"` instead of `page.mouse` / `page.click`. These match the production `mobile-controls.js` handler exactly. Coordinate systems: `pointerTouchDrag` uses absolute viewport `clientX/clientY`; `pointerHoldButton` reads the button's bounding box automatically.
