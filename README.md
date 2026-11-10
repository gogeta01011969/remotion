# Motion Lab

**Silent visual Shorts:** comparison videos now explain themselves through motion, labeled objects, correct dimensional scaling and concise statistics (names, measurements and named ratios only). No narration or soundtrack. Reusable sphere renderers and per-run cutouts handle appearance. All size comparisons use one smallest-to-largest zoom template with measured, animated typography and object-related backgrounds (including space, sports, architecture, nature and geography). The two examples compare eight objects in 30 seconds. Run `npm run compare -- --data comparisons/sports-balls.json`; see [comparison workflow](comparisons/README.md).

**Per-run comparison objects:** height, length, width, wingspan, area and volume now support run-specific cutouts, calibrated alpha bounds, independent proportions and dimensional scaling. `npm run compare -- --topic "Tallest statues excluding pedestals" --id statues-run` saves researched measurements and per-object asset requests; supply the images or configure a local asset provider for unattended rendering. No fixed object catalog is required. See the [comparison contracts and provider interface](comparisons/README.md).

**Shorts concept planning:** new topic runs propose three audience-focused angles before research, choose one, then select purposeful objects around an opening reference, interesting contrasts and final payoff. The editorial selection travels with the dataset into the writing brief. Try `npm run compare -- --topic "Size comparison of different flying objects" --id flying-objects --ideas-only` to inspect provisional concepts without generating images or rendering. Existing curated datasets and completed runs remain supported.

**What If Shorts:** run `npm run generate -- --topic "What if gravity were half as strong?"` for GroqCloud research → script → motion plan → local MP4. See [automation setup](AUTOMATION.md) and [the Shorts architecture](SHORTS.md). The original landscape sample below remains available.

A local React + TypeScript + Remotion starter for configurable motion graphics. The sample is a silent 15-second, 1920 × 1080, 30 FPS film with three animated scenes: kinetic type and orbital geometry, a staggered shape grid, and a closing title. Seeded particles, springs, continuous motion, and overlapping transitions are generated frame by frame.

## Run

Requires Node.js 20 or newer and npm. From this directory:

```sh
npm install
npm run dev
```

Open the local URL printed by Remotion (usually http://localhost:3000), select **MotionLab**, and press play. Scrub the timeline to inspect any frame. Edit the composition's props in Studio to change the sample; changes apply to the preview and Studio's render dialog. To preserve changes for CLI renders, save them in a JSON props file.

## Render locally

```sh
# Full-resolution sample, H.264 MP4
npm run render

# Faster half-resolution preview
npm run render -- --scale=0.5

# Custom JSON inputs; same output path unless overridden
npm run render -- --props=examples/custom.json

# Explicit output path
npx remotion render src/index.ts MotionLab out/custom.mp4 --props=examples/custom.json

# Preview image at frame 75
npm run still
```

The default landscape movie is written to `out/motion-lab.mp4`. The first render may download Remotion's headless browser and needs internet access for that download. After dependencies and the browser are present, the sample uses no remote assets or services. This original sample uses Remotion's bundled encoding tools and has no audio track. Shorts use silent visual storytelling and local FFmpeg processing by default; narrated output remains optional. Groq handles the general-topic AI stages.

## Inputs

[`examples/custom.json`](examples/custom.json) is a complete editable example. CLI input props override top-level defaults; supply the complete `colors` object or complete `scenes` array when changing either.

| Input | Meaning |
| --- | --- |
| `width`, `height` | Even pixel dimensions from 320 to 3840, suitable for H.264 |
| `fps` | Integer from 12 to 60 |
| `durationSeconds` | Total video length, 9–120 seconds, rounded to the nearest frame |
| `colors` | `background`, `ink`, `accent`, `secondary`, each a six-digit hex color |
| `seed` | Integer 0–999999; produces a repeatable particle arrangement |
| `particleCount` | 0–100 particles per scene |
| `transition` | `wipe` or `fade`, lasting half a second |
| `scenes` | Ordered array of 1–8 scenes; types can repeat |
| Scene `type` | `intro`, `system`, or `finale` |
| Scene `eyebrow`, `title`, `subtitle` | On-screen text; short titles work best |
| Scene `weight` | Relative share of time, 0.5–5, after reserving transition time |
| Scene `intensity` | Continuous geometry/particle motion speed, 0.2–2 |

Duration, FPS, and dimensions are resolved using `calculateMetadata`, with runtime validation before rendering. Overlapping transition time is included in the requested total duration. Resolution changes uniformly scale a 1600 × 900 safe design area; other aspect ratios center that area with matching background space. These initial layouts are designed for landscape video.

## Structure and extension

```text
src/index.ts                 Remotion entry point
src/Root.tsx                 Composition registration and metadata
src/config.ts               JSON schema, types, defaults, timeline allocation
src/Video.tsx                Scene sequencing and transitions
src/scenes/Scene.tsx         Scene layouts
src/components/              Reusable typography, particles, and geometry
examples/custom.json         Alternate video instructions
tests/config.test.ts         Schema and timeline invariants
```

To add a scene type, extend the `type` enum in `config.ts`, implement its layout/visual component, and select it in `Scene.tsx`. Keep its properties JSON serializable. The schema is the intended future boundary for AI-generated instructions: a future Gemini adapter can produce and validate this JSON before passing it to Remotion. AI code generation and arbitrary executable input are outside this starter.

All visual state derives from `useCurrentFrame()`, FPS, props, and seeded `random()` calls. There are no timers, CSS animations, unseeded randomness, or network requests inside the video. Seeking and rendering frames out of order produce the same result. Text uses the local Arial/Helvetica/sans-serif stack; for identical typography across different operating systems, bundle a licensed local font before cross-machine production.

## Verify

```sh
npm run typecheck
npm test
npm run still
npm run render -- --scale=0.5
```

Tests cover invalid inputs, uneven scene weights, single/multiple scenes, varied FPS, fractional durations, and exact transition overlap accounting. Render outputs are ignored by Git. Remotion packages are pinned to the same version; commit `package-lock.json` and use `npm ci` for repeatable installs.

The implementation follows Remotion's official [parameterized video](https://www.remotion.dev/docs/parameterized-rendering), [transitions](https://www.remotion.dev/docs/transitions/transitionseries), and [seeded randomness](https://www.remotion.dev/docs/random) APIs. Check [Remotion's license](https://www.remotion.dev/license) for your intended usage.
