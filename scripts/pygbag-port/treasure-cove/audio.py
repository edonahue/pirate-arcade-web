"""Stub for web — pygame.mixer not available in WASM."""


class Audio:
    def __init__(self):
        self.muted = False
        self.sounds = {}

    def play(self, *args, **kwargs):
        pass

    def load(self, *args, **kwargs):
        pass

    def stop(self, *args, **kwargs):
        pass
