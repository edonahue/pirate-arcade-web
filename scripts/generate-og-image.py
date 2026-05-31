"""Generate OG image (1200x630) as a composite of 4 game screenshots.

Layout:
  ┌──────────────────────────────┐
  │        PIRATE ARCADE         │  <- 120px title bar
  │  ┌────────┐ ┌────────┐      │
  │  │ Pong   │ │Breakout│      │  <- 2x2 grid, each 520x270
  │  └────────┘ └────────┘      │     with 20px gaps
  │  ┌────────┐ ┌────────┐      │
  │  │Asteroid│ │Port Roy│      │
  │  └────────┘ └────────┘      │
  └──────────────────────────────┘

Output: public/og-image.png
"""

import os
from PIL import Image, ImageDraw, ImageFont

OUT_W, OUT_H = 1200, 630
TITLE_BAR_H = 110
TITLE_FONT_SIZE = 64
GAP = 16
MARGIN_X = 36
MARGIN_Y = TITLE_BAR_H + 16

GRID_W = OUT_W - 2 * MARGIN_X
GRID_H = OUT_H - MARGIN_Y - 24
CELL_W = (GRID_W - GAP) // 2
CELL_H = (GRID_H - GAP) // 2

script_dir = os.path.dirname(os.path.abspath(__file__))
images_dir = os.path.join(script_dir, "..", "public", "images")

GAME_ORDER = [
    "launcher",
    "cannonball-clash",
    "treasure-cove",
    "krakens-wake",
    "port-royale-tycoon",
]

# The first 4 (skip launcher for the grid, use it as background)
GRID_GAMES = GAME_ORDER[1:]  # cannonball-clash, treasure-cove, krakens-wake, port-royale-tycoon


def load_image(name):
    path = os.path.join(images_dir, f"{name}.png")
    img = Image.open(path).convert("RGB")
    return img


def composite_og():
    canvas = Image.new("RGB", (OUT_W, OUT_H), (10, 12, 28))  # PIRATE_NAVY

    draw = ImageDraw.Draw(canvas)

    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", TITLE_FONT_SIZE)
    except (IOError, OSError):
        font = ImageFont.load_default()

    # Title bar background
    title_bg = Image.new("RGB", (OUT_W, TITLE_BAR_H), (30, 10, 60))  # ARCADE_PURPLE
    canvas.paste(title_bg, (0, 0))

    # Title text
    title = "PIRATE ARCADE"
    bbox = draw.textbbox((0, 0), title, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (OUT_W - tw) // 2
    ty = (TITLE_BAR_H - th) // 2
    draw.text((tx, ty), title, font=font, fill=(212, 175, 55))  # PIRATE_GOLD

    # Grid: 2x2
    for idx, game_name in enumerate(GRID_GAMES):
        col = idx % 2
        row = idx // 2

        x = MARGIN_X + col * (CELL_W + GAP)
        y = MARGIN_Y + row * (CELL_H + GAP)

        img = load_image(game_name)
        img_resized = img.resize((CELL_W, CELL_H), Image.LANCZOS)

        # Add a 1px gold border
        bordered = Image.new("RGB", (CELL_W + 2, CELL_H + 2), (212, 175, 55))
        bordered.paste(img_resized, (1, 1))
        canvas.paste(bordered, (x - 1, y - 1))

    canvas.save(os.path.join(script_dir, "..", "public", "og-image.png"), "PNG", optimize=True)
    print(f"OG image saved: public/og-image.png ({OUT_W}x{OUT_H})")


if __name__ == "__main__":
    composite_og()
