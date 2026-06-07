---
name: pirate-arcade-site
description: Pirate Arcade website — Astro 6, Cloudflare Pages, vanilla CSS tokens
---

# Pirate Arcade Site Skill

## Architecture

- **Framework:** Astro 6 (static output, no SSR)
- **CSS:** Token-based — `src/styles/tokens.css`, `base.css`, `layout.css`, `components.css`, `content.css`, `utilities.css`, `responsive.css`
- **Hosting:** Cloudflare Pages free tier
- **CI:** GitHub Actions — run full validation before pushing

## Brand Voice

- Modern pirate arcade + public builder notebook
- Playful but not cheesy
- Honest about what works and what's experimental
- No ads, tracking, accounts, or paid services
- Emojis only when requested

## Critical Files — Do Not Edit Lightly

| File                       | Why fragile                                                           |
| -------------------------- | --------------------------------------------------------------------- |
| `public/play/*/index.html` | Pygbag CDN pinned (0.9.3). Must validate with Playwright after edits. |
| `public/_headers`          | Route-specific CSP. `unsafe-eval` ONLY on `/play/*` routes.           |
| `public/sw.js`             | Classic SW (no `import`). CACHE_VERSION inlined by build.             |
| `src/data/games.json`      | Source of truth. `browserUrl` only for browser-playable games.        |

## Game Asset Versions

Always use `ASSET_VERSION` from `scripts/game-asset-versions.mjs` for archive URLs. Never hardcode version strings.

## Game Data

- Browser-playable: cannonball-clash (`/play/cannonball-clash/`), treasure-cove (`/play/treasure-cove/`), krakens-wake (`/play/krakens-wake/`)
- Desktop-only: port-royale-tycoon (linked to GH releases)
- Prewarm uses `passive: true` touchstart with no `preventDefault()`
- Runtime globals in `public/play/shared/`: `__paCanvasLayout`, `__paBootMetrics`, `PirateArcadeInput`

## Validation

See [MAINTENANCE.md](../../../MAINTENANCE.md) for detailed documentation.

Before pushing:

```sh
npm run verify:release:fast   # all deterministic checks, ~2 min
```

Or full:

```sh
npm run verify:release:full   # adds a11y, mobile, iPad, theme, browser game tests
```

## Screenshots

Production screenshots in `public/images/screenshot-<id>.png` are
**committed static assets**, 1280×720 PNG, refreshed only via
`npm run capture:screenshots` (Playwright + headless Chromium +
Sharp resize). `npm run test:screenshot-assets` is a no-dep IHDR
validator (size 5KB–2MB, ≥1280×720, 16:9 ±2%, 8-bit RGB/RGBA,
all 3 distinct). Port Royale Tycoon is desktop-only — do not
capture from `/play/`.

## Constraints

- Plan mode first for any multi-file change
- Vanilla CSS via design tokens — no Tailwind or CSS-in-JS
- No paid cloud services, backends, databases
- No ads, tracking, accounts, or leaderboards
- Every game is a data point in the AI experiment
- Mobile tests use real touch helpers (`pointerTouchTap`, `pointerHoldButton` from test utils)

## Copy & Tone

- Follow `COPY_GUIDE.md` for tone zones, vocabulary, and banned words
- Run `npm run test:copy-tone` or `npm run verify:release:fast` before pushing
- Update game status in `src/data/games.json` only — single source of truth
