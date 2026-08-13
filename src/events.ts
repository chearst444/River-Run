import Phaser from "phaser";
import type { BuildingId, ZoneType } from "./config/grid";

/**
 * Shared event bus between the DOM UI (toolbar, HUD, modals) and the
 * Phaser scene. Kept separate from any one scene so it survives scene
 * restarts and every UI piece can hook in independently.
 */
export const eventBus = new Phaser.Events.EventEmitter();

export const Events = {
  ToolSelected: "tool-selected",
  PlacementRejected: "placement-rejected",
  TileHover: "tile-hover",
  StateChanged: "state-changed",
  ImmigrationOffered: "immigration-offered",
  ProposalOffered: "proposal-offered",
  ElectionResult: "election-result",
  DisasterMessage: "disaster-message",
  LogMessage: "log-message",
  GameLoaded: "game-loaded",
  CropSelected: "crop-selected",
  GameOver: "game-over",
} as const;

export type ToolSelection = ZoneType | BuildingId | "bulldoze";

export interface ToolSelectedPayload {
  tool: ToolSelection;
}

/**
 * What's under the cursor while hovering the map — just enough for a
 * tooltip to name it (e.g. "Clinic", "Wheat", "Commercial"). `null` means
 * nothing to show (hide the tooltip): off the map, or a bare tile with
 * nothing built/planted/zoned there.
 */
export interface TileInfoPayload {
  label: string;
  screenX: number;
  screenY: number;
}
