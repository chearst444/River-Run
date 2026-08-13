/**
 * The simulation engine — owns GameState and advances it one in-game day
 * at a time. Rendering (GameScene) and UI (HUD/Toolbar/modals) only ever
 * read `engine.state` and call its action methods; all game rules live
 * here or in the pure `sim/*` modules it composes.
 */

import type { BuildingId, CropId, Tile, ZoneType } from "../config/grid";
import { canPlaceZone } from "./placement";
import { BUILDINGS, canPlaceBuilding } from "./buildings";
import { updateRoadAccess, updateUtilities } from "./network";
import { computeAgricultureProduction } from "./agriculture";
import { computeProduction } from "./production";
import {
  computeHousingAndJobs,
  computeServiceCoverage,
  computeHappiness,
  stepPopulation,
  maybeUpgradeDensity,
} from "./population";
import {
  computeGrossBusinessRevenue,
  computeCivicSalaries,
  computeMaintenance,
  computeAnnualPropertyTax,
  MIN_TAX_RATE,
  MAX_TAX_RATE,
} from "./economy";
import { driftCampaign, playerCampaign, runElection, CAMPAIGN_COST } from "./elections";
import { tickDisasters } from "./disasters";
import { tickImmigration, resolveImmigration, type ImmigrationWave } from "./immigration";
import { tickDecisionEvents, resolveDecisionEvent, type ProposalId } from "./decisionEvents";
import { FOOD_RESOURCES, type ResourceId } from "./resources";
import { timeFromTotalDays, SECONDS_PER_DAY_AT_1X, type GameSpeed } from "./time";
import { type GameState, pushLog } from "./state";
import { Rng } from "./rng";
import { eventBus, Events } from "../events";

const FOOD_NEED_PER_CAPITA_PER_DAY = 0.45;
const REPAIR_COST_PER_TILE = 80;
const SCANDAL_THRESHOLD = 400;
const MAX_DAYS_PER_UPDATE = 6; // guards against a huge catch-up burst after the tab was backgrounded
const BULLDOZE_REFUND_FRACTION = 0.5;
const UNDO_STACK_LIMIT = 20;

// Food security below this fraction of need counts as "going hungry" for
// both the direct population loss and the famine-collapse clock.
const STARVATION_THRESHOLD = 0.5;
const STARVATION_POP_LOSS_RATE = 0.08;
const STARVATION_MIN_POPULATION = 6; // a handful of hungry founders isn't a famine
const FAMINE_COLLAPSE_DAYS = 20;

interface UndoEntry {
  x: number;
  y: number;
  tile: Tile;
  treasury: number;
}

export class SimulationEngine {
  state: GameState;
  private rng: Rng;
  private accumulatedDays = 0;
  private undoStack: UndoEntry[] = [];

  constructor(state: GameState) {
    this.state = state;
    this.rng = new Rng(state.rngState);
  }

  private rand = (): number => this.rng.next();

  // ---------------------------------------------------------------------
  // Frame loop
  // ---------------------------------------------------------------------

  update(deltaMs: number) {
    const s = this.state;
    if (s.gameOver || s.paused || s.speed === 0) return;
    const daysPerSecond = (1 / SECONDS_PER_DAY_AT_1X) * s.speed;
    this.accumulatedDays += (deltaMs / 1000) * daysPerSecond;

    let simulated = 0;
    while (this.accumulatedDays >= 1 && simulated < MAX_DAYS_PER_UPDATE) {
      this.accumulatedDays -= 1;
      this.simulateDay();
      simulated++;
      if (s.paused) {
        this.accumulatedDays = 0; // a modal came up — stop burning days until resolved
        break;
      }
    }
  }

  private simulateDay() {
    const s = this.state;
    s.time = timeFromTotalDays(s.time.totalDays + 1);

    updateRoadAccess(s.tiles);
    updateUtilities(s.tiles);

    this.stepAgriculture();
    const production = computeProduction(s.tiles, s.resources);
    this.applyResourceDeltas(production.resourceDeltas);

    const { housingCapacity, jobsAvailable, populatedTiles } = computeHousingAndJobs(s.tiles);
    s.housingCapacity = housingCapacity;
    s.jobsAvailable = jobsAvailable + s.extraJobs;
    s.employmentRate = s.population > 0 ? Math.min(1, s.jobsAvailable / s.population) : 1;

    const foodSecurity = this.consumeFood();
    this.stepStarvation(foodSecurity);
    if (s.gameOver) {
      eventBus.emit(Events.StateChanged);
      return;
    }

    // Disasters run before happiness/economy so today's damage (if any)
    // is reflected in both, rather than lagging a day behind.
    const disasterRepairCost = this.stepDisasters();

    const serviceCoverage = computeServiceCoverage(s.tiles, populatedTiles);
    const corruptionPenalty =
      s.election.mayor !== "player" && s.election.corruptionSiphonPerDay > 0 ? 8 : 0;

    let happiness = computeHappiness({
      serviceCoverage,
      employmentRate: s.employmentRate,
      foodSecurity,
      taxRate: s.taxRate,
      pollution: s.pollution,
      disasterPenalty: s.disasters.disasterPenalty,
      corruptionPenalty,
    });
    happiness += production.happinessBonus + s.election.termHappinessModifier;
    if (s.treasury < 0) happiness -= 5;
    s.happiness = Math.max(0, Math.min(100, happiness));
    s.approval = Math.max(0, Math.min(100, s.approval + (s.happiness - s.approval) * 0.05));

    s.population = stepPopulation(
      s.population,
      s.housingCapacity,
      s.jobsAvailable,
      s.happiness,
      1,
    );

    this.stepEconomy(production.income, disasterRepairCost);
    this.stepDecisionEvents();
    this.stepImmigration();
    this.stepElections();

    if (s.time.month === 1 && s.time.day === 1) this.stepYearlyEvents();

    s.rngState = this.rng.a;
    eventBus.emit(Events.StateChanged);
  }

  // ---------------------------------------------------------------------
  // Subsystems
  // ---------------------------------------------------------------------

  private stepAgriculture() {
    const s = this.state;
    const { gains } = computeAgricultureProduction(s.tiles, s.time.season);
    let waste = 0;
    for (const key of Object.keys(gains) as ResourceId[]) {
      const amount = gains[key] ?? 0;
      const room = s.storageCapacity - s.resources[key];
      const applied = Math.max(0, Math.min(amount, room));
      waste += amount - applied;
      s.resources[key] += applied;
    }
    if (waste > 3 && s.time.totalDays % 15 === 0) {
      pushLog(s, `Storage is full — ${waste.toFixed(0)} units of surplus produce spoiled.`);
    }
  }

  private applyResourceDeltas(deltas: Partial<Record<ResourceId, number>>) {
    const s = this.state;
    for (const key of Object.keys(deltas) as ResourceId[]) {
      const next = s.resources[key] + (deltas[key] ?? 0);
      s.resources[key] = Math.max(0, next);
    }
  }

  /** Returns 0..1 how well-fed the town is today, and eats the food consumed. */
  private consumeFood(): number {
    const s = this.state;
    let needed = s.population * FOOD_NEED_PER_CAPITA_PER_DAY;
    if (needed <= 0) return 1;
    const totalFood = FOOD_RESOURCES.reduce((sum, r) => sum + s.resources[r], 0);
    const security = Math.max(0, Math.min(1, totalFood / needed));
    let remaining = Math.min(needed, totalFood);
    for (const r of FOOD_RESOURCES) {
      if (remaining <= 0) break;
      const take = Math.min(s.resources[r], remaining);
      s.resources[r] -= take;
      remaining -= take;
    }
    return security;
  }

  /**
   * Direct population loss from going hungry — separate from (and on top
   * of) the slower happiness-driven emigration. A sustained famine ends
   * the game: an overrun town with no food plan doesn't just get sadder
   * forever, it collapses.
   */
  private stepStarvation(foodSecurity: number) {
    const s = this.state;
    if (s.population < STARVATION_MIN_POPULATION || foodSecurity >= STARVATION_THRESHOLD) {
      s.famineStreak = 0;
      return;
    }

    const shortfall = STARVATION_THRESHOLD - foodSecurity; // 0..STARVATION_THRESHOLD
    const lost = s.population * shortfall * STARVATION_POP_LOSS_RATE;
    s.population = Math.max(0, s.population - lost);
    s.famineStreak++;

    if (s.famineStreak === 1) {
      pushLog(s, "Food shortage — people are going hungry. Build farms, docks, or a hunting cabin.");
    } else if (s.famineStreak % 5 === 0) {
      pushLog(s, `Still going hungry (${s.famineStreak} days) — people are leaving or worse.`);
    }

    if (s.famineStreak >= FAMINE_COLLAPSE_DAYS) {
      s.gameOver = true;
      s.paused = true;
      s.gameOverReason =
        "River Run starved. The town grew faster than its food supply, and with no farms, docks, or hunting to feed everyone, the settlement collapsed.";
      pushLog(s, "GAME OVER — the town starved.");
      eventBus.emit(Events.GameOver, s.gameOverReason);
    }
  }

  /**
   * The business economy loop: commercial/industrial/farm activity plus
   * the production-chain shops generate gross revenue; the tax rate takes
   * the city's cut into the treasury. Everything else here is an expense.
   * Builds `state.budget` as a live income/expense/net snapshot for the
   * HUD's readout.
   *
   * Once a year (the day the calendar rolls over to month 1, day 1), every
   * standing shop also pays a flat property tax on top of that — a tax on
   * existing, not on the day's activity, so it lands even in a slow month.
   */
  private stepEconomy(productionIncome: number, disasterRepairs: number) {
    const s = this.state;

    const grossBusinessRevenue =
      computeGrossBusinessRevenue(s.tiles, s.employmentRate, s.happiness, s.time.season) +
      productionIncome;
    const taxIncome = grossBusinessRevenue * s.taxRate;
    const decisionEventIncome = s.extraIncomePerDay;
    const isPropertyTaxDay = s.time.month === 1 && s.time.day === 1;
    const propertyTax = isPropertyTaxDay ? computeAnnualPropertyTax(s.tiles) : 0;

    const civicSalaries = computeCivicSalaries(s.tiles);
    const maintenance = computeMaintenance(s.tiles);
    const corruptionSkim = s.election.mayor !== "player" ? s.election.corruptionSiphonPerDay : 0;

    const income = taxIncome + decisionEventIncome + propertyTax;
    const expenses = civicSalaries + maintenance + corruptionSkim + disasterRepairs;
    s.treasury += income - expenses;

    s.budget = {
      grossBusinessRevenue,
      taxIncome,
      decisionEventIncome,
      propertyTax,
      civicSalaries,
      maintenance,
      corruptionSkim,
      disasterRepairs,
      income,
      expenses,
      net: income - expenses,
    };

    if (propertyTax > 0) {
      pushLog(s, `Property tax day — collected $${propertyTax.toFixed(0)} from standing businesses.`);
    }

    if (corruptionSkim > 0) {
      s.election.scandalRiskAccrued += corruptionSkim;
      if (s.election.scandalRiskAccrued > SCANDAL_THRESHOLD) {
        s.election.scandalRiskAccrued = 0;
        s.election.nextElectionDay = Math.min(s.election.nextElectionDay, s.time.totalDays + 30);
        pushLog(s, `Scandal! ${s.election.mayorName}'s corruption came to light — a special election has been called.`);
        eventBus.emit(Events.LogMessage, "Scandal uncovered — special election in 30 days.");
      }
    }
  }

  /** Resolves today's storm/flood/earthquake/major-disaster tick and returns the repair bill, if any. */
  private stepDisasters(): number {
    const s = this.state;
    const fireResponseFast = s.tiles.some((row) => row.some((t) => t.building === "fire_station_full"));
    const before = s.disasters.repairQueue.length;
    const result = tickDisasters(
      s.tiles,
      s.time.season,
      fireResponseFast,
      s.time.totalDays,
      this.rand,
      s.disasters,
    );
    const newlyDamaged = Math.max(0, s.disasters.repairQueue.length - before);
    for (const msg of result.messages) {
      pushLog(s, msg.text);
      eventBus.emit(Events.DisasterMessage, msg);
    }
    return newlyDamaged * REPAIR_COST_PER_TILE;
  }

  private stepDecisionEvents() {
    const s = this.state;
    const offered = tickDecisionEvents(s.decisionEvents, this.rand);
    if (offered) {
      s.paused = true;
      pushLog(s, `A proposal has come before the town: ${offered.replace("_", " ")}.`);
      eventBus.emit(Events.ProposalOffered, offered);
    }
  }

  private stepImmigration() {
    const s = this.state;
    const wave = tickImmigration(s.immigration, this.rand);
    if (wave) {
      s.paused = true;
      eventBus.emit(Events.ImmigrationOffered, wave);
    }
  }

  private stepElections() {
    const s = this.state;
    const hasTownHall = s.tiles.some((row) => row.some((t) => t.building === "town_hall"));

    if (!hasTownHall) {
      if (s.time.totalDays >= s.election.nextElectionDay) {
        s.election.nextElectionDay = s.time.totalDays + 30;
        if (!s.election.overdueReminderLogged) {
          pushLog(s, "Build a Town Hall to hold elections.");
          s.election.overdueReminderLogged = true;
        }
      }
      return;
    }

    s.election.inCampaignWindow =
      s.time.totalDays >= s.election.nextElectionDay - 90 &&
      s.time.totalDays < s.election.nextElectionDay;
    if (s.election.inCampaignWindow) driftCampaign(s.election, this.rand);

    if (s.time.totalDays >= s.election.nextElectionDay) {
      const result = runElection(s.election, s.approval, s.time.year, this.rand);
      s.paused = true;
      pushLog(s, `Election result: ${result.winnerName} wins.`);
      eventBus.emit(Events.ElectionResult, result);
    }
  }

  private stepYearlyEvents() {
    const s = this.state;
    maybeUpgradeDensity(s.tiles, s.happiness, this.rand);
    s.pollution = Math.max(0, s.pollution - 0.03);
  }

  // ---------------------------------------------------------------------
  // Player actions
  // ---------------------------------------------------------------------

  setSpeed(speed: GameSpeed) {
    this.state.speed = speed;
    eventBus.emit(Events.StateChanged);
  }

  setTaxRate(rate: number) {
    this.state.taxRate = Math.max(MIN_TAX_RATE, Math.min(MAX_TAX_RATE, rate));
    eventBus.emit(Events.StateChanged);
  }

  setCropType(x: number, y: number, crop: CropId) {
    const tile = this.state.tiles[y]?.[x];
    if (tile && tile.zone === "farmland") {
      tile.cropType = crop;
      eventBus.emit(Events.StateChanged);
    }
  }

  /** Places a zone (road/residential/commercial/industrial/farmland/civic) or a discrete building. */
  placeTool(
    x: number,
    y: number,
    tool: ZoneType | BuildingId | "bulldoze",
  ): { ok: boolean; reason?: string } {
    const s = this.state;
    if (s.gameOver) return { ok: false, reason: "River Run has fallen." };
    const tile = s.tiles[y]?.[x];
    if (!tile) return { ok: false, reason: "Out of bounds." };
    const before = { ...tile }; // snapshot for undo, taken before any mutation below

    if (tool === "bulldoze") {
      if (tile.zone === "none" && !tile.building) return { ok: false, reason: "Nothing here to remove." };
      const refund = tile.building
        ? Math.round(BUILDINGS[tile.building].cost * BULLDOZE_REFUND_FRACTION)
        : 0;
      tile.zone = "none";
      tile.building = null;
      tile.cropType = null;
      tile.density = 0;
      s.treasury += refund;
      this.pushUndo(x, y, before, s.treasury - refund);
      eventBus.emit(
        Events.PlacementRejected,
        refund > 0 ? `Removed — refunded $${refund}.` : "Removed.",
      );
      eventBus.emit(Events.StateChanged);
      return { ok: true };
    }

    if (tool in BUILDINGS) {
      const id = tool as BuildingId;
      const def = BUILDINGS[id];
      const legality = canPlaceBuilding(s.tiles, tile, id);
      if (!legality.allowed) return { ok: false, reason: legality.reason };
      if (s.treasury < def.cost) return { ok: false, reason: `Not enough funds (needs $${def.cost}).` };
      s.treasury -= def.cost;
      // Fire station upgrade replaces the volunteer building in place.
      tile.building = id;
      if (tile.zone === "none") tile.zone = def.zone;
      this.pushUndo(x, y, before, s.treasury + def.cost);
      eventBus.emit(Events.PlacementRejected, `Built ${def.name} — $${def.cost}.`);
      eventBus.emit(Events.StateChanged);
      return { ok: true };
    }

    const zone = tool as ZoneType;
    const legality = canPlaceZone(s.tiles, tile, zone);
    if (!legality.allowed) return { ok: false, reason: legality.reason };
    tile.zone = zone;
    if (zone === "farmland" && !tile.cropType) tile.cropType = "wheat";
    if (zone !== "farmland") tile.cropType = null;
    this.pushUndo(x, y, before, s.treasury);
    eventBus.emit(Events.StateChanged);
    return { ok: true };
  }

  private pushUndo(x: number, y: number, tile: Tile, treasuryBefore: number) {
    this.undoStack.push({ x, y, tile, treasury: treasuryBefore });
    if (this.undoStack.length > UNDO_STACK_LIMIT) this.undoStack.shift();
  }

  /** Reverses the single most recent placement/bulldoze, tile state and treasury alike. */
  undo(): { ok: boolean; reason?: string } {
    const entry = this.undoStack.pop();
    if (!entry) return { ok: false, reason: "Nothing to undo." };
    const s = this.state;
    const liveTile = s.tiles[entry.y]?.[entry.x];
    if (!liveTile) return { ok: false, reason: "Can't undo — tile no longer exists." };
    Object.assign(liveTile, entry.tile);
    s.treasury = entry.treasury;
    eventBus.emit(Events.PlacementRejected, "Undid last action.");
    eventBus.emit(Events.StateChanged);
    return { ok: true };
  }

  campaign(): { ok: boolean; reason?: string } {
    const s = this.state;
    if (s.gameOver) return { ok: false, reason: "River Run has fallen." };
    if (s.treasury < CAMPAIGN_COST) return { ok: false, reason: `Not enough funds (needs $${CAMPAIGN_COST}).` };
    s.treasury -= CAMPAIGN_COST;
    playerCampaign(s.election);
    pushLog(s, "Held a town hall to campaign for re-election.");
    eventBus.emit(Events.StateChanged);
    return { ok: true };
  }

  holdCountyFair(): { ok: boolean; reason?: string } {
    const s = this.state;
    const cost = 100;
    if (s.gameOver) return { ok: false, reason: "River Run has fallen." };
    if (s.time.season !== "fall") return { ok: false, reason: "The county fair is a fall tradition." };
    if (s.countyFair.lastHeldYear === s.time.year) return { ok: false, reason: "Already held this year." };
    if (s.treasury < cost) return { ok: false, reason: `Not enough funds (needs $${cost}).` };
    s.treasury -= cost;
    s.countyFair.lastHeldYear = s.time.year;
    s.happiness = Math.min(100, s.happiness + 6);
    s.approval = Math.min(100, s.approval + 4);
    pushLog(s, "Held the county fair — happiness and approval up.");
    eventBus.emit(Events.StateChanged);
    return { ok: true };
  }

  resolveImmigration(wave: ImmigrationWave, choice: "welcome" | "restrict") {
    const s = this.state;
    const spareHousing = Math.max(0, s.housingCapacity - s.population);
    const outcome = resolveImmigration(s.immigration, wave, choice, spareHousing, this.rand);
    s.population += outcome.populationDelta;
    s.approval = Math.max(0, Math.min(100, s.approval + outcome.approvalDelta));
    s.paused = false;
    pushLog(s, outcome.message);
    eventBus.emit(Events.StateChanged);
  }

  resolveDecisionEvent(id: ProposalId, approve: boolean) {
    const s = this.state;
    const outcome = resolveDecisionEvent(s.decisionEvents, id, approve);
    s.extraJobs += outcome.jobsDelta;
    s.extraIncomePerDay += outcome.incomePerDayDelta;
    s.pollution = Math.max(0, Math.min(1, s.pollution + outcome.pollutionDelta));
    s.approval = Math.max(0, Math.min(100, s.approval + outcome.approvalDelta));
    s.paused = false;
    pushLog(s, outcome.message);
    eventBus.emit(Events.StateChanged);
  }

  acknowledgeElection() {
    this.state.paused = false;
    eventBus.emit(Events.StateChanged);
  }

  loadState(next: GameState) {
    this.state = next;
    this.rng = new Rng(next.rngState);
    this.accumulatedDays = 0;
    this.undoStack = []; // stale tile references from the old state can't be undone
    eventBus.emit(Events.GameLoaded);
    eventBus.emit(Events.StateChanged);
  }
}
