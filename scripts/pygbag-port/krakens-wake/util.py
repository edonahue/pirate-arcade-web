import pygame as pg
import constants as c

def toggle_fullscreen(surface, fullscreen):
    fullscreen = not fullscreen
    if fullscreen:
        surface = pg.display.set_mode(
            (c.WINDOW_WIDTH, c.WINDOW_HEIGHT),
            pg.FULLSCREEN | pg.SCALED | pg.DOUBLEBUF,
            vsync=1
        )
    else:
        surface = pg.display.set_mode(
            (c.WINDOW_WIDTH, c.WINDOW_HEIGHT),
            pg.SCALED | pg.DOUBLEBUF,
            vsync=1
        )
    return surface, fullscreen
