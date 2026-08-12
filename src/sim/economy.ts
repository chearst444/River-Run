/** Budget & taxation — daily income/expense math feeding the treasury. */

import type { Tile } from "../config/grid";
import { BUILDINGS } from "./buildings";

export const MIN_TAX_RATE = 0;
export const MAX_TAX_RATE = 0.3;
const PER_CAPITA_TAX_BASE = 0.8; // $/day per resident at 100% tax rate before rate scaling

export function computeDailyUpkeep(tiles: Tile[][]): number {
  let monthlyUpkeep = 0;
  for (const row of tiles) {
    for (const tile of row) {
      if (tile.building) monthlyUpkeep += BUILDINGS[tile.building].upkeepPerMonth;
    }
  }
  return monthlyUpkeep / 30;
}

export function computeDailyTaxIncome(population: number, taxRate: number): number {
  return population * PER_CAPITA_TAX_BASE * (taxRate / MAX_TAX_RATE);
}
