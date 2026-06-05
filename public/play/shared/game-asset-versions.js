// Game asset versions - single source of truth for cache busting
// Update this value when making changes that require cache invalidation

export const ASSET_VERSION = "mobile-v4";
export const CACHE_VERSION = "pirate-arcade-games-v7";

// Derived values for convenience
export const GAME_ASSET_VERSION = ASSET_VERSION;
export const CONTROLS_VERSION = ASSET_VERSION;
export const INPUT_BRIDGE_VERSION = ASSET_VERSION;
export const GAME_VIEWPORT_VERSION = ASSET_VERSION;

// Export as object for easier consumption
export default {
  ASSET_VERSION,
  CACHE_VERSION,
  GAME_ASSET_VERSION,
  CONTROLS_VERSION,
  INPUT_BRIDGE_VERSION,
  GAME_VIEWPORT_VERSION,
};