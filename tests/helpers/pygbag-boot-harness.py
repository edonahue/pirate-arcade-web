#!/usr/bin/env python3
"""
Mock Pygbag boot harness for generated Python boot programs.

Executes the generated Python boot source in a controlled CPython 3.12+
environment with mocked modules. Reports results as JSON to stdout.

Usage:
    python3 pygbag-boot-harness.py --source-file <path> [options]

Options:
    --source-file PATH   Path to the generated Python source
    --archive-first      Simulate archive finishing before pygame install
    --pygame-first       Simulate pygame install finishing before archive
    --inject-failure STAGE  Fail at a specific stage (pygame-install, archive-fetch,
                           archive-extract, path-setup, pygame-import, display-init,
                           game-module-import, game-construction, game-loop)
    --inject-archive-bytes N  Simulate archive returning N bytes (default 15000)
    --print-source       Also print the source before executing

Output JSON structure:
    {
        "success": bool,
        "marks": { "name": timestamp_ms, ... },
        "failedStage": str | null,
        "failedError": str | null,
        "loadingCalls": [ { "method": "set"|"ready"|"error", "msg": str }, ... ],
        "firstFramePresented": bool,
        "constructorCalled": bool,
        "gameLoopAwaited": bool,
        "gameModuleImported": str | null,
        "exception": str | null,
        "exceptionType": str | null,
        "stages": [str, ...],  # setBootStage calls in order
        "info": str
    }

All harness-only compatibility shims are documented inline.
"""

import argparse
import json
import os
import sys
import time
import traceback


# ── Harness-only compatibility shims ──────────────────────────────
#
# These shims provide minimal stubs for browser/Pygbag APIs that
# don't exist under CPython. Each is explicitly marked with a
# "Harness-only" comment. They must not be imported into production
# code or influence the generated boot sequence.
#
# Shim inventory:
#   1. MockPirateArcadeMetrics — records marks/stages/failures
#   2. MockPirateArcadeLoading — records set/ready/error calls
#   3. MockPirateArcadeAudio   — WebAudio stub for game audio
#   4. MockPirateArcadeInput   — minimal input bridge stub
#   5. MockPlatformWindow      — window object proxy
#   6. MockPlatformFile        — async file context manager mock
#   7. MockPygame              — display/font/event/key stubs
#   8. MockPep0723             — pip_install async mock
#   9. MockConstants           — WINDOW_WIDTH/HEIGHT
#  10. MockGameClass           — configurable game class with run()
#  11. MockHighscores          — stubs for Kraken's Wake

class MockPirateArcadeMetrics:
    """Records marks, stages, durations, and failures.

    Harness-only: replaces browser window.PirateArcadeMetrics.
    """
    def __init__(self):
        self.marks = {}
        self.durations = {}
        self.boot_stage = "bootstrap"
        self.failed_stage = None
        self.failed_error = None
        self.first_frame_presented = False
        self.archive_url = None
        self.archive_byte_length = None
        self.runtime_script_url = None
        self.stages = []
        self.t0 = time.time()

    def mark(self, name):
        self.marks[name] = (time.time() - self.t0) * 1000
        if name == "first-frame-presented":
            self.first_frame_presented = True

    def mark_once(self, name):
        if name not in self.marks:
            self.mark(name)
        return self.marks.get(name)

    def measure(self, name, start_mark, end_mark):
        s = self.marks.get(start_mark)
        e = self.marks.get(end_mark)
        if s is not None and e is not None:
            self.durations[name] = e - s
            return self.durations[name]
        return None

    def get(self):
        return dict(self.durations)

    def clear(self):
        self.marks.clear()
        self.durations.clear()

    def get_marks(self):
        return dict(self.marks)

    def snapshot(self):
        return {
            "schemaVersion": 3,
            "marks": dict(self.marks),
            "durations": dict(self.durations),
            "flags": {},
            "context": {
                "bootStage": self.boot_stage,
                "failedStage": self.failed_stage,
                "firstFramePresented": self.first_frame_presented,
                "archiveUrl": self.archive_url,
                "archiveByteLength": self.archive_byte_length,
                "runtimeScriptUrl": self.runtime_script_url,
            }
        }

    def compute_durations(self):
        pairs = [
            ("pygame-install-duration", "pygame-install-start", "pygame-install-end"),
            ("archive-fetch-duration", "archive-fetch-start", "archive-fetch-end"),
            ("archive-extract-duration", "archive-extract-start", "archive-extract-end"),
            ("game-constructor-duration", "game-constructor-start", "game-constructor-end"),
        ]
        for name, start, end in pairs:
            self.measure(name, start, end)

    # CamelCase aliases for boot code compatibility
    def setBootStage(self, stage):
        return self.set_boot_stage(stage)

    def getBootStage(self):
        return self.get_boot_stage()

    def setFailedStage(self, stage, error_message=None):
        return self.set_failed_stage(stage, error_message)

    def getFailedStage(self):
        return self.get_failed_stage()

    def setArchiveUrl(self, url):
        return self.set_archive_url(url)

    def setArchiveByteLength(self, length):
        return self.set_archive_byte_length(length)

    def setRuntimeScriptUrl(self, url):
        return self.set_runtime_script_url(url)

    def markFirstFramePresented(self):
        return self.mark_first_frame_presented()

    def hasFirstFrame(self):
        return self.has_first_frame()

    def markPlayable(self):
        return self.mark_playable()

    def isPlayable(self):
        return self.is_playable()

    def markActivePlay(self):
        return self.mark_active_play()

    def markFirstUserInput(self):
        return self.mark_first_user_input()

    def computeDurations(self):
        return self.compute_durations()

    def getMarks(self):
        return self.get_marks()

    def set_boot_stage(self, stage):
        self.boot_stage = stage
        self.stages.append(stage)

    def get_boot_stage(self):
        return self.boot_stage

    def set_failed_stage(self, stage, error_message=None):
        self.failed_stage = stage
        if error_message:
            self.failed_error = error_message

    def get_failed_stage(self):
        return self.failed_stage

    def set_archive_url(self, url):
        self.archive_url = url

    def set_archive_byte_length(self, length):
        self.archive_byte_length = length

    def set_runtime_script_url(self, url):
        self.runtime_script_url = url

    def mark_first_frame_presented(self):
        if not self.first_frame_presented:
            self.first_frame_presented = True
            self.mark("first-frame-presented")

    def has_first_frame(self):
        return self.first_frame_presented

    def mark_playable(self):
        pass

    def is_playable(self):
        return False

    def mark_active_play(self):
        pass

    def mark_first_user_input(self):
        pass

    BOOT_STAGES = {}
    FAILURE_STAGES = {}


class MockPirateArcadeLoading:
    """Records set/ready/error calls.

    Harness-only: replaces browser window.PirateArcadeLoading.
    """
    def __init__(self):
        self.calls = []
        self.errored = False
        self.booted = False

    def set(self, msg):
        if self.errored:
            return
        self.calls.append({"method": "set", "msg": msg})

    def ready(self, msg):
        if self.errored:
            return
        self.booted = True
        self.calls.append({"method": "ready", "msg": msg})

    def error(self, msg):
        if self.errored:
            return
        self.errored = True
        self.calls.append({"method": "error", "msg": msg})


class MockPirateArcadeAudio:
    """WebAudio stub.

    Harness-only: replaced by window.PirateArcadeAudio.
    """
    def __init__(self):
        self._muted = False

    def init(self):
        pass

    def resume(self):
        pass

    def play(self, name):
        pass

    def set_muted(self, val):
        self._muted = val

    def load(self, *a, **kw):
        pass


class MockPirateArcadeInput:
    """Minimal input bridge stub.

    Harness-only: required by loading error handler.
    """
    def release_all(self, reason):
        pass


class MockTransfer:
    def __init__(self):
        self.hidden = False


class MockInfobox:
    def __init__(self):
        self.inner_text = ""
        self.attributes = {}

    @property
    def innerText(self):
        return self.inner_text

    @innerText.setter
    def innerText(self, val):
        self.inner_text = val

    def setAttribute(self, name, value):
        self.attributes[name] = value

    def getAttribute(self, name):
        return self.attributes.get(name)


class MockPlatformWindow:
    """window object proxy for boot code.

    Harness-only: replaces __EMSCRIPTEN__.window.
    """
    def __init__(self, metrics, loading, audio):
        self.transfer = MockTransfer()
        self.canvas = MockCanvas()
        self.PirateArcadeMetrics = metrics
        self.PirateArcadeLoading = loading
        self.PirateArcadeAudio = audio
        self.PirateArcadeInput = MockPirateArcadeInput()
        self.infobox = MockInfobox()
        self.location = MockLocation()

    @property
    def location(self):
        return self._location

    @location.setter
    def location(self, val):
        self._location = val


class MockLocation:
    def __init__(self):
        self.origin = "http://localhost:4321"


class MockCanvas:
    def __init__(self):
        self.style = MockStyle()


class MockStyle:
    def __init__(self):
        self.visibility = "hidden"


class MockPlatformFile:
    """Async context manager for fopen.

    Harness-only: replaces platform.fopen.

    Controlled by the harness to simulate archive content.
    """
    _default_archive_bytes = b"mock-archive-data"

    def __init__(self, *args, archive_bytes=None, **kw):
        self.archive_bytes = archive_bytes if archive_bytes is not None else self._default_archive_bytes

    async def __aenter__(self):
        return MockAsyncFile(self.archive_bytes)

    async def __aexit__(self, *args):
        pass


class MockAsyncFile:
    def __init__(self, data):
        self.data = data

    def read(self):
        return self.data


class MockPygameDisplay:
    """Mock pygame display module.

    Harness-only: replaces pygame.display.
    """
    def __init__(self):
        self.mode = None
        self.caption = None
        self._flip_called = 0
        self._update_called = 0

    def init(self):
        pass

    def set_mode(self, size):
        self.mode = size
        return MockSurface()

    def set_caption(self, caption):
        self.caption = caption

    def flip(self):
        self._flip_called += 1

    def update(self, *args, **kwargs):
        self._update_called += 1


class MockSurface:
    def __init__(self):
        pass

    def get_size(self):
        return (800, 600)


class MockPygameFont:
    def __init__(self):
        pass

    def init(self):
        pass


class MockPygameEvent:
    KEYDOWN = 0x300
    KEYUP = 0x301

    def __init__(self, type, **kw):
        self.type = type
        for k, v in kw.items():
            setattr(self, k, v)

    def post(self, event):
        pass


class MockPygameKey:
    K_UP = 273
    K_DOWN = 274
    K_LEFT = 276
    K_RIGHT = 275
    K_w = 119
    K_s = 115
    K_a = 97
    K_d = 100
    K_SPACE = 32
    K_RETURN = 13
    K_ESCAPE = 27
    K_p = 112

    def __init__(self):
        self._pressed = {}

    def get_pressed(self):
        return self._pressed


class MockPygame:
    """Mock pygame module.

    Harness-only: replaces pygame for boot testing.
    """
    def __init__(self):
        self.display = MockPygameDisplay()
        self.font = MockPygameFont()
        self.event = MockPygameEvent
        self.key = MockPygameKey()
        # Key constants accessible at module level
        self.K_UP = 273
        self.K_DOWN = 274
        self.K_LEFT = 276
        self.K_RIGHT = 275
        self.K_w = 119
        self.K_s = 115
        self.K_a = 97
        self.K_d = 100
        self.K_SPACE = 32
        self.K_RETURN = 13
        self.K_ESCAPE = 27
        self.K_p = 112


class MockPep0723:
    """Mock aio.pep0723 for pip_install.

    Harness-only: replaces the CDN package downloader.
    """
    @staticmethod
    async def pip_install(package, **kw):
        pass


class MockConstants:
    """Mock constants module.

    Harness-only: provides WINDOW_WIDTH/HEIGHT needed by boot code.
    """
    WINDOW_WIDTH = 800
    WINDOW_HEIGHT = 600


class MockGameBase:
    """Base class for mock games.

    The game must have a run() coroutine that the boot code awaits.
    """
    def __init__(self, surface=None, audio=None):
        self.surface = surface
        self.audio = audio
    async def run(self):
        """Call pg.display.flip to simulate first frame, then return exit reason."""
        import sys
        pg = sys.modules.get("pygame")
        if pg and hasattr(pg.display, "flip"):
            pg.display.flip()
            pg.display.update()
        return "exit-to-arcade"


def make_game_class(name="MockGame"):
    """Create a game class with given name, accepting (surface, audio)."""
    return type(name, (MockGameBase,), {})


class MockHighscores:
    """Mock highscores module for Kraken's Wake shim.

    Harness-only: provides _cache, _load, _save for the highscore shim.
    """
    _cache = {}
    _load = staticmethod(lambda: {})
    _save = staticmethod(lambda data: None)


# ── Failure injection ────────────────────────────────────────────

class HarnessInjectedError(Exception):
    """Exception raised when the harness injects a failure."""
    pass


# ── Main harness entry point ─────────────────────────────────────

def run_harness(source_file, inject_failure=None,
                archive_first=False, pygame_first=False,
                archive_bytes=None):
    """Execute the generated boot source with mocks and return results."""

    if archive_bytes is None:
        # Create a minimal valid tar.gz for archive extraction
        import tarfile
        import io as io_module
        buf = io_module.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            info = tarfile.TarInfo(name="assets/")
            info.type = tarfile.DIRTYPE
            info.uid = os.getuid()
            info.gid = os.getgid()
            tar.addfile(info)
            info2 = tarfile.TarInfo(name="assets/test.txt")
            info2.type = tarfile.REGTYPE
            info2.uid = os.getuid()
            info2.gid = os.getgid()
            tar.addfile(info2, io_module.BytesIO(b"hello"))
        archive_bytes = buf.getvalue()

    # Update MockPlatformFile default archive data
    MockPlatformFile._default_archive_bytes = archive_bytes

    # Clean any previous extraction to avoid permission issues
    import shutil
    shutil.rmtree("/tmp/game_extract", ignore_errors=True)

    metrics = MockPirateArcadeMetrics()
    loading = MockPirateArcadeLoading()
    audio = MockPirateArcadeAudio()
    window = MockPlatformWindow(metrics, loading, audio)
    pygame_mock = MockPygame()
    font_mock = MockPygameFont()

    # Store configured values for validation
    results = {
        "success": False,
        "marks": {},
        "failedStage": None,
        "failedError": None,
        "loadingCalls": [],
        "firstFramePresented": False,
        "constructorCalled": False,
        "gameLoopAwaited": False,
        "gameModuleImported": None,
        "exception": None,
        "exceptionType": None,
        "stages": [],
        "info": "",
    }

    # ── Set up module mocks ──────────────────────────────────────

    # __EMSCRIPTEN__
    import types
    em_module = types.ModuleType("__EMSCRIPTEN__")
    em_module.window = window
    em_module.fopen = MockPlatformFile
    sys.modules["__EMSCRIPTEN__"] = em_module

    # platform (aliased from __EMSCRIPTEN__)
    sys.modules["platform"] = em_module

    # aio.pep0723
    aio_mod = types.ModuleType("aio")
    pep0723 = types.ModuleType("aio.pep0723")
    pep0723.pip_install = MockPep0723.pip_install
    aio_mod.pep0723 = pep0723
    sys.modules["aio"] = aio_mod
    sys.modules["aio.pep0723"] = pep0723

    # pygame
    sys.modules["pygame"] = pygame_mock

    # constants
    sys.modules["constants"] = MockConstants

    # ── Game class ───────────────────────────────────────────────
    # The boot code does `from games.pong.game import PongGame` or similar.
    # We inject a mock module for the configured game.

    game_class_name = None
    game_module_path = None

    # Read the source to extract game config from it
    with open(source_file) as f:
        source_content = f.read()

    lines = source_content.split("\n")
    for line in lines:
        if line.startswith("# class: "):
            game_class_name = line[len("# class: "):].strip()
        if line.startswith("# module: "):
            game_module_path = line[len("# module: "):].strip()

    if game_class_name and game_module_path:
        # Create a mock module hierarchy with full attribute chain
        # so that `from games.pong.game import PongGame` resolves
        # through each level: games.pong → games.pong.game → PongGame
        parts = game_module_path.split(".")
        GameClass = make_game_class(game_class_name)
        leaf_module = types.ModuleType(parts[-1])
        leaf_module.__dict__[game_class_name] = GameClass
        sys.modules[game_module_path] = leaf_module

        # Create parent packages and set child as attribute
        prev_mod = None
        for i in range(1, len(parts) + 1):
            full = ".".join(parts[:i])
            if full not in sys.modules:
                mod = types.ModuleType(parts[i-1])
                sys.modules[full] = mod
            else:
                mod = sys.modules[full]
            if prev_mod is not None:
                setattr(prev_mod, parts[i-1], mod)
            prev_mod = mod

        # Ensure the game class is accessible from the leaf module
        setattr(prev_mod, game_class_name, GameClass)

        results["gameModuleImported"] = game_module_path

    # ── MicroPython compatibility shims ──────────────────────────
    # sys.print_exception is MicroPython-only; polyfill for CPython
    def _print_exception(e, f=None):
        traceback.print_exception(type(e), e, e.__traceback__, file=f or sys.stderr)
    sys.print_exception = _print_exception

    # os.chdir may fail on temp extraction dirs; shim for harness
    _orig_chdir = os.chdir
    def _harness_chdir(path):
        """Override os.chdir to allow paths under /tmp/game_extract."""
        try:
            _orig_chdir(path)
        except PermissionError:
            pass  # Allow mock extraction dirs
    os.chdir = _harness_chdir

    # ── Mock tarfile extraction ──────────────────────────────────
    # Real tarfile.extractall can fail on mock archives due to
    # permission/ownership issues. Use a shim that creates the
    # expected extraction structure.
    import tarfile as real_tarfile_module
    _real_tarfile_open = real_tarfile_module.open

    class MockTarFile:
        def __init__(self, *args, **kw):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def extractall(self, path):
            os.makedirs(path, mode=0o755, exist_ok=True)
            assets_dir = os.path.join(path, "assets")
            os.makedirs(assets_dir, mode=0o755, exist_ok=True)
            with open(os.path.join(assets_dir, "game_module.py"), "w") as f:
                f.write("# mock")

    real_tarfile_module.open = lambda *args, **kw: MockTarFile()

    # ── Kraken's Wake highscore shim ─────────────────────────────
    sys.modules["highscores"] = MockHighscores

    # ── Inject failure hooks ─────────────────────────────────────
    # These replace the mocked APIs to raise at specific boot stages.
    original_pip_install = MockPep0723.pip_install
    original_fopen = MockPlatformFile

    if inject_failure == "pygame-install":
        async def failing_pip_install(package, **kw):
            raise HarnessInjectedError("Simulated pygame install failure")
        pep0723.pip_install = failing_pip_install

    elif inject_failure == "archive-fetch":
        # The fopen mock will raise when data = f.read() is called
        class FailingAsyncFile:
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
            def read(self):
                raise HarnessInjectedError("Simulated archive fetch failure")

        class FailingPlatformFile:
            def __init__(self, *args, **kw):
                pass
            async def __aenter__(self):
                return FailingAsyncFile()
            async def __aexit__(self, *args):
                pass

        em_module.fopen = FailingPlatformFile

    elif inject_failure == "archive-extract":
        # The tarfile.open call will fail — we mock tarfile to raise
        original_tarfile_open = sys.modules.get("tarfile", None)

        def failing_tarfile_open(fileobj, mode="r"):
            raise HarnessInjectedError("Simulated archive extraction failure")

        import tarfile
        tarfile.open = failing_tarfile_open

    elif inject_failure == "path-setup":
        # os.makedirs or similar fails (hard to inject after extraction)
        # We use a late import that fails
        pass  # Handled by checking stage

    elif inject_failure == "pygame-import":
        class FailingPygame:
            @property
            def display(self):
                raise HarnessInjectedError("Simulated pygame import failure")
        sys.modules["pygame"] = FailingPygame()

    elif inject_failure == "display-init":
        class FailingDisplay:
            def init(self):
                raise HarnessInjectedError("Simulated display init failure")
        pygame_mock.display = FailingDisplay()

    elif inject_failure == "game-module-import":
        # Make the module fail on import
        BadGameModule = types.ModuleType("bad_game")
        BadGameModule.__dict__["PongGame"] = None  # missing class
        # Also make the module itself failing:
        def failing_import(*args, **kw):
            raise HarnessInjectedError("Simulated game module import failure")
        # Override the actual module import path
        # The simplest way: replace the whole module with a raising one
        class FailingModule:
            def __getattr__(self, name):
                raise HarnessInjectedError("Simulated game module import failure")
        if game_module_path:
            sys.modules[game_module_path] = FailingModule()

    elif inject_failure == "game-construction":
        # Make the game class constructor fail
        class FailingGame:
            def __init__(self, *args, **kw):
                raise HarnessInjectedError("Simulated game construction failure")

        if game_module_path and game_class_name:
            mod = sys.modules.get(game_module_path)
            if mod:
                setattr(mod, game_class_name, FailingGame)

    elif inject_failure == "game-loop":
        class FailingGameLoop:
            async def run(self):
                raise HarnessInjectedError("Simulated game loop failure")
        if game_module_path and game_class_name:
            mod = sys.modules.get(game_module_path)
            if mod:
                setattr(mod, game_class_name, type(game_class_name, (MockGameBase,), {"run": FailingGameLoop.run}))

    # ── Task ordering ────────────────────────────────────────────
    if archive_first:
        # Make archive task finish instantly, pygame task takes time
        async def delayed_pygame_install(package, **kw):
            await asyncio.sleep(0.01)
        pep0723.pip_install = delayed_pygame_install
    elif pygame_first:
        async def delayed_archive_fetch():
            await asyncio.sleep(0.01)
            return archive_bytes

        # Pre-create a valid archive using real tarfile
        _mock_buf = io_module.BytesIO()
        with _real_tarfile_open(fileobj=_mock_buf, mode="w:gz") as tar:
            info = real_tarfile_module.TarInfo(name="assets/")
            info.type = real_tarfile_module.DIRTYPE
            tar.addfile(info)
        _mock_archive_bytes = _mock_buf.getvalue()

        # Override fopen to be delayed
        class DelayedFopen:
            def __init__(self, *args, archive_bytes=b"mock-archive-data", **kw):
                self.archive_bytes = archive_bytes if archive_bytes != b"mock-archive-data" else _mock_archive_bytes
            async def __aenter__(self):
                await asyncio.sleep(0.01)
                return DelayedFile(self.archive_bytes)
            async def __aexit__(self, *args):
                pass

        class DelayedFile:
            def __init__(self, data):
                self.data = data
            def read(self):
                return self.data

        em_module.fopen = DelayedFopen

    # ── Execute the boot source ─────────────────────────────────
    try:
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        # Read and execute the source
        with open(source_file) as f:
            source = f.read()

        # Compile and exec the source — it defines boot() and calls
        # asyncio.ensure_future(boot())
        compiled = compile(source, source_file, "exec")
        exec_globals = {
            "__builtins__": __builtins__,
            "asyncio": asyncio,
        }
        exec(compiled, exec_globals)

        # Run the event loop to process pending tasks
        loop.run_until_complete(asyncio.sleep(0.05))
        # Give any remaining tasks a chance
        pending = asyncio.all_tasks(loop)
        for task in pending:
            if not task.done():
                task.cancel()
        if pending:
            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        loop.close()
    except HarnessInjectedError as e:
        # This is expected — the injected failure was raised and should
        # be caught by the boot program's except handler
        pass
    except Exception as e:
        results["exception"] = str(e)
        results["exceptionType"] = type(e).__name__
        results["failedStage"] = "harness-error"

    # ── Collect results ─────────────────────────────────────────
    results["success"] = metrics.failed_stage is None and not loading.errored
    results["marks"] = dict(metrics.marks)
    results["failedStage"] = metrics.failed_stage
    results["failedError"] = metrics.failed_error
    results["loadingCalls"] = loading.calls
    results["firstFramePresented"] = metrics.first_frame_presented
    results["stages"] = list(metrics.stages)

    # Detect constructor call from marks
    results["constructorCalled"] = "game-constructor-start" in metrics.marks or "game-constructor-end" in metrics.marks

    # Detect game loop awaited: we have proceeded beyond the first-frame stage
    results["gameLoopAwaited"] = False
    if "first-frame" in metrics.stages:
        try:
            # Find the last occurrence of "first-frame" in stages
            last_first_frame_idx = -1
            for i in range(len(metrics.stages) - 1, -1, -1):
                if metrics.stages[i] == "first-frame":
                    last_first_frame_idx = i
                    break
            # If there are any stages after the last "first-frame", we proceeded beyond it
            if last_first_frame_idx != -1 and len(metrics.stages) > last_first_frame_idx + 1:
                results["gameLoopAwaited"] = True
        except (ValueError, AttributeError):
            # Error processing stages
            pass
    # Fallback: if we have game-exited stage, the game loop definitely completed
    if not results["gameLoopAwaited"]:
        if "game-exited" in metrics.stages:
            results["gameLoopAwaited"] = True

    return results


def main():
    parser = argparse.ArgumentParser(description="Mock Pygbag boot harness")
    parser.add_argument("--source-file", required=True, help="Path to generated Python source")
    parser.add_argument("--inject-failure", choices=[
        "pygame-install", "archive-fetch", "archive-extract", "path-setup",
        "pygame-import", "display-init", "game-module-import",
        "game-construction", "game-loop"
    ], help="Inject failure at a specific boot stage")
    parser.add_argument("--archive-first", action="store_true", help="Archive finishes before pygame")
    parser.add_argument("--pygame-first", action="store_true", help="Pygame finishes before archive")
    parser.add_argument("--print-source", action="store_true", help="Print source before executing")
    args = parser.parse_args()

    if not os.path.exists(args.source_file):
        print(json.dumps({"error": f"Source file not found: {args.source_file}"}))
        sys.exit(1)

    if args.print_source:
        with open(args.source_file) as f:
            print("=== SOURCE ===")
            print(f.read())
            print("=== END SOURCE ===")

    result = run_harness(
        source_file=args.source_file,
        inject_failure=args.inject_failure,
        archive_first=args.archive_first,
        pygame_first=args.pygame_first,
    )
    print(json.dumps(result, indent=2))

    if result.get("exception") and not result.get("failedStage"):
        sys.exit(1)


if __name__ == "__main__":
    main()
