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
        vw = max(self.width + 34, 50)  # Wider visual longboat
        vh = self.height + 14
        self._ship_surf = pg.Surface((vw, vh), pg.SRCALPHA)
        hull_color = c.PIRATE_DARK_WOOD
        deck_color = c.PIRATE_BROWN
        trim_color = c.PIRATE_GOLD
        mast_color = c.PIRATE_CREAM
        oy = 7
        
        # Clearer longboat hull shape - pointed bow and stern
        pg.draw.polygon(self._ship_surf, hull_color, [
            (2, oy + vh // 2),                                     # Bow point
            (vw - 2, oy + vh // 2),                              # Stern point  
            (vw - 4, oy + 4),                                    # Stern top inside
            (4, oy + 4),                                         # Bow top inside
            (0, oy),                                             # Keel front
            (vw, oy)                                             # Keel back
        ])
        
        # Deck planks
        pg.draw.rect(self._ship_surf, deck_color, (4, oy + 6, vw - 8, vh - 12))
        
        # Gold trim along hull
        pg.draw.line(self._ship_surf, trim_color, (2, oy + vh // 2), (vw - 2, oy + vh // 2), 1)  # Keel line
        pg.draw.line(self._ship_surf, trim_color, (4, oy + 4), (vw - 4, oy + 4), 1)             # Gunwale
        
        # Mast
        mast_x = vw // 2
        mast_top = oy + 4
        mast_bottom = oy + vh - 10
        pg.draw.line(self._ship_surf, mast_color, (mast_x, mast_top), (mast_x, mast_bottom), 3)
        
        # Sail - cream triangle
        sail_width = 14
        sail_height = vh // 3
        pg.draw.polygon(self._ship_surf, c.PIRATE_CREAM, [
            (mast_x, mast_top + 4),
            (mast_x + sail_width, mast_top + sail_height),
            (mast_x - sail_width, mast_top + sail_height)
        ])
        
        # Oars - more visible
        oar_y = oy + vh // 2
        oar_spacing = vw // 4
        for i in range(1, 4):
            oar_x = oar_spacing * i
            # Left oar
            pg.draw.line(self._ship_surf, (160, 120, 70), 
                        (oar_x - 6, oar_y - 4), (oar_x, oar_y + 4), 2)
            pg.draw.line(self._ship_surf, (160, 120, 70), 
                        (oar_x, oar_y + 4), (oar_x + 6, oar_y - 4), 2)
            # Right oar (mirrored)
            pg.draw.line(self._ship_surf, (160, 120, 70), 
                        (vw - oar_x + 6, oar_y - 4), (vw - oar_x, oar_y + 4), 2)
            pg.draw.line(self._ship_surf, (160, 120, 70), 
                        (vw - oar_x, oar_y + 4), (vw - oar_x - 6, oar_y - 4), 2)
        
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
