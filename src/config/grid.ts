/**
 * Grid & tile configuration shared by rendering and simulation code.
 * Kept deliberately dependency-free so simulation modules can import it
 * without pulling in Phaser.
 */

export const TILE_SIZE = 64; // px, at zoom level 1

export const MAP_WIDTH = 48; // tiles
export const MAP_HEIGHT = 48; // tiles

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

/** Zoning/building layer — what the player has placed on a tile. */
export type ZoneType =
  | "none"
  | "road"
  | "residential"
  | "commercial"
  | "industrial"
  | "farmland"
  | "civic";

export interface Tile {
  x: number;
  y: number;
  terrain: TerrainType;
  zone: ZoneType;
  /** Elevation in arbitrary units; higher = safer from flooding. */
  elevation: number;
  /** True once connected to the road network (computed, not stored long-term ideally, but cached here for render). */
  hasRoadAccess: boolean;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT;
}
