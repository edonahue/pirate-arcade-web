import json
import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../scripts/pygbag-port"))

import builtins as _builtins

_B = _builtins.__dict__

from shared.pa_state import StatePublisher, STATE_PUBLISH_INTERVAL, STATE_HEARTBEAT_HZ

STATE_KEY = "__pa_game_state_json"


class TestStatePublisherLazyAPI(unittest.TestCase):
    def setUp(self):
        _B[STATE_KEY] = None
        # Remove any prior publisher ref
        _B.pop("__pa_state_publisher__", None)
        _B.pop("__pa_state_publish_stats__", None)
        _B.pop("__pa_state_publish_stats_json__", None)
        self.pub = StatePublisher()
        self.factory_calls = 0
        self.last_factory_arg = None

    def _make_factory(self, state_dict):
        def factory():
            self.factory_calls += 1
            return dict(state_dict)
        return factory

    def assert_published_value(self, key, expected):
        raw = _B.get(STATE_KEY)
        self.assertIsNotNone(raw, "expected state to be published")
        parsed = json.loads(raw)
        self.assertEqual(parsed.get(key), expected)

    def assert_not_published(self):
        self.assertIsNone(_B.get(STATE_KEY), "expected no publication")

    # ── Core lazy behavior ──

    def test_first_tick_invokes_factory_on_event_key_change(self):
        """First tick has no prior event_key, so event changes -> factory called."""
        factory = self._make_factory({"gameId": "t", "phase": "playing", "score": 0})
        self.pub.tick(0.01, event_key=("playing", 0), state_factory=factory, active=True)
        self.assertEqual(self.factory_calls, 1)
        self.assertIsNotNone(_B.get(STATE_KEY))

    def test_skipped_active_tick_does_not_invoke_factory(self):
        """Active tick before interval does not call factory."""
        factory = self._make_factory({"gameId": "t", "phase": "playing", "score": 0})
        self.pub.tick(0.01, event_key=("playing", 0), state_factory=factory, active=True)
        _B[STATE_KEY] = None
        self.factory_calls = 0
        self.pub.tick(0.05, event_key=("playing", 0), state_factory=factory, active=True)
        self.assertEqual(self.factory_calls, 0)
        self.assert_not_published()

    def test_skipped_static_tick_does_not_invoke_factory(self):
        """Static (active=False) tick does not call factory."""
        factory = self._make_factory({"gameId": "t", "phase": "menu", "score": 0})
        self.pub.tick(0.01, event_key=("menu", 0), state_factory=factory, active=True)
        self.factory_calls = 0
        _B[STATE_KEY] = None
        self.pub.tick(0.05, event_key=("menu", 0), state_factory=factory, active=False)
        self.assertEqual(self.factory_calls, 0)
        self.assert_not_published()

    def test_heartbeat_invokes_factory_once(self):
        """Active heartbeat interval triggers one factory call."""
        factory = self._make_factory({"gameId": "t", "phase": "playing", "score": 0})
        self.pub.tick(0.01, event_key=("playing", 0), state_factory=factory, active=True)
        self.factory_calls = 0
        _B[STATE_KEY] = None
        # Use a different state value to avoid dedup
        factory2 = self._make_factory({"gameId": "t", "phase": "playing", "score": 5})
        self.pub.tick(STATE_PUBLISH_INTERVAL, event_key=("playing", 0), state_factory=factory2, active=True)
        self.assertEqual(self.factory_calls, 1)
        self.assertIsNotNone(_B.get(STATE_KEY))
        self.assert_published_value("score", 5)

    def test_event_key_change_invokes_factory_immediately(self):
        """Event key change calls factory regardless of interval."""
        factory = self._make_factory({"gameId": "t", "phase": "playing", "score": 0})
        self.pub.tick(0.01, event_key=("playing", 0), state_factory=factory, active=True)
        self.factory_calls = 0
        _B[STATE_KEY] = None
        factory2 = self._make_factory({"gameId": "t", "phase": "playing", "score": 1})
        self.pub.tick(0.01, event_key=("playing", 1), state_factory=factory2, active=True)
        self.assertEqual(self.factory_calls, 1)
        self.assert_published_value("score", 1)

    def test_score_change_publishes_immediately(self):
        """Score change (in event key) triggers immediate publish."""
        factory = self._make_factory({"gameId": "t", "phase": "playing", "score": 0})
        self.pub.tick(0.01, event_key=("playing", 0), state_factory=factory, active=True)
        self.factory_calls = 0
        _B[STATE_KEY] = None
        factory2 = self._make_factory({"gameId": "t", "phase": "playing", "score": 5})
        self.pub.tick(0.01, event_key=("playing", 5), state_factory=factory2, active=True)
        self.assertEqual(self.factory_calls, 1)
        self.assert_published_value("score", 5)

    def test_lives_change_publishes_immediately(self):
        """Lives change (in event key) triggers immediate publish."""
        factory = self._make_factory({"gameId": "t", "phase": "playing", "lives": 3})
        self.pub.tick(0.01, event_key=("playing", 3), state_factory=factory, active=True)
        self.factory_calls = 0
        _B[STATE_KEY] = None
        factory2 = self._make_factory({"gameId": "t", "phase": "playing", "lives": 2})
        self.pub.tick(0.01, event_key=("playing", 2), state_factory=factory2, active=True)
        self.assertEqual(self.factory_calls, 1)
        self.assert_published_value("lives", 2)

    def test_launch_state_change_publishes_immediately(self):
        """ballLaunched change triggers immediate publish."""
        factory = self._make_factory({"gameId": "t", "phase": "playing", "ballLaunched": False})
        self.pub.tick(0.01, event_key=("playing", False), state_factory=factory, active=True)
        self.factory_calls = 0
        _B[STATE_KEY] = None
        factory2 = self._make_factory({"gameId": "t", "phase": "playing", "ballLaunched": True})
        self.pub.tick(0.01, event_key=("playing", True), state_factory=factory2, active=True)
        self.assertEqual(self.factory_calls, 1)
        self.assert_published_value("ballLaunched", True)

    def test_unchanged_static_state_remains_idle(self):
        """Static phase with unchanged event key stays idle."""
        factory = self._make_factory({"gameId": "t", "phase": "menu", "score": 0})
        self.pub.tick(0.01, event_key=("menu", 0), state_factory=factory, active=True)
        self.factory_calls = 0
        _B[STATE_KEY] = None
        for _ in range(100):
            self.pub.tick(0.016, event_key=("menu", 0), state_factory=factory, active=False)
        self.assertEqual(self.factory_calls, 0)
        self.assert_not_published()

    def test_force_publish_with_factory_invokes_once(self):
        """force_publish with factory argument calls it once."""
        factory = self._make_factory({"gameId": "t", "phase": "menu"})
        self.pub.force_publish(state_factory=factory)
        self.assertEqual(self.factory_calls, 1)
        self.assertIsNotNone(_B.get(STATE_KEY))

    def test_force_publish_with_dict_uses_directly(self):
        """force_publish with state_dict does not call factory."""
        factory = self._make_factory({"gameId": "t", "phase": "menu"})
        self.pub.force_publish(state_dict={"gameId": "t", "phase": "menu"})
        self.assertEqual(self.factory_calls, 0)
        self.assertIsNotNone(_B.get(STATE_KEY))

    def test_stats_included_in_published_payload(self):
        """Published JSON includes __pa_stats field with publisher counters."""
        factory = self._make_factory({"gameId": "t", "phase": "playing", "score": 0})
        self.pub.tick(0.01, event_key=("playing", 0), state_factory=factory, active=True)
        raw = _B.get(STATE_KEY)
        self.assertIsNotNone(raw)
        parsed = json.loads(raw)
        self.assertIn("__pa_stats", parsed)
        self.assertIsInstance(parsed["__pa_stats"]["updateCalls"], int)

    def test_every_publish_has_unique_stats(self):
        """Each publish produces unique __pa_stats (counters always increment)."""
        factory = self._make_factory({"gameId": "t", "phase": "playing", "score": 0})
        self.pub.tick(0.01, event_key=("playing", 0), state_factory=factory, active=True)
        factory2 = self._make_factory({"gameId": "t", "phase": "playing", "score": 0})
        self.pub.tick(STATE_PUBLISH_INTERVAL, event_key=("playing", 0), state_factory=factory2, active=True)
        # Both publishes went through because __pa_stats changed between them
        self.assertEqual(self.pub._stats["builtinsWrites"], 2)
        self.assertEqual(self.pub._stats["unchangedPayloadSkips"], 0)

    def test_large_dt_no_publication_burst(self):
        """Large dt value does not trigger multiple catch-up publications."""
        factory = self._make_factory({"gameId": "t", "phase": "playing", "score": 0})
        self.pub.tick(0.01, event_key=("playing", 0), state_factory=factory, active=True)
        self.factory_calls = 0
        _B[STATE_KEY] = None
        # A large dt should still only publish once (on next heartbeat tick)
        self.pub._accumulator = 0.0
        self.pub.tick(5.0, event_key=("playing", 0), state_factory=factory, active=True)
        # One heartbeat publish
        self.assertEqual(self.factory_calls, 1)

    def test_statistics_not_serialized_during_ordinary_ticks(self):
        """Stats JSON is NOT serialized during normal tick flow."""
        factory = self._make_factory({"gameId": "t", "phase": "playing", "score": 0})
        _B["__pa_state_publish_stats_json__"] = "INITIAL"
        self.pub.tick(0.01, event_key=("playing", 0), state_factory=factory, active=True)
        stats_json = _B.get("__pa_state_publish_stats_json__")
        self.assertEqual(stats_json, "INITIAL",
                         "tick should not update stats JSON")
        self.assertEqual(self.pub._stats["statsSnapshotCalls"], 0)

    def test_stats_snapshot_serializes_once(self):
        """stats_snapshot() serializes stats JSON and increments counter."""
        self.pub.stats_snapshot()
        self.assertEqual(self.pub._stats["statsSnapshotCalls"], 1)
        stats_json = _B.get("__pa_state_publish_stats_json__")
        self.assertIsNotNone(stats_json)
        parsed = json.loads(stats_json)
        self.assertEqual(parsed["statsSnapshotCalls"], 1)

    def test_counters_reconcile(self):
        """Multiple ticks produce consistent counter values."""
        factory = self._make_factory({"gameId": "t", "phase": "playing", "score": 0})
        # Initial tick with event change
        self.pub.tick(0.01, event_key=("playing", 0), state_factory=factory, active=True)
        # 3 skipped active ticks
        self.pub.tick(0.03, event_key=("playing", 0), state_factory=factory, active=True)
        self.pub.tick(0.03, event_key=("playing", 0), state_factory=factory, active=True)
        self.pub.tick(0.03, event_key=("playing", 0), state_factory=factory, active=True)
        # One heartbeat
        self.pub.tick(STATE_PUBLISH_INTERVAL, event_key=("playing", 0), state_factory=factory, active=True)
        s = self.pub._stats
        self.assertEqual(s["updateCalls"], 5)
        self.assertGreater(s["stateBuildSkips"], 0)
        self.assertGreater(s["stateFactoryCalls"], 0)
        self.assertGreater(s["activeTicks"], 0)
        self.assertEqual(s["staticTicks"], 0)

    def test_dom_failure_preserves_builtins_state(self):
        """DOM write failure does not prevent builtins assignment."""
        factory = self._make_factory({"gameId": "t", "phase": "playing", "score": 42})
        self.pub.tick(0.01, event_key=("playing", 42), state_factory=factory, active=True)
        self.assertIsNotNone(_B.get(STATE_KEY))
        parsed = json.loads(_B[STATE_KEY])
        self.assertEqual(parsed["score"], 42)

    def test_state_factory_not_called_when_no_factory_provided(self):
        """tick with no state_factory does not crash."""
        self.pub.tick(0.01, event_key=("playing", 0), active=True)
        self.assert_not_published()

    def test_empty_factory_returns_none_no_crash(self):
        """Factory returning None does not crash."""
        def none_factory():
            return None
        self.pub.tick(0.01, event_key=("playing", 0), state_factory=none_factory, active=True)
        self.assert_not_published()

    # ── Compatibility / existing behavior ──

    def test_default_heartbeat_hz(self):
        self.assertEqual(STATE_HEARTBEAT_HZ, 8)
        self.assertAlmostEqual(STATE_PUBLISH_INTERVAL, 0.125)

    def test_correct_json_structure(self):
        factory = self._make_factory({"gameId": "t", "phase": "playing", "score": 42})
        self.pub.tick(0.01, event_key=("playing", 42), state_factory=factory, active=True)
        self.assert_published_value("gameId", "t")
        self.assert_published_value("phase", "playing")
        self.assert_published_value("score", 42)

    def test_custom_heartbeat_rate(self):
        pub2 = StatePublisher(heartbeat_hz=2)
        pub2._last_event_key = ("playing", 0)
        factory = self._make_factory({"gameId": "t", "phase": "playing", "score": 0})
        pub2.tick(0.4, event_key=("playing", 0), state_factory=factory, active=True)
        self.assertIsNone(_B.get(STATE_KEY))
        self.assertEqual(self.factory_calls, 0)
        pub2.tick(0.2, event_key=("playing", 0), state_factory=factory, active=True)
        self.assertEqual(self.factory_calls, 1)
        self.assertIsNotNone(_B.get(STATE_KEY))

    def test_publishes_null_value(self):
        factory = self._make_factory({"gameId": "t", "phase": "playing", "value": None})
        self.pub.tick(0.01, event_key=("playing", None), state_factory=factory, active=True)
        self.assert_published_value("value", None)

    def test_force_publish_updates_event_key_tracking(self):
        """force_publish updates internal event_key tracking so next tick with same key skips."""
        factory = self._make_factory({"gameId": "t", "phase": "menu", "score": 0})
        self.pub.force_publish(state_dict={"gameId": "t", "phase": "menu", "score": 0})
        self.pub._last_event_key = ("menu", 0)
        _B[STATE_KEY] = None
        self.pub.tick(0.05, event_key=("menu", 0), state_factory=factory, active=False)
        self.assertEqual(self.factory_calls, 0)
        self.assert_not_published()

    def test_accumulator_resets_after_publish(self):
        factory = self._make_factory({"gameId": "t", "phase": "playing", "score": 0})
        self.pub.tick(0.01, event_key=("playing", 0), state_factory=factory, active=True)
        # accumulator was reset by event change publish
        self.factory_calls = 0
        _B[STATE_KEY] = None
        self.pub.tick(0.05, event_key=("playing", 0), state_factory=factory, active=True)
        self.assertEqual(self.factory_calls, 0)
        self.assert_not_published()

    def test_variable_phases_publish_on_key_change(self):
        factory = self._make_factory({"gameId": "t", "phase": "menu", "score": 0})
        self.pub.tick(0.125, event_key=("menu", 0), state_factory=factory, active=True)
        self.factory_calls = 0
        _B[STATE_KEY] = None
        factory2 = self._make_factory({"gameId": "t", "phase": "playing", "score": 0})
        self.pub.tick(0.01, event_key=("playing", 0), state_factory=factory2, active=True)
        self.assertEqual(self.factory_calls, 1)
        self.assert_published_value("phase", "playing")

    def test_stats_exposed_on_builtins(self):
        stats = _B.get("__pa_state_publish_stats__")
        self.assertIs(stats, self.pub._stats)

    def test_counters_exist_in_builtins(self):
        stats = _B.get("__pa_state_publish_stats__")
        self.assertIsNotNone(stats)
        self.assertEqual(stats["configuredActiveHz"], 8)

    def test_all_new_counters_present(self):
        stats = self.pub._stats
        for key in ("stateFactoryCalls", "statsSnapshotCalls", "activeTicks",
                     "staticTicks", "stateBuildSkips", "draws", "presentations"):
            self.assertIn(key, stats)
            self.assertIsInstance(stats[key], int)


if __name__ == "__main__":
    result = unittest.main(verbosity=2, exit=False)
    sys.exit(0 if result.result.wasSuccessful() else 1)
