import Phaser from "phaser";

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 720;

export function createGameConfig(
  parent: string,
  seed?: string,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent,
    backgroundColor: "#0a1628",
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    seed: seed ? [seed] : undefined,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [],
  };
}
