/**
 * Production chains (raw goods -> processed goods) and the commercial
 * buildings that consume goods for income + happiness. Runs after
 * agriculture each day, operating on the shared resource pool.
 */

import type { Tile } from "../config/grid";
import type { ResourceId } from "./resources";

const MILL_WHEAT_PER_DAY = 4;
const BLACKSMITH_ORE_PER_DAY = 3;
const TAILOR_WOOL_PER_DAY = 2;
const BAKERY_FLOUR_PER_DAY = 3;

const BUTCHER_MEAT_PER_DAY = 2;
const FARMERS_MARKET_SELL_PER_DAY = 3;
const FARMERS_MARKET_RESOURCES: ResourceId[] = [
  "wheat",
  "corn",
  "potatoes",
  "tomatoes",
  "apples",
];

const INCOME_PER_UNIT_SOLD = 4;
const HAPPINESS_PER_SHOP = 0.15;

export interface ProductionOutcome {
  resourceDeltas: Partial<Record<ResourceId, number>>;
  income: number;
  happinessBonus: number;
}

function countBuildings(tiles: Tile[][], id: string): number {
  let n = 0;
  for (const row of tiles) for (const tile of row) if (tile.building === id) n++;
  return n;
}

function take(
  resources: Record<ResourceId, number>,
  deltas: Partial<Record<ResourceId, number>>,
  resource: ResourceId,
  amount: number,
): number {
  const available = resources[resource] + (deltas[resource] ?? 0);
  const taken = Math.min(available, amount);
  deltas[resource] = (deltas[resource] ?? 0) - taken;
  return taken;
}

function give(deltas: Partial<Record<ResourceId, number>>, resource: ResourceId, amount: number) {
  deltas[resource] = (deltas[resource] ?? 0) + amount;
}

export function computeProduction(
  tiles: Tile[][],
  resources: Record<ResourceId, number>,
): ProductionOutcome {
  const deltas: Partial<Record<ResourceId, number>> = {};
  let income = 0;
  let happinessBonus = 0;

  const mills = countBuildings(tiles, "historic_mill");
  if (mills > 0) {
    const wheatIn = take(resources, deltas, "wheat", MILL_WHEAT_PER_DAY * mills);
    give(deltas, "flour", wheatIn);
  }

  const blacksmiths = countBuildings(tiles, "blacksmith");
  if (blacksmiths > 0) {
    const oreIn = take(resources, deltas, "ore", BLACKSMITH_ORE_PER_DAY * blacksmiths);
    give(deltas, "tools", oreIn);
    income += oreIn * INCOME_PER_UNIT_SOLD * 0.5; // some tools exported directly
  }

  const tailors = countBuildings(tiles, "tailor");
  if (tailors > 0) {
    const woolIn = take(resources, deltas, "wool", TAILOR_WOOL_PER_DAY * tailors);
    give(deltas, "clothing", woolIn);
    income += woolIn * INCOME_PER_UNIT_SOLD;
    happinessBonus += tailors * HAPPINESS_PER_SHOP;
  }

  const bakeries = countBuildings(tiles, "bakery");
  if (bakeries > 0) {
    const flourIn = take(resources, deltas, "flour", BAKERY_FLOUR_PER_DAY * bakeries);
    give(deltas, "bread", flourIn);
    income += flourIn * INCOME_PER_UNIT_SOLD;
    happinessBonus += bakeries * HAPPINESS_PER_SHOP;
  }

  const butchers = countBuildings(tiles, "butcher");
  if (butchers > 0) {
    const meatIn = take(resources, deltas, "meat", BUTCHER_MEAT_PER_DAY * butchers * 0.6);
    const deerIn = take(resources, deltas, "deer_meat", BUTCHER_MEAT_PER_DAY * butchers * 0.4);
    income += (meatIn + deerIn) * INCOME_PER_UNIT_SOLD;
    happinessBonus += butchers * HAPPINESS_PER_SHOP;
  }

  const markets = countBuildings(tiles, "farmers_market");
  if (markets > 0) {
    for (const resource of FARMERS_MARKET_RESOURCES) {
      const sold = take(resources, deltas, resource, (FARMERS_MARKET_SELL_PER_DAY * markets) / 5);
      income += sold * INCOME_PER_UNIT_SOLD * 0.75;
    }
    happinessBonus += markets * HAPPINESS_PER_SHOP * 1.5;
  }

  return { resourceDeltas: deltas, income, happinessBonus };
}
