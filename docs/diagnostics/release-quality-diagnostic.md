# Release Quality Diagnostic Report

## Metadata

- Starting HEAD: `29cabc8827dec41512f408449db7a7a82842d826`
- Current HEAD: `29cabc8827dec41512f408449db7a7a82842d826`
- Working-tree state: clean (+ .gitignore change for .lighthouseci/, + docs/diagnostics/ directory)
- Current checkpoint: 6 (Codebase hotspot audit remaining)
- Last completed checkpoint: 5 (Prewarm network trace)
- Next action: Phase 6 — Codebase hotspot audit (optional) or Phase 7 — findings triage

## Tool versions

- Node: 22.22.3, npm: 10.9.8, Playwright: 1.60.0
- LHCI: 0.15.1, Lighthouse: 12.8.2
- Chromium: Playwright-bundled (chromium-1223)

## Infrastructure notes

- dist/ exists (from prior build)
- `.lighthouseci/` was NOT in .gitignore — ADDED during this diagnostic
- Playwright baseURL: 127.0.0.1:4327 (webServer: astro preview)
- LHCI port: 4321 (separate astro preview server, started by collect)
- CHROME_PATH: `~/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`

## Commands completed

- Phase 0: All 31 files read, version/ infra inventory, claim inventory
- Phase 1: Test topology (full project expansion, counts), fast gate runtime (14s), CI vs local diff
- Phase 2: LHCI collect (3x homepage + 1x Pygbag shell), assert severity tests, budget loading checks, audit unit inspection, variance measurement
- Phase 3: Prewarm mutation tests (flag removal, touchstart removal) — both correctly caught
- Phase 4: A11y route coverage inventory — identified missing build-log/\*, 404, light theme, WARM_CACHE assert gap
- Phase 5: Prewarm SW WARM_CACHE handler inspected — test doesn't assert payload

## Commands still pending

- Phase 6: Codebase hotspot audit (low priority)
- Phase 7: Findings triage and severity review

---

## Claim Inventory

### CI-001: Lighthouse route budgets are enforced

- **Status**: **FALSE** — budget.json is NOT loaded by lighthouserc.cjs
- **Evidence**: LHR shows `budgets: false`. No `budgetsFile` key in lighthouserc.cjs.

### CI-002: Lighthouse runs in CI

- **Status**: **FALSE** — CI has zero Lighthouse references
- **Evidence**: Zero matches for lhci/lighthouse/test:lhci in .github/workflows/ci.yml

### CI-003: Performance audit is complete

- **Status**: **MISLEADING** — asset budgets (check-performance-budgets.mjs) work but Lighthouse budgets don't load and CI config is absent

### CI-004: Static accessibility runs with no disabled rules

- **Status**: **VERIFIED** — all 5 static pages pass without disableRules

### CI-005: All relevant static routes are covered

- **Status**: **PARTIALLY FALSE** — build-log/\* (8 routes), 404 page not in STATIC_PAGES

### CI-006: Keyboard interactions are tested

- **Status**: **VERIFIED** — 5 keyboard tests all pass on chromium-desktop

### CI-007: HTML structure is validated

- **Status**: **VERIFIED** — 25 pages, all pass

### CI-008: Game prewarm behavior is tested

- **Status**: **VERIFIED** with caveat — mutation tests confirmed: removing flag or touchstart listener correctly fails

### CI-009: Captain's Log clearing is tested

- **Status**: **VERIFIED** — all 10 tests pass

### CI-010: Fast and full release gates match their documentation

- **Status**: **PARTIALLY FALSE** — 4 fast-gate checks undocumented; prewarm docs claim fast gate but code moved to full gate

### CI-011: WARM_CACHE handler caches game assets

- **Status**: **NOT TESTED** — the "WARM_CACHE payload" test intercepts postMessage but never asserts on message content. Only tests graceful degradation (no SW controller).

---

## Confirmed Findings

### P1: budget.json is inert (LH-1)

LHR confirms `budgets: false`. No `budgetsFile` in lighthouserc.cjs.

- **Fix**: Add `budgetsFile: "budget.json"` to lighthouserc.cjs assert section

### P1: Performance assertions use warning severity — regressions don't fail (LH-3)

Performance assertion `["warn", { minScore: 0.9 }]` exits 0 on violations.

- **Fix**: Change `warn` to `error`

### P1: Lighthouse does not run in CI (RG-2)

CI config lacks any Lighthouse step.

- **Fix**: Add lhci collect + assert step to CI, or remove Lighthouse from MAINTENANCE.md claims

### P2: unused-javascript/unused-css-rules assertions are inert (LH-4)

These audits report time savings in ms. Threshold 0.3ms always passes (actual: 0ms).

- **Fix**: Remove assertions or switch to `wastedBytes`

### P2: uses-rel-preconnect assertion produces NaN (LH-4)

`maxNumericValue` is not valid for this audit.

- **Fix**: Remove assertion or use a different assertion type

### P2: uses-responsive-images warns with impossible threshold (0ms)

60ms actual, 0ms threshold — only a warning so no CI impact.

- **Fix**: Accept as warning or increase budget

### P2: 4 fast-gate checks undocumented

site links, game registry, repository docs, race ship assets exist in FAST_GATE but not in MAINTENANCE.md

### P2: game prewarm misdocumented

Listed as fast gate in MAINTENANCE.md but code moved it to full gate

### P2: Pygbag shell Lighthouse audit doesn't measure game readiness (LH-5)

FCP=290ms, perf=100 for a shell that hasn't loaded its game engine. WASM compilation and Python runtime init not measured.

### P2: WARM_CACHE test doesn't assert payload content (CI-011)

The test intercepts `postMessage` and stores it to `__paLastWarmCache` but never asserts on the message content. Only tests graceful degradation when SW controller is absent.

### P3: Variance across 3 LHCI runs is near-zero (LH-6)

FCP stddev=0.9ms. 1 run sufficient for static pages.

### P3: Static page route coverage excludes 8 build-log pages and 404 (CI-005)

STATIC_PAGES = ["/", "/play/", "/about/", "/source/", "/credits/"]. 10 routes uncovered.

### P3: Prewarm mutation tests confirmed sensitivity (TI-1, TI-2)

- Flag removal (`__paGamePrewarmInstalled`): test #1 of 11 failed
- Touchstart listener removal: test #7 of 11 failed

Both mutations were caught precisely — the test suite is well-targeted.

### P3: A11y test has no light theme coverage

`color-contrast` failures are most common in light theme. No test sets `colorScheme: "light"`.

---

## Gate Topology

### Test expansion (full gate)

| Suite                     | Projects | Tests/project | Total tests | In CI? |
| ------------------------- | -------- | ------------- | ----------- | ------ |
| site-theme                | 7        | 20            | 140         | No     |
| site-game-content         | 7        | 40            | 280         | No     |
| a11y                      | 7        | 25            | 175         | No     |
| mobile-layout             | 3        | ~22           | 66          | No     |
| mobile-pause              | 1        | 11            | 11          | No     |
| mobile-input              | 2        | 12            | 24          | No     |
| mobile-navigation         | 2        | 28            | 56          | No     |
| mobile-regression         | 3        | ~5            | 14          | No     |
| ipad-layout               | 2        | ~22           | 44          | No     |
| ipad-controls             | 2        | ~5            | 10          | No     |
| browser-games:chromium    | 1        | ~28           | 28          | Yes    |
| web-native-games:chromium | 1        | 84            | 84          | Yes    |
| game-theming              | 1        | 42            | 42          | No     |
| game-prewarm              | 1        | 11            | 11          | Yes    |
| captains-log              | 1        | 10            | 10          | Yes    |
| **CI total**              |          |               | **~133**    |        |
| **Full gate PW total**    |          |               | **~995**    |        |

### CI coverage gap

CI runs: format:check, typecheck, build, browser-games:chromium, game-input-desktop:chromium, web-native-games:chromium, game-prewarm:chromium, captains-log:chromium, fast gate (non-PW)

CI does NOT run: a11y, site-theme, site-game-content, any mobile/ipad suite, game-theming, Lighthouse CI

### Fast gate runtime

**14 seconds** for 24 checks (documented: 2-5 min — stale, faster not slower)

### Gate exit behavior

`process.exit(1)` on first failure — strict but means format failure blocks all subsequent checks

---

## A11y Route Coverage

### Routes covered

- Static pages (5): /, /play/, /about/, /source/, /credits/
- Game shells (3): /play/cannonball-clash/, /play/treasure-cove/, /play/krakens-wake/
- Game shells initial DOM only (1): /play/race-to-treasure-island/ (Phaser, pygbag: false)
- Detail pages (5): All 5 /games/\* pages

### Routes NOT covered

- 404 page
- build-log/ (index + 8 sub-routes: 9 routes total)
- Light theme variant of every page
- Gameplay a11y for race-to-treasure-island (Phaser — different wait signal needed)

### Coverage summary

**29 routes in sitemap. 14 covered in a11y tests. 15 uncovered.**

---

## Lighthouse Truth Table

| Route        | Perf severity | A11y severity | Budget active | Game readiness |
| ------------ | ------------- | ------------- | ------------- | -------------- |
| All 6 routes | warn (0.9)    | error (0.95)  | No            | Shell only     |

All routes use identical assertions. budget.json is never loaded.

---

## Files modified

- `.gitignore` — added `.lighthouseci/` entry
- `docs/diagnostics/release-quality-diagnostic.md` — this file

## Commits created

_(none yet — diagnostic run)_
