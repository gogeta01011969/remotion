# Motion Lab

**Current comparison pipeline:** topic → one Groq comparison plan → Cloudflare objects → Remotion MP4 → optional YouTube upload → cleanup. The plan chooses meaningful objects, approximate values, appearance and a related background together. Web research, exact quotations and citation repair are no longer mandatory. Videos display estimates with ≈ and disclose them in the description. Aim for 8–15 recognizable objects; a useful smaller comparison is fine. Existing sourced datasets still work. See [comparison workflow](comparisons/README.md) and [GitHub Actions setup](automation/README.md).

```sh
npm run compare -- --topic "How tall are everyday things beside famous structures?" --id everyday-height
```

The same silent templates handle physical sizes and sequential bar charts. Geometry, pacing, text placement, Cloudflare Klein 4B image creation and local background removal are reusable; no AI-generated React runs. The optional `--ideas-only` command is an independent brainstorming preview, not a required planning stage.

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

Optional automatic YouTube uploads: [connect your channel and configure GitHub Actions](automation/YOUTUBE.md). Uploads are enabled and fixed to private in `src/pipeline/youtube-settings.ts`; OAuth credentials are still required.

Quantity comparison videos use a fixed linear axis, value-proportional bar growth (one-second minimum), 2.5-second settled holds and a four-second overview. They may extend to 90 seconds; physical-size comparisons retain their existing 60-second limit. See [comparison presentation policy](comparisons/README.md#presentation-policy-and-quantity-pacing).

Automatic workflow runs can skip unworkable topics and try up to three candidates within one shared usage budget. Explicit manual topics keep their scope. Provider cooldowns defer work; exhausted candidates report `no-video` without uploading an empty or invented result. See [run-level resilience](automation/README.md#run-level-resilience).

New topic runs normally need one comparison-plan model request; automatic topic selection adds one request when the queue is empty. Optional metadata is normalized locally. At least two usable objects, compatible units, safe assets and decodable final media remain required. Provider quotas/outages can still defer a run; approximate numbers are not presented as verified facts.
