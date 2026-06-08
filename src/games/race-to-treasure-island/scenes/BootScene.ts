import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add
      .text(cx, cy, "Loading...", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffd700",
      })
      .setOrigin(0.5);

    // Load external sprite assets
    this.load.image(
      "ship-player",
      "/images/race-to-treasure-island/player-ship.png",
    );
    this.load.image(
      "ship-ai",
      "/images/race-to-treasure-island/long-john-ship.png",
    );

    this.generateTextures();
  }

  create(): void {
    console.log("[BootScene] create() START");
    this.children.removeAll(true);
    console.log("[BootScene] Starting RaceScene");
    this.scene.start("RaceScene");
    console.log("[BootScene] RaceScene started");
  }

  private generateTextures(): void {
    this.generateOceanBg();
    this.generateBarrel();
    this.generateShipwreck();
    this.generateReef();
    this.generateDebris();
    this.generateTreasureChest();
    this.generateBoostBar();
    this.generateTreasureIsland();
    this.generateFinishFlag();
    this.generateParticle();
    this.generateSail();
  }

  private generateOceanBg(): void {
    const g = this.add.graphics();
    const stripeH = GAME_HEIGHT / 8;
    const colors = [
      0x0a1628, 0x0c1e38, 0x0f2a4a, 0x123558, 0x0f2a4a, 0x0c1e38, 0x0a1628,
      0x0d1f3c,
    ];
    for (let i = 0; i < colors.length; i++) {
      g.fillStyle(colors[i]);
      g.fillRect(0, i * stripeH, GAME_WIDTH, stripeH + 1);
    }
    // Rolling wave crests (horizontal lines)
    g.lineStyle(1, 0x1a4a6a, 0.15);
    for (let row = 0; row < 12; row++) {
      const wy = row * (GAME_HEIGHT / 12);
      for (let col = 0; col < GAME_WIDTH; col += 6) {
        const offset = Math.sin(col * 0.03 + row * 0.8) * 3;
        g.fillStyle(0xffffff, 0.02 + row * 0.003);
        g.fillEllipse(col, wy + offset, 8, 2);
      }
    }
    // Wave foam flecks
    g.fillStyle(0xffffff, 0.04);
    for (let i = 0; i < 80; i++) {
      g.fillEllipse(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        Phaser.Math.Between(4, 14),
        Phaser.Math.Between(1, 3),
      );
    }
    g.generateTexture("ocean-bg", GAME_WIDTH, GAME_HEIGHT);
    g.destroy();
  }

  private generateBarrel(): void {
    const g = this.add.graphics();
    // Wooden barrel with bands
    g.fillStyle(0x8b6914);
    g.fillRoundedRect(2, 4, 28, 22, 3);
    g.fillStyle(0xa07818);
    g.fillRect(0, 0, 32, 4);
    g.fillRect(0, 26, 32, 4);
    g.fillStyle(0x4a3508);
    g.fillRect(2, 10, 28, 2);
    g.fillRect(2, 18, 28, 2);
    // Rope detail
    g.lineStyle(1, 0x6b4f10);
    g.strokeCircle(8, 15, 2);
    g.strokeCircle(24, 15, 2);
    // Highlight
    g.fillStyle(0xc09828, 0.3);
    g.fillRect(6, 6, 4, 18);
    g.generateTexture("barrel", 32, 30);
    g.destroy();
  }

  private generateShipwreck(): void {
    const g = this.add.graphics();
    // Broken hull
    g.fillStyle(0x5c3a1e);
    g.fillRect(4, 8, 24, 20);
    g.fillStyle(0x7a4e28);
    g.fillRect(8, 12, 16, 12);
    // Broken mast
    g.fillStyle(0x4a2800);
    g.fillRect(14, 0, 4, 14);
    // Tattered sail
    g.fillStyle(0x888888, 0.6);
    g.fillTriangle(18, 2, 18, 12, 28, 7);
    g.fillStyle(0x666666, 0.4);
    g.fillTriangle(18, 4, 18, 10, 26, 7);
    // Debris pieces
    g.fillStyle(0x5c3a1e);
    g.fillRect(0, 22, 8, 3);
    g.fillRect(24, 20, 6, 4);
    g.fillRect(10, 26, 6, 2);
    g.generateTexture("shipwreck", 32, 30);
    g.destroy();
  }

  private generateReef(): void {
    const g = this.add.graphics();
    // Rocky island/reef
    g.fillStyle(0x554433);
    g.fillEllipse(20, 18, 34, 26);
    g.fillStyle(0x665544);
    g.fillEllipse(16, 14, 18, 14);
    g.fillStyle(0x443322);
    g.fillEllipse(24, 22, 16, 12);
    // Sandy edge
    g.fillStyle(0x998866, 0.5);
    g.fillEllipse(20, 20, 30, 20);
    // Palm silhouette
    g.fillStyle(0x2a5a1a);
    g.fillRect(19, 2, 3, 14);
    g.fillStyle(0x3a7a2a);
    g.fillEllipse(20, 2, 14, 6);
    g.generateTexture("reef", 40, 36);
    g.destroy();
  }

  private generateDebris(): void {
    const g = this.add.graphics();
    // Floating crate
    g.fillStyle(0x7a5a2e);
    g.fillRect(2, 4, 20, 16);
    g.lineStyle(1, 0x5a3a0e);
    g.strokeRect(2, 4, 20, 16);
    g.lineStyle(1, 0x5a3a0e);
    g.lineBetween(2, 12, 22, 12);
    g.lineBetween(12, 4, 12, 20);
    // Rope coils
    g.fillStyle(0x8b6914);
    g.fillCircle(6, 6, 2);
    g.fillCircle(18, 18, 2);
    g.generateTexture("debris", 24, 24);
    g.destroy();
  }

  private generateTreasureChest(): void {
    const g = this.add.graphics();
    // Chest body
    g.fillStyle(0x8b6914);
    g.fillRoundedRect(2, 10, 28, 18, 2);
    // Lid
    g.fillStyle(0xa07818);
    g.fillRoundedRect(0, 2, 32, 10, { tl: 4, tr: 4, bl: 0, br: 0 });
    // Lock plate
    g.fillStyle(0xffd700);
    g.fillRect(13, 12, 6, 6);
    g.fillStyle(0x8b6914);
    g.fillRect(14, 14, 4, 4);
    // Keyhole
    g.fillStyle(0x000000);
    g.fillCircle(16, 16, 1.5);
    // Gold glow
    g.fillStyle(0xffeb3b, 0.3);
    g.fillCircle(16, 8, 5);
    // Gems on lid
    g.fillStyle(0xff4444);
    g.fillCircle(8, 7, 2);
    g.fillStyle(0x4444ff);
    g.fillCircle(24, 7, 2);
    g.generateTexture("treasure", 32, 30);
    g.destroy();
  }

  private generateBoostBar(): void {
    const g = this.add.graphics();
    g.fillStyle(0x333333);
    g.fillRoundedRect(0, 0, 120, 14, 3);
    g.lineStyle(1, 0x666666);
    g.strokeRoundedRect(0, 0, 120, 14, 3);
    g.generateTexture("boost-bar-bg", 120, 14);
    g.destroy();

    const g2 = this.add.graphics();
    g2.fillStyle(0x00ccff);
    g2.fillRoundedRect(0, 0, 120, 14, 3);
    g2.generateTexture("boost-bar-fill", 120, 14);
    g2.destroy();
  }

  private generateTreasureIsland(): void {
    const g = this.add.graphics();
    const w = 200;
    const h = 140;
    const cx = w / 2;
    // Ocean base
    g.fillStyle(0x123558);
    g.fillRect(0, 0, w, h);
    // Sandy island
    g.fillStyle(0xeeddbb);
    g.fillEllipse(cx, h - 20, 160, 60);
    g.fillStyle(0xffeebb);
    g.fillEllipse(cx, h - 22, 140, 44);
    // Grass
    g.fillStyle(0x3a7a2a);
    g.fillEllipse(cx, h - 40, 100, 36);
    g.fillStyle(0x4a8a3a);
    g.fillEllipse(cx - 10, h - 44, 60, 20);
    // Palm trees
    for (let i = 0; i < 3; i++) {
      const tx = cx - 30 + i * 30 + Phaser.Math.Between(-5, 5);
      g.fillStyle(0x4a2800);
      g.fillRect(tx - 1, h - 70 - i * 5, 3, 30 + i * 5);
      g.fillStyle(0x2a7a1a);
      g.fillEllipse(tx, h - 72 - i * 5, 20 + i * 3, 8);
      g.fillEllipse(tx + 4, h - 68 - i * 5, 16 + i * 2, 6);
    }
    // Treasure chest on island
    g.fillStyle(0xffd700);
    g.fillRect(cx - 6, h - 56, 12, 8);
    g.fillStyle(0xff4444);
    g.fillCircle(cx, h - 58, 2);
    // Shoreline foam
    g.fillStyle(0xffffff, 0.2);
    g.fillEllipse(cx, h - 6, 170, 10);

    g.generateTexture("treasure-island", w, h);
    g.destroy();
  }

  private generateFinishFlag(): void {
    const g = this.add.graphics();
    // Checkered pattern
    const s = 8;
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 4; y++) {
        g.fillStyle((x + y) % 2 === 0 ? 0xffffff : 0x222222);
        g.fillRect(x * s, y * s, s, s);
      }
    }
    g.generateTexture("finish-line", 128, 32);
    g.destroy();
  }

  private generateParticle(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff);
    g.fillCircle(2, 2, 2);
    g.generateTexture("particle", 4, 4);
    g.destroy();
  }

  private generateSail(): void {
    const g = this.add.graphics();
    // Triangular sail pointing up-right
    g.fillStyle(0xffd700, 0.7);
    g.fillTriangle(0, 20, 0, 0, 18, 0);
    g.fillStyle(0xffaa00, 0.5);
    g.fillTriangle(0, 16, 0, 2, 14, 2);
    g.lineStyle(1, 0xffd700, 0.8);
    g.lineBetween(0, 0, 0, 20);
    g.generateTexture("sail", 20, 22);
    g.destroy();
  }
}
