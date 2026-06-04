import pygame as pg
import constants as c

class Paddle:
    def __init__(self):
        self.width = c.PADDLE_BREAKOUT_WIDTH
        self.height = c.PADDLE_BREAKOUT_HEIGHT
        self.x = c.WINDOW_WIDTH // 2
        self.y = c.WINDOW_HEIGHT - c.PADDLE_BREAKOUT_MARGIN
        self.vx = 0
        self._built = False

    def _build_surfs(self):
        pad = 12
        w = self.width + pad * 2
        h = self.height + pad * 2
        self._glow_surf = pg.Surface((w, h), pg.SRCALPHA)
        for i in range(pad, 0, -1):
            alpha = max(0, 45 - (pad - i) * 4)
            r = pg.Rect(i, i, w - i * 2, h - i * 2)
            pg.draw.rect(self._glow_surf, (*c.PIRATE_GOLD, alpha), r, border_radius=6)
        vw = self.width
        vh = self.height + 14
        self._ship_surf = pg.Surface((vw, vh), pg.SRCALPHA)
        hull_color = c.PIRATE_DARK_WOOD
        deck_color = c.PIRATE_BROWN
        trim_color = c.PIRATE_GOLD
        mast_color = c.PIRATE_CREAM
        oy = 7
        pg.draw.polygon(self._ship_surf, hull_color, [
            (4, oy), (vw - 4, oy), (vw - 1, oy + vh // 2 - 4),
            (vw - 4, oy + vh - 1), (4, oy + vh - 1), (0, oy + vh // 2 - 4)
        ])
        pg.draw.polygon(self._ship_surf, hull_color, [
            (vw // 2 - 2, oy - 4), (vw // 2 + 2, oy - 4), (vw // 2, oy)
        ])
        pg.draw.rect(self._ship_surf, deck_color, (6, oy + 2, vw - 12, vh - 6), 1)
        pg.draw.line(self._ship_surf, trim_color, (vw // 6, oy + vh // 2 - 1), (vw * 5 // 6, oy + vh // 2 - 1))
        if vw > 40:
            mast_x = vw // 3
            pg.draw.line(self._ship_surf, mast_color, (mast_x, oy + 2), (mast_x, oy + vh - 4), 2)
            mid_y = (oy + 2 + oy + vh - 4) // 2
            pg.draw.polygon(self._ship_surf, c.PIRATE_CREAM, [
                (mast_x, mid_y - 2), (mast_x + 8, mid_y + 6), (mast_x, mid_y + 14)
            ])
            pg.draw.polygon(self._ship_surf, c.PIRATE_CREAM, [
                (mast_x, mid_y - 2), (mast_x - 8, mid_y + 6), (mast_x, mid_y + 14)
            ])
            oar_x = vw * 3 // 4
            for dy in range(-6, 7, 4):
                pg.draw.line(self._ship_surf, (180, 140, 80), (oar_x, oy + vh // 2 + dy), (oar_x + 6, oy + vh // 2 + dy + 2), 1)
        self._built = True

    @property
    def rect(self):
        return pg.Rect(self.x - self.width // 2, self.y - self.height // 2,
                       self.width, self.height)

    def reset(self):
        self.x = c.WINDOW_WIDTH // 2
        self.vx = 0

    def update(self, dt):
        self.x += self.vx * dt
        self.x = max(self.width // 2, min(c.WINDOW_WIDTH - self.width // 2, self.x))

    def draw(self, surface):
        if not self._built:
            self._build_surfs()
        gx = int(self.x - self.width // 2 - 12)
        gy = int(self.y - self.height // 2 - 12)
        surface.blit(self._glow_surf, (gx, gy))
        sx = int(self.x - self.width // 2)
        sy = int(self.y - self.height // 2 - 7)
        surface.blit(self._ship_surf, (sx, sy))
        inner = self.rect.inflate(-8, -8)
        if inner.width > 0 and inner.height > 0:
            pg.draw.rect(surface, c.PIRATE_BROWN_DARK, inner, border_radius=3)
