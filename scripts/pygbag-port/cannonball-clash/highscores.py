"""Personal bests for Cannonball Clash (browser port).

Primary record: longest rally (hits). Persisted via shared.pa_store, which
uses window.localStorage in the browser and an in-memory fallback elsewhere.
"""

from shared.pa_store import get_best as _get_best
from shared.pa_store import submit_best as _submit_best

_RALLY_KEY = "pa-cannonball-rally"


def get_high(game_id):
    if game_id == "pong":
        best = _get_best(_RALLY_KEY)
        if best is None:
            return None
        return {"score": best, "label": str(best)}
    return None


def get_all():
    best = _get_best(_RALLY_KEY)
    if best is None:
        return {}
    return {"pong": {"score": best, "label": str(best)}}


def submit_rally(longest_rally):
    """Record a new longest rally. True on a new best."""
    return _submit_best(_RALLY_KEY, longest_rally)


def pong_score(player_score, ai_score, difficulty):
    return 0


def pong_label(player_score, ai_score, difficulty):
    return ""


def submit_pong(player_score, ai_score, difficulty):
    return False


def submit_breakout(score):
    return False


def submit_asteroids(score):
    return False


def submit_pirate_dominion(winner_name, net_worth, turns):
    return False
