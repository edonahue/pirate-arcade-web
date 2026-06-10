# Asset Inventory

Current state of all visual assets across the Pirate Arcade project.

## Website Assets (`pirate-arcade-web/public/`)

| Asset                             | Path                                                   | Status          | Source                                                      | Next Action                                                    |
| --------------------------------- | ------------------------------------------------------ | --------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| **Favicon**                       | `public/favicon.svg`                                   | Placeholder SVG | Hand-coded (derived from `localgame/icon.svg` pattern)      | Refine with real pirate arcade branding when logo is finalized |
| **OG Image**                      | `public/og-image.png`                                  | Real PNG        | Composite of game screenshots + title                       | Add to desktop repo if desired                                 |
| **Cannonball Clash screenshot**   | `public/images/screenshot-cannonball-clash.png`        | Real PNG        | Captured via `scripts/capture-browser-game-screenshots.mjs` | Review quality, recapture if game visuals change               |
| **Treasure Cove screenshot**      | `public/images/screenshot-treasure-cove.png`           | Real PNG        | Captured via `scripts/capture-browser-game-screenshots.mjs` | Review quality, recapture if game visuals change               |
| **Kraken's Wake screenshot**      | `public/images/screenshot-krakens-wake.png`            | Real PNG        | Captured via `scripts/capture-browser-game-screenshots.mjs` | Review quality, recapture if game visuals change               |
| **Port Royale Tycoon screenshot** | `public/images/screenshot-port-royale-tycoon.png`      | Real PNG        | Captured via desktop capture pipeline                       | Review quality, recapture if game visuals change               |
| **Race screenshot**               | `public/images/screenshot-race-to-treasure-island.png` | Real PNG        | Captured via `scripts/capture-browser-game-screenshots.mjs` | Review quality, recapture if game visuals change               |
| **Security headers**              | `public/_headers`                                      | Real            | Hand-coded                                                  | Review CSP when adding new external resources                  |
| **Redirects**                     | `public/_redirects`                                    | Real            | Hand-coded                                                  | Add redirects when old URLs change                             |
| **Robots.txt**                    | `public/robots.txt`                                    | Real            | Hand-coded                                                  | Review when site structure changes                             |
| **Web app manifest**              | `public/site.webmanifest`                              | Real            | Hand-coded                                                  | Update icon paths when real icons exist                        |

## Desktop Game Assets (`../localgame/`)

| Asset                     | Path                    | Status      | Source                | Notes                                                        |
| ------------------------- | ----------------------- | ----------- | --------------------- | ------------------------------------------------------------ |
| **App icon (SVG)**        | `../localgame/icon.svg` | Real        | Procedural/hand-coded | Used in Debian package, Linux desktop entries                |
| **App icon (ICO)**        | `../localgame/icon.ico` | Real        | Derived from SVG      | Used in Windows executable                                   |
| **Game screenshots**      | N/A                     | **Missing** | N/A                   | No screenshots exist anywhere in the desktop repo            |
| **Procedural renderings** | Generated at runtime    | Real        | Pygame renderer       | Cannot be exported as static images without running the game |

## Recommended Actions (Priority Order)

### High Priority (Done)

1. ✅ **Capture real game screenshots** for all four games via `scripts/capture-screenshots.py` (SDL_VIDEODRIVER=dummy, no display needed).

2. ✅ **Create real OG image** (1200×630 PNG) — composite of 4 game screenshots with Pirate Arcade title.

3. ✅ **Replace game screenshot SVG placeholders** with real 16:9 PNGs in `public/images/`.

### Medium Priority

4. **Refine favicon** — the current "P" in a rounded square is a placeholder. Consider a cannon, treasure chest, or skull-and-crossbones silhouette.

### Low Priority

5. **Add gameplay GIFs** for the build log and play pages (short, 5-10 second loops showing each game in action).

6. **Add release badge images** from GitHub releases (the .deb and .exe download counts).

## Screenshot Capture Method

Browser game screenshots are captured via Playwright + Sharp:

```bash
cd pirate-arcade-web
npm run capture:screenshots
```

This builds the site, boots the Astro preview server, opens each game shell in
headless Chromium, waits for `__paBootMetrics["game-ready"]`, hides shell UI
overlays, presses the start key, renders ~3-8s of gameplay, then samples
`canvas.toDataURL("image/png")` and resizes to 1280×720 via Sharp.

Desktop game screenshots (Port Royale Tycoon) are captured separately via the
desktop repo's own capture pipeline.
