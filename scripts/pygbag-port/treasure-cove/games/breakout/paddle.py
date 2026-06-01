import pygame as pg
import constants as c

class Paddle:
    def __init__(self):
        self.width = c.PADDLE_BREAKOUT_WIDTH
        self.height = c.PADDLE_BREAKOUT_HEIGHT
        self.x = c.WINDOW_WIDTH // 2
        self.y = c.WINDOW_HEIGHT - c.PADDLE_BREAKOUT_MARGIN
        self.vx = 0
        self._build_glow()

    def _build_glow(self):
        pad = 12
        w = self.width + pad * 2
        h = self.height + pad * 2
        self._glow_surf = pg.Surface((w, h), pg.SRCALPHA)
        for i in range(pad, 0, -1):
            alpha = max(0, 45 - (pad - i) * 4)
            r = pg.Rect(i, i, w - i * 2, h - i * 2)
            pg.draw.rect(self._glow_surf, (*c.PIRATE_GOLD, alpha), r, border_radius=6)

    @property
    def rect(self):
        return pg.Rect(self.x - self.width // 2, self.y - self.height // 2,
                       self.width, self.height)

    def reset(self):
        self.x = c.WINDOW_WIDTH // 2
        self.vx = 0

    def update(self, dt):
        self.x += self.vx * dt
        self.x = max(self.width // 2, min(c.WINDOW_WIDTH - self.width // 2, self.x))

    def draw(self, surface):
        gx = int(self.x - self.width // 2 - 12)
        gy = int(self.y - self.height // 2 - 12)
        surface.blit(self._glow_surf, (gx, gy))
        pg.draw.rect(surface, c.PIRATE_BROWN, self.rect, border_radius=4)
        inner = self.rect.inflate(-8, -8)
        if inner.width > 0 and inner.height > 0:
            pg.draw.rect(surface, c.PIRATE_BROWN_DARK, inner, border_radius=3)
