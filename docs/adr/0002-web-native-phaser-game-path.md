# ADR 0002: Web-Native Phaser Game Path

## Status

Accepted

## Context

ADR 0001 recommended continuing with Pygbag for the fourth browser-playable game. During implementation planning for "Race to Treasure Island" (a side-scrolling pirate racer), we identified fundamental architectural mismatches with the Pygbag/WebAssembly approach:

1. **Real-time input:** A racer game needs sub-frame keyboard/pointer response. Pygbag's Python→WASM bridge adds latency.
2. **Sprite animation:** Phaser's built-in sprite/tween/animation system suits the visual style far better than Pygame's blit-based rendering.
3. **Payload size:** Phaser 3 minified is ~1.2 MB gzip. Pygbag's CPython runtime is ~12-16 MB.
4. **Boot time:** Phaser boots in <2s on mobile. Pygbag cold load is 30-90s.
5. **Asset pipeline:** Vite bundling replaces the `.tar.gz` archive model, eliminating the archive creation/versioning/validation pipeline.

This ADR documents the decision to diverge from ADR 0001 for this specific game.

## Decision Drivers

- Sub-frame input responsiveness for a racer game
- Fast boot time on mobile Safari (iPad requirement)
- Small payload (Phaser bundled via Astro/Vite)
- No `unsafe-eval` CSP requirement (Phaser ES module build)
- Deterministic seed for screenshot/testing
- AI-agent maintainability (TypeScript > Python for web-native)
- Consistent developer tooling (Vite, Astro, TypeScript)
- Must coexist with existing Pygbag games without breaking them

## Decision

**Use Phaser 3 (ES module build) via Astro/Vite bundling for "Race to Treasure Island", while keeping the Pygbag pipeline for existing and future Python/Pygame ports.**

The two pipelines (Pygbag and web-native) coexist. Game data in `games.json` is the single source of truth; `check-browser-game-shells.mjs` is updated to skip web-native games for Pygbag-specific checks.

## Consequences

- Phaser added to `dependencies` in `package.json`
- New game lives in `src/games/<id>/` as TypeScript source
- Astro play route (`src/pages/play/<id>.astro`) renders the Phaser game component
- No `.tar.gz` archive, no Pygbag pipeline, no `public/play/<id>/index.html`
- No `unsafe-eval` needed in CSP (global strict CSP suffices)
- Screenshot capture needs new strategy (Phaser ready-detection instead of Pygbag metrics)
- `check-browser-game-shells.mjs` must skip web-native games for shell/archive/CSP-unsafe-eval checks
- `check-service-worker-compat.mjs` must handle web-native games differently (no ASSETS_TO_CACHE or isGameShell entries needed)
- `check-performance-budgets.mjs` needs adjusted budget for `dist/assets` (Phaser bundle)
- `generate-sitemap.mjs`, `seo-audit.mjs` work from `games.json` — auto-include new game
- `play.astro` copy updated to be engine-agnostic

## Comparison: Pygbag vs Phaser

| Concern                 | Pygbag                          | Phaser (this game)           |
| ----------------------- | ------------------------------- | ---------------------------- |
| Runtime size            | ~12-16 MB gzip                  | ~1.2 MB gzip                 |
| Boot time (cold)        | 30-90s                          | <2s                          |
| Input latency           | Python→WASM bridge              | Native JS/event loop         |
| CSP requirement         | `unsafe-eval`                   | None (ES module build)       |
| Asset pipeline          | `.tar.gz` + CDN versioning      | Vite bundling                |
| Language                | Python/Pygame                   | TypeScript                   |
| Shell structure         | `public/play/<id>/index.html`   | Astro route + component      |
| Screenshot detection    | `__paBootMetrics["game-ready"]` | Phaser lifecycle + seed mode |
| Maintainability (AI)    | Good (documented, consistent)   | Better (TS, modern tooling)  |
| Existing infrastructure | Reuses everything               | Requires new infrastructure  |

## Follow-up Actions

- [x] Install Phaser (`npm install phaser`)
- [ ] Update `ALLOWED_RUNTIME_DEPS` in `check-dependency-hygiene.mjs`
- [ ] Create `docs/web-native-game-checklist.md`
- [ ] Create game directory structure under `src/games/race-to-treasure-island/`
- [ ] Implement game MVP
- [ ] Add game data to `src/data/games.json`
- [ ] Extend types in `games.ts` (add `"racer"` control mode)
- [ ] Create Astro play route `src/pages/play/race-to-treasure-island.astro`
- [ ] Update `check-browser-game-shells.mjs` to skip web-native games
- [ ] Update `check-service-worker-compat.mjs` for web-native isGameShell
- [ ] Update `check-performance-budgets.mjs` for Phaser bundle
- [ ] Update `capture-browser-game-screenshots.mjs` for Phaser detection
- [ ] Update `play.astro` copy to be engine-agnostic
- [ ] Run full validation ladder
- [ ] Capture screenshot

## Related

- Supersedes ADR 0001 for this game only. Pygbag path remains valid for Python/Pygame ports.
- `docs/web-native-game-checklist.md` for onboarding steps
