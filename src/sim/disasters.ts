/**
 * Storms -> river flooding -> (rare) earthquakes -> (rarer still) a major
 * fire or flood catastrophe. Storms/flooding are telegraphed with a
 * warning window; earthquakes and major disasters are unwarned. The minor
 * flood/earthquake damage above just queues a timed repair; a major
 * disaster is a different order of consequence — it destroys standing
 * buildings outright, with no auto-repair. The player has to rebuild.
 */

import type { Tile } from "../config/grid";
import { DAYS_PER_MONTH, type Season } from "./time";

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
  /** Absolute day (GameTime.totalDays) the next major fire/flood catastrophe fires. */
  nextMajorDisasterDay: number;
}

// The next major disaster's timing is re-randomized every time one fires —
// not a fixed schedule, so the town can never fully predict when the next
// one lands, just that it won't be sooner than ~5 months or later than ~2 years.
const MAJOR_DISASTER_MIN_MONTHS = 5;
const MAJOR_DISASTER_MAX_MONTHS = 24;
const MAJOR_DISASTER_MIN_BUILDINGS_LOST = 2;
const MAJOR_DISASTER_MAX_BUILDINGS_LOST = 5;

function randomMajorDisasterInterval(rand: () => number): number {
  const months =
    MAJOR_DISASTER_MIN_MONTHS +
    Math.floor(rand() * (MAJOR_DISASTER_MAX_MONTHS - MAJOR_DISASTER_MIN_MONTHS + 1));
  return months * DAYS_PER_MONTH;
}

export function createInitialDisasterState(rand: () => number): DisasterState {
  return {
    stormWarningDaysLeft: 0,
    stormKind: null,
    repairQueue: [],
    disasterPenalty: 0,
    lastEventLog: [],
    nextMajorDisasterDay: randomMajorDisasterInterval(rand),
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
  totalDays: number,
  rand: () => number,
  state: DisasterState,
): DisasterTickResult {
  // A save from before this feature existed won't have this field —
  // self-heal instead of the comparison below silently never firing.
  if (!state.nextMajorDisasterDay) {
    state.nextMajorDisasterDay = totalDays + randomMajorDisasterInterval(rand);
  }

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

  // The major catastrophe: unwarned, on its own irregular multi-month
  // schedule, and an outright loss rather than a timed repair.
  if (totalDays >= state.nextMajorDisasterDay) {
    const lost = triggerMajorDisaster(tiles, fireResponseFast, rand);
    if (lost.count > 0) {
      messages.push({
        text:
          lost.kind === "fire"
            ? `Fire tore through town — ${lost.count} building(s) burned down and will need to be rebuilt.`
            : `A major flood swept through — ${lost.count} riverside building(s) were destroyed and will need to be rebuilt.`,
        severity: "damage",
      });
      state.disasterPenalty = Math.min(40, state.disasterPenalty + lost.count * 4);
    }
    state.nextMajorDisasterDay = totalDays + randomMajorDisasterInterval(rand);
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

/** Picks up to `count` random eligible tiles, Fisher-Yates style — order doesn't otherwise matter. */
function pickRandomTiles(eligible: Tile[], count: number, rand: () => number): Tile[] {
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  return eligible.slice(0, count);
}

/**
 * The rare catastrophe: fire or flood, picked at random, that destroys
 * several standing buildings outright rather than just damaging them.
 * Flood only ever hits riverside buildings, same footprint as the minor
 * flood above; fire can hit anywhere except a covered bridge (losing a
 * bridge mid-game breaks road connectivity in a way that feels like a
 * bug, not a consequence, so it's exempt). A real fire_station_full
 * knocks one building off the loss count, floor 1 — the same tier that
 * already speeds up ordinary repairs.
 */
function triggerMajorDisaster(
  tiles: Tile[][],
  hasFullFireCrew: boolean,
  rand: () => number,
): { kind: "fire" | "flood"; count: number } {
  const kind: "fire" | "flood" = rand() < 0.5 ? "fire" : "flood";
  const baseCount =
    MAJOR_DISASTER_MIN_BUILDINGS_LOST +
    Math.floor(rand() * (MAJOR_DISASTER_MAX_BUILDINGS_LOST - MAJOR_DISASTER_MIN_BUILDINGS_LOST + 1));
  const wantCount = kind === "fire" && hasFullFireCrew ? Math.max(1, baseCount - 1) : baseCount;

  const riverside: Tile[] = [];
  const anyBuilding: Tile[] = [];
  for (const row of tiles) {
    for (const tile of row) {
      if (!tile.building || tile.building === "covered_bridge") continue;
      anyBuilding.push(tile);
      if (tile.terrain === "riverside") riverside.push(tile);
    }
  }

  // A "flood" with no riverside buildings standing is a non-event — treat
  // it as a fire instead rather than silently doing nothing.
  const pool = kind === "flood" && riverside.length > 0 ? riverside : anyBuilding;
  const actualKind: "fire" | "flood" = kind === "flood" && riverside.length === 0 ? "fire" : kind;

  const targets = pickRandomTiles(pool, wantCount, rand);
  for (const tile of targets) tile.building = null;
  return { kind: actualKind, count: targets.length };
}
