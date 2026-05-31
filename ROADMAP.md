# ROADMAP

## Phase 1: Foundation (current)

- [x] Astro site scaffold with CSS design tokens
- [x] Global layout, navigation, footer, SEO/OG metadata
- [x] Home, Play, Build Log, About, Source pages
- [x] GameCard, Hero, ArcadeFrame, BuildLogCard, StatusBadge, CTAButton components
- [x] Starter build post: "The Pirate Arcade Experiment"
- [x] README, ROADMAP, DEPLOYMENT documentation
- [x] Security headers, robots.txt, sitemap, favicon, webmanifest
- [x] CI workflow (format check + typecheck + build)
- [ ] GitHub repo created and pushed
- [ ] Cloudflare Pages deployment configured

## Phase 2: Content & Assets

- [ ] Real screenshots for all 4 games
- [ ] OG image (1200×630) with pirate arcade branding
- [ ] Additional build log posts (one per development session)
- [ ] Screenshot image files in `public/images/`
- [ ] Favicon refinement (pirate-themed icon)

## Phase 3: Browser Play

- [ ] Evaluate porting strategy (WASM/Pyodide vs. web-native rewrite)
- [ ] Choose first game to port
- [ ] Embed or link web-playable game builds on /play
- [ ] Update game status badges

## Phase 4: Polish

- [ ] CRT scanline effect (tasteful, toggleable)
- [ ] Pixel/arcade accent animations
- [ ] Nautical chart map background motif
- [ ] Performance audit (Lighthouse)
- [ ] Accessibility audit
- [ ] Custom 404 page

## Maybe / Future

- [ ] Authentication or guest accounts
- [ ] Local leaderboards (client-side only)
- [ ] Sound effects / ambience on the website
- [ ] Analytics (privacy-respecting, opt-in)
- [ ] RSS feed for build log
- [ ] Newsletter / update subscription (zero-cost option)
- [ ] Contribution guide for open source contributors

## Non-Goals

- No paid Cloudflare services (Workers, D1, R2, Turnstile)
- No backend servers or databases
- No payments or subscriptions
- No user accounts or authentication
- No ads or tracking (beyond optional privacy-respecting analytics)
