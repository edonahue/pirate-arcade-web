import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";

console.log("[RaceScene] Module loaded");

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
  private finishLine!: Phaser.Physics.Arcade.Sprite;
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
  private progressText!: Phaser.GameObjects.Text;
  private rivalText!: Phaser.GameObjects.Text;
  private boostBarFill!: Phaser.GameObjects.Image;
  private speedText!: Phaser.GameObjects.Text;
  private gameOverText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private sailIndicator!: Phaser.GameObjects.Image;

  private oceanTiles: Phaser.GameObjects.TileSprite | null = null;
  private lastObstacleSpawn: number = 0;
  private lastTreasureSpawn: number = 0;
  private islandShown: boolean = false;
  private paused: boolean = false;
  private pauseText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "RaceScene" });
  }

  create(): void {
    console.log("[RaceScene] create() START");
    try {
      this.resetState();
      this.createBackground();
      this.createPlayer();
      this.createAIShip();
      this.createGroups();
      this.createFinishLine();
      this.createTreasureIsland();
      this.createHUD();
      this.setupInput();
      this.setupCollisions();
      this.setupBootMetrics();
      this.exposeState();
      console.log("[RaceScene] create() completed successfully");
    } catch (e) {
      console.error("[RaceScene] create() failed:", e);
      throw e;
    }
  }

  update(_time: number, delta: number): void {
    if (this.paused) return;

    if (this.gameOver || this.raceFinished) return;

    const dt = delta / 1000;

    this.scrollSpeed = Math.min(
      RACE_TUNING.maxScrollSpeed,
      RACE_TUNING.baseScrollSpeed + this.distanceTraveled * 0.012,
    );

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
      GAME_HEIGHT - 80,
      "ship-player",
    );
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.setScale(0.7);
    this.player.setSize(30, 50);
  }

  private createAIShip(): void {
    this.aiShip = this.physics.add.sprite(
      GAME_WIDTH / 2 + 100,
      GAME_HEIGHT - 160,
      "ship-ai",
    );
    this.aiShip.setDepth(10);
    this.aiShip.setAlpha(0.9);
    this.aiShip.setScale(0.65);
    this.aiShip.setSize(30, 50);
    // Label
    const label = this.add
      .text(this.aiShip.x, this.aiShip.y + 42, "LONG JOHN", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#ff6666",
      })
      .setOrigin(0.5)
      .setDepth(11);
    this.aiShip.setData("label", label);
  }

  private createGroups(): void {
    this.obstacles = this.physics.add.group({ runChildUpdate: false });
    this.treasures = this.physics.add.group({ runChildUpdate: false });
  }

  private createFinishLine(): void {
    this.finishLine = this.physics.add
      .sprite(GAME_WIDTH / 2, -200, "finish-line")
      .setVisible(false);
    this.finishLine.setDepth(5);
    this.finishLine.body!.enable = false;
  }

  private createTreasureIsland(): void {
    this.treasureIsland = this.add
      .image(GAME_WIDTH / 2, -300, "treasure-island")
      .setDepth(4)
      .setVisible(false);
  }

  private createHUD(): void {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ffd700",
    };

    // Top-left: score + speed
    this.scoreText = this.add.text(10, 8, "Score: 0", style).setDepth(100);
    this.speedText = this.add
      .text(10, 24, "", { ...style, fontSize: "10px", color: "#88aacc" })
      .setDepth(100);

    // Top-center: progress vs rival
    this.progressText = this.add
      .text(GAME_WIDTH / 2, 6, "", {
        ...style,
        fontSize: "10px",
        align: "center",
        lineSpacing: 1,
      })
      .setOrigin(0.5, 0)
      .setDepth(100);

    this.rivalText = this.add
      .text(GAME_WIDTH / 2, 30, "", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#ff6666",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setDepth(100);

    // Boost bar (top-right)
    const barX = GAME_WIDTH - 80;
    const barY = 18;
    this.add
      .text(barX, 6, "WIND", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#88aacc",
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
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, "Press ESC or P to resume", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#888",
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setVisible(false);
    this.pauseText.setData("hint", pauseHint);

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
      // Debug: finish the race
      if (!this.raceFinished) {
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
        distanceTraveled: Math.floor(this.distanceTraveled),
        stunTimer: this.stunTimer,
        obstacleCount: this.obstacles?.getLength() || 0,
        scrollSpeed: Math.floor(this.scrollSpeed),
        islandShown: this.islandShown,
      };

      // Debug hooks for tests
      (window as any).__paRaceDebugFinish = () => {
        console.log("[RaceScene] Debug finish hook called, raceFinished:", this.raceFinished);
        if (!this.raceFinished) {
          this.playerProgress = RACE_TUNING.raceDistance;
          this.checkFinish();
        }
      };
      (window as any).__paRaceDebugPause = () => {
        console.log("[RaceScene] Debug pause hook called, paused before:", this.paused);
        this.togglePause();
      };

      console.log("[RaceScene] exposeState called, state:", (window as any).__paRaceToTreasureIslandState);
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

    const speed = this.boosting
      ? RACE_TUNING.playerSpeed * RACE_TUNING.boostMultiplier
      : RACE_TUNING.playerSpeed;

    this.player.setVelocityX(dir * speed);

    const boostBonus = this.boosting ? RACE_TUNING.boostProgressBonus : 0;
    this.playerProgress +=
      (RACE_TUNING.baseProgressRate +
        (this.scrollSpeed - RACE_TUNING.baseScrollSpeed) * 0.5 +
        boostBonus) *
      dt;
    this.playerProgress = Math.min(
      this.playerProgress,
      RACE_TUNING.raceDistance,
    );

    // Sail visual for boost
    if (this.boosting) {
      this.sailIndicator.setVisible(true);
      this.sailIndicator.setPosition(this.player.x - 20, this.player.y - 30);
      this.sailIndicator.setTint(0xffdd44);
      this.sailIndicator.setScale(1.0 + Math.sin(this.time.now * 0.008) * 0.2);
      this.sailIndicator.setRotation(Math.sin(this.time.now * 0.005) * 0.1);
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
      this.aiLaneTimer = 2000 + Math.random() * 3000;
      // Aim roughly near player
      const laneOffset = Phaser.Math.Between(-1, 1) * 80;
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
      Math.random() < RACE_TUNING.aiMistakeChance
    ) {
      this.aiMistakeTimer = RACE_TUNING.aiMistakeDuration;
      this.aiMistakeDir = Math.random() < 0.5 ? -1 : 1;
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
  }

  private spawnObstacle(): void {
    const types: Array<{ key: string; type: ObstacleType }> = [
      { key: "barrel", type: "barrel" },
      { key: "barrel", type: "barrel" },
      { key: "shipwreck", type: "shipwreck" },
      { key: "reef", type: "reef" },
      { key: "debris", type: "debris" },
    ];
    const chosen = types[Math.floor(Math.random() * types.length)];

    const x = Phaser.Math.Between(40, GAME_WIDTH - 40);
    const y = Phaser.Math.Between(-20, 0);

    const obs = this.physics.add.sprite(x, y, chosen.key) as Obstacle;
    obs.obsType = chosen.type;
    obs.setDepth(5);
    (obs.body as Phaser.Physics.Arcade.Body).setSize(
      obs.width * 0.7,
      obs.height * 0.7,
    );
    this.obstacles.add(obs);
  }

  private spawnTreasure(): void {
    const x = Phaser.Math.Between(40, GAME_WIDTH - 40);
    const y = Phaser.Math.Between(-20, 0);
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

  private updateBoost(_dt: number): void {
    if (this.boosting) {
      this.boostMeter = Math.max(0, this.boostMeter - RACE_TUNING.boostDrain);
    } else {
      this.boostMeter = Math.min(
        RACE_TUNING.boostMax,
        this.boostMeter + RACE_TUNING.boostRegen,
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
      // Glow ring
      const glow = this.add
        .circle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 60, 0xffd700, 0.15)
        .setDepth(3);
      this.tweens.add({
        targets: glow,
        scale: 2,
        alpha: 0,
        duration: 2000,
        onComplete: () => glow.destroy(),
      });
    }

    if (this.islandShown) {
      this.treasureIsland.y += Math.sin(this.time.now * 0.002) * 0.3;
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

    // Score penalty
    this.score = Math.max(0, this.score - 30);

    // Particle burst
    for (let i = 0; i < 8; i++) {
      const p = this.add.image(obs.x, obs.y, "particle");
      p.setTint(0xff6600);
      p.setDepth(20);
      this.tweens.add({
        targets: p,
        x: p.x + Phaser.Math.Between(-25, 25),
        y: p.y + Phaser.Math.Between(-25, 25),
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
    console.log("[RaceScene] togglePause called, current paused:", this.paused, "raceFinished:", this.raceFinished, "gameOver:", this.gameOver);
    if (this.raceFinished || this.gameOver) {
      console.log("[RaceScene] togglePause early return");
      return;
    }
    this.paused = !this.paused;
    console.log("[RaceScene] togglePause new paused:", this.paused);
    this.pauseText.setVisible(this.paused);
    const hint = this.pauseText.getData("hint") as Phaser.GameObjects.Text;
    if (hint) hint.setVisible(this.paused);
    if (this.paused) {
      this.physics.pause();
    } else {
      this.physics.resume();
    }
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
