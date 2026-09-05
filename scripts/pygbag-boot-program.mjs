// Canonical Pygbag Python boot program generator.
// Single authoritative source for the embedded Python boot code.
// Consumed by: shell renderer, boot-contract validator, unit tests, mock harness.

import { ASSET_VERSION } from "./game-asset-versions.mjs";

// ── Canonical boot marks (Python-side) ────────────────────────
// Must match the actual marks emitted by renderPythonBootProgram().
export const BOOT_MARKS = [
  "boot-start",
  "pygame-install-start",
  "pygame-install-end",
  "archive-fetch-start",
  "archive-fetch-end",
  "dependencies-ready",
  "archive-extract-start",
  "archive-extract-end",
  "input-bridge-installed",
  "display-init-start",
  "display-init-end",
  "game-module-import-start",
  "game-module-import-end",
  "game-constructor-start",
  "game-constructor-end",
  "game-ready",
  "first-frame-presented",
];

// ── Canonical failure stage names ─────────────────────────────
export const FAILURE_STAGES = [
  "pygame-install",
  "archive-fetch",
  "archive-extract",
  "path-setup",
  "pygame-import",
  "display-init",
  "game-module-import",
  "game-construction",
  "game-loop",
];

// ── Generated-source schema version ───────────────────────────
export const GENERATED_SCHEMA_VERSION = 1;

// ── Critical ordering (must happen in this exact sequence) ────
// Archive + pygame tasks are created, data is captured from archive,
// then dependencies are awaited, extraction receives `data`, path setup,
// pygame import, display init, game module import, construction,
// game-ready, first-frame wrapper, game loop.
export const CRITICAL_ORDER = [
  "imports",
  "boot-function",
  "task-creation",
  "data-assignment",
  "dependency-await",
  "dependencies-ready",
  "archive-extraction",
  "path-setup",
  "pygame-import",
  "input-bridge",
  "display-init",
  "game-module-import",
  "game-constructor-start",
  "game-constructor-end",
  "game-ready",
  "first-frame-wrapper",
  "game-loop",
];

// ── Renderer ──────────────────────────────────────────────────

export function renderPythonBootProgram(config, archiveHash) {
  const source = generateSource(config, archiveHash);
  const hashParam = archiveHash ? `?h=${archiveHash}` : `?v=${ASSET_VERSION}`;
  const metadata = {
    schemaVersion: GENERATED_SCHEMA_VERSION,
    gameId: config.id,
    pythonModule: config.pythonModule,
    gameClass: config.gameClass,
    caption: config.caption,
    title: config.title,
    readyMessage: config.readyMessage,
    archiveUrl: `/play/${config.id}/${config.id}.tar.gz${hashParam}`,
    bootMarks: [...BOOT_MARKS],
    failureStages: [...FAILURE_STAGES],
  };
  return { source, metadata };
}

function generateSource(config, archiveHash) {
  const qs = archiveHash ? `?h=${archiveHash}` : `?v=${ASSET_VERSION}`;
  // ── Imports ──────────────────────────────────────────────────
  const imports = "import sys, asyncio, tarfile, io, os";

  // ── Boot function ────────────────────────────────────────────
  const bootFn = [
    "",
    "async def boot():",
    "    import __EMSCRIPTEN__ as platform",
    "    try:",
    "        _w = platform.window",
    "        _w.transfer.hidden = True",
    '        _w.canvas.style.visibility = "visible"',
    '        _w.PirateArcadeMetrics.mark("boot-start")',
    '        _w.PirateArcadeLoading.set("Starting game engine\u2026")',
    "",
    "        # Pre-install pygame wheel from CDN and fetch archive in parallel",
    '        _w.PirateArcadeLoading.set("Installing Pygame and downloading game package\u2026")',
    "        import aio.pep0723",
    '        url = _w.location.origin + "/play/' +
      config.id +
      "/" +
      config.id +
      ".tar.gz" +
      qs +
      '"',
    "        _w.PirateArcadeMetrics.setArchiveUrl(url)",
    "",
    "        async def install_pygame():",
    '            _w.PirateArcadeMetrics.mark("pygame-install-start")',
    '            _w.PirateArcadeMetrics.setBootStage("pygame-install")',
    '            await aio.pep0723.pip_install("pygame")',
    '            _w.PirateArcadeMetrics.mark("pygame-install-end")',
    "",
    "        async def fetch_archive():",
    '            _w.PirateArcadeMetrics.mark("archive-fetch-start")',
    '            _w.PirateArcadeMetrics.setBootStage("archive-fetch")',
    '            async with platform.fopen(url, "rb") as f:',
    "                data = f.read()",
    '                _w.PirateArcadeMetrics.mark("archive-fetch-end")',
    "                _w.PirateArcadeMetrics.setArchiveByteLength(len(data))",
    "                return data",
    "",
    "        archive_task = asyncio.create_task(fetch_archive())",
    "        pygame_task = asyncio.create_task(install_pygame())",
    "        data = await archive_task",
    "        await pygame_task",
    '        _w.PirateArcadeMetrics.mark("dependencies-ready")',
    "",
    '        _w.PirateArcadeMetrics.mark("archive-extract-start")',
    '        _w.PirateArcadeLoading.set("Extracting game files\u2026")',
    '        _w.PirateArcadeMetrics.setBootStage("archive-extract")',
    '        d = "/tmp/game_extract"',
    "        os.makedirs(d, exist_ok=True)",
    "        tarfile.open(fileobj=io.BytesIO(data)).extractall(d)",
    '        _w.PirateArcadeMetrics.mark("archive-extract-end")',
    "",
    '        _w.PirateArcadeMetrics.setBootStage("path-setup")',
    '        a = os.path.join(d, "assets")',
    "        sys.path.insert(0, a)",
    "        os.chdir(a)",
  ];

  // ── Pygame import + Input bridge ────────────────────────────
  bootFn.push(
    '        _w.PirateArcadeMetrics.setBootStage("pygame-import")',
    "        import pygame as pg",
    "        pg.display.init()",
    "        pg.font.init()",
    "",
    "        # Input bridge shim",
    "        import builtins",
    "        builtins.__pa_web_keys__ = set()",
    "        _orig_get_pressed = pg.key.get_pressed",
    "",
    "        class _PAWebKeyState:",
    "            def __init__(self, base):",
    "                self.base = base",
    "            def __getitem__(self, key):",
    "                try:",
    "                    web_down = key in builtins.__pa_web_keys__",
    "                    native = self.base is not None and self.base[key]",
    "                    return web_down or native",
    "                except Exception:",
    "                    return key in builtins.__pa_web_keys__",
    "            def __len__(self):",
    "                try: return len(self.base)",
    "                except Exception: return 0",
    "            def __iter__(self):",
    "                return iter(self.base)",
    "",
    "        def _pa_get_pressed():",
    "            return _PAWebKeyState(_orig_get_pressed())",
    "        pg.key.get_pressed = _pa_get_pressed",
    "",
    "        _KEY_MAP = {",
    '            "ArrowUp": pg.K_UP, "ArrowDown": pg.K_DOWN,',
    '            "ArrowLeft": pg.K_LEFT, "ArrowRight": pg.K_RIGHT,',
    '            "w": pg.K_w, "s": pg.K_s, "a": pg.K_a, "d": pg.K_d,',
    '            "Space": pg.K_SPACE, "Enter": pg.K_RETURN,',
    '            "Escape": pg.K_ESCAPE, "p": pg.K_p,',
    "        }",
    "",
    "        _key_count = 0",
    "        builtins.__pa_key_event_count__ = 0",
    "        builtins.__pa_last_key__ = None",
    "        builtins.__pa_last_key_down__ = False",
    "",
    "        def __pa_post_key(name, down):",
    "            key = _KEY_MAP.get(str(name))",
    "            if key is None:",
    "                return",
    "            nonlocal _key_count",
    "            _key_count += 1",
    "            builtins.__pa_key_event_count__ = _key_count",
    "            builtins.__pa_last_key__ = str(name)",
    "            builtins.__pa_last_key_down__ = down",
    "            if down:",
    "                builtins.__pa_web_keys__.add(key)",
    "                pg.event.post(pg.event.Event(pg.KEYDOWN, key=key))",
    "            else:",
    "                builtins.__pa_web_keys__.discard(key)",
    "                pg.event.post(pg.event.Event(pg.KEYUP, key=key))",
    "        builtins.__pa_post_key = __pa_post_key",
    "",
    "        # Touch target bridge shim",
    "        builtins.__pa_touch_axis__ = None",
    "        builtins.__pa_touch_value__ = None",
    "        builtins.__pa_touch_active__ = False",
    "        builtins.__pa_touch_event_count__ = 0",
    "        builtins.__pa_last_touch_axis__ = None",
    "        builtins.__pa_last_touch_value__ = None",
    "",
    "        def __pa_set_touch_target(axis, value, active):",
    "            builtins.__pa_touch_axis__ = str(axis)",
    "            builtins.__pa_touch_value__ = float(value)",
    "            builtins.__pa_touch_active__ = bool(active)",
    "            builtins.__pa_touch_event_count__ += 1",
    "            builtins.__pa_last_touch_axis__ = str(axis)",
    "            builtins.__pa_last_touch_value__ = float(value)",
    "        builtins.__pa_set_touch_target = __pa_set_touch_target",
    "",
    '        _w.PirateArcadeMetrics.mark("input-bridge-installed")',
    "",
    '        _w.PirateArcadeMetrics.setBootStage("display-init")',
    '        _w.PirateArcadeMetrics.mark("display-init-start")',
    '        _w.PirateArcadeLoading.set("Initializing display\u2026")',
    "        import constants as c",
    "        s = pg.display.set_mode((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))",
    '        pg.display.set_caption("' + config.caption + '")',
    '        _w.PirateArcadeMetrics.mark("display-init-end")',
    "",
    '        _w.PirateArcadeMetrics.setBootStage("game-module-import")',
    '        _w.PirateArcadeMetrics.mark("game-module-import-start")',
    "        from " + config.pythonModule + " import " + config.gameClass,
    '        _w.PirateArcadeMetrics.mark("game-module-import-end")',
    "",
    "        class WebAudio:",
    "            def __init__(self):",
    "                self._js = _w.PirateArcadeAudio",
    "                self._js.init()",
    "                self._muted = False",
    "            @property",
    "            def muted(self):",
    "                return self._muted",
    "            @muted.setter",
    "            def muted(self, val):",
    "                self._muted = val",
    "                self._js.setMuted(val)",
    "            def play(self, name, *a, **kw):",
    "                self._js.resume()",
    "                self._js.play(name)",
    "            def load(self, *a, **kw):",
    "                pass",
    "",
    '        _w.PirateArcadeMetrics.setBootStage("game-constructor")',
    '        _w.PirateArcadeMetrics.mark("game-constructor-start")',
    "        game = " + config.gameClass + "(s, WebAudio())",
    '        _w.PirateArcadeMetrics.mark("game-constructor-end")',
    '        _w.PirateArcadeMetrics.setBootStage("game-ready")',
    '        _w.PirateArcadeMetrics.mark("game-ready")',
    "        _w.PirateArcadeMetrics.computeDurations()",
    "",
  );

  // ── First-frame wrapper ────────────────────────────────────
  bootFn.push(
    "        # Wrap pg.display.flip and pg.display.update to detect first frame",
    "        _first_frame_done = []",
    "        _display_flip_orig = pg.display.flip",
    "        _display_update_orig = pg.display.update",
    "",
    "        def _on_first_frame():",
    "            if _first_frame_done:",
    "                return",
    "            _first_frame_done.append(True)",
    "            _w.PirateArcadeMetrics.markFirstFramePresented()",
    "            _w.PirateArcadeMetrics.computeDurations()",
    '            _w.PirateArcadeLoading.ready("' + config.readyMessage + '")',

    "        def _pa_flip(*args, **kw):",
    "            r = _display_flip_orig(*args, **kw)",
    "            _on_first_frame()",
    "            return r",
    "",
    "        def _pa_update(*args, **kw):",
    "            r = _display_update_orig(*args, **kw)",
    "            _on_first_frame()",
    "            return r",
    "",
    "        pg.display.flip = _pa_flip",
    "        pg.display.update = _pa_update",
    "",
    '        _w.PirateArcadeMetrics.setBootStage("first-frame")',
    "        _exit_result = None  # Initialize to default for mutation safety",
    "        _exit_result = await game.run()",
    "        _w.PirateArcadeMetrics.mark('game-exit-notice')",
    "        _w.PirateArcadeMetrics.setBootStage('game-exited')",
    "        if _exit_result == 'quit':",
    "            if hasattr(_w, 'PirateArcadeLifecycle') and _w.PirateArcadeLifecycle:",
    "                _w.PirateArcadeLifecycle.exitToArcade()",
    "            else:",
    "                _w.location.assign('/play/')",
    "    except Exception as e:",
    "        sys.print_exception(e)",
    "        msg = str(e) if str(e) else type(e).__name__",
    "        stage = _w.PirateArcadeMetrics.getBootStage() if _w.PirateArcadeMetrics else 'unknown'",
    "        _w.PirateArcadeMetrics.setFailedStage(stage, msg) if _w.PirateArcadeMetrics else None",
    '        _w.PirateArcadeLoading.error("Error: " + msg)',
  );

  // ── Footer ──────────────────────────────────────────────────
  const footer = ["", "asyncio.ensure_future(boot())"];

  // ── Manifest header ─────────────────────────────────────────
  const manifest = [
    "# Pirate Arcade generated Pygbag boot program",
    "# schema: " + GENERATED_SCHEMA_VERSION,
    "# game: " + config.id,
    "# module: " + config.pythonModule,
    "# class: " + config.gameClass,
  ];

  return (
    manifest.join("\n") +
    "\n" +
    imports +
    "\n" +
    bootFn.join("\n") +
    "\n" +
    footer.join("\n")
  );
}

// ── Shell source extraction ──────────────────────────────────

/**
 * Extract the Python boot source from a committed Pygbag shell HTML file.
 * The shell stores the source as a JS array: var gameCode = ["...",].join("")
 * Returns the reconstructed Python source, or null if the pattern isn't found.
 *
 * Note: The extracted content contains JS escape sequences (\n, \uXXXX, etc.)
 * because it reads the raw HTML text. For exact comparison against rendered
 * output, use the drift checker (check-pygbag-shell-drift.mjs) which compares
 * full rendered HTML against committed HTML.
 */
export function extractGameCodeFromShell(html) {
  const match = html.match(/var gameCode = \[([\s\S]*?)\]\.join\(/);
  if (!match) return null;
  // Parse the array elements (quoted strings with optional trailing comma)
  const raw = match[1];
  const lines = [];
  // Match quoted strings: "..." or '...'
  const stringRe = /["']((?:[^"'\\]|\\.)*)["']/g;
  let m;
  while ((m = stringRe.exec(raw)) !== null) {
    lines.push(m[1]);
  }
  return lines.join("");
}
