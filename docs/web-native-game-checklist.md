# Web-Native Browser Game Checklist

This checklist covers the steps to add a web-native (Phaser/Vite/Astro) browser game to Pirate Arcade, as distinct from the Pygbag path documented in `docs/new-browser-game-checklist.md`.

## Prerequisites

- [ ] Game designed and scoped (MVP scope)
- [ ] Art assets sourced (CC0 or original, documented in ASSET_CREDITS.md)

## Implementation

- [ ] Create game directory: `src/games/<id>/`
- [ ] Implement game as TypeScript Phaser scenes/config
- [ ] Export a factory function or class for the Astro component to use
- [ ] Add game to `src/data/games.json` with `status: "browser-playable"` and `engine: "phaser"`
- [ ] Add/update control mode in `src/data/games.ts` (e.g. `"racer"`)
- [ ] Create `src/pages/play/<id>.astro` — loads Phaser game component
- [ ] Wire game to `__paBootMetrics` for screenshot/test detection

## Validation Integration

- [ ] `check-browser-game-shells.mjs` — ensure skips web-native games (no shell HTML, no archive, no Pygbag invariants)
- [ ] `check-service-worker-compat.mjs` — ensure web-native game NOT in ASSETS_TO_CACHE or isGameShell (handled by Vite/Astro)
- [ ] `check-cloudflare-headers.mjs` — ensure no CSP rule needed (global CSP suffices; no `unsafe-eval`)
- [ ] `check-performance-budgets.mjs` — adjust `dist/assets` JS budget for Phaser bundle
- [ ] `seo-audit.mjs` — auto-detects from `games.json` (should pass automatically)
- [ ] `generate-sitemap.mjs` — auto-detects from `games.json`
- [ ] `check-screenshot-assets.mjs` — auto-detects (run after screenshot captured)

## Screenshot Pipeline

- [ ] Extend `capture-browser-game-screenshots.mjs` to handle web-native games:
  - [ ] Detect game-ready via Phaser lifecycle (not `__paBootMetrics`)
  - [ ] Use seed mode (`?seed=test&screenshot=1`) for deterministic output
  - [ ] Hide shell UI overlays
  - [ ] Press start key, wait for gameplay frames
  - [ ] Capture canvas.toDataURL
- [ ] Run `npm run capture:screenshots` → commit screenshot
- [ ] Run `npm run test:screenshot-assets` to validate

## Playwright Tests

- [ ] Extend `tests/browser-games.spec.ts` for web-native game
- [ ] Test: page loads, canvas renders, game responds to input
- [ ] Test: no JS errors during boot
- [ ] Test: seed mode produces consistent output

## Documentation

- [ ] Update `src/pages/play.astro` copy to be engine-agnostic (not just "Pygbag/WebAssembly")
- [ ] Update `COPY_GUIDE.md` if needed for new game tone
- [ ] Update `docs/adr/0001-fourth-browser-game-architecture.md` to reference ADR 0002
- [ ] Add ASSET_CREDITS.md in game directory for art sources

## Release

- [ ] Run `npm run verify:release:fast` (deterministic checks)
- [ ] Run `npm run verify:release:full` (includes Playwright)
- [ ] Commit with descriptive message
