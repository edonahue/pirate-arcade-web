import os
import json
from datetime import date
import constants as c

_DATA_DIR = os.path.expanduser("~/.local/share/pirate-arcade")
_DATA_PATH = os.path.join(_DATA_DIR, "highscores.json")
_BROWSER_KEY = "pa-kraken-scores"
_cache = None


def _browser_storage():
    """localStorage-like object in the browser, else None.

    The Emscripten MEMFS file backend accepts writes but drops them on
    reload, so browser persistence must go through localStorage.
    """
    try:
        import __EMSCRIPTEN__ as _platform
        _ls = _platform.window.localStorage
        _ls.setItem("__pa_store_probe__", "1")
        _ls.removeItem("__pa_store_probe__")
        return _ls
    except Exception:
        return None

DIFFICULTY_BONUS = {
    'easy': 0,
    'medium': 200,
    'hard': 500,
}

def _load():
    global _cache
    if _cache is not None:
        return _cache
    store = _browser_storage()
    if store is not None:
        try:
            raw = store.getItem(_BROWSER_KEY)
            _cache = json.loads(raw) if raw else {}
            if not isinstance(_cache, dict):
                _cache = {}
            return _cache
        except Exception:
            _cache = {}
            return _cache
    try:
        with open(_DATA_PATH) as f:
            _cache = json.load(f)
            return _cache
    except (FileNotFoundError, json.JSONDecodeError):
        _cache = {}
        return _cache

def _save(data):
    global _cache
    _cache = data
    store = _browser_storage()
    if store is not None:
        try:
            store.setItem(_BROWSER_KEY, json.dumps(data))
        except Exception:
            pass
        return
    os.makedirs(_DATA_DIR, exist_ok=True)
    tmp = _DATA_PATH + ".tmp"
    with open(tmp, 'w') as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, _DATA_PATH)

def get_high(game_id):
    data = _load()
    return data.get(game_id)

def get_all():
    return _load()

def pong_score(player_score, ai_score, difficulty):
    if player_score < c.WIN_SCORE:
        return 0
    bonus = DIFFICULTY_BONUS.get(difficulty, 0)
    margin = player_score - ai_score
    return margin * 100 + bonus

def pong_label(player_score, ai_score, difficulty):
    return f"{player_score}-{ai_score} ({difficulty})"

def submit_pong(player_score, ai_score, difficulty):
    score = pong_score(player_score, ai_score, difficulty)
    if score <= 0:
        return False
    data = _load()
    current = data.get('pong')
    if current and score <= current.get('score', 0):
        return False
    data['pong'] = {
        'score': score,
        'label': pong_label(player_score, ai_score, difficulty),
        'date': date.today().isoformat(),
    }
    _save(data)
    return True

def submit_breakout(score):
    if score <= 0:
        return False
    data = _load()
    current = data.get('breakout')
    if current and score <= current.get('score', 0):
        return False
    data['breakout'] = {
        'score': score,
        'date': date.today().isoformat(),
    }
    _save(data)
    return True

def submit_asteroids(score):
    if score <= 0:
        return False
    data = _load()
    current = data.get('asteroids')
    if current and score <= current.get('score', 0):
        return False
    data['asteroids'] = {
        'score': score,
        'date': date.today().isoformat(),
    }
    _save(data)
    return True

def submit_pirate_dominion(winner_name, net_worth, turns):
    score = net_worth
    if score <= 0:
        return False
    data = _load()
    current = data.get('pirate_dominion')
    if current and score <= current.get('score', 0):
        return False
    data['pirate_dominion'] = {
        'score': score,
        'label': f"{winner_name} ({turns} turns)",
        'date': date.today().isoformat(),
    }
    _save(data)
    return True
