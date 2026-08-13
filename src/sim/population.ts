/**
 * Housing, jobs, and happiness — the population sim. Growth/shrink is
 * driven by available housing, jobs, and the happiness score; happiness
 * itself blends service coverage, employment, food security, tax rate,
 * pollution, and disaster recency.
 */

import type { Tile } from "../config/grid";
import { BUILDINGS } from "./buildings";
import { collectBuildingPositions, isWithinServiceRange } from "./network";

const DENSITY_CAPACITY = [4, 8, 16] as const; // pop per tile at density 0/1/2
const BASE_COMMERCIAL_JOBS = 2;
const BASE_INDUSTRIAL_JOBS = 3;

const SERVICE_BUILDING_SETS: { ids: Set<string>; radius: number }[] = [
  { ids: new Set(["school"]), radius: BUILDINGS.school.serviceRadius ?? 7 },
  { ids: new Set(["clinic"]), radius: BUILDINGS.clinic.serviceRadius ?? 7 },
  { ids: new Set(["church"]), radius: BUILDINGS.church.serviceRadius ?? 8 },
  { ids: new Set(["police_station"]), radius: BUILDINGS.police_station.serviceRadius ?? 7 },
  { ids: new Set(["fire_station_full"]), radius: BUILDINGS.fire_station_full.serviceRadius ?? 9 },
];

export interface HousingJobs {
  housingCapacity: number;
  jobsAvailable: number;
  populatedTiles: Tile[];
}

export function computeHousingAndJobs(tiles: Tile[][]): HousingJobs {
  let housingCapacity = 0;
  let jobsAvailable = 0;
  const populatedTiles: Tile[] = [];

  for (const row of tiles) {
    for (const tile of row) {
      if (tile.damaged || !tile.hasRoadAccess || !tile.hasPower || !tile.hasWater) continue;

      if (tile.zone === "residential") {
        housingCapacity += DENSITY_CAPACITY[tile.density];
        populatedTiles.push(tile);
      } else if (tile.zone === "commercial") {
        jobsAvailable += tile.building ? BUILDINGS[tile.building].jobs : BASE_COMMERCIAL_JOBS;
      } else if (tile.zone === "industrial") {
        jobsAvailable += tile.building ? BUILDINGS[tile.building].jobs : BASE_INDUSTRIAL_JOBS;
      } else if (tile.building) {
        jobsAvailable += BUILDINGS[tile.building].jobs;
      }
    }
  }

  return { housingCapacity, jobsAvailable, populatedTiles };
}

/** Average fraction of populated tiles covered by each civic service. */
export function computeServiceCoverage(tiles: Tile[][], populatedTiles: Tile[]): number {
  if (populatedTiles.length === 0) return 0.5; // neutral until anyone lives here
  let totalCoverage = 0;
  for (const service of SERVICE_BUILDING_SETS) {
    const positions = collectBuildingPositions(tiles, service.ids);
    if (positions.length === 0) continue;
    let covered = 0;
    for (const tile of populatedTiles) {
      if (isWithinServiceRange(positions, tile.x, tile.y, service.radius)) covered++;
    }
    totalCoverage += covered / populatedTiles.length;
  }
  return totalCoverage / SERVICE_BUILDING_SETS.length;
}

export interface HappinessInputs {
  serviceCoverage: number; // 0..1
  employmentRate: number; // 0..1
  foodSecurity: number; // 0..1 (food produced recently vs. needed)
  taxRate: number; // 0..0.3
  pollution: number; // 0..1
  disasterPenalty: number; // 0..30, decays over time
  corruptionPenalty: number; // 0..20
}

export function computeHappiness(inputs: HappinessInputs): number {
  const base =
    inputs.serviceCoverage * 35 +
    inputs.employmentRate * 25 +
    inputs.foodSecurity * 25 +
    (1 - inputs.pollution) * 10 +
    5; // small baseline goodwill
  const taxPenalty = inputs.taxRate * 60; // 30% tax => -18
  const happiness =
    base - taxPenalty - inputs.disasterPenalty - inputs.corruptionPenalty;
  return Math.max(0, Math.min(100, happiness));
}

/**
 * Moves population toward a target derived from housing/jobs, direction and
 * speed modulated by happiness (unhappy towns bleed residents even below
 * the housing/jobs ceiling).
 */
export function stepPopulation(
  population: number,
  housingCapacity: number,
  jobsAvailable: number,
  happiness: number,
  dtDays: number,
): number {
  const happinessFactor = happiness >= 50 ? 1 : 0.6 + (happiness / 50) * 0.4;
  const jobCeiling = jobsAvailable * 1.3 + 5;
  const target = Math.min(housingCapacity, happiness >= 40 ? jobCeiling : jobCeiling * 0.7);
  const growthRate = 0.01; // fraction of the gap closed per day
  const delta = (target - population) * growthRate * happinessFactor * dtDays;
  return Math.max(0, population + delta);
}

/** Once per in-game year: eligible residential tiles have a shot at upgrading density. */
export function maybeUpgradeDensity(tiles: Tile[][], happiness: number, rand: () => number) {
  for (const row of tiles) {
    for (const tile of row) {
      if (tile.zone !== "residential" || tile.damaged) continue;
      if (!tile.hasRoadAccess || !tile.hasPower || !tile.hasWater) continue;
      if (tile.density >= 2) continue;
      const threshold = tile.density === 0 ? 55 : 72;
      if (happiness >= threshold && rand() < 0.35) {
        tile.density = (tile.density + 1) as typeof tile.density;
      }
    }
  }
}
