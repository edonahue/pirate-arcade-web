import pygame as pg
from pygame import gfxdraw
import constants as c
import math
import random

def rounded_rect_fill(surf, color, rect, r):
    x, y, w, h = int(rect[0]), int(rect[1]), int(rect[2]), int(rect[3])
    if w < 2 or h < 2:
        return
    r = max(1, min(r, w // 2, h // 2))
    gfxdraw.filled_circle(surf, x + r, y + r, r, color)
    gfxdraw.filled_circle(surf, x + w - r - 1, y + r, r, color)
    gfxdraw.filled_circle(surf, x + r, y + h - r - 1, r, color)
    gfxdraw.filled_circle(surf, x + w - r - 1, y + h - r - 1, r, color)
    pg.draw.rect(surf, color, (x + r, y, w - 2 * r, h))
    pg.draw.rect(surf, color, (x, y + r, w, h - 2 * r))

def rounded_rect_outline(surf, color, rect, r, width=1):
    x, y, w, h = int(rect[0]), int(rect[1]), int(rect[2]), int(rect[3])
    r = max(1, min(r, w // 2, h // 2))
    if width == 1:
        gfxdraw.aacircle(surf, x + r, y + r, r, color)
        gfxdraw.aacircle(surf, x + w - r - 1, y + r, r, color)
        gfxdraw.aacircle(surf, x + r, y + h - r - 1, r, color)
        gfxdraw.aacircle(surf, x + w - r - 1, y + h - r - 1, r, color)
        pg.draw.line(surf, color, (x + r, y), (x + w - r - 1, y))
        pg.draw.line(surf, color, (x + r, y + h - 1), (x + w - r - 1, y + h - 1))
        pg.draw.line(surf, color, (x, y + r), (x, y + h - r - 1))
        pg.draw.line(surf, color, (x + w - 1, y + r), (x + w - 1, y + h - r - 1))

_OVERLAY = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT), pg.SRCALPHA)
_OVERLAY.fill((0, 0, 0, 200))

_VIGNETTE = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT), pg.SRCALPHA)
for i in range(78, 0, -1):
    a = int(55 * (1 - i / 78))
    pg.draw.rect(_VIGNETTE, (0, 0, 0, a),
                 (i, i, c.WINDOW_WIDTH - i * 2, c.WINDOW_HEIGHT - i * 2), 1)

_DARK_GRADIENT = None

def _ensure_gradient():
    global _DARK_GRADIENT
    if _DARK_GRADIENT is not None:
        return
    _DARK_GRADIENT = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))
    for y in range(c.WINDOW_HEIGHT):
        t = y / c.WINDOW_HEIGHT
        r = int(c.ARCADE_DARK[0] * (1 - t) + c.ARCADE_PURPLE[0] * t)
        g = int(c.ARCADE_DARK[1] * (1 - t) + c.ARCADE_PURPLE[1] * t)
        b = int(c.ARCADE_DARK[2] * (1 - t) + c.ARCADE_PURPLE[2] * t)
        pg.draw.line(_DARK_GRADIENT, (r, g, b), (0, y), (c.WINDOW_WIDTH, y))

_SCANLINES = None

def _ensure_scanlines():
    global _SCANLINES
    if _SCANLINES is not None:
        return
    _SCANLINES = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT), pg.SRCALPHA)
    for y in range(0, c.WINDOW_HEIGHT, 4):
        pg.draw.line(_SCANLINES, (0, 0, 0, 10), (0, y), (c.WINDOW_WIDTH, y))
        pg.draw.line(_SCANLINES, (0, 0, 0, 4), (0, y + 1), (c.WINDOW_WIDTH, y + 1))

_ALPHA_LEVELS = 8

_pause_static = {}

def _ensure_pause_static(title_font):
    if 'title' not in _pause_static:
        _pause_static['title'] = title_font.render("PAUSED", True, c.WHITE)
        inst = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_INSTRUCTIONS)
        _pause_static['inst_font'] = inst
        _pause_static['controls'] = [
            inst.render(line, True, c.GRAY) for line in [
                "W / S or Up / Down  —  Move paddle",
                "ESC / P / Click     —  Pause / Resume",
                "F                   —  FPS counter",
                "F11                 —  Fullscreen",
            ]
        ]
        _pause_static['hint'] = inst.render(
            "W/S navigate  •  SPACE select  •  ESC close", True, c.GRAY)
        hud = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_HUD)
        _pause_static['hud_font'] = hud
        _pause_static['static_items'] = [
            (hud.render("  Resume", True, c.WHITE), hud.render("▸ Resume", True, c.PAUSE_HIGHLIGHT)),
            (hud.render("  Restart", True, c.WHITE), hud.render("▸ Restart", True, c.PAUSE_HIGHLIGHT)),
            (hud.render("  Quit to Menu", True, c.WHITE), hud.render("▸ Quit to Menu", True, c.PAUSE_HIGHLIGHT)),
        ]
        _pause_static['hud'] = hud
        _pause_static['_sound_on'] = hud.render("  Sound: ON", True, c.WHITE)
        _pause_static['_sound_off'] = hud.render("  Sound: OFF", True, c.WHITE)
        _pause_static['_sound_on_sel'] = hud.render("▸ Sound: ON", True, c.PAUSE_HIGHLIGHT)
        _pause_static['_sound_off_sel'] = hud.render("▸ Sound: OFF", True, c.PAUSE_HIGHLIGHT)
        _pause_static['_fps_on'] = hud.render("  FPS Counter: ON", True, c.WHITE)
        _pause_static['_fps_off'] = hud.render("  FPS Counter: OFF", True, c.WHITE)
        _pause_static['_fps_on_sel'] = hud.render("▸ FPS Counter: ON", True, c.PAUSE_HIGHLIGHT)
        _pause_static['_fps_off_sel'] = hud.render("▸ FPS Counter: OFF", True, c.PAUSE_HIGHLIGHT)
        _pause_static['_diff'] = {
            d: (hud.render("  Difficulty: " + d.upper(), True, c.WHITE),
                hud.render("▸ Difficulty: " + d.upper(), True, c.PAUSE_HIGHLIGHT))
            for d in c.AI_DIFFICULTY_ORDER
        }

_CENTER_LINE_SURF = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))
_CENTER_LINE_SURF.set_colorkey(c.BLACK)
_y = 0
while _y < c.WINDOW_HEIGHT:
    pg.draw.rect(_CENTER_LINE_SURF, c.WHITE,
                 (c.WINDOW_WIDTH // 2 - c.CENTER_LINE_WIDTH // 2, _y,
                  c.CENTER_LINE_WIDTH, c.CENTER_LINE_DASH))
    _y += c.CENTER_LINE_DASH + c.CENTER_LINE_GAP

def draw_center_line(surface):
    surface.blit(_CENTER_LINE_SURF, (0, 0))

_fps_cache = (-1, None)

def draw_fps(surface, font, fps):
    global _fps_cache
    val = int(fps)
    if val != _fps_cache[0]:
        _fps_cache = (val, font.render(f"{val} FPS", True, c.GRAY))
    surface.blit(_fps_cache[1], (10, c.WINDOW_HEIGHT - 30))

_FLASH_SURF = None

def draw_flash(surface, timer, duration=0.4):
    if timer > 0:
        global _FLASH_SURF
        if _FLASH_SURF is None:
            _FLASH_SURF = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))
            _FLASH_SURF.fill((255, 255, 255))
        alpha = int(180 * timer / duration)
        alpha = max(0, min(255, alpha))
        _FLASH_SURF.set_alpha(alpha)
        surface.blit(_FLASH_SURF, (0, 0))

def draw_pause_overlay(surface, title_font, selection, sound_enabled, show_fps, difficulty):
    _ensure_pause_static(title_font)
    surface.blit(_OVERLAY, (0, 0))

    tx = c.WINDOW_WIDTH // 2 - _pause_static['title'].get_width() // 2
    surface.blit(_pause_static['title'], (tx, 60))

    y = 150
    for line_surf in _pause_static['controls']:
        surface.blit(line_surf, (c.WINDOW_WIDTH // 2 - line_surf.get_width() // 2, y))
        y += 30

    y += 15
    items = [
        "Resume",
        "Restart",
        f"Sound: {'ON' if sound_enabled else 'OFF'}",
        f"FPS Counter: {'ON' if show_fps else 'OFF'}",
        f"Difficulty: {difficulty.upper()}",
        "Quit to Menu",
    ]
    static_indices = {0: 0, 1: 1, 5: 2}
    for i, label in enumerate(items):
        if i in static_indices:
            si = static_indices[i]
            text = _pause_static['static_items'][si][1 if selection == i else 0]
        elif i == 2:
            key = '_sound_' + ('on' if sound_enabled else 'off')
            key += '_sel' if selection == i else ''
            text = _pause_static[key]
        elif i == 3:
            key = '_fps_' + ('on' if show_fps else 'off')
            key += '_sel' if selection == i else ''
            text = _pause_static[key]
        elif i == 4:
            text = _pause_static['_diff'][difficulty][1 if selection == i else 0]
        else:
            color = c.PAUSE_HIGHLIGHT if i == selection else c.WHITE
            prefix = "▸ " if i == selection else "  "
            text = _pause_static['hud'].render(prefix + label, True, color)
        surface.blit(text, (c.WINDOW_WIDTH // 2 - text.get_width() // 2, y))
        y += 42

    hint = _pause_static['hint']
    surface.blit(hint, (c.WINDOW_WIDTH // 2 - hint.get_width() // 2, c.WINDOW_HEIGHT - 60))


_particle_surf_cache = {}

def _get_particle_surfs(size, color):
    key = (size, color)
    if key not in _particle_surf_cache:
        surfs = []
        for ai in range(_ALPHA_LEVELS):
            s = int(size * 2)
            surf = pg.Surface((s, s), pg.SRCALPHA)
            alpha = int(255 * ai / (_ALPHA_LEVELS - 1))
            pg.draw.circle(surf, (*color, alpha), (int(size), int(size)), int(size))
            surfs.append(surf)
        _particle_surf_cache[key] = surfs
    return _particle_surf_cache[key]

class HitParticle:
    def __init__(self, x, y, color=(255, 255, 255)):
        angle = random.uniform(0, math.pi * 2)
        speed = random.uniform(80, 250)
        self.x = x
        self.y = y
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed
        self.life = random.uniform(0.15, 0.3)
        self.max_life = self.life
        self.size = int(random.uniform(2, 5))
        self.color = color
        self._surfs = _get_particle_surfs(self.size, color)

    def update(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.life -= dt

    @property
    def dead(self):
        return self.life <= 0

    def draw(self, surface):
        idx = int(self.life / self.max_life * (_ALPHA_LEVELS - 1))
        idx = max(0, min(_ALPHA_LEVELS - 1, idx))
        surface.blit(self._surfs[idx], (int(self.x - self.size), int(self.y - self.size)))


def _get_win_particle_surfs(size, color):
    return _get_particle_surfs(size, color)

class Particle:
    def __init__(self, x, y):
        angle = random.uniform(0, math.pi * 2)
        speed = random.uniform(100, 400)
        self.x = x
        self.y = y
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed - 200
        self.life = random.uniform(0.5, 1.5)
        self.max_life = self.life
        self.size = int(random.uniform(2, 5))
        self.color = (255, 255, 255) if random.random() < 0.3 else (255, 215, 0)
        self._surfs = _get_win_particle_surfs(self.size, self.color)

    def update(self, dt):
        self.x += self.vx * dt
        self.vy += c.PARTICLE_GRAVITY * dt
        self.y += self.vy * dt
        self.life -= dt

    @property
    def dead(self):
        return self.life <= 0

    def draw(self, surface):
        idx = int(self.life / self.max_life * (_ALPHA_LEVELS - 1))
        idx = max(0, min(_ALPHA_LEVELS - 1, idx))
        surface.blit(self._surfs[idx], (int(self.x - self.size), int(self.y - self.size)))


class WinParticles:
    def __init__(self):
        self.particles = []

    def reset(self):
        self.particles = []
        cx = c.WINDOW_WIDTH // 2
        cy = c.WINDOW_HEIGHT // 2
        for _ in range(c.PARTICLE_COUNT):
            self.particles.append(Particle(cx, cy))

    def update(self, dt):
        for p in self.particles:
            p.update(dt)
        self.particles = [p for p in self.particles if not p.dead]

    def draw(self, surface):
        for p in self.particles:
            p.draw(surface)


_g_over = {}

def draw_game_over(surface, title_font, score_font, inst_font,
                   player_score, ai_score, player_won, timer, particles):
    surface.blit(_OVERLAY, (0, 0))

    if '_prompt' not in _g_over:
        _g_over['_prompt'] = inst_font.render(
            "Press SPACE to play again  |  ESC to menu", True, c.GRAY)
        _g_over['_ai_wins'] = title_font.render("AI WINS!", True, c.WHITE)
        _g_over['_victory_base'] = title_font.render("VICTORY!", True, c.GOLD)
        _g_over['_victory_shadow'] = title_font.render("VICTORY!", True, (100, 80, 0))
        _g_over['_cached_score'] = (-1, None)

    if player_won:
        particles.draw(surface)

        progress = min(timer / c.WIN_ANIMATION_DURATION, 1.0)
        if progress < 0.5:
            t = progress / 0.5
            scale = 0.5 + 0.7 * (t * (2 - t))
        else:
            t = (progress - 0.5) / 0.5
            scale = 1.2 - 0.2 * (t * t)
        scale = min(scale, 1.2)

        base = _g_over['_victory_base']
        shadow = _g_over['_victory_shadow']
        sw = int(base.get_width() * scale)
        sh = int(base.get_height() * scale)
        if sw > 0 and sh > 0:
            scaled = pg.transform.scale(base, (sw, sh))
            scaled_shadow = pg.transform.scale(shadow, (sw, sh))
            offset = max(1, int(4 * scale))
            tx = c.WINDOW_WIDTH // 2 - scaled.get_width() // 2
            ty = c.WINDOW_HEIGHT // 2 - 80
            surface.blit(scaled_shadow, (tx + offset, ty + offset))
            surface.blit(scaled, (tx, ty))

        if progress >= 1.0:
            score_key = (player_score, ai_score)
            cached_score, cached_surf = _g_over['_cached_score']
            if score_key != cached_score:
                cached_surf = score_font.render(
                    f"{player_score} - {ai_score}", True, c.GOLD)
                _g_over['_cached_score'] = (score_key, cached_surf)
            surface.blit(cached_surf, (c.WINDOW_WIDTH // 2 - cached_surf.get_width() // 2,
                                       c.WINDOW_HEIGHT // 2 + 20))
            prompt = _g_over['_prompt']
            surface.blit(prompt, (c.WINDOW_WIDTH // 2 - prompt.get_width() // 2,
                                  c.WINDOW_HEIGHT // 2 + 80))
    else:
        ai = _g_over['_ai_wins']
        surface.blit(ai, (c.WINDOW_WIDTH // 2 - ai.get_width() // 2,
                          c.WINDOW_HEIGHT // 2 - 80))
        score_key = (player_score, ai_score)
        cached_score, cached_surf = _g_over['_cached_score']
        if score_key != cached_score:
            cached_surf = score_font.render(
                f"{player_score} - {ai_score}", True, c.GOLD)
            _g_over['_cached_score'] = (score_key, cached_surf)
        surface.blit(cached_surf, (c.WINDOW_WIDTH // 2 - cached_surf.get_width() // 2,
                                   c.WINDOW_HEIGHT // 2 + 20))
        prompt = _g_over['_prompt']
        surface.blit(prompt, (c.WINDOW_WIDTH // 2 - prompt.get_width() // 2,
                              c.WINDOW_HEIGHT // 2 + 80))
