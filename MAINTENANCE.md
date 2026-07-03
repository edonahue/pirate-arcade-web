# Maintenance

## Game data

`src/data/games.json` is the single source of truth for all games.
Browser-playable entries have `browserUrl`; desktop-only entries do not.
Game status (`browser-playable` / `desktop-available`) is read by the site
and by multiple scripts (`check-game-cache-versioning.mjs`,
`capture-browser-game-screenshots.mjs`, `check-screenshot-assets.mjs`).

**Rules:**

- Never hardcode a game list in a script — read from `games.json` and filter
  by `status === "browser-playable"`.
- Only `port-royale-tycoon` is desktop-only; do not mark it browser-playable
  unless a real browser build is published.
- Game IDs must match directory names in `public/play/<id>/`.

## Pygbag game shell generation

All three Pygbag game shells (`cannonball-clash`, `treasure-cove`, `krakens-wake`)
are **generated files** — never hand-edited.

### Source files

| File                                 | Purpose                                                       |
| ------------------------------------ | ------------------------------------------------------------- |
| `scripts/pygbag-game-config.mjs`     | Per-game parameters (title, module, touch overlay mode, etc.) |
| `scripts/pygbag-shell-template.mjs`  | HTML template renderer with all shared boilerplate            |
| `scripts/generate-pygbag-shells.mjs` | Generator entry point (dry-run without `--apply`)             |

### Regenerating

```sh
npm run generate:pygbag-shells   # regenerate and write shell files
```

### Drift check

`npm run test:pygbag-shell-drift` verifies that committed shell files
match what the generator produces. This is included in the fast release
gate and will fail if someone hand-edits a shell without regenerating.

### Archive hash / cache busting

Game archives are content-addressed via SHA-256. The archive builder
(`scripts/patch-browser-game-archives.mjs`) writes each tar.gz to a
temp path first, computes the SHA-256, and only overwrites the committed
archive when bytes differ. Each archive has a sidecar `.sha256` file.

The generated shell HTML embeds the SHA-256 hash in both the preload
`<link>` URL and the Python boot `fetch()` URL: `/play/<id>/<id>.tar.gz?h=<hash>`.
This ensures that any source change produces a new URL, forcing cache
invalidation on CDN and browser caches.

The `ARCHIVE_HASH` JavaScript variable in the shell is derived from the
same sidecar file. The boot contract validator checks that the preload
URL uses the content hash.

**Workflow:**

```sh
# 1. Build/update game archives (writes to temp, compares hash)
npm run patch:game-archives

# 2. Regenerate shells with new hash
npm run generate:pygbag-shells -- --apply

# 3. Verify parity (source ↔ archive, both directions)
npm run test:archive-parity

# 4. Run boot contract + drift checks
npm run test:pygbag-boot-contract
npm run test:pygbag-shell-drift
```

### Boot contract

`npm run test:pygbag-boot-contract` validates that each shell contains
the correct ordered sequence of PirateArcadeMetrics marks (JS + Python
phases), including structural invariants:

- Phase sequence (schema v3): cross-file-replaced → pythons-js-requested → python-ready → boot-start → pygame-install-start → archive-fetch-start → pygame-install-end → archive-fetch-end → archive-extract-start → archive-extract-end → input-bridge-installed → display-init-start → display-init-end → game-object-created → game-ready → loader-hidden → user-input-active → active-play → first-user-input
- Metrics schema version (`game-boot-metrics.js`) currently v3 with 25+ marks, 13-stage failure enum, long-task observer, archive/runtime context
- `async def boot():` + `asyncio.ensure_future(boot())`
- `computeDurations()` after `game-ready`
- `sys.print_exception` in exception handler
- `sys.path.insert(0, a)` present before import
- `os.chdir(a)` present before import
- Import statement appears AFTER both `sys.path.insert` and `os.chdir`

### Playable-readiness telemetry

Three truthful milestones with distinct semantics:

- **`game-ready`**: Python boot completed; game object exists; menu may still show.
- **`loader-hidden`**: Loading overlay gone; game can be viewed/interacted; menu may show.
- **`active-play`**: Game-state bridge (`PirateArcadeGameState`) confirms real gameplay phase
  (`phase === 'playing'`). Marked ONCE via `markOnce()`.
- **`first-user-input`**: First meaningful keyboard/touch input accepted by Python bridge.
  Marked ONCE on successful bridge call (keyDown with ok=true, or setTouchTarget with active=true).

`playable` is a compatibility convenience flag derived from `active-play` having occurred.
The performance test (`game-load-performance.spec.ts`) asserts `flags.activePlay === true`
(not the `playable` boolean directly). Milestones are timestamped via `PirateArcadeMetrics.markOnce()`.

Game-state observer lives in `pygame-input-bridge.js`: single 500ms polling owner,
subscribes to `PirateArcadeGameState.subscribe()`, stops on `pagehide`. `ready()` in
pygbag-loading.js owns only loader-hidden state — it does not determine whether
gameplay has begun.

### Static integrity

```sh
npm run test:game-shell-integrity
```

The static checker (`scripts/check-game-shell-integrity.mjs`) validates:

- Strict UTF-8 decode (no mojibake or replacement characters)
- `<meta charset="UTF-8">` within the first 1024 bytes
- Valid document order (DOCTYPE → `<html>` → `<head>` → `<body>`)
- Balanced `<script>` tags and exactly one pygbag module script
- No orphaned inline debug-panel source code
- No non-whitespace direct body text nodes (JSDOM)
- No duplicate element IDs
- Cross-shell structural parity

### Shared loading API

The loading overlay (`PirateArcadeLoading`) is defined once in
`public/play/shared/pygbag-loading.js` and loaded early in every
shell `<head>`. The old per-shell inline copies and the override in
`pygame-input-bridge.js` have been removed.

### Playwright validation

The Playwright shell test (`tests/game-shell-integrity.spec.ts`) validates at runtime:

- `document.characterSet` is UTF-8
- No leaked JavaScript signatures in rendered body text
- Expected loading copy matches exactly
- No mojibake patterns in visible text
- Loading API uses `textContent` (safe from HTML injection)

**Principle:** Expected elements existing does not prove unexpected content is absent. Always add negative assertions for leaked code.

## Pygbag loading performance

`tests/game-load-performance.spec.ts` measures Pygbag boot performance for
the three Pygbag games. Two scenario families:

**Boot scenarios:**

- **First navigation** — validates `flags.activePlay === true`, `schemaVersion === 3`,
  resource classification, archive network evidence, and `classifyLoadType` returns
  `"fresh-context"`.
- **Reload navigation** — validates same assertions on a second load with the
  service worker active.

**Active-game health scenario:**

- Runs an in-page sampling loop (one `page.evaluate()` call) that collects rAF interval
  statistics, publisher counter deltas, and bridge counter deltas over 8 seconds.
- Publisher efficiency assertions: `stateFactoryCalls < updateCalls / 3`,
  `stateBuildSkips > 0`, DOM writes < 15 Hz.
- Bridge efficiency assertions: `parseCount <= rawReadCount + 5`,
  `subscriberNotificationCount <= parseCount`.
- Uses the typed helper `runInPageSample()` from `tests/helpers/pygbagPerformance.ts`.

Each scenario attaches a JSON report (`PerfReport`) and runtime diagnostics
(`RuntimeSnapshot`) to the Playwright test output for inspection.

### Running

```sh
npm run test:pygbag-performance          # chromium-desktop only (fastest)
npm run test:game-performance            # chromium-desktop + mobile-safari
npm run test:game-performance:headed     # headed mode for debugging
```

### Loop architecture (Pygbag games)

All three Pygbag games follow the same loop pattern:

```
while True:
    process_events()
    update(dt)                          # fixed dt=1/60
    if should_draw(current_key, last_draw_key):
        draw()
    pg.display.flip()
    await asyncio.sleep(0)
```

Static states (menu, pause, game-over) suppress draws via `should_draw()`
from `shared/pa_loop.py`. The draw key is a tuple of discrete visual state
values — draws resume only when the key changes (e.g., selection moves, sound
toggles). Active play (`state == 'playing' and not paused`) always draws.

Draws and presentations are counted in the publisher stats dict as `draws`
and `presentations`. Since `pg.display.flip()` runs every loop iteration,
`presentations == updateCalls`. During static states `draws << updateCalls`
because the draw-skip suppresses most render work.

Publisher counters available in `__pa_stats`:
`updateCalls`, `eventChanges`, `intervalSkips`, `serializationAttempts`,
`unchangedPayloadSkips`, `builtinsWrites`, `domWrites`, `domWriteFailures`,
`forcedWrites`, `heartbeatWrites`, `configuredActiveHz`, `lastWriteReason`,
`stateFactoryCalls`, `statsSnapshotCalls`, `activeTicks`, `staticTicks`,
`stateBuildSkips`, `draws`, `presentations`.

**Active pacing:** Not needed — loops naturally run at ~60 Hz (~27 Hz for
Kraken's Wake) via Pygbag's `asyncio.sleep(0)` cooperative scheduler. No
explicit pacing delay added.

**Hidden-page behavior:** The visibility bridge (`_paPushVisibility` in
`pygame-input-bridge.js`) propagates `document.hidden` state to Python
builtins via `PyRun_SimpleString`. The `page_hidden()` function in
`pa_loop.py` returns the current state. No gameplay freeze on hidden
(currently implemented).

### Diagnostics helpers

| Helper                 | File                  | Purpose                                                                                     |
| ---------------------- | --------------------- | ------------------------------------------------------------------------------------------- |
| `game-boot-metrics.js` | `public/play/shared/` | Runtime metrics collector (25+ marks, long tasks, failure stages)                           |
| `performanceReport.ts` | `tests/helpers/`      | `PerfSnapshot` type, `classifyLoadType()`, `summarizeResources()`, `buildArchiveEvidence()` |
| `diagnostics.ts`       | `tests/helpers/`      | `createDiagnosticCollector()`, `getBootMetrics()`, `RuntimeSnapshot`                        |
| `pygbagPerformance.ts` | `tests/helpers/`      | `PublisherCounters`, `BridgeMeta`, `HealthSampleResult`, `runInPageSample()`                |

### Schema version

The metrics schema (`game-boot-metrics.js`) is currently **v3**. The test asserts
`snapshot.schemaVersion === 3`. If the schema changes, update the test
expectation and regenerate shells.

## Browser game screenshots

Production screenshots (`public/images/screenshot-<id>.png`, 1280x720 PNG)
are committed static assets — never generated at build time.

### Capture

```sh
npm run capture:screenshots   # builds + previews + captures all browser-playable games
```

The script (`scripts/capture-browser-game-screenshots.mjs`):

1. Reads game list from `games.json` (browser-playable only).
2. Builds the site, starts `astro preview`, polls HTTP for readiness.
3. For each game, opens headless Chromium at 1280x720, waits for
   `__paBootMetrics["game-ready"]`, presses the start key, waits 3s,
   snaps `canvas.toDataURL("image/png")`.
4. Resizes 1600x900 → 1280x720 via Sharp.
5. Always kills the preview process.

Port Royale Tycoon is desktop-only — do not capture from `/play/`.

### Validation

```sh
npm run test:screenshot-assets  # file format + pixel content check
```

The validator (`scripts/check-screenshot-assets.mjs`):

- Reads game list from `games.json`.
- Checks: file exists, size 5KB–2MB, PNG signature, IHDR (≥1280x720,
  aspect within 2% of 16:9, 8-bit RGB/RGBA).
- Decompresses IDAT with built-in zlib, defilters scanlines, samples pixels
  for brightness (avg > 15) and color diversity (range > 5) — catches
  blank/dark/uniform screenshots.
- SHA-256 distinctness check (no accidental duplicate).

## Release gates

Three local verification commands (defined in `scripts/verify-release.mjs`):

```sh
npm run verify:release:fast   # 28 deterministic checks (~14 s)
npm run verify:release:full   # fast + Playwright tests (15–25 min)
npm run test:lhci             # Lighthouse CI audit (5–10 min, requires build)
```

The fast gate checks: format, typecheck, build, SEO audit, copy tone,
CSS tokens, visual contrast, dependency hygiene, cloudflare headers,
browser game consistency & shells, service worker, cache versioning,
pygbag boot contract, **pygbag boot program**, pygbag shell drift, game versions,
HTML structure, archive parity & audit, public domain art, game theming source,
screenshot assets, performance budgets, site links, game registry,
repository docs, race ship assets, screenshot assets. Pygbag loading
performance tests are not included in the fast gate — they require a
running `astro preview` server and CDN-accessible Pygbag runtime.

The full gate adds: site theme, a11y (axe scans with strict color-contrast
on all non-game pages), mobile layout/pause/input/navigation/regression,
iPad layout/controls, browser games (chromium), game theming (visual),
game prewarm, Captain's Log, keyboard interaction tests, Lighthouse CI.

**Before pushing, always run:**

```sh
npm run verify:release:fast
```

## Pygbag boot program

The Python boot program embedded in every Pygbag game shell is generated by
`scripts/pygbag-boot-program.mjs`. It is the single authoritative source:

- `renderPythonBootProgram(config)` produces the exact Python source
- Exports canonical `BOOT_MARKS` (17 marks), `FAILURE_STAGES` (9 stages),
  `GENERATED_SCHEMA_VERSION` (1), and `CRITICAL_ORDER` (16 phases)
- Consumed by the shell template, boot-contract validator, unit tests, and
  mock Python harness

### Validation layers

| Layer              | Location                                 | What it catches                              |
| ------------------ | ---------------------------------------- | -------------------------------------------- |
| Renderer tests     | `tests/unit/pygbag-boot-program.test.ts` | Source construction, metadata, syntax        |
| AST validation     | Same file (string pattern checks)        | Ordering, counts, structure                  |
| Executable harness | `tests/helpers/pygbag-boot-harness.py`   | Runtime behavior, failures, first-frame      |
| Boot contract      | `scripts/check-pygbag-boot-contract.mjs` | Phase ordering, structural invariants        |
| Shell drift        | `scripts/check-pygbag-shell-drift.mjs`   | Full HTML equivalence                        |
| Mutation tests     | `tests/unit/pygbag-boot-program.test.ts` | Specific regressions (discarded await, etc.) |

### Fast offline command

```sh
npm run test:pygbag-boot-program   # renderer + AST + harness + mutations (~3 s)
```

Does not require Playwright, CDN fetch, or archive rebuild.

## Lighthouse CI

Lighthouse runs in GitHub Actions as a smoke and baseline audit:

- Stable Chrome is installed explicitly via `browser-actions/setup-chrome`
- Reports are uploaded as workflow artifacts (`.lighthouseci/`, retained 7 days)
- Category and timing assertions are currently **warning-level** (minScore 0.5)
- The workflow fails when: Chrome cannot run, Lighthouse collection crashes, assertion execution crashes, or configuration is syntactically invalid
- The workflow does **not** currently fail for ordinary performance-score warnings
- `budget.json` was **removed** — it was never connected to `lighthouserc.cjs`
  (the `budgetsFile` key was absent from the assertion config)

Future calibration work:

- Inspect multiple successful CI artifacts
- Establish representative median and low-percentile scores
- Ratchet one category at a time
- Avoid tuning thresholds from a single run
- Keep Pygbag shell scores separate from playable-readiness metrics

Rule: "Do not loosen Lighthouse thresholds merely to make CI green without documenting the observed score and the reason."

## Service worker

`public/sw.js` is a classic service worker (no `import` statements).

**Cache version** (`CACHE_VERSION` constant in `public/sw.js`) must match
`CACHE_VERSION` in `scripts/game-asset-versions.mjs`. Both are
`"pirate-arcade-games-v11"`. Bump both when game assets change.

**ASSETS_TO_CACHE** must include:

- Every browser-playable game's directory route (`/play/<id>/`)
- Every browser-playable game's `.tar.gz` archive
- All shared scaffolding (`/play/shared/*`)
- `/favicon.svg`

Validated automatically by `check-service-worker-compat.mjs` (includes
ASSETS_TO_CACHE coverage, isGameShell fetch strategy paths).

**Cache behavior:**

- Archive `.tar.gz` files: **network-first** (always get latest after deploy).
- Game shell JS/CSS (identified by `isGameShell` variable in fetch strategy):
  **network-first** so mobile controls update immediately.
- All versioned assets (`?v=` query): **cache-first**.
- HTML pages (documents): **network-first**.
- `/favicon.svg`: **cache-first**.
- Everything else (including screenshots): **stale-while-revalidate**.
- `ACTIVATE` lifecycle: deletes all caches not matching the current
  `CACHE_VERSION`.

**When adding a new game, you must update sw.js:**

1. Add to `ASSETS_TO_CACHE` (directory route + `.tar.gz`)
2. Add `url.pathname.startsWith("/play/<id>/")` to the `isGameShell` block
   in the fetch strategy

Both are validated automatically by `check-service-worker-compat.mjs`.

Screenshots use stale-while-revalidate by default. After a deploy
updates a screenshot, users see the current version after at most one
page load with the new SW active. To force an immediate refresh from a
previous SW version, hard-refresh (Ctrl+Shift+R).

## Content Security Policy

`public/_headers` defines route-specific CSP:

- **Global (`/*`):** `script-src 'wasm-unsafe-eval'` (NOT `unsafe-eval`).
  - `wasm-unsafe-eval` is allowed globally but may be unnecessary on
    non-game pages. Removing it requires Playwright validation to ensure
    no inline script or Astro feature uses WASM.
- **Game routes (`/play/*`):** CSP is detached via `!` prefix and
  re-added with `unsafe-eval` (required by Pygbag).

`scripts/check-cloudflare-headers.mjs` validates CSP — it derives game
routes from `games.json` dynamically, so adding a new game to the data
file automatically ensures it's checked.

**When adding a new game**, add 3 route blocks to `public/_headers`:
`/play/<id>/`, `/play/<id>/index.html`, `/play/<id>/*`. Each must have
`! Content-Security-Policy` detach and a full permissive CSP.

Run `npm run test:check-headers` to validate CSP.

## Dependency hygiene

`scripts/check-dependency-hygiene.mjs` uses **explicit allowlists**:

- `ALLOWED_RUNTIME_DEPS` — contains **phaser** (production dependency).
  Race to Treasure Island imports it at runtime/build time. Only add to this
  list for genuine runtime packages needed by browser-playable games.
- `ALLOWED_DEV_DEPS` — 56 intentional dev-only packages (build, test,
  lint, validation tooling).

The validator scans every `import`/`require` in `src/` and `scripts/` and
fails if any resolved package is not in the allowlists. It skips Node.js
built-ins, `astro:` imports, and relative/glob imports.

**If you add a new dev dependency:**

1. `npm install --save-dev <package>` (never `--save`)
2. Add the package name to `ALLOWED_DEV_DEPS` in `check-dependency-hygiene.mjs`
3. Run `npm run check:dependency-hygiene` to verify

## Dependabot

`.github/dependabot.yml` runs weekly (Monday) for npm and GitHub Actions.
Grouped by dependency type (dev vs production for npm). Labels: `dependencies`.

## CI pipeline

`.github/workflows/ci.yml` has four jobs:

| Job          | Steps                                                                   | Duration |
| ------------ | ----------------------------------------------------------------------- | -------- |
| `verify`     | Full fast release gate (format, typecheck, build, 24 post-build checks) | ~1 min   |
| `playwright` | Browser games + desktop input (chromium)                                | ~10 min  |
| `shell-test` | Cross-browser shell integrity (chromium, WebKit, iPad)                  | ~3 min   |
| `lighthouse` | Lighthouse CI smoke/baseline audit                                      | ~2 min   |

Pygbag loading performance tests (`game-load-performance.spec.ts`) are
not in CI — they require a running `astro preview` server and Pygbag
runtime accessible from the test environment. Run locally (with the
preview server running and a fast CDN connection) before a performance-
sensitive release.

The `verify` job runs the complete fast gate via `npm run verify:release:fast`.
All downstream jobs (`playwright`, `shell-test`, `lighthouse`) also build from
source (the ~3s build time makes artifact reuse offer negligible savings).

## Archive management

Browser game Python archives live at:
`https://pygame-web.github.io/archives/<id>-<ASSET_VERSION>.tar.gz`

`ASSET_VERSION` (from `scripts/game-asset-versions.mjs`) must be the
same across all browser games. Currently `"mobile-v10"`.

**Rebuilding from source after Python changes:**

```sh
node scripts/patch-browser-game-archives.mjs              # all games
node scripts/patch-browser-game-archives.mjs --game=pong  # single game
node scripts/patch-browser-game-archives.mjs --game=breakout
node scripts/patch-browser-game-archives.mjs --game=asteroids
```

The script wraps source files under `scripts/pygbag-port/<id>/` into an
`assets/` directory, copies the shared publisher module from
`scripts/pygbag-port/shared/`, strips `__pycache__` dirs, and creates
a deterministic tarball. Temp files are cleaned up via `try/finally`.
Prints compressed size and MD5 hash for each archive.

**Validation:**

- `npm run audit:game-archives` — checks archive availability + integrity.
- `npm run test:archive-parity` — compares local archive hashes against
  published archives.
- `npm run test:cache-versioning` — asserts `?v=` query on preload links,
  network-first for archives in SW, `updateViaCache: 'none'`.
- `npm run test:game-versions` — checks version consistency in game HTML.

## Performance budgets

### Asset-size budgets (`scripts/check-performance-budgets.mjs`)

- Total CSS size < 50 KB (gzipped).
- Total JS size < 500 KB (gzipped, includes Phaser).
- Total HTML size < 100 KB (gzipped per page).
- Total image size < 3 MB (raw).
- Budgets are computed **recursively** from `dist/` (all subdirectories scanned).
- Supports `--json-output` flag for CI consumption.
- Budget-checking functions are exported for **unit testing** (16 tests in `tests/unit/check-performance-budgets.test.ts`).
- Runs from `dist/` after build.

Lighthouse route budgets (`budget.json`) have been **removed** — the file was never loaded by `lighthouserc.cjs`. Asset-size budgets are the sole budget enforcement mechanism.

## New browser game architecture & checklist

- **ADR 0001** (`docs/adr/0001-fourth-browser-game-architecture.md`):
  Original fourth-browser-game decision (Pygame/Pygbag). **Superseded by ADR 0002.**
- **ADR 0002** (`docs/adr/0002-race-to-treasure-island-phaser.md`):
  Documents the decision to build Race to Treasure Island as a web-native
  Phaser 3 game instead of continuing with Pygbag.
- **New game checklist** (`docs/new-browser-game-checklist.md`): 22-step
  checklist covering everything from source setup through post-release
  verification.
- **Scaffold script** (`scripts/create-browser-game-scaffold.mjs`):
  Dry-run-first tool that creates a new game shell from template. Run
  with `--id <game-id> --title "Game Title"` to preview, add `--apply`
  to write files.

## Visual contrast

`scripts/check-visual-contrast.mjs` checks theme tokens for WCAG AA
compliance (4.5:1 for normal text, 3:1 for large text). Run after
CSS token changes.
