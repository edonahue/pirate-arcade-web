import pygame as pg
import constants as c

# Richer fortress palette — stone-like hues with pirate flavor per row
# Enhanced for row readability: better luminance/hue separation between adjacent rows
BRICK_FORTRESS_COLORS = [
    (85, 40, 35),     # Row 0 — dark iron stone (deep)
    (120, 65, 45),    # Row 1 — weathered brick (distinct from row 0)
    (160, 90, 50),    # Row 2 — terracotta (warm orange-brown)
    (185, 120, 55),   # Row 3 — golden sandstone (lighter, yellow-tinted)
    (150, 140, 80),   # Row 4 — limestone (pale yellow-gray)
    (95, 145, 95),    # Row 5 — mossy stone (green tint for contrast)
    (80, 135, 145),   # Row 6 — sea-weathered (cool blue-gray)
    (195, 185, 135),  # Row 7 — pale treasure vault (warm cream)
]

# Bevel highlight colors (lighter edge)
BRICK_HIGHLIGHT = [
    (115, 65, 50),
    (150, 90, 60),
    (190, 115, 65),
    (215, 145, 70),
    (175, 165, 95),
    (120, 170, 115),
    (105, 160, 160),
    (215, 205, 150),
]

# Bevel shadow colors (darker edge)
BRICK_SHADOW = [
    (55, 25, 20),
    (85, 40, 30),
    (110, 60, 35),
    (130, 85, 35),
    (110, 100, 50),
    (70, 110, 65),
    (55, 95, 95),
    (135, 125, 85),
]

# Row-specific accent colors for subtle vertical marker on each brick
# Helps distinguish rows at a glance while maintaining stone aesthetic
BRICK_ROW_ACCENT = [
    (180, 60, 40),    # Row 0 — deep crimson
    (200, 120, 40),   # Row 1 — burnt orange
    (220, 160, 30),   # Row 2 — gold
    (180, 200, 60),   # Row 3 — olive gold
    (120, 180, 100),  # Row 4 — sage green
    (80, 180, 140),   # Row 5 — teal
    (60, 140, 180),   # Row 6 — ocean blue
    (220, 190, 80),   # Row 7 — warm amber
]

class Brick:
    def __init__(self, col, row):
        self.col = col
        self.row = row
        self.color = BRICK_FORTRESS_COLORS[row]
        self.highlight = BRICK_HIGHLIGHT[row]
        self.shadow = BRICK_SHADOW[row]
        self.accent = BRICK_ROW_ACCENT[row]
        self.health = 1
        self.x = c.BRICK_LEFT + col * (c.BRICK_WIDTH + c.BRICK_PADDING)
        self.y = c.BRICK_MARGIN_TOP + row * (c.BRICK_HEIGHT + c.BRICK_PADDING)
        self.width = c.BRICK_WIDTH
        self.height = c.BRICK_HEIGHT
        self._build_glow()

    def _build_glow(self):
        pad = 6
        w = self.width + pad * 2
        h = self.height + pad * 2
        self._glow_surf = pg.Surface((w, h), pg.SRCALPHA)
        for i in range(pad, 0, -1):
            alpha = max(0, c.BRICK_GLOW_ALPHA - (pad - i) * 7)
            r = pg.Rect(i, i, w - i * 2, h - i * 2)
            pg.draw.rect(self._glow_surf, (*c.PIRATE_GOLD, alpha), r, border_radius=3)

    @property
    def rect(self):
        return pg.Rect(self.x, self.y, self.width, self.height)

    @property
    def alive(self):
        return self.health > 0

    @property
    def points(self):
        return (self.row + 1) * c.BRICK_POINTS_BASE

    def hit(self):
        self.health -= 1

    def draw(self, surface):
        gx = self.x - 6
        gy = self.y - 6
        surface.blit(self._glow_surf, (gx, gy))

        r = self.rect
        bw = self.width
        bh = self.height
        bevel = 3

        # Stone block body
        pg.draw.rect(surface, self.color, r, border_radius=2)

        # Beveled top edge (highlight)
        pg.draw.polygon(surface, self.highlight, [
            (r.x, r.y),
            (r.x + bw, r.y),
            (r.x + bw - bevel, r.y + bevel),
            (r.x + bevel, r.y + bevel),
        ])

        # Beveled left edge (highlight)
        pg.draw.polygon(surface, self.highlight, [
            (r.x, r.y),
            (r.x + bevel, r.y + bevel),
            (r.x + bevel, r.y + bh - bevel),
            (r.x, r.y + bh),
        ])

        # Beveled bottom edge (shadow)
        pg.draw.polygon(surface, self.shadow, [
            (r.x, r.y + bh),
            (r.x + bevel, r.y + bh - bevel),
            (r.x + bw - bevel, r.y + bh - bevel),
            (r.x + bw, r.y + bh),
        ])

        # Beveled right edge (shadow)
        pg.draw.polygon(surface, self.shadow, [
            (r.x + bw, r.y),
            (r.x + bw - bevel, r.y + bevel),
            (r.x + bw - bevel, r.y + bh - bevel),
            (r.x + bw, r.y + bh),
        ])

        # Stone joint lines (horizontal)
        joint_y = r.y + bh // 2
        pg.draw.line(surface, self.shadow, (r.x + 2, joint_y), (r.x + bw - 2, joint_y), 1)

        # Subtle row accent marker — thin vertical line near left edge
        # Helps distinguish rows while maintaining fortress aesthetic
        accent_x = r.x + 3
        pg.draw.line(surface, self.accent, (accent_x, r.y + 4), (accent_x, r.y + bh - 4), 1)

        # Crack detail if damaged (health < original)
        if self.health < 1:
            crack_color = (min(255, self.color[0] - 30), min(255, self.color[1] - 30), min(255, self.color[2] - 30))
            pg.draw.line(surface, crack_color, (r.x + bw // 4, r.y + 2), (r.x + bw // 3, r.y + bh - 2), 1)
            pg.draw.line(surface, crack_color, (r.x + bw // 3, r.y + bh - 2), (r.x + bw // 2, r.y + bh // 2), 1)
