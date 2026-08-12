/** Save/load the whole GameState to/from browser localStorage. */

import type { GameState } from "./state";
import type { ProposalId } from "./decisionEvents";
import { MAP_WIDTH, MAP_HEIGHT } from "../config/grid";

const SAVE_KEY = "river-run-save-v1";

// Sets aren't JSON-native, so decisionEvents.offered needs an explicit
// array <-> Set conversion on the way in/out of storage.
type SerializedGameState = Omit<GameState, "decisionEvents"> & {
  decisionEvents: Omit<GameState["decisionEvents"], "offered"> & { offered: string[] };
};

export function saveGame(state: GameState): boolean {
  try {
    const serializable: SerializedGameState = {
      ...state,
      decisionEvents: {
        ...state.decisionEvents,
        offered: Array.from(state.decisionEvents.offered),
      },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(serializable));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SerializedGameState;
    // A save from before a map-size change (tile size/count) has the
    // wrong grid shape for the current build — refuse it rather than
    // rendering/indexing garbage.
    if (parsed.tiles?.length !== MAP_HEIGHT || parsed.tiles?.[0]?.length !== MAP_WIDTH) {
      return null;
    }
    return {
      ...parsed,
      decisionEvents: {
        ...parsed.decisionEvents,
        offered: new Set(parsed.decisionEvents.offered as ProposalId[]),
      },
    };
  } catch {
    return null;
  }
}

export function hasSavedGame(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
