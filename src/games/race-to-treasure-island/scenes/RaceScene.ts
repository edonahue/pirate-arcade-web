import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { createRaceRng, type RaceRng } from "../rng";

// ── Race Tuning ──
// Centralized tuning object so future settings UI can build from it.
const RACE_TUNING = {
  raceDistance: 10000,
  baseScrollSpeed: 80,
  maxScrollSpeed: 200,
  playerSpeed: 300,
  boostMultiplier: 1.6,
  boostMax: 100,
  boostDrain: 0.8,
  boostRegen: 0.35,
  stunDuration: 600,
  obstacleSpawnInterval: 1800,
  treasureSpawnInterval: 6000,
  baseProgressRate: 120,
  boostProgressBonus: 80,
  aiBaseRate: 105,
  aiMistakeChance: 0.004,
  aiMistakeDuration: 800,
  islandThreshold: 0.75,
};

type ObstacleType = "barrel" | "shipwreck" | "reef" | "debris";

interface Obstacle extends Phaser.Physics.Arcade.Sprite {
  obsType: ObstacleType;
}

interface Treasure extends Phaser.Physics.Arcade.Sprite {
  collected: boolean;
}

export class RaceScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private aiShip!: Phaser.Physics.Arcade.Sprite;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private treasures!: Phaser.Physics.Arcade.Group;
  private treasureIsland!: Phaser.GameObjects.Image;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private shiftKey!: Phaser.Input.Keyboard.Key;

  private boostMeter: number = RACE_TUNING.boostMax;
  private scrollSpeed: number = RACE_TUNING.baseScrollSpeed;
  private distanceTraveled: number = 0;
  private score: number = 0;
  private gameOver: boolean = false;
  private raceFinished: boolean = false;
  private playerProgress: number = 0;
  private rivalProgress: number = 0;
  private stunTimer: number = 0;
  private boosting: boolean = false;

  // AI state
  private aiTargetX: number = GAME_WIDTH / 2;
  private aiLaneTimer: number = 0;
  private aiMistakeTimer: number = 0;
  private aiMistakeDir: number = 0;

  // HUD
  private scoreText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private boostLabelText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private rivalText!: Phaser.GameObjects.Text;
  private pauseText!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Rectangle;
  private finishOverlay!: Phaser.GameObjects.Rectangle;
  private gameOverText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private boostBarFill!: Phaser.GameObjects.Image;
  private sailIndicator!: Phaser.GameObjects.Image;
  private playerCue?: Phaser.GameObjects.Text;

  private oceanTiles: Phaser.GameObjects.TileSprite | null = null;
  private lastObstacleSpawn: number = 0;
  private lastTreasureSpawn: number = 0;
  private islandShown: boolean = false;
  private paused: boolean = false;
  private obstacleTypesSeen: Set<ObstacleType> = new Set();

  // Deterministic RNG (project-owned mulberry32)
  private rngCourse!: RaceRng;
  private rngAi!: RaceRng;
  private rngCosmetic!: RaceRng;
  private seed: string = "race-default";

  // Obstacle spawn log (debug/determinism verification)
  private obstacleSpawnLog: Array<{ type: ObstacleType; x: number }> = [];

  // Stun text guard: avoid stacking if collisions come close together
  private lastStunTextTime: number = 0;

  constructor() {
    super({ key: "RaceScene" });
  }

  create(): void {
    this.initRNG();
    this.resetState();
    this.createBackground();
    this.createPlayer();
    this.createAIShip();
    this.createGroups();
    this.createTreasureIsland();
    this.createHUD();
    this.setupInput();
    this.setupCollisions();
    this.setupBootMetrics();
    this.setupDebugHooks();
    this.exposeState();
  }

  // ── Deterministic RNG (project-owned mulberry32) ──

  private initRNG(): void {
    const urlSeed =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("seed")
        : null;
    const configSeed = (this.game.config as any).seed?.[0] ?? null;
    this.seed = urlSeed ?? configSeed ?? "race-default";
    const base = createRaceRng(this.seed);
    this.rngCourse = base.fork("course");
    this.rngAi = base.fork("ai");
    this.rngCosmetic = base.fork("cosmetic");
  }

  update(_time: number, delta: number): void {
    if (this.gameOver || this.raceFinished) return;

    const dt = delta / 1000;

    this.scrollSpeed = Math.min(
      RACE_TUNING.maxScrollSpeed,
      RACE_TUNING.baseScrollSpeed + this.distanceTraveled * 0.012,
    );

    this.handleSystemInput();
    if (this.paused) {
      this.exposeState();
      return;
    }

    this.handleInput(dt);
    this.updateAIShip(dt);
    this.updateObstacles(dt);
    this.updateTreasures(dt);
    this.updateBoost(dt);
    this.updateBackground(dt);
    this.tickProgress(dt);
    this.tickStun(dt);
    this.updateHUD();
    this.updateTreasureIsland();
    this.checkFinish();
    this.exposeState();
  }

  private resetState(): void {
    this.boostMeter = RACE_TUNING.boostMax;
    this.scrollSpeed = RACE_TUNING.baseScrollSpeed;
    this.distanceTraveled = 0;
    this.score = 0;
    this.gameOver = false;
    this.raceFinished = false;
    this.playerProgress = 0;
    this.rivalProgress = 0;
    this.stunTimer = 0;
    this.boosting = false;
    this.islandShown = false;
    this.paused = false;
    this.lastObstacleSpawn = 0;
    this.lastTreasureSpawn = 0;
    this.aiTargetX = GAME_WIDTH / 2;
    this.aiLaneTimer = 0;
    this.aiMistakeTimer = 0;
    this.aiMistakeDir = 0;
    this.obstacleTypesSeen.clear();
    this.obstacleSpawnLog = [];
  }

  private createBackground(): void {
    this.cameras.main.setBackgroundColor("#1a3a5c");

    this.oceanTiles = this.add.tileSprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      "ocean-bg",
    );
    if (this.oceanTiles) {
      this.oceanTiles.setAlpha(0.5);
    }
  }

  private createPlayer(): void {
    this.player = this.physics.add.sprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 115,
      "ship-player",
    );
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.setScale(0.65);
    this.player.setSize(36, 60);

    // "YOU" cue above player at boot
    this.playerCue = this.add
      .text(this.player.x, this.player.y - 40, "YOU", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#ffd700",
        stroke: "#000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(12);
    // Fade out after ~2.5s
    this.tweens.add({
      targets: this.playerCue,
      alpha: 0,
      duration: 2500,
      ease: "Power2",
      onComplete: () => {
        this.playerCue?.destroy();
        this.playerCue = undefined;
      },
    });
  }

  private aiWake!: Phaser.GameObjects.Graphics;

  private createAIShip(): void {
    this.aiShip = this.physics.add.sprite(
      GAME_WIDTH / 2 + 100,
      GAME_HEIGHT - 190,
      "ship-ai",
    );
    this.aiShip.setDepth(10);
    this.aiShip.setAlpha(0.9);
    this.aiShip.setScale(0.62);
    this.aiShip.setSize(36, 60);
    // Rival wake (white trail behind AI ship)
    this.aiWake = this.add.graphics().setDepth(9);
    // Label
    const label = this.add
      .text(this.aiShip.x, this.aiShip.y + 48, "★ LONG JOHN", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#ff6666",
        stroke: "#000",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(11);
    this.aiShip.setData("label", label);
  }

  private createGroups(): void {
    this.obstacles = this.physics.add.group({ runChildUpdate: false });
    this.treasures = this.physics.add.group({ runChildUpdate: false });
  }

  private createTreasureIsland(): void {
    this.treasureIsland = this.add
      .image(GAME_WIDTH / 2, -300, "treasure-island")
      .setDepth(4)
      .setVisible(false);
  }

  private createHUD(): void {
    // HUD background panel (semi-transparent bar across top)
    const hudBg = this.add
      .rectangle(GAME_WIDTH / 2, 0, GAME_WIDTH, 44, 0x000000, 0.35)
      .setOrigin(0.5, 0)
      .setDepth(99);

    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ffd700",
    };

    // Top-left: score + speed
    this.scoreText = this.add.text(10, 6, "Score: 0", style).setDepth(100);
    this.speedText = this.add
      .text(10, 22, "", { ...style, fontSize: "10px", color: "#88aacc" })
      .setDepth(100);

    // Boost indicator (appears during boost)
    this.boostLabelText = this.add
      .text(10, 34, "BOOST", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#ffdd44",
        stroke: "#000",
        strokeThickness: 1,
      })
      .setDepth(100)
      .setVisible(false);

    // Top-center: progress vs rival
    this.progressText = this.add
      .text(GAME_WIDTH / 2, 4, "", {
        ...style,
        fontSize: "11px",
        align: "center",
        lineSpacing: 1,
      })
      .setOrigin(0.5, 0)
      .setDepth(100);

    this.rivalText = this.add
      .text(GAME_WIDTH / 2, 28, "", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#ff6666",
        stroke: "#000",
        strokeThickness: 1,
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setDepth(100);

    // Boost bar (top-right)
    const barX = GAME_WIDTH - 80;
    const barY = 16;
    this.add
      .text(barX, 4, "WIND", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#88ccff",
        stroke: "#000",
        strokeThickness: 1,
      })
      .setOrigin(0.5, 0)
      .setDepth(100);
    this.add.image(barX, barY, "boost-bar-bg").setOrigin(0.5).setDepth(100);
    this.boostBarFill = this.add
      .image(barX, barY, "boost-bar-fill")
      .setOrigin(0.5)
      .setDepth(101);

    // Sail indicator near player
    this.sailIndicator = this.add
      .image(GAME_WIDTH / 2 - 60, GAME_HEIGHT - 80, "sail")
      .setDepth(15)
      .setVisible(false)
      .setScale(0.5);

    // Pause overlay
    this.pauseText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "PAUSED", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ffd700",
        stroke: "#000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setVisible(false);

    const pauseHint = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 10,
        "Press PAUSE button, ESC, or P to resume",
        {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#888",
          align: "center",
        },
      )
      .setOrigin(0.5)
      .setDepth(200)
      .setVisible(false);
    this.pauseText.setData("hint", pauseHint);

    // Dim overlay behind pause
    this.pauseOverlay = this.add
      .rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        GAME_WIDTH,
        GAME_HEIGHT,
        0x000000,
        0.6,
      )
      .setDepth(199)
      .setVisible(false);

    // Dim overlay behind finish text
    this.finishOverlay = this.add
      .rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        GAME_WIDTH,
        GAME_HEIGHT,
        0x000000,
        0.65,
      )
      .setDepth(199)
      .setVisible(false);

    // Game over texts
    this.gameOverText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, "", {
        fontFamily: "monospace",
        fontSize: "36px",
        color: "#ffd700",
        stroke: "#000",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setVisible(false);

    this.resultText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#aaa",
        stroke: "#000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setVisible(false);
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.spaceKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );
    this.shiftKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
    );

    this.input.keyboard!.on("keydown-ENTER", () => {
      if (this.gameOver || this.raceFinished) {
        this.scene.restart();
      }
    });

    this.input.keyboard!.on("keydown-Escape", () => this.togglePause());
    this.input.keyboard!.on("keydown-p", () => this.togglePause());
    this.input.keyboard!.on("keydown-f", () => {
      // Debug: finish the race (only in debug mode)
      const debugMode =
        typeof window !== "undefined" && !!(window as any).__paRaceDebugMode;
      if (debugMode && !this.raceFinished) {
        this.playerProgress = RACE_TUNING.raceDistance;
        this.checkFinish();
      }
    });
  }

  private setupCollisions(): void {
    this.physics.add.overlap(
      this.player,
      this.obstacles,
      (_p, obj) => this.handleObstacleHit(obj as Obstacle),
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.player,
      this.treasures,
      (_p, tres) => this.handleTreasureCollect(tres as Treasure),
      undefined,
      this,
    );
  }

  private setupBootMetrics(): void {
    if (typeof window !== "undefined") {
      (window as any).__paBootMetrics = {
        "game-ready": true,
        engine: "phaser",
      };
    }
  }

  private exposeState(): void {
    if (typeof window !== "undefined") {
      (window as any).__paRaceToTreasureIslandState = {
        playerProgress: Math.floor(this.playerProgress),
        rivalProgress: Math.floor(this.rivalProgress),
        windMeter: Math.floor(this.boostMeter),
        boosting: this.boosting,
        paused: this.paused,
        finished: this.raceFinished,
        gameOver: this.gameOver,
        result: this.gameOverText?.text || "",
        score: this.score,
        seed: this.seed,
        rngVersion: this.rngCourse.version,
        playerX: Math.floor(this.player?.x ?? -1),
        playerY: Math.floor(this.player?.y ?? -1),
        rivalX: Math.floor(this.aiShip?.x ?? -1),
        rivalY: Math.floor(this.aiShip?.y ?? -1),
        distanceTraveled: Math.floor(this.distanceTraveled),
        stunTimer: this.stunTimer,
        obstacleCount: this.obstacles?.getLength() || 0,
        obstacleTypesSeen: Array.from(this.obstacleTypesSeen),
        obstacleSpawnLog: this.obstacleSpawnLog.slice(0, 10),
        scrollSpeed: Math.floor(this.scrollSpeed),
        islandShown: this.islandShown,
        playerTexture: this.player?.texture?.key ?? "",
        rivalTexture: this.aiShip?.texture?.key ?? "",
        playerVisible: this.player?.visible ?? false,
        rivalVisible: this.aiShip?.visible ?? false,
        playerDisplayWidth: Math.round(this.player?.displayWidth ?? 0),
        playerDisplayHeight: Math.round(this.player?.displayHeight ?? 0),
        rivalDisplayWidth: Math.round(this.aiShip?.displayWidth ?? 0),
        rivalDisplayHeight: Math.round(this.aiShip?.displayHeight ?? 0),
        playerCueVisible: this.playerCue?.visible ?? false,
      };
    }
  }

  private setupDebugHooks(): void {
    const debugMode =
      typeof window !== "undefined" && !!(window as any).__paRaceDebugMode;
    if (!debugMode) return;
    (window as any).__paRaceDebugFinish = () => {
      if (!this.raceFinished) {
        this.playerProgress = RACE_TUNING.raceDistance;
        this.checkFinish();
      }
    };
    (window as any).__paRaceDebugPause = () => {
      this.togglePause();
    };
    (window as any).__paRaceDebugSetProgress = (value: number) => {
      this.playerProgress = value;
      this.exposeState();
    };
  }

  private handleSystemInput(): void {
    const touch = (window as any).__paTouchInput || {};

    if (touch.pause) {
      this.togglePause();
      touch.pause = false;
    }

    if (touch.restart) {
      touch.restart = false;
      if (this.gameOver || this.raceFinished) {
        this.scene.restart();
      }
    }
  }

  private handleInput(dt: number): void {
    const touch = (window as any).__paTouchInput || {};
    let dir = 0;
    if (this.cursors.left.isDown || this.keyA.isDown || touch.left) dir = -1;
    else if (this.cursors.right.isDown || this.keyD.isDown || touch.right)
      dir = 1;

    this.boosting =
      (this.spaceKey.isDown || this.shiftKey.isDown || touch.boost) &&
      this.boostMeter > 0;

    const stunFactor = this.stunTimer > 0 ? 0.55 : 1;

    const speed = this.boosting
      ? RACE_TUNING.playerSpeed * RACE_TUNING.boostMultiplier
      : RACE_TUNING.playerSpeed;

    this.player.setVelocityX(dir * speed * stunFactor);

    const boostBonus = this.boosting ? RACE_TUNING.boostProgressBonus : 0;
    const progressGain =
      (RACE_TUNING.baseProgressRate +
        (this.scrollSpeed - RACE_TUNING.baseScrollSpeed) * 0.5 +
        boostBonus) *
      dt;
    this.playerProgress += progressGain * stunFactor;
    this.playerProgress = Math.min(
      this.playerProgress,
      RACE_TUNING.raceDistance,
    );

    // Boost indicator label
    if (this.boosting) {
      this.boostLabelText.setVisible(true);
      this.boostLabelText.setAlpha(0.6 + Math.sin(this.time.now * 0.008) * 0.4);
    } else {
      this.boostLabelText.setVisible(false);
    }

    // Sail visual for boost
    if (this.boosting) {
      this.sailIndicator.setVisible(true);
      this.sailIndicator.setPosition(this.player.x - 24, this.player.y - 34);
      this.sailIndicator.setTint(0xffdd44);
      // Flapping animation
      const flap = 1.2 + Math.sin(this.time.now * 0.012) * 0.3;
      this.sailIndicator.setScale(flap);
      this.sailIndicator.setRotation(Math.sin(this.time.now * 0.008) * 0.15);
      // Brief wind streak particles
      if (this.rngCosmetic.float() < 0.3) {
        const streak = this.add
          .image(this.player.x - 30, this.player.y - 20, "particle")
          .setTint(0x88ccff)
          .setAlpha(0.3)
          .setScale(0.3)
          .setDepth(12);
        this.tweens.add({
          targets: streak,
          x: streak.x - 20,
          alpha: 0,
          duration: 300,
          onComplete: () => streak.destroy(),
        });
      }
    } else if (dir !== 0) {
      this.sailIndicator.setVisible(true);
      this.sailIndicator.setPosition(this.player.x - 20, this.player.y - 30);
      this.sailIndicator.setTint(0x88aacc);
      this.sailIndicator.setScale(0.6);
      this.sailIndicator.setRotation(0);
    } else {
      this.sailIndicator.setVisible(false);
    }
  }

  private updateAIShip(dt: number): void {
    // Lane-based movement with occasional mistakes
    this.aiLaneTimer -= dt * 1000;
    if (this.aiLaneTimer <= 0) {
      this.aiLaneTimer = 2000 + this.rngAi.float() * 3000;
      // Aim roughly near player
      const laneOffset = this.rngAi.int(-1, 1) * 80;
      this.aiTargetX = Phaser.Math.Clamp(
        this.player.x + laneOffset,
        50,
        GAME_WIDTH - 50,
      );
    }

    // AI mistakes: drift off course
    this.aiMistakeTimer -= dt * 1000;
    if (
      this.aiMistakeTimer <= 0 &&
      this.rngAi.float() < RACE_TUNING.aiMistakeChance
    ) {
      this.aiMistakeTimer = RACE_TUNING.aiMistakeDuration;
      this.aiMistakeDir = this.rngAi.float() < 0.5 ? -1 : 1;
    }

    let targetX = this.aiTargetX;
    if (this.aiMistakeTimer > 0) {
      targetX += this.aiMistakeDir * 120;
    }

    const dx = targetX - this.aiShip.x;
    this.aiShip.setVelocityX(dx * 2.5);

    const aiPenalty = this.aiMistakeTimer > 0 ? 40 : 0;
    this.rivalProgress +=
      (RACE_TUNING.aiBaseRate +
        (this.scrollSpeed - RACE_TUNING.baseScrollSpeed) * 0.45 -
        aiPenalty) *
      dt;
    this.rivalProgress = Math.min(this.rivalProgress, RACE_TUNING.raceDistance);

    // Keep AI on screen relative to player
    const aiScreenY =
      this.player.y - 80 - (this.rivalProgress - this.playerProgress) * 0.05;
    this.aiShip.y = Phaser.Math.Clamp(aiScreenY, 40, this.player.y - 30);

    // Update label position
    const label = this.aiShip.getData("label") as Phaser.GameObjects.Text;
    if (label) {
      label.setPosition(this.aiShip.x, this.aiShip.y + 42);
    }

    // Rival wake
    if (this.aiWake) {
      this.aiWake.clear();
      this.aiWake.fillStyle(0xffffff, 0.08);
      this.aiWake.fillEllipse(this.aiShip.x, this.aiShip.y + 30, 40, 8);
      this.aiWake.fillStyle(0xffffff, 0.04);
      this.aiWake.fillEllipse(this.aiShip.x, this.aiShip.y + 42, 28, 6);
    }
  }

  private spawnObstacle(): void {
    const types: Array<{ key: string; type: ObstacleType }> = [
      { key: "barrel", type: "barrel" },
      { key: "barrel", type: "barrel" },
      { key: "shipwreck", type: "shipwreck" },
      { key: "reef", type: "reef" },
      { key: "debris", type: "debris" },
    ];
    const chosen = this.rngCourse.choose(types);
    this.obstacleTypesSeen.add(chosen.type);

    const x = this.rngCourse.int(40, GAME_WIDTH - 40);
    const y = this.rngCourse.int(-20, 0);

    const obs = this.physics.add.sprite(x, y, chosen.key) as Obstacle;
    obs.obsType = chosen.type;
    obs.setDepth(5);
    (obs.body as Phaser.Physics.Arcade.Body).setSize(
      obs.width * 0.7,
      obs.height * 0.7,
    );
    this.obstacles.add(obs);

    // Log first 10 spawns for determinism verification
    if (this.obstacleSpawnLog.length < 10) {
      this.obstacleSpawnLog.push({ type: chosen.type, x });
    }
  }

  private spawnTreasure(): void {
    const x = this.rngCourse.int(40, GAME_WIDTH - 40);
    const y = this.rngCourse.int(-20, 0);
    const tres = this.physics.add.sprite(x, y, "treasure") as Treasure;
    tres.collected = false;
    tres.setDepth(5);
    this.treasures.add(tres);
  }

  private updateObstacles(dt: number): void {
    this.lastObstacleSpawn -= dt * 1000;
    if (this.lastObstacleSpawn <= 0) {
      this.spawnObstacle();
      this.lastObstacleSpawn =
        RACE_TUNING.obstacleSpawnInterval - this.playerProgress * 0.02;
      if (this.lastObstacleSpawn < 600) this.lastObstacleSpawn = 600;
    }

    this.obstacles.getChildren().forEach((child) => {
      const obs = child as Obstacle;
      obs.y += this.scrollSpeed * dt;
      // Tumble effect
      if (obs.obsType !== "reef") {
        obs.rotation += dt * 0.8;
      }
      if (obs.y > GAME_HEIGHT + 60) {
        obs.destroy();
      }
    });
  }

  private updateTreasures(dt: number): void {
    this.lastTreasureSpawn -= dt * 1000;
    if (this.lastTreasureSpawn <= 0) {
      this.spawnTreasure();
      this.lastTreasureSpawn = RACE_TUNING.treasureSpawnInterval;
    }

    this.treasures.getChildren().forEach((child) => {
      const tres = child as Treasure;
      tres.y += this.scrollSpeed * dt;
      tres.x += Math.sin(this.time.now * 0.003 + tres.y * 0.01) * 0.4;
      if (tres.y > GAME_HEIGHT + 40) {
        tres.destroy();
      }
    });
  }

  private updateBoost(dt: number): void {
    if (this.boosting) {
      this.boostMeter = Math.max(
        0,
        this.boostMeter - RACE_TUNING.boostDrain * dt * 60,
      );
    } else {
      this.boostMeter = Math.min(
        RACE_TUNING.boostMax,
        this.boostMeter + RACE_TUNING.boostRegen * dt * 60,
      );
    }

    const pct = this.boostMeter / RACE_TUNING.boostMax;
    this.boostBarFill.setScale(pct, 1);
    const fillColor = this.boostMeter > 30 ? 0x00ccff : 0xff4444;
    this.boostBarFill.setTint(fillColor);
  }

  private updateBackground(dt: number): void {
    if (this.oceanTiles) {
      this.oceanTiles.tilePositionY -= this.scrollSpeed * dt * 0.6;
    }
  }

  private tickProgress(_dt: number): void {
    this.distanceTraveled += this.scrollSpeed * _dt;
  }

  private tickStun(_dt: number): void {
    if (this.stunTimer > 0) {
      this.stunTimer -= _dt * 1000;
      if (this.stunTimer <= 0) {
        this.stunTimer = 0;
        if (this.player && this.player.active) {
          this.player.clearTint();
        }
      }
    }
  }

  private updateTreasureIsland(): void {
    const pct = this.playerProgress / RACE_TUNING.raceDistance;
    if (pct >= RACE_TUNING.islandThreshold && !this.islandShown) {
      this.islandShown = true;
      this.treasureIsland.setVisible(true);
      this.treasureIsland.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40);
      // Animate island entrance
      this.treasureIsland.setScale(0.3);
      this.treasureIsland.setAlpha(0);
      this.tweens.add({
        targets: this.treasureIsland,
        scale: 1,
        alpha: 1,
        duration: 2000,
        ease: "Back.easeOut",
      });
      // Camera shake
      this.cameras.main.shake(300, 0.005);
      // "LAND HO!" text
      const landHo = this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100, "LAND HO!", {
          fontFamily: "monospace",
          fontSize: "18px",
          color: "#ffd700",
          stroke: "#000",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(200);
      this.tweens.add({
        targets: landHo,
        y: landHo.y - 40,
        alpha: 0,
        duration: 2000,
        onComplete: () => landHo.destroy(),
      });
      // Glow ring
      const glow = this.add
        .circle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 60, 0xffd700, 0.15)
        .setDepth(3);
      this.tweens.add({
        targets: glow,
        scale: 2.5,
        alpha: 0,
        duration: 2000,
        onComplete: () => glow.destroy(),
      });
    }

    if (this.islandShown) {
      this.treasureIsland.y += Math.sin(this.time.now * 0.002) * 0.3;
      // Subtle glow pulse
      this.treasureIsland.setAlpha(
        0.85 + Math.sin(this.time.now * 0.003) * 0.15,
      );
    }
  }

  private checkFinish(): void {
    if (this.raceFinished) return;

    if (this.playerProgress >= RACE_TUNING.raceDistance) {
      this.handleFinish(true);
    } else if (this.rivalProgress >= RACE_TUNING.raceDistance) {
      this.handleFinish(false);
    }
  }

  private handleObstacleHit(obs: Obstacle): void {
    // Flash / stun effect
    this.player.setTint(0xff4444);
    this.stunTimer = RACE_TUNING.stunDuration;

    // Camera shake
    this.cameras.main.shake(200, 0.008);

    // Slow scroll temporarily
    this.scrollSpeed = Math.max(
      RACE_TUNING.baseScrollSpeed * 0.7,
      this.scrollSpeed - 25,
    );

    // "STUNNED" text (avoid stacking if collisions come close together)
    if (this.time.now - this.lastStunTextTime > 600) {
      this.lastStunTextTime = this.time.now;
      const stunText = this.add
        .text(this.player.x, this.player.y - 50, "STUNNED!", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#ff4444",
          stroke: "#000",
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(20);
      this.tweens.add({
        targets: stunText,
        y: stunText.y - 30,
        alpha: 0,
        duration: 500,
        onComplete: () => stunText.destroy(),
      });
    }

    // Score penalty
    this.score = Math.max(0, this.score - 30);

    // Particle burst (cosmetic, uses rng for variety but doesn't affect gameplay)
    for (let i = 0; i < 8; i++) {
      const p = this.add.image(obs.x, obs.y, "particle");
      p.setTint(0xff6600);
      p.setDepth(20);
      this.tweens.add({
        targets: p,
        x: p.x + this.rngCosmetic.int(-25, 25),
        y: p.y + this.rngCosmetic.int(-25, 25),
        alpha: 0,
        scale: 0,
        duration: 350,
        onComplete: () => p.destroy(),
      });
    }

    obs.destroy();
  }

  private handleTreasureCollect(tres: Treasure): void {
    if (tres.collected) return;
    tres.collected = true;

    this.score += 100;

    const text = this.add
      .text(tres.x, tres.y, "+100", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ffd700",
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.tweens.add({
      targets: text,
      y: text.y - 35,
      alpha: 0,
      duration: 500,
      onComplete: () => text.destroy(),
    });

    tres.destroy();
  }

  private handleFinish(playerWon: boolean): void {
    if (this.raceFinished) return;
    this.raceFinished = true;

    this.player.setVelocity(0, 0);
    this.player.setVelocityY(0);
    this.aiShip.setVelocity(0, 0);
    this.physics.pause();

    // Dim overlay
    this.finishOverlay.setVisible(true);

    // Show result
    this.gameOverText.setText(
      playerWon ? "TREASURE ISLAND SIGHTED!" : "LONG JOHN REACHED IT FIRST!",
    );
    this.gameOverText.setColor(playerWon ? "#ffd700" : "#ff6666");
    this.gameOverText.setVisible(true);

    this.resultText.setText(
      `Score: ${this.score}  •  Press ENTER or tap RESTART to retry`,
    );
    this.resultText.setVisible(true);

    // Show the restart button
    const restartBtn =
      typeof window !== "undefined" ? (window as any).__paRestartBtn : null;
    if (restartBtn) restartBtn.style.display = "";

    // Final state
    this.exposeState();
  }

  private togglePause(): void {
    if (this.raceFinished || this.gameOver) return;
    this.paused = !this.paused;
    this.pauseText.setVisible(this.paused);
    this.pauseOverlay.setVisible(this.paused);
    const hint = this.pauseText.getData("hint") as Phaser.GameObjects.Text;
    if (hint) hint.setVisible(this.paused);
    if (this.paused) {
      this.physics.pause();
    } else {
      this.physics.resume();
    }
    // Sync pause button DOM state
    if (typeof window !== "undefined") {
      const pauseBtn = (window as any).__paPauseBtn;
      if (pauseBtn) {
        pauseBtn.classList.toggle("touch-btn--active", this.paused);
        pauseBtn.setAttribute("aria-pressed", this.paused ? "true" : "false");
        pauseBtn.setAttribute("aria-label", this.paused ? "Resume" : "Pause");
        const label = pauseBtn.querySelector(".touch-btn__label");
        if (label) label.textContent = this.paused ? "RESUME" : "PAUSE";
      }
    }
    this.exposeState();
  }

  private updateHUD(): void {
    this.scoreText.setText(`Score: ${this.score}`);
    this.speedText.setText(`Speed: ${Math.floor(this.scrollSpeed)} kn`);

    const playerPct = Math.min(
      100,
      Math.floor((this.playerProgress / RACE_TUNING.raceDistance) * 100),
    );
    const rivalPct = Math.min(
      100,
      Math.floor((this.rivalProgress / RACE_TUNING.raceDistance) * 100),
    );
    const barLen = 10;
    const playerBars = Math.floor((playerPct / 100) * barLen);
    const rivalBars = Math.floor((rivalPct / 100) * barLen);
    const playerBar = "█".repeat(playerBars) + "░".repeat(barLen - playerBars);
    const rivalBar = "█".repeat(rivalBars) + "░".repeat(barLen - rivalBars);
    this.progressText.setText(
      `You: ${playerPct}% [${playerBar}]\nLJ:  ${rivalPct}% [${rivalBar}]`,
    );
    this.rivalText.setText(
      playerPct > rivalPct
        ? "↑ You're ahead!"
        : playerPct < rivalPct
          ? "↓ Long John leads"
          : "─ Neck and neck",
    );
  }
}
