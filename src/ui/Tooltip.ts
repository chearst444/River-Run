import { eventBus, Events, type TileInfoPayload } from "../events";

/**
 * A small label that follows the cursor while hovering a tile with
 * something on it — the replacement for the flat zone-color fill that
 * used to paint every zoned tile permanently. Info now shows on demand
 * instead of being a persistent overlay across the whole map.
 */
export class Tooltip {
  private el: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.el = document.createElement("div");
    this.el.className = "tile-tooltip";
    container.appendChild(this.el);

    eventBus.on(Events.TileHover, (payload: TileInfoPayload | null) => {
      if (!payload) {
        this.el.classList.remove("visible");
        return;
      }
      this.el.textContent = payload.label;
      this.el.style.left = `${payload.screenX}px`;
      this.el.style.top = `${payload.screenY}px`;
      this.el.classList.add("visible");
    });
  }
}
