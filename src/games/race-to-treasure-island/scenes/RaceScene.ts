import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";

const PLAYER_SPEED = 200;
const BOOST_MULTIPLIER = 1.8;
const BASE_SCROLL_SPEED = 120;
const MAX_SCROLL_SPEED = 280;
const OBSTACLE_SPAWN_INTERVAL = 1200;
const TREASURE_SPAWN_INTERVAL = 5000;
const RACE_DISTANCE = 6000;
const BOOST_MAX = 100;
const BOOST_DRAIN = 1.2;
const BOOST_REGEN = 0.4;
const AI_BASE_SPEED = 100;

interface Obstacle extends Phaser.Physics.Arcade.Sprite {
  obstacleType: "rock" | "whirlpool" | "barrel";
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

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;

  private boostMeter: number = BOOST_MAX;
  private scrollSpeed: number = BASE_SCROLL_SPEED;
  private distanceTraveled: number = 0;
  private score: number = 0;
  private gameOver: boolean = false;
  private raceFinished: boolean = false;

  // HUD elements
  private scoreText!: Phaser.GameObjects.Text;
  private distanceText!: Phaser.GameObjects.Text;
  private boostBarFill!: Phaser.GameObjects.Image;
  private gameOverText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;

  // Background
  private oceanTiles: Phaser.GameObjects.TileSprite | null = null;

  private lastObstacleSpawn: number = 0;
  private lastTreasureSpawn: number = 0;
  private aiDistance: number = 0;
  private aiLane: number = 0;
  private aiLaneTimer: number = 0;

  constructor() {
    super({ key: "RaceScene" });
  }

  create(): void {
    this.resetState();

    this.createBackground();
    this.createPlayer();
    this.createAIShip();
    this.createGroups();
    this.createFinishLine();
    this.createHUD();
    this.setupInput();
    this.setupCollisions();

    // Signal game ready for screenshot pipeline
    this.setupBootMetrics();
  }

  update(_time: number, delta: number): void {
    if (this.gameOver || this.raceFinished) return;

    const dt = delta / 1000;
    this.scrollSpeed = Math.min(
      MAX_SCROLL_SPEED,
      BASE_SCROLL_SPEED + this.distanceTraveled * 0.02,
    );

    this.handlePlayerInput(dt);
    this.updateAIShip(dt);
    this.updateObstacles(dt);
    this.updateTreasures(dt);
    this.updateBoost(dt);
    this.updateBackground(dt);
    this.updateFinishLine(dt);
    this.checkRaceProgress(dt);
    this.updateHUD();
  }

  private resetState(): void {
    this.boostMeter = BOOST_MAX;
    this.scrollSpeed = BASE_SCROLL_SPEED;
    this.distanceTraveled = 0;
    this.score = 0;
    this.gameOver = false;
    this.raceFinished = false;
    this.aiDistance = 0;
    this.aiLane = 1;
    this.aiLaneTimer = 0;
    this.lastObstacleSpawn = 0;
    this.lastTreasureSpawn = 0;
  }

  private createBackground(): void {
    this.cameras.main.setBackgroundColor("#0a1628");

    this.oceanTiles = this.add.tileSprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      "ocean-bg",
    );
    if (this.oceanTiles) {
      this.oceanTiles.setAlpha(0.6);
    }
  }

  private createPlayer(): void {
    this.player = this.physics.add.sprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 60,
      "ship-player",
    );
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
  }

  private createAIShip(): void {
    this.aiShip = this.physics.add.sprite(
      GAME_WIDTH / 2 - 80,
      GAME_HEIGHT - 140,
      "ship-ai",
    );
    this.aiShip.setDepth(10);
    this.aiShip.setAlpha(0.9);
  }

  private createGroups(): void {
    this.obstacles = this.physics.add.group({
      runChildUpdate: false,
    });
    this.treasures = this.physics.add.group({
      runChildUpdate: false,
    });
  }

  private createFinishLine(): void {
    this.finishLine = this.physics.add.sprite(
      GAME_WIDTH / 2,
      -RACE_DISTANCE,
      "finish-line",
    );
    this.finishLine.setVisible(false);
    this.physics.add.overlap(
      this.player,
      this.finishLine,
      () => this.handleFinish(true),
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.aiShip,
      this.finishLine,
      () => this.handleFinish(false),
      undefined,
      this,
    );
  }

  private createHUD(): void {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#ffd700",
    };

    this.scoreText = this.add.text(10, 10, "Score: 0", style).setDepth(100);
    this.distanceText = this.add
      .text(10, 28, "Distance: 0m", style)
      .setDepth(100);

    // Boost bar
    const barX = GAME_WIDTH - 60;
    const barY = 16;
    this.add.image(barX, barY, "boost-bar-bg").setOrigin(0.5).setDepth(100);
    this.boostBarFill = this.add
      .image(barX, barY, "boost-bar-fill")
      .setOrigin(0.5)
      .setDepth(101);

    this.add
      .text(barX, barY + 14, "BOOST", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#888",
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.gameOverText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "", {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#ff4444",
        stroke: "#000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setVisible(false);

    this.resultText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, "", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffd700",
        stroke: "#000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setVisible(false);
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );

    // Enter to restart
    this.input.keyboard!.on("keydown-ENTER", () => {
      if (this.gameOver || this.raceFinished) {
        this.scene.restart();
      }
    });
  }

  private setupCollisions(): void {
    this.physics.add.overlap(
      this.player,
      this.obstacles,
      (_player, obj) => this.handleObstacleHit(obj as Obstacle),
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.player,
      this.treasures,
      (_player, tres) => this.handleTreasureCollect(tres as Treasure),
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

  private handlePlayerInput(_dt: number): void {
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown) vx = -1;
    else if (this.cursors.right.isDown) vx = 1;

    if (this.cursors.up.isDown) vy = -1;
    else if (this.cursors.down.isDown) vy = 1;

    const speed =
      this.spaceKey.isDown && this.boostMeter > 0
        ? PLAYER_SPEED * BOOST_MULTIPLIER
        : PLAYER_SPEED;

    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }

    this.player.setVelocity(vx * speed, vy * speed + this.scrollSpeed * -0.3);
  }

  private updateAIShip(dt: number): void {
    this.aiLaneTimer -= dt;
    if (this.aiLaneTimer <= 0) {
      this.aiLaneTimer = 2000 + Math.random() * 2000;
      this.aiLane = Math.floor(Math.random() * 3);
    }

    const laneX = [GAME_WIDTH / 2 - 80, GAME_WIDTH / 2, GAME_WIDTH / 2 + 80];

    const targetX = laneX[this.aiLane];
    const dx = targetX - this.aiShip.x;
    this.aiShip.setVelocityX(dx * 2);

    // AI speed varies, roughly keeping pace
    const aiSpeed =
      AI_BASE_SPEED + this.distanceTraveled * 0.015 + Math.random() * 20;
    this.aiDistance += aiSpeed * dt;
    this.aiShip.setVelocityY(aiSpeed * -1);

    // Keep AI visible
    const aiScreenY =
      GAME_HEIGHT - 140 - (this.aiDistance - this.distanceTraveled);
    if (aiScreenY < 50) {
      this.aiDistance = this.distanceTraveled - 50;
    }
  }

  private spawnObstacle(): void {
    const types: Array<{
      key: string;
      type: Obstacle["obstacleType"];
    }> = [
      { key: "rock", type: "rock" },
      { key: "rock", type: "rock" },
      { key: "whirlpool", type: "whirlpool" },
      { key: "barrel", type: "barrel" },
    ];
    const chosen = types[Math.floor(Math.random() * types.length)];

    const x = Phaser.Math.Between(40, GAME_WIDTH - 40);
    const y = -40;

    const obs = this.physics.add.sprite(x, y, chosen.key) as Obstacle;
    obs.obstacleType = chosen.type;
    obs.setDepth(5);
    this.obstacles.add(obs);
  }

  private spawnTreasure(): void {
    const x = Phaser.Math.Between(40, GAME_WIDTH - 40);
    const y = -30;
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
        OBSTACLE_SPAWN_INTERVAL - this.distanceTraveled * 0.05;
      if (this.lastObstacleSpawn < 400) this.lastObstacleSpawn = 400;
    }

    this.obstacles.getChildren().forEach((child) => {
      const obs = child as Obstacle;
      obs.y += this.scrollSpeed * dt;
      // Rotate rocks and barrels
      if (obs.obstacleType === "rock" || obs.obstacleType === "barrel") {
        obs.rotation += dt * 1.5;
      }
      // Whirlpools pulse
      if (obs.obstacleType === "whirlpool") {
        obs.setScale(1 + Math.sin(this.time.now * 0.005) * 0.1);
      }
      // Remove off-screen
      if (obs.y > GAME_HEIGHT + 60) {
        obs.destroy();
      }
    });
  }

  private updateTreasures(dt: number): void {
    this.lastTreasureSpawn -= dt * 1000;
    if (this.lastTreasureSpawn <= 0) {
      this.spawnTreasure();
      this.lastTreasureSpawn = TREASURE_SPAWN_INTERVAL;
    }

    this.treasures.getChildren().forEach((child) => {
      const tres = child as Treasure;
      tres.y += this.scrollSpeed * dt;
      // Bobbing animation
      tres.x += Math.sin(this.time.now * 0.003 + tres.y * 0.01) * 0.5;
      if (tres.y > GAME_HEIGHT + 40) {
        tres.destroy();
      }
    });
  }

  private updateBoost(_dt: number): void {
    const boosting = this.spaceKey.isDown && this.boostMeter > 0;
    if (boosting) {
      this.boostMeter = Math.max(0, this.boostMeter - BOOST_DRAIN);
    } else {
      this.boostMeter = Math.min(BOOST_MAX, this.boostMeter + BOOST_REGEN);
    }

    // Update boost bar visual
    this.boostBarFill.setScale(this.boostMeter / BOOST_MAX, 1);
    const fillColor = this.boostMeter > 30 ? 0x00ccff : 0xff4444;
    this.boostBarFill.setTint(fillColor);
  }

  private updateBackground(dt: number): void {
    if (this.oceanTiles) {
      this.oceanTiles.tilePositionY -= this.scrollSpeed * dt * 0.5;
    }
  }

  private updateFinishLine(dt: number): void {
    this.finishLine.y += this.scrollSpeed * dt;
  }

  private checkRaceProgress(dt: number): void {
    this.distanceTraveled += this.scrollSpeed * dt;
  }

  private handleObstacleHit(obs: Obstacle): void {
    // Flash effect
    this.player.setTint(0xff0000);
    this.time.delayedCall(200, () => {
      if (this.player && this.player.active) {
        this.player.clearTint();
      }
    });

    // Slow down
    this.scrollSpeed = Math.max(BASE_SCROLL_SPEED, this.scrollSpeed - 20);

    // Score penalty
    this.score = Math.max(0, this.score - 50);

    // Destroy obstacle
    obs.destroy();

    // Spawn hit particles
    for (let i = 0; i < 5; i++) {
      const p = this.add.image(obs.x, obs.y, "particle");
      p.setTint(0xff6600);
      p.setDepth(20);
      this.tweens.add({
        targets: p,
        x: p.x + Phaser.Math.Between(-30, 30),
        y: p.y + Phaser.Math.Between(-30, 30),
        alpha: 0,
        scale: 0,
        duration: 400,
        onComplete: () => p.destroy(),
      });
    }
  }

  private handleTreasureCollect(tres: Treasure): void {
    if (tres.collected) return;
    tres.collected = true;

    this.score += 100;

    tres.destroy();

    // Collect effect
    const text = this.add
      .text(tres.x, tres.y, "+100", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffd700",
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.tweens.add({
      targets: text,
      y: text.y - 40,
      alpha: 0,
      duration: 600,
      onComplete: () => text.destroy(),
    });
  }

  private handleFinish(playerWon: boolean): void {
    if (this.raceFinished) return;
    this.raceFinished = true;

    this.player.setVelocity(0, 0);
    this.aiShip.setVelocity(0, 0);

    this.gameOverText.setText(playerWon ? "VICTORY!" : "DEFEAT!");
    this.gameOverText.setColor(playerWon ? "#ffd700" : "#ff4444");
    this.gameOverText.setVisible(true);

    this.resultText.setText(`Score: ${this.score}  |  Press ENTER to retry`);
    this.resultText.setVisible(true);
  }

  private updateHUD(): void {
    this.scoreText.setText(`Score: ${this.score}`);
    this.distanceText.setText(
      `Distance: ${Math.floor(this.distanceTraveled / 10)}m`,
    );
  }
}
