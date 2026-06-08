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
        fontSize: "20px",
        color: "#ffd700",
      })
      .setOrigin(0.5);

    this.generateTextures();
  }

  create(): void {
    // Clear loading text
    this.children.removeAll(true);
    this.scene.start("RaceScene");
  }

  private generateTextures(): void {
    this.generateOceanBg();
    this.generatePlayerShip();
    this.generateAIShip();
    this.generateRock();
    this.generateWhirlpool();
    this.generateBarrel();
    this.generateTreasureChest();
    this.generateBoostBar();
    this.generateFinishLine();
    this.generateParticle();
  }

  private generateOceanBg(): void {
    const g = this.add.graphics();
    const colors = [0x0a1628, 0x0d1f3c, 0x0f2a4a, 0x123558];
    const stripeH = GAME_HEIGHT / colors.length;
    for (let i = 0; i < colors.length; i++) {
      g.fillStyle(colors[i]);
      g.fillRect(0, i * stripeH, GAME_WIDTH, stripeH + 1);
    }
    g.generateTexture("ocean-bg", GAME_WIDTH, GAME_HEIGHT);
    g.destroy();
  }

  private generatePlayerShip(): void {
    const g = this.add.graphics();
    g.fillStyle(0x8b4513);
    g.fillRect(8, 24, 32, 20);
    g.fillStyle(0xa0522d);
    g.fillRect(12, 28, 24, 12);
    g.fillStyle(0xf5f5dc);
    g.fillTriangle(24, 4, 8, 28, 40, 28);
    g.fillStyle(0x4a2800);
    g.fillRect(22, 4, 4, 36);
    g.fillStyle(0xdc143c);
    g.fillTriangle(26, 4, 26, 14, 38, 9);
    g.fillStyle(0x2a1500);
    g.fillCircle(14, 32, 2);
    g.fillCircle(34, 32, 2);

    g.generateTexture("ship-player", 48, 48);
    g.destroy();
  }

  private generateAIShip(): void {
    const g = this.add.graphics();
    g.fillStyle(0x4a0000);
    g.fillRect(8, 24, 32, 20);
    g.fillStyle(0x600000);
    g.fillRect(12, 28, 24, 12);
    g.fillStyle(0x222222);
    g.fillTriangle(24, 4, 8, 28, 40, 28);
    g.fillStyle(0x3a1800);
    g.fillRect(22, 4, 4, 36);
    g.fillStyle(0xffffff);
    g.fillRect(26, 4, 10, 8);
    g.fillStyle(0x000000);
    g.fillRect(28, 6, 6, 4);

    g.generateTexture("ship-ai", 48, 48);
    g.destroy();
  }

  private generateRock(): void {
    const g = this.add.graphics();
    g.fillStyle(0x555555);
    g.fillEllipse(20, 18, 36, 28);
    g.fillStyle(0x666666);
    g.fillEllipse(14, 14, 16, 12);
    g.fillStyle(0x444444);
    g.fillEllipse(24, 22, 18, 14);

    g.generateTexture("rock", 40, 36);
    g.destroy();
  }

  private generateWhirlpool(): void {
    const g = this.add.graphics();
    g.fillStyle(0x1a3a5c);
    g.fillEllipse(20, 20, 40, 40);
    g.fillStyle(0x0d2b4a);
    g.fillEllipse(20, 20, 28, 28);
    g.fillStyle(0x0a1e3a);
    g.fillEllipse(20, 20, 16, 16);
    g.fillStyle(0x06152a);
    g.fillEllipse(20, 20, 6, 6);

    g.generateTexture("whirlpool", 40, 40);
    g.destroy();
  }

  private generateBarrel(): void {
    const g = this.add.graphics();
    g.fillStyle(0x8b6914);
    g.fillRect(4, 0, 24, 28);
    g.fillStyle(0x6b4f10);
    g.fillRect(4, 0, 24, 4);
    g.fillRect(4, 24, 24, 4);
    g.lineStyle(2, 0x4a3508);
    g.strokeCircle(16, 8, 2);
    g.strokeCircle(16, 18, 2);

    g.generateTexture("barrel", 32, 28);
    g.destroy();
  }

  private generateTreasureChest(): void {
    const g = this.add.graphics();
    g.fillStyle(0x8b6914);
    g.fillRect(2, 10, 28, 18);
    g.fillStyle(0xa07818);
    g.fillRect(0, 2, 32, 10);
    g.fillStyle(0xffd700);
    g.fillRect(13, 12, 6, 6);
    g.fillStyle(0x8b6914);
    g.fillRect(14, 14, 4, 4);
    g.fillStyle(0xffeb3b);
    g.fillCircle(16, 8, 3);

    g.generateTexture("treasure", 32, 30);
    g.destroy();
  }

  private generateBoostBar(): void {
    const g = this.add.graphics();
    g.fillStyle(0x333333);
    g.fillRect(0, 0, 100, 12);
    g.lineStyle(1, 0x666666);
    g.strokeRect(0, 0, 100, 12);
    g.generateTexture("boost-bar-bg", 100, 12);
    g.destroy();

    const g2 = this.add.graphics();
    g2.fillStyle(0x00ccff);
    g2.fillRect(0, 0, 100, 12);
    g2.generateTexture("boost-bar-fill", 100, 12);
    g2.destroy();
  }

  private generateFinishLine(): void {
    const g = this.add.graphics();
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 2; y++) {
        g.fillStyle((x + y) % 2 === 0 ? 0xffffff : 0x222222);
        g.fillRect(x * 15, y * 15, 15, 15);
      }
    }
    g.generateTexture("finish-line", 120, 30);
    g.destroy();
  }

  private generateParticle(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff);
    g.fillCircle(2, 2, 2);
    g.generateTexture("particle", 4, 4);
    g.destroy();
  }
}
