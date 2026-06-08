import Phaser from "phaser";
import { createGameConfig } from "./config";
import { BootScene } from "./scenes/BootScene";
import { RaceScene } from "./scenes/RaceScene";

export function createRaceToTreasureIsland(
  parent: string,
  seed?: string,
): Phaser.Game {
  const config = createGameConfig(parent, seed);
  config.scene = [BootScene, RaceScene];
  return new Phaser.Game(config);
}
