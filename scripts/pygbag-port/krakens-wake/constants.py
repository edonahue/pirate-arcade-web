WINDOW_WIDTH = 1600
WINDOW_HEIGHT = 900

FPS = 60

BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GRAY = (100, 100, 100)
DIM = (40, 40, 40)
GOLD = (255, 215, 0)
NEON_CYAN = (0, 255, 255)
NEON_MAGENTA = (255, 0, 255)
ARCADE_DARK = (8, 0, 16)
ARCADE_PURPLE = (30, 10, 60)
ARCADE_BLUE = (10, 10, 40)

# Pirate Arcade palette
PIRATE_GOLD = (212, 175, 55)
PIRATE_RED = (139, 0, 0)
PIRATE_TEAL = (0, 128, 128)
PIRATE_TAN = (210, 180, 140)
PIRATE_NAVY = (10, 12, 28)
PIRATE_SEA = (20, 60, 80)
PIRATE_SAND = (194, 178, 128)
PIRATE_BLOOD = (120, 20, 20)
PIRATE_BROWN = (80, 50, 20)
PIRATE_CREAM = (245, 235, 210)
PIRATE_SKY = (200, 220, 240)
PIRATE_DARK_WOOD = (45, 30, 15)
PIRATE_CANNON = (40, 40, 45)
PIRATE_TREASURE = (255, 200, 50)
PIRATE_ORANGE = (255, 140, 50)
PIRATE_TAN_DARK = (210, 150, 60)
PIRATE_FLAME = (255, 120, 30)
PIRATE_FLAME_INNER = (255, 220, 50)
PIRATE_BROWN_DARK = (120, 85, 50)
PIRATE_MENU_TITLE = (255, 200, 80)
PIRATE_GAME_OVER = (255, 100, 100)
BALL_COLOR = WHITE
POWERUP_COLOR = PIRATE_TREASURE
PAUSE_HIGHLIGHT = PIRATE_TREASURE

# Pong
PADDLE_WIDTH = 16
PADDLE_HEIGHT = 100
PADDLE_SPEED = 700
PADDLE_MARGIN = 40
PADDLE_BIG_MULTIPLIER = 1.5
PADDLE_BIG_DURATION = 8.0

BALL_SIZE = 14
BALL_SPEED_INITIAL = 500
BALL_SPEED_INCREMENT = 0.05
BALL_MAX_SPEED = 1200

AI_DIFFICULTIES = {
    'easy':   {'speed_factor': 0.40, 'offset_range': 50},
    'medium': {'speed_factor': 0.60, 'offset_range': 30},
    'hard':   {'speed_factor': 0.85, 'offset_range': 10},
}
AI_DIFFICULTY_ORDER = ['easy', 'medium', 'hard']

WIN_SCORE = 11
WIN_BY_TWO = True

POWERUP_SPAWN_INTERVAL = 10.0
POWERUP_SIZE = 28
POWERUP_LIFETIME = 10.0
POWERUP_FLOAT_SPEED = 60
POWERUP_DRIFT_SPEED = 40
POWERUP_SPAWN_MIN_X = 0.1
POWERUP_SPAWN_MAX_X = 0.35

CENTER_LINE_DASH = 20
CENTER_LINE_GAP = 15
CENTER_LINE_WIDTH = 4

FONT_NAME = None
FONT_SIZE_SCORE = 64
FONT_SIZE_TITLE = 72
FONT_SIZE_HUD = 28
FONT_SIZE_INSTRUCTIONS = 24
FONT_SIZE_SMALL = 18
FONT_SIZE_TINY = 16

PANEL_FILL = (12, 10, 7, 220)
PANEL_OUTLINE = (80, 70, 40)
PANEL_ACCENT = (200, 170, 70)
PANEL_RADIUS = 12
HUD_ACCENT = (180, 150, 70)
PANEL_DIM_ALPHA = 180

BALL_TRAIL_LENGTH = 5

WIN_ANIMATION_DURATION = 1.5
PARTICLE_COUNT = 150
PARTICLE_GRAVITY = 100

# Breakout
BRICK_ROWS = 8
BRICK_COLS = 10
BRICK_WIDTH = 130
BRICK_HEIGHT = 25
BRICK_MARGIN_TOP = 100
BRICK_PADDING = 4
BRICK_LEFT = (WINDOW_WIDTH - BRICK_COLS * (BRICK_WIDTH + BRICK_PADDING)) // 2
BRICK_ROW_COLORS = [
    (255, 50, 50),    # red
    (255, 140, 50),   # orange
    (255, 220, 50),   # yellow
    (80, 220, 80),    # green
    (50, 200, 220),   # cyan
    (50, 130, 255),   # blue
    (160, 80, 220),   # purple
    (220, 60, 200),   # magenta
]
BRICK_GLOW_ALPHA = 40

PADDLE_BREAKOUT_WIDTH = 140
PADDLE_BREAKOUT_HEIGHT = 16
PADDLE_BREAKOUT_SPEED = 600
PADDLE_BREAKOUT_MARGIN = 50

BALL_BREAKOUT_SIZE = 10
BALL_BREAKOUT_SPEED = 450
BALL_BREAKOUT_MAX_SPEED = 800
BALL_BREAKOUT_SPEED_INCREMENT = 0.02

PLAYER_LIVES = 3
BRICK_POINTS_BASE = 10

# Asteroids
ASTEROID_INITIAL_COUNT = 4
ASTEROID_LARGE_RADIUS = 45
ASTEROID_MEDIUM_RADIUS = 28
ASTEROID_SMALL_RADIUS = 16
ASTEROID_SPEED_MIN = 60
ASTEROID_SPEED_MAX = 180
ASTEROID_SPLIT_SPEED = 120
ASTEROID_SPIN_MIN = -60
ASTEROID_SPIN_MAX = 60
ASTEROID_POINTS_LARGE = 20
ASTEROID_POINTS_MEDIUM = 50
ASTEROID_POINTS_SMALL = 100

SHIP_RADIUS = 18
SHIP_THRUST = 600
SHIP_ROTATION_SPEED = 220
SHIP_FRICTION = 0.985
SHIP_MAX_SPEED = 500
SHIP_INVULNERABLE_TIME = 2.0
SHIP_LIVES = 3

CANNONBALL_SPEED = 700
CANNONBALL_RADIUS = 4
CANNONBALL_LIFETIME = 1.5
CANNON_FIRE_RATE = 0.3

TREASURE_CHANCE = 0.12
TREASURE_POINTS = 200
TREASURE_RADIUS = 14
TREASURE_LIFETIME = 6.0

# Kraken boss (display waves 2, 5, 8, ... i.e. internal wave % 3 == 1)
KRAKEN_HP_BASE = 12
KRAKEN_HP_PER_RECURRENCE = 2
KRAKEN_HP_MAX = 20
KRAKEN_MAW_RADIUS = 55
KRAKEN_HIT_SCORE = 10
KRAKEN_KILL_SCORE = 500
KRAKEN_TRACK_SPEED = 40
KRAKEN_TRACK_DURATION = 3.0
KRAKEN_TELEGRAPH_DURATION = 0.8
KRAKEN_LUNGE_SPEED = 600
KRAKEN_LUNGE_DURATION = 0.5
KRAKEN_RECOVERY_DURATION = 1.6
KRAKEN_ENTER_DURATION = 1.8
KRAKEN_SPAWN_Y = -70
KRAKEN_SPAWN_X_MIN = 300
KRAKEN_SPAWN_X_MAX = 1300
KRAKEN_ANCHORS = ((350, 180), (800, 180), (1250, 180))
KRAKEN_ACTIVATION_SAFE_RADIUS = 280
KRAKEN_POSITIONING_SPEED = 400

# Wave lifecycle
WAVE_TRANSITION_DURATION = 1.6
BARREL_SPAWN_TRIES = 12
BARREL_SAFE_RADIUS = 313

# Pirate Dominion
PD_BOARD_SIZE = 36
PD_STARTING_MONEY = 1500
PD_PASS_GO = 200
PD_TAX_AMOUNT = 200

PD_GROUP_COLORS = [
    (140, 80, 40),    # 0 Brown  - Virgin Islands
    (100, 180, 255),  # 1 Light Blue - Leeward Islands
    (255, 140, 200),  # 2 Pink   - Windward Islands
    (255, 160, 50),   # 3 Orange - Greater Antilles
    (220, 60, 60),    # 4 Red    - Spanish Main
    (255, 230, 80),   # 5 Yellow - Treasure Islands
    (80, 200, 80),    # 6 Green  - Bermuda Triangle
    (100, 120, 255),  # 7 Blue   - Spanish Florida
]

PD_GROUP_NAMES = [
    "Virgin Islands",
    "Leeward Islands",
    "Windward Islands",
    "Greater Antilles",
    "Spanish Main",
    "Treasure Islands",
    "Bermuda Triangle",
    "Spanish Florida",
]

# (name, group_idx, cost, rent_base, upgrade_cost)
PD_PROPERTIES = [
    ("St. Thomas",     0,  60,  4,   50),
    ("St. John",       0,  60,  4,   50),
    ("Tortola",        0,  80,  6,   50),
    ("Antigua",        1, 100,  8,   50),
    ("St. Kitts",      1, 100,  8,   50),
    ("Nevis",          1, 120, 10,   50),
    ("Martinique",     2, 140, 12,  100),
    ("St. Lucia",      2, 140, 12,  100),
    ("St. Vincent",    2, 160, 14,  100),
    ("Grenada",        3, 180, 16,  100),
    ("Jamaica",        3, 180, 16,  100),
    ("Hispaniola",     3, 200, 18,  100),
    ("Puerto Rico",    4, 220, 20,  150),
    ("Cartagena",      4, 220, 20,  150),
    ("Panama",         4, 240, 22,  150),
    ("Nassau",         5, 260, 24,  150),
    ("Port Royal",     5, 260, 24,  150),
    ("Tortuga",        5, 280, 26,  150),
    ("Bermuda",        6, 300, 28,  200),
    ("Grand Turk",     6, 300, 28,  200),
    ("Freeport",       6, 320, 30,  200),
    ("St. Augustine",  7, 350, 34,  200),
    ("Havana",         7, 350, 34,  200),
    ("Treasure Cove",  7, 400, 38,  200),
]

# Board layout: 36 spaces
# Types: 0=GO, 1=property, 2=chance, 3=chest, 4=tax, 5=jail, 6=free_parking, 7=go_to_jail
# For property spaces: (1, property_index)
PD_BOARD = [
    (0,),             # 0   START
    (1, 0),           # 1   St. Thomas
    (2,),             # 2   Pirate's Code
    (1, 1),           # 3   St. John
    (4,),             # 4   Cannon Cove (-200)
    (1, 2),           # 5   Tortola
    (1, 3),           # 6   Antigua
    (3,),             # 7   Admiralty Orders
    (1, 4),           # 8   St. Kitts
    (5,),             # 9   DAVEY JONES' LOCKER
    (1, 5),           # 10  Nevis
    (1, 6),           # 11  Martinique
    (2,),             # 12  Pirate's Code
    (1, 7),           # 13  St. Lucia
    (1, 8),           # 14  St. Vincent
    (1, 9),           # 15  Grenada
    (1, 10),          # 16  Jamaica
    (1, 11),          # 17  Hispaniola
    (6,),             # 18  SHIPWRECK COVE
    (1, 12),          # 19  Puerto Rico
    (1, 13),          # 20  Cartagena
    (2,),             # 21  Pirate's Code
    (1, 14),          # 22  Panama
    (1, 15),          # 23  Nassau
    (1, 16),          # 24  Port Royal
    (4,),             # 25  Buccaneer's Bay (-200)
    (1, 17),          # 26  Tortuga
    (7,),             # 27  GO TO TORTUGA
    (1, 18),          # 28  Bermuda
    (1, 19),          # 29  Grand Turk
    (3,),             # 30  Admiralty Orders
    (1, 20),          # 31  Freeport
    (1, 21),          # 32  St. Augustine
    (3,),             # 33  Admiralty Orders
    (1, 22),          # 34  Havana
    (1, 23),          # 35  Treasure Cove
]

PD_RENT_MULTIPLIERS = [1, 4, 12, 30]
PD_FULL_GROUP_BONUS = 2
PD_MAX_UPGRADES = 3
PD_MORTGAGE_RATE = 0.5
PD_UNMORTGAGE_RATE = 1.1
PD_JAIL_COST = 50

PD_PLAYER_TOKENS = [
    "Jolly Roger",
    "Treasure Chest",
    "Cannon",
    "Anchor",
]

PD_AI_DIFFICULTIES = ['easy', 'medium', 'hard']
PD_PLAYER_COLORS = [
    (255, 80, 80),    # red
    (80, 180, 255),   # blue
    (80, 255, 100),   # green
    (255, 220, 50),   # yellow
]

# Pirate Code (chance) cards
PD_CHANCE_CARDS = [
    "Advance to START — collect 200 doubloons",
    "Advance 5 spaces — collect 100 if you pass START",
    "Buried treasure! — collect 150 doubloons",
    "Kraken attack! — pay 100 doubloons for repairs",
    "Press gang! — pay 50 doubloons to free your crew",
    "Friendly natives — collect 75 doubloons",
    "Shipworm damage — pay 120 doubloons",
    "Stowaway found — collect 50 doubloon reward",
    "Rough seas — lose a turn (next roll skip)",
    "Map to hidden loot — collect 200 doubloons",
    "Hurricane! — pay 150 doubloons for repairs",
    "Merchant convoy — collect 100 doubloons",
    "Go to Davey Jones' Locker — go directly to jail",
    "Get Out of Jail Free — keep this card until needed",
]

# Admiralty Orders (community chest) cards
PD_CHEST_CARDS = [
    "Inheritance from old salt — collect 200 doubloons",
    "Port fees — pay 80 doubloons",
    "Rum shipment sold — collect 120 doubloons",
    "Ship repairs — pay 150 doubloons",
    "Treasure map sold — collect 100 doubloons",
    "Harbor tax — pay 50 doubloons per property",
    "Crew's wages — pay 60 doubloons",
    "Prize ship captured — collect 250 doubloons",
    "Medical emergency — pay 100 doubloons",
    "Gold doubloons found — collect 180 doubloons",
    "Admiral's reward — collect 100 doubloons",
    "Mutiny quelled — pay 90 doubloons",
    "Go to Davey Jones' Locker — go directly to jail",
    "Get Out of Jail Free — keep this card until needed",
]


