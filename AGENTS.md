# Pirate Arcade Web — Agent Guide

## Project

Static Astro 6 site on Cloudflare Pages free tier. Python/Pygame desktop games in a separate repo. Everything runs on local hardware, free models, and free-tier infra.

## Brand voice

Modern pirate arcade + public builder notebook. Playful but not cheesy. Honest about what works and what's experimental. No ads, tracking, accounts, or paid services.

## Critical fragility

- `public/play/*` — browser-game shells. Pinned Pygbag CDN version (0.9.3). Never edit without Playwright validation.
- Pygbag shells (`cannonball-clash`, `treasure-cove`, `krakens-wake`) are **generated** from `scripts/pygbag-shell-template.mjs` + `scripts/pygbag-game-config.mjs`. Hand-editing generated shells is forbidden. Regenerate via `npm run generate:pygbag-shells`.
- `public/play/shared/pygbag-loading.js` — single authoritative `PirateArcadeLoading` API (30s slow timer, retry button, no "Error:" prefix). The bridge (`pygame-input-bridge.js`) no longer defines or replaces it.
- `public/_headers` — per-route CSP. `unsafe-eval` only on game routes (`/play/*`). Keep global CSP strict.
- `public/sw.js` — classic service worker (no `import`). CACHE_VERSION inlined by build script. WARM_CACHE listener at top scope.
- `src/data/games.json` — source of truth. Browser-playable entries have `browserUrl`, desktop-only entries don't.
- `ASSET_VERSION` from `scripts/game-asset-versions.mjs` — must use for versioned archive URLs. No hardcoded versions.
- `public/images/screenshot-*.png` — committed static production assets. Refresh only via `npm run capture:screenshots`; do not hand-edit or generate at build time.

## Validation

See [MAINTENANCE.md](./MAINTENANCE.md) for detailed documentation.

Before pushing, run:

```sh
npm run verify:release:fast   # all deterministic checks, ~2 min
```

Or for a full validation including Playwright:

```sh
npm run verify:release:full   # adds a11y, mobile, iPad, theme, browser game tests
```

## Browser game screenshots

Production screenshots for the 3 browser-playable games
(`cannonball-clash`, `treasure-cove`, `krakens-wake`) live in
`public/images/screenshot-<id>.png` as 1280×720 PNGs. They are committed
static assets — no runtime generation on user devices.

**Regenerate** when a game's visuals, theming, or Pygbag boot path
changes meaningfully:

```sh
npm run capture:screenshots  # builds + boots astro preview + Playwright captures
npm run test:screenshot-assets  # IHDR/size/distinctness validator
```

The capture script (`scripts/capture-browser-game-screenshots.mjs`)
boots each game shell in headless Chromium, waits for
`__paBootMetrics["game-ready"]` + `#game-loading.hidden` + a sized
visible canvas, hides the shell UI overlays, presses the per-game
start key (Enter / Space), waits ~3s for gameplay frames, then reads
`canvas.toDataURL("image/png")` and resizes 1600x900 → 1280x720 via
Sharp. The validator (`scripts/check-screenshot-assets.mjs`) is a
no-dep PNG IHDR parser that asserts: file exists, size 5 KB–2 MB,
width ≥ 1280, height ≥ 720, aspect within 2% of 16:9, 8-bit RGB or
RGBA, and all 3 are byte-distinct. It also decompresses IDAT data
with built-in zlib to check pixel brightness and diversity (catches
blank/dark screenshots).

Port Royale Tycoon is desktop-only and uses a separate desktop
screenshot — do not capture it from `/play/`.

## Game data notes

- Browser-playable: cannonball-clash, treasure-cove, krakens-wake, race-to-treasure-island (from `games.json`)
- Desktop-only: port-royale-tycoon
- Race to Treasure Island is web-native Phaser 3 (not Pygbag) — loads instantly, no WASM download
- Prewarm uses passive touchstart, no `preventDefault()`
- `__paCanvasLayout`, `__paBootMetrics`, `PirateArcadeInput` are runtime globals from shared scripts
- Race-to-Treasure-Island has additional globals: `window.game`, `window.testEvents` (Phaser game instance and test hooks)
- ADR 0001 (`docs/adr/0001-fourth-browser-game-architecture.md`): Original Pygbag recommendation (superseded)
- ADR 0002 (`docs/adr/0002-race-to-treasure-island-phaser.md`): Race to Treasure Island Phaser decision
- Onboarding steps in `docs/new-browser-game-checklist.md` (22-step checklist; supports both Pygbag and Phaser paths)
- Scaffold tool: `scripts/create-browser-game-scaffold.mjs` (dry-run-first, requires `--apply`)

## Constraint reminders

- Plan mode first for multi-file changes
- Vanilla CSS via tokens — no Tailwind or CSS-in-JS
- Never add paid cloud services or backends
- Every game is a data point in the AI experiment
- `dependencies` intentionally contains **phaser** (needed by Race to Treasure Island at runtime/build time); all other packages in `devDependencies`
- Adding a dev-dep requires updating both `package.json` and `ALLOWED_DEV_DEPS` in `check-dependency-hygiene.mjs`

## Architecture notes (new)

### Structured game config (Phase 1)

`scripts/pygbag-game-config.mjs` now uses structured fields instead of a monolithic `moduleImport` string:

- `pythonModule`: Python module path (e.g., `"games.pong.game"`)
- `gameClass`: Class name to instantiate (e.g., `"PongGame"`)

Template generates `from ${pythonModule} import ${gameClass}` at runtime.

### Boot contract validation (Phase 2)

`scripts/check-pygbag-boot-contract.mjs` validates:

- Required `sys.path.insert(0, a)` before game module import
- Required `os.chdir(a)` to set working directory for assets
- Import statement appears AFTER both path/chdir (correct resolution order)

### Loading API policy (Phase 3)

`public/play/shared/pygbag-loading.js` is the single authoritative source:

- Platform-neutral copy (no iPad-specific wording)
- Ownership marker: `__pirateArcadeOwned: true`
- Stable error state: once `error()` called, `set()`/`ready()` are no-ops
- Idempotent: double-setup guard, double-error guard
- Body-attachment verification for lazy element lookups
- Sets `__paBootMetrics.playable` after `ready()` + game state confirms running phase

### Asset version consistency (Phase 4)

`DEBUG_PANEL_VERSION` in template now references `ASSET_VERSION` directly (no separate constant).

### Generator usability (Phase 5)

`scripts/generate-pygbag-shells.mjs` improvements:

- Unchanged-file detection (skips write when content matches)
- Dry-run shows per-file diff summary
- Warning header in generated output

### Playable-readiness telemetry (Checkpoint 2)

- `__paBootMetrics["playable"]` boolean flag set after loader hidden + game phase ≠ loading/menu
- Performance test (`game-load-performance.spec.ts`) asserts `playable === true`
- Test game lists derived from `games.json` (no hardcoding)

## Validation auto-discovery

Several validators derive game lists from `games.json` and will catch
missing entries if you forget to update related files:

| Validator                         | What it catches                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `check-cloudflare-headers.mjs`    | Missing CSP entries in `_headers`                                                                           |
| `check-service-worker-compat.mjs` | Missing ASSETS_TO_CACHE or `isGameShell` paths in `sw.js`                                                   |
| `check-browser-game-shells.mjs`   | Missing shell files, CSP, SW cache entries                                                                  |
| `seo-audit.mjs`                   | Missing browserUrl, screenshot, llms.txt, sitemap coverage                                                  |
| `check-pygbag-boot-contract.mjs`  | Missing Python boot phases, wrong ordering, structural invariants (sys.path.insert, os.chdir, import order) |
| `check-pygbag-shell-drift.mjs`    | Hand-edited generated shells (in-memory render mismatch)                                                    |

## Copy & Tone

- Follow `COPY_GUIDE.md` for tone zones, vocabulary, and banned words
- Run `npm run test:copy-tone` or `npm run verify:release:fast` before pushing
- Update game status in `src/data/games.json` only — single source of truth
