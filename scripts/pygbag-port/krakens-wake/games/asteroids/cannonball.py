import pygame as pg
import constants as c
import math

class Cannonball:
    def __init__(self, x, y, angle):
        self.radius = c.CANNONBALL_RADIUS
        self.x = x
        self.y = y
        rad = math.radians(angle - 90)
        self.vx = math.cos(rad) * c.CANNONBALL_SPEED
        self.vy = math.sin(rad) * c.CANNONBALL_SPEED
        self.life = c.CANNONBALL_LIFETIME
        self._build_glow()

    def _build_glow(self):
        r = int(self.radius * 4)
        self._glow_surf = pg.Surface((r * 2, r * 2), pg.SRCALPHA)
        for i in range(r, 0, -1):
            alpha = int(60 * (1 - i / r))
            pg.draw.circle(self._glow_surf, (255, 200, 100, alpha), (r, r), i)

    def update(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.life -= dt
        self._wrap()

    def _wrap(self):
        m = 50
        if self.x < -m:
            self.x = c.WINDOW_WIDTH + m
        elif self.x > c.WINDOW_WIDTH + m:
            self.x = -m
        if self.y < -m:
            self.y = c.WINDOW_HEIGHT + m
        elif self.y > c.WINDOW_HEIGHT + m:
            self.y = -m

    @property
    def dead(self):
        return self.life <= 0

    @property
    def rect(self):
        r = self.radius
        return pg.Rect(self.x - r, self.y - r, r * 2, r * 2)

    def draw(self, surface):
        gx = int(self.x - self._glow_surf.get_width() // 2)
        gy = int(self.y - self._glow_surf.get_height() // 2)
        surface.blit(self._glow_surf, (gx, gy))
        pg.draw.circle(surface, (255, 220, 180), (int(self.x), int(self.y)), self.radius)
        pg.draw.circle(surface, (255, 255, 255), (int(self.x), int(self.y)), self.radius // 2)
