"""Stub for web — no file I/O in WASM."""


def get_high(game_id):
    return None


def get_all():
    return {}


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
