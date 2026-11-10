# Local What If Shorts pipeline

New pipeline jobs default to `presentation: "silent"`: no voice, music, sound effects or audio track. The story is carried by subject motion, persistent labels, metrics and concise optional notes. Silent timing uses normalized visual anchors and reading budgets; the compiler does not call `say`. The shared renderer verifies the absence of audio, and removes superseded narration assets after a successful silent export. The sections below describing narration and speech timing document the optional narrated mode and older examples. Legacy briefs without a presentation field retain narrated behavior for compatibility.


The active pipeline uses structured motion plans and a clean programmatic visual style. The rejected static-image/rapid-effects experiment has been removed. The original preferred video is preserved as `out/shorts/earth-stops/earth-stops-v1.mp4`.

## Automatic topic-to-video generation

The GroqCloud integration now connects research, script generation, motion planning, and the existing local renderer. There is no application UI. See [AUTOMATION.md](AUTOMATION.md) for setup, automation output, saved stages, and resuming jobs.

```sh
npm run generate -- --topic "What if gravity were half as strong?"
```

## Render an authored plan

```sh
npm ci
npm run short                              # Earth example
npm run short -- shorts/half-gravity.json  # Second topic, identical renderer
npm run short:studio                       # Prepared Earth props + soundtrack
npm run dev                                # Regular Studio; MotionLab remains available
```

Select **WhatIfShort** for the vertical composition. It renders at 1080×1920, 30 FPS, with a validated total duration of 30–45 seconds. The ordinary Studio fallback uses estimated timing; prepared props use measured narration lengths.

Requires Node.js 20.11+, FFmpeg/FFprobe on PATH, and macOS `say` for the current offline speech adapter. These are installed on this machine. The first Remotion render on a fresh machine may download its browser. The authored-plan renderer makes no model or media-generation calls. Automatic topic planning calls GroqCloud; speech generation, Remotion, and FFmpeg still run locally. Other operating systems need a speech adapter at the synthesis step.

## What changed in the pipeline

Previously, JSON selected a topic-specific preset; React supplied most of the scene choreography. It now defines a small shared world of named objects plus tracks that change their properties. The renderer does not inspect a topic or select a bespoke scene for it. Objects persist across narration scenes, and a property holds its last value until explicitly changed.

For example, the Earth plan holds the ground's rotation while the atmosphere continues moving, changes water geometry as it reaches a coast, and continues orbital motion separately. The half-gravity plan changes force/readout size while mass stays fixed, then uses accelerated trajectories to compare falls and jumps. Both use the same components and compiler; their only topic-specific implementation is JSON.

The renderer supplies a textured Earth sphere, geometric shapes, text/readouts, skyline, deforming waves, seeded streak particles, an elliptical orbit, and a mechanics-comparison module. Comparison stories use consistently styled spheres, force arrows, trajectories and result labels calculated from the declared gravity ratio. This is a limited science-explainer vocabulary, not a universal video generator. Extend that vocabulary deliberately when a new topic needs a visual concept it cannot represent.

## Future planner boundary

[shorts/PLANNER.md](shorts/PLANNER.md) describes how the assistant, and eventually Gemini, should plan visual explanations and emit supported JSON. [shorts/brief.schema.json](shorts/brief.schema.json) is the machine-readable contract.

```sh
npm run short:schema   # Regenerate JSON Schema after changing the contract
```

A future planner emits the same brief the current assistant authors. Validation rejects unknown primitives, unknown properties, missing object/cue references, duplicate tracks/IDs, invalid values, and scenes that only animate text, camera, opacity, or decorative particles. The compiler also rejects keyframes that collide after rounding to measured frames. These checks enforce executable motion instructions; they do not guarantee good storytelling or correct science.

GroqCloud is connected through the automation command. Research uses browser search with opened-source metadata, scripting is a separate model request, and motion planning defines a shared cast followed by smaller per-scene requests. No Gemini adapter or publishing is implemented. No per-video React code or manual scene images are required for subjects the library can express.

## Plan format

See `shorts/earth-stops.json` and `shorts/half-gravity.json` for complete examples. Contract version 2 replaces the previous `visual`/`beats` preset format; existing sample inputs have been migrated.

An actor declares its kind, geometry/content, and initial state. A scene declares narration cues and motion tracks, for example:

```json
{
  "actor": "earth",
  "property": "phase",
  "keyframes": [
    {"at": "start", "value": 0.5},
    {"at": {"cue": 0, "offset": 1}, "value": 1.8},
    {"at": "end", "value": 1.8, "easing": "hold"}
  ]
}
```

That object rotates and then stays stopped. Another object's track can continue moving at the same time. Frames are sampled directly from these tracks, without timers, unseeded randomness, incremental simulation, or CSS animations. Seeking in any order returns the same object states.

Tracks support linear, smooth, hold, accelerating, and decelerating interpolation. Camera movement uses the same track mechanism, but cannot satisfy the subject-motion requirement by itself. The Earth map is a bundled local texture projected onto an animated sphere; the renderer has no cinematic image-plate primitive or image-generation dependency.

## Audio and outputs

Each narration cue is synthesized locally and cached by text, voice, and speech rate. Measured sample counts drive captions and motion anchors. Captions retain full short sentences in the original restrained style. An understated procedural sound bed and scene-boundary accents accompany narration. FFmpeg normalizes the mix toward -16 LUFS, encodes AAC, and assembles a fast-start H.264 MP4. The offline Daniel voice is usable but less expressive than a strong neural narrator; its adapter can later be replaced independently.

Each `out/shorts/<id>/` contains the final `<id>.mp4`, `thumbnail.png`, `captions.srt`, `narration.wav`, `youtube.txt`, `motion-report.json`, and `verification.json`. Temporary speech containers, raw mixes and silent picture renders are removed after their processing step succeeds. The motion report lists the changing properties per scene for inspection, not a subjective quality score. FFprobe verifies dimensions, duration, and audio/video streams. Prepared preview props and soundtrack live under `public/shorts/<id>/`; generated outputs are Git-ignored.

```sh
npm run short:prepare -- shorts/half-gravity.json
npx remotion studio src/index.ts --props=public/shorts/half-gravity/video.json
```

## Code and checks

- `src/shorts/schema.ts`: strict authored/render contracts and capability validation.
- `src/shorts/motion.ts`: cue anchors, persistent property tracks, pure frame sampling.
- `src/shorts/Actors.tsx`: reusable visual primitives; no topic-dependent branches.
- `src/shorts/Comparison.tsx`, `mechanics.ts`: comparison layout and deterministic mechanics calculations.
- `src/pipeline/direction.ts`: typed visual direction and compilation of supported demonstrations into the existing motion contract.
- `src/shorts/ShortVideo.tsx`: shared world, camera, captions, preview audio.
- `scripts/build-short.ts`: speech, preparation, rendering, FFmpeg, media verification.

```sh
npm run typecheck
npm test
```

Tests cover two topics through one compiler, input immutability, seek-independent sampling, persistence across scenes, simultaneous stopped/moving objects, interpolation math, invalid capabilities/timing, and subject-motion validation. Tests cannot establish whether an audience will find a video engaging; inspect the rendered animation as part of authoring.


## Ancient Wisdom & Mythology

The topic-to-video workflow now supports content profiles. `Why does Lord Shiva wear a crescent moon?` automatically selects `mythology`; `--genre mythology` overrides ambiguous routing. It gets a traditional-story research brief, direct narrative hook, attributed account, mythology branding and hashtags, and access to the reusable symbolic-story module. Existing What If jobs retain their original profile.

```sh
npm run generate -- --topic "Why does Lord Shiva wear a crescent moon?" --id my-shiva-story
```

The new SVG story actor supports moon/flame/lotus symbols and reveal, diminish, approach, protect and renew actions. Pose interpolation is deterministic and continuous across scenes; cue timing comes from measured speech. It is a deliberately small library, with a stylized Shiva icon and a generic sanctuary, rather than arbitrary deity artwork. See `AUTOMATION.md` for routing, overrides and preview commands.


## Hindi Om example

`out/shorts/om-sacred-hi-60/om-sacred-hi-60.mp4` adapts the same source-grounded Om explanation into reviewed conversational Hindi. Narration uses local Lekha speech; captions and the Om module's labels use the bundled Noto Devanagari font. Section boundaries remain 0, 3, 12, 40, 55 and 60 seconds. See `AUTOMATION.md` for `--language hi`, `--adapt-from`, preview instructions and current localization scope.


## Hinglish Om example

`out/shorts/om-sacred-hinglish-60/om-sacred-hinglish-60.mp4` keeps the same 60-second structure with a conversational Hindi-English mix. Captions use Roman script, labels use short English/Hinglish phrases, and paired `spokenCues` supply pronunciation text to the local voice. Use `--language hinglish` with `--adapt-from` for the same workflow; see `AUTOMATION.md`.
