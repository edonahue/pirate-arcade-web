import json
import builtins

STATE_HEARTBEAT_HZ = 8
STATE_PUBLISH_INTERVAL = 1.0 / STATE_HEARTBEAT_HZ


class StatePublisher:
    def __init__(self, heartbeat_hz=STATE_HEARTBEAT_HZ):
        self._interval = 1.0 / heartbeat_hz
        self._accumulator = 0.0
        self._last_json = None
        self._last_event_key = None
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
            "stateFactoryCalls": 0,
            "statsSnapshotCalls": 0,
            "activeTicks": 0,
            "staticTicks": 0,
            "stateBuildSkips": 0,
        }
        builtins.__dict__["__pa_state_publish_stats__"] = self._stats
        builtins.__dict__["__pa_state_publisher__"] = self

    def tick(self, dt, event_key=None, state_factory=None, active=True):
        self._stats["updateCalls"] += 1
        self._accumulator += dt

        event_changed = event_key is not None and event_key != self._last_event_key
        if event_changed:
            self._last_event_key = event_key
            self._stats["eventChanges"] += 1
            self._accumulator = 0.0
            state_dict = state_factory() if state_factory else None
            if state_dict is not None:
                self._publish(state_dict, "event-change")
            return

        if not active:
            self._stats["staticTicks"] += 1
            self._stats["stateBuildSkips"] += 1
            return

        self._stats["activeTicks"] += 1

        if self._accumulator < self._interval:
            self._stats["intervalSkips"] += 1
            self._stats["stateBuildSkips"] += 1
            return

        self._accumulator = 0.0
        state_dict = state_factory() if state_factory else None
        if state_dict is not None:
            self._publish(state_dict, "heartbeat")

    def force_publish(self, state_factory=None, state_dict=None):
        self._stats["forcedWrites"] += 1
        self._accumulator = 0.0
        if state_dict is not None:
            self._publish(state_dict, "forced")
        elif state_factory is not None:
            state_dict = state_factory()
            if state_dict is not None:
                self._publish(state_dict, "forced")

    def stats_snapshot(self):
        self._stats["statsSnapshotCalls"] += 1
        builtins.__dict__["__pa_state_publish_stats_json__"] = json.dumps(self._stats)
        return self._stats

    def _publish(self, state_dict, reason=None):
        self._stats["serializationAttempts"] += 1
        self._stats["stateFactoryCalls"] += 1
        _gs_json = json.dumps({**state_dict, "__pa_stats": self._stats})
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
