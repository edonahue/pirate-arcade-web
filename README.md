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
npm run dev        # Start dev server
npm run build      # Build to dist/
npm run preview    # Preview production build
npm run typecheck  # Run astro check (type checking)
npm run format     # Format with Prettier
npm run check      # Format check + typecheck + build
```

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

## Design

- **Dark-first** with light theme toggle (persisted in localStorage)
- **Retro arcade / pirate map** visual language
- **Mobile-responsive** layout with three breakpoints
- **Accessible** contrast ratios and semantic HTML
- **Static-first** — zero client JS on most pages

## Local Development

```bash
source ~/.nvm/nvm.sh
nvm use
npm install
npm run dev
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Cloudflare Pages setup instructions.

## License

MIT
