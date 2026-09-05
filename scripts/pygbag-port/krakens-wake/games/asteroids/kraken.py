import math
import pygame as pg
import constants as c

# Phases damaging to the player / vulnerable to cannonballs.
# entering + positioning: no collision either direction (arrival spectacle).
# lunge: ship collision active, cannonball damage disabled (no firing into a charge).
DAMAGING_PHASES = ("tracking", "telegraph", "lunge", "recovery")
VULNERABLE_PHASES = ("tracking", "telegraph", "recovery")


def _build_maw_surf(radius, flash=False):
    size = int(radius * 2)
    surf = pg.Surface((size, size), pg.SRCALPHA)
    cx = cy = radius
    pg.draw.circle(surf, c.PIRATE_NAVY, (cx, cy), radius)
    pg.draw.circle(surf, c.PIRATE_SEA, (cx, cy), int(radius * 0.85))
    inner = int(radius * 0.6)
    if flash:
        pg.draw.circle(surf, c.PIRATE_CREAM, (cx, cy), inner)
    else:
        pg.draw.circle(surf, c.PIRATE_BLOOD, (cx, cy), inner)
    for i in range(10):
        a0 = math.pi * 2 * i / 10
        a1 = math.pi * 2 * (i + 0.5) / 10
        p0 = (cx + math.cos(a0) * inner, cy + math.sin(a0) * inner)
        p1 = (cx + math.cos(a1) * inner * 0.55, cy + math.sin(a1) * inner * 0.55)
        p2 = (cx + math.cos(a0 + 0.3) * inner, cy + math.sin(a0 + 0.3) * inner)
        pg.draw.polygon(surf, c.PIRATE_CREAM, [p0, p1, p2])
    pg.draw.circle(surf, (10, 12, 28), (cx, cy), int(inner * 0.35))
    pg.draw.circle(surf, c.PIRATE_SEA, (cx, cy), radius, 3)
    return surf


class KrakenBoss:
    """Procedural Kraken encounter: central maw + six tentacle arcs.

    Rhythm: entering -> positioning -> tracking -> telegraph -> lunge
    -> recovery -> loop. Only `tracking`/`telegraph`/`recovery` accept
    cannonball damage; `lunge` is ship-dangerous but shot-immune.
    """

    def __init__(self, x, y, hp=None):
        self.x = float(x)
        self.y = float(y)
        self.max_hp = c.KRAKEN_HP_BASE if hp is None else hp
        self.hp = self.max_hp
        self.phase = "entering"
        self.phase_t = 0.0
        self.track_t = 0.0
        self.anim_t = 0.0
        self.hit_flash = 0.0
        self.lunge_dx = 0.0
        self.lunge_dy = 0.0
        self.vx = 0.0
        self.vy = 0.0
        self.alive = True
        self.tentacles = [
            {"angle": math.pi * 2 * i / 6, "length": 95 + (i % 2) * 20,
             "phase": math.pi * 2 * i / 6}
            for i in range(6)
        ]
        self._maw_surf = _build_maw_surf(c.KRAKEN_MAW_RADIUS, flash=False)
        self._maw_hit_surf = _build_maw_surf(c.KRAKEN_MAW_RADIUS, flash=True)

    @property
    def rect(self):
        r = c.KRAKEN_MAW_RADIUS
        return pg.Rect(self.x - r, self.y - r, r * 2, r * 2)

    @property
    def vulnerable(self):
        return self.alive and self.phase in VULNERABLE_PHASES

    @property
    def dangerous(self):
        return self.alive and self.phase in DAMAGING_PHASES

    @staticmethod
    def hp_for_wave(wave):
        """Recurrence scaling from internal wave; display waves 2, 5, 8, ..."""
        recurrences = max(0, (wave - 1) // 3)
        return min(c.KRAKEN_HP_BASE + recurrences * c.KRAKEN_HP_PER_RECURRENCE,
                   c.KRAKEN_HP_MAX)

    @staticmethod
    def is_boss_wave(wave):
        return wave % 3 == 1

    @staticmethod
    def farthest_anchor(x, y):
        best = c.KRAKEN_ANCHORS[0]
        best_d = -1.0
        for ax, ay in c.KRAKEN_ANCHORS:
            d = (ax - x) ** 2 + (ay - y) ** 2
            if d > best_d:
                best_d = d
                best = (ax, ay)
        return best

    def _move_toward(self, tx, ty, speed, dt):
        dx, dy = tx - self.x, ty - self.y
        dist = math.hypot(dx, dy)
        if dist < 1e-6:
            return True
        step = min(dist, speed * dt)
        self.x += dx / dist * step
        self.y += dy / dist * step
        return step >= dist - 1e-6

    def _ship_distance(self, ship_x, ship_y):
        return math.hypot(self.x - ship_x, self.y - ship_y)

    def update(self, dt, ship_x, ship_y):
        if not self.alive:
            return
        self.anim_t += dt
        self.hit_flash = max(0.0, self.hit_flash - dt)
        self.phase_t += dt

        if self.phase == "entering":
            ax, ay = self._entry_anchor
            if self._move_toward(ax, ay, 260, dt) or \
                    self.phase_t >= c.KRAKEN_ENTER_DURATION:
                self._to_positioning()
        elif self.phase == "positioning":
            ax, ay = KrakenBoss.farthest_anchor(ship_x, ship_y)
            self._move_toward(ax, ay, c.KRAKEN_POSITIONING_SPEED, dt)
            if self._ship_distance(ship_x, ship_y) >= \
                    c.KRAKEN_ACTIVATION_SAFE_RADIUS:
                self._set_phase("tracking")
        elif self.phase == "tracking":
            dx, dy = ship_x - self.x, ship_y - self.y
            dist = math.hypot(dx, dy)
            if dist > 1e-6:
                self.x += dx / dist * c.KRAKEN_TRACK_SPEED * dt
                self.y += dy / dist * c.KRAKEN_TRACK_SPEED * dt
            self._wrap()
            if self.phase_t >= c.KRAKEN_TRACK_DURATION:
                # Lock lunge direction at telegraph start: dodgeable.
                self.lunge_dx, self.lunge_dy = dx, dy
                norm = math.hypot(dx, dy) or 1.0
                self.lunge_dx /= norm
                self.lunge_dy /= norm
                self._set_phase("telegraph")
        elif self.phase == "telegraph":
            if self.phase_t >= c.KRAKEN_TELEGRAPH_DURATION:
                self._set_phase("lunge")
        elif self.phase == "lunge":
            self.x += self.lunge_dx * c.KRAKEN_LUNGE_SPEED * dt
            self.y += self.lunge_dy * c.KRAKEN_LUNGE_SPEED * dt
            self._wrap()
            if self.phase_t >= c.KRAKEN_LUNGE_DURATION:
                self.vx = 0.0
                self.vy = 0.0
                self._set_phase("recovery")
        elif self.phase == "recovery":
            if self.phase_t >= c.KRAKEN_RECOVERY_DURATION:
                self._set_phase("tracking")

    def _set_phase(self, phase):
        self.phase = phase
        self.phase_t = 0.0

    def _to_positioning(self):
        self._set_phase("positioning")

    def begin_entry(self, ship_x):
        """Start the arrival spectacle from the top edge. Non-damaging."""
        x = min(max(ship_x, c.KRAKEN_SPAWN_X_MIN), c.KRAKEN_SPAWN_X_MAX)
        self.x = float(x)
        self.y = float(c.KRAKEN_SPAWN_Y)
        self._entry_anchor = KrakenBoss.farthest_anchor(x, 450.0)
        self._set_phase("entering")

    def reposition_after_life_loss(self):
        """Safe non-damaging re-entry; HP and progress preserved."""
        self._entry_anchor = KrakenBoss.farthest_anchor(800.0, 450.0)
        self._set_phase("positioning")

    def hit_by_cannonball(self, cannonball):
        """Apply a cannonball hit. Returns damage dealt (0 when immune)."""
        if not self.vulnerable:
            return 0
        cannonball.life = -1
        self.hp -= 1
        self.hit_flash = 0.12
        if self.hp <= 0:
            self.alive = False
            self.phase = "defeated"
        return 1

    def _wrap(self):
        m = c.KRAKEN_MAW_RADIUS + 10
        if self.x < -m:
            self.x = c.WINDOW_WIDTH + m
        elif self.x > c.WINDOW_WIDTH + m:
            self.x = -m
        if self.y < -m:
            self.y = c.WINDOW_HEIGHT + m
        elif self.y > c.WINDOW_HEIGHT + m:
            self.y = -m

    def _tentacle_points(self):
        pts = []
        for t in self.tentacles:
            base = t["angle"] + self.anim_t * 0.15
            segs = [(self.x, self.y)]
            for s in (1, 2, 3):
                curl = math.sin(self.anim_t * 2 + t["phase"] + s * 0.7) * 12
                ang = base + curl / (t["length"] * s * 0.4 + 20)
                segs.append((
                    self.x + math.cos(ang) * t["length"] * s / 3,
                    self.y + math.sin(ang) * t["length"] * s / 3,
                ))
            pts.append(segs)
        return pts

    def draw(self, surface):
        if not self.alive:
            return
        telegraphing = self.phase == "telegraph"
        pulse = (math.sin(self.anim_t * 10) + 1) / 2 if telegraphing else 0
        for segs in self._tentacle_points():
            pg.draw.lines(surface, c.PIRATE_SEA, False, segs, 14)
            for px, py in segs[1:]:
                pg.draw.circle(surface, c.PIRATE_TEAL, (int(px), int(py)), 4)
                pg.draw.circle(surface, c.PIRATE_CREAM, (int(px), int(py)), 2)
            if telegraphing:
                pg.draw.lines(surface, c.PIRATE_FLAME, False, segs, 18)
        surf = self._maw_hit_surf if self.hit_flash > 0 else self._maw_surf
        surface.blit(surf, surf.get_rect(center=(int(self.x), int(self.y))))
        if telegraphing:
            ring_r = int(20 + pulse * 40)
            pg.draw.circle(surface, c.PIRATE_FLAME,
                           (int(self.x), int(self.y)), ring_r, 3)

    def draw_hp_bar(self, surface, font):
        if not self.alive:
            return
        w, h, x, y = 400, 14, c.WINDOW_WIDTH // 2 - 200, 85
        pg.draw.rect(surface, (10, 12, 28), (x - 2, y - 2, w + 4, h + 4))
        frac = max(0.0, self.hp / self.max_hp)
        pg.draw.rect(surface, c.PIRATE_RED, (x, y, w, h))
        pg.draw.rect(surface, c.PIRATE_BLOOD, (x, y, int(w * frac), h))
        label = font.render("KRAKEN", True, c.PIRATE_MENU_TITLE)
        surface.blit(label, (c.WINDOW_WIDTH // 2 - label.get_width() // 2, y - 26))
