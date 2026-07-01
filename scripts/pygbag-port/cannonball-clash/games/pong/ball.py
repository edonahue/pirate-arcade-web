import pygame as pg
import constants as c
from math import sin, cos, radians
from collections import deque
import random


class Ball:
    def __init__(self):
        self.rally_tier = 0
        self.px = 0
        self.py = 0
        self.last_hit_by = None
        self._build_glow()
        self.reset()

    def _build_glow(self):
        r = c.BALL_SIZE * 3
        self._glow_size = r
        self._glow_surf_original = pg.Surface((r * 2, r * 2), pg.SRCALPHA)
        for i in range(r, 0, -1):
            alpha = int(50 * (1 - i / r))
            pg.draw.circle(self._glow_surf_original, (180, 160, 140, alpha), (r, r), i)
        self._glow_surf = self._glow_surf_original
        self._current_tier = -1
        self._trail_surfs = {}

    def _build_trail_surfs(self, tier):
        self._trail_surfs.clear()
        tier_color = c.RALLY_GLOW_TIERS.get(tier, (180, 160, 140))
        max_n = c.RALLY_TRAIL_TIERS.get(tier, c.BALL_TRAIL_LENGTH)
        for i in range(max_n):
            t = (i + 1) / max_n
            size = int(c.BALL_SIZE * (0.3 + 0.7 * t)) // 2
            alpha = int(80 * t)
            surf = pg.Surface((size * 2, size * 2), pg.SRCALPHA)
            pg.draw.circle(surf, (*tier_color, alpha), (size, size), size)
            self._trail_surfs[i] = surf

    def _update_glow_for_tier(self, tier):
        if tier == self._current_tier:
            return
        self._current_tier = tier
        if tier <= 0:
            self._glow_surf = self._glow_surf_original
            return
        tier_color = c.RALLY_GLOW_TIERS.get(tier, (212, 175, 55))
        r = c.BALL_SIZE * 3
        self._glow_surf = pg.Surface((r * 2, r * 2), pg.SRCALPHA)
        for i in range(r, 0, -1):
            alpha = int(50 * (1 - i / r))
            pg.draw.circle(self._glow_surf, (*tier_color, alpha), (r, r), i)

    def reset(self):
        self.x = c.WINDOW_WIDTH // 2
        self.y = c.WINDOW_HEIGHT // 2
        self.px = self.x
        self.py = self.y
        self.vx = 0
        self.vy = 0
        self.speed = 0
        max_trail = c.BALL_TRAIL_LENGTH
        self.rally_tier = 0
        self._current_tier = -1
        self._glow_surf = self._glow_surf_original
        self.trail = deque(maxlen=max_trail)
        self.last_hit_by = None
        self._trail_surfs.clear()
        self._build_trail_surfs(0)

    def launch(self):
        angle = random.uniform(-30, 30)
        if random.random() < 0.5:
            angle += 180
        self.speed = c.BALL_SPEED_INITIAL
        self.vx = cos(radians(angle)) * self.speed
        self.vy = sin(radians(angle)) * self.speed

    def set_rally_tier(self, tier):
        if tier == self.rally_tier:
            return
        self.rally_tier = tier
        max_trail = c.RALLY_TRAIL_TIERS.get(tier, c.BALL_TRAIL_LENGTH)
        self.trail = deque(self.trail, maxlen=max_trail)
        self._update_glow_for_tier(tier)
        self._build_trail_surfs(tier)

    def update(self, dt):
        self.px, self.py = self.x, self.y
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
            surf = self._trail_surfs.get(i)
            if surf:
                size = surf.get_width() // 2
                surface.blit(surf, (int(tx - size), int(ty - size)))
        tier_color = c.RALLY_GLOW_TIERS.get(self.rally_tier, (180, 160, 140))
        ball_color = tier_color if self.rally_tier >= 5 else c.PIRATE_CANNON
        pg.draw.circle(surface, ball_color, (int(self.x), int(self.y)), c.BALL_SIZE // 2)
