---
title: "Shipping the First Browser Port — Cannonball Clash via Pygbag"
description: "Cannonball Clash is now playable in the browser. Here's what it took to get a Python+Pygame game running on the web, what broke, what worked, and what's next."
pubDate: 2026-06-01
draft: false
---

## What Shipped

[Play Cannonball Clash in your browser](/play/cannonball-clash/).

The game runs at 1600×900, 60 FPS, same logic and assets as the desktop version. The Python source required only a handful of changes to work on WebAssembly — most of the effort was in the build pipeline, not the game code.

The CPython WebAssembly runtime is ~12 MB on first load (cached after that). The game code bundle is 15 KB.

## What Broke in WASM

### `gfxdraw` — not available in pygame-ce for WASM

The desktop version uses `pygame.gfxdraw` for anti-aliased circles. The WASM pygame-ce wheel doesn't include `gfxdraw`. Fix: replaced with `pygame.draw.circle` (aliased, visually identical at game scale).

### `cross_file` generator — missing yield

The `cross_file` helper in the pygbag archive tooling uses a generator pattern. WASM's `fopen` returned `None` because the generator never yielded the store object. Fix: added the missing `yield store`.

### Python 3.12 scoping — import outside exception handler

The code had `import sys` inside an `except` block. Python 3.12 treats this differently under WASM. Fix: moved the import to module level.

### CDN wheel — pip install required

pygame-ce is served from a CDN as a `.whl` file. Just importing it returns an empty stub unless the wheel is explicitly fetched first. Fix: `importlib.metadata` + `pip_install("pygame")` before `import pygame`.

### Display init — must happen before game imports

Module-level `pg.Surface()` calls in submodules import before `pg.display.set_mode()` runs. Fix: moved display initialization to the top of the boot script, before importing game modules.

## Non-fatal Warnings

- **`PyMain: BrowserFS not found`** — pygweb's `main.js` checks for the optional BrowserFS in-memory filesystem layer. On browsers without it, Emscripten's MEMFS is used as fallback. The game works fine. This fires from inside a Web Worker and can't be suppressed from the main thread.

- **`Blocked confirm('...')`** — pygbag registers a `beforeunload` handler that calls `confirm()`. Browsers block `confirm()` in `beforeunload` per spec. This fires once when leaving the page; the dialog is automatically denied.

## Testing

Three validation layers:

1. **Game test** (`scripts/test-game.mjs`) — loads the page, waits for canvas visibility, checks canvas dimensions (1600×900) and pixel content (non-zero, non-background color). 3 assertions, 3/3 pass.

2. **Browser prototype suite** (`scripts/test-browser-prototype.mjs`) — full Playwright test across Chromium and Firefox. Checks all routes return 200, canvas renders at correct size with game content, back-link and controls-hint elements exist. Non-fatal warnings only.

3. **Build pipeline** — `npm run typecheck`, `npm run build` pass cleanly.

## Implementation Details

The page is a pygbag-generated HTML wrapper hosted at `/play/cannonball-clash/`. The game logic is identical to desktop — no TypeScript rewrite, no Canvas API, no manual event handling. The Python source from the desktop repository builds into a WASM bundle via pygbag.

Key architectural decisions:

- **`blocks[0]` one-liner** — The CPython interpreter starts via `import_site` → `shell.runpy` → `eval(blocks[0])` instead of `PyRun_SimpleString`. This avoids timing issues with the interactive console and prevents double execution.

- **CSP headers** — The `_headers` file lists pygbag CDN domains (`pygame-web.github.io`, `cdn.pygame.org`) and `'wasm-unsafe-eval'` for WASM module instantiation.

- **No paid services** — The WASM runtime is served from pygbag's CDN, the page is served by Cloudflare Pages free tier. Zero dollars.

## What Changed

Files modified in the Cannonball Clash source:

- `web/main.py` — `asyncio.sleep(0)` in loop, `gfxdraw` → `draw.circle`, pip_install, display init order, scoping fix
- `pygame-ce-wasm/archive/player.py` — `cross_file` yield fix
- `pygame-ce-wasm/archive/renderer.py` — `gfxdraw` → `draw.circle`
- `public/_headers` — CSP for pygbag CDN + wasm-unsafe-eval

Files created or modified on the website:

- `public/play/cannonball-clash/index.html` — pygbag-generated wrapper with back-link, controls-hint, keyboard focus, dark theme
- `src/data/games.ts` — new `"browser-playable"` status type, `browserUrl` field
- `src/pages/play.astro` — hero copy update, mixed availability language
- `src/components/GameCard.astro` — browser-playable status badge + play link
- `src/styles/components.css` — `.game-card__play-link` styles
- `ROADMAP.md` — Phase 2 checked off
- `scripts/test-game.mjs` — game-specific canvas assertions
- `scripts/test-browser-prototype.mjs` — full Playwright suite

## Next Steps

- Port Treasure Cove, Kraken's Wake, and Port Royale Tycoon via the same Pygbag pipeline
- Each game will need individual audio and renderer fixes (gfxdraw usage in particle systems, SDL_mixer → Web Audio API)
- Investigate WASM audio pipeline for the procedural sound generator (NumPy → raw buffer → Web Audio)
- Consider CRT scanline overlay as a toggleable CSS layer
