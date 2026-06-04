import pygame as pg
import constants as c

class Paddle:
    def __init__(self, x, y):
        self.width = c.PADDLE_WIDTH
        self.height = c.PADDLE_HEIGHT
        self.x = x
        self.y = y
        self.vy = 0
        self.big_timer = 0.0
        self.base_height = c.PADDLE_HEIGHT
        self._built = False

    def _build_surfs(self):
        self._glow_surf = pg.Surface((self.width + 20, self.height + 20), pg.SRCALPHA)
        for i in range(10, 0, -1):
            alpha = max(0, 40 - (10 - i) * 4)
            r = pg.Rect(i, i, self.width + 20 - i * 2, self.height + 20 - i * 2)
            pg.draw.rect(self._glow_surf, (0, 128, 128, alpha), r, border_radius=4)
        visual_w = max(self.width + 34, 50)
        w = self.width
        h = self.height
        self._ship_surf = pg.Surface((visual_w, h), pg.SRCALPHA)
        hull_color = c.PIRATE_DARK_WOOD
        deck_color = c.PIRATE_BROWN
        trim_color = c.PIRATE_GOLD
        mast_color = c.PIRATE_CREAM
        flag_color = (200, 30, 30)  # Red for flag
        offset_x = (visual_w - w) // 2
        
        # Ship hull - pointed bow and stern, wider visual
        pg.draw.polygon(self._ship_surf, hull_color, [
            (offset_x + 2, h - 2),                                          # Stern bottom inside
            (offset_x, h - 6),                                              # Stern point
            (offset_x + 2, 2),                                              # Stern top inside
            (offset_x + w - 2, 2),                                          # Bow top inside
            (offset_x + w, h - 6),                                          # Bow point
            (offset_x + w - 2, h - 2),                                      # Bow bottom inside
            (offset_x + w - 4, h - 4),                                      # Hull outer bottom right
            (offset_x + 4, h - 4),                                          # Hull outer bottom left
        ])
        
        # Deck planking (lighter wood)
        pg.draw.rect(self._ship_surf, deck_color, (offset_x + 4, 6, w - 8, h - 12))
        
        # Gold trim along hull edges
        pg.draw.line(self._ship_surf, trim_color, (offset_x + 2, h - 2), (offset_x + w - 2, h - 2), 1)  # Bottom
        pg.draw.line(self._ship_surf, trim_color, (offset_x + 2, 2), (offset_x + w - 2, 2), 1)          # Top
        
        # Crossbar / Yardarm (horizontal spar)
        yardarm_y = h // 3
        pg.draw.line(self._ship_surf, trim_color, (offset_x + 4, yardarm_y), (offset_x + w - 4, yardarm_y), 2)
        
        # Mast
        mast_x = offset_x + w // 2
        mast_top = 8
        mast_bottom = h - 8
        pg.draw.line(self._ship_surf, mast_color, (mast_x, mast_top), (mast_x, mast_bottom), 3)
        
        # Sail - cream triangle on mast
        sail_width = 12
        sail_height = h // 3
        pg.draw.polygon(self._ship_surf, c.PIRATE_CREAM, [
            (mast_x, mast_top + 4),
            (mast_x + sail_width, mast_top + sail_height),
            (mast_x - sail_width, mast_top + sail_height)
        ])
        
        # Small red flag at top of mast
        flag_size = 3
        pg.draw.polygon(self._ship_surf, flag_color, [
            (mast_x, mast_top - flag_size),
            (mast_x + flag_size, mast_top),
            (mast_x - flag_size, mast_top)
        ])
        
        self._offset_x = offset_x
        self._visual_w = visual_w
        self._built = True

    @property
    def rect(self):
        return pg.Rect(self.x - self.width // 2, self.y - self.height // 2,
                       self.width, self.height)

    def update(self, dt):
        self.y += self.vy * dt
        self.y = max(self.height // 2, min(c.WINDOW_HEIGHT - self.height // 2, self.y))
        if self.big_timer > 0:
            self.big_timer -= dt
            if self.big_timer <= 0:
                self.height = self.base_height
                self._built = False

    def reset(self):
        self.big_timer = 0.0
        self.height = self.base_height
        self._built = False

    def activate_big(self):
        self.height = int(self.base_height * c.PADDLE_BIG_MULTIPLIER)
        self.big_timer = c.PADDLE_BIG_DURATION
        self._built = False

    @property
    def is_big(self):
        return self.big_timer > 0

    def draw(self, surface):
        if not self._built:
            self._build_surfs()
        gx = self.x - self.width // 2 - 10
        gy = self.y - self.height // 2 - 10
        surface.blit(self._glow_surf, (gx, gy))
        sx = self.x - self._visual_w // 2
        sy = self.y - self.height // 2
        if self.is_big:
            tinted = self._ship_surf.copy()
            tint = pg.Surface((self._visual_w, self.height), pg.SRCALPHA)
            tint.fill((255, 200, 50, 80))
            tinted.blit(tint, (0, 0), special_flags=pg.BLEND_RGBA_MULT)
            surface.blit(tinted, (sx, sy))
            pg.draw.rect(surface, c.POWERUP_COLOR, self.rect, 2)
        else:
            surface.blit(self._ship_surf, (sx, sy))
