import Phaser from "phaser";
import type { ZoneType } from "./config/grid";

/**
 * Shared event bus between the DOM toolbar UI and the Phaser scene(s).
 * Kept separate from any one scene so it survives scene restarts and
 * future scenes (minimap, election UI, etc.) can hook in too.
 */
export const eventBus = new Phaser.Events.EventEmitter();

export const Events = {
  ToolSelected: "tool-selected", // payload: ZoneType | 'bulldoze'
  PlacementRejected: "placement-rejected", // payload: string reason
  TileInfo: "tile-info", // payload: { x, y, terrain, zone } | null
} as const;

export type ToolSelection = ZoneType | "bulldoze";

export interface ToolSelectedPayload {
  tool: ToolSelection;
}
