# ROADMAP

<!-- Current HEAD: live-site metadata and link hardening -->

## Live-Site Metadata & Link Harden (This Release)

This release polishes Pirate Arcade for public sharing — tighter metadata, social previews, schema validation, link integrity checking, and doc handoff.

- **Metadata**: Shortened page descriptions to ≤200 chars (SEO safe), fixed stale "200+ tests" claim → "Playwright suite"
- **Schema**: JSON-LD tests added — verifies WebSite/Person/SoftwareApplication on homepage, VideoGame per game detail, sameAs URLs
- **Links**: `scripts/check-site-links.mjs` checks internal links resolve in dist/ after build, flags missing `rel="noopener noreferrer"` on `target="_blank"`
- **Tests**: 3 new tests (JSON-LD homepage, JSON-LD game detail, OG metadata coverage), wired into fast gate
- **Docs**: README/ROADMAP updated with new scripts and current state

---

## Phase 0: Foundation ✓ (Live)

- [x] Astro site scaffold with CSS design tokens
- [x] Global layout, navigation, footer, SEO/OG metadata
- [x] Home, Play, Build Log, About, Source pages (6 routes)
- [x] 8 reusable components (Nav, Footer, Hero, GameCard, ArcadeFrame, BuildLogCard, StatusBadge, CTAButton)
- [x] Starter build post: "The Pirate Arcade Experiment"
- [x] Methodology post: "The Free AI Coding Experiment: Method & Findings"
- [x] Experiment tooling data file (`src/data/experiment.ts`)
- [x] README, ROADMAP, DEPLOYMENT, EXPERIMENT, ASSETS documentation
- [x] Security headers, robots.txt, sitemap, favicon, webmanifest
- [x] CI workflow (format check + typecheck + build)
- [x] GitHub repos created and public
- [x] Cloudflare Pages deployment configured and live at `pirate-arcade.com`
- [x] Desktop v2.0.0 release published with Windows .exe and Debian .deb
- [x] GitHub repo descriptions updated
- [x] Accuracy audit and copy corrections applied site-wide

## Phase 1: Content & Assets

- [x] Real game screenshots for all 4 games (via `scripts/capture-browser-game-screenshots.mjs`)
- [x] Real OG image (1200×630 PNG) — composite of 4 screenshots + title
- [x] Release infrastructure build-log post: "Launching on Free Infrastructure"
- [x] Favicon refinement (skull-and-crossbones, gold + white)
- [x] Additional build log posts: "Launching on Free Infrastructure", "Browser Port Feasibility"

## Phase 2: Browser Play Feasibility ✓ (Live)

- [x] Evaluate porting strategy — Pygbag/WebAssembly recommended for Phase 2
- [x] Choose first game: Cannonball Clash (simplest game, minimal changes)
- [x] Port Cannonball Clash via Pygbag as feasibility spike
- [x] Measure bundle size, load time, frame rate, input latency
- [x] Embed web-playable game prototype on /play
- [x] Browser game audio (Web Audio API synthesis, in-game mute toggle)
- [x] Shipping post documenting changes, test results, remaining issues
- [x] Port Treasure Cove (Breakout) to browser
- [x] Port Kraken's Wake (Asteroids) to browser
- [x] Port Port Royale Tycoon (board game) to browser — deferred (see build-log)

## Phase 3: Playable Arcade Lab Polish ✓ (Live)

- [x] CRT scanline effect (tasteful, toggleable, performance-conscious)
- [x] Custom 404 page ("Lost at Sea" themed, Cloudflare \_redirects catch-all)
- [x] Model/tooling comparison table on experiment page (ToolingTable + ModelObservations on /source)
- [x] Play page refactor: browser vs desktop sections, "Before you launch" panel, porting roadmap
- [x] ArcadeStatusPanel: data-driven per-game compatibility matrix
- [x] Agent guardrails (AGENTS.md + .opencode/skill)
- [x] Browser-game shell drift safety (consistency script + manifest comments)
- [x] A11y pass: heading hierarchy, focus-visible, reduced-motion confirmed
- [x] Elegant pirate ship paddle visuals (Pong side-profile ships with
      hull/deck/sail/flag/cannon ports, player teal vs AI rum accents)
- [x] Elegant longboat paddle visuals (Breakout skiff with hull/deck/sail/oars/
      treasure crate/crow's nest/lantern)
- [x] Fortress brick visuals (stone bevel effect, pirate stone palette,
      joint/crack details)
- [x] Archives repacked with updated Python source for all three games
- [x] visual/art direction smoke checklist added to manual test docs
- [ ] CRT scanline effect toggle (accessibility opt-out)
- [ ] Pixel/arcade accent animations (score counter, selection highlight)
- [ ] Nautical chart map background motif for hero or sections
- [ ] Performance audit (Lighthouse target: 90+ all categories)
- [ ] Full accessibility audit (screen reader, contrast testing)

## Phase 4: Maintenance Hardening ✓ (Live)

- [x] Screenshot capture pipeline: Node.js Playwright + Sharp + HTTP polling + error allowlist
- [x] Screenshot validation: pixel content analysis via built-in zlib (decompress + defilter + sample)
- [x] Game lists data-driven from `src/data/games.json` (cache-versioning, capture, validator)
- [x] Dependency hygiene: `sharp` classified as devDependency
- [x] Release gate cleanup: copy-tone, check-headers, visual-contrast, performance-budgets in fast gate
- [x] CI alignment: release-gate job mirrors fast gate
- [x] Dependabot config (npm + Actions, weekly)
- [x] Documentation chain: MAINTENANCE.md created, README/AGENTS/SKILL/DEPLOYMENT linked
- [x] ROADMAP updated to current commit

## Phase 5: Dependency Manifest Repair + Future-Game Readiness ✓ (Live)

- [x] Package manifest cleanup: `dependencies` emptied (`{}`), all packages to `devDependencies`
- [x] Dependency hygiene rewritten with explicit allowlists (ALLOWED_RUNTIME_DEPS, ALLOWED_DEV_DEPS)
- [x] SEO audit enhanced: 7 new guardrails (browserUrl, screenshot, llms.txt consistency, per-game metadata)
- [x] CSP validators derive game list from `games.json` (catches missing `_headers` entries)
- [x] SW validators verify ALL browser games in ASSETS_TO_CACHE + isGameShell fetch strategy
- [x] ADR 0001: Fourth browser game architecture (Pygame/Pygbag recommended)
- [x] New browser game checklist (22-step onboarding)
- [x] Scaffold script (`create-browser-game-scaffold.mjs`)

## Phase 6: Race to Treasure Island Polish ✓ (Live)

- [x] First web-native Phaser 3 game (loads instantly, no runtime download)
- [x] OutRun-style boost/wind mechanic with drain-and-recharge meter
- [x] Long John Silver AI rival with deterministic seeded paths
- [x] Obstacle course: barrels, shipwrecks, reefs, debris (cost wind + bump)
- [x] Treasure chest pickups (+100 bonus points)
- [x] Overtake cue and cooldown system
- [x] Hit feedback cue with wind penalty display
- [x] Finish/win/loss states with distinct overlays and island pulse glow
- [x] Touch controls with restart/pause
- [x] Debug hooks for deterministic testability
- [x] Playwright test suite (Chromium)
- [x] Game data, copy, and mechanics aligned with OutRun-style pitch

## Maybe / Future

- [ ] Client-side high scores (localStorage only, no backend)
- [x] "Captain's Log" local play history panel (localStorage, no backend)
- [ ] Sound effects or ambience on the website
- [ ] Privacy-respecting analytics (Plausible or similar, self-hosted free tier)
- [ ] RSS feed for build log
- [ ] Contribution guide for open source contributors
- [ ] "How I Built This" technical deep-dive posts
- [ ] Side-by-side free vs paid model comparison post

## Non-Goals (Intentionally Not Building)

- No paid Cloudflare services (Workers, D1, R2, Turnstile)
- No backend servers or databases
- No user accounts or authentication
- No payments or subscriptions
- No ads or tracking (beyond optional privacy-respecting analytics)
- No global leaderboards (may add local-only)
