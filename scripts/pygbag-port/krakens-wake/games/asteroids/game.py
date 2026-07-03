import asyncio
import pygame as pg
import constants as c
import highscores as hs
from games.asteroids.gameplay import Gameplay
from renderer import _OVERLAY, _VIGNETTE, draw_composite_overlay
from util import toggle_fullscreen
from shared.pa_state import StatePublisher
from shared.pa_loop import FixedStepTimer, PresentGate, page_hidden
import random
import traceback

_BG_STARS = None
def _ensure_stars():
    global _BG_STARS
    if _BG_STARS is not None:
        return
    rng = random.Random(0xCAFEBABE)
    _BG_STARS = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT), pg.SRCALPHA)
    for _ in range(200):
        x = rng.randint(0, c.WINDOW_WIDTH)
        y = rng.randint(0, c.WINDOW_HEIGHT)
        b = rng.randint(100, 220)
        _BG_STARS.set_at((x, y), (b, b, b, b))


class AsteroidsGame:
    def __init__(self, surface, audio):
        self.surface = surface
        self.audio = audio
        self.gameplay = Gameplay(audio)
        self.state = 'menu'
        self.paused = False
        self.game_over_state = None
        self.pause_selection = 0
        self.sound_enabled = True
        self._init_fonts()
        self._state_pub = StatePublisher()
        self._present_gate = PresentGate()
        self._timer = FixedStepTimer()
        self._recovered_error_count = 0
        self._last_recovered_phase = None
        _ensure_stars()

    def _init_fonts(self):
        self.title_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_TITLE)
        self.hud_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_HUD)
        self.inst_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_INSTRUCTIONS)
        self.score_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_SCORE)

        self._menu_title = self.title_font.render("KRAKEN'S WAKE", True, c.PIRATE_MENU_TITLE)
        self._hs_label = None
        self._hs_surf = None
        lines = [
            "W / Up        —  Raise sails!",
            "A / Left      —  Port turn",
            "D / Right     —  Starboard turn",
            "SPACE         —  Fire cannons!",
            "ESC / P       —  Pause",
            "F11           —  Fullscreen toggle",
            "F             —  FPS counter",
            "",
            "Sink all enemy ships to advance waves!",
            "Collect floating treasure for bonus loot!",
        ]
        self._menu_lines = [self.inst_font.render(line, True, c.GRAY) for line in lines]
        self._menu_prompt = self.hud_font.render("Press SPACE to cast off!", True, c.PAUSE_HIGHLIGHT)
        self._menu_hint = self.inst_font.render("ESC to return to menu", True, c.GRAY)

        self._pause_title = self.title_font.render("PAUSED", True, c.WHITE)
        self._pause_hint = self.inst_font.render(
            "W/S navigate  •  SPACE select  •  ESC close", True, c.GRAY)
        self._pause_static = [
            (self.hud_font.render("  Resume", True, c.WHITE),
             self.hud_font.render("▸ Resume", True, c.PAUSE_HIGHLIGHT)),
            (self.hud_font.render("  Restart", True, c.WHITE),
             self.hud_font.render("▸ Restart", True, c.PAUSE_HIGHLIGHT)),
            (self.hud_font.render("  Quit to Menu", True, c.WHITE),
             self.hud_font.render("▸ Quit to Menu", True, c.PAUSE_HIGHLIGHT)),
        ]
        h = self.hud_font
        self._pause_sound = (h.render("  Sound: ON", True, c.WHITE),
                             h.render("  Sound: OFF", True, c.WHITE),
                             h.render("▸ Sound: ON", True, c.PAUSE_HIGHLIGHT),
                             h.render("▸ Sound: OFF", True, c.PAUSE_HIGHLIGHT))
        self._pause_fps = (h.render("  FPS Counter: ON", True, c.WHITE),
                           h.render("  FPS Counter: OFF", True, c.WHITE),
                           h.render("▸ FPS Counter: ON", True, c.PAUSE_HIGHLIGHT),
                           h.render("▸ FPS Counter: OFF", True, c.PAUSE_HIGHLIGHT))

        self._game_over_prompt = self.inst_font.render(
            "Press SPACE to play again  |  ESC to menu", True, c.GRAY)
        self._g_over_text = self.title_font.render("DAVY JONES' LOCKER", True, c.PIRATE_GAME_OVER)
        self._g_over_score = (-1, None)

    async def run(self):
        fullscreen = False

        while True:
            for event in pg.event.get():
                if event.type == pg.QUIT:
                    return 'quit'
                if event.type == pg.KEYDOWN and event.key == pg.K_F11:
                    self.surface, fullscreen = toggle_fullscreen(self.surface, fullscreen)
                    pg.display.set_caption("KRAKEN'S WAKE")
                elif event.type == pg.MOUSEBUTTONDOWN and self.state == 'playing':
                    self.paused = not self.paused
                elif event.type == pg.KEYDOWN:
                    result = self._handle_key(event.key)
                    if result == 'menu':
                        return 'menu'
                    elif result == 'quit':
                        return 'quit'

            hidden = page_hidden()
            active = self.state == 'playing' and not self.paused
            frame = self._timer.begin_frame(active=active, hidden=hidden)
            metrics = self._timer.metrics()

            for _ in range(frame.steps):
                self._update(frame.step_seconds)
                metrics.record_step()

            draw_key = (self.state, self.paused, self.pause_selection, self.sound_enabled)
            force_draw = (self.state == 'playing' and not self.paused)
            if force_draw:
                self._draw(60)
                self._state_pub._stats["draws"] += 1
                metrics.record_draw()
            elif self._present_gate.check_draw(draw_key):
                self._draw(60)
                self._state_pub._stats["draws"] += 1
                metrics.record_draw()
            else:
                metrics.record_static_draw_skip()

            if self._present_gate.check_present(draw_key, force=force_draw):
                pg.display.flip()
                self._state_pub._stats["presentations"] += 1
                metrics.record_present()
            else:
                metrics.record_static_present_skip()

            if hidden:
                await asyncio.sleep(0.05)
            else:
                await asyncio.sleep(0)

    def _handle_key(self, key):
        if self.state == 'menu':
            if key in (pg.K_SPACE, pg.K_RETURN):
                self.state = 'playing'
                self.gameplay.reset()
                self.paused = False
                self.game_over_state = None
                return
            if key == pg.K_ESCAPE:
                return 'menu'

        if self.state == 'playing' and self.paused:
            if key in (pg.K_ESCAPE, pg.K_p):
                self.paused = False
                return
            if key in (pg.K_w, pg.K_UP):
                self.pause_selection = (self.pause_selection - 1) % 5
                return
            if key in (pg.K_s, pg.K_DOWN):
                self.pause_selection = (self.pause_selection + 1) % 5
                return
            if key in (pg.K_SPACE, pg.K_RETURN):
                if self.pause_selection == 0:
                    self.paused = False
                elif self.pause_selection == 1:
                    self.gameplay.reset()
                    self.paused = False
                    self.game_over_state = None
                elif self.pause_selection == 2:
                    self.sound_enabled = not self.sound_enabled
                    self.audio.muted = not self.sound_enabled
                elif self.pause_selection == 3:
                    self.gameplay.show_fps = not self.gameplay.show_fps
                elif self.pause_selection == 4:
                    self.state = 'menu'
                    self.paused = False
                    self.gameplay.reset()
                    self.game_over_state = None
                return

        if self.state == 'playing' and not self.paused:
            if key == pg.K_ESCAPE:
                self.paused = True
                return
            if key == pg.K_p:
                self.paused = not self.paused
            if key == pg.K_f:
                self.gameplay.show_fps = not self.gameplay.show_fps

        if self.state == 'game_over':
            if key in (pg.K_SPACE, pg.K_RETURN):
                self.state = 'playing'
                self.gameplay.reset()
                self.paused = False
                self.game_over_state = None
                return
            if key == pg.K_ESCAPE:
                return 'menu'

    def _state_event_key(self):
        return (
            self.state,
            self.paused,
            self.gameplay.score,
            self.gameplay.lives,
            self.state == "menu",
            self._recovered_error_count,
        )

    def _build_game_state(self):
        return {
            "gameId": "krakens-wake",
            "phase": (
                "game-over" if self.state == "game_over"
                else "paused" if self.paused
                else self.state
            ),
            "score": self.gameplay.score,
            "lives": self.gameplay.lives,
            "playerPosition": self.gameplay.ship.y,
            "secondaryPosition": self.gameplay.ship.x,
            "projectileCount": len(self.gameplay.cannonballs),
            "actionReady": self.state == "menu",
            "shipAngle": self.gameplay.ship.angle,
            "shipSpeed": self.gameplay.ship.speed,
            "recoveredErrorCount": self._recovered_error_count,
            "lastRecoveredPhase": self._last_recovered_phase,
        }

    def _update(self, dt):
        try:
            if self.state == 'playing' and not self.paused:
                keys = pg.key.get_pressed()
                result = self.gameplay.update(dt, keys)
                if result[0] == 'game_over':
                    self.state = 'game_over'
                    self.game_over_state = result[1]
                    hs.submit_asteroids(self.gameplay.score)
        except Exception:
            traceback.print_exc()
            print("*** BUG: Uncaught exception in Asteroids _update — recovering to menu ***")
            self._recovered_error_count += 1
            self._last_recovered_phase = "update"
            self.state = 'menu'
        active = self.state == 'playing' and not self.paused
        self._state_pub.tick(
            dt,
            event_key=self._state_event_key(),
            state_factory=self._build_game_state,
            active=active,
        )

    def _draw(self, fps):
        try:
            if self.state == 'menu':
                self._draw_menu()
            elif self.state == 'playing':
                self.gameplay.draw(self.surface, fps=fps)
            elif self.state == 'game_over':
                self.gameplay.draw(self.surface, fps=fps)

            self.surface.blit(_BG_STARS, (0, 0), special_flags=pg.BLEND_ADD)

            if self.state == 'playing' and self.paused:
                self._draw_pause()
            elif self.state == 'game_over':
                self._draw_game_over()

            draw_composite_overlay(self.surface)
        except Exception:
            traceback.print_exc()
            print("*** BUG: Uncaught exception in Asteroids _draw — recovering ***")
            self._recovered_error_count += 1
            self._last_recovered_phase = "draw"
            self.surface.fill((0, 0, 0))

    def _draw_menu(self):
        self.surface.fill((5, 5, 15))
        self.surface.blit(self._menu_title,
                          (c.WINDOW_WIDTH // 2 - self._menu_title.get_width() // 2, 80))
        y = 200
        for surf in self._menu_lines:
            self.surface.blit(surf, (c.WINDOW_WIDTH // 2 - surf.get_width() // 2, y))
            y += 30
        self.surface.blit(self._menu_prompt,
                          (c.WINDOW_WIDTH // 2 - self._menu_prompt.get_width() // 2, 580))

        high = hs.get_high('asteroids')
        label = str(high['score']) if high else None
        if label != self._hs_label:
            self._hs_label = label
            self._hs_surf = self.inst_font.render(
                "Best: " + label, True, c.PIRATE_GOLD) if label else None
        if self._hs_surf:
            self.surface.blit(self._hs_surf,
                              (c.WINDOW_WIDTH // 2 - self._hs_surf.get_width() // 2, 630))

        self.surface.blit(self._menu_hint,
                          (c.WINDOW_WIDTH // 2 - self._menu_hint.get_width() // 2, c.WINDOW_HEIGHT - 60))

    def _draw_pause(self):
        self.surface.blit(_OVERLAY, (0, 0))
        self.surface.blit(self._pause_title,
                          (c.WINDOW_WIDTH // 2 - self._pause_title.get_width() // 2, 60))
        y = 250
        labels = [
            "Resume",
            "Restart",
            f"Sound: {'ON' if self.sound_enabled else 'OFF'}",
            f"FPS Counter: {'ON' if self.gameplay.show_fps else 'OFF'}",
            "Quit to Menu",
        ]
        static_indices = {0: 0, 1: 1, 4: 2}
        for i, label in enumerate(labels):
            if i in static_indices:
                si = static_indices[i]
                text = self._pause_static[si][1 if i == self.pause_selection else 0]
            elif i == 2:
                idx = (2 if i == self.pause_selection else 0) + (0 if self.sound_enabled else 1)
                text = self._pause_sound[idx]
            elif i == 3:
                idx = (2 if i == self.pause_selection else 0) + (0 if self.gameplay.show_fps else 1)
                text = self._pause_fps[idx]
            else:
                color = c.PAUSE_HIGHLIGHT if i == self.pause_selection else c.WHITE
                prefix = "▸ " if i == self.pause_selection else "  "
                text = self.hud_font.render(prefix + label, True, color)
            self.surface.blit(text, (c.WINDOW_WIDTH // 2 - text.get_width() // 2, y))
            y += 42
        self.surface.blit(self._pause_hint,
                          (c.WINDOW_WIDTH // 2 - self._pause_hint.get_width() // 2, c.WINDOW_HEIGHT - 60))

    def _draw_game_over(self):
        self.surface.blit(_OVERLAY, (0, 0))
        result_text = self._g_over_text
        self.surface.blit(result_text, (c.WINDOW_WIDTH // 2 - result_text.get_width() // 2,
                                        c.WINDOW_HEIGHT // 2 - 80))

        score = self.gameplay.score
        if score != self._g_over_score[0]:
            self._g_over_score = (score, self.score_font.render(str(score), True, c.PIRATE_GOLD))
        self.surface.blit(self._g_over_score[1],
                          (c.WINDOW_WIDTH // 2 - self._g_over_score[1].get_width() // 2,
                           c.WINDOW_HEIGHT // 2))

        wave_reached = self.gameplay.wave + 1
        wave_surf = self.inst_font.render("Wave " + str(wave_reached), True, c.GRAY)
        self.surface.blit(wave_surf, (c.WINDOW_WIDTH // 2 - wave_surf.get_width() // 2,
                                      c.WINDOW_HEIGHT // 2 + 40))

        self.surface.blit(self._game_over_prompt,
                          (c.WINDOW_WIDTH // 2 - self._game_over_prompt.get_width() // 2,
                           c.WINDOW_HEIGHT // 2 + 80))
