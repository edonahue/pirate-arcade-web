---
title: "Elegant Pirate Visuals + Browser Game Art Direction"
description: "All three browser-playable games got an art-direction pass: elegant ship paddles, a treasure-barge longboat, fortress-styled bricks, and automated testing to protect them. Here's what was done and what still needs work."
pubDate: 2026-06-05
draft: false
---

## What Shipped

This pass replaces every generic rectangle in the browser games with hand-drawn Pygame visuals — no image assets, just procedural geometry driven by the existing collision rectangles.

### Cannonball Clash (Pong) — Pirate Ship Paddles

Both paddles are now elegant side-profile pirate ships drawn with layered polygons:

- **Hull**: Pointed bow toward the center of the play field, rounded stern toward the edge. The bow faces inward so both ships appear to be sailing toward each other.
- **Deck & gunwale**: Deck planking inside the hull, with a gold-trimmed gunwale line and gold keel line.
- **Mast & rigging**: A single mast with yardarm crossbar, a large main triangular sail, and a smaller jib sail.
- **Flag**: A pennant at the mast top, colored teal for the player and rum-red for the AI.
- **Cannon ports**: Small dark rectangles along the hull — the number scales with paddle height.
- **Accent stripe**: A teal stripe for the player's ship and a red stripe for the AI's ship, running along the lower hull.
- **Power-up visual**: When the big-paddle power-up is active, a gold tint overlay and gold outline rect appear. The glow-surface buffer is cached.
- **Collision rectangle unchanged** (16x100 normal, 16x150 big).

### Treasure Cove (Breakout) — Longboat Paddle

The breakout paddle is an elegant horizontal longboat (skiff/barge):

- **Hull**: Swept traditional longboat profile with raised bow and stern.
- **Deck, gunwale, keel**: Internal planking area with gold trim lines.
- **Mast & crow's nest**: Central mast with a small crow's nest platform at the top.
- **Sail**: Cream/sand-colored main sail hanging from a yardarm.
- **Oars**: Small oars drawn along the hull sides.
- **Treasure cargo crate**: Visible amidships — dark brown rectangle with gold bands.
- **Lantern**: Gold glow circle at the center front, acting as a visual launch cue for the ball.
- **Collision rectangle unchanged** (140x16).

### Treasure Cove — Fortress Stone Bricks

The breakout bricks were rainbow-colored rectangles. They are now fortress-style stone blocks:

- **Row-specific stone palette**: 8 rows, from dark foundation stone at the bottom to pale treasure-vault stone at the top.
- **3D bevel effect**: Each brick has a highlight edge (top-left) and shadow edge (bottom-right), creating a raised-stone appearance.
- **Stone joint line**: A vertical crack/line runs down the center of each brick.
- **Damage detail**: When a brick's health drops below its maximum, a small horizontal crack appears.
- **Gold glow preserved**: The last-hit brick still pulses gold.
- **Collision rectangles unchanged** (standard brick grid).

### Kraken's Wake (Asteroids) — No Visual Changes

The Kraken's Wake ship was already a layered polygon sprite (hull, deck, mast, sails, flame effect). Colors were already cohesive with the pirate palette — no changes needed for this pass.

## Design Decisions

### Why Procedural Drawing Instead of Image Assets

- **No additional network requests**: Everything is drawn at runtime with Pygame primitives. No PNG/SVG files to download.
- **Scales automatically**: The paddle visuals respond to the `height` property (which changes during power-ups). Image assets would need multiple resolutions.
- **Zero archive size increase**: The cannonball-clash archive actually shrank from 30K to 14K after stripping stale `__pycache__` files.
- **Consistent with the project's approach**: The desktop games also use procedural drawing. This keeps the rendering path identical between desktop and browser.

### Why `side='left'` / `side='right'` Parameter

The original Paddle class had no faction identity. Adding the `side` parameter lets the constructor build a mirror-image ship with different accent colors:

- Left (player): teal accents, bow points right
- Right (AI): rum-red accents, bow points left

The `_build_surfs` method caches the ship surface per instance, so the faction identity is set once at construction and never changes.

### Why Teal for Player, Rum-Red for AI

The existing CSS design tokens already define `--pirate-teal` and `--pirate-red` as accent colors. Using the same colors in-game creates visual cohesion between the site theme and game visuals.

## Known Gaps

### Collision Rectangle vs Visual Size

The ship visuals extend ~40px wider than the collision rectangle (16px wide). This means:

- The cannonball can pass through the visual sail/flag area without colliding
- The ship "looks" bigger than it plays
- This is intentional — the hitbox is unchanged to preserve game feel, but it's a visual gap that could confuse players

On mobile in landscape, the visual overhang is less noticeable because the canvas is scaled down.

### No Kraken's Wake Visual Pass

Kraken's Wake (Asteroids) was reviewed and its ship was already visually adequate, but:

- It uses a plain black background with white stars — no nebula or ocean backdrop
- There's no kraken tentacle visual (the enemy is abstract triangles)
- The flame effect is simple (red/orange/yellow ellipses)

This was deprioritized because the ship itself already reads as a pirate vessel, and the game's visual identity is "space pirates" — the abstract style works.

### Fortress Bricks Replace Rainbow Color Coding

The original breakout bricks used rainbow colors that served as a visual row indicator. The new stone palette preserves distinct row hues (dark stone → weathered brick → terracotta → sandstone → limestone → mossy → sea-weathered → pale treasure vault), but:

- The hue difference between adjacent rows is subtler than rainbow
- Players familiar with the original may find the bricks harder to distinguish at a glance
- The bevel effect partially compensates by adding depth cues per row

### No In-Game Visual Toggle

There is no option to revert to the original rectangle visuals. Players who preferred the minimal look cannot switch back. Adding a visual toggle would require:

- A new game settings API (desktop + browser)
- Persistence (localStorage)
- A settings UI in each game's menu

This is tracked as a possible future enhancement but was out of scope for this pass.

## Test Coverage

A new Playwright test (`tests/game-theming.spec.ts`) protects the visuals:

- **Source-marker checks**: Each game archive is inspected for key identifiers in the Python source (e.g., `_ship_surf`, `crate`, `lantern`, `crow`, `accent_color`, `cannon_port`).
- **Pixel rendering**: The test boots each game, clicks to start, and samples canvas pixels to confirm non-trivial rendering.
- **Three games covered**: Cannonball Clash, Treasure Cove, and Kraken's Wake.
- **CI skip for Kraken's Wake**: The game's Pygbag boot fails in the test environment (BrowserFS not found, canvas stays 1x1). The test soft-skips after a 30-second timeout.

The manual visual smoke checklist in `tests/TESTING_CHECKLIST.md` also got a new section:

```
- [ ] Cannonball Clash: player paddle (left) reads as a ship, not a rectangle
- [ ] Cannonball Clash: AI paddle (right) has distinct red/rum accent
- [ ] Cannonball Clash: power-up state adds gold glow
- [ ] Treasure Cove: longboat paddle reads as a skiff/barge, not a rectangle
- [ ] Treasure Cove: treasure cargo crate is visible amidships
- [ ] Treasure Cove: bricks have stone bevel appearance, not plain rectangles
- [ ] Treasure Cove: bricks show row-specific stone palette
- [ ] Kraken's Wake: ship has layered polygon sprite, sails, and flame effect
- [ ] Ball collision still feels aligned with visual paddle (no misleading wide hitbox)
- [ ] Mobile landscape: ship/longboat still readable at reduced scale
- [ ] prefers-reduced-motion respected (no unnecessary animation)
```

## Files Changed

| File                                                          | Change                                                                           |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `scripts/pygbag-port/cannonball-clash/games/pong/paddle.py`   | Elegant side-profile ship with `side` param, hull, cannon ports, teal/rum accent |
| `scripts/pygbag-port/cannonball-clash/games/pong/gameplay.py` | Updated Paddle constructors to pass `side='left'`/`side='right'`                 |
| `scripts/pygbag-port/treasure-cove/games/breakout/paddle.py`  | Elegant longboat with treasure crate, crow's nest, lantern, oars                 |
| `scripts/pygbag-port/treasure-cove/games/breakout/brick.py`   | Stone bevel fortress bricks with 8-row stone palette                             |
| `tests/game-theming.spec.ts`                                  | Source-marker checks for all 3 games, pixel rendering, CI skip for Kraken's Wake |
| `tests/TESTING_CHECKLIST.md`                                  | Visual/art direction smoke checklist added                                       |
| `ROADMAP.md`                                                  | Visual polish items marked complete                                              |
