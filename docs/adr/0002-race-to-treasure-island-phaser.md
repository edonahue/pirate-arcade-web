# ADR 0002: Race to Treasure Island — Phaser 3

## Status

Accepted

## Context

The Pirate Arcade project had three Pygbag/WebAssembly browser games
(Cannonball Clash, Treasure Cove, Kraken's Wake) and needed a fourth
browser-playable game. The original plan (ADR 0001) recommended
continuing with Pygame/Pygbag for consistency.

Race to Treasure Island — a first-person sailing race — required
different architectural characteristics than the existing Pygbag ports:

- **Instant loading**: A race game needs to start immediately when
  the player clicks "Play". 30-90s WASM cold starts (Pygbag on iPad)
  would destroy the experience.
- **Smooth 60fps rendering**: The race track, horizon, obstacles,
  and boost effects need consistent frame timing.
- **Native touch support**: The game must work on iPad Safari without
  a Python→JS input bridge layer.
- **No WASM download**: Each Pygbag game ships a 12-16 MB .tar.gz.

## Decision Drivers

- Instant load (no WASM compilation delay)
- Consistent 60fps rendering on mobile Safari
- Native touch input without bridge layer
- Zero additional download beyond the page HTML/JS
- Compatible with Cloudflare Pages free tier (static hosting)
- iPad Safari playability (hard requirement)
- Deterministic testability via Playwright

## Options Considered

### 1. Phaser 3 (Chosen)

**Description**: HTML5 game framework with Canvas/WebGL renderer,
physics engine, and asset management. Ships as a single npm dependency.

**Pros:**

- Instant load — page is playable immediately (no WASM download)
- Native 60fps Canvas/WebGL rendering with no bridge layer
- Native DOM event handling for touch/keyboard/mouse
- Deterministic RNG and test hooks built into game code
- Well-documented API, strong community, stable 3.90.x release
- Compatible with Astro static export (loaded as ES module in game shell)
- CSP stays clean (no `unsafe-eval` needed — only https://cdn.jsdelivr.net)

**Cons:**

- Breaks Pygbag pipeline consistency — separate CSP, SW, shell, tests
- New test infrastructure needed (web-native-game spec)
- No Python/Pygame code reuse from desktop version
- Requires dedicated screenshot capture logic
- Adds ~1.5 MB to production dependency

### 2. Continue Pygame/Pygbag

**Description**: Port the Python/Pygame desktop game via Pygbag.

**Pros:**

- Consistency with existing three games
- Reuses Pygbag pipeline (archive, CSP, SW, tests)
- Code reuse from desktop version

**Cons:**

- 30-90s cold load on iPad Safari (unacceptable for race game)
- Bridge layer needed for touch/keyboard input
- WASM download (12-16 MB) before play begins
- Performance unpredictable on mobile Safari
- Testing requires wait-for-WASM patterns

### 3. Vanilla JS Canvas

**Description**: Hand-written Canvas 2D game, no framework.

**Pros:**

- Zero dependencies
- Full control over rendering pipeline

**Cons:**

- No physics engine (need custom collision, movement, AI pathing)
- No asset management (sprite sheets, texture generation, animations)
- Much more code to write and maintain
- No built-in scene management for game states

## Decision

**Build Race to Treasure Island with Phaser 3.**

The instant-load and performance requirements for a racing game make
Pygbag unsuitable. Phaser provides the physics, rendering, scene
management, and input handling needed without the WASM overhead.

## Consequences

### New infrastructure

- **Game shell**: `public/play/race-to-treasure-island/index.html` —
  different from Pygbag shells (no pygbag CDN, no archive preload,
  no transfer overlay). Loads Phaser from jsDelivr CDN.
- **CSP**: The game route needs `connect-src https://cdn.jsdelivr.net`
  (not `unsafe-eval`). Separate CSP block in `_headers`.
- **Service worker**: Race loaded as static JS, cached like shared
  scaffolding (network-first for the shell, cache-first for versioned
  assets). No archive to cache.
- **Tests**: Dedicated `tests/web-native-games.spec.ts` for Phaser games.
  No Pygbag runtime detection — uses Phaser-specific ready signals
  (`window.game`, `window.testEvents`).
- **Screenshots**: Different capture path — the `capture-browser-game-screenshots.mjs`
  script was extended to handle both engine types. Race uses Enter key
  start similar to Pygbag games but reads from Phaser canvas.

### Preserved

- `src/data/games.json` still drives all game data (sitemap, SEO,
  cards, links)
- Same Cloudflare Pages free-tier hosting
- Same Astro 6 static site framework
- Same Playwright test harness
- Same `verify:release:fast` / `verify:release:full` release gates

## Related

- ADR 0001: Original fourth-browser-game decision (Pygame/Pygbag) —
  **Superseded**
- `docs/new-browser-game-checklist.md` — now supports both Pygbag and
  Phaser onboarding paths
- `scripts/capture-browser-game-screenshots.mjs` — captures for both
  engine types
