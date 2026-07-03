import pygame as pg
import constants as c
from math import sin, cos, radians
import random


class Ball:
    def __init__(self, radius=None):
        if radius is None:
            radius = c.BALL_BREAKOUT_SIZE
        self.x = 0
        self.y = 0
        self.px = 0
        self.py = 0
        self.vx = 0
        self.vy = 0
        self.speed = 0
        self._underlying_speed = c.BALL_BREAKOUT_SPEED
        self._slow_mult = 1.0
        self.radius = radius
        self.launched = False
        self._build_glow()
        self._build_trail_surfs()

    @property
    def _slow_active(self):
        return self._slow_mult < 1.0

    def rebuild_visuals(self):
        self._build_glow()
        self._build_trail_surfs()

    def set_radius(self, new_radius):
        if new_radius == self.radius:
            return
        self.radius = new_radius
        self.rebuild_visuals()

    def _build_glow(self):
        r = self.radius * 3
        self._glow_size = r
        self._glow_surf = pg.Surface((r * 2, r * 2), pg.SRCALPHA)
        for i in range(r, 0, -1):
            alpha = int(50 * (1 - i / r))
            pg.draw.circle(self._glow_surf, (180, 160, 140, alpha), (r, r), i)

    def _build_trail_surfs(self):
        max_n = c.BALL_TRAIL_LENGTH
        self._trail_surfs = []
        for i in range(max_n):
            t = (i + 1) / max_n
            size = int(self.radius * (0.3 + 0.7 * t))
            alpha = int(80 * t)
            surf = pg.Surface((size * 2, size * 2), pg.SRCALPHA)
            pg.draw.circle(surf, (180, 160, 140, alpha), (size, size), size)
            self._trail_surfs.append(surf)

    def reset(self):
        self.x = c.WINDOW_WIDTH // 2
        self.y = c.WINDOW_HEIGHT - c.PADDLE_BREAKOUT_MARGIN - self.radius - 1
        self.px = self.x
        self.py = self.y
        self.vx = 0
        self.vy = 0
        self.speed = 0
        self._underlying_speed = c.BALL_BREAKOUT_SPEED
        self._slow_mult = 1.0
        self.launched = False

    def launch(self):
        self._slow_mult = 1.0
        self.speed = self._underlying_speed * self._slow_mult
        # Angle relative to straight up (90°), range 30°–150°
        angle = random.uniform(-60, 60) + 90
        self.vx = cos(radians(angle)) * self.speed
        self.vy = -sin(radians(angle)) * self.speed
        if abs(self.vy) < self.speed * 0.15:
            self.vy = -self.speed * 0.15
            norm = (self.vx ** 2 + self.vy ** 2) ** 0.5
            if norm > 0:
                self.vx = self.vx / norm * self.speed
                self.vy = self.vy / norm * self.speed
        self.launched = True

    @property
    def rect(self):
        return pg.Rect(
            int(self.x - self.radius),
            int(self.y - self.radius),
            self.radius * 2,
            self.radius * 2,
        )

    def set_slow(self, active):
        if active:
            self._slow_mult = c.BALL_BREAKOUT_SLOW_FACTOR
        else:
            self._slow_mult = 1.0
        self.speed = self._underlying_speed * self._slow_mult
        norm = (self.vx ** 2 + self.vy ** 2) ** 0.5
        if norm > 0:
            self.vx = self.vx / norm * self.speed
            self.vy = self.vy / norm * self.speed

    def bump_speed(self):
        self._underlying_speed = min(
            self._underlying_speed * (1 + c.BALL_BREAKOUT_SPEED_INCREMENT),
            c.BALL_BREAKOUT_MAX_SPEED
        )
        self.speed = self._underlying_speed * self._slow_mult
        norm = (self.vx ** 2 + self.vy ** 2) ** 0.5
        if norm > 0:
            self.vx = self.vx / norm * self.speed
            self.vy = self.vy / norm * self.speed

    def update(self, dt):
        self.px, self.py = self.x, self.y
        self.x += self.vx * dt
        self.y += self.vy * dt

    def ensure_min_vy(self):
        min_abs_vy = self.speed * 0.15
        if abs(self.vy) < min_abs_vy:
            self.vy = min_abs_vy * (1 if self.vy >= 0 else -1)
            norm = (self.vx ** 2 + self.vy ** 2) ** 0.5
            if norm > 0:
                self.vx = self.vx / norm * self.speed
                self.vy = self.vy / norm * self.speed

    def draw(self, surface):
        gx = int(self.x - self._glow_size)
        gy = int(self.y - self._glow_size)
        surface.blit(self._glow_surf, (gx, gy))
        speed = max(1, (self.vx ** 2 + self.vy ** 2) ** 0.5)
        for i, surf in enumerate(self._trail_surfs):
            t = (i + 1) / len(self._trail_surfs)
            tx = int(self.x - self.vx / speed * 20 * t)
            ty = int(self.y - self.vy / speed * 20 * t)
            size = surf.get_width() // 2
            surface.blit(surf, (tx - size, ty - size))
        ball_color = c.PIRATE_CANNON
        if self._slow_active:
            ball_color = (100, 255, 100)
        pg.draw.circle(surface, ball_color, (int(self.x), int(self.y)), self.radius)
