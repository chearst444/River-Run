/**
 * Row crops, orchards, livestock, fishing, and hunting — the farm economy.
 * Pure per-day production math; the engine applies the results to the
 * shared resource pool and enforces storage caps.
 */

import type { CropId, Tile } from "../config/grid";
import type { Season } from "./time";
import type { ResourceId } from "./resources";

export type CropCategory = "row_crop" | "orchard" | "livestock";

export interface CropOutput {
  resource: ResourceId;
  baseYieldPerDay: number;
}

export interface CropDef {
  id: CropId;
  label: string;
  category: CropCategory;
  outputs: CropOutput[];
  seasonMultiplier: Record<Season, number>;
}

const ROW_CROP_SEASON: Record<Season, number> = {
  spring: 0.6,
  summer: 1.0,
  fall: 1.4,
  winter: 0.2,
};
const ORCHARD_SEASON: Record<Season, number> = {
  spring: 0.5,
  summer: 0.8,
  fall: 1.3,
  winter: 0.3,
};
const LIVESTOCK_SEASON: Record<Season, number> = {
  spring: 0.9,
  summer: 1.0,
  fall: 1.0,
  winter: 0.7,
};

export const CROPS: Record<CropId, CropDef> = {
  wheat: {
    id: "wheat",
    label: "Wheat",
    category: "row_crop",
    outputs: [{ resource: "wheat", baseYieldPerDay: 3 }],
    seasonMultiplier: ROW_CROP_SEASON,
  },
  corn: {
    id: "corn",
    label: "Corn",
    category: "row_crop",
    outputs: [{ resource: "corn", baseYieldPerDay: 3 }],
    seasonMultiplier: ROW_CROP_SEASON,
  },
  potatoes: {
    id: "potatoes",
    label: "Potatoes",
    category: "row_crop",
    outputs: [{ resource: "potatoes", baseYieldPerDay: 3.5 }],
    seasonMultiplier: ROW_CROP_SEASON,
  },
  tomatoes: {
    id: "tomatoes",
    label: "Tomatoes",
    category: "row_crop",
    outputs: [{ resource: "tomatoes", baseYieldPerDay: 3 }],
    seasonMultiplier: ROW_CROP_SEASON,
  },
  apples: {
    id: "apples",
    label: "Apple Orchard",
    category: "orchard",
    outputs: [{ resource: "apples", baseYieldPerDay: 1.5 }],
    seasonMultiplier: ORCHARD_SEASON,
  },
  cows: {
    id: "cows",
    label: "Cattle",
    category: "livestock",
    outputs: [
      { resource: "milk", baseYieldPerDay: 2 },
      { resource: "meat", baseYieldPerDay: 0.5 },
    ],
    seasonMultiplier: LIVESTOCK_SEASON,
  },
  chickens: {
    id: "chickens",
    label: "Chickens",
    category: "livestock",
    outputs: [
      { resource: "eggs", baseYieldPerDay: 2.5 },
      { resource: "meat", baseYieldPerDay: 0.3 },
    ],
    seasonMultiplier: LIVESTOCK_SEASON,
  },
  goats: {
    id: "goats",
    label: "Goats",
    category: "livestock",
    outputs: [{ resource: "milk", baseYieldPerDay: 1.2 }],
    seasonMultiplier: LIVESTOCK_SEASON,
  },
  sheep: {
    id: "sheep",
    label: "Sheep",
    category: "livestock",
    outputs: [{ resource: "wool", baseYieldPerDay: 1 }],
    seasonMultiplier: LIVESTOCK_SEASON,
  },
};

export const CROP_IDS = Object.keys(CROPS) as CropId[];

const DOCK_FISH_PER_DAY = 4;
const HUNTING_CABIN_DEER_PER_DAY = 5;

export interface ProductionResult {
  gains: Partial<Record<ResourceId, number>>;
  jobsUsed: number;
}

/** Sum up a full day of farm/fishing/hunting production across the map. */
export function computeAgricultureProduction(tiles: Tile[][], season: Season): ProductionResult {
  const gains: Partial<Record<ResourceId, number>> = {};
  const add = (resource: ResourceId, amount: number) => {
    gains[resource] = (gains[resource] ?? 0) + amount;
  };

  for (const row of tiles) {
    for (const tile of row) {
      if (tile.damaged) continue;

      if (tile.zone === "farmland" && tile.cropType && tile.hasRoadAccess) {
        const crop = CROPS[tile.cropType];
        const mult = crop.seasonMultiplier[season];
        for (const output of crop.outputs) {
          add(output.resource, output.baseYieldPerDay * mult);
        }
      }

      if (tile.building === "dock") {
        add("fish", DOCK_FISH_PER_DAY);
      }

      if (tile.building === "hunting_cabin" && season === "fall") {
        add("deer_meat", HUNTING_CABIN_DEER_PER_DAY);
      }
    }
  }

  return { gains, jobsUsed: 0 };
}
