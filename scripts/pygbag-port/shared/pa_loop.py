import builtins
import time

MONOTONIC_CLOCK = time.monotonic

STEP_S = 1.0 / 60
MAX_FRAME_S = 0.1
MAX_STEPS = 5
HIDDEN_YIELD_S = 0.05


class LoopMetrics:
    __slots__ = (
        "_m",
    )

    def __init__(self):
        self._m = {
            "outerLoops": 0,
            "simSteps": 0,
            "renderedFrames": 0,
            "presentCalls": 0,
            "staticDrawSkips": 0,
            "staticPresentSkips": 0,
            "hiddenIterations": 0,
            "cappedSteps": 0,
            "droppedTime": 0.0,
            "clampedFrames": 0,
        }

    def record_outer(self):
        self._m["outerLoops"] += 1

    def record_step(self):
        self._m["simSteps"] += 1

    def record_draw(self):
        self._m["renderedFrames"] += 1

    def record_present(self):
        self._m["presentCalls"] += 1

    def record_static_draw_skip(self):
        self._m["staticDrawSkips"] += 1

    def record_static_present_skip(self):
        self._m["staticPresentSkips"] += 1

    def record_hidden(self):
        self._m["hiddenIterations"] += 1

    def record_capped(self, count):
        self._m["cappedSteps"] += count

    def record_dropped(self, seconds):
        self._m["droppedTime"] += seconds

    def record_clamped_frame(self):
        self._m["clampedFrames"] += 1

    def snapshot(self):
        return dict(self._m)

    def reset(self):
        self._m = {k: 0 if isinstance(v, int) else 0.0 for k, v in self._m.items()}


class FixedStepTimer:
    def __init__(
        self,
        step_s=STEP_S,
        max_frame_s=MAX_FRAME_S,
        max_steps=MAX_STEPS,
        clock=MONOTONIC_CLOCK,
    ):
        self._step_s = step_s
        self._max_frame_s = max_frame_s
        self._max_steps = max_steps
        self._clock = clock
        self._accum = 0.0
        self._last_t = self._clock()
        self._metrics = LoopMetrics()
        self._paused = False

    def metrics(self):
        return self._metrics

    def pause(self):
        self._paused = True

    def resume(self):
        self._paused = False
        self._last_t = self._clock()
        self._accum = 0.0

    def begin_frame(self, active=True, hidden=False):
        now = self._clock()
        raw_elapsed = now - self._last_t
        self._last_t = now
        if raw_elapsed < 0:
            raw_elapsed = 0.0

        if hidden:
            self._metrics.record_hidden()
            return _FrameResult(0, self._step_s)

        if self._paused or not active:
            self._accum = 0.0
            return _FrameResult(0, self._step_s)

        if raw_elapsed > self._max_frame_s:
            self._metrics.record_clamped_frame()
            self._metrics.record_dropped(raw_elapsed - self._max_frame_s)
            raw_elapsed = self._max_frame_s

        self._accum += raw_elapsed
        steps = int((self._accum + 1e-9) / self._step_s)

        if steps > self._max_steps:
            self._metrics.record_capped(steps - self._max_steps)
            steps = self._max_steps

        self._accum -= steps * self._step_s
        if self._accum < 0:
            self._accum = 0.0

        self._metrics.record_outer()

        return _FrameResult(steps, self._step_s)


class _FrameResult:
    __slots__ = ("steps", "step_seconds")

    def __init__(self, steps, step_seconds):
        self.steps = steps
        self.step_seconds = step_seconds


class PresentGate:
    def __init__(self):
        self._last_draw_key = None
        self._last_present_key = None
        self._drew = False
        self._presented = False

    def check_draw(self, current_key, force=False):
        if force:
            self._last_draw_key = current_key
            self._drew = True
            return True
        if current_key != self._last_draw_key:
            self._last_draw_key = current_key
            self._drew = True
            return True
        self._drew = False
        return False

    def check_present(self, current_key, force=False):
        if force:
            self._last_present_key = current_key
            self._presented = True
            return True
        if self._drew:
            self._last_present_key = current_key
            self._presented = True
            return True
        if self._presented and current_key != self._last_present_key:
            self._last_present_key = current_key
            self._presented = True
            return True
        return False

    def drew_this_frame(self):
        return self._drew


def should_draw(current_key, last_draw_key):
    if current_key != last_draw_key:
        return True, current_key
    return False, last_draw_key


def page_hidden():
    return not builtins.__dict__.get("__pa_page_visible__", True)
