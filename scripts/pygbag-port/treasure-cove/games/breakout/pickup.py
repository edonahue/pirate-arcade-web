import pygame as pg
import constants as c
import random
import math


PICKUP_COLORS = {
    "multiball": (255, 215, 0),
    "wide_paddle": (0, 200, 255),
    "slow_motion": (100, 255, 100),
}

PICKUP_LABELS = {
    "multiball": "MULTIBALL!",
    "wide_paddle": "WIDE PADDLE!",
    "slow_motion": "SLOW SEAS!",
}

PICKUP_SYMBOLS = {
    "multiball": "*",
    "wide_paddle": "<>",
    "slow_motion": "~~",
}


class Pickup:
    def __init__(self, x, y, pickup_type):
        self.x = x
        self.y = y
        self.pickup_type = pickup_type
        self.speed = c.PICKUP_FALL_SPEED
        self.timer = c.PICKUP_LIFETIME
        self.pulse = random.uniform(0, math.pi * 2)
        self.color = PICKUP_COLORS.get(pickup_type, (255, 255, 255))
        self.label = PICKUP_LABELS.get(pickup_type, "?")
        self._build_surfs()

    def _build_surfs(self):
        s = c.PICKUP_SIZE
        self._glow_surf = pg.Surface((s + 12, s + 12), pg.SRCALPHA)
        for i in range(6, 0, -1):
            alpha = max(0, 60 - (6 - i) * 10)
            r = pg.Rect(i, i, s + 12 - i * 2, s + 12 - i * 2)
            pg.draw.rect(self._glow_surf, (*self.color, alpha), r, border_radius=4)

        self._icon_surf = pg.Surface((s, s), pg.SRCALPHA)
        half = s // 2
        if self.pickup_type == "multiball":
            pg.draw.circle(self._icon_surf, self.color, (half - 4, half), 5)
            pg.draw.circle(self._icon_surf, self.color, (half + 4, half - 3), 4)
            pg.draw.circle(self._icon_surf, self.color, (half + 3, half + 4), 3)
        elif self.pickup_type == "wide_paddle":
            pg.draw.rect(self._icon_surf, self.color, (2, half - 3, s - 4, 6), border_radius=2)
            pg.draw.rect(self._icon_surf, (255, 255, 255, 160), (2, half - 3, s - 4, 6), 1, border_radius=2)
        elif self.pickup_type == "slow_motion":
            pg.draw.circle(self._icon_surf, self.color, (half, half), half - 3, 2)
            pg.draw.line(self._icon_surf, self.color, (half, half), (half, half - half // 2 + 2), 2)
            pg.draw.line(self._icon_surf, self.color, (half, half), (half + half // 2 - 2, half), 2)

        self._font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_TINY)
        self._label_surf = self._font.render(self.label, True, self.color)

    @property
    def rect(self):
        s = c.PICKUP_SIZE
        return pg.Rect(self.x - s // 2, self.y - s // 2, s, s)

    @property
    def expired(self):
        return self.timer <= 0 or self.y > c.WINDOW_HEIGHT + c.PICKUP_SIZE

    def update(self, dt):
        self.pulse += dt * 5
        self.y += self.speed * dt
        self.timer -= dt

    def draw(self, surface):
        s = c.PICKUP_SIZE
        pulse_extra = int(math.sin(self.pulse) * 3)
        ox = self.x - s // 2 - 6
        oy = self.y - s // 2 - 6
        surface.blit(self._glow_surf, (ox, oy))
        scale = 1.0 + math.sin(self.pulse) * 0.05
        scaled_size = int(s * scale)
        scaled_surf = pg.transform.scale(self._icon_surf, (scaled_size, scaled_size))
        ix = self.x - scaled_size // 2
        iy = self.y - scaled_size // 2
        surface.blit(scaled_surf, (ix, iy))
        pg.draw.rect(surface, (255, 255, 255, 100),
                     (ix, iy, scaled_size, scaled_size), 1, border_radius=3)

    def draw_label(self, surface, font):
        text = font.render(self.label, True, self.color)
        tx = c.WINDOW_WIDTH // 2 - text.get_width() // 2
        surface.blit(text, (tx, c.WINDOW_HEIGHT // 2 - 40))
