export type GameStatus =
  | "desktop-available"
  | "browser-planned"
  | "experimental";

export interface Game {
  id: string;
  title: string;
  classic: string;
  description: string;
  status: GameStatus;
  statusLabel: string;
  desktopUrl?: string;
  screenshot?: string;
  features?: string[];
}

export const games: Game[] = [
  {
    id: "cannonball-clash",
    title: "Cannonball Clash",
    classic: "Pong",
    description:
      "Naval cannon duel. Defend your fortress and sink your opponent's ship with well-aimed shots. First to 11 hits wins the sea.",
    status: "desktop-available",
    statusLabel: "Desktop app available",
    desktopUrl: "https://github.com/edonahue/pirate-arcade/releases",
    screenshot: "/images/screenshot-cannonball-clash.png",
    features: ["1-2 players", "AI opponent", "Power-ups", "Procedural audio"],
  },
  {
    id: "treasure-cove",
    title: "Treasure Cove",
    classic: "Breakout",
    description:
      "Smash through fort defenses to reach the loot. Each brick is a barrier between you and the treasure hoard.",
    status: "desktop-available",
    statusLabel: "Desktop app available",
    desktopUrl: "https://github.com/edonahue/pirate-arcade/releases",
    screenshot: "/images/screenshot-treasure-cove.png",
    features: [
      "8 brick rows",
      "Score combos",
      "Paddle power-up",
      "Procedural audio",
    ],
  },
  {
    id: "krakens-wake",
    title: "Kraken\u2019s Wake",
    classic: "Asteroids",
    description:
      "Navigate treacherous waters and blast sea monsters. Watch for the Kraken — it hits hard.",
    status: "desktop-available",
    statusLabel: "Desktop app available",
    desktopUrl: "https://github.com/edonahue/pirate-arcade/releases",
    screenshot: "/images/screenshot-krakens-wake.png",
    features: ["Ship combat", "Wave survival", "Treasure pickups", "3 lives"],
  },
  {
    id: "port-royale-tycoon",
    title: "Port Royale Tycoon",
    classic: "Property-trading board game",
    description:
      "Buy ports, build trade empires, and rule the seas. Outsmart rival captains and become the wealthiest pirate on the map.",
    status: "desktop-available",
    statusLabel: "Desktop app available",
    desktopUrl: "https://github.com/edonahue/pirate-arcade/releases",
    screenshot: "/images/screenshot-port-royale-tycoon.png",
    features: ["2-4 players", "AI opponents", "Save/load", "Property trading"],
  },
];
