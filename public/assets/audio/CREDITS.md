# Comparison soundtrack sources

These 12 music files were downloaded on 2026-11-27. Their creator source pages identify them as CC0 / public domain. Original recording bytes are preserved (Exploration Theme is the OGG extracted from its creator's ZIP); SHA-256 values, download/source URLs and creator/license details are recorded in `catalog.json` and checked before mixing. No music is downloaded at runtime.

- **Overworld (BGM)** — Another Page Studio / IntelligentGene. [Creator's source page](https://opengameart.org/content/overworld-bgm). File: `overworld.mp3`.
- **Calm Track** — pmiller. [Creator's source page](https://opengameart.org/content/calm-track). File: `calm_track-loop.ogg`.
- **Calm Loop** — wipics. [Creator's source page](https://opengameart.org/content/calm-loop). File: `calm-loop.mp3`.
- **Calm Theme** — pebonius. [Creator's source page](https://opengameart.org/content/calm-music-0). File: `calm-theme.ogg`.
- **A Brand New Wisdom** — hernandack. [Creator's source page](https://opengameart.org/content/short-loops-background-music-pack). File: `a-brand-new-wisdom.ogg`.
- **Just Saying Tho** — hernandack. [Creator's source page](https://opengameart.org/content/short-loops-background-music-pack). File: `just-saying-tho.ogg`.
- **Winter Dust** — hernandack. [Creator's source page](https://opengameart.org/content/short-loops-background-music-pack). File: `winter-dust.ogg`.
- **Swinging Sweet** — hernandack. [Creator's source page](https://opengameart.org/content/short-loops-background-music-pack). File: `swinging-sweet.ogg`.
- **Sunset Walk** — KiluaBoy. [Creator's source page](https://opengameart.org/content/sunset-walk-ambient-quiet-sweet-loop). File: `sunset-walk.ogg`.
- **Ambient Relaxing Loop** — isaiah658. [Creator's source page](https://opengameart.org/content/ambient-relaxing-loop). File: `ambient-relaxing-loop.ogg`.
- **Feel Good Slow Ambient Track** — annandistance. [Creator's source page](https://opengameart.org/content/feel-good-slow-ambient-track-with-a-beat). File: `feel-good-ambient.ogg`.
- **Exploration Theme** — Cleyton Kauffman. [Creator's source page](https://opengameart.org/content/exploration-theme). File: `exploration-theme.ogg`.

License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

Rendered versions are normalized, looped/crossfaded when needed, mixed with quiet effects and faded to fit each video. A voluntary credit names the track actually used. CC0 does not require that attribution.

The two sound effects are synthesized locally by `src/pipeline/comparison-audio.ts` using a fixed seed and elementary waveforms; they contain no downloaded samples, speech, or third-party recordings.

Comparison runs try a deterministically selected track by default. Expanding or reordering the catalog can change which track a run ID selects on a fresh render. Existing rendered audio stays in its checkpoint; the source fingerprint invalidates stale render receipts when the library changes. Soundtrack preparation or attachment failures fall back to a muted export.
