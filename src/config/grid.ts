/**
 * Grid & tile configuration shared by rendering and simulation code.
 * Kept deliberately dependency-free so simulation modules can import it
 * without pulling in Phaser.
 */

// Tiles doubled in size and halved in count per axis (48x64 -> 24x128) so
// the world covers the same total pixel area — same map, chunkier cells.
export const TILE_SIZE = 128; // px, at zoom level 1

export const MAP_WIDTH = 24; // tiles
export const MAP_HEIGHT = 24; // tiles

export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 2.5;
export const DEFAULT_ZOOM = 0.75;

/** Terrain kinds — set once at map generation, never changed by zoning. */
export type TerrainType =
  | "river"
  | "lake"
  | "riverside"
  | "lowland"
  | "hillside"
  | "mountain"
  | "forest";

/** Broad zoning layer — what category of use the player has assigned a tile. */
export type ZoneType =
  | "none"
  | "road"
  | "residential"
  | "commercial"
  | "industrial"
  | "farmland"
  | "civic";

/** Discrete facility placed on a tile, layered on top of (or defining) its zone. */
export type BuildingId =
  | "power_plant"
  | "water_tower"
  | "school"
  | "clinic"
  | "church"
  | "town_hall"
  | "police_station"
  | "fire_station_volunteer"
  | "fire_station_full"
  | "covered_bridge"
  | "dock"
  | "hunting_cabin"
  | "barn"
  | "silo"
  | "farmers_market"
  | "historic_mill"
  | "mine_shaft"
  | "blacksmith"
  | "bakery"
  | "butcher"
  | "tailor";

/** What's currently planted/raised on a farmland tile. */
export type CropId =
  | "wheat"
  | "corn"
  | "potatoes"
  | "tomatoes"
  | "apples"
  | "cows"
  | "chickens"
  | "goats"
  | "sheep";

export type ResidentialDensity = 0 | 1 | 2; // low / medium / high

export interface Tile {
  x: number;
  y: number;
  terrain: TerrainType;
  zone: ZoneType;
  building: BuildingId | null;
  cropType: CropId | null;
  /** Elevation in arbitrary units; higher = safer from flooding. */
  elevation: number;
  /** True once connected to the road network (computed each sim tick). */
  hasRoadAccess: boolean;
  hasPower: boolean;
  hasWater: boolean;
  density: ResidentialDensity;
  /** Set by disasters; damaged tiles produce/house nothing until repaired. */
  damaged: boolean;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT;
}

export function createTile(
  x: number,
  y: number,
  terrain: TerrainType,
  elevation: number,
): Tile {
  return {
    x,
    y,
    terrain,
    zone: "none",
    building: null,
    cropType: null,
    elevation,
    hasRoadAccess: false,
    hasPower: false,
    hasWater: false,
    density: 0,
    damaged: false,
  };
}
