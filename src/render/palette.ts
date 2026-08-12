import type { BuildingId, CropId, ZoneType } from "../config/grid";
import type { BuildingCategory } from "../sim/buildings";

/** The extracted bridge photo — a discrete sprite (see drawBuildingBadge's covered_bridge case), not a repeating fill. */
export const BRIDGE_TEXTURE_KEY = "tex-river-bridge";

/**
 * The user's full reference image, used unmodified (not cropped, not
 * tiled) as the single backdrop for the *entire* map — see GameScene's
 * drawTerrainBackdrop. Every terrain type (river, banks, fields, forest)
 * is part of this one picture now; there's no more per-terrain-type photo
 * stamping (see terrain.ts's RIVER_MASK for how the gameplay grid's
 * water/land tiles were aligned to it).
 */
export const MAP_BACKDROP_TEXTURE_KEY = "tex-map-backdrop";

/**
 * Real photo-cutout icons for crops, filled in incrementally as the user
 * generates more art — a `Partial` map on purpose, so a crop with no entry
 * yet just falls back to its flat CROP_COLORS fill (see
 * GameScene.redrawDynamicLayers). Same idea as BRIDGE_TEXTURE_KEY was for
 * the covered bridge, generalized so each new asset is a one-line add
 * here instead of new bespoke rendering code.
 */
export const CROP_SPRITE_KEY: Partial<Record<CropId, string>> = {
  tomatoes: "sprite-crop-tomatoes",
  wheat: "sprite-crop-wheat",
  potatoes: "sprite-crop-potatoes",
  chickens: "sprite-crop-chickens",
  cows: "sprite-crop-cows",
  apples: "sprite-crop-apples",
  corn: "sprite-crop-corn",
  goats: "sprite-crop-goats",
  sheep: "sprite-crop-sheep",
};

/**
 * Real photo-cutout icons for buildings, same deal as CROP_SPRITE_KEY —
 * anything not listed here keeps its category badge + monogram (see
 * GameScene.drawBuildingBadge). The covered bridge was the original
 * one-off special case; it's folded in here as just another entry.
 *
 * dock/hunting_cabin/mine_shaft use the resource they produce (fish, deer,
 * ore) rather than a picture of the structure itself — that's what the
 * user generated for them, and it reads clearly on a tile either way.
 * school is an actual building render.
 */
export const BUILDING_SPRITE_KEY: Partial<Record<BuildingId, string>> = {
  covered_bridge: BRIDGE_TEXTURE_KEY,
  dock: "sprite-building-dock",
  hunting_cabin: "sprite-building-hunting_cabin",
  mine_shaft: "sprite-building-mine_shaft",
  school: "sprite-building-school",
};

/** Files served from /public — textures and sprites alike load through the same Phaser loader. */
export const TEXTURE_FILES: Record<string, string> = {
  [BRIDGE_TEXTURE_KEY]: "/textures/river_bridge.jpg",
  [MAP_BACKDROP_TEXTURE_KEY]: "/textures/river_valley.jpg",
  "sprite-crop-tomatoes": "/sprites/crop_tomatoes.png",
  "sprite-crop-wheat": "/sprites/crop_wheat.png",
  "sprite-crop-potatoes": "/sprites/crop_potatoes.png",
  "sprite-crop-chickens": "/sprites/crop_chickens.png",
  "sprite-crop-cows": "/sprites/crop_cows.png",
  "sprite-crop-apples": "/sprites/crop_apples.png",
  "sprite-crop-corn": "/sprites/crop_corn.png",
  "sprite-crop-goats": "/sprites/crop_goats.png",
  "sprite-crop-sheep": "/sprites/crop_sheep.png",
  "sprite-building-dock": "/sprites/building_dock.png",
  "sprite-building-hunting_cabin": "/sprites/building_hunting_cabin.png",
  "sprite-building-mine_shaft": "/sprites/building_mine_shaft.png",
  "sprite-building-school": "/sprites/building_school.png",
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
