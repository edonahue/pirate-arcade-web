export type ControlMode = "pong" | "breakout" | "asteroids";

export type BrowserGameStatus = "browser-playable" | "experimental" | "planned";

export interface BrowserGameSpec {
  id: string;
  title: string;
  route: string;
  archivePath: string;
  controlMode: ControlMode;
  canvasWidth: number;
  canvasHeight: number;
  loadingTitle: string;
  touchHint: string;
  cdnVersion: string;
  status: BrowserGameStatus;
}

const CDN = "0.9.3";

export const browserGames: BrowserGameSpec[] = [
  {
    id: "cannonball-clash",
    title: "Cannonball Clash",
    route: "/play/cannonball-clash/",
    archivePath: "/play/cannonball-clash/cannonball-clash.tar.gz",
    controlMode: "pong",
    canvasWidth: 1600,
    canvasHeight: 900,
    loadingTitle: "Loading Cannonball Clash",
    touchHint: "Touch: slide ship up/down  •  START  •  ❚❚ pause",
    cdnVersion: CDN,
    status: "browser-playable",
  },
  {
    id: "treasure-cove",
    title: "Treasure Cove",
    route: "/play/treasure-cove/",
    archivePath: "/play/treasure-cove/treasure-cove.tar.gz",
    controlMode: "breakout",
    canvasWidth: 1600,
    canvasHeight: 900,
    loadingTitle: "Loading Treasure Cove",
    touchHint: "Touch: slide longboat left/right  •  LAUNCH  •  ❚❚ pause",
    cdnVersion: CDN,
    status: "browser-playable",
  },
  {
    id: "krakens-wake",
    title: "Kraken's Wake",
    route: "/play/krakens-wake/",
    archivePath: "/play/krakens-wake/krakens-wake.tar.gz",
    controlMode: "asteroids",
    canvasWidth: 1600,
    canvasHeight: 900,
    loadingTitle: "Loading Kraken's Wake",
    touchHint: "Touch: turn left/right  •  THRUST  •  FIRE  •  ❚❚ pause",
    cdnVersion: CDN,
    status: "browser-playable",
  },
];

export function getBrowserGame(id: string): BrowserGameSpec | undefined {
  return browserGames.find((g) => g.id === id);
}

export function getBrowserGameIds(): string[] {
  return browserGames.map((g) => g.id);
}
