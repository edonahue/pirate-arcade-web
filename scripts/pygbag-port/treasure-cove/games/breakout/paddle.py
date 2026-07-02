import pygame as pg
import constants as c
import math


class Paddle:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.vx = 0
        self.width = c.PADDLE_BREAKOUT_WIDTH
        self.height = c.PADDLE_BREAKOUT_HEIGHT
        self.wide_timer = 0.0
        self.was_wide = False
        self._build_surfs()
        self._pulse_surfs = []
        self._cached_pulse = None

    def _build_surfs(self):
        w = self.width
        h = self.height

        self._glow_width = w * 3
        self._glow_surf = pg.Surface((self._glow_width, h + 12), pg.SRCALPHA)
        for i in range(6, 0, -1):
            alpha = max(0, c.BRICK_GLOW_ALPHA - (6 - i) * 7)
            gx = (self._glow_width - (w + i * 2)) // 2
            gr = pg.Rect(gx, i, w + i * 2, h + 6 - i * 2)
            pg.draw.rect(self._glow_surf, (*c.PIRATE_GOLD, alpha), gr, border_radius=3)

        self._normal_surf = pg.Surface((w, h), pg.SRCALPHA)
        pg.draw.rect(self._normal_surf, c.PIRATE_CANNON, (0, 0, w, h), border_radius=4)
        pg.draw.rect(self._normal_surf, c.PIRATE_BLOOD, (0, 0, w, h), 2, border_radius=4)
        plank_h = h // 3
        for py in range(plank_h, h, plank_h):
            pg.draw.line(self._normal_surf, c.PIRATE_BROWN, (2, py), (w - 2, py), 1)
        for px in range(6, w, 8):
            pg.draw.line(self._normal_surf, (60, 55, 50, 60), (px, 2), (px + 2, h - 2), 1)

        wide_w = int(w * c.PADDLE_BREAKOUT_WIDE_MULTIPLIER)
        self._wide_surf = pg.Surface((wide_w, h), pg.SRCALPHA)
        pg.draw.rect(self._wide_surf, (40, 50, 60), (0, 0, wide_w, h), border_radius=4)
        pg.draw.rect(self._wide_surf, (0, 200, 255), (0, 0, wide_w, h), 2, border_radius=4)
        plank_h = h // 3
        for py in range(plank_h, h, plank_h):
            pg.draw.line(self._wide_surf, (30, 60, 80), (2, py), (wide_w - 2, py), 1)
        for px in range(6, wide_w, 8):
            pg.draw.line(self._wide_surf, (50, 90, 110, 60), (px, 2), (px + 2, h - 2), 1)

    def _build_pulse_surfs(self):
        self._pulse_surfs = []
        for frame in range(8):
            alpha = int(100 + 155 * abs(math.sin(frame * math.pi / 8)))
            w = self._wide_surf.get_width()
            h = self.height
            surf = pg.Surface((w + 6, h + 6), pg.SRCALPHA)
            pg.draw.rect(surf, (0, 200, 255, alpha), (0, 0, w + 6, h + 6), 3, border_radius=5)
            self._pulse_surfs.append(surf)

    @property
    def rect(self):
        w = self.width
        if self.wide_timer > 0:
            w = int(w * c.PADDLE_BREAKOUT_WIDE_MULTIPLIER)
        return pg.Rect(self.x - w // 2, self.y - self.height // 2, w, self.height)

    def activate_wide(self):
        self.wide_timer = c.PADDLE_BREAKOUT_WIDE_DURATION
        self.was_wide = True

    def update(self, dt):
        self.x += self.vx * dt
        w = self.width
        if self.wide_timer > 0:
            self.wide_timer -= dt
            if self.wide_timer <= 0:
                self.wide_timer = 0
                w = self.width
            else:
                w = int(w * c.PADDLE_BREAKOUT_WIDE_MULTIPLIER)
        half = w // 2
        self.x = max(half, min(c.WINDOW_WIDTH - half, self.x))

    def draw(self, surface):
        gx = self.x - self._glow_width // 2
        gy = self.y - self.height // 2 - 6
        surface.blit(self._glow_surf, (gx, gy))

        wide = self.wide_timer > 0
        bw = self.width
        bh = self.height
        r = self.rect

        if wide:
            surf = self._wide_surf
            blit_w = surf.get_width()
            blit_x = r.x
        else:
            surf = self._normal_surf
            blit_w = bw
            blit_x = r.x
        surface.blit(surf, (blit_x, r.y))

        near_expiry = 0 < self.wide_timer < 2.0
        if near_expiry:
            frame = int((pg.time.get_ticks() // 60) % 8)
            if len(self._pulse_surfs) == 0:
                self._build_pulse_surfs()
            if self._pulse_surfs:
                ps = self._pulse_surfs[frame]
                px = r.x - 3
                py = r.y - 3
                surface.blit(ps, (px, py))
