import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { createRaceRng, type RaceRng } from "../rng";

export class BootScene extends Phaser.Scene {
  private rng!: RaceRng;

  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    // Initialize deterministic RNG
    const urlSeed =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("seed")
        : null;
    const configSeed = (this.game.config as any).seed?.[0] ?? null;
    this.rng = createRaceRng(urlSeed ?? configSeed ?? "race-default");

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add
      .text(cx, cy, "Loading...", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffd700",
      })
      .setOrigin(0.5);

    this.generateTextures();
  }

  create(): void {
    this.children.removeAll(true);
    this.scene.start("RaceScene");
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
    this.generatePlayerShip();
    this.generateAIShip();
  }

  private generateOceanBg(): void {
    const g = this.add.graphics();
    const stripeH = GAME_HEIGHT / 12;
    const tropicColors = [
      0x071830, 0x0a2040, 0x0c2850, 0x0e3060, 0x103868, 0x0e3060, 0x0c2850,
      0x0a2040, 0x081c38, 0x0a2448, 0x0c2c58, 0x0e3460,
    ];
    for (let i = 0; i < tropicColors.length; i++) {
      g.fillStyle(tropicColors[i]);
      g.fillRect(0, i * stripeH, GAME_WIDTH, stripeH + 1);
    }

    // Nautical chart grid overlay (subtle)
    g.lineStyle(1, 0x2a6a8a, 0.05);
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      g.lineBetween(x, 0, x, GAME_HEIGHT);
    }
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      g.lineBetween(0, y, GAME_WIDTH, y);
    }

    // Large wave crests (rolling swells)
    for (let row = 0; row < 24; row++) {
      const wy = row * (GAME_HEIGHT / 24);
      for (let col = 0; col < GAME_WIDTH; col += 3) {
        const offset = Math.sin(col * 0.02 + row * 0.6 + row * 0.3) * 3;
        const alpha = 0.015 + (row % 3) * 0.004;
        g.fillStyle(0x88bbdd, alpha);
        g.fillEllipse(col, wy + offset, 5, 2);
      }
    }

    // Smaller wave ripples (foreground detail)
    for (let row = 0; row < 40; row++) {
      const wy = row * (GAME_HEIGHT / 40);
      for (let col = 0; col < GAME_WIDTH; col += 6) {
        const offset = Math.sin(col * 0.04 + row * 1.2) * 2;
        g.fillStyle(0xaaccee, 0.012 + (row % 4) * 0.002);
        g.fillEllipse(col, wy + offset, 3, 1);
      }
    }

    // Whitecap highlights (scattered)
    g.fillStyle(0xffffff, 0.04);
    for (let i = 0; i < 40; i++) {
      g.fillEllipse(
        this.rng.int(0, GAME_WIDTH),
        this.rng.int(0, GAME_HEIGHT),
        this.rng.int(4, 10),
        this.rng.int(1, 2),
      );
    }

    // Compass-rose markers (nautical chart feel)
    g.lineStyle(1, 0x3a8aaa, 0.07);
    g.strokeCircle(60, 60, 25);
    g.strokeCircle(60, 60, 15);
    g.lineBetween(60, 32, 60, 88);
    g.lineBetween(32, 60, 88, 60);

    // Secondary compass marker
    g.lineStyle(1, 0x3a8aaa, 0.05);
    g.strokeCircle(GAME_WIDTH - 60, GAME_HEIGHT - 60, 20);
    g.strokeCircle(GAME_WIDTH - 60, GAME_HEIGHT - 60, 12);

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
    // White outline for readability against dark ocean
    g.lineStyle(1, 0xffffff, 0.35);
    g.strokeRoundedRect(2, 4, 28, 22, 3);
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
    // White outline
    g.lineStyle(1, 0xffffff, 0.25);
    g.strokeRect(4, 8, 24, 20);
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
    // White sandy outline
    g.lineStyle(1, 0xffffff, 0.2);
    g.beginPath();
    g.arc(20, 18, 17, 0, Math.PI * 2);
    g.strokePath();
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
    // White outline
    g.lineStyle(1, 0xffffff, 0.3);
    g.strokeRect(2, 4, 20, 16);
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
      const tx = cx - 30 + i * 30 + this.rng.int(-5, 5);
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

  private generatePlayerShip(): void {
    const g = this.add.graphics();
    const w = 80;
    const h = 100;

    // Wake glow
    g.fillStyle(0xffd700, 0.05);
    g.fillEllipse(w / 2, h - 4, 60, 14);
    g.fillStyle(0xffffff, 0.07);
    g.fillEllipse(w / 2, h + 2, 44, 8);

    // Hull
    g.fillStyle(0x5c3a1e);
    g.beginPath();
    g.moveTo(6, h - 28);
    g.lineTo(w - 4, h - 28);
    g.lineTo(w - 2, h - 4);
    g.lineTo(4, h - 4);
    g.closePath();
    g.fillPath();

    // Gold stripe
    g.fillStyle(0xffd700);
    g.fillRect(8, h - 20, w - 14, 3);

    // Hull top edge
    g.fillStyle(0x7a4e28);
    g.fillRect(8, h - 28, w - 14, 2);

    // Deck
    g.fillStyle(0x8b6b3a);
    g.fillRect(8, h - 32, w - 14, 5);

    // Cabin
    g.fillStyle(0x6b4a2a);
    g.fillRect(w / 2 - 6, h - 40, 12, 10);
    g.fillStyle(0x8b6b3a);
    g.fillRect(w / 2 - 8, h - 42, 16, 4);
    g.fillStyle(0xffeecc);
    g.fillRect(w / 2 - 4, h - 36, 3, 3);
    g.fillRect(w / 2 + 1, h - 36, 3, 3);

    // White hull edge highlight
    g.lineStyle(1, 0xffffff, 0.15);
    g.beginPath();
    g.moveTo(6, h - 28);
    g.lineTo(w - 4, h - 28);
    g.lineTo(w - 2, h - 4);
    g.lineTo(4, h - 4);
    g.closePath();
    g.strokePath();

    // Mast
    g.fillStyle(0x4a2800);
    g.fillRect(w / 2 - 2, 8, 4, h - 40);

    // Crow's nest
    g.fillStyle(0x5c3a1e);
    g.fillRect(w / 2 - 5, 10, 10, 3);
    g.fillRect(w / 2 - 4, 8, 8, 3);

    // Sails
    g.fillStyle(0xfffaf0);
    g.beginPath();
    g.moveTo(w / 2 + 2, 14);
    g.lineTo(w / 2 + 24, 36);
    g.lineTo(w / 2 + 2, 52);
    g.closePath();
    g.fillPath();

    g.beginPath();
    g.moveTo(w / 2 - 2, 14);
    g.lineTo(w / 2 - 24, 36);
    g.lineTo(w / 2 - 2, 52);
    g.closePath();
    g.fillPath();

    g.fillStyle(0xffffff, 0.25);
    g.beginPath();
    g.moveTo(w / 2 + 2, 16);
    g.lineTo(w / 2 + 12, 30);
    g.lineTo(w / 2 + 2, 44);
    g.closePath();
    g.fillPath();

    g.fillStyle(0xfffaf0, 0.5);
    g.fillRect(w / 2 - 1, 10, 2, 42);

    // Bowsprit
    g.lineStyle(2, 0x4a2800);
    g.lineBetween(w / 2 + 4, h - 32, w - 4, h - 40);

    // Flag
    g.fillStyle(0xffd700);
    g.fillTriangle(w / 2 + 2, 8, w / 2 + 20, 4, w / 2 + 18, 16);
    g.fillStyle(0xffffff);
    g.fillCircle(w / 2 + 12, 8, 2.5);
    g.fillStyle(0x000000);
    g.fillRect(w / 2 + 10, 7, 4, 1);

    g.generateTexture("ship-player", w, h);
    g.destroy();
  }

  private generateAIShip(): void {
    const g = this.add.graphics();
    const w = 80;
    const h = 100;

    // Wake glow
    g.fillStyle(0xff4444, 0.04);
    g.fillEllipse(w / 2, h - 4, 56, 12);
    g.fillStyle(0xffffff, 0.06);
    g.fillEllipse(w / 2, h + 2, 40, 8);

    // Hull
    g.fillStyle(0x3a2810);
    g.beginPath();
    g.moveTo(6, h - 28);
    g.lineTo(w - 4, h - 28);
    g.lineTo(w - 2, h - 4);
    g.lineTo(4, h - 4);
    g.closePath();
    g.fillPath();

    // Red stripe
    g.fillStyle(0xff4444);
    g.fillRect(8, h - 20, w - 14, 3);

    // Hull top edge
    g.fillStyle(0x5a3a1a);
    g.fillRect(8, h - 28, w - 14, 2);

    // Deck
    g.fillStyle(0x6b4a2a);
    g.fillRect(8, h - 32, w - 14, 5);

    // Cabin
    g.fillStyle(0x4a2a10);
    g.fillRect(w / 2 - 6, h - 40, 12, 10);
    g.fillStyle(0x6b4a2a);
    g.fillRect(w / 2 - 8, h - 42, 16, 4);
    g.fillStyle(0xcc9966);
    g.fillRect(w / 2 - 4, h - 36, 3, 3);
    g.fillRect(w / 2 + 1, h - 36, 3, 3);

    // White hull edge highlight
    g.lineStyle(1, 0xffffff, 0.12);
    g.beginPath();
    g.moveTo(6, h - 28);
    g.lineTo(w - 4, h - 28);
    g.lineTo(w - 2, h - 4);
    g.lineTo(4, h - 4);
    g.closePath();
    g.strokePath();

    // Mast
    g.fillStyle(0x3a2010);
    g.fillRect(w / 2 - 2, 8, 4, h - 40);

    // Sails
    g.fillStyle(0xfff2e8);
    g.beginPath();
    g.moveTo(w / 2 + 2, 14);
    g.lineTo(w / 2 + 24, 36);
    g.lineTo(w / 2 + 2, 52);
    g.closePath();
    g.fillPath();

    g.beginPath();
    g.moveTo(w / 2 - 2, 14);
    g.lineTo(w / 2 - 24, 36);
    g.lineTo(w / 2 - 2, 52);
    g.closePath();
    g.fillPath();

    g.fillStyle(0xfff2e8, 0.5);
    g.fillRect(w / 2 - 1, 10, 2, 42);

    g.fillStyle(0xff4444, 0.25);
    g.beginPath();
    g.moveTo(w / 2 + 2, 14);
    g.lineTo(w / 2 + 22, 34);
    g.lineTo(w / 2 + 2, 50);
    g.closePath();
    g.fillPath();

    // Bowsprit
    g.lineStyle(2, 0x3a2010);
    g.lineBetween(w / 2 + 4, h - 32, w - 4, h - 40);

    // Flag
    g.fillStyle(0xff4444);
    g.fillTriangle(w / 2 + 2, 8, w / 2 + 20, 4, w / 2 + 18, 16);
    g.lineStyle(1.5, 0xffffff);
    g.lineBetween(w / 2 + 8, 6, w / 2 + 8, 12);
    g.lineBetween(w / 2 + 6, 8, w / 2 + 10, 8);

    g.generateTexture("ship-ai", w, h);
    g.destroy();
  }
}
