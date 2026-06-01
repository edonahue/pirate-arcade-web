---
title: "Porting the Second Game — Treasure Cove via Pygbag"
description: "Treasure Cove (Breakout) is now playable in the browser. The second port took a fraction of the first — most of the infrastructure was already in place."
pubDate: 2026-06-01
draft: false
---

## What Shipped

[Play Treasure Cove in your browser](/play/treasure-cove/).

The second browser port is live. Treasure Cove runs at 1600×900, 60 FPS, with the
same logic, paddle physics, brick grid, ball trail effects, and procedural audio
as the desktop version.

The game code bundle is 11.6 KB (vs Cannonball's 15 KB — fewer game modules).
The CPython WebAssembly runtime (~12 MB) is already cached from Cannonball on
repeat visits.

## What It Took

The second port reused the entire pipeline from Cannonball:

1. **`index.html`** — Copied Cannonball's file, changed the game name, archive
   URL, and controls hint. The `cross_file` monkey-patch, boot script, `WebAudio`
   class injection, DOM elements, and CSS stayed identical.

2. **`audio-bridge.js`** — Added two new sounds to match desktop `audio.py`:
   - `brick_break`: dual sine at 600+900 Hz (0.12 s)
   - `life_lost`: dual sine at 200+150 Hz (0.3 s)
     The existing `paddle_hit`, `wall_hit`, and `level_win` (= `victory` chord)
     sounds were reused verbatim.

3. **`game.py` (the port)** — The desktop `BreakoutGame.run()` method needed the
   same treatment as Cannonball's `PongGame.run()`:
   - `async def` with `await asyncio.sleep(0)` for cooperative multitasking
   - Fixed `dt = 1/60` instead of `clock.tick(c.FPS) / 1000.0`
   - No fullscreen toggle, no mouse click pause in the event loop
   - All keyboard handling kept intact (pause menu, FPS toggle, sound toggle,
     restart, quit)

4. **Shared modules** — `constants.py`, `audio.py` (stub), `highscores.py`
   (stub), and `renderer.py` were copied from the Cannonball port without
   changes. All four are identical between the two browser games.

5. **Game source** — `gameplay.py`, `ball.py`, `paddle.py`, and `brick.py` were
   copied from the desktop source verbatim. Zero changes needed — no `gfxdraw`,
   no file I/O, no platform-specific code.

## File Count

The Treasure Cove port consists of 7 Python source files:

| File              | Lines | Notes                                   |
| ----------------- | ----- | --------------------------------------- |
| `game.py`         | 249   | Ported from desktop (async run loop)    |
| `gameplay.py`     | 209   | Copied verbatim from desktop            |
| `ball.py`         | 78    | Copied verbatim from desktop            |
| `paddle.py`       | 43    | Copied verbatim from desktop            |
| `brick.py`        | 50    | Copied verbatim from desktop            |
| `main.py`         | 55    | New WASM entry point                    |
| `audio-bridge.js` | 109   | Extended from Cannonball (2 new sounds) |

## What Validates the Approach

The second port took roughly 30 minutes of engineering time. The heavy lifting —
`cross_file` patching, Python boot injection via `blocks[0]`, `pip_install("pygame")`
in WASM, `display.set_mode()` ordering, the `WebAudio` bridge class — was already
solved and documented in the first shipping post.

Two data points do not make a pattern, but the effort delta between port one and
port two suggests the remaining two games (Kraken's Wake, Port Royale Tycoon)
will also be straightforward ports.
