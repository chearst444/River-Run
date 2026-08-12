/**
 * Major, town-defining decision events — data center and factory
 * proposals. Distinct from routine zoning: a real trade-off (jobs/revenue
 * vs. happiness/pollution) with lasting, visible consequences.
 */

export type ProposalId = "data_center" | "factory";

export interface Proposal {
  id: ProposalId;
  title: string;
  pitch: string;
  concern: string;
  jobs: number;
  incomePerDay: number;
  pollutionDelta: number;
}

export const PROPOSALS: Record<ProposalId, Proposal> = {
  data_center: {
    id: "data_center",
    title: "Data Center Proposal",
    pitch:
      "An outside company wants to build a data center just outside town: jobs, tax revenue, and a power grid upgrade.",
    concern: "Residents worry about the constant hum of cooling fans and water drawn from the river.",
    jobs: 30,
    incomePerDay: 45,
    pollutionDelta: 0.12,
  },
  factory: {
    id: "factory",
    title: "Factory Proposal",
    pitch: "A large industrial employer wants to move in: significant jobs and an industrial tax base.",
    concern: "Residents worry about air quality and the effect on nearby farmland and livestock.",
    jobs: 40,
    incomePerDay: 40,
    pollutionDelta: 0.2,
  },
};

export interface DecisionEventsState {
  offered: Set<ProposalId>;
  approved: Partial<Record<ProposalId, boolean>>;
  pending: ProposalId | null;
  daysUntilNextCheck: number;
}

export function createInitialDecisionEventsState(): DecisionEventsState {
  return { offered: new Set(), approved: {}, pending: null, daysUntilNextCheck: 200 };
}

/** Returns a newly-offered proposal id, or null if nothing triggered this tick. */
export function tickDecisionEvents(
  state: DecisionEventsState,
  rand: () => number,
): ProposalId | null {
  if (state.pending) return null;
  state.daysUntilNextCheck--;
  if (state.daysUntilNextCheck > 0) return null;
  state.daysUntilNextCheck = 220 + Math.floor(rand() * 120);

  const candidates = (Object.keys(PROPOSALS) as ProposalId[]).filter(
    (id) => !state.offered.has(id),
  );
  if (candidates.length === 0 || rand() > 0.6) return null;

  const chosen = candidates[Math.floor(rand() * candidates.length)];
  state.offered.add(chosen);
  state.pending = chosen;
  return chosen;
}

export interface DecisionOutcome {
  jobsDelta: number;
  incomePerDayDelta: number;
  pollutionDelta: number;
  approvalDelta: number;
  message: string;
}

export function resolveDecisionEvent(
  state: DecisionEventsState,
  id: ProposalId,
  approve: boolean,
): DecisionOutcome {
  state.pending = null;
  state.approved[id] = approve;
  const proposal = PROPOSALS[id];

  if (approve) {
    return {
      jobsDelta: proposal.jobs,
      incomePerDayDelta: proposal.incomePerDay,
      pollutionDelta: proposal.pollutionDelta,
      approvalDelta: -3,
      message: `Approved: ${proposal.title}. Jobs and revenue are up — some residents are unhappy.`,
    };
  }
  return {
    jobsDelta: 0,
    incomePerDayDelta: 0,
    pollutionDelta: 0,
    approvalDelta: 3,
    message: `Rejected: ${proposal.title}. The town stays smaller, but residents who opposed it approve.`,
  };
}
