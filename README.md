# River Run

A grid-based town builder set in an Appalachian river valley — a SimCity + Tropico
mashup, built mobile-first for the browser with [Phaser.js](https://phaser.io/).

See [`docs/GDD.md`](docs/GDD.md) for the full game design doc.

## Status

All 14 build phases from the GDD are implemented and wired together into one playable
loop:

- **Foundation** — procedural river valley terrain, responsive canvas, touch pan/pinch-zoom,
  tap-to-place UI
- **Roads & zoning** — road-network connectivity (BFS), residential/commercial/industrial/farmland
  zoning
- **Utilities** — power/water spread along the road network from plants/towers
- **Population** — housing capacity, jobs, employment, a happiness formula (services,
  employment, food, tax, pollution, disasters, corruption), growth/emigration, density
  upgrades over time
- **Agriculture, fishing & hunting** — row crops, orchards, livestock, river/lake
  adjacency rule, docks, autumn-only deer hunting, barns/silos storage with spoilage
- **Seasons** — spring/summer/fall/winter cycle driving crop yields, flood timing
  (spring snowmelt, summer/fall storms), and the hunting season
- **Budget/tax** — a player-adjustable tax slider, upkeep, treasury
- **Production chains & commerce** — mill (wheat→flour), blacksmith (ore→tools),
  bakery/butcher/tailor, farmers market, all feeding income and happiness
- **Immigration** — periodic newcomer waves the player can welcome or restrict
- **Elections & politics** — a fast-ticking 4-year term, three-candidate elections
  (player + a fixture rival + a rotating rival), Grafter/Reformer/Wildcard archetypes,
  a campaigning mechanic, visible corruption (siphoning, scandal risk) when a Grafter
  wins
- **Disasters** — telegraphed storms → river flooding, rare unwarned earthquakes,
  fire-station-tier-dependent repair speed
- **Flavor events** — county fair, volunteer→full fire station upgrade, covered bridge
- **Major decision events** — data center and factory proposals, approve/reject with
  lasting jobs/revenue vs. happiness/pollution trade-offs
- **Polish** — save/load via `localStorage`, mobile touch tuning, an undo button (↩ in the
  HUD bar, reverses the last placement/removal including its cost), a Remove tool that
  refunds 50% of a building's cost, and a starvation/collapse consequence: a town that
  outgrows its food supply goes hungry, loses population directly, and — after ~20
  straight days of famine — the game ends with a "River Run Has Fallen" screen and a
  restart option

Numeric balance (costs, yields, happiness weights) is intentionally loose — the GDD
flags balancing as a later pass once the systems are all in place, which they now are.

### Recent iteration

- **Speed tiers** — Slow / Normal / Fast / Faster, plus pause. Normal is half the old
  default pace, Slow is a quarter of the original; Fast/Faster are unchanged from
  before.
- **Business economy loop** — commercial, industrial, and farmland tiles (plus the
  production-chain shops) generate gross revenue based on activity (employment,
  happiness/demand, season); the player-adjustable tax rate takes the city's cut into
  the treasury. Expenses are itemized: civic salaries (school/clinic/church/town
  hall/police/fire), building maintenance, disaster repairs, and — when a Grafter wins
  an election — a visible corruption skim line in the live budget readout (HUD menu →
  Budget). Decision-event revenue (data center/factory) stays a flat, untaxed line
  since it's a fixed number promised in the approval modal.
- **Bigger tiles** — tile size doubled (64px → 128px) and the grid halved per axis
  (48×48 → 24×24) so the map covers the same total area with fewer, chunkier cells.
  Terrain-generation proportions (river width, mountain fringe, etc.) were rescaled to
  match.
- **Visual polish** — every terrain tile now renders a real photo texture
  (`public/textures/`, pulled from the user's own texture library): `water.jpg` for
  river/lake, `pebble.jpg` for riverside, `grass.jpg` for lowland, `straw.jpg` for
  hillside, `stone.jpg` for mountain, `leaves.jpg` for forest. Each tile gets a
  deterministic flip/rotation so the same photo doesn't look like an obviously
  repeated stamp. The original procedural 4-corner color gradient is kept as a
  partial-alpha wash on top — it softens the seam between two different photos and
  keeps each terrain type's color identity readable at a glance. Buildings render as
  a consistent colored badge + monogram (e.g. "PWR", "H2O", "SCH") instead of a mix
  of differently-styled emoji.
- **River/lake autotiling** — water tiles no longer render as flat squares. The
  **lake** uses per-tile blob-tiling: each tile's 4 corners are independently rounded
  based on its N/E/S/W neighbors — square where water continues, rounded where it
  meets land — a reasonable fit for a roughly circular body of water.
  The **river** goes further: rather than approximating the curve one tile-blob at a
  time (which still read as a staircase even with rounded corners), its water is
  rendered as one continuous ribbon shape sampled directly from the river's true
  sine-generated centerline (`sim/terrain.ts`'s `riverCenterX`) at 8 points per tile —
  a spline-smoothing pass on the river specifically, independent of the coarse
  gameplay grid that 'river'-vs-'riverside' terrain assignment still uses for
  placement rules. The centerline itself is tuned to one clean sine cycle (a proper
  S-curve, not a busier multi-wiggle meander). A pebble-bank photo sits underneath
  every water tile either way, so the rounded/curved-off areas reveal bank texture
  instead of empty space. All done procedurally (Phaser `fillRoundedRect` /
  `fillPoints` + `GeometryMask`) since there's no hand-painted directional river
  tileset.

## Tech Stack

- **Rendering:** [Phaser.js](https://phaser.io/) 3
- **Simulation:** plain TypeScript modules under `src/sim/`, decoupled from rendering
  so game balance can be tuned independently
- **Build tooling:** [Vite](https://vitejs.dev/) + TypeScript
- **Persistence:** browser `localStorage` (Save/Load buttons in the HUD panel)

## Project Structure

```
src/
  config/     — shared constants & types (grid size, tile/zone/building/crop types)
  sim/        — pure simulation logic: terrain, placement, buildings, network
                (roads/utilities), population, economy, agriculture, production,
                elections, disasters, immigration, decision events, the central
                engine, save/load
  render/     — rendering-only concerns (color palette, category colors, building
                icon monograms)
  scenes/     — the Phaser GameScene (camera, input, tile/building rendering)
  ui/         — DOM-based UI (categorized toolbar, HUD, modal controller)
  events.ts   — shared event bus between the sim engine and UI
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
test pinch-zoom and drag-pan. The toolbar's tabs (Zone / Utilities / Civic / Farm /
Shops / Industry) group every placeable building the way the GDD's build phases do;
selecting Farmland reveals a crop picker for what to plant.
