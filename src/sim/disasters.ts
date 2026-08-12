/**
 * Storms -> river flooding -> (rare) earthquakes. Storms/flooding are
 * telegraphed with a warning window; earthquakes are rare and unwarned,
 * testing emergency infrastructure instead of prep.
 */

import type { Tile } from "../config/grid";
import type { Season } from "./time";

export interface RepairTicket {
  x: number;
  y: number;
  daysLeft: number;
}

export interface DisasterState {
  stormWarningDaysLeft: number;
  stormKind: "storm" | "snowmelt" | null;
  repairQueue: RepairTicket[];
  disasterPenalty: number; // feeds happiness, decays daily
  lastEventLog: string[];
}

export function createInitialDisasterState(): DisasterState {
  return {
    stormWarningDaysLeft: 0,
    stormKind: null,
    repairQueue: [],
    disasterPenalty: 0,
    lastEventLog: [],
  };
}

const FLOOD_ELEVATION_THRESHOLD = 2.2;
const EARTHQUAKE_ELEVATION_THRESHOLD = 4.5;
const DAILY_STORM_CHANCE = 0.012;
const DAILY_SNOWMELT_CHANCE = 0.006;
const DAILY_EARTHQUAKE_CHANCE = 0.0006; // very rare, per the GDD's balance note
const STORM_WARNING_DAYS = 4;
const SNOWMELT_WARNING_DAYS = 2;

export interface DisasterTickResult {
  messages: { text: string; severity: "warning" | "damage" }[];
  happinessPenaltyDelta: number;
}

export function tickDisasters(
  tiles: Tile[][],
  season: Season,
  fireResponseFast: boolean,
  rand: () => number,
  state: DisasterState,
): DisasterTickResult {
  const messages: { text: string; severity: "warning" | "damage" }[] = [];

  // Advance repairs first.
  state.repairQueue = state.repairQueue.filter((ticket) => {
    ticket.daysLeft -= fireResponseFast ? 2 : 1;
    if (ticket.daysLeft <= 0) {
      const tile = tiles[ticket.y]?.[ticket.x];
      if (tile) tile.damaged = false;
      return false;
    }
    return true;
  });

  // Decay lingering happiness penalty from past disasters.
  state.disasterPenalty = Math.max(0, state.disasterPenalty - 0.15);

  if (state.stormWarningDaysLeft > 0) {
    state.stormWarningDaysLeft--;
    if (state.stormWarningDaysLeft === 0) {
      const kind = state.stormKind;
      state.stormKind = null;
      const willFlood = rand() < (kind === "storm" ? 0.7 : 0.5);
      if (willFlood) {
        const damaged = floodRiverside(tiles, state, rand);
        if (damaged > 0) {
          messages.push({
            text:
              kind === "storm"
                ? `The river overflowed its banks — ${damaged} riverside tile(s) flooded.`
                : `Spring snowmelt pushed the river over its banks — ${damaged} tile(s) flooded.`,
            severity: "damage",
          });
          state.disasterPenalty = Math.min(30, state.disasterPenalty + damaged * 2);
        }
      } else {
        messages.push({ text: "The storm passed without major flooding.", severity: "warning" });
      }
    }
  } else {
    const stormSeason = season === "summer" || season === "fall";
    if (stormSeason && rand() < DAILY_STORM_CHANCE) {
      state.stormWarningDaysLeft = STORM_WARNING_DAYS;
      state.stormKind = "storm";
      messages.push({
        text: `Storm system approaching — heavy rain expected in ${STORM_WARNING_DAYS} days. River flooding possible.`,
        severity: "warning",
      });
    } else if (season === "spring" && rand() < DAILY_SNOWMELT_CHANCE) {
      state.stormWarningDaysLeft = SNOWMELT_WARNING_DAYS;
      state.stormKind = "snowmelt";
      messages.push({
        text: `Snowmelt is raising the river — possible flooding in ${SNOWMELT_WARNING_DAYS} days.`,
        severity: "warning",
      });
    }
  }

  // Earthquakes: rare, no warning, hits hillside/mountain zoned/built tiles.
  if (rand() < DAILY_EARTHQUAKE_CHANCE) {
    const damaged = earthquakeDamage(tiles, state, rand);
    if (damaged > 0) {
      messages.push({
        text: `Earthquake! ${damaged} hillside/mountain structure(s) damaged.`,
        severity: "damage",
      });
      state.disasterPenalty = Math.min(30, state.disasterPenalty + damaged * 3);
    }
  }

  return { messages, happinessPenaltyDelta: 0 };
}

function queueRepair(state: DisasterState, tile: Tile, rand: () => number) {
  tile.damaged = true;
  state.repairQueue.push({ x: tile.x, y: tile.y, daysLeft: 20 + Math.floor(rand() * 10) });
}

function floodRiverside(tiles: Tile[][], state: DisasterState, rand: () => number): number {
  let count = 0;
  for (const row of tiles) {
    for (const tile of row) {
      if (tile.damaged) continue;
      if (tile.terrain !== "riverside") continue;
      if (tile.elevation >= FLOOD_ELEVATION_THRESHOLD) continue;
      if (tile.zone === "none" && !tile.building) continue;
      if (rand() < 0.6) {
        queueRepair(state, tile, rand);
        count++;
      }
    }
  }
  return count;
}

function earthquakeDamage(tiles: Tile[][], state: DisasterState, rand: () => number): number {
  let count = 0;
  for (const row of tiles) {
    for (const tile of row) {
      if (tile.damaged) continue;
      if (tile.terrain !== "hillside" && tile.terrain !== "mountain") continue;
      if (tile.elevation < EARTHQUAKE_ELEVATION_THRESHOLD) continue;
      if (tile.zone === "none" && !tile.building) continue;
      if (rand() < 0.35) {
        queueRepair(state, tile, rand);
        count++;
      }
    }
  }
  return count;
}
