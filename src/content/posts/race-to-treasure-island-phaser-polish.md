---
title: "Race to Treasure Island: Building a Web-Native Phaser Game with Free AI"
description: "Why the fourth browser game went Phaser instead of Pygbag, how boost/wind/overtaking mechanics evolved, and what the AI model workflow looked like."
pubDate: 2026-06-10
draft: false
---

After three Pygbag/WebAssembly ports (Cannonball Clash, Treasure Cove, Kraken's
Wake), the fourth browser game took a different path: a web-native Phaser 3 game
built in TypeScript. Race to Treasure Island is the project's most iterated
browser game — and the first web-native one.

## Why Phaser Instead of Pygbag

The first three browser games are Python/Pygame code compiled through Pygbag to
WebAssembly. They work, but:

- **~12 MB first-load runtime** — the CPython interpreter downloads on every
  first visit.
- **Pygame coordinate model** — all input had to be bridged through a shared
  JS/Python channel.
- **Python runtime overhead** — even simple Pong has ~50 MB of browser memory
  footprint.

For a side-scrolling racer with real-time input, these constraints mattered.
Phaser 3 gives:

- **Instant load** — no runtime download.
- **Direct DOM/input access** — no bridge layer.
- **TypeScript** — catch regressions at compile time.
- **75 Playwright tests** — deterministic via debug hooks.

## The OutRun Direction

The initial design was a top-down racer. After playing with the physics, the
game leaned hard into the OutRun feel:

- **Hold BOOST to accelerate** — a wind meter drains while boosting, recharges
  when coasting.
- **Obstacles cost wind + bump you sideways** — barrels, shipwrecks, reefs,
  debris each have their own collision response.
- **Long John Silver as rival AI** — the opponent follows a deterministic seeded
  path with occasional mistakes you can exploit.
- **Overtake cue** — a visible indicator when you pull ahead.
- **Treasure chest pickups** — +100 bonus points as risk/reward for leaving the
  racing line.

The goal was a 30-second race that feels tight every time.

## Touch Mode Was the Hardest Part

The desktop keyboard version (arrow keys + Shift boost) came together quickly.
Touch controls took many iterations:

- **Button sizing** — too small on narrow phones, too large on tablets.
- **Coordinate mapping** — Phaser's `pointermove` needed dead zones to avoid
  accidental steering.
- **Restart reliability** — the restart button needed to fire before the
  `update()` early-return guard.
- **Pause vs overlay hold** — distinguishing manual pause from the first-visit
  hint overlay required a separate flag.

The final touch layout uses a left/right steer zone, a hold-to-boost button,
and separate pause/restart controls.

## Model Workflow: DeepSeek V4 + Nemotron

The development followed an iterative pattern:

- **DeepSeek V4 Flash Free** handled the deeper passes: game scene structure,
  physics model, boost/wind state machine, AI rival path, obstacle collision
  system, and debug hooks for testability.
  - Best at: generating coherent multi-file patterns from a single prompt.
  - Weakest at: edge cases in collision response and touch input coordinate
    mapping — required the most human review cycles.

- **Nemotron 3 Super Free** (via local Ollama) handled narrow patches: fixing a
  specific collision bug, adjusting HUD element positions, and rewording
  game-over messages.
  - Best at: focused single-file patches with clear before/after examples.
  - Weakest at: understanding the full game state machine across multiple files.

- **Big Pickle / OpenCode Zen** (also free-tier) was used for the Astro website
  components and copy around the game — not for game logic itself.

This workflow — broad passes on a capable cloud model, narrow fixes on a local
model — worked well for a solo project with no paid subscriptions.

## Debug Hooks for Deterministic Testing

The game exposes a `window.__paRace*` API for Playwright:

- `__paRaceDebugSetProgress(n)` — set player progress to any point.
- `__paRaceDebugSetRivalProgress(n)` — set rival progress independently.
- `__paRaceDebugHit()` — trigger an obstacle hit.
- `__paRaceDebugSetBoostMeter(n)` — set boost level.
- `__paRaceDebugRestart()` — restart mid-race.
- `__paRaceDebugShowOvertakeCue()` — force the overtake cue to appear.
- `__paRaceDebugGetState()` — snapshot all race state.

This lets the test suite verify specific behaviors (hit penalty, boost effect,
overtake cue timing, win/loss states, restart clearing) without simulating
gameplay frame by frame.

## What Remains Imperfect

- **Obstacle diversity** — the current seed generates 4 obstacle types but the
  visual distinction between reefs and debris is subtle.
- **Touch boost on narrow screens** — the boost button overlaps the steer zone
  on phones under 360px wide.
- **Rival AI cleverness** — Long John's path has only 3 difficulty curves. A
  more adaptive AI would make repeat plays more interesting.
- **Mobile testing** — all mobile tests run through simulated viewports. Real
  device behavior is validated manually but not automated.

## A Note on the Model Claims

These observations are session notes, not benchmarks. Each model was used for
different tasks at different stages. The relative quality reflects what the
prompt asked for and how clearly the problem was scoped — not a general ranking
of model capability.

The full experiment methodology is documented in
[EXPERIMENT.md](https://github.com/edonahue/pirate-arcade/blob/main/EXPERIMENT.md)
in the desktop repo.
