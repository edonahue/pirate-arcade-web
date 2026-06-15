import pygame as pg
import constants as c


class Paddle:
    def __init__(self):
        self.base_width = c.PADDLE_BREAKOUT_WIDTH
        self.base_height = c.PADDLE_BREAKOUT_HEIGHT
        self.width = self.base_width
        self.height = self.base_height
        self.x = c.WINDOW_WIDTH // 2
        self.y = c.WINDOW_HEIGHT - c.PADDLE_BREAKOUT_MARGIN
        self.vx = 0
        self.wide_timer = 0.0
        self._built = False

    def _build_surfs(self):
        pad = 12
        w_glow = self.width + pad * 2
        h_glow = self.height + pad * 2
        self._glow_surf = pg.Surface((w_glow, h_glow), pg.SRCALPHA)
        for i in range(pad, 0, -1):
            alpha = max(0, 45 - (pad - i) * 4)
            r = pg.Rect(i, i, w_glow - i * 2, h_glow - i * 2)
            glow_color = c.PIRATE_TEAL if self.wide_timer > 0 else c.PIRATE_GOLD
            pg.draw.rect(self._glow_surf, (*glow_color, alpha), r, border_radius=6)

        vw = max(self.width + 32, 50)
        vh = self.height + 18
        self._ship_surf = pg.Surface((vw, vh), pg.SRCALPHA)
        hull_color = c.PIRATE_DARK_WOOD
        deck_color = c.PIRATE_BROWN
        trim_color = c.PIRATE_GOLD
        mast_color = c.PIRATE_TAN
        oy = 4

        pg.draw.polygon(self._ship_surf, hull_color, [
            (0, oy + vh - 8),
            (2, oy + 8),
            (vw // 2 - 2, oy + 2),
            (vw // 2 + 2, oy + 2),
            (vw - 2, oy + 8),
            (vw, oy + vh - 8),
            (vw - 4, oy + vh - 4),
            (4, oy + vh - 4),
        ])
        pg.draw.rect(self._ship_surf, hull_color, (4, oy + 6, vw - 8, vh - 14))
        pg.draw.rect(self._ship_surf, deck_color, (6, oy + 8, vw - 12, vh - 18))
        pg.draw.line(self._ship_surf, trim_color, (4, oy + 6), (vw - 4, oy + 6), 2)
        pg.draw.line(self._ship_surf, trim_color, (2, oy + vh - 6), (vw - 2, oy + vh - 6), 1)

        mast_x = vw // 2
        mast_top = oy + 4
        mast_bot = oy + vh - 12
        pg.draw.line(self._ship_surf, mast_color, (mast_x, mast_top), (mast_x, mast_bot), 3)
        pg.draw.rect(self._ship_surf, c.PIRATE_DARK_WOOD, (mast_x - 4, oy + 4, 8, 4))

        yardarm_y = oy + vh // 3
        spread = vw // 4
        pg.draw.line(self._ship_surf, trim_color,
                     (mast_x - spread, yardarm_y), (mast_x + spread, yardarm_y), 2)

        sail_spread = max(12, vw // 5)
        sail_top = mast_top + 6
        sail_bot = yardarm_y + 4
        pg.draw.polygon(self._ship_surf, c.PIRATE_CREAM, [
            (mast_x, sail_top), (mast_x + sail_spread, sail_bot), (mast_x - sail_spread, sail_bot),
        ])
        pg.draw.polygon(self._ship_surf, c.PIRATE_SAND, [
            (mast_x, sail_top), (mast_x + sail_spread, sail_bot), (mast_x - sail_spread, sail_bot),
        ], 1)

        oar_y = oy + vh - 6
        oar_count = 4
        oar_spacing = vw // (oar_count + 1)
        oar_color = (130, 90, 50)
        for i in range(1, oar_count + 1):
            ox = oar_spacing * i
            pg.draw.line(self._ship_surf, oar_color, (ox - 4, oar_y - 4), (ox, oar_y + 4), 2)
            pg.draw.line(self._ship_surf, oar_color, (ox, oar_y + 4), (ox + 4, oar_y - 4), 2)

        crate_w = max(14, vw // 6)
        crate_h = vh // 3
        crate_x = (vw - crate_w) // 2
        crate_y = oy + 8
        pg.draw.rect(self._ship_surf, c.PIRATE_BROWN_DARK, (crate_x, crate_y, crate_w, crate_h))
        pg.draw.rect(self._ship_surf, c.PIRATE_GOLD, (crate_x, crate_y, crate_w, crate_h), 1)
        band_y = crate_y + crate_h // 2 - 1
        pg.draw.line(self._ship_surf, c.PIRATE_GOLD, (crate_x + 2, band_y), (crate_x + crate_w - 2, band_y), 1)

        lantern_radius = 4
        lantern_x = vw // 2
        lantern_y = oy + vh - 10
        pg.draw.circle(self._ship_surf, c.PIRATE_GOLD, (lantern_x, lantern_y), lantern_radius)
        pg.draw.circle(self._ship_surf, c.PIRATE_TREASURE, (lantern_x, lantern_y), lantern_radius - 1)

        self._built = True

    @property
    def rect(self):
        return pg.Rect(self.x - self.width // 2, self.y - self.height // 2,
                       self.width, self.height)

    def reset(self):
        self.x = c.WINDOW_WIDTH // 2
        self.vx = 0
        self.wide_timer = 0.0
        self.width = self.base_width
        self.height = self.base_height
        self._built = False

    def activate_wide(self):
        self.width = int(self.base_width * c.PADDLE_BREAKOUT_WIDE_MULTIPLIER)
        self.wide_timer = c.PADDLE_BREAKOUT_WIDE_DURATION
        self._built = False

    @property
    def is_wide(self):
        return self.wide_timer > 0

    @property
    def wide_remaining(self):
        return max(0, self.wide_timer)

    def update(self, dt):
        self.x += self.vx * dt
        self.x = max(self.width // 2, min(c.WINDOW_WIDTH - self.width // 2, self.x))

        if self.wide_timer > 0:
            self.wide_timer -= dt
            if self.wide_timer <= 0:
                self.width = self.base_width
                self.height = self.base_height
                self._built = False

    def draw(self, surface):
        if not self._built:
            self._build_surfs()

        gx = int(self.x - self.width // 2 - 12)
        gy = int(self.y - self.height // 2 - 12)
        surface.blit(self._glow_surf, (gx, gy))

        sx = int(self.x - self.width // 2)
        sy = int(self.y - self.height // 2 - 7)

        if self.is_wide:
            tinted = self._ship_surf.copy()
            tint = pg.Surface((self._ship_surf.get_width(), self._ship_surf.get_height()), pg.SRCALPHA)
            tint.fill((0, 180, 255, 60))
            tinted.blit(tint, (0, 0), special_flags=pg.BLEND_RGBA_MULT)

            pulse = abs(math.sin(pg.time.get_ticks() * 0.005))
            near_expiry = self.wide_timer < 2.0
            if near_expiry and pulse > 0.7:
                pg.draw.rect(surface, c.PIRATE_TEAL, self.rect, 3)
            surface.blit(tinted, (sx, sy))
        else:
            surface.blit(self._ship_surf, (sx, sy))
