import Phaser from "phaser";
import {
  TILE_SIZE,
  MAP_WIDTH,
  MAP_HEIGHT,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  type BuildingId,
  type CropId,
  type Tile,
} from "../config/grid";
import type { SimulationEngine } from "../sim/engine";
import { BUILDINGS } from "../sim/buildings";
import { isWaterTerrain, riverCenterX, RIVER_HALF_WIDTH } from "../sim/terrain";
import {
  TERRAIN_COLORS,
  TERRAIN_TEXTURE_KEY,
  TEXTURE_FILES,
  BRIDGE_TEXTURE_KEY,
  ZONE_COLORS,
  CROP_COLORS,
  GRID_LINE_COLOR,
  GRID_LINE_ALPHA,
  HOVER_HIGHLIGHT_COLOR,
  DAMAGED_TINT,
  NO_UTILITY_DOT,
  BUILDING_ABBR,
  CATEGORY_COLOR_NUM,
} from "../render/palette";
import { eventBus, Events, type ToolSelection } from "../events";

const TAP_MOVE_THRESHOLD = 10; // px — beyond this, a touch is a drag/pan, not a tap
const DRAG_ZOOM_SENSITIVITY = 1;
// The corner-gradient blend wash sits on top of the photo tiles at partial
// alpha — enough to soften the seam between two different photos and keep
// the palette's terrain-type legibility, without hiding the photo texture.
const BLEND_WASH_ALPHA = 0.4;

// Lake autotiling: each lake tile's 4 corners are independently rounded
// based on whether the two edges touching that corner are also water
// (square, seamless) or land (rounded bank) — the standard blob-tile
// technique, done procedurally since there's no hand-painted directional
// tileset. A corner with land on both sides rounds hard (the outside of a
// bulge, or a lone tile's tip); a corner with land on one side rounds
// gently (a straight bank edge, softened instead of a hard right angle).
// The river itself uses a different technique — see buildRiverRibbonShape
// — since a blob-per-tile approximation of a single winding *line* still
// reads as a staircase even with rounded corners; a lake is closer to a
// blob region, where this per-tile approach genuinely fits.
const LAKE_CORNER_ROUND_STRONG = 0.46; // fraction of TILE_SIZE
const LAKE_CORNER_ROUND_MILD = 0.22;

// How finely the river's true sine centerline is sampled when building its
// ribbon shape — many samples per tile, so the curve reads as genuinely
// smooth rather than a coarse polygon.
const RIVER_RIBBON_SAMPLES_PER_TILE = 8;

// The ribbon's left/right edges are each perturbed by a small amount of
// smooth, deterministic "noise" (band-limited: a few sine octaves, not
// per-sample randomness) so the bank line reads as an irregular natural
// edge rather than a perfectly geometric offset curve — real riverbanks
// aren't a constant-width line. Amplitude is kept well under
// RIVER_HALF_WIDTH so the two edges can never cross.
const LEFT_BANK_JITTER_SEED = 0;
const RIGHT_BANK_JITTER_SEED = 37.5;
function bankEdgeJitter(yTiles: number, seed: number): number {
  return (
    Math.sin(yTiles * 0.65 + seed) * 0.15 +
    Math.sin(yTiles * 1.9 + seed * 2.1) * 0.09 +
    Math.sin(yTiles * 4.6 + seed * 0.6) * 0.05
  );
}

export class GameScene extends Phaser.Scene {
  private engine: SimulationEngine;
  private textureLayer!: Phaser.GameObjects.Container;
  // Geometry-mask source shapes for water tiles' rounded corners. Not part
  // of the display list (created via `make.graphics(_, false)`), so they
  // need their own cleanup list rather than riding along with a container.
  private waterMaskGraphics: Phaser.GameObjects.Graphics[] = [];
  private terrainLayer!: Phaser.GameObjects.Graphics;
  private zoneLayer!: Phaser.GameObjects.Graphics;
  private buildingLayer!: Phaser.GameObjects.Container;
  private hoverLayer!: Phaser.GameObjects.Graphics;

  private selectedTool: ToolSelection = "road";
  private selectedCrop: CropId = "wheat";
  private dirty = true;

  // Pointer/gesture tracking
  private activePointers: Map<number, Phaser.Math.Vector2> = new Map();
  private pinchStartDistance = 0;
  private pinchStartZoom = 1;
  private isPinching = false;
  private lastPanPoint: Phaser.Math.Vector2 | null = null;
  private pointerDownPos: Phaser.Math.Vector2 | null = null;
  private pointerMoved = false;

  constructor(engine: SimulationEngine) {
    super("game");
    this.engine = engine;
  }

  preload() {
    for (const [key, url] of Object.entries(TEXTURE_FILES)) {
      this.load.image(key, url);
    }
  }

  create() {
    const worldWidth = MAP_WIDTH * TILE_SIZE;
    const worldHeight = MAP_HEIGHT * TILE_SIZE;

    // Textures first so everything else — the blend wash, zoning, buildings
    // — layers on top of them in draw order.
    this.textureLayer = this.add.container(0, 0);
    this.terrainLayer = this.add.graphics();
    this.zoneLayer = this.add.graphics();
    this.buildingLayer = this.add.container(0, 0);
    this.hoverLayer = this.add.graphics();

    this.drawTerrainTextures();
    this.drawTerrain();
    this.drawGridLines(worldWidth, worldHeight);
    this.redrawDynamicLayers();

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);
    this.cameras.main.setZoom(DEFAULT_ZOOM);

    this.input.addPointer(2); // support up to 3 simultaneous touch points (pinch + a spare)
    this.setupInput();

    eventBus.on(Events.ToolSelected, (payload: { tool: ToolSelection }) => {
      this.selectedTool = payload.tool;
    });
    eventBus.on(Events.CropSelected, (crop: CropId) => {
      this.selectedCrop = crop;
    });
    eventBus.on(Events.StateChanged, () => {
      this.dirty = true;
    });
    eventBus.on(Events.GameLoaded, () => {
      this.drawTerrainTextures();
      this.drawTerrain();
      this.dirty = true;
    });
  }

  update(_time: number, delta: number) {
    this.engine.update(delta);
    if (this.dirty) {
      this.redrawDynamicLayers();
      this.dirty = false;
    }
  }

  private get tiles(): Tile[][] {
    return this.engine.state.tiles;
  }

  /**
   * Every terrain tile gets a photo texture (see drawTerrainTextures), but
   * two different photos butted up against each other at a hard tile edge
   * still reads as a seam. This draws the same 4-corner color gradient as
   * before — each corner averaged from every tile that shares it — as a
   * partial-alpha wash on top of the photos: soft enough to still show
   * the texture through, opaque enough to round off the seam and keep
   * each terrain type's color identity legible at a glance.
   */
  private drawTerrain() {
    const g = this.terrainLayer;
    g.clear();

    const colorAt = (x: number, y: number): number => TERRAIN_COLORS[this.tiles[y][x].terrain];

    const CORNER_OFFSETS = [
      [-1, -1],
      [0, -1],
      [-1, 0],
      [0, 0],
    ] as const;
    const cornerColor = (cx: number, cy: number): number => {
      const colors: number[] = [];
      for (const [dx, dy] of CORNER_OFFSETS) {
        const tx = cx + dx;
        const ty = cy + dy;
        if (tx >= 0 && ty >= 0 && tx < MAP_WIDTH && ty < MAP_HEIGHT) colors.push(colorAt(tx, ty));
      }
      return averageColors(colors);
    };

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const topLeft = cornerColor(x, y);
        const topRight = cornerColor(x + 1, y);
        const bottomLeft = cornerColor(x, y + 1);
        const bottomRight = cornerColor(x + 1, y + 1);
        g.fillGradientStyle(
          topLeft,
          topRight,
          bottomLeft,
          bottomRight,
          BLEND_WASH_ALPHA,
          BLEND_WASH_ALPHA,
          BLEND_WASH_ALPHA,
          BLEND_WASH_ALPHA,
        );
        g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  /**
   * Draws each tile's terrain as a photo texture from the user's own
   * texture library (see palette.ts's TERRAIN_TEXTURE_KEY), scaled to
   * fully cover the tile. Each tile gets a deterministic flip/rotation
   * (the source photos are square and directionless, so this is safe) so
   * the same source photo doesn't look like an identical repeated stamp
   * across the map — cheap variety without needing real per-tile crops.
   *
   * Lake tiles get a per-tile autotiled bank (see drawLakeTile). River
   * tiles are handled differently: their water stamp is collected here
   * and clipped as one continuous ribbon afterward (applyRiverRibbonMask)
   * instead of a plain full-square stamp or a per-tile rounded blob, so
   * the water reads as one smoothly curving waterway rather than a
   * staircase of disconnected squares.
   */
  private drawTerrainTextures() {
    this.textureLayer.removeAll(true);
    this.waterMaskGraphics.forEach((g) => g.destroy());
    this.waterMaskGraphics = [];

    const riverWaterImages: Phaser.GameObjects.Image[] = [];

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const terrain = this.tiles[y][x].terrain;

        if (terrain === "lake") {
          this.drawLakeTile(x, y);
          continue;
        }

        if (terrain === "river") {
          this.placeTextureStamp(x, y, TERRAIN_TEXTURE_KEY.riverside, 7919); // bank base
          riverWaterImages.push(this.placeTextureStamp(x, y, TERRAIN_TEXTURE_KEY.river, 0));
          continue;
        }

        this.placeTextureStamp(x, y, TERRAIN_TEXTURE_KEY[terrain], 0);

        // Riverside tiles also get a water stamp on top (clipped below by
        // the ribbon mask), since the smooth curve can sweep partway into
        // this buffer band between two tile rows — without this there'd
        // be a gap where the true curve reaches past the discrete 'river'
        // tiles but no water photo exists underneath to reveal.
        if (terrain === "riverside") {
          riverWaterImages.push(this.placeTextureStamp(x, y, TERRAIN_TEXTURE_KEY.river, 3571));
        }
      }
    }

    this.applyRiverRibbonMask(riverWaterImages);
    this.drawRiverBankDetail();
  }

  /** One deterministically-varied full-tile photo stamp — see drawTerrainTextures' doc comment. */
  private placeTextureStamp(x: number, y: number, key: string, hashSalt: number): Phaser.GameObjects.Image {
    const hash = (x * 928371 + y * 45751 + 1 + hashSalt) >>> 0;
    const img = this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, key);
    img.setDisplaySize(TILE_SIZE, TILE_SIZE);
    img.setFlipX((hash & 1) === 1);
    img.setFlipY(((hash >> 1) & 1) === 1);
    img.setAngle(((hash >> 2) % 4) * 90);
    this.textureLayer.add(img);
    return img;
  }

  /**
   * Autotiled lake tile: a pebble-bank stamp underneath (so rounded-off
   * corners reveal bank instead of empty space), then the water photo on
   * top masked to a rounded rect whose 4 corner radii are computed from
   * this tile's N/E/S/W neighbors — square where water continues into a
   * neighbor, rounded where it meets land. See the LAKE_CORNER_ROUND_*
   * constants' doc comment for the rule (and why the river uses a
   * different technique).
   */
  private drawLakeTile(x: number, y: number) {
    this.placeTextureStamp(x, y, TERRAIN_TEXTURE_KEY.riverside, 7919); // bank base
    const waterImg = this.placeTextureStamp(x, y, TERRAIN_TEXTURE_KEY.river, 0);

    const isWaterAt = (nx: number, ny: number): boolean => {
      const t = this.tiles[ny]?.[nx];
      return t ? isWaterTerrain(t.terrain) : false; // map edge counts as a bank
    };
    const north = isWaterAt(x, y - 1);
    const south = isWaterAt(x, y + 1);
    const west = isWaterAt(x - 1, y);
    const east = isWaterAt(x + 1, y);

    const cornerRadius = (edgeA: boolean, edgeB: boolean): number => {
      if (edgeA && edgeB) return 0;
      if (!edgeA && !edgeB) return TILE_SIZE * LAKE_CORNER_ROUND_STRONG;
      return TILE_SIZE * LAKE_CORNER_ROUND_MILD;
    };
    const radii = {
      tl: cornerRadius(north, west),
      tr: cornerRadius(north, east),
      bl: cornerRadius(south, west),
      br: cornerRadius(south, east),
    };

    const maskShape = this.make.graphics(undefined, false);
    maskShape.fillStyle(0xffffff);
    maskShape.fillRoundedRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE, radii);
    this.waterMaskGraphics.push(maskShape);
    waterImg.setMask(maskShape.createGeometryMask());
  }

  /**
   * Groups every river-related water stamp (on 'river' tiles and the
   * water-overflow stamps on bordering 'riverside' tiles) plus a depth-
   * shading overlay into one container, and clips the whole thing to a
   * single ribbon shape sampled from the river's true continuous
   * centerline — a spline-smoothing pass on the river specifically,
   * independent of the coarse gameplay grid that 'river'-vs-'riverside'
   * terrain assignment still uses.
   */
  private applyRiverRibbonMask(images: Phaser.GameObjects.Image[]) {
    if (images.length === 0) return;

    const container = this.add.container(0, 0, images);
    this.textureLayer.add(container);
    container.add(this.buildRiverWaterShading());

    const ribbon = this.buildRiverRibbonShape();
    this.waterMaskGraphics.push(ribbon);
    container.setMask(ribbon.createGeometryMask());
  }

  private buildRiverRibbonShape(): Phaser.GameObjects.Graphics {
    const g = this.make.graphics(undefined, false);
    g.fillStyle(0xffffff);

    const totalSamples = MAP_HEIGHT * RIVER_RIBBON_SAMPLES_PER_TILE;
    const left: { x: number; y: number }[] = [];
    const right: { x: number; y: number }[] = [];

    for (let i = 0; i <= totalSamples; i++) {
      const yTiles = (i / totalSamples) * MAP_HEIGHT;
      const cx = riverCenterX(yTiles);
      const py = yTiles * TILE_SIZE;
      const leftX = cx - RIVER_HALF_WIDTH + bankEdgeJitter(yTiles, LEFT_BANK_JITTER_SEED);
      const rightX = cx + RIVER_HALF_WIDTH + bankEdgeJitter(yTiles, RIGHT_BANK_JITTER_SEED);
      left.push({ x: leftX * TILE_SIZE, y: py });
      right.push({ x: rightX * TILE_SIZE, y: py });
    }

    g.fillPoints([...left, ...right.reverse()], true);
    return g;
  }

  /**
   * Depth/movement shading for the water: a darker wandering band (deeper
   * water), a lighter one (shallows/current shimmer), and scattered bright
   * glints — so the river reads as having depth and motion instead of one
   * flat color. Drawn as thick strokes along wavy offsets from the true
   * centerline, then clipped to the same ribbon mask as the water photos
   * (added as a sibling in that container), so none of it spills onto land.
   */
  private buildRiverWaterShading(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const totalSamples = MAP_HEIGHT * RIVER_RIBBON_SAMPLES_PER_TILE;

    const wavyLinePoints = (offsetFn: (yTiles: number) => number): Phaser.Math.Vector2[] => {
      const points: Phaser.Math.Vector2[] = [];
      for (let i = 0; i <= totalSamples; i++) {
        const yTiles = (i / totalSamples) * MAP_HEIGHT;
        const cx = riverCenterX(yTiles) + offsetFn(yTiles);
        points.push(new Phaser.Math.Vector2(cx * TILE_SIZE, yTiles * TILE_SIZE));
      }
      return points;
    };

    g.lineStyle(TILE_SIZE * 0.34, 0x1f4f66, 0.24);
    g.strokePoints(wavyLinePoints((y) => Math.sin(y * 0.9) * 0.16), false, false);

    g.lineStyle(TILE_SIZE * 0.16, 0xcdeef5, 0.2);
    g.strokePoints(wavyLinePoints((y) => Math.sin(y * 0.9 + 2.4) * 0.16 - 0.18), false, false);

    g.fillStyle(0xecfaff, 0.5);
    for (let i = 0; i < MAP_HEIGHT * 2; i++) {
      const seed = (i * 7919 + 13) >>> 0;
      const yTiles = (seed % (MAP_HEIGHT * 97)) / 97;
      const cx = riverCenterX(yTiles);
      const spread = (((seed >> 8) % 100) / 100 - 0.5) * RIVER_HALF_WIDTH * 1.1;
      const r = TILE_SIZE * (0.018 + ((seed >> 4) % 4) / 250);
      g.fillCircle((cx + spread) * TILE_SIZE, yTiles * TILE_SIZE, r);
    }

    return g;
  }

  /**
   * Scatters small rock and moss/plant clumps across every riverside
   * tile — irregular texture detail breaking up what would otherwise be a
   * uniform gravel strip, and (since the river's jittered edge sometimes
   * sweeps into a riverside tile) visually blurring the water/land border
   * rather than leaving it a clean line. Deliberately unmasked — these sit
   * on top of both water and bank alike, which is the point.
   */
  private drawRiverBankDetail() {
    const g = this.add.graphics();
    this.textureLayer.add(g);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (this.tiles[y][x].terrain === "riverside") this.scatterBankElements(g, x, y);
      }
    }
  }

  private scatterBankElements(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    const baseHash = (x * 733 + y * 977 + 11) >>> 0;
    const count = 2 + (baseHash % 2); // 2-3 elements per tile

    for (let i = 0; i < count; i++) {
      const seed = (baseHash + i * 92821) >>> 0;
      const px = x * TILE_SIZE + ((seed % 1000) / 1000) * TILE_SIZE;
      const py = y * TILE_SIZE + (((seed >> 10) % 1000) / 1000) * TILE_SIZE;

      if ((seed & 4) === 0) {
        // Rock: a small two-tone ellipse (base + shadow side) for a hint of relief.
        const r = TILE_SIZE * (0.05 + ((seed >> 3) % 5) / 100);
        g.fillStyle(0x8a8378, 0.9);
        g.fillEllipse(px, py, r * 2, r * 1.6);
        g.fillStyle(0x63594d, 0.5);
        g.fillEllipse(px + r * 0.35, py + r * 0.3, r * 1.1, r * 0.8);
      } else {
        // Moss/plant clump: a few overlapping small green blobs.
        const clusterR = TILE_SIZE * 0.045;
        for (let j = 0; j < 3; j++) {
          const js = (seed + j * 1931) >>> 0;
          const ox = ((js % 200) / 200 - 0.5) * clusterR * 2;
          const oy = (((js >> 5) % 200) / 200 - 0.5) * clusterR * 2;
          g.fillStyle(j % 2 === 0 ? 0x3d5a2c : 0x577a3d, 0.85);
          g.fillCircle(px + ox, py + oy, clusterR * (0.7 + ((js >> 10) % 4) / 10));
        }
      }
    }
  }

  private drawGridLines(worldWidth: number, worldHeight: number) {
    const g = this.add.graphics();
    g.lineStyle(1, GRID_LINE_COLOR, GRID_LINE_ALPHA);
    for (let x = 0; x <= MAP_WIDTH; x++) {
      g.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, worldHeight);
    }
    for (let y = 0; y <= MAP_HEIGHT; y++) {
      g.lineBetween(0, y * TILE_SIZE, worldWidth, y * TILE_SIZE);
    }
  }

  private redrawDynamicLayers() {
    const g = this.zoneLayer;
    g.clear();
    this.buildingLayer.removeAll(true);
    const pad = TILE_SIZE * 0.06;

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = this.tiles[y][x];
        if (tile.zone === "none") continue;

        const color =
          tile.zone === "farmland" && tile.cropType
            ? CROP_COLORS[tile.cropType]
            : ZONE_COLORS[tile.zone];
        g.fillStyle(color, 0.9);
        g.fillRect(x * TILE_SIZE + pad, y * TILE_SIZE + pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2);

        if (tile.damaged) {
          g.fillStyle(DAMAGED_TINT, 0.45);
          g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        } else if (
          (tile.zone === "residential" || tile.zone === "commercial" || tile.zone === "industrial") &&
          (!tile.hasPower || !tile.hasWater)
        ) {
          g.fillStyle(NO_UTILITY_DOT, 1);
          g.fillCircle(x * TILE_SIZE + TILE_SIZE * 0.88, y * TILE_SIZE + TILE_SIZE * 0.12, TILE_SIZE * 0.06);
        }

        if (tile.building) {
          this.drawBuildingBadge(x, y, tile.building);
        }
      }
    }
  }

  /**
   * Every building renders the same way — a rounded-square badge colored
   * by its category (the same palette as the toolbar tabs) with a bold
   * monogram — so the map reads as one consistent icon family rather
   * than a mix of styles. Covered bridges are the one exception: the
   * extracted reference photo (see palette.ts's BRIDGE_TEXTURE_KEY) reads
   * as an actual bridge crossing the water, which a generic badge can't.
   */
  private drawBuildingBadge(x: number, y: number, building: BuildingId) {
    if (building === "covered_bridge") {
      this.drawBridgeSprite(x, y);
      return;
    }

    const def = BUILDINGS[building];
    const centerX = x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = y * TILE_SIZE + TILE_SIZE / 2;
    const badgeSize = TILE_SIZE * 0.62;
    const corner = badgeSize * 0.22;

    const badge = this.add.graphics();
    badge.fillStyle(CATEGORY_COLOR_NUM[def.category], 0.95);
    badge.fillRoundedRect(centerX - badgeSize / 2, centerY - badgeSize / 2, badgeSize, badgeSize, corner);
    badge.lineStyle(Math.max(1, TILE_SIZE * 0.015), 0xffffff, 0.6);
    badge.strokeRoundedRect(centerX - badgeSize / 2, centerY - badgeSize / 2, badgeSize, badgeSize, corner);
    this.buildingLayer.add(badge);

    const label = this.add.text(centerX, centerY, BUILDING_ABBR[building], {
      fontFamily: "system-ui, sans-serif",
      fontSize: `${Math.floor(TILE_SIZE * 0.15)}px`,
      fontStyle: "bold",
      color: "#fdfaf3",
    });
    label.setOrigin(0.5, 0.5);
    this.buildingLayer.add(label);
  }

  private drawBridgeSprite(x: number, y: number) {
    const centerX = x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = y * TILE_SIZE + TILE_SIZE / 2;
    const img = this.add.image(centerX, centerY, BRIDGE_TEXTURE_KEY);
    img.setDisplaySize(TILE_SIZE * 0.96, TILE_SIZE * 0.96);
    this.buildingLayer.add(img);
  }

  private setupInput() {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.activePointers.set(pointer.id, new Phaser.Math.Vector2(pointer.x, pointer.y));

      if (this.activePointers.size === 1) {
        this.pointerDownPos = new Phaser.Math.Vector2(pointer.x, pointer.y);
        this.pointerMoved = false;
        this.lastPanPoint = new Phaser.Math.Vector2(pointer.x, pointer.y);
      } else if (this.activePointers.size === 2) {
        this.beginPinch();
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.activePointers.has(pointer.id)) return;
      this.activePointers.set(pointer.id, new Phaser.Math.Vector2(pointer.x, pointer.y));

      if (this.isPinching && this.activePointers.size >= 2) {
        this.updatePinch();
        return;
      }

      if (this.activePointers.size === 1 && pointer.isDown && this.lastPanPoint) {
        const dx = pointer.x - this.lastPanPoint.x;
        const dy = pointer.y - this.lastPanPoint.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          const zoom = this.cameras.main.zoom;
          this.cameras.main.scrollX -= dx / zoom;
          this.cameras.main.scrollY -= dy / zoom;
          this.lastPanPoint.set(pointer.x, pointer.y);
        }
        if (this.pointerDownPos && !this.pointerMoved) {
          const dist = Phaser.Math.Distance.Between(
            this.pointerDownPos.x,
            this.pointerDownPos.y,
            pointer.x,
            pointer.y,
          );
          if (dist > TAP_MOVE_THRESHOLD) this.pointerMoved = true;
        }
        this.updateHover(pointer);
      }
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const wasSinglePointerTap =
        this.activePointers.size === 1 && !this.pointerMoved && !this.isPinching;

      this.activePointers.delete(pointer.id);

      if (this.activePointers.size < 2) {
        this.isPinching = false;
      }

      if (wasSinglePointerTap) {
        this.handleTap(pointer);
      }

      if (this.activePointers.size === 0) {
        this.lastPanPoint = null;
        this.pointerDownPos = null;
      }
    });

    // Desktop mouse wheel zoom
    this.input.on(
      "wheel",
      (
        _pointer: Phaser.Input.Pointer,
        _objects: unknown,
        _dx: number,
        dy: number,
      ) => {
        const zoom = this.cameras.main.zoom;
        const next = Phaser.Math.Clamp(
          zoom - dy * 0.001 * DRAG_ZOOM_SENSITIVITY,
          MIN_ZOOM,
          MAX_ZOOM,
        );
        this.cameras.main.setZoom(next);
      },
    );
  }

  private beginPinch() {
    const pts = Array.from(this.activePointers.values());
    if (pts.length < 2) return;
    this.isPinching = true;
    this.pinchStartDistance = Phaser.Math.Distance.Between(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    this.pinchStartZoom = this.cameras.main.zoom;
  }

  private updatePinch() {
    const pts = Array.from(this.activePointers.values());
    if (pts.length < 2 || this.pinchStartDistance === 0) return;
    const dist = Phaser.Math.Distance.Between(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    const ratio = dist / this.pinchStartDistance;
    const next = Phaser.Math.Clamp(this.pinchStartZoom * ratio, MIN_ZOOM, MAX_ZOOM);
    this.cameras.main.setZoom(next);
  }

  private updateHover(pointer: Phaser.Input.Pointer) {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tx = Math.floor(world.x / TILE_SIZE);
    const ty = Math.floor(world.y / TILE_SIZE);
    this.hoverLayer.clear();
    if (tx < 0 || ty < 0 || tx >= MAP_WIDTH || ty >= MAP_HEIGHT) return;
    this.hoverLayer.lineStyle(2, HOVER_HIGHLIGHT_COLOR, 0.9);
    this.hoverLayer.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }

  private handleTap(pointer: Phaser.Input.Pointer) {
    if (this.engine.state.gameOver) {
      eventBus.emit(Events.PlacementRejected, "River Run has fallen — start over to keep building.");
      return;
    }
    if (this.engine.state.paused) {
      eventBus.emit(Events.PlacementRejected, "Waiting on a decision — see the popup.");
      return;
    }

    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tx = Math.floor(world.x / TILE_SIZE);
    const ty = Math.floor(world.y / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= MAP_WIDTH || ty >= MAP_HEIGHT) return;

    const tile = this.tiles[ty][tx];

    if (this.selectedTool === "bulldoze") {
      this.engine.placeTool(tx, ty, "bulldoze");
      return;
    }

    if (this.selectedTool === "farmland" && tile.zone === "farmland") {
      // Replant in place rather than requiring a bulldoze-and-rezone.
      this.engine.setCropType(tx, ty, this.selectedCrop);
      return;
    }

    const result = this.engine.placeTool(tx, ty, this.selectedTool);
    if (!result.ok) {
      eventBus.emit(Events.PlacementRejected, result.reason ?? "Can't build there.");
      return;
    }
    if (this.selectedTool === "farmland") {
      this.engine.setCropType(tx, ty, this.selectedCrop);
    }
  }
}

/** Channel-wise average of a set of 0xRRGGBB colors, used for terrain-edge blending. */
function averageColors(colors: number[]): number {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const c of colors) {
    r += (c >> 16) & 0xff;
    g += (c >> 8) & 0xff;
    b += c & 0xff;
  }
  const n = colors.length;
  return ((Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n)) >>> 0;
}
