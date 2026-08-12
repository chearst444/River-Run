import Phaser from "phaser";
import {
  TILE_SIZE,
  MAP_WIDTH,
  MAP_HEIGHT,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  type Tile,
} from "../config/grid";
import { generateTerrain } from "../sim/terrain";
import { canPlaceZone } from "../sim/placement";
import {
  TERRAIN_COLORS,
  ZONE_COLORS,
  GRID_LINE_COLOR,
  GRID_LINE_ALPHA,
  HOVER_HIGHLIGHT_COLOR,
} from "../render/palette";
import { eventBus, Events, type ToolSelection } from "../events";

const TAP_MOVE_THRESHOLD = 10; // px — beyond this, a touch is a drag/pan, not a tap
const DRAG_ZOOM_SENSITIVITY = 1;

export class GameScene extends Phaser.Scene {
  private tiles!: Tile[][];
  private terrainLayer!: Phaser.GameObjects.Graphics;
  private zoneLayer!: Phaser.GameObjects.Graphics;
  private hoverLayer!: Phaser.GameObjects.Graphics;

  private selectedTool: ToolSelection = "road";

  // Pointer/gesture tracking
  private activePointers: Map<number, Phaser.Math.Vector2> = new Map();
  private pinchStartDistance = 0;
  private pinchStartZoom = 1;
  private isPinching = false;
  private lastPanPoint: Phaser.Math.Vector2 | null = null;
  private pointerDownPos: Phaser.Math.Vector2 | null = null;
  private pointerMoved = false;

  constructor() {
    super("game");
  }

  create() {
    this.tiles = generateTerrain({ seed: 1337 });

    const worldWidth = MAP_WIDTH * TILE_SIZE;
    const worldHeight = MAP_HEIGHT * TILE_SIZE;

    this.terrainLayer = this.add.graphics();
    this.zoneLayer = this.add.graphics();
    this.hoverLayer = this.add.graphics();

    this.drawTerrain();
    this.drawGridLines(worldWidth, worldHeight);

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);
    this.cameras.main.setZoom(DEFAULT_ZOOM);

    this.input.addPointer(2); // support up to 3 simultaneous touch points (pinch + a spare)

    this.setupInput();

    eventBus.on(Events.ToolSelected, (payload: { tool: ToolSelection }) => {
      this.selectedTool = payload.tool;
    });

    this.scale.on("resize", () => {
      // Camera auto-adjusts via Scale.RESIZE mode; nothing extra needed
      // here today, but hook is in place for future minimap/UI reflow.
    });
  }

  private drawTerrain() {
    const g = this.terrainLayer;
    g.clear();
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = this.tiles[y][x];
        g.fillStyle(TERRAIN_COLORS[tile.terrain], 1);
        g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
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

  private redrawZones() {
    const g = this.zoneLayer;
    g.clear();
    const pad = 4;
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = this.tiles[y][x];
        if (tile.zone === "none") continue;
        g.fillStyle(ZONE_COLORS[tile.zone], 0.9);
        g.fillRect(
          x * TILE_SIZE + pad,
          y * TILE_SIZE + pad,
          TILE_SIZE - pad * 2,
          TILE_SIZE - pad * 2,
        );
      }
    }
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
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tx = Math.floor(world.x / TILE_SIZE);
    const ty = Math.floor(world.y / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= MAP_WIDTH || ty >= MAP_HEIGHT) return;

    const tile = this.tiles[ty][tx];

    if (this.selectedTool === "bulldoze") {
      tile.zone = "none";
      this.redrawZones();
      eventBus.emit(Events.TileInfo, { x: tx, y: ty, terrain: tile.terrain, zone: tile.zone });
      return;
    }

    const result = canPlaceZone(this.tiles, tile, this.selectedTool);
    if (!result.allowed) {
      eventBus.emit(Events.PlacementRejected, result.reason ?? "Can't build there.");
      return;
    }

    tile.zone = this.selectedTool;
    this.redrawZones();
    eventBus.emit(Events.TileInfo, { x: tx, y: ty, terrain: tile.terrain, zone: tile.zone });
  }
}
