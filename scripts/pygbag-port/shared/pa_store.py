"""Personal-best storage shared by browser-port games.

Browser (pygbag/Emscripten): persists to window.localStorage, so records
survive page reloads. Anywhere else (desktop CPython, unit tests): an
in-memory fallback so game logic never crashes on storage access.

Keys are explicit per game+metric, e.g. "pa-treasure-score".
Values are non-negative ints; higher beats lower. Missing, malformed,
or non-numeric values are treated as absent and never raise.
"""


_MEM = {}


def _browser_storage():
    """Return a localStorage-like object, or None outside the browser."""
    try:
        import __EMSCRIPTEN__ as _platform
        _ls = _platform.window.localStorage
        # Probe: throws where storage is blocked; fall back to memory then.
        _ls.setItem("__pa_store_probe__", "1")
        _ls.removeItem("__pa_store_probe__")
        return _ls
    except Exception:
        return None


def get_best(key, default=None):
    """Return the stored int best for key, or default when absent/invalid."""
    if not isinstance(key, str) or not key:
        return default
    store = _browser_storage()
    raw = None
    try:
        if store is not None:
            raw = store.getItem(key)
        else:
            raw = _MEM.get(key)
    except Exception:
        return default
    if raw is None:
        return default
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return default
    if value < 0:
        return default
    return value


def submit_best(key, value):
    """Store value when it beats the stored best. True on a new best.

    Non-int values (bool included), negatives, and empty keys are rejected
    without touching storage. A malformed stored value counts as absent.
    """
    if not isinstance(key, str) or not key:
        return False
    if isinstance(value, bool):
        return False
    try:
        value = int(value)
    except (TypeError, ValueError):
        return False
    if value < 0:
        return False
    if value <= (get_best(key, default=-1)):
        return False
    store = _browser_storage()
    try:
        if store is not None:
            store.setItem(key, str(value))
        else:
            _MEM[key] = str(value)
    except Exception:
        return False
    return True


def take(key):
    """Read a validated int once, removing the key. None when absent.

    Malformed values are consumed too, so a bad seed cannot poison future
    loads. Browser errors never propagate; non-browser fallback pops from
    memory. Used for one-shot test seeds, never for player records.
    """
    if not isinstance(key, str) or not key:
        return None
    store = _browser_storage()
    raw = None
    try:
        if store is not None:
            raw = store.getItem(key)
            try:
                store.removeItem(key)
            except Exception:
                pass
        else:
            raw = _MEM.pop(key, None)
    except Exception:
        return None
    if raw is None:
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    if value < 0:
        return None
    return value


def clear_memory():
    """Test seam: reset the non-browser fallback. No-op in the browser."""
    _MEM.clear()
