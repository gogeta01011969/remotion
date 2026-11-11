# Production readiness and deferred expansion

Audit: November 11, 2026 (Asia/Kolkata), application revision `3ccc6ab`.

Current scope: automatically create silent physical-comparison Shorts on Linux,
ending in a verified MP4 delivery. YouTube upload and new measurement templates
remain deferred. The current system is a working beta; unattended production
reliability has not yet been established across subjects.

## Implemented

| Piece | Responsibility | Evidence / limit |
| --- | --- | --- |
| Topic engine | Choose topics across 17 families, eight angles and three depths | Live planning preview passed; editorial appeal remains model judgment |
| Deduplication | Compare titles, scopes and object sets against durable history | Tested; aliases and shortened labels can still escape matching |
| Bounded research | Discover/open sources locally, extract exact quotations, convert units | Live tested; source availability and semantic interpretation remain variable |
| Editorial and visual planning | Select objects, order, background and per-object image briefs | Schema/evidence checks and resumable drafts implemented |
| Cloudflare image policy | Require raster imagery for real objects; cache successful generation | Enforced in code; no fresh complete hosted run of this policy confirmed yet |
| Foreground preparation | Local CPU cutouts, alpha checks, calibration and frozen assets | Linux smoke test passes; image identity/likeness is not automatically verified |
| Remotion / FFmpeg | Deterministic composition, MP4 encoding and media verification | Hosted render succeeded; latest Linux offline verification passes |
| Workflow controller | Manual/scheduled jobs, serial execution, checkpoints, retries and ledger | Implemented/tested; due deferrals await another trigger |
| Delivery and cleanup | Archive final artifact, persist completion, then remove intermediates | Hosted confirmation/cleanup succeeded; retention is temporary |
| Usage and diagnostics | Stage/token reports, image usage receipts and saved errors | Implemented; hard 12-request/65,000-token limits still active |

Evidence:

- [Latest Linux verification](https://github.com/gogeta01011969/remotion/actions/runs/43012875918): revision `3ccc6ab`, successful.
- [Completed hosted video](https://github.com/gogeta01011969/remotion/actions/runs/42977953181): revision `3690890`, rendered, archived and marked complete. Its objects used local plain materials; this does not validate the later mandatory Cloudflare policy.
- 139 TypeScript tests passed locally for `3ccc6ab`; Linux CI also runs the real CPU extraction test and a fixed offline render.

## Work before unattended production

1. **Validate the current revision end to end.** Exercise generated sphere
   textures, vertical cutouts, horizontal/winged cutouts and capacity graphics.
   Check the actual Cloudflare assets and finished videos. Also exercise an
   interrupted run and an archive failure on hosted runners. Offline tests and
   one older completed video do not establish this coverage.
2. **Add content and visual quality gates.** Bind dataset identities to stable
   research records, check claims/titles against the evidence, and define how to
   review image likeness, markings, orientation, crop, texture seams and readability.
   Existing checks establish file/geometry validity, not semantic correctness or
   audience appeal. Keep initial production outputs reviewable before publishing.
3. **Finish retry orchestration.** Resume due jobs automatically while respecting
   a configured output cadence. A daily trigger alone does not resume a one-minute
   deferral promptly. Handle workflow cancellation, expired checkpoints and code
   changes between render and archive; confirm attempt counts survive interruption.
   Avoid repeatedly failing an entire subject because of stale state.
4. **Make delivery durable and reproducible.** Final Actions artifacts retain
   30 days; checkpoints retain seven. The final delivery currently does not
   include all frozen image assets needed to rerender after checkpoint expiry.
   Choose permanent storage and archive the complete inputs/assets/provenance
   before cleanup. Retain a recoverable backup of the topic ledger.
5. **Set the intended usage policy.** The proposed warning/optional-ceiling
   approach has not been implemented: config still enforces 12 logical calls and
   65,000 reported tokens per invocation, with conservative reservations. Separate
   estimates, reported usage and unknown usage. Establish expected per-video
   consumption across subject types and a daily output policy; do not rely on
   provider free quotas as a per-job budget.
6. **Produce one final operational report.** Report delivered, deferred,
   needs-review, duplicate and skipped outcomes distinctly, with actual artifact
   links, final ledger status, next action, durations and usage. The generation
   summary is written before archival and can still say `rendered` after the job
   has become `complete`. Track delivery success and recurring failure reasons.

## Improvements after the core is reliable

- Canonical entity IDs/aliases for stronger deduplication.
- Better source discovery, primary-source coverage and explicitly dated records.
- More consistent Cloudflare identity/detail accuracy across object categories.
- Better topic ranking from observed performance once channel data is available.
- Reduced repair calls and better pacing based on real run measurements.
- Long-history storage/archival beyond one ever-growing ledger file.

## Explicitly deferred

- YouTube OAuth, idempotent uploads, processing checks and publication scheduling.
- Narration, music and audio finishing; current target remains silent video.
- Additional measurement families: mass, population/counts, speed, age/duration,
  energy/power and temperature. Add quantity bars, grouped-count, race, timeline
  and suitable axis templates before enabling those topics. Preserve object
  imagery as identity while encoding the measured quantity separately.
- Automatic geographic area acquisition: the renderer already supports supplied
  real outlines, but automatic source acquisition remains unfinished.

Suggested next milestone: reliable delivery on the current Cloudflare-required
pipeline across its supported visual modes, plus hosted recovery/archival checks.
Complete that milestone before expanding the measurement/template catalog.
