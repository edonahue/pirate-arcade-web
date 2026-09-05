"""Personal bests for Treasure Cove (browser port).

Primary record: best score. Persisted via shared.pa_store, which uses
window.localStorage in the browser and an in-memory fallback elsewhere.
"""

from shared.pa_store import get_best as _get_best
from shared.pa_store import submit_best as _submit_best

_SCORE_KEY = "pa-treasure-score"


def get_high(game_id):
    if game_id == "breakout":
        best = _get_best(_SCORE_KEY)
        if best is None:
            return None
        return {"score": best}
    return None


def get_all():
    best = _get_best(_SCORE_KEY)
    if best is None:
        return {}
    return {"breakout": {"score": best}}


def pong_score(player_score, ai_score, difficulty):
    return 0


def pong_label(player_score, ai_score, difficulty):
    return ""


def submit_pong(player_score, ai_score, difficulty):
    return False


def submit_breakout(score):
    """Record a new best score. True on a new best."""
    return _submit_best(_SCORE_KEY, score)


def submit_asteroids(score):
    return False


def submit_pirate_dominion(winner_name, net_worth, turns):
    return False
