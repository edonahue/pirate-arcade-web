---
title: "Browser Port Feasibility — Pygbag vs Canvas Rewrite"
description: "Evaluating strategies for bringing Pirate Arcade games to the browser: Pygbag/WebAssembly with minimal code changes vs full TypeScript/Canvas rewrite."
pubDate: 2026-05-31
draft: false
---

## The Goal

Each desktop game should eventually be playable in the browser. This post evaluates the approaches and recommends a path forward.

## Approach 1: Pygbag / WebAssembly

[Pygbag](https://pygame-web.github.io/) compiles Python + Pygame code to WebAssembly. The existing game code runs almost unchanged inside a browser tab.

### Pros

- **Minimal code changes.** The game loop, rendering, input handling, and game logic all work as-is. Only the main loop needs `await asyncio.sleep(0)` each frame.
- **Single codebase.** One Python codebase for desktop and web. Bug fixes apply everywhere.
- **Proven.** Pygbag is mature, well-documented, and used by published games.

### Cons

- **Large bundle.** The WASM runtime + pygame + numpy totals ~15-25 MB. First load is slow.
- **Audio complexity.** Pygame's mixer doesn't work in WASM. The procedural audio pipeline (NumPy → raw sound buffers) needs a web audio API fallback.
- **No file I/O.** The high-scores system writes to disk. On WASM, this needs IndexedDB or localStorage.
- **Desktop-only dependencies.** `pygame.SCALED`, `pygame.DOUBLEBUF`, `vsync` flags must be removed for web.
- **Per-game packaging.** Each game needs its own pygbag build and HTML wrapper.

### Changes Needed

For Cannonball Clash (simplest game), the delta is:

```python
# Desktop loop (current)
def run(self):
    clock = pg.time.Clock()
    while True:
        for event in pg.event.get(): ...
        dt = clock.tick(c.FPS) / 1000.0
        self._update(dt)
        self._draw(clock.get_fps())
        pg.display.flip()

# Web loop (changes underlined)
async def run(self):                          # async
    while True:
        for event in pg.event.get(): ...
        dt = clock.tick(c.FPS) / 1000.0
        self._update(dt)
        self._draw(clock.get_fps())
        pg.display.flip()
        await asyncio.sleep(0)                # yield to browser
```

Replace `main()` with `asyncio.run(main())`. Audio files switch extension based on `sys.platform`. That's it for the core game.

## Approach 2: TypeScript / Canvas Rewrite

Rewrite each game from scratch in TypeScript using the HTML Canvas API.

### Pros

- **Small bundle.** ~50-200 KB per game, no WASM overhead.
- **Native web feel.** Keyboard, touch, gamepad all work without translation layers.
- **Full control.** Can optimize rendering, add mobile support, CSS styling.
- **No numpy dependency.** Audio can use Web Audio API directly.

### Cons

- **Complete rewrite.** Each game — Pong, Breakout, Asteroids, board game — must be reimplemented from scratch. Hundreds to thousands of lines per game.
- **Two codebases.** Desktop and web diverge. Bug fixes, balance changes, and new features must be implemented twice.
- **No AI assistance for game logic rewrite.** The existing Python code is AI-generated; the TypeScript rewrite would be manual unless AI can translate effectively.
- **Long timeline.** Even the simplest game (Pong) takes significant effort to match the desktop version's polish — particle effects, screen shake, glow, AI difficulty settings, etc.

## Recommendation: Hybrid (Pygbag for Phase 2, Rewrite for Phase 3)

**Start with Pygbag** for Cannonball Clash as a feasibility spike. It's the simplest game, requires minimal code changes, and proves the web delivery pipeline works.

- Build a single-game HTML page served from the website
- Link it from /play with a "Play in Browser" button
- Measure: bundle size, load time, frame rate, input latency

**If Pygbag performance is acceptable** (60 FPS on mid-range hardware, <10s first load on fast connection), package the remaining three games the same way.

**If Pygbag is too slow or the bundle too large**, switch to TypeScript/Canvas rewrites starting with Cannonball Clash. The Pygbag work is not wasted — it validates the game logic is correct and gives a reference implementation.

## Next Step

Port Cannonball Clash via Pygbag as the feasibility spike. Expected bundle: ~15 MB. Target: 60 FPS, <30 MB total transfer, playable within 10 seconds on a fast connection.
