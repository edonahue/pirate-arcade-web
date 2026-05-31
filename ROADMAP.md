# ROADMAP

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

- [x] Real game screenshots for all 4 games (via `scripts/capture-screenshots.py`)
- [x] Real OG image (1200×630 PNG) — composite of 4 screenshots + title
- [x] Release infrastructure build-log post: "Launching on Free Infrastructure"
- [x] Favicon refinement (skull-and-crossbones, gold + white)
- [x] Additional build log posts: "Launching on Free Infrastructure", "Browser Port Feasibility"

## Phase 2: Browser Play Feasibility

- [x] Evaluate porting strategy — Pygbag/WebAssembly recommended for Phase 2
- [x] Choose first game: Cannonball Clash (simplest game, minimal changes)
- [ ] Port Cannonball Clash via Pygbag as feasibility spike
- [ ] Measure bundle size, load time, frame rate, input latency
- [ ] Embed or link web-playable game prototype on /play
- [ ] Port remaining games if Pygbag performance is acceptable

## Phase 3: Polish

- [ ] CRT scanline effect (tasteful, toggleable, performance-conscious)
- [ ] Pixel/arcade accent animations (score counter, selection highlight)
- [ ] Nautical chart map background motif for hero or sections
- [ ] Performance audit (Lighthouse target: 90+ all categories)
- [ ] Accessibility audit (keyboard nav, screen reader, contrast)
- [x] Custom 404 page ("Lost at Sea" themed, Cloudflare \_redirects catch-all)
- [ ] Model/tooling comparison table on experiment page

## Maybe / Future

- [ ] Client-side high scores (localStorage only, no backend)
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
