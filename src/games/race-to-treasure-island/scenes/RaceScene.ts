import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { createRaceRng, type RaceRng } from "../rng";
import { RACE_TUNING } from "../tuning";
import {
  type ObstacleType,
  getBoostVisualBonus,
  getEffectiveWorldSpeed,
  getPlayerProgressRate,
  getRivalProgressRate,
  getLeadState,
} from "../helpers";

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
  private boostEffectVisible: boolean = false;
  private hitCount: number = 0;
  private lastHitType: ObstacleType | null = null;
  private lastHitAt: number = 0;
  private leadState: "player" | "rival" | "tied" = "tied";
  private leadDelta: number = 0;
  private overtakeCount: number = 0;
  private lastLeadChangeAt: number = 0;
  private hitBumpTimer: number = 0;
  private hitBumpVelocity: number = 0;
  private overtakeCueVisible: boolean = false;
  private playerWon: boolean = false;

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
  private oceanFarTiles: Phaser.GameObjects.TileSprite | null = null;
  private speedLines: Phaser.GameObjects.Graphics | null = null;
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

  // Text effect guards: avoid stacking feedback text
  private lastHitTextTime: number = 0;
  private lastOvertakeCueTime: number = 0;

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

  // ── Deterministic RNG ──

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

  // ── Coherent speed helpers ──

  private getBaseWorldSpeed(): number {
    return this.scrollSpeed;
  }

  private getEffectiveWorldSpeed(): number {
    return getEffectiveWorldSpeed(this.scrollSpeed, this.boosting);
  }

  private getBoostVisualBonus(): number {
    return getBoostVisualBonus(this.boosting);
  }

  private getPlayerProgressRate(): number {
    return getPlayerProgressRate(
      this.scrollSpeed,
      this.boosting,
      this.stunTimer > 0,
    );
  }

  private getRivalProgressRate(): number {
    return getRivalProgressRate(this.scrollSpeed, this.aiMistakeTimer > 0);
  }

  private get stunActive(): boolean {
    return this.stunTimer > 0;
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    this.scrollSpeed =
      this.gameOver || this.raceFinished
        ? this.scrollSpeed
        : Math.min(
            RACE_TUNING.maxScrollSpeed,
            RACE_TUNING.baseScrollSpeed + this.distanceTraveled * 0.012,
          );

    this.handleSystemInput();
    if (this.gameOver || this.raceFinished) return;

    if (this.paused) {
      this.exposeState();
      return;
    }

    if (this.isOverlayHeld()) {
      this.player?.setVelocityX(0);
      this.exposeState();
      return;
    }

    this.handleInput(dt);
    this.updateAIShip(dt);
    this.updateObstacles(dt);
    this.updateTreasures(dt);
    this.updateBoost(dt);
    this.updateBackground(dt);
    this.updateLeadState();
    this.tickProgress(dt);
    this.tickStun(dt);
    this.tickHitBump(dt);
    this.updateHUD();
    this.updateTreasureIsland();
    this.checkFinish();
    this.exposeState();
  }

  private isOverlayHeld(): boolean {
    return (
      typeof window !== "undefined" && !!(window as any).__paRaceOverlayHold
    );
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
    this.boostEffectVisible = false;
    this.hitCount = 0;
    this.lastHitType = null;
    this.lastHitAt = 0;
    this.leadState = "tied";
    this.leadDelta = 0;
    this.overtakeCount = 0;
    this.lastLeadChangeAt = 0;
    this.hitBumpTimer = 0;
    this.hitBumpVelocity = 0;
    this.overtakeCueVisible = false;
    this.playerWon = false;
    this.islandShown = false;
    this.paused = false;
    this.lastObstacleSpawn = 0;
    this.lastTreasureSpawn = 0;
    this.aiTargetX = GAME_WIDTH / 2;
    this.aiLaneTimer = 0;
    this.aiMistakeTimer = 0;
    this.aiMistakeDir = 0;
    this.lastHitTextTime = 0;
    this.lastOvertakeCueTime = 0;
    this.obstacleTypesSeen.clear();
    this.obstacleSpawnLog = [];
  }

  private createBackground(): void {
    this.cameras.main.setBackgroundColor("#0e1e38");

    this.add
      .rectangle(GAME_WIDTH / 2, 0, GAME_WIDTH, 140, 0x1a3a6a, 0.25)
      .setDepth(0);

    this.oceanFarTiles = this.add.tileSprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 40,
      GAME_WIDTH,
      GAME_HEIGHT,
      "ocean-bg",
    );
    if (this.oceanFarTiles) {
      this.oceanFarTiles.setAlpha(0.25);
    }

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

    this.speedLines = this.add.graphics().setDepth(1).setAlpha(0);
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
    this.aiWake = this.add.graphics().setDepth(9);
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
    this.add
      .rectangle(GAME_WIDTH / 2, 0, GAME_WIDTH, 44, 0x000000, 0.35)
      .setOrigin(0.5, 0)
      .setDepth(99);

    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ffd700",
    };

    this.scoreText = this.add.text(10, 6, "Score: 0", style).setDepth(100);
    this.speedText = this.add
      .text(10, 22, "", { ...style, fontSize: "10px", color: "#88aacc" })
      .setDepth(100);

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

    this.sailIndicator = this.add
      .image(GAME_WIDTH / 2 - 60, GAME_HEIGHT - 80, "sail")
      .setDepth(15)
      .setVisible(false)
      .setScale(0.5);

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
        boostEffectVisible: this.boostEffectVisible,
        effectiveWorldSpeed: Math.floor(this.getEffectiveWorldSpeed()),
        baseWorldSpeed: Math.floor(this.getBaseWorldSpeed()),
        playerProgressRate: Math.floor(this.getPlayerProgressRate()),
        rivalProgressRate: Math.floor(this.getRivalProgressRate()),
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
        stunTimer: Math.floor(this.stunTimer),
        hitBumpTimer: Math.floor(this.hitBumpTimer),
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
        overlayHeld: this.isOverlayHeld(),
        leadState: this.leadState,
        leadDelta: Math.floor(this.leadDelta),
        overtakeCount: this.overtakeCount,
        lastLeadChangeAt: this.lastLeadChangeAt,
        overtakeCueVisible: this.overtakeCueVisible,
        hitCount: this.hitCount,
        lastHitType: this.lastHitType,
        lastHitAt: this.lastHitAt,
        playerWon: this.playerWon,
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
    (window as any).__paRaceDebugSetRivalProgress = (value: number) => {
      this.rivalProgress = value;
      this.exposeState();
    };
    (window as any).__paRaceDebugSetBoostMeter = (value: number) => {
      this.boostMeter = Phaser.Math.Clamp(value, 0, RACE_TUNING.boostMax);
      this.exposeState();
    };
    (window as any).__paRaceDebugHitObstacle = (type?: string) => {
      const obsType: ObstacleType = (type as ObstacleType) ?? "barrel";
      this.obstacleTypesSeen.add(obsType);
      const fakeObs = {
        obsType,
        x: this.player?.x ?? GAME_WIDTH / 2,
        y: this.player?.y ?? GAME_HEIGHT / 2,
        destroy: () => {},
      } as Obstacle;
      this.handleObstacleHit(fakeObs);
    };
    (window as any).__paRaceDebugGetState = () => {
      return { ...(window as any).__paRaceToTreasureIslandState };
    };
    (window as any).__paRaceDebugShowOvertakeCue = () => {
      this.lastOvertakeCueTime = -99999;
      this.leadState = "player";
      this.leadDelta = 1500;
      this.showOvertakeCue("YOU'RE AHEAD!");
      this.exposeState();
    };
    (window as any).__paRaceDebugRestart = () => {
      const touch = (window as any).__paTouchInput || {};
      touch.left = false;
      touch.right = false;
      touch.boost = false;
      this.scene.restart();
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
        // Clear inputs before restart
        touch.left = false;
        touch.right = false;
        touch.boost = false;
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
    this.boostEffectVisible = this.boosting;

    const stunFactor = this.stunActive ? RACE_TUNING.stunSteerFactor : 1;

    const speed = this.boosting
      ? RACE_TUNING.playerSpeed * RACE_TUNING.boostMultiplier
      : RACE_TUNING.playerSpeed;

    // Hit bump overrides normal steering during the bump window
    if (this.hitBumpTimer > 0) {
      const bumpBlend = Math.min(
        1,
        this.hitBumpTimer / RACE_TUNING.hitBumpDuration,
      );
      const steerPart = dir * speed * stunFactor * (1 - bumpBlend * 0.6);
      const bumpPart = this.hitBumpVelocity * bumpBlend * 0.5;
      this.player.setVelocityX(steerPart + bumpPart);
    } else {
      this.player.setVelocityX(dir * speed * stunFactor);
    }

    const progressGain = this.getPlayerProgressRate() * dt;
    this.playerProgress += progressGain;
    this.playerProgress = Math.min(
      this.playerProgress,
      RACE_TUNING.raceDistance,
    );

    if (this.boosting) {
      this.boostLabelText.setVisible(true);
      this.boostLabelText.setAlpha(0.7 + Math.sin(this.time.now * 0.01) * 0.3);
      this.boostLabelText.setColor("#ffdd44");
    } else {
      this.boostLabelText.setVisible(false);
    }

    if (this.boosting) {
      this.sailIndicator.setVisible(true);
      this.sailIndicator.setPosition(this.player.x - 24, this.player.y - 34);
      this.sailIndicator.setTint(0xffdd44);
      const flap = 1.4 + Math.sin(this.time.now * 0.014) * 0.4;
      this.sailIndicator.setScale(flap);
      this.sailIndicator.setRotation(Math.sin(this.time.now * 0.01) * 0.2);
      if (this.rngCosmetic.float() < 0.5) {
        const streak = this.add
          .image(this.player.x - 30, this.player.y - 20, "particle")
          .setTint(0x88ccff)
          .setAlpha(0.4)
          .setScale(0.4)
          .setDepth(12);
        this.tweens.add({
          targets: streak,
          x: streak.x - 30,
          alpha: 0,
          duration: 250,
          onComplete: () => streak.destroy(),
        });
      }
      if (this.rngCosmetic.float() < 0.4) {
        const wake = this.add
          .image(
            this.player.x + this.rngCosmetic.int(-12, 12),
            this.player.y + 30,
            "particle",
          )
          .setTint(0xaaccee)
          .setAlpha(0.3)
          .setScale(0.5)
          .setDepth(12);
        this.tweens.add({
          targets: wake,
          y: wake.y + 20,
          alpha: 0,
          duration: 300,
          onComplete: () => wake.destroy(),
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
    this.aiLaneTimer -= dt * 1000;
    if (this.aiLaneTimer <= 0) {
      this.aiLaneTimer = 2000 + this.rngAi.float() * 3000;
      const laneOffset = this.rngAi.int(-1, 1) * 80;
      this.aiTargetX = Phaser.Math.Clamp(
        this.player.x + laneOffset,
        50,
        GAME_WIDTH - 50,
      );
    }

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

    const rivalRate = this.getRivalProgressRate();
    this.rivalProgress += rivalRate * dt;
    this.rivalProgress = Math.min(this.rivalProgress, RACE_TUNING.raceDistance);

    const aiScreenY =
      this.player.y - 80 - (this.rivalProgress - this.playerProgress) * 0.08;
    this.aiShip.y = Phaser.Math.Clamp(aiScreenY, 40, this.player.y - 30);
    if (this.playerProgress > this.rivalProgress + 200) {
      this.aiShip.setAlpha(0.6);
    } else {
      this.aiShip.setAlpha(0.9);
    }

    const label = this.aiShip.getData("label") as Phaser.GameObjects.Text;
    if (label) {
      label.setPosition(this.aiShip.x, this.aiShip.y + 42);
    }

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

    const worldSpeed = this.getEffectiveWorldSpeed();
    this.obstacles.getChildren().forEach((child) => {
      const obs = child as Obstacle;
      obs.y += worldSpeed * dt;
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

    const worldSpeed = this.getEffectiveWorldSpeed();
    this.treasures.getChildren().forEach((child) => {
      const tres = child as Treasure;
      tres.y += worldSpeed * dt;
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
    const effectiveScroll = this.getEffectiveWorldSpeed();

    if (this.oceanFarTiles) {
      this.oceanFarTiles.tilePositionY -= effectiveScroll * dt * 0.2;
    }
    if (this.oceanTiles) {
      this.oceanTiles.tilePositionY -= effectiveScroll * dt * 0.6;
    }

    if (this.speedLines) {
      if (this.boosting) {
        this.speedLines.setAlpha(0.15 + Math.sin(this.time.now * 0.01) * 0.1);
        this.speedLines.clear();
        this.speedLines.lineStyle(1, 0x88ccff, 0.3);
        const speed = effectiveScroll * 1.5;
        const nowMs = this.time.now;
        for (let i = 0; i < 6; i++) {
          const sx =
            ((GAME_WIDTH / 6) * i + ((nowMs * 0.02) % 160)) % GAME_WIDTH;
          const syBase = (nowMs * speed * 0.002 + i * 40) % 120;
          const sy = syBase - 60;
          const len = 20 + ((i * 7) % 41);
          this.speedLines.lineBetween(sx, sy, sx, sy + len);
        }
      } else {
        this.speedLines.clear();
        this.speedLines.setAlpha(0);
      }
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

  private tickHitBump(_dt: number): void {
    if (this.hitBumpTimer > 0) {
      this.hitBumpTimer -= _dt * 1000;
      if (this.hitBumpTimer <= 0) {
        this.hitBumpTimer = 0;
        this.hitBumpVelocity = 0;
      }
    }
  }

  private updateTreasureIsland(): void {
    const pct = this.playerProgress / RACE_TUNING.raceDistance;
    if (pct >= RACE_TUNING.islandThreshold && !this.islandShown) {
      this.islandShown = true;
      this.treasureIsland.setVisible(true);
      this.treasureIsland.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40);
      this.treasureIsland.setScale(0.3);
      this.treasureIsland.setAlpha(0);
      this.tweens.add({
        targets: this.treasureIsland,
        scale: 1,
        alpha: 1,
        duration: 2000,
        ease: "Back.easeOut",
      });
      this.cameras.main.shake(300, 0.005);
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
      this.treasureIsland.setAlpha(
        0.85 + Math.sin(this.time.now * 0.003) * 0.15,
      );
    }
  }

  private updateLeadState(): void {
    const delta = this.playerProgress - this.rivalProgress;
    this.leadDelta = delta;

    const newState = getLeadState(delta);

    if (newState !== this.leadState) {
      this.lastLeadChangeAt = this.time.now;
      if (newState === "player") {
        this.overtakeCount++;
      }
      this.showOvertakeCue(
        newState === "player"
          ? "YOU'RE AHEAD!"
          : newState === "rival"
            ? "LONG JOHN LEADS!"
            : "",
      );
    }
    this.leadState = newState;
  }

  private showOvertakeCue(text: string): void {
    if (!text) return;
    // Cooldown to avoid spam from near-threshold oscillation
    if (this.time.now - this.lastOvertakeCueTime < 2000) return;
    this.lastOvertakeCueTime = this.time.now;
    this.overtakeCueVisible = true;
    const cue = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, text, {
        fontFamily: "monospace",
        fontSize: text === "YOU'RE AHEAD!" ? "20px" : "16px",
        color: text === "YOU'RE AHEAD!" ? "#44ff88" : "#ff6666",
        stroke: "#000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(200);
    this.tweens.add({
      targets: cue,
      y: cue.y - 30,
      alpha: 0,
      duration: 1500,
      onComplete: () => {
        cue.destroy();
        this.overtakeCueVisible = false;
      },
    });
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
    this.hitCount++;
    this.lastHitType = obs.obsType;
    this.lastHitAt = this.time.now;

    this.boosting = false;
    this.boostEffectVisible = false;
    if (typeof window !== "undefined") {
      const touch = (window as any).__paTouchInput;
      if (touch) touch.boost = false;
    }

    this.boostMeter = Math.max(0, this.boostMeter - RACE_TUNING.hitWindPenalty);

    this.player.setTint(0xff4444);
    this.stunTimer = RACE_TUNING.stunDuration;

    this.cameras.main.shake(250, 0.015);

    this.scrollSpeed = Math.max(
      RACE_TUNING.baseScrollSpeed * 0.7,
      this.scrollSpeed - 25,
    );

    // Sideways bump with persistent timer
    const bumpDir = obs.x < this.player.x ? 1 : -1;
    this.hitBumpVelocity = bumpDir * RACE_TUNING.hitSideBump;
    this.hitBumpTimer = RACE_TUNING.hitBumpDuration;

    const flash = this.add
      .rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        GAME_WIDTH,
        GAME_HEIGHT,
        0xff0000,
        0.2,
      )
      .setDepth(250);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy(),
    });

    if (this.time.now - this.lastHitTextTime > 600) {
      this.lastHitTextTime = this.time.now;
      const hitText = this.add
        .text(this.player.x, this.player.y - 55, "HIT! -20 WIND", {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#ff4444",
          stroke: "#000",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(20);
      this.tweens.add({
        targets: hitText,
        y: hitText.y - 30,
        alpha: 0,
        duration: 700,
        onComplete: () => hitText.destroy(),
      });
    }

    this.score = Math.max(0, this.score - 30);

    for (let i = 0; i < 12; i++) {
      const p = this.add.image(obs.x, obs.y, "particle");
      p.setTint(0xff6600);
      p.setDepth(20);
      this.tweens.add({
        targets: p,
        x: p.x + this.rngCosmetic.int(-30, 30),
        y: p.y + this.rngCosmetic.int(-30, 30),
        alpha: 0,
        scale: 0,
        duration: 400,
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

  private handleFinish(win: boolean): void {
    if (this.raceFinished) return;
    this.raceFinished = true;
    this.playerWon = win;

    this.player.setVelocity(0, 0);
    this.player.setVelocityY(0);
    this.aiShip.setVelocity(0, 0);
    this.physics.pause();

    this.finishOverlay.setVisible(true);

    this.gameOverText.setText(
      win ? "TREASURE ISLAND!" : "LONG JOHN GOT THERE FIRST!",
    );
    this.gameOverText.setColor(win ? "#ffd700" : "#ff6666");
    this.gameOverText.setVisible(true);

    this.resultText.setText(
      win
        ? `You outran Long John!  Score: ${this.score}`
        : `Use BOOST to overtake him next run.  Score: ${this.score}`,
    );
    this.resultText.setColor(win ? "#88ddbb" : "#ff8866");
    this.resultText.setVisible(true);

    // Gold glow on island when player wins
    if (win && this.treasureIsland?.active) {
      this.tweens.add({
        targets: this.treasureIsland,
        scale: 1.15,
        duration: 400,
        yoyo: true,
        ease: "Sine.easeInOut",
      });
    }

    const restartBtn =
      typeof window !== "undefined" ? (window as any).__paRestartBtn : null;
    if (restartBtn) restartBtn.style.display = "";

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
    const boostVisual = this.getBoostVisualBonus();
    const baseSpeed = this.getBaseWorldSpeed();
    const displaySpeed = Math.floor(baseSpeed + boostVisual);
    this.scoreText.setText(`Score: ${this.score}`);
    this.speedText.setText(
      this.boosting
        ? `Speed: ${displaySpeed} kn ⚡`
        : `Speed: ${displaySpeed} kn`,
    );

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

    const leadStr =
      this.leadState === "player"
        ? `↑ You're ahead! (${this.overtakeCount})`
        : this.leadState === "rival"
          ? "↓ Long John leads"
          : "─ Neck and neck";
    this.rivalText.setText(leadStr);
    this.rivalText.setColor(
      this.leadState === "player"
        ? "#44ff88"
        : this.leadState === "rival"
          ? "#ff6666"
          : "#aaaaaa",
    );
  }
}
