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

_cached_body_surfs = {}


def _build_body_surf(row, brick_type):
    key = (row, brick_type)
    if key in _cached_body_surfs:
        return _cached_body_surfs[key]

    w = c.BRICK_WIDTH
    h = c.BRICK_HEIGHT
    bevel = 3
    color = BRICK_FORTRESS_COLORS[row]
    highlight = BRICK_HIGHLIGHT[row]
    shadow = BRICK_SHADOW[row]
    accent = BRICK_ROW_ACCENT[row]

    surf = pg.Surface((w, h), pg.SRCALPHA)

    pg.draw.rect(surf, color, (0, 0, w, h), border_radius=2)

    pg.draw.polygon(surf, highlight, [
        (0, 0), (w, 0),
        (w - bevel, bevel), (bevel, bevel),
    ])
    pg.draw.polygon(surf, highlight, [
        (0, 0), (bevel, bevel),
        (bevel, h - bevel), (0, h),
    ])
    pg.draw.polygon(surf, shadow, [
        (0, h), (bevel, h - bevel),
        (w - bevel, h - bevel), (w, h),
    ])
    pg.draw.polygon(surf, shadow, [
        (w, 0), (w - bevel, bevel),
        (w - bevel, h - bevel), (w, h),
    ])

    joint_y = h // 2
    pg.draw.line(surf, shadow, (2, joint_y), (w - 2, joint_y), 1)

    accent_x = 3
    pg.draw.line(surf, accent, (accent_x, 4), (accent_x, h - 4), 1)

    _cached_body_surfs[key] = surf
    return surf


_crack_surfs = {}
_crack_overlay_surfs = {}


def _build_crack_surf(w, h, color):
    key = (w, h, color)
    if key in _crack_surfs:
        return _crack_surfs[key]
    surf = pg.Surface((w, h), pg.SRCALPHA)
    pg.draw.line(surf, color, (w // 4, 2), (w // 3, h - 2), 2)
    pg.draw.line(surf, color, (w // 3, h - 2), (w // 2, h // 2), 2)
    _crack_surfs[key] = surf
    return surf


def _build_damage_crack_surf(w, h, color):
    key = ("damage", w, h, color)
    if key in _crack_surfs:
        return _crack_surfs[key]
    surf = pg.Surface((w, h), pg.SRCALPHA)
    pg.draw.line(surf, color, (w // 4, 2), (w // 3, h - 2), 1)
    pg.draw.line(surf, color, (w // 3, h - 2), (w // 2, h // 2), 1)
    _crack_surfs[key] = surf
    return surf


def _build_reinforced_overlay(w, h):
    key = ("reinforced", w, h)
    if key in _crack_overlay_surfs:
        return _crack_overlay_surfs[key]
    surf = pg.Surface((w, h), pg.SRCALPHA)
    pg.draw.rect(surf, (60, 55, 50, 180), (0, 0, w, h), border_radius=2)
    pg.draw.rect(surf, (120, 110, 80, 200), (0, 0, w, h), 2, border_radius=2)
    for bx in range(0, w, 12):
        pg.draw.line(surf, (100, 90, 60, 120), (bx, 0), (bx, h), 1)
    _crack_overlay_surfs[key] = surf
    return surf


def _build_keg_surf(w, h):
    key = ("keg", w, h)
    if key in _crack_overlay_surfs:
        return _crack_overlay_surfs[key]
    surf = pg.Surface((w, h), pg.SRCALPHA)
    cx, cy = w // 2, h // 2
    r = min(w, h) // 2 - 2
    pg.draw.circle(surf, c.PIRATE_FLAME, (cx, cy), r)
    pg.draw.circle(surf, c.PIRATE_FLAME_INNER, (cx, cy), r - 2)
    pg.draw.circle(surf, (255, 255, 200, 60), (cx - 2, cy - 2), r - 4)
    fuse = [(cx + 4, cy - r), (cx + 8, cy - r - 4), (cx + 6, cy - r - 8)]
    pg.draw.lines(surf, (180, 100, 50), False, fuse, 2)
    pg.draw.circle(surf, (255, 200, 50), (cx + 6, cy - r - 8), 2)
    _crack_overlay_surfs[key] = surf
    return surf


def _build_treasure_surf(w, h):
    key = ("treasure", w, h)
    if key in _crack_overlay_surfs:
        return _crack_overlay_surfs[key]
    surf = pg.Surface((w, h), pg.SRCALPHA)
    cx, cy = w // 2, h // 2
    tw, th = 14, 10
    tx, ty = cx - tw // 2, cy - th // 2
    pg.draw.rect(surf, c.PIRATE_BROWN_DARK, (tx, ty, tw, th), border_radius=2)
    pg.draw.rect(surf, c.PIRATE_GOLD, (tx, ty, tw, th), 1, border_radius=2)
    pg.draw.line(surf, c.PIRATE_GOLD, (tx, ty + th // 2 - 1), (tx + tw, ty + th // 2 - 1), 1)
    pg.draw.circle(surf, c.PIRATE_TREASURE, (cx, cy), 2)
    for si in range(4):
        sx = tx + 3 + si * 3
        pg.draw.line(surf, (255, 220, 100, 40), (sx, ty + 2), (sx + 1, ty + th - 2), 1)
    _crack_overlay_surfs[key] = surf
    return surf


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

        body = _build_body_surf(self.row, self.brick_type)
        surface.blit(body, (self.x, self.y))

        r = self.rect
        bw = self.width
        bh = self.height
        brick_type = self.brick_type

        if brick_type == c.BRICK_REINFORCED:
            overlay = _build_reinforced_overlay(bw, bh)
            surface.blit(overlay, (r.x, r.y))
            if self.health < self.max_health:
                cracks = _build_crack_surf(bw, bh, CRACK_COLOR)
                surface.blit(cracks, (r.x, r.y))
        elif brick_type == c.BRICK_POWDER_KEG:
            keg = _build_keg_surf(bw, bh)
            surface.blit(keg, (r.x, r.y))
        elif brick_type == c.BRICK_TREASURE:
            treasure = _build_treasure_surf(bw, bh)
            surface.blit(treasure, (r.x, r.y))

        if self.health < 1 and brick_type != c.BRICK_REINFORCED:
            dc = (min(255, self.color[0] - 30), min(255, self.color[1] - 30), min(255, self.color[2] - 30))
            damage = _build_damage_crack_surf(bw, bh, dc)
            surface.blit(damage, (r.x, r.y))
