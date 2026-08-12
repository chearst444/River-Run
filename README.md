# River Run

A grid-based town builder set in an Appalachian river valley — a SimCity + Tropico
mashup, built mobile-first for the browser with [Phaser.js](https://phaser.io/).

See [`docs/GDD.md`](docs/GDD.md) for the full game design doc.

## Status

🚧 Early development. **Phase 1 (Foundation)** is in place:

- Procedurally generated river valley terrain (river, lake, riverside, lowland,
  hillside, mountain, forest)
- Responsive canvas that fills the viewport
- Touch-friendly camera: drag to pan, pinch to zoom (mouse wheel zoom on desktop)
- Tap-to-place zoning UI with a bottom toolbar (Road, Residential, Commercial,
  Industrial, Farmland, Civic, Bulldoze)
- Placement legality rules (e.g. farmland must border water, nothing builds on open
  water or mountains)

See the task list / `docs/GDD.md` build phases for what's next: roads & zoning,
utilities, population simulation, agriculture, seasons, budget, production chains,
immigration, elections, disasters, flavor events, and major decision events.

## Tech Stack

- **Rendering:** [Phaser.js](https://phaser.io/) 3
- **Simulation:** plain TypeScript modules under `src/sim/`, decoupled from rendering
  so game balance can be tuned independently and tested in isolation
- **Build tooling:** [Vite](https://vitejs.dev/) + TypeScript
- **Persistence (planned):** browser `localStorage` for save/load

## Project Structure

```
src/
  config/     — shared constants & types (grid size, tile/zone types)
  sim/        — pure simulation logic (terrain generation, placement rules, …)
  render/     — rendering-only concerns (color palette, …)
  scenes/     — Phaser scenes
  ui/         — DOM-based UI overlays (toolbar, …)
  events.ts   — shared event bus between UI and scenes
  main.ts     — app entry point
docs/
  GDD.md      — full game design doc
```

## Development

```bash
npm install
npm run dev        # start the dev server
npm run typecheck  # type-check without emitting
npm run build       # production build
npm run preview     # preview the production build
```

Open the dev server URL on a touch device (or use your browser's device toolbar) to
test pinch-zoom and drag-pan.
