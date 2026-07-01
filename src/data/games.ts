import gamesData from "./games.json";

export type GameStatus =
  "browser-playable" | "desktop-available" | "browser-planned" | "experimental";

export type GameEngine = "pygbag" | "phaser";

export type ControlMode = "pong" | "breakout" | "asteroids" | "racer";

export type TouchDifficulty = "easy" | "medium" | "harder";

export interface Game {
  id: string;
  title: string;
  classic: string;
  description: string;
  status: GameStatus;
  statusLabel: string;
  desktopUrl?: string;
  browserUrl?: string;
  screenshot?: string;
  controlMode?: ControlMode;
  engine?: GameEngine;
  touchDifficulty?: TouchDifficulty;
  features?: string[];
  touchControls?: string;
  keyboardControls?: string;
  howToPlay?: string;
  tips?: string;
  firstPlayTip?: string;
  touchDifficultyLabel?: string;
  bestFor?: string;
  availabilityNote?: string;
  seoDescription?: string;
  demonstrates?: string[];
}

export const games: Game[] = gamesData as Game[];
