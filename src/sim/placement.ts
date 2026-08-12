/**
 * Placement legality rules — pure functions, no rendering concerns.
 * Phase 1 keeps this intentionally simple (terrain-based only); road
 * adjacency requirements for residential/commercial/industrial zones
 * land in Phase 2 once the road network exists.
 */

import type { Tile, ZoneType } from "../config/grid";
import { isWaterAdjacent } from "./terrain";

export interface PlacementResult {
  allowed: boolean;
  reason?: string;
}

const UNBUILDABLE_TERRAIN = new Set(["river", "lake"]);

export function canPlaceZone(tiles: Tile[][], tile: Tile, zone: ZoneType): PlacementResult {
  if (zone === "none") return { allowed: true };

  if (UNBUILDABLE_TERRAIN.has(tile.terrain)) {
    return { allowed: false, reason: "Can't build on open water." };
  }

  if (zone === "farmland") {
    if (tile.terrain === "mountain") {
      return { allowed: false, reason: "Farmland can't be placed on mountain terrain." };
    }
    if (!isWaterAdjacent(tiles, tile.x, tile.y)) {
      return { allowed: false, reason: "Farmland must border the river or lake." };
    }
    return { allowed: true };
  }

  if (zone === "road") {
    if (tile.terrain === "mountain") {
      return { allowed: false, reason: "Roads can't cross mountain terrain (yet)." };
    }
    return { allowed: true };
  }

  // residential / commercial / industrial / civic
  if (tile.terrain === "mountain") {
    return { allowed: false, reason: "Too steep to build here." };
  }

  return { allowed: true };
}
