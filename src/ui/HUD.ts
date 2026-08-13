import { eventBus, Events } from "../events";
import type { SimulationEngine } from "../sim/engine";
import { formatDate } from "../sim/time";
import { saveGame, loadGame } from "../sim/save";
import { MAX_TAX_RATE } from "../sim/economy";
import type { GameSpeed } from "../sim/time";

/**
 * Top HUD: date/season, population, treasury, happiness, approval, and a
 * slide-down panel for speed/tax controls, campaigning, the county fair,
 * and save/load. Kept as plain DOM, same as the toolbar.
 */
export class HUD {
  private engine: SimulationEngine;
  private bar: HTMLDivElement;
  private panel: HTMLDivElement;
  private panelOpen = false;
  private renderScheduled = false;

  constructor(container: HTMLElement, engine: SimulationEngine) {
    this.engine = engine;

    this.bar = document.createElement("div");
    this.bar.className = "hud-bar";
    container.appendChild(this.bar);

    this.panel = document.createElement("div");
    this.panel.className = "hud-panel";
    container.appendChild(this.panel);

    // The sim can fire many StateChanged events per animation frame (e.g.
    // several in-game days at high speed); coalesce into one DOM rebuild
    // per frame so we don't tear down focused/mid-drag controls.
    eventBus.on(Events.StateChanged, () => this.scheduleRender());
    eventBus.on(Events.LogMessage, (msg: string) => this.flashLog(msg));
    this.render();
  }

  private scheduleRender() {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    requestAnimationFrame(() => {
      this.renderScheduled = false;
      this.render();
    });
  }

  private togglePanel() {
    this.panelOpen = !this.panelOpen;
    this.render();
  }

  private flashLog(_msg: string) {
    // Log messages already land in state.log and render via the panel;
    // this hook exists for a future toast/sound cue.
  }

  private renderBudget(): string {
    const b = this.engine.state.budget;
    const mayorName = this.engine.state.election.mayorName;
    const money = (n: number) => `$${Math.round(Math.abs(n))}`;

    const lines: string[] = [];
    lines.push(
      `<div class="hud-budget-line dim">Business revenue: ${money(b.grossBusinessRevenue)} (${Math.round(this.engine.state.taxRate * 100)}% taxed)</div>`,
    );
    lines.push(`<div class="hud-budget-line income">+ Business tax: ${money(b.taxIncome)}</div>`);
    if (b.decisionEventIncome > 0) {
      lines.push(`<div class="hud-budget-line income">+ Decision-event revenue: ${money(b.decisionEventIncome)}</div>`);
    }
    if (b.propertyTax > 0) {
      lines.push(`<div class="hud-budget-line income">+ Property tax (annual): ${money(b.propertyTax)}</div>`);
    }
    lines.push(`<div class="hud-budget-line expense">− Civic salaries: ${money(b.civicSalaries)}</div>`);
    lines.push(`<div class="hud-budget-line expense">− Maintenance: ${money(b.maintenance)}</div>`);
    if (b.corruptionSkim > 0) {
      lines.push(
        `<div class="hud-budget-line expense corrupt">− Corruption skim (${escapeHtml(mayorName)}): ${money(b.corruptionSkim)}</div>`,
      );
    }
    if (b.disasterRepairs > 0) {
      lines.push(`<div class="hud-budget-line expense">− Disaster repairs: ${money(b.disasterRepairs)}</div>`);
    }
    lines.push(
      `<div class="hud-budget-line total ${b.net >= 0 ? "positive" : "negative"}">Net today: ${b.net >= 0 ? "+" : "−"}${money(b.net)}</div>`,
    );

    return `
      <div class="hud-row">
        <span class="hud-panel-label">Budget (today)</span>
      </div>
      <div class="hud-budget">${lines.join("")}</div>
    `;
  }

  private render() {
    const s = this.engine.state;
    const pop = Math.round(s.population);
    const treasuryClass = s.treasury < 0 ? "negative" : "";

    this.bar.innerHTML = `
      <button class="hud-menu-btn" aria-label="Menu">☰</button>
      <button class="hud-undo-btn" aria-label="Undo last action" title="Undo last action">↩︎</button>
      <div class="hud-stat"><span class="hud-label">${formatDate(s.time)}</span></div>
      <div class="hud-stat">👤 ${pop}</div>
      <div class="hud-stat ${treasuryClass}">$${Math.round(s.treasury)}</div>
      <div class="hud-stat">😊 ${Math.round(s.happiness)}%</div>
      <div class="hud-stat">📊 ${Math.round(s.approval)}%</div>
    `;
    this.bar.querySelector(".hud-menu-btn")?.addEventListener("click", () => this.togglePanel());
    this.bar.querySelector(".hud-undo-btn")?.addEventListener("click", () => {
      const result = this.engine.undo();
      if (!result.ok && result.reason) eventBus.emit(Events.PlacementRejected, result.reason);
    });

    this.panel.style.display = this.panelOpen ? "flex" : "none";
    if (!this.panelOpen) return;

    // Don't tear down the panel mid-interaction (e.g. dragging the tax
    // slider) — the resulting setTaxRate -> StateChanged -> render loop
    // would otherwise replace the very element the user is dragging.
    if (document.activeElement && this.panel.contains(document.activeElement)) return;

    const speeds: { value: GameSpeed; label: string }[] = [
      { value: 0, label: "⏸" },
      { value: 0.25, label: "Slow" },
      { value: 0.5, label: "Normal" },
      { value: 2, label: "Fast" },
      { value: 4, label: "Faster" },
    ];

    this.panel.innerHTML = `
      <div class="hud-row">
        <span class="hud-panel-label">Speed</span>
        <div class="hud-speed-group">
          ${speeds
            .map(
              (sp) =>
                `<button class="hud-chip ${s.speed === sp.value ? "active" : ""}" data-speed="${sp.value}">${sp.label}</button>`,
            )
            .join("")}
        </div>
      </div>
      <div class="hud-row">
        <span class="hud-panel-label">Tax rate: ${Math.round(s.taxRate * 100)}%</span>
        <input type="range" min="0" max="${MAX_TAX_RATE}" step="0.01" value="${s.taxRate}" class="hud-tax-slider" />
      </div>
      <div class="hud-row">
        <span class="hud-panel-label">Jobs ${Math.round(s.jobsAvailable)} · Housing ${Math.round(s.housingCapacity)}</span>
      </div>
      ${this.renderBudget()}
      <div class="hud-row hud-actions">
        <button class="hud-action-btn" data-action="campaign">📢 Campaign ($150)</button>
        <button class="hud-action-btn" data-action="fair">🎪 County Fair ($100)</button>
      </div>
      <div class="hud-row hud-actions">
        <button class="hud-action-btn" data-action="save">💾 Save</button>
        <button class="hud-action-btn" data-action="load">📂 Load</button>
      </div>
      <div class="hud-log">
        ${s.log
          .slice()
          .reverse()
          .slice(0, 8)
          .map((entry) => `<div class="hud-log-entry">${escapeHtml(entry.text)}</div>`)
          .join("")}
      </div>
    `;

    this.panel.querySelectorAll<HTMLButtonElement>("[data-speed]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.engine.setSpeed(Number(btn.dataset.speed) as GameSpeed);
      });
    });
    this.panel.querySelector<HTMLInputElement>(".hud-tax-slider")?.addEventListener("input", (e) => {
      const value = Number((e.target as HTMLInputElement).value);
      this.engine.setTaxRate(value);
    });
    this.panel.querySelector<HTMLButtonElement>('[data-action="campaign"]')?.addEventListener(
      "click",
      () => {
        const result = this.engine.campaign();
        if (!result.ok && result.reason) eventBus.emit(Events.PlacementRejected, result.reason);
      },
    );
    this.panel.querySelector<HTMLButtonElement>('[data-action="fair"]')?.addEventListener(
      "click",
      () => {
        const result = this.engine.holdCountyFair();
        if (!result.ok && result.reason) eventBus.emit(Events.PlacementRejected, result.reason);
      },
    );
    this.panel.querySelector<HTMLButtonElement>('[data-action="save"]')?.addEventListener(
      "click",
      () => {
        const ok = saveGame(this.engine.state);
        eventBus.emit(Events.PlacementRejected, ok ? "Game saved." : "Couldn't save game.");
      },
    );
    this.panel.querySelector<HTMLButtonElement>('[data-action="load"]')?.addEventListener(
      "click",
      () => {
        const loaded = loadGame();
        if (loaded) {
          this.engine.loadState(loaded);
          eventBus.emit(Events.PlacementRejected, "Game loaded.");
        } else {
          eventBus.emit(Events.PlacementRejected, "No saved game found.");
        }
      },
    );
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
