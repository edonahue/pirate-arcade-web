# ROADMAP

<!-- Current HEAD: Release-candidate hardening — play page document structure repair, test consolidation, a11y expansion, validation automation -->

## Current Shipped State

**Four browser-playable games + one desktop-only game:**

| Game                    | Engine                | Platform          |
| ----------------------- | --------------------- | ----------------- |
| Cannonball Clash        | Pygbag / WebAssembly  | Browser + Desktop |
| Treasure Cove           | Pygbag / WebAssembly  | Browser + Desktop |
| Kraken's Wake           | Pygbag / WebAssembly  | Browser + Desktop |
| Race to Treasure Island | Phaser 3 (web-native) | Browser only      |
| Port Royale Tycoon      | Python / Pygame       | Desktop only      |

Race to Treasure Island is the first web-native Phaser game — loads instantly,
no WASM download. Fortress Siege (3-stage Breakout with 4 brick types and
falling pickups) and Rally Fever (rally-tier system with Cursed Powder pickup)
are the latest Pygbag game features on the existing three ports.

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
- [x] Choose first game: Cannonball Clash
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
- [ ] CRT scanline user-facing toggle in site settings (in-game toggle already exists)
- [ ] Pixel/arcade accent animations (score counter, selection highlight)
- [ ] Nautical chart map background motif for hero or sections

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

- [x] Package manifest cleanup: `dependencies` moved to `devDependencies` for static site, later reverted when Phaser was added as a runtime dep for Race
- [x] Dependency hygiene rewritten with explicit allowlists (ALLOWED_RUNTIME_DEPS, ALLOWED_DEV_DEPS)
- [x] SEO audit enhanced: 7 new guardrails (browserUrl, screenshot, llms.txt consistency, per-game metadata)
- [x] CSP validators derive game list from `games.json` (catches missing `_headers` entries)
- [x] SW validators verify ALL browser games in ASSETS_TO_CACHE + isGameShell fetch strategy
- [x] ADR 0001: Fourth browser game architecture (Pygame/Pygbag recommended) — Superseded by ADR 0002
- [x] ADR 0002: Race to Treasure Island — Phaser 3 decision
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
- [x] Countdown lifecycle with control hints (touch/keyboard variants)
- [x] Best score tracking (win-only localStorage, malformed data safe)
- [x] Deterministic cosmetic RNG for screenshot stability
- [x] Tint state machine across boost/stun/finish/restart

## Phase 7: Fortress Siege & Rally Fever ✓ (Live)

- [x] **Treasure Cove — 3-stage Fortress Siege**: Outer Wall (650 speed), Inner Fortress (700), Treasure Vault (750) with escalating fortress layouts
- [x] **Treasure Cove — 4 brick types**: Standard (1-hit), Reinforced (2-hit, metal bands), Powder-Keg (chain-explosion in 1.5× grid radius), Treasure (drops falling pickup on destroy)
- [x] **Treasure Cove — Falling pickups**: Multiball (2 extra balls, 3-ball cap), Wide Paddle (1.6× width, 8s, cyan glow), Slow Seas (72% speed, 6s, green glow)
- [x] **Treasure Cove — Multi-ball**: Clone with ±30–45° angle offset, life lost only when final ball falls, cap at 3
- [x] **Treasure Cove — Stage transition**: FORTRESS BREACHED banner → stage name → rebuild fortress → reset to one ball
- [x] **Treasure Cove — HUD**: Stage indicator, ball count, power-up timers, crew lives, score popups
- [x] **Cannonball Clash — Rally Fever**: Milestones at rally 5/10/15/20 with distinct labels, ball glow tint (gold→orange→red→magenta), trail length, particle count
- [x] **Cannonball Clash — Cursed Powder**: New pickup type shrinks AI paddle to 65% height for 7s (purple glow/border pulse)
- [x] **Cannonball Clash — Two pickup system**: Large paddle (gold chest) and Cursed Powder (purple icon), timer refresh mechanics
- [x] **Game state bridge**: Extended JSON dump with stage, ballsActive, ballSpeeds, bricksRemaining sub-types, power-up state
- [x] **650 ball speeds preserved**: Both games start at 650; Treasure Cove escalates 650→700→750 across stages

## Phase 8: Release Candidate Hardening ✓ (Live)

- [x] **Play page document structure repair**: all content inside `<main#main-content>`, validated by `test:html-structure`
- [x] **Built HTML structure validator**: `scripts/check-built-html-structure.mjs` using jsdom, checks 21 BaseLayout pages for correct `<main>` → `<footer>` ordering
- [x] **Test ownership refactor**: Captain's Log tests moved to `captains-log.spec.ts`, launch-semantics moved to `game-prewarm.spec.ts`, removed from `site-game-content.spec.ts`
- [x] **captains-log.js hardening**: entry validation now requires `gameId`, `title`, `timestamp` (finite number), `route` (starts with `/`); `addEntry` parameter guards
- [x] **Hardcoded game lists removed**: `game-prewarm.spec.ts` derives game lists from `games.json` and `ASSET_VERSION` from `game-asset-versions.mjs`
- [x] **A11y coverage expanded**: Kraken's Wake + Race to Treasure Island added, 5 static pages, 5 game detail pages, two keyboard-navigation smoke tests
- [x] **Gate consolidation**: `test:html-structure` and `test:game-prewarm` added to FAST_GATE

## Next Priorities

- [ ] **Real iPad Safari playtest** — verify Race touch controls, Pygbag cold start, and orientation lock on physical hardware
- [ ] **Player feedback first pass** — watch someone play through all four games, identify friction points
- [ ] **Kraken's Wake depth review** — gameplay variety, difficulty curve, visual variety
- [ ] **Full accessibility audit** — screen reader, color blindness, motion sensitivity beyond axe-core
- [x] **Performance / Lighthouse audit** — route budgets + CI config created; `lighthouserc.cjs` enforces per-route targets
- [ ] **CRT scanline user-facing toggle** in site settings
- [ ] **Phaser 4 compatibility spike** — evaluate migration effort, requires focused spike (deferred from Dependabot)

## Non-Goals (Intentionally Not Building)

- No paid Cloudflare services (Workers, D1, R2, Turnstile)
- No backend servers or databases
- No user accounts or authentication
- No payments or subscriptions
- No ads or tracking (beyond optional privacy-respecting analytics)
- No global leaderboards (may add local-only)
