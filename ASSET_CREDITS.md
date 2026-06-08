# Asset Credits — Pirate Arcade

Sources, authors, licenses, and transformation notes for all shipped visual assets.

## Public Domain Art

### Howard Pyle — Book of Pirates (1921)

| File                                                     | Source            | License                          | Notes                                  |
| -------------------------------------------------------- | ----------------- | -------------------------------- | -------------------------------------- |
| `public/images/art/pyle-marooned.webp`                   | Wikimedia Commons | Public domain (author died 1911) | 1600×1128, converted from JPEG to WebP |
| `public/images/art/pyle-blackbeard-buries-treasure.webp` | Wikimedia Commons | Public domain                    | 1600×1120, converted from JPEG to WebP |
| `public/images/art/pyle-walking-the-plank.webp`          | Wikimedia Commons | Public domain                    | 1600×1125, converted from JPEG to WebP |
| `public/images/art/pyle-treasure-division.webp`          | Wikimedia Commons | Public domain                    | 1600×979, converted from JPEG to WebP  |

### Louis Rhead — Treasure Island (1915)

| File                                                 | Source            | License                                          | Notes                                                |
| ---------------------------------------------------- | ----------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `public/images/art/rhead-treasure-island-cover.webp` | Project Gutenberg | Public domain (published 1915, author died 1926) | 1000×1491, converted from JPEG to WebP at quality 75 |

## Game Sprites

### Race to Treasure Island

| File                                                       | Source                 | License       | Notes                                                                                                       |
| ---------------------------------------------------------- | ---------------------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| `public/images/race-to-treasure-island/player-ship.png`    | Generated (procedural) | Original work | 48×80 PNG. Generation/pipeline not yet documented. Replace or trace from CC0 sprite sheet in a future pass. |
| `public/images/race-to-treasure-island/long-john-ship.png` | Generated (procedural) | Original work | 48×80 PNG. Same note as player-ship. Slightly different tint for rival identification.                      |

### Procedural Textures

All remaining game textures (ocean background, barrel, shipwreck, reef, debris, treasure chest, boost bar, treasure island, finish flag, particle) are generated at boot time via `BootScene.generateTextures()` using Phaser Graphics API. They are original procedural code, not external assets.

## Game Screenshots

| File                             | Source                  | Notes                                                                                                                                                                                                                                                                            |
| -------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/images/screenshot-*.png` | Captured via Playwright | 1280×720 PNG at compressionLevel 9. Captured by `scripts/capture-browser-game-screenshots.mjs`. Each game is booted in headless Chromium, UI overlays hidden, start key pressed, ~3-8s of gameplay rendered, then `canvas.toDataURL("image/png")` sampled and resized via Sharp. |

## Future Work

- **Ship sprites**: Replace procedurally-generated ships with properly sourced CC0 or commissioned sprites. Document source and any transformations.
- **UI icons**: Current touch controls use Unicode/emoji characters (◀ ▶ ⛵ ⏸ ↻). Replace with vector icons if needed for consistency.
- **Audio**: No audio files shipped yet. All sounds are stubs or procedural. Future audio pass must document sources and licenses.

## Roadmap

- A public `/sources/` or `/credits/` page should be created in a later pass, auto-populated from `src/data/publicDomainArt.ts` and `ASSET_CREDITS.md`.
