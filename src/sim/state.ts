/** Central game state — everything the sim engine reads and mutates each day. */

import type { Tile } from "../config/grid";
import { createInitialTime, type GameTime, type GameSpeed } from "./time";
import { createEmptyResourceMap, type ResourceId } from "./resources";
import { createInitialElectionState, type ElectionState } from "./elections";
import { createInitialDisasterState, type DisasterState } from "./disasters";
import { createInitialImmigrationState, type ImmigrationState } from "./immigration";
import { createInitialDecisionEventsState, type DecisionEventsState } from "./decisionEvents";
import { Rng } from "./rng";
import type { HappinessInputs } from "./population";

export function createEmptyHappinessInputs(): HappinessInputs {
  return {
    serviceCoverage: 0,
    employmentRate: 1,
    foodSecurity: 1,
    taxRate: STARTING_TAX_RATE,
    pollution: 0,
    disasterPenalty: 0,
    corruptionPenalty: 0,
  };
}

export const STARTING_TREASURY = 2000;
export const STARTING_TAX_RATE = 0.12;
export const LOG_LIMIT = 40;

export interface CountyFairState {
  lastHeldYear: number; // -1 = never
}

/** A live snapshot of today's income vs. expenses, for the budget readout. */
export interface BudgetSnapshot {
  grossBusinessRevenue: number; // before tax
  taxIncome: number; // treasury's cut of grossBusinessRevenue
  decisionEventIncome: number; // flat revenue-share from approved proposals, untaxed
  propertyTax: number; // flat annual per-building tax, only nonzero on the collection day
  civicSalaries: number;
  maintenance: number;
  corruptionSkim: number;
  disasterRepairs: number;
  income: number; // taxIncome + decisionEventIncome + propertyTax
  expenses: number; // civicSalaries + maintenance + corruptionSkim + disasterRepairs
  net: number; // income - expenses
}

export function createEmptyBudgetSnapshot(): BudgetSnapshot {
  return {
    grossBusinessRevenue: 0,
    taxIncome: 0,
    decisionEventIncome: 0,
    propertyTax: 0,
    civicSalaries: 0,
    maintenance: 0,
    corruptionSkim: 0,
    disasterRepairs: 0,
    income: 0,
    expenses: 0,
    net: 0,
  };
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
  /** The raw factors behind today's happiness score, for the in-game hints panel. */
  happinessInputs: HappinessInputs;
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
  /** Consecutive days the town has gone seriously hungry — the famine/collapse clock. */
  famineStreak: number;
  gameOver: boolean;
  gameOverReason: string | null;
  budget: BudgetSnapshot;
}

export function createInitialGameState(tiles: Tile[][], seed = Date.now() ^ 0x9e3779b9): GameState {
  const rng = new Rng(seed);
  return {
    tiles,
    time: createInitialTime(),
    speed: 0.5,
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
    happinessInputs: createEmptyHappinessInputs(),
    election: createInitialElectionState(() => rng.next()),
    disasters: createInitialDisasterState(() => rng.next()),
    immigration: createInitialImmigrationState(() => rng.next()),
    decisionEvents: createInitialDecisionEventsState(),
    countyFair: { lastHeldYear: -1 },
    extraJobs: 0,
    extraIncomePerDay: 0,
    log: [],
    rngState: rng.a,
    lastWasteMessage: null,
    famineStreak: 0,
    gameOver: false,
    gameOverReason: null,
    budget: createEmptyBudgetSnapshot(),
  };
}

export function pushLog(state: GameState, text: string) {
  state.log.push({ day: state.time.totalDays, text });
  if (state.log.length > LOG_LIMIT) state.log.shift();
}
