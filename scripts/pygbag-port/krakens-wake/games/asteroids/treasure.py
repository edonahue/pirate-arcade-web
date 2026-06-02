import pygame as pg
import constants as c
import math
import random

class Treasure:
    def __init__(self, x, y):
        self.radius = c.TREASURE_RADIUS
        self.x = x
        self.y = y
        self.life = c.TREASURE_LIFETIME
        self.bob_offset = random.uniform(0, math.pi * 2)
        self.vx = random.uniform(-30, 30)
        self.vy = random.uniform(-30, 30)
        self.collected = False
        self._build_chest()

    def _build_chest(self):
        s = int(self.radius * 2 + 8)
        self._surf = pg.Surface((s, s), pg.SRCALPHA)
        cx, cy = s // 2, s // 2
        r = self.radius

        pg.draw.rect(self._surf, (160, 120, 50),
                     (cx - r + 2, cy - r // 2, r * 2 - 4, r), border_radius=2)

        lid = [(cx - r + 2, cy - r // 2),
               (cx + r - 2, cy - r // 2),
               (cx + r // 2, cy - r - 2),
               (cx - r // 2, cy - r - 2)]
        pg.draw.polygon(self._surf, (190, 140, 60), lid)

        pg.draw.rect(self._surf, (200, 170, 80),
                     (cx - 3, cy - 3, 6, 6), border_radius=2)

        gem_color = (255, 50, 50)
        pg.draw.circle(self._surf, gem_color, (cx - 5, cy + 2), 2)
        pg.draw.circle(self._surf, (50, 150, 255), (cx + 5, cy + 2), 2)

        gs = int(self.radius * 3)
        self._glow_surfs = []
        for ai in range(8):
            g = pg.Surface((gs, gs), pg.SRCALPHA)
            alpha = int(60 * ai / 7)
            pg.draw.circle(g, (255, 215, 0, alpha), (gs // 2, gs // 2), int(self.radius * 1.2))
            self._glow_surfs.append(g)

    def update(self, dt):
        self.bob_offset += dt * 2
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.life -= dt

    @property
    def rect(self):
        r = self.radius
        return pg.Rect(self.x - r, self.y - r, r * 2, r * 2)

    @property
    def dead(self):
        return self.life <= 0

    def draw(self, surface):
        if self.collected:
            return
        bob_y = self.y + math.sin(self.bob_offset) * 3
        r = self._surf.get_rect(center=(int(self.x), int(bob_y)))
        surface.blit(self._surf, r)

        pulse = 0.5 + 0.5 * math.sin(self.bob_offset * 2)
        idx = int(pulse * 7)
        idx = max(0, min(7, idx))
        gr = self._glow_surfs[idx].get_rect(center=(int(self.x), int(bob_y)))
        surface.blit(self._glow_surfs[idx], gr, special_flags=pg.BLEND_ADD)
