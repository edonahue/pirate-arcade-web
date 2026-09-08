---
title: "Four Games, One More Pass: Gameplay Depth Before Maintenance Mode"
description: "A final gameplay pass across the four browser games — persistence, Rally Fever, a real rival, an actual Kraken, and the audit that concluded by changing less."
pubDate: 2026-09-08
draft: false
---

The four browser games were playable, tested, and shipped. Then I played them
properly — full runs, keyboard and touch, all stages — and found that
"playable" was hiding four different depth gaps. This post covers the final
gameplay pass before the collection enters maintenance mode.

## Personal bests first

None of the browser games remembered anything. Every run started from zero, so
there was no reason to come back. All four now persist a local personal best
(score, or longest rally for Cannonball) with no accounts, no backend, and no
tracking — just localStorage with an in-memory fallback.

## Cannonball Clash: Fever with no consequence

Rally Fever had presentation — tier names, glow, callouts — but reaching a
10-hit rally changed nothing about the point. The fix was deliberately small:
crossing CANNONBALL FEVER now grants Reinforced Hull mid-point, once per
point, through the existing power-up path. One mechanic, already-built
plumbing, and the streak chase finally means something.

## Race to Treasure Island: a rival that wasn't

The initial race math favored the player too strongly; Long John was scenery.
He is now a readable rival: scheduled surges (gold sails) followed by
breathers to push on, retaliation when your hits land, and Treasure chests
that restore WIND so routing matters. Winning pays a First-ashore bonus, so
the score chase has a point beyond finishing.

## Kraken's Wake: the missing Kraken

The most obvious gap in the collection: the game called _Kraken's Wake_
contained no Kraken. It now has recurring boss waves with a fairness-first
design — the boss enters at a safe distance, locks its lunge direction at
telegraph start so it stays dodgeable, and only takes damage outside the
lunge. Kill scoring rewards the risk. Most of the work was restraint: entry
distance, telegraph readability, and respawn behavior, not damage numbers.

## Treasure Cove: the audit that changed less

The most interesting lesson of the pass. Initial analysis said Stage 3
needed restructuring — 80 bricks, 116 nominal hit points, nearly half of
them reinforced. Deeper source and layout analysis showed the opposite: the
existing Powder Keg placement already formed a deliberate siege network
capable of removing roughly a third of the stage, and every Treasure brick
sat inside a blast neighborhood.

So the layout didn't change at all. Three small things shipped instead:
`BREACH xN!` feedback so the existing cascades read as major moments,
a missing browser explosion sound (the kegs were firing silently — the
bridge simply had no mapping), and blast-destroyed Treasure keeping its
normal pickup, since the old behavior silently punished exactly the keg
play the game wants to teach. Sometimes the correct result of an audit is
to change less.

## Seams, not cheats

Each fix ships with a deterministic one-shot test seed (consumed on read,
best-score submission suppressed, fresh reloads ordinary). They exist so
browser tests can prove exact behavior — rally tier 10 grants a 150px
paddle, a Stage-3 keg scores exactly 645 with two Treasure drops — and they
doubled as the screenshot rig: every current game screenshot is a
reproducible seeded state, not a lucky frame.

## What stays the same

Zero-cost framing, stated plainly: a terminal coding agent, free-to-use
models, local hardware, GitHub, and Cloudflare's free tier. No paid AI
subscriptions, no cloud compute. From here the collection is in maintenance
mode — future gameplay changes need real player feedback, an observed bug,
or a platform breakage. The release gate stays green; the games stay as
they are.
