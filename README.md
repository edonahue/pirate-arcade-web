# Pirate Arcade

A pirate-themed arcade collection and an experiment in zero-cost AI-assisted development.

**Domain:** [pirate-arcade.com](https://pirate-arcade.com)

## Stack

- **Framework:** [Astro](https://astro.build) 6, static export
- **Language:** TypeScript (strict mode)
- **Styling:** Vanilla CSS with CSS custom properties (design tokens)
- **Fonts:** Bangers (display), Inter (body), IBM Plex Mono (mono)
- **Hosting:** Cloudflare Pages (free tier)
- **CI:** GitHub Actions

## Scripts

```bash
npm run dev                   # Start dev server
npm run build                 # Build to dist/
npm run preview               # Preview production build
npm run typecheck             # Run astro check (type checking)
npm run format                # Format with Prettier
npm run seo:audit             # Inspect built SEO/indexing files
npm run check                 # Format check + typecheck + build + seo:audit
npm run capture:screenshots   # Capture in-game screenshots (build + Playwright)
npm run test:screenshot-assets # Validate screenshot files (format + pixel content)
npm run verify:release:fast   # Fast release gate (~20 deterministic checks)
npm run verify:release:full   # Full release gate (fast + Playwright)
```

See [MAINTENANCE.md](./MAINTENANCE.md) for detailed documentation on each
script, validation workflow, service worker, security headers, and more.

## Project Structure

```
src/
  components/    Reusable Astro components
  content/       Content collections (build log posts)
  data/          Static data files (games, nav, profile)
  layouts/       Page layouts
  pages/         Route pages
  styles/        CSS design tokens and partials
public/          Static assets (headers, favicon, images)
```

## Content editing (Pages CMS)

The build log posts (`src/content/posts/*.md`) and the game catalog
(`src/data/games.json`) are editable through [Pages CMS](https://pagescms.org),
a Git-based CMS for static sites:

1. Go to [app.pagescms.org](https://app.pagescms.org) and sign in with the
   GitHub account that owns this repo.
2. Open the project — the schema is defined in `.pages.yml` at the repo root.
3. Edit build log posts or games from the sidebar. Saving commits straight
   to `main`; Cloudflare Pages will redeploy automatically.

Posts are frontmatter-validated markdown. The games file is a JSON array
loaded by `src/data/games.ts`, so editing a game in Pages CMS is just a
JSON edit — no code change required.

## Search indexing

The site is static and exposes:

- `https://pirate-arcade.com/robots.txt`
- `https://pirate-arcade.com/sitemap.xml`
- `https://pirate-arcade.com/feed.xml`
- `https://pirate-arcade.com/llms.txt`
- `https://pirate-arcade.com/llms-full.txt`

Submit the sitemap in Google Search Console and Bing Webmaster Tools after
deploy. Use URL inspection/submission for the home page, `/play/`,
`/build-log/`, `/source/`, and the individual `/games/.../` pages.

Optional IndexNow support is available after build:

```bash
INDEXNOW_KEY=<key> SITE_URL=https://pirate-arcade.com npm run indexnow:submit
```

By default the script reads `dist/sitemap.xml`; set `INDEXNOW_URLS` to a
comma-separated list to submit only changed URLs.

## Design

- **Dark-first** with light theme toggle (persisted in localStorage)
- **Retro arcade / pirate map** visual language
- **Mobile-responsive** layout with three breakpoints
- **Accessible** contrast ratios and semantic HTML
- **Static-first** — zero client JS on most pages

## Local Development

**Node.js requirement:** >=22.12.0 (Astro 6). The project includes `.nvmrc`
— use `nvm use` or equivalent to switch.

```bash
source ~/.nvm/nvm.sh
nvm use
npm install
npm run dev
```

If `nvm use` fails, upgrade your Node.js. `typecheck` and `build` will fail
with an unsupported-version error otherwise. Other checks (format, css-tokens,
lint, browser-game consistency, service-worker, archive parity) are version-agnostic.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Cloudflare Pages setup instructions.

## License

MIT

<!-- Last updated: Sat Jun  6 02:54:43 AM EDT 2026 -->
