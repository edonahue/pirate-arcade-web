import asyncio
import pygame as pg

pg.display.init()
pg.font.init()

import constants as c  # noqa: E402
from games.pong.game import PongGame  # noqa: E402


class DummyAudio:
    def __init__(self):
        self.muted = False
    def play(self, *args, **kwargs):
        pass
    def load(self, *args, **kwargs):
        pass


audio = DummyAudio()

surface = pg.display.set_mode((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))
pg.display.set_caption("CANNONBALL CLASH")


async def main():
    game = PongGame(surface, audio)
    await game.run()


asyncio.run(main())
