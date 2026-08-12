/** Central game state — everything the sim engine reads and mutates each day. */

import type { Tile } from "../config/grid";
import { createInitialTime, type GameTime, type GameSpeed } from "./time";
import { createEmptyResourceMap, type ResourceId } from "./resources";
import { createInitialElectionState, type ElectionState } from "./elections";
import { createInitialDisasterState, type DisasterState } from "./disasters";
import { createInitialImmigrationState, type ImmigrationState } from "./immigration";
import { createInitialDecisionEventsState, type DecisionEventsState } from "./decisionEvents";
import { Rng } from "./rng";

export const STARTING_TREASURY = 2000;
export const STARTING_TAX_RATE = 0.12;
export const LOG_LIMIT = 40;

export interface CountyFairState {
  lastHeldYear: number; // -1 = never
}

export interface GameState {
  tiles: Tile[][];
  time: GameTime;
  speed: GameSpeed;
  /** True while a modal (immigration/decision/election) is awaiting player input. */
  paused: boolean;
  resources: Record<ResourceId, number>;
  storageCapacity: number;
  treasury: number;
  taxRate: number;
  population: number;
  housingCapacity: number;
  jobsAvailable: number;
  employmentRate: number;
  happiness: number;
  approval: number;
  pollution: number;
  election: ElectionState;
  disasters: DisasterState;
  immigration: ImmigrationState;
  decisionEvents: DecisionEventsState;
  countyFair: CountyFairState;
  extraJobs: number; // from approved decision-event proposals
  extraIncomePerDay: number;
  log: { day: number; text: string }[];
  rngState: number;
  lastWasteMessage: string | null;
}

export function createInitialGameState(tiles: Tile[][], seed = Date.now() ^ 0x9e3779b9): GameState {
  const rng = new Rng(seed);
  return {
    tiles,
    time: createInitialTime(),
    speed: 1,
    paused: false,
    resources: createEmptyResourceMap(),
    storageCapacity: 100,
    treasury: STARTING_TREASURY,
    taxRate: STARTING_TAX_RATE,
    population: 0,
    housingCapacity: 0,
    jobsAvailable: 0,
    employmentRate: 0,
    happiness: 60,
    approval: 55,
    pollution: 0,
    election: createInitialElectionState(() => rng.next()),
    disasters: createInitialDisasterState(),
    immigration: createInitialImmigrationState(() => rng.next()),
    decisionEvents: createInitialDecisionEventsState(),
    countyFair: { lastHeldYear: -1 },
    extraJobs: 0,
    extraIncomePerDay: 0,
    log: [],
    rngState: rng.a,
    lastWasteMessage: null,
  };
}

export function pushLog(state: GameState, text: string) {
  state.log.push({ day: state.time.totalDays, text });
  if (state.log.length > LOG_LIMIT) state.log.shift();
}
