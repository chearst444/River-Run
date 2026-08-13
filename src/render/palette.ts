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
 * Real photo-cutout icons for crops — every crop has an entry now. Same
 * idea as BRIDGE_TEXTURE_KEY was for the covered bridge, generalized so
 * each new asset was a one-line add here instead of new bespoke rendering
 * code.
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
 * hunting_cabin/mine_shaft use the resource they produce (a deer, a raw
 * ore ingot) rather than a picture of the structure itself — that's what
 * the user generated for them, and it reads clearly on a tile either way.
 * dock started the same way (a fish icon) but was swapped for an actual
 * dock/pier render once that art arrived — the resource-icon approach was
 * always a stand-in for a real structure render, not a permanent choice.
 */
export const BUILDING_SPRITE_KEY: Partial<Record<BuildingId, string>> = {
  covered_bridge: BRIDGE_TEXTURE_KEY,
  dock: "sprite-building-dock",
  hunting_cabin: "sprite-building-hunting_cabin",
  mine_shaft: "sprite-building-mine_shaft",
  school: "sprite-building-school",
  church: "sprite-building-church",
  town_hall: "sprite-building-town_hall",
  police_station: "sprite-building-police_station",
  fire_station_full: "sprite-building-fire_station_full",
  power_plant: "sprite-building-power_plant",
  water_tower: "sprite-building-water_tower",
  barn: "sprite-building-barn",
  silo: "sprite-building-silo",
  bakery: "sprite-building-bakery",
  butcher: "sprite-building-butcher",
  tailor: "sprite-building-tailor",
  farmers_market: "sprite-building-farmers_market",
  historic_mill: "sprite-building-historic_mill",
  blacksmith: "sprite-building-blacksmith",
  clinic: "sprite-building-clinic",
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
  "sprite-building-church": "/sprites/building_church.png",
  "sprite-building-town_hall": "/sprites/building_town_hall.png",
  "sprite-building-police_station": "/sprites/building_police_station.png",
  "sprite-building-fire_station_full": "/sprites/building_fire_station_full.png",
  "sprite-building-power_plant": "/sprites/building_power_plant.png",
  "sprite-building-water_tower": "/sprites/building_water_tower.png",
  "sprite-building-barn": "/sprites/building_barn.png",
  "sprite-building-silo": "/sprites/building_silo.png",
  "sprite-building-bakery": "/sprites/building_bakery.png",
  "sprite-building-butcher": "/sprites/building_butcher.png",
  "sprite-building-tailor": "/sprites/building_tailor.png",
  "sprite-building-farmers_market": "/sprites/building_farmers_market.png",
  "sprite-building-historic_mill": "/sprites/building_historic_mill.png",
  "sprite-building-blacksmith": "/sprites/building_blacksmith.png",
  "sprite-building-clinic": "/sprites/building_clinic.png",
};

/**
 * Fallback fill for a zoned tile that has nothing else to show — a bare
 * road, or a residential/commercial/industrial lot with no building on it
 * yet (those zones grow density abstractly; most of a zoned tile's life
 * has no building sprite at all). GameScene.redrawDynamicLayers only
 * paints this when a tile has no crop/building icon, so it never sits
 * behind one — that was the actual complaint (a colored rectangle behind
 * every building/crop icon), not zoned land being visible at all, and
 * roads in particular need to stay visible or the road network is
 * impossible to read.
 */
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
