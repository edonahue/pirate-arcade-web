import json
import builtins

STATE_HEARTBEAT_HZ = 8
STATE_PUBLISH_INTERVAL = 1.0 / STATE_HEARTBEAT_HZ


class StatePublisher:
    def __init__(self, heartbeat_hz=STATE_HEARTBEAT_HZ):
        self._interval = 1.0 / heartbeat_hz
        self._accumulator = 0.0
        self._last_json = None
        self._last_phase = None

    def tick(self, dt, state_dict):
        self._accumulator += dt
        phase = state_dict.get("phase")
        phase_changed = phase is not None and phase != self._last_phase
        self._last_phase = phase

        if not phase_changed and self._accumulator < self._interval:
            return

        self._accumulator = 0.0
        self._publish(state_dict)

    def force_publish(self, state_dict):
        self._last_phase = state_dict.get("phase")
        self._accumulator = 0.0
        self._publish(state_dict)

    def _publish(self, state_dict):
        _gs_json = json.dumps(state_dict)
        if _gs_json == self._last_json:
            return
        self._last_json = _gs_json
        builtins.__dict__["__pa_game_state_json"] = _gs_json
        try:
            import __EMSCRIPTEN__ as _pa_platform
            _pa_platform.window["pa-game-state"].innerText = _gs_json
        except Exception:
            pass
