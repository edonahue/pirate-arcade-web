"""Stub for web — pygame.mixer not available in WASM."""


class Audio:
    def __init__(self):
        self._muted = False
        self.sounds = {}

    @property
    def muted(self):
        return self._muted

    @muted.setter
    def muted(self, value):
        self._muted = value

    def play(self, *args, **kwargs):
        pass

    def load(self, *args, **kwargs):
        pass

    def stop(self, *args, **kwargs):
        pass
