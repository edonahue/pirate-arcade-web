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

- [ ] `◀ ▶` buttons appear on left and right of screen
- [ ] Hold the left arrow — paddle moves **up** (game-aware `data-controls="pong"`)
- [ ] Hold the right arrow — paddle moves **down** (game-aware `data-controls="pong"`)
- [ ] `⏎` (action) button works for menu confirm
- [ ] `❚❚` (pause) button toggles pause
- [ ] `▲ ▼` (menu up/down) buttons appear and work in menu
- [ ] Touch-and-hold is responsive (no 500ms delay between tap and hold)
- [ ] Verify that ArrowDown is NOT dispatched when pressing the left/right
      buttons (Pong mode only dispatches ArrowUp/ArrowDown, not ArrowLeft/ArrowRight)

### 6. Treasure Cove - desktop controls

- [ ] `ArrowLeft` / `A` moves the paddle left
- [ ] `ArrowRight` / `D` moves the paddle right
- [ ] `Space` launches the ball
- [ ] `Escape` pauses and resumes
- [ ] `Enter` confirms menu options

### 7. Treasure Cove - mobile touch controls

- [ ] `◀ ▶` buttons appear and move the paddle left/right on hold
      (game-aware `data-controls="breakout"`)
- [ ] `⏎` launches the ball and confirms menu options
- [ ] `❚❚` toggles pause
- [ ] `▲ ▼` work in menu
- [ ] Verify that ArrowUp/ArrowDown are NOT dispatched when pressing
      left/right (Breakout mode only dispatches ArrowLeft/ArrowRight)

### 8. Audio

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

### 15. CSP headers

- [ ] Open DevTools -> Network -> click the page request
- [ ] Inspect Response Headers
- [ ] `Content-Security-Policy` is present
- [ ] For `/play/cannonball-clash/` and `/play/treasure-cove/`:
      the CSP includes `script-src ... 'unsafe-eval' ...` (required
      for Pygbag runtime)
- [ ] The CSP for game routes does NOT contain a comma-separated
      duplicate from the global `/*` rule (if it does, the `!` detach
      in `_headers` is broken)
- [ ] No `unsafe-eval` leaks to other routes (e.g. `/`, `/play/`)

### 16. CSP fix verification (post-`_headers` deployment)

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
- [ ] Repeat for `/play/treasure-cove/` and `/play/krakens-wake/`
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
