import pygame as pg
import constants as c
import math
import random
from collections import deque

class Ball:
    def __init__(self):
        self.radius = c.BALL_BREAKOUT_SIZE // 2
        self.speed = c.BALL_BREAKOUT_SPEED
        self.x = c.WINDOW_WIDTH // 2
        self.y = 0
        self.vx = 0
        self.vy = 0
        self.launched = False
        self.trail = deque(maxlen=c.BALL_TRAIL_LENGTH)
        self._build_glow()

    def _build_glow(self):
        r = int(self.radius * 3)
        self._glow_size = r
        self._glow_surf = pg.Surface((r * 2, r * 2), pg.SRCALPHA)
        for i in range(r, 0, -1):
            alpha = int(40 * (1 - i / r))
            pg.draw.circle(self._glow_surf, (80, 70, 60, alpha), (r, r), i)

    def reset(self, paddle=None):
        self.speed = c.BALL_BREAKOUT_SPEED
        self.vx = 0
        self.vy = 0
        self.launched = False
        self.trail.clear()
        if paddle:
            self.stick_to_paddle(paddle)

    def launch(self):
        if not self.launched:
            self.launched = True
            angle = random.uniform(-60, 60)
            self.vx = math.cos(math.radians(angle)) * self.speed
            self.vy = -abs(math.sin(math.radians(angle)) * self.speed)

    def stick_to_paddle(self, paddle):
        self.x = paddle.x
        self.y = paddle.y - paddle.height // 2 - self.radius

    def bump_speed(self):
        self.speed = min(self.speed * (1 + c.BALL_BREAKOUT_SPEED_INCREMENT),
                         c.BALL_BREAKOUT_MAX_SPEED)
        norm = (self.vx ** 2 + self.vy ** 2) ** 0.5
        if norm > 0:
            self.vx = self.vx / norm * self.speed
            self.vy = self.vy / norm * self.speed

    def update(self, dt):
        if self.launched:
            self.trail.append((self.x, self.y))
            self.x += self.vx * dt
            self.y += self.vy * dt

    @property
    def rect(self):
        return pg.Rect(self.x - self.radius, self.y - self.radius,
                       self.radius * 2, self.radius * 2)

    def draw(self, surface):
        n = len(self.trail)
        for i, (tx, ty) in enumerate(self.trail):
            t = (i + 1) / n
            size = int(self.radius * (0.3 + 0.7 * t))
            alpha = int(80 * t)
            ts = pg.Surface((size * 2, size * 2), pg.SRCALPHA)
            pg.draw.circle(ts, (80, 70, 60, alpha), (size, size), size)
            surface.blit(ts, (int(tx - size), int(ty - size)))
        gx = int(self.x - self._glow_size)
        gy = int(self.y - self._glow_size)
        surface.blit(self._glow_surf, (gx, gy))
        pg.draw.circle(surface, c.PIRATE_CANNON, (int(self.x), int(self.y)), self.radius)
