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
        self._visual_w = 80  # wide enough to read as ship at browser scale

    def _build_surfs(self):
        vw = self._visual_w
        h = self.height
        is_player = self.side == 'left'

        # Outer glow — teal for player, red for AI — helps separate from navy bg
        glow_color = (0, 128, 128) if is_player else (139, 0, 0)
        self._glow_surf = pg.Surface((vw + 24, h + 24), pg.SRCALPHA)
        for i in range(12, 0, -1):
            alpha = max(16, 48 - (12 - i) * 4)
            r = pg.Rect(i, i, vw + 24 - i * 2, h + 24 - i * 2)
            pg.draw.rect(self._glow_surf, (*glow_color, alpha), r, border_radius=8)

        self._ship_surf = pg.Surface((vw, h), pg.SRCALPHA)

        # HITBOX NOTE: Collision rect is 16px wide (PADDLE_WIDTH), centered on self.x.
        # Visual ship is 80px wide (self._visual_w), also centered on self.x.
        # The visual extends ~32px beyond the hitbox on each side.
        # This is intentional — the broad silhouette makes paddles recognizable as
        # ships at browser/iPad canvas scale. The ball bounces off the 16px core.

        # Layout: a 32px margin on each side of the 16px hitbox = 80px total
        left_margin = (vw - self.width) // 2  # 32

        # Color identities
        accent_color = c.PIRATE_TEAL if is_player else c.PIRATE_RED
        hull_color = c.PIRATE_DARK_WOOD
        deck_color = c.PIRATE_BROWN
        trim_color = c.PIRATE_GOLD
        sail_color = c.PIRATE_CREAM
        flag_color = accent_color

        # Bow faces inward (toward center of screen), stern faces outward
        if is_player:
            bow_x = vw - left_margin       # right side of paddle
            stern_x = left_margin           # left side of paddle
            bow_tip = vw - 2
            stern_tip = 2
        else:
            bow_x = left_margin             # left side of paddle
            stern_x = vw - left_margin      # right side of paddle
            bow_tip = 2
            stern_tip = vw - 2

        # ── Broad hull ──
        # Lower hull body — the main dark mass
        hull_top = h // 2 - 18
        hull_bot = h // 2 + 18
        pg.draw.polygon(self._ship_surf, hull_color, [
            (stern_tip, hull_top),
            (bow_tip, hull_top),
            (bow_tip, hull_bot),
            (stern_tip, hull_bot),
        ])

        # Hull bottom curve (belly)
        belly_y = h // 2 + 22
        pg.draw.ellipse(self._ship_surf, hull_color,
                        pg.Rect(stern_x - 4, h // 2 + 6, abs(bow_x - stern_x) + 8, 28))

        # Hull top curve (deck line)
        pg.draw.ellipse(self._ship_surf, deck_color,
                        pg.Rect(stern_x - 2, hull_top - 2, abs(bow_x - stern_x) + 4, 12))

        # Deck plank area
        deck_w = abs(bow_x - stern_x)
        pg.draw.rect(self._ship_surf, deck_color,
                     (min(stern_x, bow_x) + 2, hull_top + 4, deck_w - 4, 10))

        # Gold gunwale (top edge trim)
        pg.draw.line(self._ship_surf, trim_color,
                     (stern_x, hull_top - 1), (bow_x, hull_top - 1), 2)

        # Gold keel (bottom edge trim)
        keel_y = h // 2 + 20
        pg.draw.line(self._ship_surf, trim_color,
                     (stern_x, keel_y), (bow_x, keel_y), 2)

        # ── Mast and sails ──
        mast_x = (stern_x + bow_x) // 2
        mast_top = 6
        mast_bot = hull_top + 4
        pg.draw.line(self._ship_surf, c.PIRATE_TAN, (mast_x, mast_top), (mast_x, mast_bot), 4)

        # Yardarm — wide enough to make sail shape visible
        yardarm_y = h // 3
        yardarm_spread = deck_w // 2
        pg.draw.line(self._ship_surf, trim_color,
                     (mast_x - yardarm_spread, yardarm_y),
                     (mast_x + yardarm_spread, yardarm_y), 2)

        # Main sail — broad triangle fills most of the visual width
        sail_spread = deck_w // 2 - 2
        sail_top = mast_top + 6
        sail_bot = yardarm_y + 8
        sail_pts = [
            (mast_x, sail_top),
            (mast_x + sail_spread if is_player else mast_x - sail_spread, sail_bot),
            (mast_x + -sail_spread if is_player else mast_x + sail_spread, sail_bot),
        ]
        pg.draw.polygon(self._ship_surf, sail_color, sail_pts)
        pg.draw.polygon(self._ship_surf, c.PIRATE_SAND, sail_pts, 2)

        # ── Flag at mast top ──
        flag_h = 8
        flag_w = 7
        if is_player:
            flag_pts = [(mast_x, mast_top - 1),
                        (mast_x + flag_w, mast_top - 1 - flag_h // 2),
                        (mast_x, mast_top - 1 - flag_h)]
        else:
            flag_pts = [(mast_x, mast_top - 1),
                        (mast_x - flag_w, mast_top - 1 - flag_h // 2),
                        (mast_x, mast_top - 1 - flag_h)]
        pg.draw.polygon(self._ship_surf, flag_color, flag_pts)

        # ── Accent stripe — teal for player, red for AI ──
        stripe_y = h // 2 + 14
        pg.draw.line(self._ship_surf, accent_color,
                     (stern_x + 2, stripe_y), (bow_x - 2, stripe_y), 3)

        # ── Bowsprit (small forward point) ──
        if is_player:
            sprit_pts = [(bow_x - 2, hull_top - 4),
                         (bow_tip + 6, h // 2),
                         (bow_x - 2, h // 2 + 26)]
        else:
            sprit_pts = [(bow_x + 2, hull_top - 4),
                         (bow_tip - 6, h // 2),
                         (bow_x + 2, h // 2 + 26)]
        pg.draw.polygon(self._ship_surf, hull_color, sprit_pts)

        # ── Cannon ports (small dark squares along hull side) ──
        port_color = c.PIRATE_CANNON
        port_count = 3
        port_start_y = hull_top + 8
        port_spacing = (hull_bot - hull_top - 12) // (port_count + 1)
        for i in range(port_count):
            py = int(port_start_y + port_spacing * (i + 1))
            if is_player:
                pg.draw.rect(self._ship_surf, port_color,
                             (bow_x - 7, py, 5, 3))
            else:
                pg.draw.rect(self._ship_surf, port_color,
                             (stern_x + 2, py, 5, 3))

        self._offset_x = left_margin
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
        # Glow centered on collision rect
        gx = self.x - self._visual_w // 2 - 12
        gy = self.y - self.height // 2 - 12
        surface.blit(self._glow_surf, (gx, gy))
        # Ship centered on paddle position
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
