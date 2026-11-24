# Size-comparison pipeline

Every run can define new objects. The renderer does not require a hardcoded statue, animal, vehicle or country catalog. Existing ball materials and planet maps remain optional reusable visuals. All subjects share the silent smallest-to-largest presentation: names, measurements, named ratios, contextual backgrounds and deterministic camera motion. Default duration follows object count and scale-dependent arrivals, with 2–3 settled seconds per subject and a four-second final overview. Physical-size videos stay within 60 seconds; quantity charts may extend to 90 seconds.

## Run from a topic

```sh
npm run compare -- --topic "Tallest statues, excluding pedestals" --id statues-run
```

This uses `GROQCLOUD_API_KEY` in `.env.local` to make **one compact comparison plan**: an engaging angle, recognizable objects, approximate values in a common unit, appearance briefs and a related background. Klein 4B at four steps creates the real-object images; local background removal and calibration prepare them for the existing Remotion templates. Linux runs select the Linux provider automatically. No generated React code is executed.

The aim is a meaningful video: familiar anchors, useful variety, interesting contrasts and a final reveal. Target 8–15 objects; a good smaller set is accepted, with a template minimum of two. Typical household objects can use representative measurements without finding an exact named model or opening a source page. Values use ≈ and the description explicitly says they are AI estimates. No URLs, source quotes or evidence IDs are invented.

Object appearance is included in that same plan, so the normal path needs no separate script, concept selection, web research, fact extraction or image-planning model request. Local code supplies IDs, colors, image framing/pose, dimensional scaling, pacing and text layout. Physical-size videos retain their zoom progression; quantities use sequential bars.

Optional metadata is defaulted or omitted locally. Hard checks protect the actual video: at least two usable objects, compatible units, finite numeric values, supported visuals, usable image files and valid final media. These checks do not certify factual accuracy or likeness. Provider quotas and outages can still pause generation.

`out/comparisons/<id>/comparison-plan.json` records the selected objects; `dataset.raw.json` caches render inputs; `dataset-assembly.json` reports the mode `simple-estimated`. Repeat the same topic and ID to reuse completed work. Old valid datasets remain reusable; old failed research does not gate a new plan when no dataset exists. Use a new ID to replan a completed video. `--ideas-only` remains a separate optional brainstorming tool, and does not control the normal simple plan.

A raster creation tool is a separate provider. Without a configured provider or supplied images, the command returns a machine-readable `needs-assets` result. `out/comparisons/statues-run/asset-requests.json` describes the objects, reference URLs, requested views, generation prompts and output directory. Create the requested files in that directory and repeat the same command. Saved object planning is reused without another AI request. Files can also be delivered in an asset manifest.

To connect a local asset creator, pass an operator-owned configuration:

```json
{"command":"python3","args":["/absolute/path/to/your_asset_creator.py"]}
```

```sh
npm run compare -- --topic "Tallest statues, excluding pedestals" --id statues-run --asset-provider /path/to/provider.json
```

The executable receives two appended arguments: **request JSON path** and **result manifest path**. Its working directory is the requested asset output directory. It creates the raster files and writes:

```json
{"assets":[{"id":"statue-id","src":"statue-id.png","attribution":"Asset provenance and credits"}]}
```

Include exactly one result per requested object. Paths are relative to the asset output directory. Each input visual already contains reference URLs and attribution; a provider can refine the attribution. The tool may fetch appropriately licensed reference assets or run a local image-generation workflow. The supplied `comparisons/cloudflare-klein.provider.json` connects Cloudflare Klein and macOS foreground extraction for supported generated cutouts. It is optional; supplied local assets also work. Real geographic outlines need an appropriate geographic asset source rather than text-to-image geography. Groq text generation does not produce the raster images.

Provider execution uses an argument array without a shell; the model cannot choose its executable. Successful provider results are reused when the request/config fingerprint matches and all result files exist. Delete `asset-provider-state.json` to force asset regeneration. Changing a saved topic requires a new run ID. Revisions to an existing generated dataset can be made through the data-input route below.

## Run with per-run data and images

```sh
npm run compare -- --data /path/to/run/dataset.json --asset-root /path/to/run/images
# Optional: --asset-manifest /path/to/run/manifest.json
# Optional: --prepare-only or --plan-only
```

Without `--asset-root`, paths resolve relative to the dataset file. A complete eight-object height dataset looks like this (replace the example measurements and source with researched facts):

```json
{
  "template":"size-comparison",
  "id":"new-subject",
  "title":"A new height comparison",
  "metric":"height",
  "unit":"m",
  "basis":"Height of the object itself, excluding any base",
  "environment":"architecture",
  "context":"Representative heights from the supplied source",
  "items":[
    {"id":"a","label":"Object A","value":10,"color":"#8CBBD4","sourceIds":["s1"],"visual":{"kind":"cutout","src":"a.png","view":"front","attribution":"Your asset provenance","referenceUrls":["https://example.com/source"]}},
    {"id":"b","label":"Object B","value":20,"color":"#8CBBD4","sourceIds":["s1"],"visual":{"kind":"cutout","src":"b.png","view":"front","attribution":"Your asset provenance","referenceUrls":["https://example.com/source"]}},
    {"id":"c","label":"Object C","value":40,"color":"#8CBBD4","sourceIds":["s1"],"visual":{"kind":"cutout","src":"c.png","view":"front","attribution":"Your asset provenance","referenceUrls":["https://example.com/source"]}},
    {"id":"d","label":"Object D","value":80,"color":"#8CBBD4","sourceIds":["s1"],"visual":{"kind":"cutout","src":"d.png","view":"front","attribution":"Your asset provenance","referenceUrls":["https://example.com/source"]}},
    {"id":"e","label":"Object E","value":100,"color":"#8CBBD4","sourceIds":["s1"],"visual":{"kind":"cutout","src":"e.png","view":"front","attribution":"Your asset provenance","referenceUrls":["https://example.com/source"]}},
    {"id":"f","label":"Object F","value":120,"color":"#8CBBD4","sourceIds":["s1"],"visual":{"kind":"cutout","src":"f.png","view":"front","attribution":"Your asset provenance","referenceUrls":["https://example.com/source"]}},
    {"id":"g","label":"Object G","value":160,"color":"#8CBBD4","sourceIds":["s1"],"visual":{"kind":"cutout","src":"g.png","view":"front","attribution":"Your asset provenance","referenceUrls":["https://example.com/source"]}},
    {"id":"h","label":"Object H","value":200,"color":"#8CBBD4","sourceIds":["s1"],"visual":{"kind":"cutout","src":"h.png","view":"front","attribution":"Your asset provenance","referenceUrls":["https://example.com/source"]}}
  ],
  "sources":[{"id":"s1","title":"Measurement reference","url":"https://example.com/source"}]
}
```

The names are arbitrary, not renderer keys. An optional `generation: {"prompt":"..."}` in each visual describes the per-run asset request. `asOf` records an ISO date for time-sensitive ranking data. Values must be positive and sorted by measurement; ties are allowed. Every value references supplied sources. Optional `range` and `approximate` fields preserve uncertainty, with approximation markers in the film. One shared unit is required; normalize source units before submitting data. Mass, population and distance-between-objects are not physical-size metrics.

## Measurements and visual contracts

| Metric | Calibration | Suitable subjects |
|---|---|---|
| `diameter` | Sphere diameter | Balls, planets, stars |
| `height` | Occupied image height | Statues, buildings, trees |
| `length`, `width`, `wingspan` | Occupied image width | Ships, vehicles, animals, aircraft |
| `area` | Actual filled silhouette area | Geographic outlines and other planar regions |
| `volume` | Volume from shape/depth profile | Containers, capacity and volume models |

Linear units: `nm`, `um` (displayed µm), `mm`, `cm`, `m`, `km`, `AU`, `ly`. Area units: `mm2`, `cm2`, `m2`, `km2`. Volume units: `mm3`, `cm3`, `m3`, `km3`, `mL`, `L`. Units must match the metric. A non-diameter dataset must supply a common `basis`: endpoints, age/species policy, maximum vs representative measurements, pedestal policy, or capacity definition. That basis appears in metadata and the description, not as an on-screen explainer.

Supported per-run visuals:

- **`cutout`**: local transparent PNG/WebP, plus `view`, attribution and reference URLs. Preserve the complete object's real proportions in a consistent front, side, top or orthographic view. The asset must contain only the object being measured: no labels, ground, cast shadow or excluded pedestal. Preparation decodes the alpha channel and computes occupied bounds; source padding is cropped automatically. Arbitrary SVG or executable files are not accepted.
- **`sphere`**: a new local 2:1 equirectangular raster `texture`, attribution and reference URLs. Optional `emissive: true` supports luminous objects. The existing mapped appearances and procedural ball materials continue to work without per-run imports.
- **`box`**: an explicit geometric model with `widthToHeight` and `depthToHeight`; color comes from the item. It is an illustrative rectangular model, not an automatically reconstructed object scan.

Area cutouts require `view: "top"` or `"orthographic"` and `projection: "equal-area"`. Their actual filled alpha coverage determines scale; equal bounding-box areas are insufficient for differently shaped outlines. Square-root scaling preserves the input area ratios.

Volume cutouts require `volumeProfile: {"depthToHeight":0.5,"solidFraction":0.7}`. These are sourced ratios relative to the occupied bounding box, expressing depth and volume as a fraction of the bounding prism. A silhouette alone cannot establish volume. Spheres use π/6 of their bounding cube; boxes use their full bounding prism. Cube-root scaling preserves the supplied volume ratios. Geometry/volume simplifications remain documented in the description. Area uses planar outlines or rectangular models, rather than ambiguously treating a sphere's projected area as its surface area.

One camera scale applies to all bodies in every frame. Height and width are tracked independently, aspect ratios remain intact, and framing considers both horizontal span and the tallest compared object. Tiny references are never artificially enlarged. Focus/reference labels share measured text rows and leader lines; landmark country sublabels have their own vertical space. Each object, including the largest, first gets a detail comparison against the preceding object. A separate overview then pulls back to reveal the full set. After the zoom settles, two compact summaries show only the smallest and largest object names and measurements. Intermediate silhouettes remain unlabelled; there is no repeated header, country list, legend or ratio. Ratios use a literal `x`, for example `1.08x`. The first object sets the left edge of the full-set overview. The final named detail uses the preceding object as its reference.

Preparation records image dimensions, alpha bounds/coverage and a SHA-256 digest of normalized dimensions/RGBA pixels, then normalizes the first frame to a static PNG into a run-specific `public/comparisons/<run-id>/` directory. The final video and Studio use these frozen local copies; there are no image-generation calls or remote images during rendering. Asset decoding is limited to 16 megapixels / 8192 pixels per edge. Structural checks cannot prove a generated statue's identity or geographic accuracy: the asset creator must use the supplied references, correct projection and measurement definition. No photorealism or semantic correctness guarantee is inferred from a successful alpha/geometry check. Animated image inputs are frozen to their first frame so browser image timers cannot affect deterministic rendering.

## Backgrounds, timing and outputs

`environment` supports `auto`, `space`, `sports`, `studio`, `architecture`, `nature`, `transport`, `geography`, `sky`, `water`, `storage` and `laboratory`. New concepts choose one shared setting and a `reason` tied to the overall viewer question. Generated datasets retain this as `environment` and `backgroundReason`; the controller applies the concept's decision even if the data model suggests a different background. New concept validation rejects a studio default when the topic clearly supports a contextual setting, unless the user requested a neutral/studio treatment.

Automatic mode also considers the episode subject, title and context: flying objects → sky; ships/lakes/reservoirs → water; structures → architecture; animals/trees → nature; geographic outlines → geography; containers/capacity → storage; microscopic science → laboratory. Mixed objects keep one setting for the episode instead of changing backgrounds at each reveal. Explicit authored choices remain supported; unknown abstract subjects may use studio.

Backgrounds are reusable local frame-driven graphics: clouds/atmosphere, water ripples, distant skyline, woodland layers, stadium/court, ground-transport perspective, globe graticule, storage shelving and specimen fields. Background scenery is decorative, not part of the measured scale. Quiet zones protect names, stats and ratio text. There are no external background images or image-generation calls.

Compilation freezes the chosen setting into Studio props. `background-plan.json`, `story-plan.json` and `visual-manifest.json` record the environment and rationale. Re-prepare older props to apply current inference and artwork; existing MP4s change only when re-rendered.

An optional `--episode episode.json` controls durations and references; the episode must follow dataset order. Silent `cues` are empty: only object names, statistics and named ratios appear in the film. `references: [{"at":0,"itemId":"a"},{"at":0.58,"itemId":"b"}]` can change an already-revealed reference. Visual timing is independent of narration. Narrated legacy inputs remain available through explicit episode presentation settings.

`out/comparisons/<id>/` contains status, prepared dataset, episode, story plan, measurement report, visual manifest and compiled brief. Prompt runs additionally save the simple comparison plan, raw dataset and asset requests/provider state. `status.json` distinguishes `needs-assets`, `planned`, `prepared`, `rendering`, `complete` and `failed` states. Only a successful renderer exit marks a video complete.

`out/shorts/<id>/<id>.mp4` is the final silent H.264 MP4, with thumbnail, media verification, timing/motion reports and YouTube description containing sources and visual credits. `public/shorts/<id>/video.json` contains Studio props. No narration or soundtrack is generated.

```sh
# Existing examples remain supported
npm run compare -- --data comparisons/sports-balls.json --episode comparisons/sports-balls.en.json
npm run compare -- --data comparisons/solar-system.json --episode comparisons/solar-system.en.json

# Preview any prepared run; select SizeComparison
npm run dev -- --props=public/shorts/new-subject-comparison/video.json
```

The general-topic `npm run generate` command remains a separate narrative workflow. Use `compare --topic` for this comparison workflow. JSON Schema for the comparison input is exported to `comparisons/dataset.schema.json`; runtime validation additionally checks dimensions, references, order and measurement definitions.


## Cloudflare image-generation smoke test

`npm run image:test -- --prompt-file prompt.txt --output out/test.jpg` calls Workers AI directly from the local machine. It reads `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` from `.env.local`; the existing `CLOUDFARE_*` spellings are accepted. S3/R2 credentials are not used. Credentials are not written to image reports.

The default is `flux-1-schnell` at 4 steps. `--model flux-2-dev --steps 20 --reference reference-512.png` enables the tested multipart reference route. References must fit within 512×512 pixels. Both tested routes produce a 1024×1024 image and save a report with the actual `cf-ai-neurons` value. The live Schnell schema rejected `seed`, despite a documentation example showing it; the adapter omits that field. Generated assets must be cached for reuse because repeat generation is not assumed to produce identical pixels.

The 2026-11-10 test measured 172.8 Neurons for Schnell/4 steps, 3,000 for Dev/20 steps, and 3,210.94 for Dev/20 steps with a 288×512 reference. Eight independent images therefore project to 1,382.4, 24,000 and 25,687.52 Neurons respectively, before retries or extra generated assets. These are response-reported measurements and projections, not an account billing audit. See `out/cloudflare-test/results.json` for prompts, results and limitations, and https://developers.cloudflare.com/workers-ai/platform/pricing/ for current rates.

On this Mac, Apple's local foreground extraction was tested with `scripts/remove-image-background.swift`. Example: `swift -module-cache-path /tmp/motion-lab-swift-cache scripts/remove-image-background.swift input.jpg output.png`. It uses macOS Vision (macOS 14+ and Swift tools); it is the optional Mac backend. Linux uses the portable local CPU backend described below. A foreground model requires normal access to local compute hardware. Check cutout edges before using a result. This step and local Remotion rendering consume no Cloudflare Neurons.

The standalone image test is separate from the comparison command. A cached Cloudflare/macOS foreground asset provider is now available via `comparisons/cloudflare-klein.provider.json`. Background extraction, calibrated import and a Remotion still passed. Text-only Schnell produced the wrong statue identity; Dev improved appearance, and reference guidance helped further, but accurate identity and proportions still need validation. The synthetic render proof is not a factually measured statue comparison. Reference-photo credits and transformation details are retained in `out/cloudflare-test/CREDITS.txt`.


The Statue of Liberty comparison extends `image:test` with `--model flux-2-klein-4b`. Klein uses multipart requests with a fixed 4-step process; the adapter omits the unsupported adjustable `steps` field. A 1024×1024 text-only test returned 104.2 Neurons. The same-prompt Schnell/4-step and Dev/20-step tests returned 172.8 and 3,000 Neurons. All three original images, per-call usage reports and a comparison panel are in `out/cloudflare-test/statue-of-liberty/`. `results.json` records qualitative feature checks against NPS references and the one-sample limitation. The reference image was not used for generation. No production default or existing video was changed by this experiment.


## Generate comparison assets with Klein

On macOS with Swift tools, the operator configuration `comparisons/cloudflare-klein.provider.json` connects the existing comparison asset stage to Cloudflare Klein 4B and local Vision foreground extraction. Trusted configuration arguments support `{projectRoot}` expansion, so the provider script and tsx loader do not depend on the asset working directory. The provider reads credentials from the project `.env.local`, requires per-object `visual.generation.prompt`, caches raw images and generation reports, checks transparent bounds and rejects cutouts touching the image edge. Source imagery remains an illustration: structural checks do not verify monument identity or anatomical accuracy.

```sh
npm run compare -- --data comparisons/tallest-statues-preview.json --episode comparisons/tallest-statues-preview.en.json --asset-root comparisons/tallest-statues-assets --asset-provider comparisons/cloudflare-klein.provider.json
```

The 33-second silent preview contains seven Klein-generated figures and used 729.4 reported Neurons across its seven successful generations (104.2 each). A Statue of Unity attempt was flagged by Cloudflare, then the retry hit the account's daily free quota. No account upgrade or alternative model was used. The full eight-object plan is retained in `comparisons/tallest-statues.json` and `comparisons/tallest-statues.en.json`; run the same command with those files when quota is available. Existing raw-image receipts prevent regeneration of the seven cached images.

Measurements use a curated selection, not a ranked top-eight claim. Spring Temple Buddha uses the scenic-area operator's 108 m figure-only measurement; its commonly quoted 128 m includes the 20 m lotus throne. Data and YouTube metadata retain the sources and definition. The generation report at `out/comparisons/tallest-statues-klein-preview/generation-report.json` records per-statue visual limitations and unmeasured failed-attempt costs.


## Subject-aware context

`subject` classifies a dataset as `generic` (the backward-compatible default), `statues`, `buildings`, `structures`, `animals`, `vehicles`, `geography`, `space` or `sports`. Statue, building and mixed fixed-structure items should include a sourced `country` using a concise common name when available. Missing countries produce a warning and are omitted rather than guessed. Balls and planets do not acquire unrelated geographic labels. For unambiguous landmark topics, the planning stage corrects a mismatched subject classification locally. Research prompts explicitly request the country facts rather than guessing them during rendering.

Country appears beneath the active measurement and under normal comparison labels. The final object retains the same name/country/height detail treatment as its predecessors. Detail text fades out before the closing zoom begins. After it settles, the final overview shows the smallest and largest names and measurements only. These changes use the existing images and do not trigger image generation.


## Closing sequence and vertical alignment

The planner emits one detail camera pose per item plus a final pose with `role: "overview"`. An episode still has one scene per item: the overview is compiled into the final scene, not an extra narrated scene. Actors support up to sixteen camera poses for fifteen objects. Older saved four-to-seven-object projects remain readable for Studio; new CLI and automated runs target 8–15 and accept 2–7 supported objects. In the last scene the final detail arrives at 16% of the beat, holds until 50%, zooms out from 50% to 75%, and holds the overview for the remaining 25%. Default timing gives this combined final scene eight seconds. Authored durations retain their specified total; the statue preview uses eight seconds for the final scene and runs 33 seconds overall.

All poses preserve one common world scale for object dimensions. The overview includes camera padding so it visibly pulls back even when the largest sphere dominates the size range. The last detail uses the preceding object as its reference; the overview frames the full dataset. Source thumbnails/cutouts remain unchanged.

`size-presentation.ts` computes deterministic vertical offsets from each pose's presentation bounds. Detail poses center the reserved header/object/readout area; the overview centers the silhouettes themselves at the frame midpoint, with a separate endpoint summary beneath them. Offsets interpolate continuously with visual phase, avoiding a position jump at scene boundaries. Newly compiled comparison actors anchor at y=960. Re-prepare saved props to apply this presentation policy to older runs.

## Linux and unattended creation

Use `comparisons/cloudflare-linux.provider.json` for Linux runners. It generates
Klein 4B images at four steps and removes backgrounds locally with pinned
`rembg[cpu]` and explicitly selected `isnet-general-use`. Install
`requirements-linux.txt` in Python 3.11; set `BACKGROUND_REMOVAL_PYTHON` to your
virtual environment's Python for local runs. Existing default `auto` extraction
continues to use Vision on macOS and selects rembg on Linux.

`npm run automate` adds topic selection, repeat avoidance and resumable jobs on
top of the existing comparison command. See [Linux automation](../automation/README.md)
for workflows, secrets, retention and recovery. Geographic area comparisons still
require supplied real outlines; automatic selection excludes area until suitable
source acquisition is connected.

## Legacy research adapter (not the default)

The optional `generateResearchedComparisonData` adapter retrieves sources locally with enforced search, page,
HTTP, response-size and evidence-text limits. Groq receives compact excerpts
and cannot start a hidden browsing loop. Measurements require exact source
quotations; unit conversion and ordering happen in local code. Existing agentic
research checkpoints are preserved but re-researched before use. See
[the bounded research module](../src/pipeline/bounded-research.ts) for its
limits and [the retrieval module](../src/pipeline/research-web.ts) for source checks.

## Required object images

New `--topic` renders and automatic jobs require Cloudflare images for each real
object. Diameter subjects use generated 2:1 surface maps; other supported subjects
use generated cutouts. Image prompts must describe real colors, materials and
distinctive markings. Missing briefs are planned before rendering, and no plain
sphere/procedural-material fallback is used when Cloudflare fails. Prompt runs
select the platform's Cloudflare provider by default; explicit provider/manifest
options remain available. Existing `--data` fixtures and mathematical capacity
graphics remain supported. Completed videos are preserved.

## Comparisons beyond physical size

The same simple plan → Cloudflare assets → render workflow supports:

| Metric | Visual encoding | Example unit |
| --- | --- | --- |
| Mass | Sequential vertical bars | kg |
| Count/population | Sequential vertical bars | count |
| Speed | Sequential vertical bars | km/h |
| Duration | Sequential vertical bars | year |
| Energy | Sequential vertical bars | kWh |
| Power | Sequential vertical bars | W |
| Temperature | Signed vertical bars and differences, without ratios | C |

All non-size templates reveal one subject and its vertical bar at a time. Earlier
bars remain visible and the last subject gets its own detail beat before the full
labelled overview. Bar height represents the measurement. Colored names below the bars identify
subjects alongside consistent-size cutout thumbnails, without repeated focus
headings or an overview heading.
Each value appears once at its bar endpoint, and axis units appear once. One fixed linear axis covers the final dataset, applying the same scale throughout every reveal. Tick labels show that scale.
Temperature bars extend above/below zero and never use ratios.

Quantity charts plan real subject cutouts through the same cached Cloudflare
provider as physical-size comparisons. Thumbnails identify the subjects; bar
height alone encodes the measured quantity. Authored offline box fixtures do not
show placeholder boxes as thumbnails. Unit conversion is
local and dimension-checked, including affine Celsius/Fahrenheit conversion.

Count datasets require `countBasis` (`fixed`, `inventory`, or `population`).
Inventory and population counts also require `asOf`. Document scope, estimates
and comparable conditions in `basis` and item qualifiers. Speed uses sourced values as bar heights; the legacy `raceDistanceM` field is
accepted for older datasets but no longer affects rendering.
Duration means elapsed duration, not calendar dates. Distinguish total energy
from power and specific energy; quantities with incompatible definitions must
not be ranked together.

Run a local fixture with `npm run compare:examples -- --only mass` (also `count`,
`speed`, `duration`, `energy`, `power`, `temperature`). These seven new fixtures
use explicitly synthetic data and simple local shapes to verify the renderer
without API credentials; they are not researched publication-ready videos.
Topic-based runs use the existing `npm run compare -- --topic "..." --id ...`
command and the configured Cloudflare provider.

## Object-count-based pacing

Automatic silent episodes give each subject 2–3 seconds of settled focus. Arrival
varies continuously with the scale change (about 0.25–5 seconds): similar sizes
arrive quickly, while larger scale jumps get more travel time. Integer scene
budgets retain a settled hold within the requested range. The final overview has
its own four seconds, after the last subject's full detail window. Total duration
is the sum of those timings, not a fixed count-to-duration table. Timed silent
physical-size comparisons support 10–60 seconds. Quantity comparisons use proportional growth with a one-second minimum, a 2.5-second settled hold, and up to 90 seconds total. Other video contracts retain their existing limits.

Display names are separate from research identity. Simple animal qualifiers
such as domestic/house are shortened when unambiguous; species/model distinctions
and colliding names retain their identifying qualifiers. New plans can supply a
validated `displayLabel`. Measurement headings use audience-facing language
(`Lifespan (years)`), with dates reserved for changing population/inventory counts.

The same local timing rules drive object motion, chart growth, label arrival and
the final overview. Physical scale uses linear extent (area/volume use square/cube
roots); signed/zero-based charts use axis distance rather than invalid ratios.
Pacing is deterministic and requires no additional model calls.


New runs aim for 8–15 meaningful objects, with two-to-seven-item comparisons accepted when they make a better focused video. One plan supplies approximate values and object appearance; no research exclusions or extra calls are needed just to reach eight.

Charts with more than eight visible bars, or names that need wider columns, alternate two rows of subject images
and names, using subtle leaders for the second row. Units and values stay on the
chart. Physical comparisons retain their true-scale lineup and smallest/largest
endpoint summary. Pacing reserves 2–3 settled seconds per object plus a four-second
overview. Physical-size travel may be shortened to stay within 60 seconds; quantity charts preserve their growth schedule up to 90 seconds.

The offline `compare:examples` runner continues testing the eight-object target. Historical examples with fewer than eight objects are expanded in
`out/comparison-examples/` into explicitly synthetic eight-object geometry
fixtures, reusing credited artwork. Their original datasets/measurements remain
unchanged. These fixtures test rendering, not research or real-world rankings;
they never enter the automated topic-generation pipeline.

Canonical object names retain up to 80 characters for image identity
and metadata. Optional on-screen `displayLabel` values remain at most 24
characters and may omit whole words from the original name in their original
order. Unsupported/overlong generated aliases are discarded locally, leaving
the canonical identity intact; they do not consume model-repair calls. Chart
labels fit within a fixed-height band so long fallback names do not overlap the
next row of images.

At the model-generation boundary, extra annotations are ignored and optional metadata is normalized. Local code supplies IDs, colors, visual contracts and timing. Image identity is planned in the same request; trusted code supplies framing and output format. Missing country information is omitted. A malformed plan gets at most one correction request.

Hard stops protect execution and a coherent comparison: fewer than two usable objects, incompatible units, unsupported visual acquisition, unsafe/unusable assets, invalid final media and unsafe/ambiguous uploads. Source quotations are not a default requirement. The explicit legacy research adapter retains its evidence checks; it is not invoked automatically.

Cutout edge contact is an advisory framing signal, not an automatic rejection. The Cloudflare provider can try one wider-margin generation per affected cached image, capped at two extra generations per invocation. It keeps the original usable cutout if repair fails or does not reduce edge contact, persists retry receipts to avoid repeat spending on resume, and writes warnings to `quality-warnings.json`. Empty, undecodable or non-transparent cutouts still fail asset inspection. Bounds checks cannot prove that generated objects are complete or accurate; no padding is added to disguise clipping.


## Presentation policy and quantity pacing

The policy in `src/pipeline/comparison-policy.ts` distinguishes recommendations from hard requirements. Targeting 8–15 objects, familiar anchors, surprising pairs, contextual backgrounds, known countries and videos under 60 seconds are recommendations. Local code repairs or omits optional presentation metadata. Approximate values are allowed; compatible units, at least two usable objects, safe assets, valid scales and decodable media remain requirements.

Presentation version 2 finalizes headlines from selected object pairs, or preserves a concise curiosity question for estimated plans. Descriptions and background explanations refer to the surviving selection. Speed conditions can use concise context. Generic publication dates are omitted. A successful framing check cannot certify image likeness.

Quantity charts use a fixed final linear axis. Each bar grows linearly for `max(1, 3 × abs(value) / maxAbsValue)` seconds, holds for 2.5 seconds, and remains visible as later bars arrive. Names/images fade in over the first 0.2 seconds. The last settled hold is followed by a four-second overview. Zero values retain a visible label/thumbnail; negative bars grow downward. Timing is compiled once and rounded to the output frame rate, with growth/hold/overview frame counts in `timing-report.json`. Quantity duration follows the schedule up to 90 seconds; physical-size comparisons retain their 60-second maximum and existing scale-sensitive travel.

Image plans describe identity and appearance; trusted code supplies cutout or sphere format, framing and annotation rules. Conflicting legacy cutout briefs receive a neutral identity-preserving fallback without extra LLM calls. Cache fingerprints include the appearance-planning version; only changed effective asset prompts regenerate. Saved datasets are re-finalized when resumed; already delivered videos are not rewritten.


## Approximate plans and supplied datasets

The default plan uses plausible general-knowledge estimates (`dataQuality: "estimated"`), marks each value approximate and does not require sources or dates. Model-suggested curiosity questions can be retained; unsupported ranking claims are replaced with a neutral comparison hook. Optional metadata and image-format instructions are repaired locally.

Supplied datasets without `dataQuality: "estimated"` keep the existing source-reference contract. The legacy researched adapter and its diagnostic files remain available for integrations explicitly choosing verified-source work, but neither the CLI default nor GitHub Actions invokes it. Existing curated examples and completed render receipts are preserved.

## Individual image rejections

A Cloudflare moderation refusal (`HTTP 400`, error `3030`) omits that object instead of failing the whole video. The pipeline respects the refusal: it does not rewrite the prompt or switch models. A request fingerprint records the rejection so resumes do not repeatedly request it. Other objects continue, using cached images when available.

A manifest must explicitly account for every object with either an image or a provider-rejected entry. At least two usable objects must remain; otherwise the comparison is unworkable. Missing unexplained assets, bad credentials, unsafe images and provider outages retain their existing failure/deferral behavior. Framing repair is optional and keeps the original usable image if repair fails.

The surviving objects determine the final hook, labels, values, pacing, description and upload metadata. `asset-selection.json` records exclusions, `dataset-assembly.json` reports the rendered count, and the deduplication ledger records the actual rendered names. The original planning dataset stays cached alongside image receipts for recovery.
