// Pygbag HTML shell template renderer
// Consumes game config objects from pygbag-game-config.mjs

import { archiveUrl } from "./pygbag-game-config.mjs";
import { ASSET_VERSION } from "./game-asset-versions.mjs";

// ── Touch overlay partials ────────────────────────────────────

function touchOverlayPong() {
  return `<div class="touch-overlay" id="touch-overlay" data-controls="pong">
      <div class="touch-drag-zone touch-drag-y" data-dir="drag-y" role="slider" aria-label="Slide ship up or down"></div>
      <div class="btn btn-nudge btn-up" data-dir="left">\u25b2</div>
      <div class="btn btn-nudge btn-down" data-dir="right">\u25bc</div>
      <div class="btn btn-action" data-dir="action" role="button" aria-label="Start game">START</div>
      <div class="btn btn-pause" data-dir="pause" role="button" aria-label="Pause">\u275a\u275a</div>
    </div>`;
}

function touchOverlayBreakout() {
  return `<div class="touch-overlay" id="touch-overlay" data-controls="breakout">
      <div class="touch-drag-zone touch-drag-x" data-dir="drag-x" role="slider" aria-label="Slide longboat left or right"></div>
      <div class="btn btn-nudge btn-left" data-dir="left">\u25c0</div>
      <div class="btn btn-nudge btn-right" data-dir="right">\u25b6</div>
      <div class="btn btn-action" data-dir="action" role="button" aria-label="Launch ball">LAUNCH</div>
      <div class="btn btn-pause" data-dir="pause" role="button" aria-label="Pause">\u275a\u275a</div>
    </div>`;
}

function touchOverlayAsteroids() {
  return `<div class="touch-overlay" id="touch-overlay" data-controls="asteroids">
      <div class="btn btn-arrow btn-left" data-dir="left">\u25c0</div>
      <div class="btn btn-arrow btn-right" data-dir="right">\u25b6</div>
      <div class="btn btn-action" data-dir="action">\u23ce</div>
      <div class="btn btn-pause" data-dir="pause">\u275a\u275a</div>
      <div class="btn btn-menu-up" data-dir="up">\u25b2</div>
      <div class="btn btn-menu-down" data-dir="down">\u25bc</div>
      <div class="btn btn-thrust" data-dir="thrust">THRUST</div>
      <div class="btn btn-fire" data-dir="fire">FIRE</div>
    </div>`;
}

const TOUCH_OVERLAYS = {
  pong: touchOverlayPong,
  breakout: touchOverlayBreakout,
  asteroids: touchOverlayAsteroids,
};

// ── Python boot code generator ────────────────────────────────

function renderPythonBootCode(config) {
  const lines = [];

  lines.push("import sys, asyncio, tarfile, io, os");
  lines.push("");
  lines.push("async def boot():");
  lines.push("    import __EMSCRIPTEN__ as platform");
  lines.push("    try:");
  lines.push("        _w = platform.window");
  lines.push("        _w.transfer.hidden = True");
  lines.push('        _w.canvas.style.visibility = "visible"');
  lines.push('        _w.PirateArcadeMetrics.mark("boot-start")');
  lines.push(
    '        _w.PirateArcadeLoading.set("Starting game engine\u2026")',
  );
  lines.push("");
  lines.push(
    "        # Pre-install pygame wheel from CDN and fetch archive in parallel",
  );
  lines.push('        _w.PirateArcadeMetrics.mark("pygame-install-start")');
  lines.push('        _w.PirateArcadeMetrics.mark("archive-fetch-start")');
  lines.push(
    '        _w.PirateArcadeLoading.set("Installing Pygame and downloading game package\u2026")',
  );
  lines.push("        import aio.pep0723");
  lines.push(
    '        url = _w.location.href + "' +
      config.id +
      ".tar.gz?v=" +
      ASSET_VERSION +
      '"',
  );
  lines.push("        async def fetch_archive():");
  lines.push('            async with platform.fopen(url, "rb") as f:');
  lines.push("                return f.read()");
  lines.push("        archive_task = asyncio.create_task(fetch_archive())");
  lines.push('        await aio.pep0723.pip_install("pygame")');
  lines.push("        data = await archive_task");
  lines.push('        _w.PirateArcadeMetrics.mark("pygame-install-end")');
  lines.push('        _w.PirateArcadeMetrics.mark("archive-fetch-end")');
  lines.push("");
  lines.push('        _w.PirateArcadeMetrics.mark("archive-extract-start")');
  lines.push(
    '        _w.PirateArcadeLoading.set("Extracting game files\u2026")',
  );
  lines.push('        d = "/tmp/game_extract"');
  lines.push("        os.makedirs(d, exist_ok=True)");
  lines.push("        tarfile.open(fileobj=io.BytesIO(data)).extractall(d)");
  lines.push('        _w.PirateArcadeMetrics.mark("archive-extract-end")');
  lines.push("");
  lines.push('        a = os.path.join(d, "assets")');
  lines.push("        sys.path.insert(0, a)");
  lines.push("        os.chdir(a)");

  // Kraken's Wake highscores shim
  if (config.hasHighscoresShim) {
    lines.push("");
    lines.push("        # Init pygame display, then import game modules");
    lines.push("");
    lines.push(
      "        # Browser FS: ~/.local/share/pirate-arcade/ may not be writable.",
    );
    lines.push(
      "        # The desktop highscores.py tries to persist scores there; in the",
    );
    lines.push(
      "        # browser that path can fail (Emscripten FS quirks). Disable saving",
    );
    lines.push(
      "        # and treat the cache as empty so submit_asteroids()/get_high() are",
    );
    lines.push(
      "        # no-ops for the lifetime of the page. The menu still shows",
    );
    lines.push(
      '        # "Best: ..." only when a real high score is present in the cache.',
    );
    lines.push("        try:");
    lines.push("            import highscores as hs");
    lines.push("            hs._cache = {}");
    lines.push("            hs._load = lambda: {}");
    lines.push("            hs._save = lambda data: None");
    lines.push("        except Exception:");
    lines.push("            pass");
    lines.push("");
  }

  lines.push("        import pygame as pg");
  lines.push("        pg.display.init()");
  lines.push("        pg.font.init()");
  lines.push("");
  lines.push("        # Input bridge shim");
  lines.push("        import builtins");
  lines.push("        builtins.__pa_web_keys__ = set()");
  lines.push("        _orig_get_pressed = pg.key.get_pressed");
  lines.push("");
  lines.push("        class _PAWebKeyState:");
  lines.push("            def __init__(self, base):");
  lines.push("                self.base = base");
  lines.push("            def __getitem__(self, key):");
  lines.push("                try:");
  lines.push("                    web_down = key in builtins.__pa_web_keys__");
  lines.push(
    "                    native = self.base is not None and self.base[key]",
  );
  lines.push("                    return web_down or native");
  lines.push("                except Exception:");
  lines.push("                    return key in builtins.__pa_web_keys__");
  lines.push("            def __len__(self):");
  lines.push("                try: return len(self.base)");
  lines.push("                except Exception: return 0");
  lines.push("            def __iter__(self):");
  lines.push("                return iter(self.base)");
  lines.push("");
  lines.push("        def _pa_get_pressed():");
  lines.push("            return _PAWebKeyState(_orig_get_pressed())");
  lines.push("        pg.key.get_pressed = _pa_get_pressed");
  lines.push("");
  lines.push("        _KEY_MAP = {");
  lines.push('            "ArrowUp": pg.K_UP, "ArrowDown": pg.K_DOWN,');
  lines.push('            "ArrowLeft": pg.K_LEFT, "ArrowRight": pg.K_RIGHT,');
  lines.push('            "w": pg.K_w, "s": pg.K_s, "a": pg.K_a, "d": pg.K_d,');
  lines.push('            "Space": pg.K_SPACE, "Enter": pg.K_RETURN,');
  lines.push('            "Escape": pg.K_ESCAPE, "p": pg.K_p,');
  lines.push("        }");
  lines.push("");
  lines.push("        _key_count = 0");
  lines.push("        builtins.__pa_key_event_count__ = 0");
  lines.push("        builtins.__pa_last_key__ = None");
  lines.push("        builtins.__pa_last_key_down__ = False");
  lines.push("");
  lines.push("        def __pa_post_key(name, down):");
  lines.push("            key = _KEY_MAP.get(str(name))");
  lines.push("            if key is None:");
  lines.push("                return");
  lines.push("            nonlocal _key_count");
  lines.push("            _key_count += 1");
  lines.push("            builtins.__pa_key_event_count__ = _key_count");
  lines.push("            builtins.__pa_last_key__ = str(name)");
  lines.push("            builtins.__pa_last_key_down__ = down");
  lines.push("            if down:");
  lines.push("                builtins.__pa_web_keys__.add(key)");
  lines.push(
    "                pg.event.post(pg.event.Event(pg.KEYDOWN, key=key))",
  );
  lines.push("            else:");
  lines.push("                builtins.__pa_web_keys__.discard(key)");
  lines.push(
    "                pg.event.post(pg.event.Event(pg.KEYUP, key=key))",
  );
  lines.push("        builtins.__pa_post_key = __pa_post_key");
  lines.push("");
  lines.push("        # Touch target bridge shim");
  lines.push("        builtins.__pa_touch_axis__ = None");
  lines.push("        builtins.__pa_touch_value__ = None");
  lines.push("        builtins.__pa_touch_active__ = False");
  lines.push("        builtins.__pa_touch_event_count__ = 0");
  lines.push("        builtins.__pa_last_touch_axis__ = None");
  lines.push("        builtins.__pa_last_touch_value__ = None");
  lines.push("");
  lines.push("        def __pa_set_touch_target(axis, value, active):");
  lines.push("            builtins.__pa_touch_axis__ = str(axis)");
  lines.push("            builtins.__pa_touch_value__ = float(value)");
  lines.push("            builtins.__pa_touch_active__ = bool(active)");
  lines.push("            builtins.__pa_touch_event_count__ += 1");
  lines.push("            builtins.__pa_last_touch_axis__ = str(axis)");
  lines.push("            builtins.__pa_last_touch_value__ = float(value)");
  lines.push("        builtins.__pa_set_touch_target = __pa_set_touch_target");
  lines.push("");
  lines.push('        _w.PirateArcadeMetrics.mark("input-bridge-installed")');
  lines.push("");
  lines.push('        _w.PirateArcadeMetrics.mark("display-init-start")');
  lines.push(
    '        _w.PirateArcadeLoading.set("Initializing display\u2026")',
  );
  lines.push("        import constants as c");
  lines.push(
    "        s = pg.display.set_mode((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))",
  );
  lines.push('        pg.display.set_caption("' + config.caption + '")');
  lines.push('        _w.PirateArcadeMetrics.mark("display-init-end")');
  lines.push(
    "        from " + config.pythonModule + " import " + config.gameClass,
  );
  lines.push("");
  lines.push("        class WebAudio:");
  lines.push("            def __init__(self):");
  lines.push("                self._js = _w.PirateArcadeAudio");
  lines.push("                self._js.init()");
  lines.push("                self._muted = False");
  lines.push("            @property");
  lines.push("            def muted(self):");
  lines.push("                return self._muted");
  lines.push("            @muted.setter");
  lines.push("            def muted(self, val):");
  lines.push("                self._muted = val");
  lines.push("                self._js.setMuted(val)");
  lines.push("            def play(self, name, *a, **kw):");
  lines.push("                self._js.resume()");
  lines.push("                self._js.play(name)");
  lines.push("            def load(self, *a, **kw):");
  lines.push("                pass");
  lines.push("");
  lines.push('        _w.PirateArcadeMetrics.mark("game-object-created")');
  lines.push(
    '        _w.PirateArcadeLoading.set("' + config.loadingText + '")',
  );
  lines.push("        game = " + config.gameClass + "(s, WebAudio())");
  lines.push('        _w.PirateArcadeMetrics.mark("game-ready")');
  lines.push("        _w.PirateArcadeMetrics.computeDurations()");
  lines.push(
    '        _w.PirateArcadeLoading.ready("' + config.readyMessage + '")',
  );
  lines.push(
    '        _w.infobox.innerText = "' +
      config.title +
      ' loaded! Audio starts after your first click."',
  );
  lines.push("        await game.run()");
  lines.push("    except Exception as e:");
  lines.push("        sys.print_exception(e)");
  lines.push("        msg = str(e) if str(e) else type(e).__name__");
  lines.push('        _w.PirateArcadeLoading.error("Error: " + msg)');
  lines.push("");
  lines.push("asyncio.ensure_future(boot())");

  return lines.join("\n");
}

// ── CDN pin comment ───────────────────────────────────────────

const CDN_PIN_COMMENT = `    <!--
      CDN VERSION PIN: pythons.js@0.9.3 — if upgrading, test thoroughly.
      The inline script below depends on pygbag internals (FS, cross_file,
      window.python, script.blocks[0], MM.UME). These are semi-stable
      implementation details that could change between minor versions.
      Always run the Playwright test suite after a version bump.
    -->`;

// Aligned with ASSET_VERSION to ensure cache-busting consistency
const DEBUG_PANEL_VERSION = ASSET_VERSION;

// ── Main render function ──────────────────────────────────────

export function render(config) {
  const overlayFn = TOUCH_OVERLAYS[config.touchOverlay];
  if (!overlayFn) {
    throw new Error("Unknown touchOverlay: " + config.touchOverlay);
  }

  const bootCode = renderPythonBootCode(config);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <title>${config.title} \u2013 Pirate Arcade</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <!-- Resource hints for performance -->
    <link rel="preconnect" href="https://pygame-web.github.io">
    <link rel="dns-prefetch" href="https://pygame-web.github.io">
    <link rel="modulepreload" href="https://pygame-web.github.io/cdn/0.9.3/pythons.js">
    <link rel="preload" href="${archiveUrl(config.id)}" as="fetch">
    <script src="/play/shared/game-boot-metrics.js"></script>
    <script src="/play/shared/pygbag-loading.js?v=${ASSET_VERSION}"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 100%; height: 100%; overflow: hidden; background: #0a0e17; color: #b8c4d4; }
      canvas.emscripten {
        border: 0; background: transparent; width: 100%; height: 100%;
        z-index: 5; padding: 0; margin: 0 auto;
        position: absolute; top: 0; bottom: 0; left: 0; right: 0;
      }
      #back-link {
        position: fixed; top: 12px; left: 12px; z-index: 999999;
        color: #8a9ab0; font: 13px/1 monospace; text-decoration: none;
        padding: 6px 12px; border: 1px solid #2a3142; border-radius: 4px;
        background: rgba(10,14,23,0.8); transition: color .15s, border-color .15s;
      }
      #back-link:hover { color: #d4a843; border-color: #d4a843; }
      #controls-hint {
        position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%);
        z-index: 999999;
        color: #8a9ab0; font: 11px/1.3 monospace; text-align: center;
        padding: 6px 14px; border: 1px solid #1e2433; border-radius: 4px;
        background: rgba(10,14,23,0.7); pointer-events: none;
        white-space: nowrap;
      }
      #infobox {
        position: fixed; z-index: 999999;
        background: #11131f; color: #b8c4d4; border: 1px solid #2a3142;
        font: 14px/1.4 monospace; padding: 16px 24px; border-radius: 8px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.6);
        top: 50%; left: 50%; transform: translate(-50%,-50%);
        max-width: 80vw; text-align: center;
      }
      #transfer { text-align: center; }
      #status { display: inline-block; vertical-align: top; margin: 20px 0 0 30px; font-weight: bold; color: #5a6a7e; }
      #progress { height: 20px; width: 300px; accent-color: #d4a843; }
      #pyconsole > #terminal { z-index: 0; }
      #rotate-device {
        display: none; position: fixed; inset: 0; z-index: 99999999;
        background: #0a0e17; color: #b8c4d4;
        font: 16px/1.5 monospace; text-align: center;
        align-items: center; justify-content: center; flex-direction: column;
        padding: 2rem;
      }
      #rotate-device .icon { font-size: 48px; margin-bottom: 1rem; opacity: 0.6; }
      @media (orientation: portrait) and (pointer: coarse) {
        #rotate-device { display: flex; }
        #game-wrap { display: none; }
      }
    </style>
    <link rel="stylesheet" href="/play/shared/mobile-controls.css?v=${ASSET_VERSION}">
${CDN_PIN_COMMENT}
    <script>
      console.log('INLINE_SCRIPT: starting');

      (function() {
        var _origFetch = window.fetch.bind(window);
        var done = false;
        var check = setInterval(function() {
          if ((typeof FS !== 'undefined' || typeof window.FS !== 'undefined') && typeof window.cross_file === 'function' && !done) {
            clearInterval(check); done = true;
            var fs = typeof FS !== 'undefined' ? FS : window.FS;
            window.cross_file = function*(url, store, flags) {
              console.log('cross_file.patched', url);
              var content = 0;
              var error = null;
              _origFetch(url).then(function(resp) {
                if (!resp.ok) { error = new Error('HTTP ' + resp.status); return; }
                return resp.arrayBuffer();
              }).then(function(buf) {
                if (buf) content = new Uint8Array(buf);
              }).catch(function(err) {
                error = err;
              });
              while (!content && !error) { yield; }
              if (error) { console.error('cross_file.error', error.message, 'url=', url); throw error; }
              console.log('cross_file.patched.done', url, 'len=', content ? content.length : 0);
              if (content && content.length) {
                fs.writeFile(store, content);
              }
              yield store;
            };
          }
        }, 10);
        setTimeout(function() { clearInterval(check); }, ${config.crossFileTimeout});
      })();

      (function() {
        var _paStateEl = document.createElement('div');
        _paStateEl.id = 'pa-game-state';
        _paStateEl.style.display = 'none';
        _paStateEl.setAttribute('aria-hidden', 'true');
        document.documentElement.appendChild(_paStateEl);
      })();

      console.log('INLINE_SCRIPT: cross_file replacement done');
      if (window.PirateArcadeMetrics) window.PirateArcadeMetrics.mark('cross-file-replaced');

      console.log('INJECT_SCRIPT: setting up poll');
      if (window.PirateArcadeMetrics) window.PirateArcadeMetrics.mark('pythons-js-requested');
      (function() {
        var pyReady = setInterval(function() {
          if (typeof window.python === 'object' && window.python !== null && typeof window.python.PyRun_SimpleString === 'function') {
            clearInterval(pyReady);
            console.log('JS_INJECT: python ready, injecting startup code');
            if (window.PirateArcadeMetrics) window.PirateArcadeMetrics.mark('python-ready');

            var gameCode = [
${bootCode
  .split("\n")
  .map(function (line) {
    // Escape the line for inclusion in a JS single-quoted string array
    var escaped = line.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    return "              '" + escaped + "',";
  })
  .join("\n")}
            ].join('\\n');
            window.python.FS.writeFile('/tmp/game.py', gameCode);
            window.python.script.blocks[0] = 'import sys;exec(open("/tmp/game.py").read())';
            console.log('JS_INJECT: wrote /tmp/game.py and set blocks[0]');
          }
        }, 100);
        setTimeout(function() { clearInterval(pyReady); }, 120000);
      })();

      console.log('INLINE_SCRIPT: all setup done');
    </script>
    <script src="audio-bridge.js"></script>
    <script
      src="https://pygame-web.github.io/cdn/0.9.3/pythons.js"
      type="module"
      id="site"
      data-python="python3.12"
      data-LINES="42"
      data-COLUMNS="132"
      data-os="vtx,gui"
      async
      defer
    >
      #<!--
      # empty template - game is started via JS injection above
      import sys
      sys.path.append('/data/data/org.python/assets/site-packages')
      # BEGIN BLOCK
      #
      # now this is the html part you can (and should) customize
      # It is not mandatory : pygame-script when it reads the first line (also called
      # shebang ) of above code create absolute minimal widget set
      # required for running with default rules
      #
      # do not alter that comment block it is separating python code from html code
      # =============================================================================
      # -->
    </script>
    <!-- Service Worker Registration -->
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
            .then(registration => {
              console.log('ServiceWorker registration successful with scope: ', registration.scope);
              registration.update();
            })
            .catch(err => {
              console.log('ServiceWorker registration failed: ', err);
            });
        });
      }
    </script>
  </head>
  <body>
    <div id="rotate-device"><div class="icon">\u21bb</div><div>Rotate your device to landscape</div><div style="margin-top:0.5rem;font-size:13px;color:#6b7a8f;">This game is designed for landscape orientation.</div></div>
    <div id="game-loading" role="status" aria-live="polite">
      <div class="loader-title">Loading ${config.title}</div>
      <div class="loader-spinner" aria-hidden="true"></div>
      <div id="game-loading-detail">Starting game engine</div>
      <div class="loader-note">First visit downloads ~12 MB. Repeat visits should be faster.</div>
    </div>
    <div id="game-wrap">
    <a id="back-link" href="/play/" data-no-touch-control>\u2190 Back to Arcade</a>
    <div id="controls-hint">${config.controlsHint}</div>
    <div id="transfer" align=center>
      <div class="emscripten" id="status">Downloading Python runtime...</div>
      <div class="emscripten"><progress value="0" max="100" id="progress"></progress></div>
    </div>
    <canvas class="emscripten" id="canvas"
      width="1px" height="1px"
      oncontextmenu="event.preventDefault()" tabindex=1>
    </canvas>
    <canvas class="emscripten" id="canvas3d"
      width="1280px" height="720px"
      oncontextmenu="event.preventDefault()" tabindex=1 hidden>
    </canvas>
    <div id="infobox">Loading ${config.title} \u2014 first visit downloads the Python/Pygame runtime (~12 MB). Audio starts after your first click.</div>
    <div id="pyconsole"><div id="terminal" tabIndex=1 align="left"></div></div>

    ${overlayFn()}
    </div>

    <script>
    function unlockAudioOnInteraction() {
      var audio = window.PirateArcadeAudio;
      if (audio && typeof audio.resume === 'function') {
        audio.resume();
      }
      document.removeEventListener('touchstart', unlockAudioOnInteraction);
      document.removeEventListener('click', unlockAudioOnInteraction);
    }
    document.addEventListener('touchstart', unlockAudioOnInteraction, { passive: true });
    document.addEventListener('click', unlockAudioOnInteraction, { passive: true });

    async function custom_onload(debug_hidden) {
      console.log('custom_onload');
      pyconsole.hidden = debug_hidden;
      transfer.hidden = debug_hidden;
      show_infobox();
    }
    function custom_prerun() { console.log('custom_prerun'); }
    function custom_postrun() { console.log('custom_postrun'); }
    function show_infobox() {
      infobox.style.display = 'block';
      var w = infobox.offsetWidth, h = infobox.offsetHeight;
      infobox.style.left = ((window.innerWidth - w) / 2) + 'px';
      infobox.style.top = ((window.innerHeight - h) / 2) + 'px';
    }
    var _isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (!_isTouch) {
      new MutationObserver(function() {
        var c = document.getElementById('canvas');
        if (c && c.style.visibility === 'visible' && document.activeElement !== c) {
          c.focus();
        }
      }).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['style'] });
    }
    </script>

    <link rel="stylesheet" href="/play/shared/debug-panel.css?v=${DEBUG_PANEL_VERSION}">
    <script src="/play/shared/pygame-input-bridge.js?v=${ASSET_VERSION}"></script>
    <script src="/play/shared/game-viewport.js?v=${ASSET_VERSION}"></script>
    <script src="/play/shared/mobile-controls.js?v=${ASSET_VERSION}"></script>
    <script src="/play/shared/debug-panel.js?v=${DEBUG_PANEL_VERSION}"></script>
    <!--
      GAME: ${config.id}
      ARCHIVE: ${archiveUrl(config.id)}
      CONTROL: keyboard + touch
      CDN: pythons.js@0.9.3
      SHARED: pygbag-loading.js, pygame-input-bridge.js, game-viewport.js, mobile-controls.js
      GENERATED FILE — DO NOT EDIT DIRECTLY
      Source: scripts/pygbag-shell-template.mjs
      Regenerate: node scripts/generate-pygbag-shells.mjs [--apply]
    -->
  </body>
</html>
`;
}
