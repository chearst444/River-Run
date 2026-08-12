/**
 * Terrain generation for the river valley map.
 * Pure simulation logic — no Phaser imports — so it can be unit tested
 * and tuned independently of rendering.
 *
 * The river's shape is no longer procedural: the whole map now renders as
 * one single background image (the user's reference photo — see
 * GameScene's drawTerrainBackdrop / palette.ts's MAP_BACKDROP_TEXTURE_KEY),
 * so the *gameplay* grid's water tiles have to line up with where that
 * picture actually shows water, not a formula. RIVER_MASK below is that
 * picture's river traced onto the map's 24x24 grid (see docs/river-mask.md
 * for how it was derived) — it even captures the river forking around a
 * mid-stream rock island, which a single centerline curve never could.
 * Everything else (the hillside/mountain/forest fringe near the map edges)
 * still uses the original distance-based rule.
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
 * '#' = river/water tile, '.' = land — one row per map row, traced from
 * the reference image by color-thresholding its water pixels (bright
 * cyan/turquoise vs. the greens/browns/yellows everywhere else), then
 * downsampling to the map's 24x24 tile grid. Sized for the current
 * MAP_WIDTH x MAP_HEIGHT (24x24); if the map's dimensions ever change this
 * needs retracing against the image at the new resolution.
 */
const RIVER_MASK: readonly string[] = [
  ".............#..........",
  ".............#..........",
  ".............##.........",
  ".............#..........",
  "..............##........",
  "..............##........",
  ".............###........",
  "............###.........",
  "............#...........",
  "............#...........",
  "............#...........",
  "...........#............",
  "..........#.#...........",
  ".........####...........",
  ".........#####..........",
  ".......##....##.........",
  ".......#.....##.........",
  "......##......##........",
  "......##.......#........",
  ".......#.......##.......",
  ".......#........###.....",
  "......#...........##....",
  ".....##............#....",
  "....##..............#...",
];

function isRiverTile(x: number, y: number): boolean {
  return RIVER_MASK[y]?.[x] === "#";
}

/** Any of the 8 neighbors is river, but this tile itself isn't — the bank. */
function isRiversideTile(x: number, y: number): boolean {
  if (isRiverTile(x, y)) return false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (isRiverTile(x + dx, y + dy)) return true;
    }
  }
  return false;
}

export function generateTerrain(opts: GenerateOptions = {}): Tile[][] {
  const rand = mulberry32(opts.seed ?? 1337);
  const tiles: Tile[][] = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      // Distance to nearest map edge (left/right) — drives the
      // hillside -> mountain progression on both flanks.
      const distToEdge = Math.min(x, MAP_WIDTH - 1 - x);

      let terrain: TerrainType;
      let elevation: number;

      if (isRiverTile(x, y)) {
        terrain = "river";
        elevation = 0;
      } else if (isRiversideTile(x, y)) {
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
