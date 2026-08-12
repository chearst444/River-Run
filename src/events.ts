import Phaser from "phaser";
import type { BuildingId, CropId, ZoneType } from "./config/grid";

/**
 * Shared event bus between the DOM UI (toolbar, HUD, modals) and the
 * Phaser scene. Kept separate from any one scene so it survives scene
 * restarts and every UI piece can hook in independently.
 */
export const eventBus = new Phaser.Events.EventEmitter();

export const Events = {
  ToolSelected: "tool-selected",
  PlacementRejected: "placement-rejected",
  TileInfo: "tile-info",
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

export interface TileInfoPayload {
  x: number;
  y: number;
  terrain: string;
  zone: ZoneType;
  building: BuildingId | null;
  cropType: CropId | null;
}
