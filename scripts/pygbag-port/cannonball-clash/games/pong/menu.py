import pygame as pg
import constants as c
import highscores as hs
import renderer as rd

class Menu:
    def __init__(self):
        self.title_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_TITLE)
        self.hud_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_HUD)
        self.inst_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_INSTRUCTIONS)
        self._cache_static()

    def _cache_static(self):
        self._title_surf = self.title_font.render("CANNONBALL CLASH", True, c.PIRATE_TEAL)
        self._hs_label = None
        self._hs_surf = None

        lines = [
            "W / S / Up / Down  —  Move paddle",
            "ESC / P / Click    —  Pause / Settings",
            "F11  —  Fullscreen toggle",
            "F    —  FPS counter",
            "",
            "First ship to 11 hits sinks!",
        ]
        self._line_surfs = []
        for line in lines:
            self._line_surfs.append(self.inst_font.render(line, True, c.GRAY))

        self._powerup_surf = self.hud_font.render(
            "Power-up: Reinforced Hull!", True, c.POWERUP_COLOR)

        self._hint_surf = self.inst_font.render(
            "W/S navigate  •  SPACE / Enter select", True, c.GRAY)

        self._item_static = []
        for label in ["Start Game", "Back to Menu"]:
            self._item_static.append(self.hud_font.render("  " + label, True, c.WHITE))
            self._item_static.append(self.hud_font.render("▸ " + label, True, c.PAUSE_HIGHLIGHT))

    def draw(self, surface, selection=0):
        rd._ensure_gradient()
        surface.blit(rd._DARK_GRADIENT, (0, 0))
        tx = c.WINDOW_WIDTH // 2 - self._title_surf.get_width() // 2
        surface.blit(self._title_surf, (tx, 140))

        y = 300
        for surf in self._line_surfs:
            surface.blit(surf, (c.WINDOW_WIDTH // 2 - surf.get_width() // 2, y))
            y += 32

        py = y + 40
        surface.blit(self._powerup_surf,
                     (c.WINDOW_WIDTH // 2 - self._powerup_surf.get_width() // 2, py))

        high = hs.get_high('pong')
        label = high.get('label', str(high['score'])) if high else None
        if label != self._hs_label:
            self._hs_label = label
            self._hs_surf = self.hud_font.render("Best rally: " + label, True, c.PIRATE_GOLD) if label else None
        if self._hs_surf:
            surface.blit(self._hs_surf, (c.WINDOW_WIDTH // 2 - self._hs_surf.get_width() // 2, py + 40))

        y = 590
        for i in range(2):
            idx = i * 2 + (1 if i == selection else 0)
            surf = self._item_static[idx]
            surface.blit(surf, (c.WINDOW_WIDTH // 2 - surf.get_width() // 2, y))
            y += 42

        surface.blit(self._hint_surf,
                     (c.WINDOW_WIDTH // 2 - self._hint_surf.get_width() // 2, c.WINDOW_HEIGHT - 60))
