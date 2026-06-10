import { RACE_TUNING } from "./tuning";

export type ObstacleType = "barrel" | "shipwreck" | "reef" | "debris";

export function getBoostVisualBonus(boosting: boolean): number {
  return boosting ? RACE_TUNING.boostVisualSpeedBonus : 0;
}

export function getEffectiveWorldSpeed(
  scrollSpeed: number,
  boosting: boolean,
): number {
  return scrollSpeed + getBoostVisualBonus(boosting);
}

export function getPlayerProgressRate(
  scrollSpeed: number,
  boosting: boolean,
  stunActive: boolean,
): number {
  const bonus = boosting ? RACE_TUNING.boostProgressBonus : 0;
  const progressGain =
    RACE_TUNING.baseProgressRate +
    (scrollSpeed - RACE_TUNING.baseScrollSpeed) * 0.5 +
    bonus;
  const stunFactor = stunActive ? RACE_TUNING.stunSteerFactor : 1;
  return progressGain * stunFactor;
}

export function getRivalProgressRate(
  scrollSpeed: number,
  aiMistakeActive: boolean,
): number {
  const penalty = aiMistakeActive ? 40 : 0;
  return (
    RACE_TUNING.aiBaseRate +
    (scrollSpeed - RACE_TUNING.baseScrollSpeed) * 0.45 -
    penalty
  );
}

export function getLeadState(delta: number): "player" | "rival" | "tied" {
  if (delta > RACE_TUNING.overtakeLeadThreshold) return "player";
  if (delta < -RACE_TUNING.overtakeLeadThreshold) return "rival";
  return "tied";
}
