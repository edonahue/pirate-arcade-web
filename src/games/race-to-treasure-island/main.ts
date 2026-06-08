import Phaser from "phaser";
import { createGameConfig } from "./config";
import { BootScene } from "./scenes/BootScene";
import { RaceScene } from "./scenes/RaceScene";

export function createRaceToTreasureIsland(
  parent: string,
  seed?: string,
  forceCanvas?: boolean,
): Phaser.Game {
  const config = createGameConfig(parent, seed);
  if (forceCanvas) {
    config.type = Phaser.CANVAS;
  }
  config.scene = [BootScene, RaceScene];
  return new Phaser.Game(config);
}
