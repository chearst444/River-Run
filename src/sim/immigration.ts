/**
 * Periodic "newcomers arrive" events. A real management lever, not
 * automatic: the player chooses to welcome (grows population faster, but
 * only if housing/jobs exist) or restrict (slower growth, but plays well
 * with residents wary of rapid change).
 */

export interface ImmigrationWave {
  size: number;
}

export interface ImmigrationState {
  daysUntilNextWave: number;
  pendingWave: ImmigrationWave | null;
}

export function createInitialImmigrationState(rand: () => number): ImmigrationState {
  return { daysUntilNextWave: 60 + Math.floor(rand() * 60), pendingWave: null };
}

/** Returns a wave to present to the player, or null if none is due yet. */
export function tickImmigration(
  state: ImmigrationState,
  rand: () => number,
): ImmigrationWave | null {
  if (state.pendingWave) return null;
  state.daysUntilNextWave--;
  if (state.daysUntilNextWave > 0) return null;
  const wave: ImmigrationWave = { size: 8 + Math.floor(rand() * 18) };
  state.pendingWave = wave;
  return wave;
}

export interface ImmigrationOutcome {
  populationDelta: number;
  approvalDelta: number;
  message: string;
}

export function resolveImmigration(
  state: ImmigrationState,
  wave: ImmigrationWave,
  choice: "welcome" | "restrict",
  spareHousing: number,
  rand: () => number,
): ImmigrationOutcome {
  state.pendingWave = null;
  state.daysUntilNextWave = 60 + Math.floor(rand() * 60);

  if (choice === "welcome") {
    const admitted = Math.max(0, Math.round(Math.min(wave.size, spareHousing)));
    return {
      populationDelta: admitted,
      approvalDelta: admitted > 0 ? 2 : -1,
      message:
        admitted > 0
          ? `Welcomed ${admitted} newcomers to River Run.`
          : "Welcomed newcomers, but there's no housing for them yet — they moved on.",
    };
  }

  return {
    populationDelta: 0,
    approvalDelta: 1,
    message: "Turned the newcomers away. Some residents approve of the caution.",
  };
}
