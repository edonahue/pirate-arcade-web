# Asset Inventory

Current state of all visual assets across the Pirate Arcade project.

## Website Assets (`pirate-arcade-web/public/`)

| Asset                             | Path                                              | Status          | Source                                                 | Next Action                                                    |
| --------------------------------- | ------------------------------------------------- | --------------- | ------------------------------------------------------ | -------------------------------------------------------------- |
| **Favicon**                       | `public/favicon.svg`                              | Placeholder SVG | Hand-coded (derived from `localgame/icon.svg` pattern) | Refine with real pirate arcade branding when logo is finalized |
| **OG Image**                      | `public/og-image.svg`                             | Placeholder SVG | Hand-coded                                             | Replace with real 1200×630 PNG social image                    |
| **Cannonball Clash screenshot**   | `public/images/screenshot-cannonball-clash.svg`   | Placeholder SVG | Hand-coded (Pong-like scene rendered in SVG)           | Replace with real game screenshot                              |
| **Treasure Cove screenshot**      | `public/images/screenshot-treasure-cove.svg`      | Placeholder SVG | Hand-coded (Breakout-like scene)                       | Replace with real game screenshot                              |
| **Kraken's Wake screenshot**      | `public/images/screenshot-krakens-wake.svg`       | Placeholder SVG | Hand-coded (Asteroids-like scene)                      | Replace with real game screenshot                              |
| **Port Royale Tycoon screenshot** | `public/images/screenshot-port-royale-tycoon.svg` | Placeholder SVG | Hand-coded (board-game-like scene)                     | Replace with real game screenshot                              |
| **Security headers**              | `public/_headers`                                 | Real            | Hand-coded                                             | Review CSP when adding new external resources                  |
| **Redirects**                     | `public/_redirects`                               | Real            | Hand-coded                                             | Add redirects when old URLs change                             |
| **Robots.txt**                    | `public/robots.txt`                               | Real            | Hand-coded                                             | Review when site structure changes                             |
| **Web app manifest**              | `public/site.webmanifest`                         | Real            | Hand-coded                                             | Update icon paths when real icons exist                        |

## Desktop Game Assets (`../localgame/`)

| Asset                     | Path                    | Status      | Source                | Notes                                                        |
| ------------------------- | ----------------------- | ----------- | --------------------- | ------------------------------------------------------------ |
| **App icon (SVG)**        | `../localgame/icon.svg` | Real        | Procedural/hand-coded | Used in Debian package, Linux desktop entries                |
| **App icon (ICO)**        | `../localgame/icon.ico` | Real        | Derived from SVG      | Used in Windows executable                                   |
| **Game screenshots**      | N/A                     | **Missing** | N/A                   | No screenshots exist anywhere in the desktop repo            |
| **Procedural renderings** | Generated at runtime    | Real        | Pygame renderer       | Cannot be exported as static images without running the game |

## Recommended Actions (Priority Order)

### High Priority

1. **Capture real game screenshots** for all four games. Options:
   - Run each game locally and take screenshots (requires display)
   - Use Xvfb/virtual display to render without a physical monitor
   - Capture from the launcher screen as a composite
   - Export at 1280×720 or 1920×1080 for best results

2. **Create real OG image** (1200×630 PNG). Should include:
   - Pirate Arcade logo/branding
   - Gold/teal color scheme
   - One of the game screenshots or a composite
   - Clean, readable on social media feeds

### Medium Priority

3. **Refine favicon** — the current "P" in a rounded square is a placeholder. Consider a cannon, treasure chest, or skull-and-crossbones silhouette.

4. **Replace game screenshot SVG placeholders** with actual 16:9 PNG screenshots once captured.

### Low Priority

5. **Add gameplay GIFs** for the build log and play pages (short, 5-10 second loops showing each game in action).

6. **Add release badge images** from GitHub releases (the .deb and .exe download counts).

## Screenshot Capture Method

The desktop game renders everything procedurally. To capture real screenshots:

```bash
# Option 1: Run with a display (SSH with X forwarding or local terminal)
cd ../localgame
python main.py
# Press F11 for fullscreen, then use system screenshot tool

# Option 2: Headless capture with Xvfb (no display needed)
xvfb-run python main.py
# Use import (ImageMagick) or scrot to capture the window
```

The launcher screen in `launcher.py` shows all game cards and would make a good composite hero image.
