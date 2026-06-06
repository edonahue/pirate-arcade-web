import pygame as pg
import constants as c

# Richer fortress palette — stone-like hues with pirate flavor per row
BRICK_FORTRESS_COLORS = [
    (100, 55, 45),    # Row 0 — dark stone / iron
    (130, 75, 55),    # Row 1 — weathered brick
    (155, 100, 65),   # Row 2 — terracotta
    (175, 130, 70),   # Row 3 — sandstone
    (160, 150, 90),   # Row 4 — limestone
    (130, 155, 110),  # Row 5 — mossy stone
    (100, 150, 140),  # Row 6 — sea-weathered
    (180, 170, 130),  # Row 7 — pale stone (treasure vault)
]

# Bevel highlight colors (lighter edge)
BRICK_HIGHLIGHT = [
    (130, 75, 60),
    (160, 95, 70),
    (185, 120, 80),
    (200, 150, 85),
    (180, 170, 105),
    (150, 175, 125),
    (120, 170, 155),
    (200, 190, 145),
]

# Bevel shadow colors (darker edge)
BRICK_SHADOW = [
    (70, 35, 30),
    (95, 50, 35),
    (115, 70, 40),
    (135, 95, 45),
    (120, 110, 60),
    (95, 115, 75),
    (70, 110, 100),
    (140, 130, 95),
]

class Brick:
    def __init__(self, col, row):
        self.col = col
        self.row = row
        self.color = BRICK_FORTRESS_COLORS[row]
        self.highlight = BRICK_HIGHLIGHT[row]
        self.shadow = BRICK_SHADOW[row]
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

        # Crack detail if damaged (health < original)
        if self.health < 1:
            crack_color = (min(255, self.color[0] - 30), min(255, self.color[1] - 30), min(255, self.color[2] - 30))
            pg.draw.line(surface, crack_color, (r.x + bw // 4, r.y + 2), (r.x + bw // 3, r.y + bh - 2), 1)
            pg.draw.line(surface, crack_color, (r.x + bw // 3, r.y + bh - 2), (r.x + bw // 2, r.y + bh // 2), 1)
