import { eventBus, Events, type ToolSelection } from "../events";
import type { ZoneType } from "../config/grid";

interface ToolDef {
  tool: ToolSelection;
  label: string;
  color: string;
}

const TOOLS: ToolDef[] = [
  { tool: "road", label: "Road", color: "#4a4a4a" },
  { tool: "residential", label: "Residential", color: "#5b8fd6" },
  { tool: "commercial", label: "Commercial", color: "#d6a75b" },
  { tool: "industrial", label: "Industrial", color: "#b05b5b" },
  { tool: "farmland", label: "Farmland", color: "#d9c25b" },
  { tool: "civic", label: "Civic", color: "#9b5bd6" },
  { tool: "bulldoze", label: "Bulldoze", color: "#222222" },
];

/**
 * Plain-DOM toolbar overlaid on the canvas. Kept out of Phaser entirely —
 * real buttons give us free accessibility, touch handling, and layout
 * without fighting an in-canvas UI system.
 */
export class Toolbar {
  private root: HTMLDivElement;
  private toast: HTMLDivElement;
  private toastTimer: number | undefined;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "toolbar";

    TOOLS.forEach((def, i) => {
      const btn = document.createElement("button");
      btn.className = "toolbar-btn";
      btn.dataset.tool = def.tool;
      btn.innerHTML = `<span class="swatch" style="background:${def.color}"></span>${def.label}`;
      if (i === 0) btn.classList.add("active");
      btn.addEventListener("click", () => this.selectTool(def.tool, btn));
      this.root.appendChild(btn);
    });

    container.appendChild(this.root);

    this.toast = document.createElement("div");
    this.toast.className = "toast";
    container.appendChild(this.toast);

    eventBus.on(Events.PlacementRejected, (reason: string) => this.showToast(reason));

    // Default tool matches GameScene's initial selectedTool.
    eventBus.emit(Events.ToolSelected, { tool: "road" as ZoneType });
  }

  private selectTool(tool: ToolSelection, btn: HTMLButtonElement) {
    this.root.querySelectorAll(".toolbar-btn").forEach((el) => el.classList.remove("active"));
    btn.classList.add("active");
    eventBus.emit(Events.ToolSelected, { tool });
  }

  private showToast(message: string) {
    this.toast.textContent = message;
    this.toast.classList.add("visible");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast.classList.remove("visible");
    }, 1800);
  }
}
