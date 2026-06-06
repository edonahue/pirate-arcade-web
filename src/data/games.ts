import gamesData from "./games.json";

export type GameStatus =
  | "browser-playable"
  | "desktop-available"
  | "browser-planned"
  | "experimental";

export type ControlMode = "pong" | "breakout" | "asteroids";

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
  features?: string[];
}

export const games: Game[] = gamesData as Game[];
