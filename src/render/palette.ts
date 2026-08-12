import type { BuildingId, CropId, TerrainType, ZoneType } from "../config/grid";
import type { BuildingCategory } from "../sim/buildings";

export const TERRAIN_COLORS: Record<TerrainType, number> = {
  river: 0x3a7ca5,
  lake: 0x4a8fc0,
  riverside: 0x9db27a,
  lowland: 0x7fa65a,
  hillside: 0x8c9a5b,
  mountain: 0x8a8378,
  forest: 0x4f7a3d,
};

/**
 * Photo textures (from the user's own texture library) mapped onto each
 * terrain type. River and lake share one water photo — tinted apart by
 * the TERRAIN_COLORS blend wash in GameScene, same as every other
 * terrain-to-terrain seam.
 */
export const TERRAIN_TEXTURE_KEY: Record<TerrainType, string> = {
  river: "tex-water",
  lake: "tex-water",
  riverside: "tex-pebble",
  lowland: "tex-grass",
  hillside: "tex-straw",
  mountain: "tex-stone",
  forest: "tex-leaves",
};

/** File served from /public/textures — one fetch per unique key even though river+lake share it. */
export const TEXTURE_FILES: Record<string, string> = {
  "tex-water": "/textures/water.jpg",
  "tex-pebble": "/textures/pebble.jpg",
  "tex-grass": "/textures/grass.jpg",
  "tex-straw": "/textures/straw.jpg",
  "tex-stone": "/textures/stone.jpg",
  "tex-leaves": "/textures/leaves.jpg",
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

/**
 * Category colors — the single source of truth for both the toolbar
 * (as CSS hex strings) and the in-world building badges (as Phaser
 * numeric colors, derived below). One palette, one visual language,
 * instead of each building improvising its own look.
 */
export const CATEGORY_COLOR_CSS: Record<BuildingCategory, string> = {
  utility: "#e0d15b",
  civic: "#9b5bd6",
  agriculture: "#7a9a3c",
  commercial: "#d6a75b",
  industry: "#8a8378",
};

export const CATEGORY_COLOR_NUM: Record<BuildingCategory, number> = {
  utility: 0xe0d15b,
  civic: 0x9b5bd6,
  agriculture: 0x7a9a3c,
  commercial: 0xd6a75b,
  industry: 0x8a8378,
};

/**
 * Short monogram drawn on every building's badge — a consistent
 * badge-plus-monogram treatment stands in for a hand-drawn icon set
 * (none exists yet), so every building reads as one visual family
 * instead of a grab-bag of emoji with wildly different art styles.
 */
export const BUILDING_ABBR: Record<BuildingId, string> = {
  power_plant: "PWR",
  water_tower: "H2O",
  school: "SCH",
  clinic: "CLN",
  church: "CHR",
  town_hall: "TH",
  police_station: "PD",
  fire_station_volunteer: "VFD",
  fire_station_full: "FD",
  covered_bridge: "BRG",
  dock: "DCK",
  hunting_cabin: "HNT",
  barn: "BRN",
  silo: "SLO",
  farmers_market: "MKT",
  historic_mill: "MLL",
  mine_shaft: "MNE",
  blacksmith: "SMH",
  bakery: "BKY",
  butcher: "BCH",
  tailor: "TLR",
};
