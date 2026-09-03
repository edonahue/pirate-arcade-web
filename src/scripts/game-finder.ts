import type { Game } from "../data/games";

export type ControlPreference = "touch" | "keyboard" | "any";
export type LoadPreference = "instant" | "runtime-ok" | "any";
export type ChallengePreference = "easier" | "balanced" | "harder" | "any";

export interface GameFinderPreferences {
  control?: ControlPreference;
  load?: LoadPreference;
  challenge?: ChallengePreference;
}

export interface GameRecommendation {
  game: Game;
  reason: string;
}

/**
 * Recommend a game from explicit registry metadata only.
 *
 * - `load: "instant"` is a hard filter: only instantly-starting games
 *   (currently `engine === "phaser"`) are eligible. `runtime-ok`/`any`
 *   express no load constraint and add no points.
 * - `challenge` matches the registry `challenge` field (gameplay
 *   challenge), never `touchDifficulty`.
 * - `control: "touch"` matches the registry `touchDifficulty` field.
 * - `control: "keyboard"` adds no points: every browser game ships full
 *   keyboard controls, so keyboard preference carries no ranking signal
 *   and must never produce a superiority claim.
 * - Ties resolve by registry order (deterministic).
 */
function scoreGame(game: Game, prefs: GameFinderPreferences): number {
  let score = 0;

  if (prefs.control === "touch") {
    if (game.touchDifficulty === "easy") score += 20;
    else if (game.touchDifficulty === "medium") score += 10;
  }

  if (prefs.challenge === "easier" && game.challenge === "easier") score += 30;
  if (prefs.challenge === "balanced" && game.challenge === "balanced")
    score += 30;
  if (prefs.challenge === "harder" && game.challenge === "harder") score += 30;

  return score;
}

function buildReason(game: Game, prefs: GameFinderPreferences): string {
  const parts: string[] = [];
  if (prefs.load === "instant" && game.engine === "phaser")
    parts.push("instant load");
  if (prefs.control === "touch" && game.touchDifficulty === "easy")
    parts.push("easiest touch controls");
  if (prefs.control === "touch" && game.touchDifficulty === "medium")
    parts.push("comfortable on touch");
  if (prefs.control === "keyboard" && game.keyboardControls)
    parts.push("full keyboard controls");
  if (prefs.challenge === "easier" && game.challenge === "easier")
    parts.push("easier challenge");
  if (prefs.challenge === "balanced" && game.challenge === "balanced")
    parts.push("balanced challenge");
  if (prefs.challenge === "harder" && game.challenge === "harder")
    parts.push("harder challenge");
  if (parts.length === 0) parts.push("good match");
  return parts.join(", ");
}

export function recommendGame(
  allGames: readonly Game[],
  preferences: GameFinderPreferences = {},
): GameRecommendation {
  let candidates = allGames.filter(
    (g): g is Game & { browserUrl: string } =>
      g.status === "browser-playable" && !!g.browserUrl,
  );

  if (preferences.load === "instant") {
    candidates = candidates.filter((g) => g.engine === "phaser");
  }

  if (candidates.length === 0) {
    throw new Error(
      "No browser-playable games with a browserUrl are available.",
    );
  }

  let best = candidates[0];
  let bestScore = scoreGame(best, preferences);

  for (let i = 1; i < candidates.length; i++) {
    const current = candidates[i];
    const currentScore = scoreGame(current, preferences);
    if (currentScore > bestScore) {
      best = current;
      bestScore = currentScore;
    }
  }

  return { game: best, reason: buildReason(best, preferences) };
}
