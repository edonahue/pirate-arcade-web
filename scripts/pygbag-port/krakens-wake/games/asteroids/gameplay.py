import pygame as pg
import constants as c
from games.asteroids.ship import Ship
from games.asteroids.barrel import Barrel
from games.asteroids.cannonball import Cannonball
from games.asteroids.treasure import Treasure
from games.asteroids.kraken import KrakenBoss
from renderer import draw_fps, draw_flash, HitParticle
import random
import math

# Deterministic safe fallback slots for wave spawns (farthest-from-ship wins).
_SPAWN_FALLBACK_SLOTS = ((200, 200), (1400, 200), (200, 700), (1400, 700))


def _debug_kraken_wave():
    """Test-only wave override: one-shot consume of a localStorage seed.

    Returns the internal wave index or None. The seed is removed on read,
    so a fresh page load without a newly set seed behaves ordinarily.
    Ordinary players never carry the key. Test-mode runs suppress
    best-score submission (see _test_mode).
    """
    try:
        from shared.pa_store import take as _take
        display = _take("pa-kraken-test-wave")
    except Exception:
        return None
    if display is None or not 1 <= display <= 30:
        return None
    return display - 1

_NEBULA_LAYERS = [
    {"color": (*c.PIRATE_BLOOD[:3], 25), "radius": 280, "pos": (0.2, 0.3)},
    {"color": (*c.PIRATE_NAVY[:3], 35), "radius": 220, "pos": (0.7, 0.2)},
    {"color": (*c.PIRATE_FLAME[:3], 15), "radius": 180, "pos": (0.5, 0.7)},
    {"color": (*c.PIRATE_TEAL[:3], 20), "radius": 150, "pos": (0.8, 0.8)},
]

_STARS = None

def _init_stars():
    global _STARS
    if _STARS is not None:
        return
    rng = random.Random(0xDEADBEEF)
    _STARS = []
    for _ in range(200):
        x = rng.randint(0, c.WINDOW_WIDTH)
        y = rng.randint(0, c.WINDOW_HEIGHT)
        brightness = rng.randint(60, 200)
        size = rng.choice([1, 1, 1, 2, 2, 3])
        twinkle = rng.random() < 0.3
        _STARS.append((x, y, brightness, size, twinkle))

_NEBULA_SURFACES = None

def _init_nebula():
    global _NEBULA_SURFACES
    if _NEBULA_SURFACES is not None:
        return
    _NEBULA_SURFACES = []
    for layer in _NEBULA_LAYERS:
        cx = int(c.WINDOW_WIDTH * layer["pos"][0])
        cy = int(c.WINDOW_HEIGHT * layer["pos"][1])
        r = layer["radius"]
        temp = pg.Surface((r * 2, r * 2), pg.SRCALPHA)
        pg.draw.circle(temp, layer["color"], (r, r), r)
        _NEBULA_SURFACES.append((temp, cx - r, cy - r))

def _draw_background(surface):
    surface.fill(c.PIRATE_NAVY)
    _init_nebula()
    for surf, bx, by in _NEBULA_SURFACES:
        surface.blit(surf, (bx, by), special_flags=pg.BLEND_ALPHA_SDL2)
    _init_stars()
    for x, y, brightness, size, twinkle in _STARS:
        if twinkle:
            brightness = max(40, brightness + int(30 * math.sin(pg.time.get_ticks() * 0.003 + x * 0.01)))
        pg.draw.circle(surface, (brightness, brightness, brightness), (x, y), size)

class Gameplay:
    def __init__(self, audio):
        self.audio = audio
        self.score_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_SCORE)
        self.hud_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_HUD)
        self.ship = Ship()
        self.barrels = []
        self.cannonballs = []
        self.treasures = []
        self.hit_particles = []
        self.score = 0
        self.lives = c.SHIP_LIVES
        self.show_fps = False
        self.wave = 0
        self.cooldown = 0.0
        self.flash_timer = 0.0
        self.boss = None
        self.transition = None
        self.transition_t = 0.0
        self._test_mode = False
        self._debug_wave = None
        self._cached_score = -1
        self._cached_score_surf = None
        self._cached_lives = -1
        self._cached_lives_surf = None
        self._cached_wave = -1
        self._cached_wave_surf = None
        self._cached_banner = (None, None)
        self._cached_banner_surf = None
        self._apply_debug_wave()
        if self.transition is None:
            self._spawn_barrels()

    def _apply_debug_wave(self):
        # One-shot consume on first call; resets reuse the in-memory value
        # so restarts stay deterministic without rereading storage.
        if self._debug_wave is None:
            self._debug_wave = _debug_kraken_wave()
            if self._debug_wave is not None:
                self._test_mode = True
        if self._debug_wave is None:
            return
        # Park one wave below target: the cleared-transition advance then
        # lands exactly on the requested wave through the production path.
        self.wave = max(0, self._debug_wave - 1)
        self.barrels = []
        self.boss = None
        self.transition = ("cleared", 0.01)

    def _safe_barrel_pos(self):
        sx, sy = self.ship.get_position()
        for _ in range(c.BARREL_SPAWN_TRIES):
            x = random.uniform(100, c.WINDOW_WIDTH - 100)
            y = random.uniform(100, c.WINDOW_HEIGHT - 100)
            if math.hypot(x - sx, y - sy) >= c.BARREL_SAFE_RADIUS:
                return (x, y)
        best = _SPAWN_FALLBACK_SLOTS[0]
        best_d = -1.0
        for slot in _SPAWN_FALLBACK_SLOTS:
            d = math.hypot(slot[0] - sx, slot[1] - sy)
            if d > best_d:
                best_d = d
                best = slot
        return best

    def _spawn_barrels(self):
        self.barrels = []
        count = c.ASTEROID_INITIAL_COUNT + self.wave
        for _ in range(count):
            x, y = self._safe_barrel_pos()
            self.barrels.append(Barrel(x, y))

    def _spawn_boss_wave(self):
        hp = KrakenBoss.hp_for_wave(self.wave)
        self.boss = KrakenBoss(800.0, float(c.KRAKEN_SPAWN_Y), hp=hp)
        self.boss.begin_entry(self.ship.x)
        self.audio.play('kraken_roar')

    def _begin_transition(self, kind):
        self.transition = (kind, c.WAVE_TRANSITION_DURATION)
        self.transition_t = c.WAVE_TRANSITION_DURATION

    def _defeat_boss(self):
        bx, by = self.boss.x, self.boss.y
        self.score += c.KRAKEN_KILL_SCORE
        self.treasures.append(Treasure(bx, by))
        for _ in range(20):
            self.hit_particles.append(
                HitParticle(bx, by, color=(160, 100, 40)))
        for _ in range(20):
            self.hit_particles.append(
                HitParticle(bx, by, color=(255, 100, 30)))
        self.flash_timer = 0.3
        self.audio.play('kraken_die')
        self.boss = None
        self._begin_transition("sunk")

    def _finish_transition(self):
        kind = self.transition[0]
        self.transition = None
        if kind == "cleared":
            self.wave += 1
            if KrakenBoss.is_boss_wave(self.wave):
                self._spawn_boss_wave()
            else:
                self._spawn_barrels()
        elif kind == "sunk":
            self.wave += 1
            self._spawn_barrels()

    def _transition_banner(self):
        if self.boss is not None and self.boss.phase == "entering":
            return "THE KRAKEN WAKES"
        if self.transition is None:
            return None
        kind = self.transition[0]
        if kind == "cleared":
            return "WAVE %d CLEARED" % (self.wave + 1)
        if kind == "sunk":
            return "KRAKEN SUNK! +%d" % c.KRAKEN_KILL_SCORE
        return None

    def reset(self):
        self.score = 0
        self.lives = c.SHIP_LIVES
        self.wave = 0
        self.cooldown = 0.0
        self.hit_particles = []
        self.cannonballs = []
        self.treasures = []
        self.flash_timer = 0.0
        self.boss = None
        self.transition = None
        self.transition_t = 0.0
        self._cached_score = -1
        self._cached_score_surf = None
        self._cached_lives = -1
        self._cached_lives_surf = None
        self._cached_wave = -1
        self._cached_wave_surf = None
        self._cached_banner = (None, None)
        self._cached_banner_surf = None
        self.ship.reset()
        # Re-park the debug wave: every match start (menu, restart,
        # replay) goes through reset(), which would otherwise wipe it.
        self._apply_debug_wave()
        if self.transition is None:
            self._spawn_barrels()

    def reset_round(self):
        self.ship.reset()
        self.cannonballs = []
        self.cooldown = 0.0
        if self.boss is not None and self.boss.alive:
            self.boss.reposition_after_life_loss()

    def update(self, dt, keys):
        if keys is None:
            return ('playing', None)

        self.ship.update(dt, keys)

        self.cooldown = max(0, self.cooldown - dt)

        if keys[pg.K_SPACE] and self.cooldown <= 0 and self.ship.alive:
            cx, cy = self.ship.get_position()
            rad = math.radians(self.ship.angle - 90)
            cx += math.cos(rad) * 32
            cy += math.sin(rad) * 32
            self.cannonballs.append(Cannonball(cx, cy, self.ship.angle))
            self.cooldown = c.CANNON_FIRE_RATE
            self.audio.play('cannon_fire')

        for b in self.cannonballs:
            b.update(dt)
        self.cannonballs = [b for b in self.cannonballs if not b.dead]

        for b in self.barrels:
            b.update(dt)

        if self.boss is not None and self.ship.alive:
            self.boss.update(dt, self.ship.x, self.ship.y)

        for t in self.treasures:
            t.update(dt)
        self.treasures = [t for t in self.treasures if not t.dead]

        for cb in self.cannonballs[:]:
            cb_rect = cb.rect
            if self.boss is not None and self.boss.vulnerable:
                if cb_rect.colliderect(self.boss.rect):
                    dealt = self.boss.hit_by_cannonball(cb)
                    if dealt:
                        self.score += c.KRAKEN_HIT_SCORE
                        self.audio.play('kraken_hit')
                        if not self.boss.alive:
                            self._defeat_boss()
                    break
            for barrel in self.barrels[:]:
                if not barrel.alive:
                    continue
                if cb_rect.colliderect(barrel.rect):
                    self._hit_barrel(barrel, cb)
                    break

        if self.ship.alive and self.ship.invulnerable <= 0:
            ship_rect = self.ship.rect
            if self.boss is not None and self.boss.dangerous:
                if ship_rect.colliderect(self.boss.rect):
                    result = self._hit_ship(None)
                    if result and result[0] == 'game_over':
                        return result
            for barrel in self.barrels:
                if not barrel.alive:
                    continue
                if ship_rect.colliderect(barrel.rect):
                    result = self._hit_ship(barrel)
                    if result and result[0] == 'game_over':
                        return result
                    break

        if self.ship.alive and self.ship.invulnerable <= 0:
            ship_rect = self.ship.rect
            for t in self.treasures:
                if t.collected:
                    continue
                if ship_rect.colliderect(t.rect):
                    t.collected = True
                    self.score += c.TREASURE_POINTS
                    self._spawn_collect_particles(t.x, t.y)
                    self.audio.play('treasure')

        self.barrels = [b for b in self.barrels if b.alive]

        if self.transition is not None:
            self.transition_t -= dt
            if self.transition_t <= 0:
                self._finish_transition()
        elif self.boss is None and len(self.barrels) == 0:
            self._begin_transition("cleared")
            self.audio.play('level_win')

        self.hit_particles = [p for p in self.hit_particles if not p.dead]
        for p in self.hit_particles:
            p.update(dt)
        if self.flash_timer > 0:
            self.flash_timer -= dt

        return ('playing', None)

    def _hit_barrel(self, barrel, cannonball):
        barrel.alive = False
        cannonball.life = -1
        self.score += Barrel.POINTS[barrel.radius]
        self._spawn_barrel_particles(barrel)
        self.flash_timer = 0.1
        self.audio.play('barrel_break')

        children = barrel.split()
        self.barrels.extend(children)

        if random.random() < c.TREASURE_CHANCE:
            self.treasures.append(Treasure(barrel.x, barrel.y))

    def _hit_ship(self, barrel):
        self.lives -= 1
        self.flash_timer = 0.3
        self.audio.play('life_lost')
        self._spawn_ship_particles()

        if self.lives <= 0:
            self.ship.alive = False
            return ('game_over', 'lost')

        self.reset_round()
        return ('playing', None)

    def _spawn_barrel_particles(self, barrel):
        for _ in range(random.randint(8, 14)):
            self.hit_particles.append(
                HitParticle(barrel.x, barrel.y, color=(160, 100, 40)))

    def _spawn_ship_particles(self):
        cx, cy = self.ship.get_position()
        for _ in range(30):
            self.hit_particles.append(
                HitParticle(cx, cy, color=(255, 100, 30)))

    def _spawn_collect_particles(self, x, y):
        for _ in range(12):
            self.hit_particles.append(
                HitParticle(x, y, color=(255, 215, 0)))

    def draw(self, surface, fps=0):
        _draw_background(surface)

        for p in self.hit_particles:
            p.draw(surface)

        for barrel in self.barrels:
            barrel.draw(surface)

        if self.boss is not None:
            self.boss.draw(surface)

        for t in self.treasures:
            t.draw(surface)

        for cb in self.cannonballs:
            cb.draw(surface)

        self.ship.draw(surface)

        if self.score != self._cached_score:
            self._cached_score = self.score
            self._cached_score_surf = self.score_font.render(str(self.score), True, c.PIRATE_GOLD)
        sx = c.WINDOW_WIDTH // 2 - self._cached_score_surf.get_width() // 2
        surface.blit(self._cached_score_surf, (sx, 15))

        if self.lives != self._cached_lives:
            self._cached_lives = self.lives
            self._cached_lives_surf = self.hud_font.render(
                "LIVES: " + "● " * self.lives, True, c.PIRATE_GOLD)
        lx = c.WINDOW_WIDTH - self._cached_lives_surf.get_width() - 20
        surface.blit(self._cached_lives_surf, (lx, 20))

        if self.wave != self._cached_wave:
            self._cached_wave = self.wave
            self._cached_wave_surf = self.hud_font.render("WAVE " + str(self.wave + 1), True, c.PIRATE_GOLD)
        surface.blit(self._cached_wave_surf, (20, 20))

        if self.boss is not None and self.boss.alive:
            self.boss.draw_hp_bar(surface, self.hud_font)

        banner = self._transition_banner()
        if banner is not None:
            if banner != self._cached_banner[0]:
                self._cached_banner = (banner, self.hud_font.render(
                    banner, True, c.PIRATE_MENU_TITLE))
            self._cached_banner_surf = self._cached_banner[1]
            surface.blit(self._cached_banner_surf,
                         (c.WINDOW_WIDTH // 2 - self._cached_banner_surf.get_width() // 2,
                          c.WINDOW_HEIGHT // 2 - 120))

        if self.flash_timer > 0:
            draw_flash(surface, self.flash_timer)

        if self.show_fps:
            draw_fps(surface, self.hud_font, fps)
