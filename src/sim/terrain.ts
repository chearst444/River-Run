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

export function generateTerrain(opts: GenerateOptions = {}): Tile[][] {
  const rand = mulberry32(opts.seed ?? 1337);
  const tiles: Tile[][] = [];

  // River centerline meanders gently across x as y increases.
  const riverCenterX = (y: number) => {
    const t = y / MAP_HEIGHT;
    return MAP_WIDTH * 0.5 + Math.sin(t * Math.PI * 2.2) * (MAP_WIDTH * 0.12);
  };
  const riverHalfWidth = 1.6;

  // Inland lake: a roughly circular patch away from the river, biased
  // toward the far side of the map.
  const lakeCenter = { x: MAP_WIDTH * 0.82, y: MAP_HEIGHT * 0.62 };
  const lakeRadius = 3.2;

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
      } else if (distToRiver < riverHalfWidth + 2.5) {
        terrain = "riverside";
        elevation = 1;
      } else if (distToEdge < 4) {
        terrain = "mountain";
        elevation = 8 + rand() * 2;
      } else if (distToEdge < 8) {
        terrain = rand() < 0.5 ? "forest" : "hillside";
        elevation = 5 + rand() * 2;
      } else if (distToEdge < 12) {
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
