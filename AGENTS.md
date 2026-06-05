# Pirate Arcade Web — Agent Guide

## Project

Static Astro 6 site on Cloudflare Pages free tier. Python/Pygame desktop games in a separate repo. Everything runs on local hardware, free models, and free-tier infra.

## Brand voice

Modern pirate arcade + public builder notebook. Playful but not cheesy. Honest about what works and what's experimental. No ads, tracking, accounts, or paid services.

## Critical fragility

- `public/play/*` — browser-game shells. Pinned Pygbag CDN version (0.9.3). Never edit without Playwright validation.
- `public/_headers` — per-route CSP. `unsafe-eval` only on game routes (`/play/*`). Keep global CSP strict.
- `public/sw.js` — classic service worker (no `import`). CACHE_VERSION inlined by build script. WARM_CACHE listener at top scope.
- `src/data/games.json` — source of truth. Browser-playable entries have `browserUrl`, desktop-only entries don't.
- `ASSET_VERSION` from `scripts/game-asset-versions.mjs` — must use for versioned archive URLs. No hardcoded versions.

## Validation (run in order before pushing)

```sh
npm run format:check        # Prettier
npx astro check             # Typecheck (requires Node >=22.12)
npm run build               # Astro build
npm run seo:audit           # HTML/CSS audit
npm run test:css-tokens     # Token coverage
npm run check:dependency-hygiene
npm run test:service-worker
npm run test:archive-parity
npm run audit:game-archives
npm run test:browser-games:chromium  # Playwright
npm run test:a11y
npm run test:mobile-layout
```

## Game data notes

- Browser-playable: cannonball-clash, treasure-cove
- Desktop-only: krakens-wake, port-royale-tycoon
- Prewarm uses passive touchstart, no `preventDefault()`
- `__paCanvasLayout`, `__paBootMetrics`, `PirateArcadeInput` are runtime globals from shared scripts

## Constraint reminders

- Plan mode first for multi-file changes
- Vanilla CSS via tokens — no Tailwind or CSS-in-JS
- Never add paid cloud services or backends
- Every game is a data point in the AI experiment
