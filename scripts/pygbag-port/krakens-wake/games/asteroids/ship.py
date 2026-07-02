import pygame as pg
import constants as c
import math
import random

class Ship:
    def __init__(self):
        self.x = c.WINDOW_WIDTH // 2
        self.y = c.WINDOW_HEIGHT // 2
        self.vx = 0
        self.vy = 0
        self.angle = 0
        self.thrusting = False
        self.invulnerable = c.SHIP_INVULNERABLE_TIME
        self.alive = True
        self.speed = 0.0
        self._flame_frame = 0
        self._flame_timer = 0.0
        self._build_ship()
        self._build_flames()

    _N_BUCKETS = 36

    def _build_ship(self):
        size = 110
        self._ship_surf = pg.Surface((size, size), pg.SRCALPHA)
        cx, cy = size // 2, size // 2

        hull_color = c.PIRATE_BROWN
        hull_pts = [
            (cx - 22, cy + 24),
            (cx + 22, cy + 24),
            (cx + 16, cy - 6),
            (cx - 16, cy - 6),
        ]
        pg.draw.polygon(self._ship_surf, hull_color, hull_pts)
        pg.draw.polygon(self._ship_surf, c.PIRATE_DARK_WOOD, hull_pts, 2)

        deck_color = c.PIRATE_DARK_WOOD
        deck = [(cx - 18, cy + 5), (cx + 18, cy + 5),
                (cx + 20, cy + 16), (cx - 20, cy + 16)]
        pg.draw.polygon(self._ship_surf, deck_color, deck)

        mast_color = c.PIRATE_DARK_WOOD
        pg.draw.line(self._ship_surf, mast_color, (cx, cy - 4), (cx, cy - 48), 4)
        pg.draw.line(self._ship_surf, mast_color, (cx - 1, cy - 48), (cx + 10, cy - 44), 3)

        sail_color = c.PIRATE_CREAM
        left_sail = [(cx, cy - 10), (cx - 20, cy - 30), (cx, cy - 38)]
        right_sail = [(cx, cy - 10), (cx + 20, cy - 30), (cx, cy - 38)]
        pg.draw.polygon(self._ship_surf, sail_color, left_sail)
        pg.draw.polygon(self._ship_surf, sail_color, right_sail)
        pg.draw.polygon(self._ship_surf, c.PIRATE_SAND, left_sail, 1)
        pg.draw.polygon(self._ship_surf, c.PIRATE_SAND, right_sail, 1)

        flag_pts = [(cx, cy - 48), (cx + 14, cy - 52), (cx, cy - 44)]
        pg.draw.polygon(self._ship_surf, c.PIRATE_BLOOD, flag_pts)

        pg.draw.circle(self._ship_surf, c.PIRATE_SKY, (cx, cy - 24), 5)
        pg.draw.line(self._ship_surf, c.PIRATE_SKY, (cx - 4, cy - 24), (cx + 4, cy - 24), 2)
        pg.draw.line(self._ship_surf, c.PIRATE_SKY, (cx, cy - 28), (cx, cy - 20), 2)

        port_color = c.PIRATE_CANNON
        pg.draw.rect(self._ship_surf, port_color, (cx - 14, cy + 12, 6, 4))
        pg.draw.rect(self._ship_surf, port_color, (cx + 8, cy + 12, 6, 4))

        window_color = c.PIRATE_SKY
        pg.draw.circle(self._ship_surf, window_color, (cx - 7, cy + 2), 3)
        pg.draw.circle(self._ship_surf, window_color, (cx + 7, cy + 2), 3)

        self._size = size
        self._ship_cache = [
            pg.transform.rotate(self._ship_surf, i * 360.0 / self._N_BUCKETS)
            for i in range(self._N_BUCKETS)
        ]

    def _build_flames(self):
        self._flame_frames = []
        rng = random.Random()
        for seed in range(4):
            w, h = 24, 28
            surf = pg.Surface((w, h), pg.SRCALPHA)
            rng.seed(seed)
            flame_len = rng.randint(22, 28)
            r_val = rng.randint(0, 4)
            outer = [(12, 0), (r_val, flame_len), (12, flame_len - 6), (24 - r_val, flame_len)]
            inner = [(12, 4), (r_val + 4, flame_len - 2), (12, flame_len - 8), (24 - r_val - 4, flame_len - 2)]
            pg.draw.polygon(surf, c.PIRATE_FLAME, outer)
            pg.draw.polygon(surf, c.PIRATE_FLAME_INNER, inner)
            self._flame_frames.append(surf)
        self._flame_cache = [
            [pg.transform.rotate(f, i * 360.0 / self._N_BUCKETS) for i in range(self._N_BUCKETS)]
            for f in self._flame_frames
        ]

    @staticmethod
    def _bucket(angle):
        return round(angle * 36 / 360) % 36

    def reset(self):
        self.x = c.WINDOW_WIDTH // 2
        self.y = c.WINDOW_HEIGHT // 2
        self.vx = 0
        self.vy = 0
        self.angle = 0
        self.thrusting = False
        self.invulnerable = c.SHIP_INVULNERABLE_TIME
        self.alive = True
        self._flame_frame = 0
        self._flame_timer = 0.0

    def update(self, dt, keys):
        if not self.alive:
            return

        if self.invulnerable > 0:
            self.invulnerable -= dt

        if keys[pg.K_a] or keys[pg.K_LEFT]:
            self.angle -= c.SHIP_ROTATION_SPEED * dt
        if keys[pg.K_d] or keys[pg.K_RIGHT]:
            self.angle += c.SHIP_ROTATION_SPEED * dt

        self.thrusting = False
        if keys[pg.K_w] or keys[pg.K_UP]:
            self.thrusting = True
            rad = math.radians(self.angle - 90)
            self.vx += math.cos(rad) * c.SHIP_THRUST * dt
            self.vy += math.sin(rad) * c.SHIP_THRUST * dt

        decay = c.SHIP_FRICTION ** (dt * 240)
        self.vx *= decay
        self.vy *= decay

        self.speed = (self.vx ** 2 + self.vy ** 2) ** 0.5
        if self.speed > c.SHIP_MAX_SPEED:
            scale = c.SHIP_MAX_SPEED / self.speed
            self.vx *= scale
            self.vy *= scale

        self.x += self.vx * dt
        self.y += self.vy * dt
        self._wrap()

        if self.thrusting:
            self._flame_timer += dt
            if self._flame_timer > 0.05:
                self._flame_timer = 0
                self._flame_frame = (self._flame_frame + 1) % len(self._flame_frames)

    def _wrap(self):
        margin = self._size
        if self.x < -margin:
            self.x = c.WINDOW_WIDTH + margin
        elif self.x > c.WINDOW_WIDTH + margin:
            self.x = -margin
        if self.y < -margin:
            self.y = c.WINDOW_HEIGHT + margin
        elif self.y > c.WINDOW_HEIGHT + margin:
            self.y = -margin

    def get_position(self):
        return (self.x, self.y)

    @property
    def rect(self):
        r = c.SHIP_RADIUS
        return pg.Rect(self.x - r, self.y - r, r * 2, r * 2)

    def draw(self, surface):
        if not self.alive:
            return
        if self.invulnerable > 0 and int(self.invulnerable * 60) % 2 == 0:
            return

        b = self._bucket(self.angle)
        rotated = self._ship_cache[b]
        r = rotated.get_rect(center=(int(self.x), int(self.y)))
        surface.blit(rotated, r)

        if self.thrusting:
            flame = self._flame_cache[self._flame_frame][b]
            rad = math.radians(self.angle - 90)
            fx = self.x - math.cos(rad) * 32
            fy = self.y - math.sin(rad) * 32
            fr = flame.get_rect(center=(int(fx), int(fy)))
            surface.blit(flame, fr)
