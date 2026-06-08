# New Browser Game Readiness Checklist

This checklist covers all steps to add a new browser-playable game to Pirate Arcade. Follow in order.

## Prerequisites

- [ ] Game concept chosen and approved
- [ ] Python/Pygame source ready under `scripts/pygbag-port/<id>/`
- [ ] Game runs locally with `python -m <game_module>`
- [ ] Game has desktop build working

---

## 1. Add Game Source

```bash
# Create directory structure
mkdir -p scripts/pygbag-port/<game-id>/games/<game-module>/
# Add game source files:
# - scripts/pygbag-port/<game-id>/games/<game-module>/__init__.py
# - scripts/pygbag-port/<game-id>/games/<game-module>/game.py
# - scripts/pygbag-port/<game-id>/games/<game-module>/gameplay.py
# - scripts/pygbag-port/<game-id>/games/<game-module>/<other-modules>.py
# - scripts/pygbag-port/<game-id>/main.py (entry point)
# - scripts/pygbag-port/<game-id>/assets/ (images, audio, fonts)
# - scripts/pygbag-port/<game-id>/requirements.txt (if needed)
```

## 2. Build Browser Archive

```bash
# From repo root
cd scripts/pygbag-port/<game-id>/
# Build with pygbag (version pinned to 0.9.3)
python -m pygbag --build --ume_block=0 .
# Output: build/<game-id>.tar.gz
# Copy to web repo:
cp build/<game-id>.tar.gz ../../../public/play/<game-id>/<game-id>.tar.gz
```

## 3. Create Browser Shell

```bash
# Create directory
mkdir -p public/play/<game-id>/

# Create index.html based on existing template (copy from cannonball-clash)
cp public/play/cannonball-clash/index.html public/play/<game-id>/index.html

# Edit index.html:
# - Update CDN version: pythons.js@0.9.3
# - Update archive URL: <game-id>.tar.gz?v=<ASSET_VERSION>
# - Update preload link href
# - Update game-title, controlMode, data-controls
# - Update manifest comment: <!-- GAME: <game-id> -->
# - Verify shared script references use ?v=<ASSET_VERSION>
```

## 4. Update Game Data

```bash
# Edit src/data/games.json
# Add entry:
{
  "id": "<game-id>",
  "title": "<Game Title>",
  "classic": "<Classic Game Reference>",
  "description": "<One-sentence pitch>",
  "status": "browser-playable",
  "statusLabel": "Play in browser now",
  "browserUrl": "/play/<game-id>/",
  "desktopUrl": "https://github.com/edonahue/pirate-arcade/releases",
  "screenshot": "/images/screenshot-<game-id>.png",
  "controlMode": "<pong|breakout|asteroids|custom>",
  "touchDifficulty": "easy|medium|harder",
  "touchDifficultyLabel": "Easiest on touch|Medium on touch|Harder on touch",
  "touchControls": "<Touch control summary>",
  "keyboardControls": "<Keyboard control summary>",
  "howToPlay": "<2-3 sentences for game detail page>",
  "tips": "<1-2 practical tips>",
  "firstPlayTip": "<One-liner for /play/ page>",
  "availabilityNote": "Playable in browser now via Pygbag and WebAssembly, and also included in the desktop release.",
  "seoDescription": "<150-160 chars for meta description>",
  "features": ["Feature 1", "Feature 2", "Feature 3"]
}
```

## 5. Update Asset Versions

```bash
# If shared assets changed, bump version in scripts/game-asset-versions.mjs
# export const ASSET_VERSION = "mobile-v6";  # bump if shared assets changed
# export const CACHE_VERSION = "pirate-arcade-games-v9";  # bump if SW behavior changed
```

## 6. Apply Versions to Game Shells

```bash
npm run apply:game-versions
# This updates ?v= queries in all game HTML files
```

## 7. Validate Archive/Source Parity

```bash
npm run test:archive-parity
# Verifies source matches shipped tarball
```

## 8. Update Service Worker Cache List

```bash
# Edit public/sw.js
# Add to ASSETS_TO_CACHE:
#   "/play/<game-id>/",
#   "/play/<game-id>/<game-id>.tar.gz",
```

## 9. Update CSP Headers

```bash
# Edit public/_headers
# Add three entries for new game:
# /play/<game-id>/
# /play/<game-id>/index.html
# /play/<game-id>/*
# Each needs:
#   ! Content-Security-Policy
#   Content-Security-Policy: ... (copy from existing game, update cdn.pygame.org connect-src)
```

## 9. Run Validation Checks

```bash
# Core validation (should all pass)
npm run test:browser-game-shells
npm run test:service-worker
npm run test:cache-versioning
npm run test:game-versions
npm run test:archive-parity
npm run audit:game-archives
npm run test:public-domain-art
npm run test:game-theming-source
```

## 10. Capture Screenshots

```bash
# Build and capture real in-game screenshots
npm run capture:screenshots
# Output: public/images/screenshot-<game-id>.png (1280x720 PNG)
```

## 11. Validate Screenshots

```bash
npm run test:screenshot-assets
# Validates: PNG format, 1280x720, aspect ratio, brightness, diversity, distinctness
```

## 11. Update SEO/Discoverability (Data-Driven - Auto)

```bash
# These are automatically updated from games.json:
npm run build  # regenerates sitemap.xml with new routes
# Verify:
npm run seo:audit
```

## 12. Full Validation

```bash
npm run verify:release:fast
# Or full gate with Playwright:
npm run verify:release:full
```

## 12. Manual Testing (Real Devices)

```bash
# Follow tests/TESTING_CHECKLIST.md
# Test on:
# - iPhone Safari (real device)
# - Android Chrome (real device)
# - iPad Safari (real device) - landscape
# - Desktop Chrome/Firefox/Safari
```

---

## Post-Release Verification

```bash
# After Cloudflare Pages deploy:
# 1. Visit https://pirate-arcade.com/play/<game-id>/
# 2. Verify CSP headers with: npm run test:check-headers
# 3. Run live parity: ALLOW_STALE_LIVE=1 npm run test:live-parity
# 4. Verify screenshots: npm run test:screenshot-assets
```

---

## Automated vs Manual Steps

| Step                      | Automated                         | Manual                      |
| ------------------------- | --------------------------------- | --------------------------- |
| Sitemap generation        | ✅ `generate-sitemap.mjs`         |                             |
| SEO audit                 | ✅ `seo-audit.mjs`                |                             |
| CSP validation            | ✅ `check-cloudflare-headers.mjs` |                             |
| CSP header creation       |                                   | ✅ Edit `public/_headers`   |
| Service worker cache list |                                   | ✅ Edit `public/sw.js`      |
| Version application       | ✅ `apply:game-versions`          |                             |
| Archive parity            | ✅ `check-archive-parity.mjs`     |                             |
| Screenshot capture        | ✅ `capture:screenshots`          |                             |
| Screenshot validation     | ✅ `check-screenshot-assets.mjs`  |                             |
| Sitemap/llms.txt          |                                   | ✅ Edit manually            |
| Game HTML shell           |                                   | ✅ Create from template     |
| CSP header blocks         |                                   | ✅ Add to `public/_headers` |
| Service worker cache      |                                   | ✅ Edit `public/sw.js`      |

---

## Template Files Reference

| File                 | Purpose                  | Location                                  |
| -------------------- | ------------------------ | ----------------------------------------- |
| Game HTML shell      | Template for new game    | `public/play/cannonball-clash/index.html` |
| Game data entry      | Schema reference         | `src/data/games.json`                     |
| Game detail page     | Auto-generates from data | `src/pages/games/[id].astro`              |
| CSP headers          | Per-game CSP blocks      | `public/_headers`                         |
| Service worker       | Cache list               | `public/sw.js`                            |
| Asset versions       | Version constants        | `scripts/game-asset-versions.mjs`         |
| Game theming markers | Source verification      | `scripts/check-game-theming.mjs`          |

---

## Common Pitfalls

| Issue                           | Cause                                     | Fix                                             |
| ------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| CSP missing `unsafe-eval`       | Forgot `! Content-Security-Policy` detach | Add `!` line before game CSP                    |
| Archive version mismatch        | Forgot `apply:game-versions`              | Run `npm run apply:game-versions`               |
| Screenshot too dark             | Captured loading screen                   | Wait for `__paBootMetrics["game-ready"]`        |
| SW doesn't cache game           | Forgot to add to `ASSETS_TO_CACHE`        | Edit `public/sw.js`                             |
| Sitemap missing route           | Forgot to add to `games.json`             | Add `browserUrl` to game entry                  |
| `llms.txt` outdated             | Manual file                               | Update `public/llms.txt` and `llms-full.txt`    |
| Desktop game shows browser link | `browserUrl` set on desktop-only          | Ensure `browserUrl` only for `browser-playable` |

---

## Version Bumping Guide

| Change                        | Bump                                                    |
| ----------------------------- | ------------------------------------------------------- |
| Shared asset changed (CSS/JS) | `ASSET_VERSION` (e.g., `mobile-v5` → `mobile-v6`)       |
| SW behavior changed           | `CACHE_VERSION` (e.g., `pirate-arcade-games-v8` → `v9`) |
| New game added                | `ASSET_VERSION` if shared assets updated                |
| Pygbag version changed        | `CACHE_VERSION` + update CDN pin in HTML                |

---

## Quick Reference Commands

```bash
# Full new-game validation
npm run verify:release:fast

# Individual checks
npm run test:browser-game-shells
npm run test:service-worker
npm run test:cache-versioning
npm run test:game-versions
npm run test:archive-parity
npm run audit:game-archives
npm run test:public-domain-art
npm run test:game-theming-source
npm run test:screenshot-assets
npm run test:performance-budgets
npm run test:visual-contrast
npm run test:copy-tone
npm run test:check-headers
npm run seo:audit
npm run test:copy-tone
npm run test:css-tokens
npm run test:visual-contrast

# Build & screenshot
npm run capture:screenshots
npm run test:screenshot-assets

# Full gate
npm run verify:release:full
```
