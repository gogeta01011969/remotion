# Size-comparison pipeline

Every run can define new objects. The renderer does not require a hardcoded statue, animal, vehicle or country catalog. Existing ball materials and planet maps remain optional reusable visuals. All subjects share the silent smallest-to-largest presentation: names, measurements, named ratios, contextual backgrounds and deterministic camera motion. Default duration follows object count and scale-dependent arrivals, with 2–3 settled seconds per subject and a four-second final overview, within 60 seconds.

## Run from a topic

```sh
npm run compare -- --topic "Tallest statues, excluding pedestals" --id statues-run
```

This uses the existing GroqCloud configuration (`GROQCLOUD_API_KEY` in `.env.local`) for **concept selection, research and structured object planning**. It first proposes three Shorts angles and selects one, then searches/opens sources to verify the candidates, measurement definition and visual requirements. Finally it aims for 8–15 purposeful objects (accepting 2–7 when evidence supports fewer) and writes their dataset, editorial plan and per-object visual briefs. It does not ask an LLM to generate executable React.

The concept stage considers a viewer question, recognizable anchor, meaningful contrasts and largest-object payoff. A broad topic can receive a stronger angle within its scope; explicitly named objects and restrictions remain constraints. Eight items are no longer a target to fill: four to six strong choices can be better. Small differences are allowed when they answer a specific question. These are editorial hypotheses, not measured audience-performance predictions.

```sh
# Review three provisional concepts without research, images or rendering
npm run compare -- --topic "Size comparison of different flying objects" --id flying-objects --ideas-only
# Continue the selected concept through research and the normal comparison build
npm run compare -- --topic "Size comparison of different flying objects" --id flying-objects --asset-provider comparisons/cloudflare-klein.provider.json
```

`idea-plan.json` saves the three proposals, selected ID and selection reason. Candidate records and measurements are unverified at ideation; research can reject or replace candidates. The embedded dataset `editorial` field and `editorial-plan.json` record the opening, familiar anchor, consecutive surprising pair, final payoff, per-item roles/reasons, omitted candidates, sourced claim scope and any research-backed opening/payoff/question corrections. The writing brief and exported description retain this intent. The video remains silent with names/stats only; no extra hook paragraphs are placed on screen.

Local validation checks dimensions, supported views, role coverage/order, actual first/last objects, adjacent comparison references and source IDs. Top-N claims require a date and consistent basis; those checks do not themselves prove a complete ranking. Engagement, actual asset accuracy and factual interpretation still need editorial review. Broad flying-object ideas cannot mix wingspan, rotor diameter and body length; geographic outlines require real geographic assets. Providers must supply suitable per-run assets. Mixed fixed landmarks use subject `structures` and show sourced countries, just like statues/buildings.

New runs target 8–15 supported objects, accepting 2–7 when research yields fewer; they do not fail solely for missing eight or pad with invented facts. Unopened-source references can trigger one focused follow-up, keeping source IDs stable. Unsupported candidate measurements are omitted and recorded as gaps; remaining verified candidates continue. Fewer than two supported objects still stops the job before asset creation. Model output is canonicalized into measurement order and compact context text; measured values, units, ranges and sources are not changed to make a story work. Provider-compatible structured output uses nullable optional fields so missing facts need not be invented. Full local schema checks remain authoritative even when a compact request or JSON-mode fallback is used. Groq rate-limit reset intervals are honored; repeat the same topic/ID after a longer quota reset to reuse the saved stages.

Saved stages are reused on the same topic/ID. Existing completed datasets are not reinterpreted or regenerated with a new angle. Use a new ID to apply the new concept process to an older topic. The data-input route continues to accept curated datasets without an editorial field.

A raster creation tool is a separate provider. Without a configured provider or supplied images, the command returns a machine-readable `needs-assets` result. `out/comparisons/statues-run/asset-requests.json` describes the objects, reference URLs, requested views, generation prompts and output directory. Create the requested files in that directory and repeat the same command. Saved research and object planning are reused without another AI request. Files can also be delivered in an asset manifest.

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

`out/comparisons/<id>/` contains status, prepared dataset, episode, story plan, measurement report, visual manifest and compiled brief. Prompt runs additionally save research, raw dataset and asset requests/provider state. `status.json` distinguishes `needs-assets`, `planned`, `prepared`, `rendering`, `complete` and `failed` states. Only a successful renderer exit marks a video complete.

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

## Bounded research and recovery

Comparison research now retrieves sources locally with enforced search, page,
HTTP, response-size and evidence-text limits. Groq receives compact excerpts
and cannot start a hidden browsing loop. Measurements require exact source
quotations; unit conversion and ordering happen in local code. Existing agentic
research checkpoints are preserved but re-researched before use. See
[bounded source research](../automation/README.md#bounded-source-research) for
limits, checkpoint files, secondary-source limitations and recovery behavior.

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

The same research → editorial → Cloudflare assets → render workflow now supports:

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
Each value appears once at its bar endpoint, and axis units appear once. A shared linear axis reframes as larger values
arrive, applying the same scale to every visible bar. Tick labels show that scale.
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
comparisons support 10–60 seconds; other video contracts retain their existing
limits. Authored episode durations remain explicit overrides.

Display names are separate from research identity. Simple animal qualifiers
such as domestic/house are shortened when unambiguous; species/model distinctions
and colliding names retain their identifying qualifiers. New plans can supply a
validated `displayLabel`. Measurement headings use audience-facing language
(`Lifespan (years)`), with dates reserved for changing population/inventory counts.

The same local timing rules drive object motion, chart growth, label arrival and
the final overview. Physical scale uses linear extent (area/volume use square/cube
roots); signed/zero-based charts use axis distance rather than invalid ratios.
Pacing is deterministic and requires no additional model calls.


New runs aim for 8–15 sourced objects throughout concept generation, dataset
selection and CLI rendering. Topic selection favors broad, accessible source
coverage; concepts can propose up to 18 candidates to allow research exclusions.
Two-to-seven-item comparisons are valid fallback deliveries when supported
evidence is limited. Never pad the comparison or invent an eighth measurement. Research is extracted in batches of at
most six source excerpts, and image briefs in batches of five subjects. Validated
batches are cached so an interrupted later batch does not repeat earlier calls.

Charts with more than eight visible bars alternate two rows of subject images
and names, using subtle leaders for the second row. Units and values stay on the
chart. Physical comparisons retain their true-scale lineup and smallest/largest
endpoint summary. Pacing reserves 2–3 settled seconds per object plus a four-second
overview; if necessary, only arrival travel is shortened to stay within 60 seconds.

The offline `compare:examples` runner continues testing the eight-object target. Historical examples with fewer than eight objects are expanded in
`out/comparison-examples/` into explicitly synthetic eight-object geometry
fixtures, reusing credited artwork. Their original datasets/measurements remain
unchanged. These fixtures test rendering, not research or real-world rankings;
they never enter the automated topic-generation pipeline.

Canonical object names retain up to 80 characters for research, image identity
and metadata. Optional on-screen `displayLabel` values remain at most 24
characters and may omit whole words from the original name in their original
order. Unsupported/overlong generated aliases are discarded locally, leaving
the canonical identity intact; they do not consume model-repair calls. Full
canonical names still fail if they do not identify the selected evidence. Chart
labels fit within a fixed-height band so long fallback names do not overlap the
next row of images.

At the model-generation boundary, only recognized top-level dataset fields are
retained. Extra planning annotations such as `generationBrief` are ignored and
their field names logged; the original response remains in the attempt artifact.
Required fields, nested objects, measurement dimensions, and source/evidence
binding remain strict. Detailed image briefs belong to the separate image
planner, so dataset selection accepts lightweight visual descriptors without
`visual.generation`. Saved-draft recovery checks all three local attempts before
requesting a new model repair.

Research extraction validates records independently. Wrong-age measurements,
unmatched source quotations, invalid units and malformed individual records
become candidate gaps, rather than causing the entire valid batch to repeat.
The pipeline aggregates the verified subset across all source batches and only
continues when at least two supported objects remain. Saved failed drafts can
be revalidated locally under this policy. Adult checks retain juvenile context
unless the selected measurement clause explicitly establishes adulthood, so a
separate birth-weight sentence does not invalidate an explicit adult figure.

Quality preferences are advisory. Optional editorial metadata, rationale wording,
concept choice bookkeeping, countries, background notes, colors and other
presentation details are corrected locally or omitted with a warning. A valid
comparison may contain two or three verified objects and may be supported by
one opened source. The normal target remains 8–15 objects. Missing role metadata
uses the measured smallest-to-largest progression; missing countries are omitted
rather than guessed. `quality-warnings.json` records these decisions and is
included in the delivery/checkpoint, with a count in the Actions summary.

Hard stops protect material correctness and execution: fewer than two verified
objects, incompatible dimensions, unsupported measurements/source IDs, misleading
ranking claims, unsafe or unusable assets, failed MP4 verification, provider
unavailability and unsafe/ambiguous YouTube uploads. These cannot be solved by
quietly presenting a different measurement or claiming a successful delivery.
