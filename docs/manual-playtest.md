# Manual Playtest Plan

## Purpose

Find product/playability issues that automated tests miss. Run this after
automated checks pass, before starting product-facing work.

## Before testing

```sh
npm run verify:release:fast
npm run test:browser-games:chromium
npm run test:game-matches
```

## Devices / viewports

- Desktop Chromium
- iPhone Safari or mobile device emulation
- iPad landscape if available

## Site hub checklist

- Can find each playable game from `/play/`
- Game cards explain controls/status clearly
- Start/back navigation is obvious
- Screenshots or labels match current game state
- No confusing stale copy

## Per-game checklist

For each game note:

- load time and loading messages
- first-run clarity (what do I do?)
- controls discoverability (can I guess the controls?)
- keyboard controls feel
- touch controls feel (where applicable)
- pause/menu/return-to-arcade behavior
- difficulty curve (too hard? too easy? just right?)
- visible glitches (rendering, clipping, flickering)
- audio behavior (unlocks on first tap? sounds appropriate?)
- "would a kid understand this?" note
- "is this fun after 2 minutes?" note

### Game-specific prompts

**Cannonball Clash:**

- paddle feel (responsive? laggy?)
- ball speed (too fast? too slow?)
- scoring clarity (can you tell who's winning?)
- pause/restart clarity

**Treasure Cove:**

- launch/serve clarity
- paddle feel
- pickups readability (can you tell what a pickup does?)
- brick/stage progression
- life loss clarity

**Kraken's Wake:**

- turn/thrust feel
- projectile clarity (can you see your cannonballs?)
- asteroid/enemy readability (can you tell threats apart?)
- game-over/restart clarity

**Race to Treasure Island:**

- boost meter readability
- obstacle visibility
- rival pacing
- restart clarity

## Findings format

Severity levels:

- **P0** — blocks play, load, or navigation
- **P1** — confusing or frustrating but playable
- **P2** — polish or nice-to-have

Template:

```
Game:
Device:
Finding:
Severity:
Repro steps:
Expected:
Actual:
Suggested next action:
Screenshot/video:
```

## ChatGPT / Freewheel handoff

Paste this block into a new conversation after playtesting:

```
I manually playtested https://pirate-arcade.com at commit <SHA>.

Validation before playtest:
- verify:release:fast:
- browser smoke:
- game matches:

Findings:
1. [Game / device / severity / finding / repro / suggested next action]
2. ...

Please classify these findings, recommend the smallest next
product-facing fix, and draft an OpenCode prompt. Prefer one
focused improvement over broad cleanup.
```
