import pygame as pg
import constants as c
from math import sin, cos, radians
from collections import deque
import random

class Ball:
    def __init__(self):
        self._build_glow()
        self.reset()

    def _build_glow(self):
        r = c.BALL_SIZE * 3
        self._glow_size = r
        self._glow_surf = pg.Surface((r * 2, r * 2), pg.SRCALPHA)
        for i in range(r, 0, -1):
            alpha = int(50 * (1 - i / r))
            pg.draw.circle(self._glow_surf, (180, 160, 140, alpha), (r, r), i)

    def reset(self):
        self.x = c.WINDOW_WIDTH // 2
        self.y = c.WINDOW_HEIGHT // 2
        angle = random.uniform(-30, 30)
        if random.random() < 0.5:
            angle += 180
        self.vx = cos(radians(angle)) * c.BALL_SPEED_INITIAL
        self.vy = sin(radians(angle)) * c.BALL_SPEED_INITIAL
        self.speed = c.BALL_SPEED_INITIAL
        self.trail = deque(maxlen=c.BALL_TRAIL_LENGTH)

    def update(self, dt):
        self.trail.append((self.x, self.y))
        self.x += self.vx * dt
        self.y += self.vy * dt

    @property
    def rect(self):
        return pg.Rect(self.x - c.BALL_SIZE // 2, self.y - c.BALL_SIZE // 2,
                       c.BALL_SIZE, c.BALL_SIZE)

    def bump_speed(self):
        self.speed = min(self.speed * (1 + c.BALL_SPEED_INCREMENT), c.BALL_MAX_SPEED)
        norm = (self.vx ** 2 + self.vy ** 2) ** 0.5
        if norm > 0:
            self.vx = self.vx / norm * self.speed
            self.vy = self.vy / norm * self.speed

    def draw(self, surface):
        gx = int(self.x - self._glow_size)
        gy = int(self.y - self._glow_size)
        surface.blit(self._glow_surf, (gx, gy))
        n = len(self.trail)
        for i, (tx, ty) in enumerate(self.trail):
            t = (i + 1) / n
            size = int(c.BALL_SIZE * (0.3 + 0.7 * t)) // 2
            alpha = int(80 * t)
            ts = pg.Surface((size * 2, size * 2), pg.SRCALPHA)
            pg.draw.circle(ts, (180, 160, 140, alpha), (size, size), size)
            surface.blit(ts, (int(tx - size), int(ty - size)))
        pg.draw.circle(surface, c.PIRATE_CANNON, (int(self.x), int(self.y)), c.BALL_SIZE // 2)
