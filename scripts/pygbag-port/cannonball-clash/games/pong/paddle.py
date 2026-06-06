import pygame as pg
import constants as c

class Paddle:
    def __init__(self, x, y, side='left'):
        self.width = c.PADDLE_WIDTH
        self.height = c.PADDLE_HEIGHT
        self.x = x
        self.y = y
        self.vy = 0
        self.big_timer = 0.0
        self.base_height = c.PADDLE_HEIGHT
        self._built = False
        self.side = side  # 'left' (player) or 'right' (AI)

    def _build_surfs(self):
        self._glow_surf = pg.Surface((self.width + 20, self.height + 20), pg.SRCALPHA)
        for i in range(10, 0, -1):
            alpha = max(0, 40 - (10 - i) * 4)
            r = pg.Rect(i, i, self.width + 20 - i * 2, self.height + 20 - i * 2)
            pg.draw.rect(self._glow_surf, (0, 128, 128, alpha), r, border_radius=4)

        visual_w = max(self.width + 40, 60)
        w = self.width
        h = self.height
        self._ship_surf = pg.Surface((visual_w, h), pg.SRCALPHA)

        is_player = self.side == 'left'
        accent_color = c.PIRATE_TEAL if is_player else c.PIRATE_RED
        hull_color = c.PIRATE_DARK_WOOD
        deck_color = c.PIRATE_BROWN
        trim_color = c.PIRATE_GOLD
        mast_color = c.PIRATE_TAN
        flag_color = accent_color
        bow_side = 1 if is_player else -1

        offset_x = (visual_w - w) // 2

        if is_player:
            bow_inner_x = offset_x + w - 2
            bow_outer_x = offset_x + w + 2
            stern_inner_x = offset_x + 2
            stern_outer_x = offset_x - 2
        else:
            bow_inner_x = offset_x + 2
            bow_outer_x = offset_x - 2
            stern_inner_x = offset_x + w - 2
            stern_outer_x = offset_x + w + 2

        # Hull — pointed bow toward center, rounded stern toward edge
        pg.draw.polygon(self._ship_surf, hull_color, [
            (stern_outer_x, h // 2 - 4),
            (stern_inner_x, 3),
            (stern_inner_x, h - 3),
            (stern_outer_x, h // 2 + 4),
        ])
        # Bow extension
        pg.draw.polygon(self._ship_surf, hull_color, [
            (stern_inner_x, 3),
            (bow_inner_x, 3),
            (bow_outer_x, h // 2),
            (bow_inner_x, h - 3),
            (stern_inner_x, h - 3),
        ])

        # Deck planks
        deck_top = 5
        deck_bot = h - 5
        pg.draw.rect(self._ship_surf, deck_color, (
            min(stern_inner_x, bow_inner_x) + 2,
            deck_top,
            abs(bow_inner_x - stern_inner_x) - 4,
            deck_bot - deck_top,
        ))

        # Gold gunwale line
        gunwale_y = 4
        pg.draw.line(self._ship_surf, trim_color,
                     (min(stern_inner_x, bow_inner_x) + 1, gunwale_y),
                     (max(stern_inner_x, bow_inner_x) - 1, gunwale_y), 1)

        # Gold keel line
        keel_y = h - 4
        pg.draw.line(self._ship_surf, trim_color,
                     (min(stern_inner_x, bow_inner_x) + 1, keel_y),
                     (max(stern_inner_x, bow_inner_x) - 1, keel_y), 1)

        # Mast
        mast_x = (stern_inner_x + bow_inner_x) // 2
        mast_top = 7
        mast_bot = h - 7
        pg.draw.line(self._ship_surf, mast_color, (mast_x, mast_top), (mast_x, mast_bot), 3)

        # Yardarm (crossbar)
        yardarm_y = h // 3
        spread = int(w * 0.45)
        pg.draw.line(self._ship_surf, trim_color,
                     (mast_x - spread, yardarm_y),
                     (mast_x + spread, yardarm_y), 2)

        # Sail — main triangular sail on the bow side of the mast
        sail_spread = max(14, w // 2)
        sail_top = mast_top + 4
        sail_bot = yardarm_y + 6
        if is_player:
            sail_pts = [(mast_x, sail_top),
                        (mast_x + sail_spread, sail_bot),
                        (mast_x - int(sail_spread * 0.4), sail_bot)]
        else:
            sail_pts = [(mast_x, sail_top),
                        (mast_x - sail_spread, sail_bot),
                        (mast_x + int(sail_spread * 0.4), sail_bot)]
        pg.draw.polygon(self._ship_surf, c.PIRATE_CREAM, sail_pts)
        pg.draw.polygon(self._ship_surf, c.PIRATE_SAND, sail_pts, 1)

        # Jib sail (smaller forward triangle)
        jib_spread = max(8, w // 3)
        jib_top = mast_top + 10
        jib_bot = h // 2 - 4
        if is_player:
            jib_pts = [(mast_x, jib_top),
                       (mast_x + jib_spread, jib_bot),
                       (mast_x - int(jib_spread * 0.3), jib_bot)]
        else:
            jib_pts = [(mast_x, jib_top),
                       (mast_x - jib_spread, jib_bot),
                       (mast_x + int(jib_spread * 0.3), jib_bot)]
        pg.draw.polygon(self._ship_surf, (235, 225, 210), jib_pts)
        pg.draw.polygon(self._ship_surf, c.PIRATE_SAND, jib_pts, 1)

        # Flag at top of mast
        flag_h = 6
        flag_w = 5
        if is_player:
            flag_pts = [(mast_x, mast_top - 1),
                        (mast_x + flag_w, mast_top - 1 - flag_h // 2),
                        (mast_x, mast_top - 1 - flag_h)]
        else:
            flag_pts = [(mast_x, mast_top - 1),
                        (mast_x - flag_w, mast_top - 1 - flag_h // 2),
                        (mast_x, mast_top - 1 - flag_h)]
        pg.draw.polygon(self._ship_surf, flag_color, flag_pts)

        # Cannon ports
        port_color = c.PIRATE_CANNON
        port_count = max(2, h // 25)
        port_spacing = (h - 16) / (port_count + 1)
        for i in range(port_count):
            py = int(10 + port_spacing * (i + 1))
            port_w = 4
            port_h = 3
            if is_player:
                pg.draw.rect(self._ship_surf, port_color,
                             (bow_inner_x - port_w - 1, py, port_w, port_h))
            else:
                pg.draw.rect(self._ship_surf, port_color,
                             (stern_inner_x + 1, py, port_w, port_h))

        # Accent stripe — teal for player, rum for AI
        stripe_x1 = min(stern_inner_x, bow_inner_x) + 2
        stripe_x2 = max(stern_inner_x, bow_inner_x) - 2
        pg.draw.line(self._ship_surf, accent_color,
                     (stripe_x1, h - 8), (stripe_x2, h - 8), 2)

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
