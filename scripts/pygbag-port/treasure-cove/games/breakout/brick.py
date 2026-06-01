import pygame as pg
import constants as c

class Brick:
    def __init__(self, col, row):
        self.col = col
        self.row = row
        color = c.BRICK_ROW_COLORS[row]
        self.color = color
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
            pg.draw.rect(self._glow_surf, (*self.color, alpha), r, border_radius=3)

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
        pg.draw.rect(surface, self.color, self.rect, border_radius=3)
        inner = self.rect.inflate(-6, -6)
        if inner.width > 0 and inner.height > 0:
            lighter = tuple(min(255, v + 60) for v in self.color)
            pg.draw.rect(surface, lighter, inner, border_radius=2)
