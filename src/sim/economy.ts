/**
 * Budget & taxation. Businesses (commercial/industrial zoning, farms, and
 * the production-chain shops) generate gross revenue from activity; the
 * city's tax rate takes a cut of that into the treasury. Everything else
 * — civic salaries, building maintenance, corruption, disaster repairs —
 * is an expense drawn straight from the treasury. See `engine.ts`'s
 * `stepEconomy` for how these combine into the daily budget snapshot.
 */

import type { BuildingId, Tile } from "../config/grid";
import { BUILDINGS } from "./buildings";
import type { Season } from "./time";

export const MIN_TAX_RATE = 0;
export const MAX_TAX_RATE = 0.3;

const COMMERCIAL_BASE_REVENUE = 6; // $/day per fully-serviced commercial tile at full activity
const INDUSTRIAL_BASE_REVENUE = 7;
const FARMLAND_BASE_REVENUE = 2.5;

// Farms' cash-crop revenue follows the same harvest rhythm as their yields.
const FARM_REVENUE_SEASON: Record<Season, number> = {
  spring: 0.6,
  summer: 1.0,
  fall: 1.4,
  winter: 0.2,
};

function isFullyServiced(tile: Tile): boolean {
  return !tile.damaged && tile.hasRoadAccess && tile.hasPower && tile.hasWater;
}

/**
 * Gross revenue businesses generate today, before the city's cut. Shops
 * and industry scale with how staffed the town is (employment) and, for
 * shops, how prosperous it is (happiness, as a proxy for local demand);
 * farms scale with the season, same as their crop yields. This is the
 * "activity" the tax rate below actually taxes.
 */
export function computeGrossBusinessRevenue(
  tiles: Tile[][],
  employmentRate: number,
  happiness: number,
  season: Season,
): number {
  const laborFactor = 0.4 + 0.6 * Math.max(0, Math.min(1, employmentRate));
  const demandFactor = 0.5 + 0.5 * (Math.max(0, Math.min(100, happiness)) / 100);
  const farmFactor = FARM_REVENUE_SEASON[season];

  let total = 0;
  for (const row of tiles) {
    for (const tile of row) {
      if (tile.zone === "commercial" && isFullyServiced(tile)) {
        total += COMMERCIAL_BASE_REVENUE * laborFactor * demandFactor;
      } else if (tile.zone === "industrial" && isFullyServiced(tile)) {
        total += INDUSTRIAL_BASE_REVENUE * laborFactor;
      } else if (tile.zone === "farmland" && tile.cropType && !tile.damaged && tile.hasRoadAccess) {
        total += FARMLAND_BASE_REVENUE * farmFactor;
      }
    }
  }
  return total;
}

/** Wages for civic-category buildings — school, clinic, church, town hall, police, fire. */
export function computeCivicSalaries(tiles: Tile[][]): number {
  let monthly = 0;
  for (const row of tiles) {
    for (const tile of row) {
      if (tile.building && BUILDINGS[tile.building].category === "civic") {
        monthly += BUILDINGS[tile.building].upkeepPerMonth;
      }
    }
  }
  return monthly / 30;
}

/** Upkeep for every other building category (utility, agriculture, commercial, industry). */
export function computeMaintenance(tiles: Tile[][]): number {
  let monthly = 0;
  for (const row of tiles) {
    for (const tile of row) {
      if (tile.building && BUILDINGS[tile.building].category !== "civic") {
        monthly += BUILDINGS[tile.building].upkeepPerMonth;
      }
    }
  }
  return monthly / 30;
}

/**
 * A flat, once-a-year property tax per standing commercial-category
 * building — separate from (and in addition to) the daily
 * activity-based business tax above. That tax is on *revenue*; this one
 * is just on *existing* — a shop pays it whether business was good or
 * bad that year. Defaults to $100/building; override an entry here to
 * vary the amount by building type.
 */
export const PROPERTY_TAX_PER_BUILDING: Partial<Record<BuildingId, number>> = {
  bakery: 100,
  butcher: 100,
  tailor: 100,
  farmers_market: 100,
};

/** Collected once a year (see engine.ts's stepEconomy) — a damaged building doesn't pay. */
export function computeAnnualPropertyTax(tiles: Tile[][]): number {
  let total = 0;
  for (const row of tiles) {
    for (const tile of row) {
      if (tile.building && !tile.damaged) {
        total += PROPERTY_TAX_PER_BUILDING[tile.building] ?? 0;
      }
    }
  }
  return total;
}
