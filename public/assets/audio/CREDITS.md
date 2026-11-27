# Comparison soundtrack sources

These two music files were downloaded on 2026-11-27. Their creators identify them as CC0 / public domain, allowing reuse and redistribution. Original bytes are preserved; SHA-256 values, source URLs and creator/license details are recorded in `catalog.json` and checked before mixing.

- **Overworld (BGM)** — IntelligentGene / Another Page Studio. [Creator's source page](https://opengameart.org/content/overworld-bgm). File: `overworld.mp3`.
- **Calm Track** — pmiller. [Creator's source page](https://opengameart.org/content/calm-track). File: `calm_track-loop.ogg`.
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

Rendered versions are normalized, looped/crossfaded when needed, mixed with quiet effects and faded to fit each video. A voluntary credit names the track actually used. CC0 does not require that attribution.

The two sound effects are synthesized locally by `src/pipeline/comparison-audio.ts` using a fixed seed and elementary waveforms; they contain no downloaded samples, speech, or third-party recordings.

Comparison runs try a deterministically selected track by default. Soundtrack preparation or attachment failures fall back to a muted export.
