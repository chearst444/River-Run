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
  type ZoneType,
} from "../config/grid";
import type { SimulationEngine } from "../sim/engine";
import { BUILDINGS } from "../sim/buildings";
import { CROPS } from "../sim/agriculture";
import {
  TEXTURE_FILES,
  MAP_BACKDROP_TEXTURE_KEY,
  CROP_SPRITE_KEY,
  BUILDING_SPRITE_KEY,
  ZONE_COLORS,
  HOVER_HIGHLIGHT_COLOR,
  DAMAGED_TINT,
  NO_UTILITY_DOT,
  BUILDING_ABBR,
  CATEGORY_COLOR_NUM,
} from "../render/palette";
import { eventBus, Events, type ToolSelection, type TileInfoPayload } from "../events";

/** Plain-English name for a zoned-but-nothing-built-there tile — the hover tooltip's fallback. */
const ZONE_LABEL: Record<Exclude<ZoneType, "none">, string> = {
  road: "Road",
  residential: "Residential",
  commercial: "Commercial",
  industrial: "Industrial",
  farmland: "Farmland",
  civic: "Civic",
};

const TAP_MOVE_THRESHOLD = 10; // px — beyond this, a touch is a drag/pan, not a tap
const DRAG_ZOOM_SENSITIVITY = 1;

export class GameScene extends Phaser.Scene {
  private engine: SimulationEngine;
  private textureLayer!: Phaser.GameObjects.Container;
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

    // Backdrop first so zoning/buildings layer on top of it in draw order.
    this.textureLayer = this.add.container(0, 0);
    this.zoneLayer = this.add.graphics();
    this.buildingLayer = this.add.container(0, 0);
    this.hoverLayer = this.add.graphics();

    this.drawTerrainBackdrop();
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
   * The entire map's terrain — river, banks, fields, forest, everything —
   * is one single unmodified reference image (the user's own picture),
   * stretched once to cover the whole map. There's no per-tile stamping
   * and nothing is cropped or repeated. The tile grid underneath is fully
   * functional for placement logic (zoning, roads, collision) — it's just
   * not drawn; terrain.ts's RIVER_MASK is what keeps that invisible grid's
   * water/land tiles lined up with where this exact picture shows the
   * river.
   */
  private drawTerrainBackdrop() {
    this.textureLayer.removeAll(true);

    const worldWidth = MAP_WIDTH * TILE_SIZE;
    const worldHeight = MAP_HEIGHT * TILE_SIZE;
    const img = this.add.image(worldWidth / 2, worldHeight / 2, MAP_BACKDROP_TEXTURE_KEY);
    img.setDisplaySize(worldWidth, worldHeight);
    this.textureLayer.add(img);
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

        // The flat zone-color fill no longer paints behind a crop/building
        // icon — that was a colored halo behind every icon, which is what
        // the "weird backgrounds" complaint was actually about. But a bare
        // zoned lot (a road, or a residential/commercial/industrial tile
        // before anything's built on it — which is most of a zoned tile's
        // life, since those zones grow density abstractly with no building
        // sprite) has nothing else to show at all, and roads especially
        // need to stay visible or the road network is unreadable. So the
        // fill still renders, just only when there's no icon to sit behind.
        const cropSpriteKey =
          tile.zone === "farmland" && tile.cropType ? CROP_SPRITE_KEY[tile.cropType] : undefined;
        if (cropSpriteKey) {
          this.drawSpriteIcon(x, y, cropSpriteKey);
        } else if (!tile.building) {
          g.fillStyle(ZONE_COLORS[tile.zone], 0.2);
          g.fillRect(x * TILE_SIZE + pad, y * TILE_SIZE + pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2);
        }

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
   * than a mix of styles, UNLESS it has real art (see palette.ts's
   * BUILDING_SPRITE_KEY, filled in incrementally as the user generates
   * more assets), in which case that photo renders instead.
   */
  private drawBuildingBadge(x: number, y: number, building: BuildingId) {
    const spriteKey = BUILDING_SPRITE_KEY[building];
    if (spriteKey) {
      this.drawSpriteIcon(x, y, spriteKey);
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

  /**
   * A real photo-cutout icon centered on a tile, uniformly scaled (never
   * stretched — these source photos aren't all square, unlike the old
   * flat-color fills) so it just fits within the tile.
   */
  private drawSpriteIcon(x: number, y: number, key: string, maxFraction = 0.86) {
    const centerX = x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = y * TILE_SIZE + TILE_SIZE / 2;
    const img = this.add.image(centerX, centerY, key);
    const scale = (TILE_SIZE * maxFraction) / Math.max(img.width, img.height);
    img.setScale(scale);
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
      if (!this.activePointers.has(pointer.id)) {
        // Not part of an active drag/pan — a plain mouse hover (a touch
        // device won't normally fire pointermove without pointerdown
        // first, so this is effectively desktop-only, same as "hover"
        // itself only ever meant something on desktop).
        if (!pointer.isDown) this.updateHover(pointer);
        return;
      }
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

  /**
   * With the flat zone-color fill gone (see redrawDynamicLayers), hovering
   * is now how a tile's zone/crop/building actually gets identified — a
   * colored glow (the building's category color, same palette the toolbar
   * uses) around the tile plus a name via Events.TileHover, which
   * ui/Tooltip.ts renders as a small label that follows the cursor.
   */
  private updateHover(pointer: Phaser.Input.Pointer) {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tx = Math.floor(world.x / TILE_SIZE);
    const ty = Math.floor(world.y / TILE_SIZE);
    this.hoverLayer.clear();
    if (tx < 0 || ty < 0 || tx >= MAP_WIDTH || ty >= MAP_HEIGHT) {
      eventBus.emit(Events.TileHover, null);
      return;
    }

    const tile = this.tiles[ty][tx];
    this.hoverLayer.lineStyle(2, HOVER_HIGHLIGHT_COLOR, 0.9);
    this.hoverLayer.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);

    const label = this.describeTile(tile);
    if (!label) {
      eventBus.emit(Events.TileHover, null);
      return;
    }

    const glowColor = tile.building ? CATEGORY_COLOR_NUM[BUILDINGS[tile.building].category] : HOVER_HIGHLIGHT_COLOR;
    this.hoverLayer.lineStyle(4, glowColor, 0.9);
    this.hoverLayer.strokeRect(tx * TILE_SIZE + 2, ty * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    const payload: TileInfoPayload = { label, screenX: pointer.x, screenY: pointer.y };
    eventBus.emit(Events.TileHover, payload);
  }

  /** What to call a tile in the hover tooltip — the specific thing on it, or its bare zone if empty. */
  private describeTile(tile: Tile): string | null {
    if (tile.building) return BUILDINGS[tile.building].name;
    if (tile.zone === "farmland" && tile.cropType) return CROPS[tile.cropType].label;
    if (tile.zone !== "none") return ZONE_LABEL[tile.zone];
    return null;
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
