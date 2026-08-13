import Phaser from "phaser";
import "./style.css";
import { GameScene } from "./scenes/GameScene";
import { Toolbar } from "./ui/Toolbar";
import { HUD } from "./ui/HUD";
import { ModalController } from "./ui/Modal";
import { Tooltip } from "./ui/Tooltip";
import { generateTerrain } from "./sim/terrain";
import { createInitialGameState } from "./sim/state";
import { SimulationEngine } from "./sim/engine";

const appEl = document.getElementById("app");
if (!appEl) throw new Error("#app container not found");

const tiles = generateTerrain({ seed: 1337 });
const state = createInitialGameState(tiles);
const engine = new SimulationEngine(state);

const gameScene = new GameScene(engine);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: appEl,
  backgroundColor: "#1c2b1f",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: "100%",
    height: "100%",
  },
  input: {
    activePointers: 3, // two fingers for pinch + headroom
  },
  scene: [gameScene],
};

const game = new Phaser.Game(config);

new HUD(appEl, engine);
new Toolbar(appEl);
new ModalController(appEl, engine);
new Tooltip(appEl);

// Dev/debug hooks — let the browser console (or automated smoke tests)
// inspect and drive the sim/camera directly. Harmless in production.
(window as unknown as { __engine: SimulationEngine; __game: Phaser.Game }).__engine = engine;
(window as unknown as { __engine: SimulationEngine; __game: Phaser.Game }).__game = game;
