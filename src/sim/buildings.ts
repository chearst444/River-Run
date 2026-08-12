/**
 * Building catalog — every discrete facility the player can place, and the
 * terrain/zone rules governing where. Pure data + pure legality functions;
 * the numeric effects (jobs, upkeep, production) are consumed by the sim
 * engine, not applied here.
 */

import type { BuildingId, Tile, ZoneType } from "../config/grid";
import { isWaterAdjacent, isForestAdjacent } from "./terrain";
import type { PlacementResult } from "./placement";

export type BuildingCategory = "utility" | "civic" | "agriculture" | "industry" | "commercial";

export interface BuildingDef {
  id: BuildingId;
  name: string;
  category: BuildingCategory;
  /** The broad zone this building occupies once placed (drives road-adjacency legality). */
  zone: ZoneType;
  cost: number;
  upkeepPerMonth: number;
  jobs: number;
  /** Road-network hops a utility/service building's coverage reaches. */
  serviceRadius?: number;
  requiresPower?: boolean;
  requiresWater?: boolean;
  description: string;
  /** Extra placement constraint beyond the standard zone/road checks. */
  canPlace?: (tiles: Tile[][], tile: Tile) => PlacementResult;
}

const onTerrain = (allowed: Set<string>, message: string) => (
  _tiles: Tile[][],
  tile: Tile,
): PlacementResult =>
  allowed.has(tile.terrain) ? { allowed: true } : { allowed: false, reason: message };

const nearWater = (): PlacementResult | undefined => undefined; // placeholder, see dock below

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  power_plant: {
    id: "power_plant",
    name: "Power Plant",
    category: "utility",
    zone: "civic",
    cost: 500,
    upkeepPerMonth: 5,
    jobs: 5,
    serviceRadius: 14,
    description: "Feeds the power grid along connected roads.",
  },
  water_tower: {
    id: "water_tower",
    name: "Water Tower",
    category: "utility",
    zone: "civic",
    cost: 400,
    upkeepPerMonth: 4,
    jobs: 3,
    serviceRadius: 14,
    description: "Feeds the water grid along connected roads.",
  },
  school: {
    id: "school",
    name: "School",
    category: "civic",
    zone: "civic",
    cost: 300,
    upkeepPerMonth: 3,
    jobs: 8,
    serviceRadius: 7,
    requiresPower: true,
    description: "Boosts happiness and growth for nearby residents.",
  },
  clinic: {
    id: "clinic",
    name: "Clinic",
    category: "civic",
    zone: "civic",
    cost: 350,
    upkeepPerMonth: 4,
    jobs: 6,
    serviceRadius: 7,
    requiresPower: true,
    requiresWater: true,
    description: "Health coverage — boosts happiness, speeds disaster recovery.",
  },
  church: {
    id: "church",
    name: "Church",
    category: "civic",
    zone: "civic",
    cost: 200,
    upkeepPerMonth: 1,
    jobs: 2,
    serviceRadius: 8,
    description: "Community anchor — a steady happiness boost.",
  },
  town_hall: {
    id: "town_hall",
    name: "Town Hall",
    category: "civic",
    zone: "civic",
    cost: 250,
    upkeepPerMonth: 2,
    jobs: 4,
    serviceRadius: 10,
    description: "Seat of government. Required before elections can be held.",
  },
  police_station: {
    id: "police_station",
    name: "Police Station",
    category: "civic",
    zone: "civic",
    cost: 350,
    upkeepPerMonth: 4,
    jobs: 6,
    serviceRadius: 7,
    requiresPower: true,
    description: "Coverage boosts happiness and approval.",
  },
  fire_station_volunteer: {
    id: "fire_station_volunteer",
    name: "Volunteer Fire Dept.",
    category: "civic",
    zone: "civic",
    cost: 150,
    upkeepPerMonth: 1,
    jobs: 2,
    serviceRadius: 5,
    description: "Cheap, early fire coverage — slower disaster response.",
  },
  fire_station_full: {
    id: "fire_station_full",
    name: "Fire Station",
    category: "civic",
    zone: "civic",
    cost: 400,
    upkeepPerMonth: 5,
    jobs: 6,
    serviceRadius: 9,
    requiresPower: true,
    requiresWater: true,
    description: "Full-time crew — fast disaster response, higher upkeep.",
  },
  covered_bridge: {
    id: "covered_bridge",
    name: "Covered Bridge",
    category: "civic",
    zone: "road",
    cost: 150,
    upkeepPerMonth: 1,
    jobs: 0,
    description: "A road crossing over the river, with local flavor.",
    canPlace: (_tiles, tile) =>
      tile.terrain === "river"
        ? { allowed: true }
        : { allowed: false, reason: "Covered bridges only span the river." },
  },
  dock: {
    id: "dock",
    name: "Dock",
    category: "agriculture",
    zone: "civic",
    cost: 150,
    upkeepPerMonth: 1,
    jobs: 3,
    description: "Fishes the river or lake — a major food source.",
    canPlace: (tiles, tile) =>
      tile.terrain === "riverside" ||
      tile.terrain === "lake" ||
      isWaterAdjacent(tiles, tile.x, tile.y)
        ? { allowed: true }
        : { allowed: false, reason: "Docks must be on the riverbank or lakeshore." },
  },
  hunting_cabin: {
    id: "hunting_cabin",
    name: "Hunting Cabin",
    category: "agriculture",
    zone: "civic",
    cost: 150,
    upkeepPerMonth: 1,
    jobs: 2,
    description: "Harvests deer for food, but only during autumn hunting season.",
    canPlace: (tiles, tile) =>
      isForestAdjacent(tiles, tile.x, tile.y)
        ? { allowed: true }
        : { allowed: false, reason: "Hunting cabins must border forest or hillside." },
  },
  barn: {
    id: "barn",
    name: "Barn",
    category: "agriculture",
    zone: "civic",
    cost: 100,
    upkeepPerMonth: 0,
    jobs: 0,
    description: "+200 food storage capacity.",
  },
  silo: {
    id: "silo",
    name: "Silo",
    category: "agriculture",
    zone: "civic",
    cost: 120,
    upkeepPerMonth: 0,
    jobs: 0,
    description: "+300 grain storage capacity.",
  },
  farmers_market: {
    id: "farmers_market",
    name: "Farmers Market",
    category: "commercial",
    zone: "commercial",
    cost: 200,
    upkeepPerMonth: 2,
    jobs: 4,
    description: "Sells surplus crops directly — income and happiness.",
  },
  historic_mill: {
    id: "historic_mill",
    name: "Historic Mill",
    category: "agriculture",
    zone: "civic",
    cost: 250,
    upkeepPerMonth: 2,
    jobs: 3,
    description: "Grinds wheat into flour for the town's bakeries.",
  },
  mine_shaft: {
    id: "mine_shaft",
    name: "Mine Shaft",
    category: "industry",
    zone: "industrial",
    cost: 300,
    upkeepPerMonth: 3,
    jobs: 6,
    description: "Extracts ore from mountain deposits.",
    canPlace: onTerrain(new Set(["mountain"]), "Mine shafts require mountain terrain."),
  },
  blacksmith: {
    id: "blacksmith",
    name: "Blacksmith",
    category: "industry",
    zone: "industrial",
    cost: 250,
    upkeepPerMonth: 3,
    jobs: 5,
    description: "Forges ore into tools and equipment.",
  },
  bakery: {
    id: "bakery",
    name: "Bakery",
    category: "commercial",
    zone: "commercial",
    cost: 150,
    upkeepPerMonth: 2,
    jobs: 3,
    description: "Turns flour into bread — income and happiness.",
  },
  butcher: {
    id: "butcher",
    name: "Butcher",
    category: "commercial",
    zone: "commercial",
    cost: 150,
    upkeepPerMonth: 2,
    jobs: 3,
    description: "Turns meat into income and happiness.",
  },
  tailor: {
    id: "tailor",
    name: "Tailor",
    category: "commercial",
    zone: "commercial",
    cost: 150,
    upkeepPerMonth: 2,
    jobs: 3,
    description: "Turns wool into clothing — income and happiness.",
  },
};

void nearWater;

export function canPlaceBuilding(tiles: Tile[][], tile: Tile, id: BuildingId): PlacementResult {
  const def = BUILDINGS[id];
  if (tile.terrain === "river" && id !== "covered_bridge" && id !== "dock") {
    return { allowed: false, reason: "Can't build on open water." };
  }
  if (tile.terrain === "lake" && id !== "dock") {
    return { allowed: false, reason: "Can't build on open water." };
  }
  if (tile.terrain === "mountain" && id !== "mine_shaft") {
    return { allowed: false, reason: "Too steep to build here." };
  }
  if (tile.building) {
    const isFireUpgrade = id === "fire_station_full" && tile.building === "fire_station_volunteer";
    if (!isFireUpgrade) {
      return { allowed: false, reason: "Something is already built here." };
    }
  }
  if (def.canPlace) return def.canPlace(tiles, tile);
  return { allowed: true };
}
