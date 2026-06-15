import pygame as pg
import constants as c
import math
import random
from collections import deque


class Ball:
    def __init__(self):
        self.radius = c.BALL_BREAKOUT_SIZE // 2
        self._underlying_speed = c.BALL_BREAKOUT_SPEED
        self.speed = self._underlying_speed
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

    def reset(self, paddle=None, speed=None):
        if speed is not None:
            self._underlying_speed = speed
        else:
            self._underlying_speed = c.BALL_BREAKOUT_SPEED
        self.speed = self._underlying_speed
        self.vx = 0
        self.vy = 0
        self.launched = False
        self.trail.clear()
        if paddle:
            self.stick_to_paddle(paddle)

    def clone(self, paddle):
        """Create a new ball at the same position with safe angle offset."""
        new_ball = Ball()
        new_ball._underlying_speed = self._underlying_speed
        new_ball.speed = self.speed
        new_ball.x = self.x + random.uniform(-20, 20)
        new_ball.y = self.y + random.uniform(-10, 10)
        offset_angle = random.choice([-45, -30, 30, 45])
        angle = math.degrees(math.atan2(self.vy, self.vx)) + offset_angle
        rad = math.radians(angle)
        new_ball.vx = math.cos(rad) * self.speed
        new_ball.vy = math.sin(rad) * self.speed
        new_ball.launched = True
        return new_ball

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
        self._underlying_speed = min(
            self._underlying_speed * (1 + c.BALL_BREAKOUT_SPEED_INCREMENT),
            c.BALL_BREAKOUT_MAX_SPEED
        )
        norm = (self.vx ** 2 + self.vy ** 2) ** 0.5
        if norm > 0:
            speed_to_use = self._underlying_speed * self._slow_multiplier() if hasattr(self, '_slow_mult') else self._underlying_speed
            self.vx = self.vx / norm * speed_to_use
            self.vy = self.vy / norm * speed_to_use

    def apply_slow(self, factor):
        self._slow_mult = factor
        norm = (self.vx ** 2 + self.vy ** 2) ** 0.5
        if norm > 0 and self.launched:
            self.speed = self._underlying_speed * factor
            self.vx = self.vx / norm * self.speed
            self.vy = self.vy / norm * self.speed

    def remove_slow(self):
        if hasattr(self, '_slow_mult'):
            del self._slow_mult
        self.speed = self._underlying_speed
        norm = (self.vx ** 2 + self.vy ** 2) ** 0.5
        if norm > 0 and self.launched:
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
            t = (i + 1) / n if n > 0 else 0
            size = int(self.radius * (0.3 + 0.7 * t))
            alpha = int(80 * t)
            ts = pg.Surface((size * 2, size * 2), pg.SRCALPHA)
            pg.draw.circle(ts, (80, 70, 60, alpha), (size, size), size)
            surface.blit(ts, (int(tx - size), int(ty - size)))
        gx = int(self.x - self._glow_size)
        gy = int(self.y - self._glow_size)
        surface.blit(self._glow_surf, (gx, gy))
        has_slow = hasattr(self, '_slow_mult')
        ball_color = c.PIRATE_CANNON if not has_slow else (100, 200, 100)
        pg.draw.circle(surface, ball_color, (int(self.x), int(self.y)), self.radius)
