import pygame as pg
import constants as c
from games.asteroids.ship import Ship
from games.asteroids.barrel import Barrel
from games.asteroids.cannonball import Cannonball
from games.asteroids.treasure import Treasure
from renderer import draw_fps, draw_flash, HitParticle
import random
import math

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
        self._cached_score = -1
        self._cached_score_surf = None
        self._cached_lives = -1
        self._cached_lives_surf = None
        self._cached_wave = -1
        self._cached_wave_surf = None
        self._spawn_barrels()

    def _spawn_barrels(self):
        self.barrels = []
        count = c.ASTEROID_INITIAL_COUNT + self.wave
        for _ in range(count):
            x = random.uniform(100, c.WINDOW_WIDTH - 100)
            y = random.uniform(100, c.WINDOW_HEIGHT - 100)
            self.barrels.append(Barrel(x, y))

    def reset(self):
        self.score = 0
        self.lives = c.SHIP_LIVES
        self.wave = 0
        self.cooldown = 0.0
        self.hit_particles = []
        self.cannonballs = []
        self.treasures = []
        self.flash_timer = 0.0
        self._cached_score = -1
        self._cached_score_surf = None
        self._cached_lives = -1
        self._cached_lives_surf = None
        self._cached_wave = -1
        self._cached_wave_surf = None
        self.ship.reset()
        self._spawn_barrels()

    def reset_round(self):
        self.ship.reset()
        self.cannonballs = []
        self.cooldown = 0.0

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

        for t in self.treasures:
            t.update(dt)
        self.treasures = [t for t in self.treasures if not t.dead]

        for cb in self.cannonballs[:]:
            cb_rect = cb.rect
            for barrel in self.barrels[:]:
                if not barrel.alive:
                    continue
                if cb_rect.colliderect(barrel.rect):
                    self._hit_barrel(barrel, cb)
                    break

        if self.ship.alive and self.ship.invulnerable <= 0:
            ship_rect = self.ship.rect
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

        if len(self.barrels) == 0:
            self.wave += 1
            self._spawn_barrels()
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
        surface.fill(c.PIRATE_NAVY)

        for p in self.hit_particles:
            p.draw(surface)

        for barrel in self.barrels:
            barrel.draw(surface)

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

        if self.flash_timer > 0:
            draw_flash(surface, self.flash_timer)

        if self.show_fps:
            draw_fps(surface, self.hud_font, fps)
