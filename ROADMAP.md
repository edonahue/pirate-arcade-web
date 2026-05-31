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

- [ ] Real game screenshots for all 4 games (see ASSETS.md for capture method)
- [ ] Real OG image (1200×630 PNG) for social sharing
- [ ] Additional build log posts for each development session
- [ ] Favicon refinement (pirate-themed, not placeholder)
- [ ] Add at least one more build post covering the website scaffold session

## Phase 2: Browser Play Feasibility

- [ ] Evaluate porting strategy:
  - Pygbag/WebAssembly (port Pygame to browser with minimal rewrite)
  - TypeScript/Canvas rewrite (full web-native)
  - Hybrid: port one game as feasibility spike
- [ ] Choose first game to port (likely Cannonball Clash as simplest)
- [ ] Embed or link web-playable game prototype on /play
- [ ] Update game status badges to reflect browser state

## Phase 3: Polish

- [ ] CRT scanline effect (tasteful, toggleable, performance-conscious)
- [ ] Pixel/arcade accent animations (score counter, selection highlight)
- [ ] Nautical chart map background motif for hero or sections
- [ ] Performance audit (Lighthouse target: 90+ all categories)
- [ ] Accessibility audit (keyboard nav, screen reader, contrast)
- [ ] Custom 404 page
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
