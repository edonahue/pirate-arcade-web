# Pirate Arcade Web — Agent Guide

## Project

Static Astro 7 site on Cloudflare Pages free tier. Python/Pygame desktop games in a separate repo. Everything runs on local hardware, free models, and free-tier infra.

## Brand voice

Modern pirate arcade + public builder notebook. Playful but not cheesy. Honest about what works and what's experimental. No ads, tracking, accounts, or paid services.

## Critical fragility

- `public/play/*` — browser-game shells. Pinned Pygbag CDN version (0.9.3). Never edit without Playwright validation.
- Pygbag shells (`cannonball-clash`, `treasure-cove`, `krakens-wake`) are **generated** from `scripts/pygbag-shell-template.mjs` + `scripts/pygbag-game-config.mjs`. Hand-editing generated shells is forbidden. Regenerate via `npm run generate:pygbag-shells`.
- `scripts/pygbag-boot-program.mjs` — single authoritative Python boot program renderer. All generated boot code flows through `renderPythonBootProgram(config)`. Consumed by shell template, boot contract validator, unit tests, and mock harness. `BOOT_MARKS`, `FAILURE_STAGES`, `CRITICAL_ORDER` are canonical exports used by both test and production validators.
- `scripts/check-pygbag-boot-contract.mjs` now checks the rendered Python source directly (via `BOOT_MARKS`) instead of regex-parsing shell HTML for phase ordering/structural checks. JS-side phases still come from the shell. Full shell-to-source equivalence is covered by the drift checker.
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
- Race to Treasure Island is web-native Phaser 4.2 (not Pygbag) — loads instantly, no WASM download
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

- Python-side phases and ordering checked against `renderPythonBootProgram(config).source` (via canonical `BOOT_MARKS`)
- Required `sys.path.insert(0, a)` before game module import
- Required `os.chdir(a)` to set working directory for assets
- Import statement appears AFTER both path/chdir (correct resolution order)
- JS-side phases still checked from the shell inline script
- Shell gameCode extractability verified (full equivalence covered by drift checker)

### Loading API policy (Phase 3)

`public/play/shared/pygbag-loading.js` is the single authoritative source:

- Platform-neutral copy (no iPad-specific wording)
- Ownership marker: `__pirateArcadeOwned: true`
- Stable error state: once `error()` called, `set()`/`ready()` are no-ops
- Idempotent: double-setup guard, double-error guard
- Body-attachment verification for lazy element lookups
- `ready()` only handles loader-hidden state; playability is tracked separately (see Playable-readiness telemetry)

### Asset version consistency (Phase 4)

`DEBUG_PANEL_VERSION` in template now references `ASSET_VERSION` directly (no separate constant).

### Lazy state publication (Checkpoint 3 — post-Phase-5)

`scripts/pygbag-port/shared/pa_state.py` — `StatePublisher` with lazy API:

- **`tick(dt, event_key, state_factory, active)`**: `state_factory` is a callable invoked only when publication is due. `event_key` is a cheap tuple of discrete scalars used for immediate-event detection. `active` controls heartbeat — static phases (`active=False`) suppress continuous publication.
- **`force_publish(state_factory=None, state_dict=None)`**: one-shot publish.
- **`stats_snapshot()`**: serializes counters on demand. Accessible from JS via `PirateArcadeGameState.getPublisherStats()`.

Each game implements:

- `_state_event_key()`: returns tuple of discrete values (phase, score, lives, etc.) — no continuous values like positions or speeds.
- `_build_game_state()`: returns full state dictionary — called only when publisher decides to publish.

Event-key values that trigger immediate publish across all games: phase changes, paused toggle, score, lives, launch state, action-ready, bricks remaining, stage, stage transitions, pickup types, power-up types, AI shrink state, paddle-wide/slow-motion active flags.

Continuous values excluded from event keys (still present in full state): paddle/ship position, ball/ship speed, remaining timer ms, projectile count, ball speed arrays, ship angle.

Active phases (`active=True`): `playing` (all games).
Static phases (`active=False`): `menu`, `paused`, `game-over`, `stage-transition`.

Backward compatibility: no `active`/`state_factory` support if omitted (graceful noop — state not published without factory).

Publisher stats (`__pa_stats` in every published payload) include: `updateCalls`,
`eventChanges`, `intervalSkips`, `serializationAttempts`, `unchangedPayloadSkips`,
`builtinsWrites`, `domWrites`, `domWriteFailures`, `forcedWrites`, `heartbeatWrites`,
`configuredActiveHz`, `lastWriteReason`, `stateFactoryCalls`, `statsSnapshotCalls`,
`activeTicks`, `staticTicks`, `stateBuildSkips`, `draws`, `presentations`.

### Loop architecture (Pygbag games)

All three games share the same loop pattern (`pa_loop.py` provides `should_draw()`
and `page_hidden()`):

```
while True:
    process_events()
    update(dt)  # fixed dt=1/60
    if should_draw(current_key, last_draw_key):
        draw()
    pg.display.flip()
    await asyncio.sleep(0)
```

Static states (menu, paused, game-over) suppress draws via should_draw() —
the draw key is a tuple of discrete visual state values (selection, toggles).
Active play always draws. `draws` and `presentations` counters track actual
render work in `__pa_stats`. Active pacing not needed — loops naturally run
at ~60 Hz (~27 Hz for Kraken's Wake) via Pygbag's cooperative scheduler.

### Generator usability (Phase 5)

`scripts/generate-pygbag-shells.mjs` improvements:

- Unchanged-file detection (skips write when content matches)
- Dry-run shows per-file diff summary
- Warning header in generated output

### Playable-readiness telemetry (Checkpoint 2)

Three truthful milestones with distinct semantics:

- **`game-ready`**: Python boot completed; game object exists; menu may still show.
- **`loader-hidden`**: Loading overlay gone; game can be viewed/interacted; menu may show.
- **`active-play`**: Game-state bridge (`PirateArcadeGameState`) confirms real gameplay phase
  (`phase === 'playing'`). Marked ONCE via `markOnce()`.
- **`first-user-input`**: First meaningful keyboard/touch input accepted by Python bridge.
  Marked ONCE on successful bridge call (keyDown with ok=true, or setTouchTarget with active=true).

`playable` flag is kept as a compatibility convenience — derived from `active-play` having occurred.
Performance test (`game-load-performance.spec.ts`) asserts `flags.activePlay === true`.
Test game lists derived from `games.json` (no hardcoding).

Game-state observer lives in `pygame-input-bridge.js`: single 500ms polling owner, subscribes
to `PirateArcadeGameState.subscribe()`, stops on `pagehide`. `ready()` in pygbag-loading.js no
longer determines whether gameplay has begun — owns only loader-hidden state.

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
