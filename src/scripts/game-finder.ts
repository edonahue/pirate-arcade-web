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

function scoreGame(game: Game, prefs: GameFinderPreferences): number {
  let score = 0;

  if (prefs.load === "instant" && game.engine === "phaser") score += 100;
  if (prefs.load === "runtime-ok" && game.engine === "pygbag") score += 1;

  if (prefs.control === "touch") {
    if (game.touchDifficulty === "easy") score += 50;
    else if (game.touchDifficulty === "medium") score += 25;
  }
  if (prefs.control === "keyboard") {
    if (game.touchDifficulty === "harder") score += 50;
    else if (game.touchDifficulty === "medium") score += 25;
    else if (game.touchDifficulty === "easy") score += 10;
  }

  if (prefs.challenge === "easier" && game.touchDifficulty === "easy")
    score += 30;
  if (prefs.challenge === "balanced" && game.touchDifficulty === "medium")
    score += 30;
  if (prefs.challenge === "harder" && game.touchDifficulty === "harder")
    score += 30;

  return score;
}

function buildReason(game: Game, prefs: GameFinderPreferences): string {
  const parts: string[] = [];
  if (prefs.load === "instant" && game.engine === "phaser")
    parts.push("instant load");
  if (prefs.control === "touch" && game.touchDifficulty === "easy")
    parts.push("touch-friendly");
  if (prefs.control === "keyboard" && game.touchDifficulty === "harder")
    parts.push("keyboard-optimized");
  if (prefs.challenge === "easier" && game.touchDifficulty === "easy")
    parts.push("easier challenge");
  if (prefs.challenge === "balanced" && game.touchDifficulty === "medium")
    parts.push("balanced challenge");
  if (prefs.challenge === "harder" && game.touchDifficulty === "harder")
    parts.push("harder challenge");
  if (parts.length === 0) parts.push("good match");
  return parts.join(", ");
}

export function recommendGame(
  allGames: readonly Game[],
  preferences: GameFinderPreferences = {},
): GameRecommendation {
  const candidates = allGames.filter(
    (g): g is Game & { browserUrl: string } =>
      g.status === "browser-playable" && !!g.browserUrl,
  );

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
