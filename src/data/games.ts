export type GameStatus = "desktop-available" | "browser-planned" | "experimental";

export interface Game {
  id: string;
  title: string;
  classic: string;
  description: string;
  status: GameStatus;
  statusLabel: string;
  desktopUrl?: string;
  screenshot?: string;
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
    desktopUrl:
      "https://github.com/edonahue/pirate-arcade/releases",
    screenshot: "/images/screenshot-cannonball-clash.svg",
  },
  {
    id: "treasure-cove",
    title: "Treasure Cove",
    classic: "Breakout",
    description:
      "Smash through fort defenses to reach the loot. Each brick is a barrier between you and the treasure hoard.",
    status: "desktop-available",
    statusLabel: "Desktop app available",
    desktopUrl:
      "https://github.com/edonahue/pirate-arcade/releases",
    screenshot: "/images/screenshot-treasure-cove.svg",
  },
  {
    id: "krakens-wake",
    title: "Kraken\u2019s Wake",
    classic: "Asteroids",
    description:
      "Navigate treacherous waters and blast sea monsters. Watch for the Kraken — it hits hard.",
    status: "desktop-available",
    statusLabel: "Desktop app available",
    desktopUrl:
      "https://github.com/edonahue/pirate-arcade/releases",
    screenshot: "/images/screenshot-krakens-wake.svg",
  },
  {
    id: "port-royale-tycoon",
    title: "Port Royale Tycoon",
    classic: "Monopoly",
    description:
      "Buy ports, build trade empires, and rule the seas. Outsmart rival captains and become the wealthiest pirate on the map.",
    status: "desktop-available",
    statusLabel: "Desktop app available",
    desktopUrl:
      "https://github.com/edonahue/pirate-arcade/releases",
    screenshot: "/images/screenshot-port-royale-tycoon.svg",
  },
];
