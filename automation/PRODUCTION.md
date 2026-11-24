# Production operation

Reviewed November 24, 2026 (Asia/Kolkata).

The active pipeline is topic selection → a simple approximate comparison plan → Cloudflare objects → local cutouts and Remotion rendering → Groq YouTube metadata → public upload → cleanup. Private upload has been confirmed during testing; future uploads request public visibility. Existing private videos are unchanged.

Topics and object choices prioritize a general audience: familiar subjects, common names, meaningful contrasts across recognizable categories and a clear payoff. Specialist catalogs and barely different obscure variants are discouraged. These are editorial guidelines, not brittle validation rules.

The synthetic-content flag is disabled for the clearly animated comparison-diagram format. AI image credits and numerical approximation disclosures remain. This setting is not a blanket rule for all AI images: realistic generated scenes may require disclosure under [YouTube's policy](https://support.google.com/youtube/answer/14328491).

## Verified boundaries

- Deterministic templates, compatible units, at least two usable objects and decoded asset/media checks remain required.
- Cloudflare image refusals omit the affected object without prompt/model workarounds. Provider outages/quotas retain bounded retries and checkpoint deferrals.
- Metadata uses final rendered objects, one optional budgeted request and a cache/local fallback. Upload intents freeze the exact metadata and video hash.
- Uploads verify the intended channel and persist intent before sending. Ambiguous transfers require review rather than duplicate uploads.
- Confirmed uploads delete generated files and remote video/checkpoint artifacts. Failed recovery is temporary and storage-bounded; the durable ledger retains delivery IDs and recent deduplication history.

## Storage and scheduling

See [operation and storage policy](README.md#production-storage-policy). Automatic generation runs daily when `AUTOMATION_ENABLED=true`; housekeeping runs daily independently and after generation. No permanent video archive is maintained. The root README and obsolete generated previews/downloads have been removed; source fixtures and channel artwork remain.

## Practical limits

Approximate values and generated-image identity are not automatically fact-checked. Model judgment cannot guarantee interesting topics or audience performance. Provider availability, quotas and GitHub scheduling can still delay or skip a run. Manage consent/token revocation through [YouTube setup](YOUTUBE.md). Monitor the initial public outputs in Studio; no view/reach guarantee is implied.
