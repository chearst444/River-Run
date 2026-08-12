/**
 * Fast-ticking in-game clock. Tropico-style: years pass quickly in real
 * time so a 4-year election term is a short, playable stretch rather than
 * a long wait.
 */

export type Season = "spring" | "summer" | "fall" | "winter";

export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;
export const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR;

/**
 * Real seconds per in-game day at the historical "1x" pace. Speed values
 * below are multipliers of this baseline — kept as the reference point so
 * the two fast tiers (2/4) stay byte-for-byte the same real-world pace
 * they always were, even though the new default (0.5) and slow (0.25)
 * tiers sit underneath it.
 */
export const SECONDS_PER_DAY_AT_1X = 0.3;

/** 0 = paused, 0.25 = Slow, 0.5 = Normal (default), 2 = Fast, 4 = Faster. */
export type GameSpeed = 0 | 0.25 | 0.5 | 2 | 4;

export interface GameTime {
  totalDays: number; // days since game start
  day: number; // 1-30 within month
  month: number; // 1-12
  year: number; // starting at 1
  season: Season;
}

export function seasonForMonth(month: number): Season {
  if (month <= 3) return "spring";
  if (month <= 6) return "summer";
  if (month <= 9) return "fall";
  return "winter";
}

export function createInitialTime(): GameTime {
  return { totalDays: 0, day: 1, month: 1, year: 1, season: "spring" };
}

export function timeFromTotalDays(totalDays: number): GameTime {
  const dayOfYear = totalDays % DAYS_PER_YEAR;
  const year = Math.floor(totalDays / DAYS_PER_YEAR) + 1;
  const month = Math.floor(dayOfYear / DAYS_PER_MONTH) + 1;
  const day = (dayOfYear % DAYS_PER_MONTH) + 1;
  return { totalDays, day, month, year, season: seasonForMonth(month) };
}

export function formatDate(time: GameTime): string {
  const seasonLabel = time.season[0].toUpperCase() + time.season.slice(1);
  return `${seasonLabel} — Year ${time.year}, Month ${time.month}, Day ${time.day}`;
}
