import asyncio
import pygame as pg

pg.display.init()
pg.font.init()

import constants as c  # noqa: E402
from games.breakout.game import BreakoutGame  # noqa: E402


class WebAudio:
    """WASM audio bridge — calls window.PirateArcadeAudio via __EMSCRIPTEN__."""

    def __init__(self):
        self._muted = False
        self._js = None
        try:
            import __EMSCRIPTEN__ as _em

            self._js = _em.window.PirateArcadeAudio
            self._js.init()
        except Exception:
            pass

    @property
    def muted(self):
        return self._muted

    @muted.setter
    def muted(self, val):
        self._muted = val
        if self._js:
            self._js.setMuted(val)

    def play(self, name, *a, **kw):
        if self._js:
            self._js.resume()
            self._js.play(name)

    def load(self, *a, **kw):
        pass


audio = WebAudio()

surface = pg.display.set_mode((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))
pg.display.set_caption("TREASURE COVE")


async def main():
    game = BreakoutGame(surface, audio)
    await game.run()


asyncio.run(main())
