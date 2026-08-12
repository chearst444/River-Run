import type { TerrainType, ZoneType } from "../config/grid";

export const TERRAIN_COLORS: Record<TerrainType, number> = {
  river: 0x3a7ca5,
  lake: 0x4a8fc0,
  riverside: 0x9db27a,
  lowland: 0x7fa65a,
  hillside: 0x8c9a5b,
  mountain: 0x8a8378,
  forest: 0x4f7a3d,
};

export const ZONE_COLORS: Record<Exclude<ZoneType, "none">, number> = {
  road: 0x4a4a4a,
  residential: 0x5b8fd6,
  commercial: 0xd6a75b,
  industrial: 0xb05b5b,
  farmland: 0xd9c25b,
  civic: 0x9b5bd6,
};

export const INVALID_PLACEMENT_TINT = 0xff4444;
export const GRID_LINE_COLOR = 0x000000;
export const GRID_LINE_ALPHA = 0.08;
export const HOVER_HIGHLIGHT_COLOR = 0xffffff;
