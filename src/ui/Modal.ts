import { eventBus, Events } from "../events";
import type { SimulationEngine } from "../sim/engine";
import type { ImmigrationWave } from "../sim/immigration";
import type { ProposalId } from "../sim/decisionEvents";
import { PROPOSALS } from "../sim/decisionEvents";
import type { ElectionResult } from "../sim/elections";
import { ARCHETYPE_LABEL } from "../sim/elections";

/**
 * Modal controller for the game's pausing decision points: immigration
 * waves, major decision-event proposals, and election results. One
 * overlay, swapped content — keeps the DOM simple and the pause/resume
 * flow centralized.
 */
export class ModalController {
  private engine: SimulationEngine;
  private overlay: HTMLDivElement;
  private card: HTMLDivElement;

  constructor(container: HTMLElement, engine: SimulationEngine) {
    this.engine = engine;

    this.overlay = document.createElement("div");
    this.overlay.className = "modal-overlay";
    this.overlay.style.display = "none";

    this.card = document.createElement("div");
    this.card.className = "modal-card";
    this.overlay.appendChild(this.card);
    container.appendChild(this.overlay);

    eventBus.on(Events.ImmigrationOffered, (wave: ImmigrationWave) => this.showImmigration(wave));
    eventBus.on(Events.ProposalOffered, (id: ProposalId) => this.showProposal(id));
    eventBus.on(Events.ElectionResult, (result: ElectionResult) => this.showElection(result));
    eventBus.on(Events.GameOver, (reason: string) => this.showGameOver(reason));
  }

  private open() {
    this.overlay.style.display = "flex";
  }

  private close() {
    this.overlay.style.display = "none";
  }

  private showImmigration(wave: ImmigrationWave) {
    this.card.innerHTML = `
      <h2>Newcomers Arrive</h2>
      <p>${wave.size} newcomers have arrived by road, hoping to settle in River Run.</p>
      <div class="modal-actions">
        <button class="modal-btn primary" data-choice="welcome">Welcome them</button>
        <button class="modal-btn" data-choice="restrict">Turn them away</button>
      </div>
    `;
    this.card.querySelector('[data-choice="welcome"]')?.addEventListener("click", () => {
      this.engine.resolveImmigration(wave, "welcome");
      this.close();
    });
    this.card.querySelector('[data-choice="restrict"]')?.addEventListener("click", () => {
      this.engine.resolveImmigration(wave, "restrict");
      this.close();
    });
    this.open();
  }

  private showProposal(id: ProposalId) {
    const p = PROPOSALS[id];
    this.card.innerHTML = `
      <h2>${p.title}</h2>
      <p>${p.pitch}</p>
      <p class="modal-concern">${p.concern}</p>
      <p class="modal-stats">+${p.jobs} jobs · +$${p.incomePerDay}/day</p>
      <div class="modal-actions">
        <button class="modal-btn primary" data-choice="approve">Approve</button>
        <button class="modal-btn" data-choice="reject">Reject</button>
      </div>
    `;
    this.card.querySelector('[data-choice="approve"]')?.addEventListener("click", () => {
      this.engine.resolveDecisionEvent(id, true);
      this.close();
    });
    this.card.querySelector('[data-choice="reject"]')?.addEventListener("click", () => {
      this.engine.resolveDecisionEvent(id, false);
      this.close();
    });
    this.open();
  }

  private showElection(result: ElectionResult) {
    const won = result.winner === "player";
    const rivalRows = result.rivalApprovals
      .map((r) => `<div class="modal-row">${r.name} (${ARCHETYPE_LABEL[r.archetype]}) — ${Math.round(r.approval)}%</div>`)
      .join("");
    this.card.innerHTML = `
      <h2>Election Results — Year ${result.year}</h2>
      <div class="modal-row">You — ${Math.round(result.playerApproval)}%</div>
      ${rivalRows}
      <p class="modal-stats">${won ? "You won re-election!" : `${result.winnerName} takes office.`}</p>
      <div class="modal-actions">
        <button class="modal-btn primary" data-choice="ok">Continue</button>
      </div>
    `;
    this.card.querySelector('[data-choice="ok"]')?.addEventListener("click", () => {
      this.engine.acknowledgeElection();
      this.close();
    });
    this.open();
  }

  private showGameOver(reason: string) {
    const s = this.engine.state;
    this.card.classList.add("modal-card--gameover");
    this.card.innerHTML = `
      <h2>River Run Has Fallen</h2>
      <p>${reason}</p>
      <p class="modal-stats">Survived to Year ${s.time.year}, ${s.time.season} — population peaked before the collapse.</p>
      <div class="modal-actions">
        <button class="modal-btn primary" data-choice="restart">Start Over</button>
      </div>
    `;
    this.card.querySelector('[data-choice="restart"]')?.addEventListener("click", () => {
      window.location.reload();
    });
    this.open();
  }
}
