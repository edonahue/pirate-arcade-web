# Contributing

## Node Setup

- Node >=22.12.0 (Astro 6 requirement). See `.nvmrc` — use `nvm use`.
- `npm ci` for install (uses lockfile, matches CI).

## Local Development

```bash
npm run dev        # astro dev server
npm run build      # static export to dist/
npm run preview    # astro preview (for Playwright tests)
```

## Validation

Run before pushing:

```bash
npm run verify:release:fast    # all deterministic checks (~13s)
npm run verify:release:full    # adds Playwright (10-15 min)
```

## Branch Workflow

- Feature branches from `main`.
- Rebase before opening a PR to keep history linear.
- Squash-merge recommended.
- PRs automatically delete branches on merge.

## Source-of-Truth Files

These files drive automatic validation — update them when their domain changes:

| File                              | Drives                                               |
| --------------------------------- | ---------------------------------------------------- |
| `src/data/games.json`             | Game cards, sitemap, SEO, CSP, SW cache, screenshots |
| `scripts/game-asset-versions.mjs` | ASSET_VERSION, CACHE_VERSION for archives and shells |
| `public/play/*/index.html`        | Per-game shell (Pygbag CDN, archive URL, CSP meta)   |
| `public/_headers`                 | Per-route CSP (derive from games.json)               |
| `public/sw.js`                    | Service worker cache list + fetch strategy           |

## Generated Files

These files are written by scripts, not hand-edited:

- `public/play/*/*.html` `?v=` query strings — written by `apply:game-versions`
- `public/images/screenshot-*.png` — written by `capture:screenshots`
- `public/play/*/*.tar.gz` — written by `patch:game-archives`
- `dist/sitemap.xml` — written by `generate-sitemap.mjs` during build

## Game Source vs Archive

- Pygbag game source lives under `scripts/pygbag-port/<id>/`. The `.tar.gz`
  archive at `public/play/<id>/<id>.tar.gz` is a build artifact.
- Phaser games live entirely in `public/play/<id>/` as static JS files.
  No archive build step needed.

## Screenshots

Production screenshots (`public/images/screenshot-<id>.png`, 1280×720) are
committed static assets. Refresh via `npm run capture:screenshots` when
game visuals change meaningfully. Validate with `npm run test:screenshot-assets`.
Desktop-only games produce screenshots via their own capture scripts.

## Dependency Policy

- `phaser` is the only production dependency (needed by Race to Treasure Island
  at runtime/build time).
- All other packages go in `devDependencies`.
- Adding a dev-dep requires updating both `package.json` and the
  `ALLOWED_DEV_DEPS` list in `scripts/check-dependency-hygiene.mjs`.
- Dependabot handles weekly update PRs. Major-version bumps are deferred
  (requires dedicated CI compatibility pass). Phaser 4 is explicitly ignored
  pending a migration spike.

## PR Expectations

See `.github/pull_request_template.md` for the PR checklist. Every PR should:

1. Target `main`.
2. Pass `verify:release:fast`.
3. Update docs if behavior changed.
4. Touch `src/data/games.json` if game inventory changed.
5. Touch `sw.js` and `_headers` if a game is added.
