// Project-owned deterministic PRNG for Race to Treasure Island.
//
// Why not Phaser.Math.RandomDataGenerator?
//   Phaser's built-in RNG may produce different sequences across
//   browser/Node versions or Phaser releases.  A small project-owned
//   mulberry32 ensures obstacle type, position, AI behaviour, and
//   cosmetic randomness are identical for the same seed string
//   regardless of the Phaser version or runtime environment.
//
// This matters for:
//   - Deterministic Race screenshot capture
//   - Reproducible test assertions
//   - Stable demo / preview mode
//
// RNG stream forking:
//   A single seed is split into independent streams via fork(key).
//   Each stream key produces a different deterministic sequence, so
//   adding/removing RNG calls in one domain (e.g. cosmetics) never
//   shifts the sequence used by another domain (e.g. course layout).
//     courseRng    = base.fork("course")
//     aiRng        = base.fork("ai")
//     cosmeticRng  = base.fork("cosmetic")
//     textureRng   = base.fork("texture")

const RNG_VERSION = "mulberry32-v1";

function hashStringToSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RaceRng {
  float(): number;
  int(min: number, max: number): number;
  choose<T>(items: T[]): T;
  /** Create a derived RNG stream for an independent domain. */
  fork(key: string): RaceRng;
  version: string;
  /** The raw seed text this RNG was created from (for forking). */
  _seedText: string;
}

export function createRaceRng(seedText: string): RaceRng {
  const seed = hashStringToSeed(seedText);
  const rng = mulberry32(seed);
  return {
    float: (): number => rng(),
    int: (min: number, max: number): number =>
      Math.floor(rng() * (max - min + 1)) + min,
    choose: <T>(items: T[]): T => items[Math.floor(rng() * items.length)],
    fork: (key: string): RaceRng => createRaceRng(seedText + ":" + key),
    version: RNG_VERSION,
    _seedText: seedText,
  };
}
