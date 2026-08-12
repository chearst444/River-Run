# River Run — Game Design Doc

_A mashup of SimCity + Tropico, mobile-friendly, built with Claude Code._

## Concept

A grid-based city/town builder set in an Appalachian river valley. Player zones land,
builds infrastructure, manages an economy, and keeps citizens happy enough to win
elections and survive natural disasters. Mobile-first, touch-friendly, playable in a
browser.

## Tech Stack

- **Rendering:** Phaser.js (handles tile grids, camera pan/zoom/pinch, sprites, and
  touch input well out of the box)
- **Simulation logic:** Plain JS/TS modules, decoupled from rendering, so game balance
  can be tuned independently
- **Persistence:** Browser `localStorage` for save/load (or `window.storage` if built
  as a Claude artifact instead of standalone app)
- **Layout:** Responsive canvas that scales to viewport; touch controls (pinch-zoom,
  drag-pan, tap-to-place)
- **Time system:** fast-ticking in-game clock (years pass quickly, Tropico-style) so a
  4-year election term is a short, playable stretch rather than a long wait

## Core Loop

1. Zone land (residential / commercial / industrial / farmland)
2. Connect infrastructure (roads, power, water)
3. Population grows or shrinks based on needs met
4. Tax revenue funds services and disaster recovery
5. Elections every 4 years test approval against rival candidates, one corrupt/greedy,
   one community-focused, personalities and field of candidates shift over time
6. Random events (disasters, immigration waves) disrupt the plan

## Map & Terrain

- Inland river valley, Appalachian in feel (not specified as a real place): town built
  along a river, with farmland, hills, and a mountainous/forested edge (for earthquake
  risk + scenic buildable variety)
- **Main river:** runs through or along the map, the town's primary water source, trade
  route, and hazard — replaces the old "ocean coastline" concept entirely
- **Inland lake/pond:** a smaller secondary water body away from the main river, gives
  farms on the far side of the map water access without everything crowding the
  riverbank
- **Riverside tiles:** needed for river port/docks, fishing, and are the primary
  flood-exposed zone
- **Elevated/hillside tiles:** safer from flooding, better for earthquake-resistant
  zones (trade-off: farther from the river trade route)
- **Woodland/forest zones:** border the hills and mountains, home to deer (for autumn
  hunting) and a future source of lumber if a logging mechanic gets added later
- **Mountain zones:** the mountainous edge of the map isn't just an earthquake-risk
  backdrop, it's also mineable — ore/metal deposits for the blacksmith production chain
- **Farmland zones:** must be placed near water (river or lake) — crops and livestock
  feed population and can be exported for revenue

## Zoning & Buildings

- **Residential** (low/med/high density, unlocked by infrastructure level)
- **Commercial** (shops, markets — needs road access)
- **Industrial** (factories — jobs, pollution trade-off)
- **Agricultural** (must border water; different crops/livestock = different
  income/food yield)
  - Row crops: potatoes, corn, tomatoes, wheat — faster-growing, standard farmland
  - Orchards: apples — separate zone type, slower-growing but higher value, visually
    distinct from row crops
  - Livestock: cows and chickens (raised for food — meat/eggs), goats and sheep (sheep
    raised for wool, sheared to produce clothing goods)
- **Fishing:** a major food source, not a minor add-on. Dock/wharf structures along the
  river or lake actively produce fish for the town to eat; more docks or upgraded docks
  = more fish yield. River tiles should be a valuable, sought-after resource for this
  reason, not just a hazard zone.
- **Hunting:** deer hunting, active only during a designated deer season in autumn. A
  hunting cabin/lodge (placed near forest/woodland zones) lets the town harvest deer
  for food during that window, tied into the seasons system rather than year-round.
- **Storage:** barns and silos — required to hold surplus grain/hay; overproduction
  without enough storage capacity leads to waste, a light logistics puzzle
- **Mining:** mountain-zone buildings (mine shafts) extract raw ore/metal from mountain
  tiles — not coal, focused on metals for crafting rather than fuel
- **Blacksmith:** processes raw ore into tools and equipment (a production-chain
  building, same pattern as the mill turning wheat into flour) — smith-made tools could
  boost farm/fishing/hunting yields, or just sell for income, TBD during balancing
- **Production chains:** raw goods (wool, wheat, eggs, milk, ore) can be processed into
  higher-value goods (clothing from wool, bread from wheat, tools from ore) for better
  export income — optional depth layer once base economy works
- **Shops & restaurants:** commercial-zone buildings that consume local food/goods
  (bakery uses wheat, butcher uses cows/chickens, tailor uses wool) and boost
  happiness/commercial income — ties the farm economy back into the city instead of
  just exporting raw goods
- **Farmers market:** distinct commercial building where surplus crops/goods sell
  directly for a happiness + income bump; small-town flavor alternative to straight
  export
- **Historic mill:** flavor building that doubles as a functional wheat-processing
  structure (wheat → flour, feeds bakeries), tied into the production chain
- **Covered bridge:** flavor/infrastructure piece — functions as a road-over-water
  connector with a distinct look
- **Civic buildings:** school, clinic, church, town hall, police/fire station
  - Fire service tiers: starts as a volunteer fire department (cheaper, slower
    response), upgradeable later to a full fire station (faster response, higher cost)
    — an early-vs-late-game progression choice
- **Utilities:** power plant + grid, water tower/pump + pipes
- **River port** (riverside only — trade income, but flood-exposed)

## Seasons

- Simple four-season cycle (spring/summer/fall/winter) affecting crop yields and
  pacing
  - **Spring:** planting, lower yields, snowmelt raises river flood risk
  - **Summer:** growth, storm season begins
  - **Fall:** harvest peak (esp. wheat), storm season continues, deer hunting season
    opens
  - **Winter:** lower food production overall, storm risk drops, slower growth
- Ties storms/flooding to spring (snowmelt) and late summer/fall (storms) instead of
  year-round randomness, matching the Appalachian inland feel
- **County fair:** seasonal happiness-boosting event (likely fall, tied to harvest),
  where player can "show off" crops/livestock for a happiness and/or approval bump —
  light gamified layer on top of the farm economy

## Major Decision Events

Occasional large, town-defining offers that force a real trade-off, distinct from
routine zoning. These should feel like a big deal, not just another building option,
with build-up, a warning/rumor period, resident reactions, and lasting consequences
either way.

- **Data center proposal:** an outside company wants to build a data center in or near
  town. Promises: jobs, tax revenue, possibly a utility/infrastructure investment
  (power grid upgrade). Resident concern: noise (constant hum/cooling fans), water
  usage note if it's placed near the river or lake. If approved, nearby residential
  happiness drops unless mitigated (buffer zones, sound barriers as a possible later
  mechanic); if rejected, town loses the jobs/revenue but avoids the happiness hit and
  scores well with residents who opposed it.
- **Factory proposal:** a large industrial employer wants to move in. Promises:
  significant jobs and industrial tax base. Resident concern: pollution, air quality,
  effect on nearby farmland/livestock health and land values. Same trade-off shape as
  the data center — approve for jobs/revenue at a happiness/health cost, or reject and
  stay smaller but cleaner.
- **Player choice matters publicly:** these decisions should be visible and remembered
  — feeding into approval score, becoming campaign issues rivals can use for or against
  the player in the next election (a corrupt rival might quietly approve either for a
  kickback; a reformer rival might campaign against it, or for it if genuinely
  well-mitigated)
- **Not purely binary if there's room later:** could eventually support a middle path
  (approve with conditions — mandated sound barriers, pollution scrubbers, buffer
  zones) as a stretch goal once the base yes/no version works
- Growth driven by: available housing, jobs, happiness score, services
  (school/clinic/church) coverage
- **Immigration mechanic:** periodic "newcomers arrive" events (by road or rail rather
  than boat, fitting the inland setting) adding population if housing/jobs exist;
  player can choose to welcome or restrict (affects approval rating and growth rate
  differently — a real management lever, not just automatic)
- Overcrowding or unmet needs cause emigration/population loss

## Elections & Politics

- **Election cycle:** every 4 in-game years, on a fast-ticking clock (Tropico-style —
  years should pass quickly, not require real-time waiting, so a full term feels like a
  manageable play session, not a grind)
- **Three candidates per election:**
  - The player (or player's chosen incumbent) — always on the ballot, running on their
    actual track record (approval score, service coverage, etc.)
  - Two rival candidates — one tends to be a fixture who runs most cycles, the other
    rotates in and out (sits out some elections, returns later, or gets replaced by a
    fresh face), so the field doesn't feel static election to election
- **Candidate personalities/archetypes** (randomly assigned or drawn from a pool each
  cycle, so rivals feel different over time):
  - **The Grafter:** corrupt and greedy — if elected, secretly siphons a cut of the
    town budget into personal wealth over their term, which eventually risks a scandal
    event (public trust hit, possible forced special election) if it goes unnoticed too
    long
  - **The Reformer:** genuinely wants to improve the community — campaigns by visiting
    different parts of town (zones/districts) directly, listening to resident
    concerns, and if elected actually prioritizes services/infrastructure over
    personal gain
  - **The Wildcard/Populist:** optional third flavor — makes big promises,
    personality-driven campaign, unpredictable follow-through once in office (could
    lean either way, adds unpredictability)
- **Campaigning mechanic:** in the run-up to an election, candidates (including
  rivals) are shown "campaigning" around the map — visiting districts, holding events
  — which nudges local approval in that candidate's favor. Player can respond by
  campaigning too (town halls, promises, visible investment in an area) rather than
  only being judged passively on stats.
- **Corruption as a discoverable mechanic:** if a corrupt candidate wins and it's not
  the player, corruption should be able to visibly affect the town over their term
  (slower service upgrades than promised, budget shortfalls) — giving the player a
  reason to campaign against them next cycle rather than corruption just being flavor
  text
- **Approval score** (for the player, if running) built from: happiness, unemployment,
  service coverage, disaster response speed
- If approval too low at election time, player risks losing to a rival (soft loss
  condition, or a "term as opposition" state where the player watches the town run
  under someone else — decide during build whether that's a full loss or a temporary
  handicap mode)

## Disasters

- **Storms/heavy rain:** seasonal, telegraphed in advance (warning window lets player
  prep — evacuate, reinforce). Triggers the main flood risk.
- **River flooding:** follows heavy storms or spring snowmelt; low-elevation riverside
  tiles most at risk. Can be mitigated with drainage/levee infrastructure investment.
- **Earthquakes:** rare, low-frequency random event, damage concentrated in
  hillside/mountain zones. No warning — tests emergency infrastructure (hospitals,
  fire stations) rather than prep.
- Disaster recovery costs budget and temporarily tanks happiness/approval — creates
  natural difficulty spikes without being unfair if frequency is tuned low (esp.
  earthquakes).

## Suggested Build Phases

1. **Foundation:** responsive grid map, touch pan/zoom, tile placement UI
2. **Roads & zoning:** the skeletal system everything else depends on
3. **Utilities:** power/water spread mechanic (classic puzzle-y challenge)
4. **Population sim:** housing, jobs, happiness formula
5. **Agriculture, fishing & hunting:** row crops, orchards, livestock, river-adjacency
   rule, fishing as a major food source, autumn deer hunting, storage (barns/silos)
6. **Seasons:** four-season cycle driving crop yields and storm/flood timing
7. **Budget/tax system**
8. **Production chains & commercial tie-in:** shops/restaurants, farmers market, mill,
   mining & blacksmith
9. **Immigration events**
10. **Elections & politics system:** fast-ticking 4-year clock, three-candidate
    elections, corrupt vs. reformer vs. wildcard personalities, campaigning mechanic,
    corruption effects when a rival wins
11. **Disaster system:** storms → river flooding → (rare) earthquakes
12. **Flavor/event layer:** county fair, volunteer-to-full fire station upgrade,
    covered bridge
13. **Major decision events:** data center proposal (jobs/revenue vs. noise), factory
    proposal (jobs/revenue vs. pollution), tied into approval and campaign issues
14. **Polish pass:** mobile touch tuning, save/load, sound/UI feedback

## Notes for Balance

- Keep earthquake frequency very low (rare "flavor" disaster) vs. storms/river
  flooding as the primary recurring challenge.
- Immigration should feel like a decision point, not just background noise — worth
  surfacing as an event with a choice.
