/**
 * Elections & politics: a 4-year cycle, three candidates (the player plus
 * two rivals drawn from a Grafter/Reformer/Wildcard archetype pool), a
 * campaigning mechanic, and visible corruption when a Grafter wins.
 */

import { DAYS_PER_YEAR } from "./time";

export type Archetype = "grafter" | "reformer" | "wildcard";

export interface Candidate {
  id: string;
  name: string;
  archetype: Archetype;
  approval: number; // rival's own standing, drifts during the campaign window
  isFixture: boolean;
}

export interface ElectionResult {
  year: number;
  winner: "player" | string; // candidate id
  winnerName: string;
  playerApproval: number;
  rivalApprovals: { name: string; approval: number; archetype: Archetype }[];
}

export interface ElectionState {
  termLengthDays: number;
  nextElectionDay: number;
  fixtureRival: Candidate;
  rotatingRival: Candidate | null; // null = sitting out this cycle
  mayor: "player" | string;
  mayorName: string;
  mayorArchetype: Archetype | null;
  corruptionSiphonPerDay: number;
  scandalRiskAccrued: number;
  /** Passive happiness modifier for the current term, from a rival mayor's governing style. */
  termHappinessModifier: number;
  lastResult: ElectionResult | null;
  campaignBoost: number;
  inCampaignWindow: boolean;
  overdueReminderLogged: boolean;
}

const FIXTURE_NAMES = ["Earl Whitfield", "Dot Mabry", "Cyrus Boone"];
const ROTATING_NAMES = [
  "Marion Petty",
  "Ruth Calloway",
  "Vernon Skaggs",
  "Pearl Denton",
  "Otis Kincaid",
  "Ada Sledge",
];
const ARCHETYPES: Archetype[] = ["grafter", "reformer", "wildcard"];

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  grafter: "The Grafter",
  reformer: "The Reformer",
  wildcard: "The Wildcard",
};

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

function makeCandidate(rand: () => number, isFixture: boolean, usedNames: Set<string>): Candidate {
  const pool = isFixture ? FIXTURE_NAMES : ROTATING_NAMES;
  let name = pick(pool, rand);
  let guard = 0;
  while (usedNames.has(name) && guard++ < 10) name = pick(pool, rand);
  usedNames.add(name);
  return {
    id: name.replace(/\s+/g, "_").toLowerCase(),
    name,
    archetype: pick(ARCHETYPES, rand),
    approval: 35 + rand() * 25,
    isFixture,
  };
}

export function createInitialElectionState(rand: () => number): ElectionState {
  const used = new Set<string>();
  const fixture = makeCandidate(rand, true, used);
  return {
    termLengthDays: DAYS_PER_YEAR * 4,
    nextElectionDay: DAYS_PER_YEAR * 4,
    fixtureRival: fixture,
    rotatingRival: makeCandidate(rand, false, used),
    mayor: "player",
    mayorName: "You",
    mayorArchetype: null,
    corruptionSiphonPerDay: 0,
    scandalRiskAccrued: 0,
    termHappinessModifier: 0,
    lastResult: null,
    campaignBoost: 0,
    inCampaignWindow: false,
    overdueReminderLogged: false,
  };
}

/** Nudges rival approval during the ~90-day campaign window before an election. */
export function driftCampaign(state: ElectionState, rand: () => number) {
  state.fixtureRival.approval = clamp(state.fixtureRival.approval + (rand() - 0.48) * 1.5);
  if (state.rotatingRival) {
    state.rotatingRival.approval = clamp(state.rotatingRival.approval + (rand() - 0.48) * 1.5);
  }
}

function clamp(v: number): number {
  return Math.max(5, Math.min(95, v));
}

/** Player spends budget to campaign — a temporary approval bump. */
export const CAMPAIGN_COST = 150;
export const CAMPAIGN_BOOST = 6;

export function playerCampaign(state: ElectionState) {
  state.campaignBoost = Math.min(20, state.campaignBoost + CAMPAIGN_BOOST);
}

export function runElection(
  state: ElectionState,
  playerApproval: number,
  currentYear: number,
  rand: () => number,
): ElectionResult {
  const effectivePlayerApproval = clamp(playerApproval + state.campaignBoost);
  const rivals = [state.fixtureRival, ...(state.rotatingRival ? [state.rotatingRival] : [])];

  const entries: { id: string; name: string; score: number }[] = [
    { id: "player", name: "You", score: effectivePlayerApproval + (rand() - 0.5) * 8 },
    ...rivals.map((r) => ({ id: r.id, name: r.name, score: r.approval + (rand() - 0.5) * 8 })),
  ];
  entries.sort((a, b) => b.score - a.score);
  const winnerEntry = entries[0];

  const result: ElectionResult = {
    year: currentYear,
    winner: winnerEntry.id,
    winnerName: winnerEntry.name,
    playerApproval: effectivePlayerApproval,
    rivalApprovals: rivals.map((r) => ({
      name: r.name,
      approval: r.approval,
      archetype: r.archetype,
    })),
  };

  state.mayor = winnerEntry.id;
  state.mayorName = winnerEntry.name;
  state.lastResult = result;
  state.campaignBoost = 0;
  state.scandalRiskAccrued = 0;
  state.overdueReminderLogged = false;

  if (winnerEntry.id !== "player") {
    const winnerCandidate = rivals.find((r) => r.id === winnerEntry.id)!;
    state.mayorArchetype = winnerCandidate.archetype;
    state.corruptionSiphonPerDay = winnerCandidate.archetype === "grafter" ? 3 : 0;
    state.termHappinessModifier =
      winnerCandidate.archetype === "reformer"
        ? 5
        : winnerCandidate.archetype === "grafter"
          ? -5
          : Math.round((rand() - 0.5) * 20); // wildcard: unpredictable, -10..+10
  } else {
    state.mayorArchetype = null;
    state.corruptionSiphonPerDay = 0;
    state.termHappinessModifier = 0;
  }

  // Roll the field forward for the next cycle.
  const used = new Set<string>([state.fixtureRival.name]);
  state.rotatingRival = rand() < 0.75 ? makeCandidate(rand, false, used) : null;
  state.nextElectionDay += state.termLengthDays;

  return result;
}
