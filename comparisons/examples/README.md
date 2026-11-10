# Six comparison examples

One silent video for each measurement/visual family. These are curated validation
datasets, rendered through the normal comparison command. They are not evidence
of unattended AI research or a universal visual-accuracy guarantee.

| Key | Example | Duration | Representation |
| --- | --- | --- | --- |
| diameter | Moon to Sun | 30 s | Existing credited sphere textures |
| height | Seven statues | 30 s | Cached Klein illustrations, countries included |
| wingspan | Four Boeing airliners | 30 s | Sourced plan-view silhouettes |
| area | Six island countries | 30 s | Real geographic polygons, equal-area projection |
| volume | Bottle to freight-container capacity | 30 s | Equivalent-volume cubes |
| zoom | 60 nm particle to Sun | 45 s | Diameter scale, adaptive units, live ruler |

```sh
npm run compare:examples
npm run compare:examples -- --only area
npm run compare:examples -- --prepare-only
npm run dev -- --props=public/shorts/suite-area-comparison/video.json
```

Outputs: `out/shorts/suite-<key>-comparison/suite-<key>-comparison.mp4`.
Each run keeps its datasets, measurements, story plan, sources, description,
render verification and Studio props in the usual pipeline locations.

## Reproducing assets

The ten new raster assets are checked in alongside their source geometry.
`npm run compare:examples:assets` rasterizes them offline with the installed
Remotion Chromium; no new library, generation API or background remover is
required. Statues reuse `comparisons/tallest-statues-assets`; planet maps reuse
the existing public assets. This suite consumes no new Cloudflare Neurons.

* Geography: Natural Earth 1:50m admin-0 country polygons, public domain,
  downloaded from
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson.
  Each country uses a locally centered Lambert cylindrical equal-area
  projection. Holes and detached islands are preserved. The calibrated occupied
  silhouette is scaled to World Bank/FAO 2024 **land area**, rather than the
  bounding-box area. The coarse coastlines do not reproduce every inland lake
  or small island; these are generalized comparison diagrams, not survey maps.
* Aircraft: Peter James Lowden / FlyingPete's Boeing 737-700, 757-200,
  767-300 and 747-8 silhouettes from Wikimedia Commons, CC BY-SA 4.0:
  https://creativecommons.org/licenses/by-sa/4.0/. The source pages and individual
  credits are retained in `wingspan.json`. Adaptations recolor and rasterize the
  original paths; the adapted PNG assets are supplied under CC BY-SA 4.0.
  They are simplified aircraft-tracking silhouettes, not engineering drawings.
  Wingspans come from Boeing's baseline-span table and 747-8 general arrangement.
* Capacity: manufacturer-published nominal internal capacities. Cubes depict the
  **quantity that fits**, not container exterior dimensions or actual shapes.
  Edges scale by the cube root; a 1,000-fold capacity increase gives 10-fold
  edges. The same oblique projection and camera scale apply to every cube.
* Extreme zoom: historical nominal NIST gold-particle and polymer-bead sizes,
  representative sports balls, and the existing astronomical measurements.
  Particle surfaces are idealized colored spheres. All objects use diameter,
  normalized to metres internally. Readouts adapt between nm, µm, mm, cm, m and
  km, and the ruler follows the actual camera transform. Tiny references become
  subpixel at large scales; they are not artificially enlarged for the overview.
* Statues: reuse the seven illustrated figures and documented limitations from
  `out/comparisons/tallest-statues-klein-preview/generation-report.json`.
  This remains a curated selection, not a complete tallest-statues ranking.

## Pipeline changes exercised here

`visual.kind: "box"` accepts optional `projection: "isometric"` for volumes.
Default front-view models retain their existing behavior. Projected bounds feed
the shared framing/layout calculation; projection does not change volume ratios.
`displayUnits: "adaptive"` controls linear readouts without changing source
values, and `scaleReference: true` enables a calibrated 1/2/5 ruler plus longer
zoom travel. Standard examples retain fixed units and the usual timing.
