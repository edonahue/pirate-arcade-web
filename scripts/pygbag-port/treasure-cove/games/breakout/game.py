import asyncio
import pygame as pg
import constants as c
import highscores as hs
from games.breakout.gameplay import Gameplay
from renderer import _OVERLAY, _VIGNETTE


class BreakoutGame:
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

    def _init_fonts(self):
        self.title_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_TITLE)
        self.hud_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_HUD)
        self.inst_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_INSTRUCTIONS)
        self.score_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_SCORE)

        self._menu_title = self.title_font.render("TREASURE COVE", True, c.WHITE)
        self._hs_label = None
        self._hs_surf = None
        lines = [
            "A / D or Left / Right  —  Move your longboat",
            "SPACE  —  Fire cannonball!",
            "ESC / P / Click        —  Pause",
            "F    —  FPS counter",
            "",
            "Smash through the fort defenses!",
        ]
        self._menu_lines = [self.inst_font.render(line, True, c.GRAY) for line in lines]
        self._menu_prompt = self.hud_font.render("Press SPACE to set sail!", True, c.PAUSE_HIGHLIGHT)
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
            "Press SPACE to sail again  |  ESC to port", True, c.GRAY)

        self._g_over_win = self.title_font.render("LOOT SECURED!", True, c.PIRATE_GOLD)
        self._g_over_lose = self.title_font.render("SHIP SUNK!", True, c.PIRATE_RED)
        self._g_over_score = (-1, None)

    async def run(self):
        while True:
            for event in pg.event.get():
                if event.type == pg.QUIT:
                    return
                if event.type == pg.KEYDOWN:
                    result = self._handle_key(event.key)
                    if result == 'quit':
                        return

            dt = 1 / 60
            self._update(dt)
            self._draw(60)
            pg.display.flip()
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
                return 'quit'

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
                    return 'quit'
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
                return 'quit'

    def _update(self, dt):
        if self.state == 'playing' and not self.paused:
            keys = pg.key.get_pressed()
            result = self.gameplay.update(dt, keys)
            if result[0] == 'game_over':
                self.state = 'game_over'
                self.game_over_state = result[1]
                hs.submit_breakout(self.gameplay.score)

    def _draw(self, fps):
        if self.state == 'menu':
            self._draw_menu()
        elif self.state == 'playing':
            self.gameplay.draw(self.surface, fps=fps)
            if self.paused:
                self._draw_pause()
        elif self.state == 'game_over':
            self.gameplay.draw(self.surface, fps=fps)
            self._draw_game_over()
        self.surface.blit(_VIGNETTE, (0, 0))

    def _draw_menu(self):
        self.surface.fill(c.PIRATE_NAVY)
        self.surface.blit(self._menu_title,
                          (c.WINDOW_WIDTH // 2 - self._menu_title.get_width() // 2, 140))
        y = 300
        for surf in self._menu_lines:
            self.surface.blit(surf, (c.WINDOW_WIDTH // 2 - surf.get_width() // 2, y))
            y += 32
        self.surface.blit(self._menu_prompt,
                          (c.WINDOW_WIDTH // 2 - self._menu_prompt.get_width() // 2, 600))

        high = hs.get_high('breakout')
        label = str(high['score']) if high else None
        if label != self._hs_label:
            self._hs_label = label
            self._hs_surf = self.inst_font.render(
                "Best: " + label, True, c.PIRATE_GOLD) if label else None
        if self._hs_surf:
            self.surface.blit(self._hs_surf,
                              (c.WINDOW_WIDTH // 2 - self._hs_surf.get_width() // 2, 640))

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
        if self.game_over_state == 'won':
            result_text = self._g_over_win
        else:
            result_text = self._g_over_lose
        self.surface.blit(result_text, (c.WINDOW_WIDTH // 2 - result_text.get_width() // 2,
                                        c.WINDOW_HEIGHT // 2 - 80))

        if self.gameplay.score != self._g_over_score[0]:
            self._g_over_score = (self.gameplay.score,
                                  self.score_font.render(str(self.gameplay.score), True, c.PIRATE_GOLD))
        self.surface.blit(self._g_over_score[1],
                          (c.WINDOW_WIDTH // 2 - self._g_over_score[1].get_width() // 2,
                           c.WINDOW_HEIGHT // 2))

        self.surface.blit(self._game_over_prompt,
                          (c.WINDOW_WIDTH // 2 - self._game_over_prompt.get_width() // 2,
                           c.WINDOW_HEIGHT // 2 + 80))
