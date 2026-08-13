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
- **Disasters** — telegraphed storms → river flooding, rare unwarned earthquakes, faster
  repair speed with a Fire Station in town, and — rarer still, on its own irregular
  multi-month schedule — a major fire or flood that destroys several buildings outright
  rather than just damaging them
- **Flavor events** — county fair, covered bridge
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
- **Visual polish, take 1–4 (superseded)** — terrain went through several rendering
  approaches on the way here: per-tile photo stamps from a general texture library,
  procedural blob-tile/ribbon autotiling for the river's water, then a cropped and
  seamlessly-tiled version of the user's own AI-generated reference photo for just
  the river's water/bank. Each was a real step, but the user ultimately asked for
  something simpler and more literal than any of them — see below.
- **The whole map is one single, unmodified reference image** — the final approach,
  and the one currently in the game. `river_valley.jpg` (the user's own reference
  photo, resized 2400×2400 → 1600×1600 for file size only — no cropping, no
  tiling) is placed as one `Image` game object stretched once across the entire
  map (`drawTerrainBackdrop` in `GameScene`). There's no more per-terrain-type photo
  stamping at all — river, banks, fields, and forest are all just part of this one
  picture. The tile grid itself is now invisible (no grid lines) but still fully
  functional underneath for zoning/roads/collision — see `sim/terrain.ts`'s
  `RIVER_MASK`, a 24×24 trace of the picture's actual river (found by
  color-thresholding its water pixels, including where it forks around a mid-stream
  rock island — something the earlier sine-curve formula could never represent),
  which is what keeps the invisible grid's water/unbuildable tiles lined up with
  where the picture actually shows water. Everything else (the hillside/mountain/
  forest fringe near the map's outer edges) still uses the original distance-based
  rule; there's no separate lake anymore since the reference image doesn't show one.
  The extracted `river_bridge.jpg` sprite is unaffected — it's a discrete building
  icon for player-built covered bridges, not a terrain fill.
- **Real photo icons for crops/buildings, added incrementally** — the covered
  bridge was the first "real art instead of a generic shape" case; it's now a
  general system. `palette.ts`'s `CROP_SPRITE_KEY`/`BUILDING_SPRITE_KEY` are
  `Partial` maps from crop/building id to a sprite texture key — anything listed
  renders as that photo-cutout (`public/sprites/`, background-removed and
  cropped to content), scaled uniformly to fit its tile; anything not yet
  listed keeps rendering exactly as before (a flat crop-color fill, or a
  category badge + monogram). Every crop now has real art (wheat, corn,
  potatoes, tomatoes, apples, cows, chickens, goats, sheep). Buildings: the
  covered bridge, school, church, town_hall, police_station,
  fire_station_full, power_plant, water_tower, barn, silo, bakery, butcher,
  tailor, farmers_market, historic_mill, blacksmith, clinic, and dock are
  all actual building renders now — clinic uses the Tudor guildhall-style
  building originally sent alongside town_hall's art, set aside at the time
  since the game only has one civic-seat type; it's the clinic, not a spare
  town_hall look. hunting_cabin/mine_shaft still use the resource they
  produce (a deer, a raw ore ingot) rather than a picture of the structure —
  that's what the user generated for them, and it reads clearly on a tile
  either way; dock started the same way (a fish icon) but was swapped for a
  real dock/pier render once that art arrived, since the resource-icon
  approach was always meant as a stand-in, not a permanent choice.
  fire_station_volunteer deliberately keeps its plain badge for now — a
  modest "before the upgrade" look plays well against the real
  fire_station_full render once that upgrade fires. Every building now has
  real art except fire_station_volunteer. One inconsistency worth
  noting: the cow art is
  shot from directly overhead
  (matching the map's own aerial angle) while the other animals are a side
  profile — both render fine on a tile, just at different implied camera
  angles; flagging it in case that's worth normalizing later.
  **Background removal note:** every one of these reference photos arrived as
  a flattened JPEG with no real alpha channel, just a faint checkerboard
  baked into the pixels, removed by thresholding distance-from-white into an
  alpha channel. Two opposite failure modes showed up as more assets came
  in, and there's no single setting that avoids both: (1) a bright highlight
  *on* the subject (a metal ingot's glare, a sheep's face marking) is pale
  enough to get matted away like background — fixed for those two by only
  clearing near-white pixels that flood-fill back to the image border,
  so an isolated interior highlight can't qualify; but (2) that same
  border-connectivity requirement then refuses to clear genuine enclosed
  negative space, like the sky glimpsed *through* the water tower's open
  lattice legs, since those pixels don't trace back to the border either —
  fixed for that one by dropping the connectivity requirement and matting
  purely by color instead. Each new asset gets eyeballed against a solid
  background after processing to catch whichever failure mode applies, and
  the simpler no-connectivity approach is the default; the border-flood-fill
  version is used only where a highlight-on-subject problem actually shows up.
- **Annual property tax** — a new, second tax on top of the existing daily
  activity-based business tax (`economy.ts`'s `computeGrossBusinessRevenue`):
  once a year (the day the calendar rolls to month 1, day 1), every standing
  commercial-category shop (bakery, butcher, tailor, farmers market) pays a
  flat $100 into the treasury regardless of how business was that day —
  a tax on *existing*, not on the day's activity. Per-building amounts are
  independently tunable (`economy.ts`'s `PROPERTY_TAX_PER_BUILDING`) rather
  than one global constant. Shows as its own line in the HUD's budget
  readout, only on the day it's collected.
- **Major disasters — fire and flood that destroy buildings, not just damage
  them** — the existing storm-flooding/earthquake system only ever queues a
  timed repair; this is a rarer, harsher tier on top of it. On an irregular
  schedule (re-randomized every time one fires, roughly every 5–24 months,
  never a fixed interval) a fire or flood hits, unwarned, and destroys 2–5
  standing buildings outright — no repair queue, the player has to rebuild
  from scratch. Flood only hits riverside buildings (falls back to fire if
  none are standing); fire can hit anywhere except a covered bridge, since
  losing a river crossing mid-game breaks road connectivity in a way that
  reads as a bug rather than a consequence. A real `fire_station_full` in
  town knocks one building off the loss count on a fire (floor of 1) — the
  same tier that already speeds up ordinary disaster repairs.
- **Dropped the volunteer fire station** — rather than commission art for a
  building that only ever existed as an early, cheaper stepping-stone to the
  real one, `fire_station_volunteer` is gone; `fire_station_full` ($400) is
  now the only fire station, buildable straight away like every other civic
  building. A save with a volunteer station still standing from before this
  change gets it upgraded to the full station for free on load, rather than
  the tile going blank or the game choking on an id that no longer exists.
  Fixed a latent bug this surfaced along the way: `placeTool` had no check
  that an unrecognized tool name wasn't secretly a zone type, so passing the
  now-removed id (or any other garbage string) fell through to the zone-
  placement branch and got silently written into `tile.zone` instead of
  being rejected — it's now a clean "Unknown tool" refusal.

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
