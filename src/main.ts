import Phaser from "phaser";
import "./style.css";
import { GameScene } from "./scenes/GameScene";
import { Toolbar } from "./ui/Toolbar";

const appEl = document.getElementById("app");
if (!appEl) throw new Error("#app container not found");

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
  scene: [GameScene],
};

new Phaser.Game(config);

new Toolbar(appEl);
