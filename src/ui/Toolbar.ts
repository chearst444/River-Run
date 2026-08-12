import { eventBus, Events, type ToolSelection } from "../events";
import { BUILDINGS, type BuildingCategory } from "../sim/buildings";
import { CROPS, CROP_IDS } from "../sim/agriculture";
import type { CropId, ZoneType } from "../config/grid";

interface ZoneToolDef {
  tool: ZoneType | "bulldoze";
  label: string;
  color: string;
}

const ZONE_TOOLS: ZoneToolDef[] = [
  { tool: "road", label: "Road", color: "#4a4a4a" },
  { tool: "residential", label: "Residential", color: "#5b8fd6" },
  { tool: "commercial", label: "Commercial", color: "#d6a75b" },
  { tool: "industrial", label: "Industrial", color: "#b05b5b" },
  { tool: "farmland", label: "Farmland", color: "#d9c25b" },
  { tool: "bulldoze", label: "Remove", color: "#222222" },
];

const CATEGORY_TABS: { category: BuildingCategory; label: string }[] = [
  { category: "utility", label: "Utilities" },
  { category: "civic", label: "Civic" },
  { category: "agriculture", label: "Farm" },
  { category: "commercial", label: "Shops" },
  { category: "industry", label: "Industry" },
];

type TabId = "zone" | BuildingCategory;

/**
 * Plain-DOM toolbar overlaid on the canvas. Real buttons give us free
 * accessibility, touch handling, and layout without fighting an in-canvas
 * UI system. Tabs group tools the way the GDD's build phases do.
 */
export class Toolbar {
  private root: HTMLDivElement;
  private tabsRow: HTMLDivElement;
  private toolsRow: HTMLDivElement;
  private cropRow: HTMLDivElement;
  private toast: HTMLDivElement;
  private toastTimer: number | undefined;
  private activeTab: TabId = "zone";
  private selectedTool: ToolSelection = "road";
  private selectedCrop: CropId = "wheat";

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "toolbar";

    this.cropRow = document.createElement("div");
    this.cropRow.className = "crop-row";

    this.tabsRow = document.createElement("div");
    this.tabsRow.className = "tabs-row";

    this.toolsRow = document.createElement("div");
    this.toolsRow.className = "tools-row";

    this.root.appendChild(this.cropRow);
    this.root.appendChild(this.tabsRow);
    this.root.appendChild(this.toolsRow);
    container.appendChild(this.root);

    this.toast = document.createElement("div");
    this.toast.className = "toast";
    container.appendChild(this.toast);

    this.renderTabs();
    this.renderTools();
    this.renderCropPicker();

    eventBus.on(Events.PlacementRejected, (reason: string) => this.showToast(reason));
    eventBus.emit(Events.ToolSelected, { tool: this.selectedTool });
  }

  private renderTabs() {
    this.tabsRow.innerHTML = "";
    const tabs: { id: TabId; label: string }[] = [
      { id: "zone", label: "Zone" },
      ...CATEGORY_TABS.map((t) => ({ id: t.category as TabId, label: t.label })),
    ];
    tabs.forEach((tab) => {
      const btn = document.createElement("button");
      btn.className = "tab-btn";
      btn.textContent = tab.label;
      if (tab.id === this.activeTab) btn.classList.add("active");
      btn.addEventListener("click", () => {
        this.activeTab = tab.id;
        this.renderTabs();
        this.renderTools();
      });
      this.tabsRow.appendChild(btn);
    });
  }

  private renderTools() {
    this.toolsRow.innerHTML = "";

    if (this.activeTab === "zone") {
      ZONE_TOOLS.forEach((def) => {
        const btn = this.makeButton(def.tool, def.label, def.color);
        this.toolsRow.appendChild(btn);
      });
    } else {
      const defs = Object.values(BUILDINGS).filter((b) => b.category === this.activeTab);
      defs.forEach((def) => {
        const btn = this.makeButton(def.id, `${def.name} · $${def.cost}`, categoryColor(def.category));
        btn.title = def.description;
        this.toolsRow.appendChild(btn);
      });
    }

    this.updateCropRowVisibility();
  }

  private renderCropPicker() {
    this.cropRow.innerHTML = "";
    CROP_IDS.forEach((id) => {
      const btn = document.createElement("button");
      btn.className = "crop-btn";
      btn.textContent = CROPS[id].label;
      if (id === this.selectedCrop) btn.classList.add("active");
      btn.addEventListener("click", () => {
        this.selectedCrop = id;
        this.renderCropPicker();
        eventBus.emit(Events.CropSelected, id);
      });
      this.cropRow.appendChild(btn);
    });
    this.updateCropRowVisibility();
  }

  private updateCropRowVisibility() {
    this.cropRow.style.display = this.selectedTool === "farmland" ? "flex" : "none";
  }

  private makeButton(tool: ToolSelection, label: string, color: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "toolbar-btn";
    btn.dataset.tool = tool;
    btn.innerHTML = `<span class="swatch" style="background:${color}"></span>${label}`;
    if (tool === this.selectedTool) btn.classList.add("active");
    btn.addEventListener("click", () => this.selectTool(tool, btn));
    return btn;
  }

  private selectTool(tool: ToolSelection, btn: HTMLButtonElement) {
    this.selectedTool = tool;
    this.toolsRow.querySelectorAll(".toolbar-btn").forEach((el) => el.classList.remove("active"));
    btn.classList.add("active");
    this.updateCropRowVisibility();
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

function categoryColor(category: BuildingCategory): string {
  switch (category) {
    case "utility":
      return "#e0d15b";
    case "civic":
      return "#9b5bd6";
    case "agriculture":
      return "#7a9a3c";
    case "commercial":
      return "#d6a75b";
    case "industry":
      return "#8a8378";
  }
}
