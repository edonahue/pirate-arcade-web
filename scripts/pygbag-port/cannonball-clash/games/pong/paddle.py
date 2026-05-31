import pygame as pg
import constants as c

class Paddle:
    def __init__(self, x, y):
        self.width = c.PADDLE_WIDTH
        self.height = c.PADDLE_HEIGHT
        self.x = x
        self.y = y
        self.vy = 0
        self.big_timer = 0.0
        self.base_height = c.PADDLE_HEIGHT
        self._build_glow()

    def _build_glow(self):
        pad = 10
        w = self.width + pad * 2
        h = self.height + pad * 2
        self._glow_surf = pg.Surface((w, h), pg.SRCALPHA)
        for i in range(pad, 0, -1):
            alpha = max(0, 40 - (pad - i) * 4)
            r = pg.Rect(i, i, w - i * 2, h - i * 2)
            pg.draw.rect(self._glow_surf, (0, 128, 128, alpha), r, border_radius=4)

    @property
    def rect(self):
        return pg.Rect(self.x - self.width // 2, self.y - self.height // 2,
                       self.width, self.height)

    def update(self, dt):
        self.y += self.vy * dt
        self.y = max(self.height // 2, min(c.WINDOW_HEIGHT - self.height // 2, self.y))
        if self.big_timer > 0:
            self.big_timer -= dt
            if self.big_timer <= 0:
                self.height = self.base_height
                self._build_glow()

    def reset(self):
        self.big_timer = 0.0
        self.height = self.base_height
        self._build_glow()

    def activate_big(self):
        self.height = int(self.base_height * c.PADDLE_BIG_MULTIPLIER)
        self.big_timer = c.PADDLE_BIG_DURATION
        self._build_glow()

    @property
    def is_big(self):
        return self.big_timer > 0

    def draw(self, surface):
        gx = self.x - self.width // 2 - 10
        gy = self.y - self.height // 2 - 10
        surface.blit(self._glow_surf, (gx, gy))
        color = c.PIRATE_TREASURE if self.is_big else c.WHITE
        pg.draw.rect(surface, color, self.rect)
        if self.is_big:
            pg.draw.rect(surface, c.POWERUP_COLOR, self.rect, 2)
