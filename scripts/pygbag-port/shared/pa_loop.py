import builtins


def should_draw(current_key, last_draw_key):
    if current_key != last_draw_key:
        return True, current_key
    return False, last_draw_key


def page_hidden():
    return not builtins.__dict__.get("__pa_page_visible__", True)
