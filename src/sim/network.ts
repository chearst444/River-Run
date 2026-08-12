/**
 * Road connectivity and utility (power/water) coverage — the "classic
 * puzzle-y" spread mechanic from the GDD. Both are recomputed with a BFS
 * over the road graph; cheap enough at 48x48 to run once per simulated day.
 */

import { MAP_WIDTH, MAP_HEIGHT, type Tile } from "../config/grid";
import { BUILDINGS } from "./buildings";

const NEIGHBOR_OFFSETS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function isRoadLike(tile: Tile): boolean {
  return tile.zone === "road" || tile.building === "covered_bridge";
}

/** Road access: any zoned/built tile adjacent to a road (or road itself). */
export function updateRoadAccess(tiles: Tile[][]) {
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const tile = tiles[y][x];
      if (isRoadLike(tile)) {
        tile.hasRoadAccess = true;
        continue;
      }
      let adjacent = false;
      for (const [dx, dy] of NEIGHBOR_OFFSETS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_WIDTH || ny >= MAP_HEIGHT) continue;
        if (isRoadLike(tiles[ny][nx])) {
          adjacent = true;
          break;
        }
      }
      tile.hasRoadAccess = adjacent;
    }
  }
}

/**
 * Utility coverage: BFS out from every source building (power plant / water
 * tower) along the road network, up to that building's service radius in
 * road-hops. Any tile adjacent to a road tile within range gets coverage.
 */
function spreadUtility(
  tiles: Tile[][],
  sourceBuildingId: "power_plant" | "water_tower",
  flag: "hasPower" | "hasWater",
) {
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) tiles[y][x][flag] = false;
  }

  const radius = BUILDINGS[sourceBuildingId].serviceRadius ?? 10;
  const sources: { x: number; y: number }[] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (tiles[y][x].building === sourceBuildingId) sources.push({ x, y });
    }
  }
  if (sources.length === 0) return;

  const visited = new Set<string>();
  const queue: { x: number; y: number; dist: number }[] = sources.map((s) => ({
    ...s,
    dist: 0,
  }));
  sources.forEach((s) => visited.add(`${s.x},${s.y}`));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const tile = tiles[cur.y][cur.x];
    tile[flag] = true;
    // Also light up the four neighbors of a covered road tile, so
    // buildings sitting off the road (but adjacent to it) get service too.
    for (const [dx, dy] of NEIGHBOR_OFFSETS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_WIDTH || ny >= MAP_HEIGHT) continue;
      tiles[ny][nx][flag] = true;
    }
    if (cur.dist >= radius) continue;
    for (const [dx, dy] of NEIGHBOR_OFFSETS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_WIDTH || ny >= MAP_HEIGHT) continue;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      const neighbor = tiles[ny][nx];
      if (!isRoadLike(neighbor) && neighbor.building !== sourceBuildingId) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny, dist: cur.dist + 1 });
    }
  }
}

export function updateUtilities(tiles: Tile[][]) {
  spreadUtility(tiles, "power_plant", "hasPower");
  spreadUtility(tiles, "water_tower", "hasWater");
}

/**
 * Collect the positions of every built instance of the given building
 * kinds, once, so per-tile coverage checks don't rescan the whole grid.
 */
export function collectBuildingPositions(
  tiles: Tile[][],
  buildingIds: ReadonlySet<string>,
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const b = tiles[y][x].building;
      if (b && buildingIds.has(b)) positions.push({ x, y });
    }
  }
  return positions;
}

/** Chebyshev-distance coverage check against a precomputed building list. */
export function isWithinServiceRange(
  positions: { x: number; y: number }[],
  x: number,
  y: number,
  maxRadius: number,
): boolean {
  for (const p of positions) {
    if (Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= maxRadius) return true;
  }
  return false;
}
