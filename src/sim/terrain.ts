/**
 * Terrain generation for the river valley map.
 * Pure simulation logic — no Phaser imports — so it can be unit tested
 * and tuned independently of rendering.
 *
 * Shape: a main river runs roughly north-south with a gentle meander,
 * flanked by low riverside ground, rising through hillside terrain to a
 * mountain/forest edge on both far sides. A smaller inland lake sits away
 * from the river so farms on the far side of the map still have water
 * access.
 */

import {
  MAP_WIDTH,
  MAP_HEIGHT,
  inBounds,
  createTile,
  type Tile,
  type TerrainType,
} from "../config/grid";

// Simple deterministic pseudo-random (mulberry32) so a given seed always
// produces the same valley — useful for save/load and testing.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GenerateOptions {
  seed?: number;
}

/**
 * The river's centerline: a sine-generated meander (the standard
 * geomorphological model for a real river curve), expressed continuously
 * so it can be sampled at any y — not just integer rows — for both
 * terrain generation (which tile is "river") and, separately, smooth
 * rendering (see GameScene's river ribbon, which samples this same
 * function at a much finer resolution than one point per tile).
 *
 * amplitudeFraction/cycles are exposed (not just inlined constants) so
 * alternate curve shapes are a one-line change — useful for previewing a
 * few path options.
 */
export interface RiverCurveConfig {
  amplitudeFraction: number; // swing from center, as a fraction of MAP_WIDTH
  cycles: number; // number of full sine periods across the map's height (1 = one clean S)
  phase: number;
}

export const DEFAULT_RIVER_CURVE: RiverCurveConfig = {
  amplitudeFraction: 0.15,
  cycles: 1,
  phase: 0,
};

export function riverCenterX(y: number, config: RiverCurveConfig = DEFAULT_RIVER_CURVE): number {
  const t = y / MAP_HEIGHT;
  return (
    MAP_WIDTH * 0.5 +
    Math.sin(t * Math.PI * 2 * config.cycles + config.phase) * (MAP_WIDTH * config.amplitudeFraction)
  );
}

// Tile-unit geometry below is scaled to the map's current resolution
// (halved alongside MAP_WIDTH/MAP_HEIGHT when tiles doubled in size) so
// the river/lake/mountain proportions stay the same real-world shape.
export const RIVER_HALF_WIDTH = 0.8;
export const RIVERSIDE_BAND_WIDTH = 1.25; // extra width beyond RIVER_HALF_WIDTH that's "riverside" terrain

export function generateTerrain(opts: GenerateOptions = {}): Tile[][] {
  const rand = mulberry32(opts.seed ?? 1337);
  const tiles: Tile[][] = [];
  const riverHalfWidth = RIVER_HALF_WIDTH;

  // Inland lake: a roughly circular patch away from the river, biased
  // toward the far side of the map.
  const lakeCenter = { x: MAP_WIDTH * 0.82, y: MAP_HEIGHT * 0.62 };
  const lakeRadius = 1.6;

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: Tile[] = [];
    const cx = riverCenterX(y);
    for (let x = 0; x < MAP_WIDTH; x++) {
      const distToRiver = Math.abs(x - cx);
      const distToLake = Math.hypot(x - lakeCenter.x, y - lakeCenter.y);
      // Distance to nearest map edge (left/right) — drives the
      // hillside -> mountain progression on both flanks.
      const distToEdge = Math.min(x, MAP_WIDTH - 1 - x);

      let terrain: TerrainType;
      let elevation: number;

      if (distToRiver < riverHalfWidth) {
        terrain = "river";
        elevation = 0;
      } else if (distToLake < lakeRadius) {
        terrain = "lake";
        elevation = 0;
      } else if (distToRiver < riverHalfWidth + RIVERSIDE_BAND_WIDTH) {
        terrain = "riverside";
        elevation = 1;
      } else if (distToEdge < 2) {
        terrain = "mountain";
        elevation = 8 + rand() * 2;
      } else if (distToEdge < 4) {
        terrain = rand() < 0.5 ? "forest" : "hillside";
        elevation = 5 + rand() * 2;
      } else if (distToEdge < 6) {
        terrain = "hillside";
        elevation = 3 + rand() * 1.5;
      } else {
        terrain = "lowland";
        elevation = 1.5 + rand() * 1;
      }

      row.push(createTile(x, y, terrain, elevation));
    }
    tiles.push(row);
  }

  return tiles;
}

export function getTile(tiles: Tile[][], x: number, y: number): Tile | undefined {
  if (!inBounds(x, y)) return undefined;
  return tiles[y]?.[x];
}

/** River and lake both count as "water" for adjacency/rendering purposes — they connect seamlessly. */
export function isWaterTerrain(terrain: TerrainType): boolean {
  return terrain === "river" || terrain === "lake";
}

/** Farmland must border the river or the lake (or a riverside tile). */
export function isWaterAdjacent(tiles: Tile[][], x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const t = getTile(tiles, x + dx, y + dy);
      if (t && (t.terrain === "river" || t.terrain === "lake")) return true;
    }
  }
  return false;
}

/** Hunting cabins must border forest (or sit in the hillside fringe near it). */
export function isForestAdjacent(tiles: Tile[][], x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const t = getTile(tiles, x + dx, y + dy);
      if (t && (t.terrain === "forest" || t.terrain === "hillside")) return true;
    }
  }
  return false;
}
