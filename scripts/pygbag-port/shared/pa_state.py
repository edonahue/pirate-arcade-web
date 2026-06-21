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
        self._stats = {
            "updateCalls": 0,
            "eventChanges": 0,
            "intervalSkips": 0,
            "serializationAttempts": 0,
            "unchangedPayloadSkips": 0,
            "builtinsWrites": 0,
            "domWrites": 0,
            "domWriteFailures": 0,
            "forcedWrites": 0,
            "heartbeatWrites": 0,
            "configuredActiveHz": heartbeat_hz,
            "lastWriteReason": None,
        }
        builtins.__dict__["__pa_state_publish_stats__"] = self._stats

    def tick(self, dt, state_dict):
        self._stats["updateCalls"] += 1
        self._accumulator += dt
        phase = state_dict.get("phase")
        phase_changed = phase is not None and phase != self._last_phase
        self._last_phase = phase

        if not phase_changed and self._accumulator < self._interval:
            self._stats["intervalSkips"] += 1
            return

        if phase_changed:
            self._stats["eventChanges"] += 1
            self._publish(state_dict, "event-change")
        else:
            self._stats["heartbeatWrites"] += 1
            self._publish(state_dict, "heartbeat")

        self._accumulator = 0.0

    def force_publish(self, state_dict):
        self._stats["forcedWrites"] += 1
        self._last_phase = state_dict.get("phase")
        self._accumulator = 0.0
        self._publish(state_dict, "forced")

    def _publish(self, state_dict, reason=None):
        self._stats["serializationAttempts"] += 1
        _gs_json = json.dumps(state_dict)
        if _gs_json == self._last_json:
            self._stats["unchangedPayloadSkips"] += 1
            return
        self._last_json = _gs_json
        self._stats["lastWriteReason"] = reason
        builtins.__dict__["__pa_game_state_json"] = _gs_json
        self._stats["builtinsWrites"] += 1
        try:
            import __EMSCRIPTEN__ as _pa_platform
            _pa_platform.window["pa-game-state"].innerText = _gs_json
            self._stats["domWrites"] += 1
        except Exception:
            self._stats["domWriteFailures"] += 1
