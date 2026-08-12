import type { BuildingId, CropId, TerrainType, ZoneType } from "../config/grid";

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
export const DAMAGED_TINT = 0xff2222;
export const NO_UTILITY_DOT = 0xff8800;

export const CROP_COLORS: Record<CropId, number> = {
  wheat: 0xd9c25b,
  corn: 0xe0b23f,
  potatoes: 0xa9895b,
  tomatoes: 0xc4522f,
  apples: 0x7a9a3c,
  cows: 0xa9765b,
  chickens: 0xd8c9a3,
  goats: 0xb8ab8f,
  sheep: 0xe4ded0,
};

/** Short glyphs drawn over buildings — no art assets yet, so text stands in. */
export const BUILDING_GLYPH: Record<BuildingId, string> = {
  power_plant: "⚡",
  water_tower: "💧",
  school: "🏫",
  clinic: "⛑",
  church: "⛪",
  town_hall: "🏛",
  police_station: "🚓",
  fire_station_volunteer: "🚒",
  fire_station_full: "🚒",
  covered_bridge: "🌉",
  dock: "🎣",
  hunting_cabin: "🦌",
  barn: "🌾",
  silo: "🥫",
  farmers_market: "🧺",
  historic_mill: "⚙",
  mine_shaft: "⛏",
  blacksmith: "🔨",
  bakery: "🍞",
  butcher: "🥩",
  tailor: "🧵",
};
