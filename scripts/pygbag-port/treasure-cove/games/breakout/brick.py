import pygame as pg
import constants as c

BRICK_FORTRESS_COLORS = [
    (85, 40, 35),
    (120, 65, 45),
    (160, 90, 50),
    (185, 120, 55),
    (150, 140, 80),
    (95, 145, 95),
    (80, 135, 145),
    (195, 185, 135),
]

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

BRICK_ROW_ACCENT = [
    (180, 60, 40),
    (200, 120, 40),
    (220, 160, 30),
    (180, 200, 60),
    (120, 180, 100),
    (80, 180, 140),
    (60, 140, 180),
    (220, 190, 80),
]

REINFORCED_OVERLAY_COLOR = (60, 55, 50, 180)
CRACK_COLOR = (160, 140, 100)


class Brick:
    def __init__(self, col, row, brick_type=c.BRICK_STANDARD):
        self.col = col
        self.row = row
        self.brick_type = brick_type
        self.color = BRICK_FORTRESS_COLORS[row]
        self.highlight = BRICK_HIGHLIGHT[row]
        self.shadow = BRICK_SHADOW[row]
        self.accent = BRICK_ROW_ACCENT[row]

        if brick_type == c.BRICK_REINFORCED:
            self.max_health = c.REINFORCED_HEALTH
        else:
            self.max_health = 1
        self.health = self.max_health

        self.x = c.BRICK_LEFT + col * (c.BRICK_WIDTH + c.BRICK_PADDING)
        self.y = c.BRICK_MARGIN_TOP + row * (c.BRICK_HEIGHT + c.BRICK_PADDING)
        self.width = c.BRICK_WIDTH
        self.height = c.BRICK_HEIGHT
        self._build_glow()
        self._build_special_surfs()

    def _build_glow(self):
        pad = 6
        w = self.width + pad * 2
        h = self.height + pad * 2
        self._glow_surf = pg.Surface((w, h), pg.SRCALPHA)
        for i in range(pad, 0, -1):
            alpha = max(0, c.BRICK_GLOW_ALPHA - (pad - i) * 7)
            r = pg.Rect(i, i, w - i * 2, h - i * 2)
            pg.draw.rect(self._glow_surf, (*c.PIRATE_GOLD, alpha), r, border_radius=3)

    def _build_special_surfs(self):
        self._reinforced_overlay = None
        self._keg_surf = None
        self._treasure_surf = None

        if self.brick_type == c.BRICK_REINFORCED:
            self._reinforced_overlay = pg.Surface((self.width, self.height), pg.SRCALPHA)
            pg.draw.rect(self._reinforced_overlay, (60, 55, 50, 180), (0, 0, self.width, self.height), border_radius=2)
            pg.draw.rect(self._reinforced_overlay, (120, 110, 80, 200), (0, 0, self.width, self.height), 2, border_radius=2)
            for bx in range(0, self.width, 12):
                pg.draw.line(self._reinforced_overlay, (100, 90, 60, 120), (bx, 0), (bx, self.height), 1)
        elif self.brick_type == c.BRICK_POWDER_KEG:
            self._keg_surf = pg.Surface((self.width, self.height), pg.SRCALPHA)
            cx, cy = self.width // 2, self.height // 2
            r = min(self.width, self.height) // 2 - 2
            pg.draw.circle(self._keg_surf, c.PIRATE_FLAME, (cx, cy), r)
            pg.draw.circle(self._keg_surf, c.PIRATE_FLAME_INNER, (cx, cy), r - 2)
            pg.draw.circle(self._keg_surf, (255, 255, 200, 60), (cx - 2, cy - 2), r - 4)
            fuse = [(cx + 4, cy - r), (cx + 8, cy - r - 4), (cx + 6, cy - r - 8)]
            pg.draw.lines(self._keg_surf, (180, 100, 50), False, fuse, 2)
            pg.draw.circle(self._keg_surf, (255, 200, 50), (cx + 6, cy - r - 8), 2)
        elif self.brick_type == c.BRICK_TREASURE:
            self._treasure_surf = pg.Surface((self.width, self.height), pg.SRCALPHA)
            cx, cy = self.width // 2, self.height // 2
            tw, th = 14, 10
            tx, ty = cx - tw // 2, cy - th // 2
            pg.draw.rect(self._treasure_surf, c.PIRATE_BROWN_DARK, (tx, ty, tw, th), border_radius=2)
            pg.draw.rect(self._treasure_surf, c.PIRATE_GOLD, (tx, ty, tw, th), 1, border_radius=2)
            pg.draw.line(self._treasure_surf, c.PIRATE_GOLD, (tx, ty + th // 2 - 1), (tx + tw, ty + th // 2 - 1), 1)
            pg.draw.circle(self._treasure_surf, c.PIRATE_TREASURE, (cx, cy), 2)
            for si in range(4):
                sx = tx + 3 + si * 3
                pg.draw.line(self._treasure_surf, (255, 220, 100, 40), (sx, ty + 2), (sx + 1, ty + th - 2), 1)

    @property
    def rect(self):
        return pg.Rect(self.x, self.y, self.width, self.height)

    @property
    def alive(self):
        return self.health > 0

    @property
    def points(self):
        base = (self.row + 1) * c.BRICK_POINTS_BASE
        if self.brick_type == c.BRICK_REINFORCED:
            base *= c.REINFORCED_POINTS_MULTIPLIER
        elif self.brick_type == c.BRICK_POWDER_KEG:
            base = c.POWDER_KEG_POINTS
        elif self.brick_type == c.BRICK_TREASURE:
            base = c.TREASURE_BRICK_POINTS
        return base

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

        pg.draw.rect(surface, self.color, r, border_radius=2)

        pg.draw.polygon(surface, self.highlight, [
            (r.x, r.y), (r.x + bw, r.y),
            (r.x + bw - bevel, r.y + bevel), (r.x + bevel, r.y + bevel),
        ])
        pg.draw.polygon(surface, self.highlight, [
            (r.x, r.y), (r.x + bevel, r.y + bevel),
            (r.x + bevel, r.y + bh - bevel), (r.x, r.y + bh),
        ])
        pg.draw.polygon(surface, self.shadow, [
            (r.x, r.y + bh), (r.x + bevel, r.y + bh - bevel),
            (r.x + bw - bevel, r.y + bh - bevel), (r.x + bw, r.y + bh),
        ])
        pg.draw.polygon(surface, self.shadow, [
            (r.x + bw, r.y), (r.x + bw - bevel, r.y + bevel),
            (r.x + bw - bevel, r.y + bh - bevel), (r.x + bw, r.y + bh),
        ])

        joint_y = r.y + bh // 2
        pg.draw.line(surface, self.shadow, (r.x + 2, joint_y), (r.x + bw - 2, joint_y), 1)

        accent_x = r.x + 3
        pg.draw.line(surface, self.accent, (accent_x, r.y + 4), (accent_x, r.y + bh - 4), 1)

        if self.brick_type == c.BRICK_REINFORCED and self._reinforced_overlay:
            surface.blit(self._reinforced_overlay, (r.x, r.y))
            if self.health < self.max_health:
                crack_color = CRACK_COLOR
                pg.draw.line(surface, crack_color, (r.x + bw // 4, r.y + 2), (r.x + bw // 3, r.y + bh - 2), 2)
                pg.draw.line(surface, crack_color, (r.x + bw // 3, r.y + bh - 2), (r.x + bw // 2, r.y + bh // 2), 2)

        if self.brick_type == c.BRICK_POWDER_KEG and self._keg_surf:
            surface.blit(self._keg_surf, (r.x, r.y))

        if self.brick_type == c.BRICK_TREASURE and self._treasure_surf:
            surface.blit(self._treasure_surf, (r.x, r.y))

        if self.health < 1 and self.brick_type != c.BRICK_REINFORCED:
            dc = (min(255, self.color[0] - 30), min(255, self.color[1] - 30), min(255, self.color[2] - 30))
            pg.draw.line(surface, dc, (r.x + bw // 4, r.y + 2), (r.x + bw // 3, r.y + bh - 2), 1)
            pg.draw.line(surface, dc, (r.x + bw // 3, r.y + bh - 2), (r.x + bw // 2, r.y + bh // 2), 1)
