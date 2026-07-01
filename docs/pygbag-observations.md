# Cross-Pygbag Observations (Jul 2026)

From implementing improvements across Cannonball Clash, Treasure Cove, and Kraken's Wake.

## Patterns

1. **Fixed-timestep gate works well**: `FixedStepTimer` + `PresentGate` eliminates catch-up spiral on tab switches. `page_hidden()` check is essential — without it, Pygbag's sleep-on-blur + fixed-timestep accumulator creates a multi-second stall on return.

2. **Video-memory pool exhaustion surfaces as silent canvas freeze**: Pygbag 0.9.3's WebGL2 backend (`-platform native`) doesn't GC Pygame surfaces proactively. A rogue `Surface(c.WINDOW_WIDTH, c.WINDOW_HEIGHT)` per frame (e.g. ball trail, big-paddle tint) accumulates GPU memory until the browser kills the tab — no JS error, just a dead canvas. Always cache or pre-render.

3. **`rounded_rect_fill` via `gfxdraw` is fast enough for 60 Hz**: The module-level `_OVERLAY`, `_VIGNETTE`, `_CENTER_LINE_SURF` are pre-rendered once. `gfxdraw.filled_circle` calls in `rounded_rect_fill` are cheap — no per-frame surface allocation needed.

4. **Ball trail needs prebuilt surfaces by tier**: Drawing each trail segment with a fresh `Surface()` + `pg.draw.circle()` per frame is the #1 per-frame allocation. Pre-building all trail surfaces in `_build_trail_surfs(tier)` eliminated it. Same pattern applies to cached score text, HUD labels, and arena overlays.

5. **Phaser game (Race to Treasure Island) is an order of magnitude lighter**: No WASM download, no Python runtime, no surface management. The Pygbag games need ~15-25 MB archive downloads; Phaser loads < 1 MB. For future browser games, prefer web-native unless you need Python-only libraries.
