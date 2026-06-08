# ADR 0001: Fourth Browser-Playable Game Architecture

## Status

Accepted

## Context

The Pirate Arcade project currently has three browser-playable games (Cannonball Clash, Treasure Cove, Kraken's Wake) built with Python/Pygame and deployed via Pygbag/WebAssembly. A fourth browser-playable game is planned.

This ADR documents the architectural decision for the technology stack of the fourth browser-playable game.

## Decision Drivers

- Free/static hosting (Cloudflare Pages free tier)
- No backend servers, databases, or paid services
- No user accounts, tracking, ads, or leaderboards
- iPad Safari playability is a hard requirement
- Screenshot capture pipeline must work unchanged
- Service worker / cache model must remain consistent
- CI/runtime cost must stay minimal (free tier)
- Game-shell consistency with existing three games
- Existing Pygbag archive pipeline
- Future game maintainability by AI agents
- SEO/discoverability must be preserved
- Ease of onboarding for OpenCode agents
- Current tests and docs must remain valid

## Options Considered

### 1. Continue Pygame/Pygbag (Recommended)

**Description**: Continue using Python/Pygame with Pygbag/WebAssembly for the fourth game, maintaining consistency with the existing three browser games.

**Pros:**

- Full consistency with existing three games (Cannonball Clash, Treasure Cove, Kraken's Wake)
- Reuses existing Pygbag pipeline: `scripts/pygbag-port/`, archive creation, `_headers` CSP, service worker caching
- Existing screenshot capture pipeline works unchanged
- Existing test suites cover new game automatically (browser-game-shells, cache-versioning, archive-parity, etc.)
- Pygbag 0.9.3 is pinned and validated
- Game-shell consistency checks automatically apply
- SEO/sitemap/llms.txt generation is data-driven from `games.json`
- Service worker cache strategy unchanged
- AI agents already understand the codebase patterns

**Cons:**

- Larger initial payload (~12-16 MB .tar.gz per game)
- Pygbag boot time on mobile Safari (30-90s cold load)
- Python/WASM startup overhead
- Limited to Pygbag-supported Python packages

### 2. Vanilla JS Canvas

**Description**: Build the fourth game directly in JavaScript using Canvas API, no WASM/Python.

**Pros:**

- Smaller payload (KB vs MB)
- Instant load, no WASM compilation
- Native web performance
- Simpler debugging (native JS)

**Cons:**

- Breaks consistency with existing three games
- New test coverage needed
- Screenshot capture pipeline needs JS equivalent
- Game-shell consistency checks don't apply
- Service worker cache strategy differs
- SEO/sitemap data-driven logic works but shell structure differs
- New CSP requirements (no `unsafe-eval` needed)
- Service worker cache list differs
- Duplicate effort for game shell (HTML, CSP, SW registration)
- Loss of Python/Pygame code reuse from desktop versions

### 3. Phaser or Another JS Game Framework

**Description**: Use a JavaScript game framework (Phaser, PixiJS, etc.) for the fourth game.

**Pros:**

- Rich framework features (physics, animation, asset loading)
- Web-native, no WASM
- Active community

**Cons:**

- Adds framework dependency (bundle size)
- Still breaks consistency with existing games
- Framework-specific test coverage needed
- Screenshot capture may need framework-specific handling
- Game-shell consistency breaks
- New CSP requirements possible
- Framework lock-in risk

### 4. PHP/Server-Side Approach

**Description**: Server-rendered game with PHP backend.

**Pros:**

- None for this project

**Cons:**

- Violates "no backend servers" constraint
- Requires paid hosting
- Breaks static-site architecture
- Adds complexity (database, sessions, etc.)

## Decision

**Continue with Pygame/Pygbag for the fourth browser-playable game.**

The consistency, reuse, and maintainability benefits outweigh the payload/boot-time costs. The existing infrastructure (Pygbag pipeline, CSP, SW, screenshot capture, tests, SEO) is proven and any alternative would require significant new infrastructure.

## Consequences

- Fourth game will use Pygbag 0.9.3 (pinned)
- Payload size ~12-16 MB .tar.gz
- Cold load 30-90s on iPad Safari (acceptable per testing checklist)
- All existing infrastructure applies automatically
- No new test infrastructure needed
- Screenshot capture works unchanged
- SEO/sitemap/llms.txt generated from `games.json`
- Service worker caches game automatically

## Follow-up Actions

- [ ] Add fourth game to `src/data/games.json` with `status: "browser-playable"`
- [ ] Create Pygbag port under `scripts/pygbag-port/<id>/`
- [ ] Run `npm run patch:game-archives` and `npm run apply:game-versions`
- [ ] Update `scripts/game-asset-versions.mjs` if needed
- [ ] Run `npm run verify:release:fast` to validate
- [ ] Capture screenshots with `npm run capture:screenshots`
- [ ] Update `docs/new-browser-game-checklist.md` if needed

## Related

- ADR 0002 (future): If payload/boot time becomes unacceptable, evaluate Vanilla JS Canvas alternative
- `docs/new-browser-game-checklist.md` for onboarding steps
- `scripts/check-browser-game-shells.mjs` validates new game automatically
