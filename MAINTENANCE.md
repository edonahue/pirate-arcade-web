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
npm run verify:release:fast   # ~22 deterministic checks (2–5 min)
npm run verify:release:full   # fast + Playwright tests (15–25 min)
npm run test:lhci             # Lighthouse CI audit (5–10 min, requires build)
```

The fast gate checks: format, typecheck, build, SEO audit, copy tone,
CSS tokens, visual contrast, dependency hygiene, cloudflare headers,
browser game consistency & shells, service worker, cache versioning,
game versions, HTML structure, archive parity & audit,
public domain art, game theming source, screenshot assets, performance
budgets.

The full gate adds: site theme, a11y (axe scans with strict color-contrast
on all non-game pages), mobile layout/pause/input/navigation/regression,
iPad layout/controls, browser games (chromium), game theming (visual),
game prewarm, Captain's Log, keyboard interaction tests, Lighthouse CI.

**Before pushing, always run:**

```sh
npm run verify:release:fast
```

## Service worker

`public/sw.js` is a classic service worker (no `import` statements).

**Cache version** (`CACHE_VERSION` constant in `public/sw.js`) must match
`CACHE_VERSION` in `scripts/game-asset-versions.mjs`. Both are
`"pirate-arcade-games-v8"`. Bump both when game assets change.

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

`.github/workflows/ci.yml` has three workflows:

| Job            | Steps                                        | Duration |
| -------------- | -------------------------------------------- | -------- |
| `verify`       | format:check, typecheck, build               | ~2 min   |
| `playwright`   | Browser games + desktop input (chromium)     | ~10 min  |
| `release-gate` | All fast-gate script checks (non-Playwright) | ~2 min   |

The `release-gate` job mirrors `npm run verify:release:fast` (minus
steps already in `verify`). If a new fast check is added to
`verify-release.mjs`, add it to the `release-gate` job too.

## Archive management

Browser game Python archives live at:
`https://pygame-web.github.io/archives/<id>-<ASSET_VERSION>.tar.gz`

`ASSET_VERSION` (from `scripts/game-asset-versions.mjs`) must be the
same across all browser games. Currently `"mobile-v5"`.

**Validation:**

- `npm run audit:game-archives` — checks archive availability + integrity.
- `npm run test:archive-parity` — compares local archive hashes against
  published archives.
- `npm run test:cache-versioning` — asserts `?v=` query on preload links,
  network-first for archives in SW, `updateViaCache: 'none'`.
- `npm run test:game-versions` — checks version consistency in game HTML.

## Performance budgets

Two systems enforce budgets:

### Asset-size budgets (`scripts/check-performance-budgets.mjs`)

- Total CSS size < 50 KB (gzipped).
- Total JS size < 500 KB (gzipped, includes Phaser).
- Total HTML size < 100 KB (gzipped per page).
- Total image size < 3 MB (raw).
- Runs from `dist/` after build.

### Lighthouse budgets (`budget.json` + `lighthouserc.cjs`)

- **Static pages** (/, /about/, /source/, /credits/, /games/\*/):
  FCP ≤ 1.5s, LCP ≤ 2.5s, TBT ≤ 50ms, CLS ≤ 0.1, Performance ≥ 90.
- **Game listing** (/play/):
  FCP ≤ 1.8s, LCP ≤ 3.0s, TBT ≤ 100ms, CLS ≤ 0.1.
- **Game shells** (/play/cannonball-clash/, /play/race-to-treasure-island/):
  FCP ≤ 2.0s, LCP ≤ 4.0s, TBT ≤ 200ms, CLS ≤ 0.1.

Run manually: `npm run test:lhci` (requires built `dist/`).

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
