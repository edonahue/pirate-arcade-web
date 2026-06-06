---
title: "Port Royale Tycoon Browser Port — Feasibility Review"
description: "Three arcade games are now browser-playable via Pygbag. Can the same pipeline handle a turn-based board game with AI opponents, save/load, and property trading? Here's the assessment."
pubDate: 2026-06-05
draft: false
---

## The Fourth Game

Port Royale Tycoon is Pirate Arcade's fourth and most complex game — a property-trading board game (Monopoly-style) with 2-4 players, AI opponents, save/load, and an in-game economy. It's the only game in the catalog that wasn't included in the arcade porting push.

The existing three browser ports — Cannonball Clash (Pong), Treasure Cove (Breakout), and Kraken's Wake (Asteroids) — are all real-time action games running via Pygbag/WebAssembly. The pipeline is proven: inline boot script in `index.html`, async game loop, WebAudio bridge, touch control overlay, and a pygbag-built `.tar.gz` archive.

This review asks: should Port Royale Tycoon follow the same path?

## Source Code Status

The game's internal name is `PirateDominion` and lives in the desktop repository (`edonahue/pirate-arcade`). It has **never been copied into the web repo's `scripts/pygbag-port/` directory**, so no pygbag-specific analysis or modifications exist yet.

Based on the desktop launcher's import chain, the game module structure is:

```
pirate_dominion/
  game.py          — main game loop, turn management, state machine
  board.py         — board logic, tile management
  player.py        — player state, money, properties
  trading.py       — buy/sell/trade mechanics
  ai.py            — AI opponent decision-making
  rendering.py     — board rendering, UI elements
  save_load.py     — file I/O for save/load
  constants.py     — game configuration
```

The desktop launcher also shows it uses the shared `renderer.py`, `audio.py`, `constants.py`, and `highscores.py` modules — the same ones already ported for the arcade games. This means the shared infrastructure is already WASM-compatible.

## What Makes This Different From the Arcade Ports

### Game Loop Model

Arcade games run a tight 60 FPS loop with continuous rendering and input polling:

```python
async def run(self):
    while True:
        for event in pg.event.get(): ...
        dt = clock.tick(60) / 1000.0
        self._update(dt)
        self._draw(clock.get_fps())
        pg.display.flip()
        await asyncio.sleep(0)
```

A board game is turn-based. The loop is event-driven — render a static board state, wait for player input, resolve the turn, re-render. Pygbag can handle this, but the async pattern offers no advantage over a web-native click handler. The WASM runtime overhead (~12 MB baseline) is wasted on a game that could run as a static HTML page with JavaScript event listeners.

### Input Model

All three arcade ports use directional input — keyboard arrows mapped to paddle/ship movement, plus action buttons. The mobile touch layer maps these to drag zones and nudge buttons.

Port Royale Tycoon needs **point-and-click**: selecting board locations, choosing menu options, confirming trades, managing inventory. This is fundamentally different from the arcade games. The existing `mobile-controls.js` overlay (drag zones + nudge buttons) would be irrelevant. A board game needs tap targets, not virtual joysticks.

Two options:

1. **Pygbag + mouse events** — The existing Pygame mouse event system translates to browser pointer events via Pygbag. It would work, but the touch UX would be second-class — Pygbag translates touches to mouse clicks, losing multi-touch and gesture support.

2. **Web-native HTML UI** — The game's UI (menus, property dialogs, trade screens) could render as HTML/CSS with JS event handlers, calling into a WASM game logic module or a pure JS reimplementation. This is the better UX but means building and maintaining two UI layers.

### Save/Load

Port Royale Tycoon supports save/load via file I/O. On WASM, `open()`/`write()` don't work — the Pygbag runtime provides an IndexedDB-backed virtual filesystem, but it's slower and has size limits. The save/load code (`save_load.py`) needs:

- A platform check to use the virtual filesystem on web
- UI for save/load dialogs (which the desktop game likely provides via `pygame.filedialog` — not available in WASM)
- Serialization review (pickle? JSON? custom binary?)

This is more work than the arcade games (which only read a highscores file via `json.load`).

### Audio

The arcade games use procedural audio synthesis (NumPy → raw buffer → SDL_mixer via `pygame.sndarray`). This pattern is already WASM-compatible via the WebAudio bridge (`audio-bridge.js`). Port Royale Tycoon likely uses the same pipeline. Low risk.

### Dependencies

The arcade games confirmed that `pygame-ce` on WASM lacks `gfxdraw` (fixed by switching to `pygame.draw.circle`) and `pygame.SCALED`/`DOUBLEBUF`/`vsync` flags (removed for web). Port Royale Tycoon may or may not use these — the source needs to be audited.

## Effort Estimate

| Task                                             | Effort           | Risk                                    |
| ------------------------------------------------ | ---------------- | --------------------------------------- |
| Fetch and audit PirateDominion source            | 1 hour           | Low                                     |
| Fix WASM-incompatible pygame calls               | 2-4 hours        | Medium — unknown code quality           |
| Convert game loop to async                       | 0.5 hour         | Low — one function signature change     |
| IndexedDB save/load                              | 3-5 hours        | Medium — dialog UI + serialization      |
| Audio bridge                                     | 1 hour           | Low — shared bridge already exists      |
| Build and package (pygbag-port)                  | 1 hour           | Low — scripted pipeline exists          |
| Browser shell (index.html + CSP + SW)            | 2 hours          | Low — copy template                     |
| Touch controls (point-and-click vs directional)  | 4-8 hours        | High — new interaction paradigm         |
| Mobile layout testing                            | 2-4 hours        | Medium — board must fit mobile viewport |
| Integration (scripts, tests, consistency checks) | 2-4 hours        | Low — mechanical, already templated     |
| QA and regression testing                        | 3-5 hours        | High — board game edge cases            |
| **Total**                                        | **~21-36 hours** |                                         |

For comparison, the three arcade ports averaged ~8-12 hours each (including pipeline setup for the first one).

## Recommendation: Defer

Port Royale Tycoon is **technically feasible** via Pygbag — the pipeline is proven, the shared infrastructure works, and the game doesn't use exotic dependencies. But the effort-to-value ratio doesn't justify it right now:

1. **Wrong tool for the job.** Pygbag's strength is running real-time 2D games with minimal changes. A turn-based board game with point-and-click UI gains nothing from WASM — the overhead is pure cost.

2. **Controls don't transfer.** The entire mobile control system built for arcade games (drag zones, virtual buttons, touch overlay) is irrelevant to a board game. A board game needs HTML/CSS UI, not WASM rendering.

3. **Two codebases, not one.** If we port via Pygbag, the mobile/web UX is still a bespoke HTML overlay (save/load dialogs, trade menus). That's building two UIs — one in Python/Pygame, one in HTML/JS — with no reuse.

4. **No new technical ground.** The three arcade ports already prove Pygbag works, mobile controls work, audio bridging works, and the pipeline is solid. Port Royale would repeat the same process with a worse fit.

### What I'd Do Instead

The right path for Port Royale Tycoon is a **web-native TypeScript rewrite** of the UI layer, wrapping the game logic:

- Board, menus, trade dialogs, and inventory as HTML/CSS components
- Game logic (rules, AI, economy) compiled from Python to WASM via Pygbag, or rewritten in TypeScript
- Save/load via `localStorage` or IndexedDB directly from JS
- Audio via Web Audio API directly from JS
- Total bundle under 1 MB

This is a larger project (40-80 hours) but produces a genuinely better web game. It's also a natural Phase 4 candidate after the arcade polish pass is complete.

### Current Status

Port Royale Tycoon remains **desktop-only** for now. The `/play` page correctly shows it as a desktop download. The build-log posts and ROADMAP have been updated to reflect this decision.

The three arcade ports are complete. This is a good time to pause browser-port work, polish what's live, and assess whether the board game port deserves the investment it would require.
