import pygame as pg
import constants as c
import math
import random

_N_BUCKETS = 36
_BARREL_ROT_CACHE = {}
_MAX_CACHE = 256

def _get_barrel_surf(radius, hull_color):
    size = int(radius * 2)
    surf = pg.Surface((size, size), pg.SRCALPHA)
    cx, cy = radius, radius

    pg.draw.circle(surf, hull_color, (cx, cy), radius)
    pg.draw.circle(surf, (max(0, hull_color[0]-30), max(0, hull_color[1]-20), max(0, hull_color[2]-10)), (cx, cy), int(radius * 0.9))
    pg.draw.circle(surf, (min(255, hull_color[0]+20), min(255, hull_color[1]+20), min(255, hull_color[2]+20)), (cx, cy), radius, 2)

    band_color = (min(255, hull_color[0]-30), min(255, hull_color[1]-20), min(255, hull_color[2]-5))
    for frac in [-0.6, -0.2, 0.2, 0.6]:
        y = int(cy + radius * frac)
        pg.draw.line(surf, band_color,
                     (int(cx - radius * 0.85), y),
                     (int(cx + radius * 0.85), y), max(2, radius // 12))

    off = radius * 0.35
    cross_color = (200, 150, 80)
    pg.draw.line(surf, cross_color,
                 (int(cx - off), int(cy - off)),
                 (int(cx + off), int(cy + off)), max(2, radius // 10))
    pg.draw.line(surf, cross_color,
                 (int(cx + off), int(cy - off)),
                 (int(cx - off), int(cy + off)), max(2, radius // 10))

    pg.draw.circle(surf, cross_color, (cx, cy), max(3, radius // 6))
    pg.draw.circle(surf, (max(0, hull_color[0]-20), max(0, hull_color[1]-15), max(0, hull_color[2]-5)), (cx, cy), max(2, radius // 8))

    return surf


class Barrel:
    LARGE = c.ASTEROID_LARGE_RADIUS
    MEDIUM = c.ASTEROID_MEDIUM_RADIUS
    SMALL = c.ASTEROID_SMALL_RADIUS

    POINTS = {
        LARGE: c.ASTEROID_POINTS_LARGE,
        MEDIUM: c.ASTEROID_POINTS_MEDIUM,
        SMALL: c.ASTEROID_POINTS_SMALL,
    }

    def __init__(self, x, y, radius=None, vx=None, vy=None):
        self.radius = radius if radius is not None else self.LARGE
        self.x = x
        self.y = y
        angle = random.uniform(0, math.pi * 2)
        speed = random.uniform(c.ASTEROID_SPEED_MIN, c.ASTEROID_SPEED_MAX)
        self.vx = vx if vx is not None else math.cos(angle) * speed
        self.vy = vy if vy is not None else math.sin(angle) * speed
        self.spin = random.uniform(c.ASTEROID_SPIN_MIN, c.ASTEROID_SPIN_MAX)
        self.rotation = random.uniform(0, 360)
        self._hull_color = random.choice([(150, 95, 45), (120, 70, 40), (100, 55, 25), (80, 50, 20), (60, 40, 15), (90, 60, 30)])
        self.surf = _get_barrel_surf(self.radius, self._hull_color)
        self.alive = True

    def update(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.rotation += self.spin * dt
        self._wrap()

    def _wrap(self):
        m = self.radius + 10
        if self.x < -m:
            self.x = c.WINDOW_WIDTH + m
        elif self.x > c.WINDOW_WIDTH + m:
            self.x = -m
        if self.y < -m:
            self.y = c.WINDOW_HEIGHT + m
        elif self.y > c.WINDOW_HEIGHT + m:
            self.y = -m

    @property
    def rect(self):
        r = self.radius
        return pg.Rect(self.x - r, self.y - r, r * 2, r * 2)

    def split(self):
        if self.radius == self.SMALL:
            return []
        new_r = self.MEDIUM if self.radius == self.LARGE else self.SMALL
        count = 2 if self.radius == self.LARGE else 3
        children = []
        for _ in range(count):
            angle = random.uniform(0, math.pi * 2)
            speed = random.uniform(c.ASTEROID_SPLIT_SPEED * 0.6, c.ASTEROID_SPLIT_SPEED)
            child = Barrel(
                self.x + random.uniform(-10, 10),
                self.y + random.uniform(-10, 10),
                radius=new_r,
                vx=self.vx + math.cos(angle) * speed,
                vy=self.vy + math.sin(angle) * speed,
            )
            children.append(child)
        return children

    @staticmethod
    def _bucket(angle):
        return round(angle * _N_BUCKETS / 360) % _N_BUCKETS

    def draw(self, surface):
        if not self.alive:
            return
        b = self._bucket(self.rotation)
        key = (self.radius, self._hull_color, b)
        try:
            rotated = _BARREL_ROT_CACHE[key]
        except KeyError:
            angle = b * (360.0 / _N_BUCKETS)
            raw = _get_barrel_surf(self.radius, self._hull_color)
            rotated = pg.transform.rotate(raw, angle)
            if len(_BARREL_ROT_CACHE) < _MAX_CACHE:
                _BARREL_ROT_CACHE[key] = rotated
        r = rotated.get_rect(center=(int(self.x), int(self.y)))
        surface.blit(rotated, r)
