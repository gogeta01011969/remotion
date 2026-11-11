# Automatic comparison Shorts on Linux

The workflow selects a topic, checks history, runs the existing comparison pipeline,
renders a silent MP4, archives the result, and cleans that job's intermediate files.
It does not upload to YouTube. Existing `compare` commands and Mac foreground
extraction remain available.

## Start on GitHub

1. Push this project, including `package-lock.json`, curated examples and their
   source assets, to a GitHub repository. Do not commit `.env.local`, `.venv`,
   `.cache`, `.automation` or `out`.
2. Run **Linux verification**, or **Create a comparison Short → mode: smoke**.
   This needs no API secrets. It typechecks, runs tests, extracts a real foreground
   using CPU inference, renders a fixed wingspan comparison, and uploads artifacts.
3. Add repository Actions secrets `GROQCLOUD_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`,
   and `CLOUDFLARE_API_TOKEN`. Comparison research uses plain JSON completions; no
   server-managed browser tool or extra search API key is needed.
   No `.env.local` file is needed on the runner.
4. Run **Create a comparison Short → mode: auto** on the default branch.
   Leave `topic` blank for automatic selection, or supply a comparison topic.
   To retry a known job after fixing a validation failure, leave `topic` blank
   and enter its ID in `resume_job`. This explicitly resumes the saved job and
   restores its checkpoint; the existing attempt limit still applies.
5. Download the `short-<job-id>` artifact from the run. Review the MP4, thumbnail,
   render inputs, metadata, sources and available editorial/background plans.
6. After a successful hosted run, set repository Actions variable
   `AUTOMATION_ENABLED=true` to enable the daily 03:17 UTC schedule. Leave it unset
   to use manual runs only. GitHub schedules can be delayed.

The production job requires `contents: write` to maintain its state branch and
`actions: read` to restore checkpoints. Repository/organization rules must permit
these permissions and updates to `automation-state`; otherwise it stops before
generation. No personal access token is required. Production jobs are serialized,
and automatic generation runs only on the default branch.

Both workflows use Ubuntu 24.04, Node 22 and Python 3.11. The setup installs
FFmpeg/FFprobe, Chromium dependencies, Remotion's browser and pinned `rembg[cpu]`.
No GPU or separate background-removal service is required. GitHub runner minutes
and Groq/Cloudflare usage still depend on your accounts' allowances.

## What happens in an automatic run

1. Restore the durable ledger from `automation-state:automation/state.json`.
   An unavailable/malformed existing ledger causes failure rather than resetting
   history. The first ledger seeds the six curated comparison examples.
2. Resume an unfinished eligible job, rank queued topics by recent subject/angle
   coverage, or ask Groq for three feasible ideas. Candidates include a subject
   family, angle, depth, measurement scope and proposed objects. Remaining
   candidates stay in the queue for later runs.
3. Check normalized titles, stable scope keys and substantially repeated object
   sets. Save the reservation remotely **before** paid generation work begins.
4. Use the existing concept → research → editorial selection → data pipeline.
   Check the researched object set against history again before making images.
5. Require per-run Cloudflare imagery for every depicted real object, including
   familiar sports balls and planets. Missing image briefs are completed before
   rendering. Create images with Klein 4B at four steps. Remove
   backgrounds locally using the explicitly selected ISNet model, calibrate assets,
   retain the concept-linked background, and render with the shared size template.
6. Verify the actual exported file: H.264, 1080×1920, expected FPS/frame count and
   duration, with no audio track. Save a render receipt and final delivery folder.
7. Upload the finished artifact. Only a successful artifact ID changes `rendered`
   to `complete`. Persist that status, then remove this job's generated directories.

Deduplication is a practical heuristic, not a semantic guarantee. Titles are
normalized, scopes are compared within the same metric, and object sets are
rejected at ≥75% Jaccard overlap when both contain at least four items. Proposed
and researched sets are both retained. Failed/rejected topics remain in history,
so automatic selection does not keep choosing them under a new run ID.

Cloudflare object images are mandatory in automated object comparisons. The
planner cannot substitute a plain colored sphere, procedural sports material or
catalog planet map. Unfinished cached plans missing image briefs are upgraded
without changing their measured values. Generated images are reused on retry;
Cloudflare failure defers the job instead of silently changing its visual style.
Completed deliveries are preserved and are not automatically rerendered.

Equivalent-volume cubes remain explicit mathematical measurement graphics, and
geographic borders require real sourced outlines. Those are not generated
real-object illustrations. Authored offline fixtures and the no-secret Linux
smoke test keep their local visuals. No comparison measurement is inferred from
an AI image.

## Configuration and recovery

### Topic horizon

The topic engine now explores 17 subject families: worlds, stars, sports equipment,
landmarks, infrastructure, aircraft, land vehicles, watercraft, land animals,
marine life, winged life, trees/plants, everyday objects, machines, microscopic
subjects, storage capacity and compatible cross-category comparisons. These are
subject/measurement policies, not fixed catalogs of objects or images.

Eight angles provide depth within those families: familiar-to-extreme,
unexpected-neighbors, hidden-differences, record-ladder, orders-of-magnitude,
through-history, within-one-family and natural-vs-engineered. Depth levels are
accessible, specialist and extreme-scale; specialist topics still need a familiar
reference, and extreme-scale topics must remain legible in the current template.

For example, supported topic directions include a whale versus familiar vehicles
on one length scale, mature trees versus landmarks on one height scale, and
historical/current aircraft on one consistent wingspan scale. These directions
still need source verification; proposed records, sizes and winners are not facts.

Selection favours underused families, angles and depths within recent completed
history, with extra penalties for immediately repeating a family or measurement.
It does not simply choose the first eligible proposal. Legacy queued topics and
jobs remain readable; missing family metadata is inferred conservatively for
rotation. Deduplication still checks the complete durable ledger. Only a compact
eight-job history is sent to Groq, keeping prompt size bounded as history grows.

The chosen brief and provisional objects are passed into concept planning and
saved with the request. A concept may correct an unsuitable angle rather than
force a misleading story. Model editorial judgment and variety guide selection;
there is still no YouTube-trend or channel-performance scoring.

Optional `enabledFamilies` and `enabledAngles` arrays in `config.json` narrow the
catalog. Both default to all supported entries. Families are filtered by allowed
metrics; invalid combinations are rejected before research. See
`src/pipeline/comparison-horizon.ts` for stable IDs and capability policies.

Mass, speed, population/counts, timelines and energy/power are listed as future
dimensions, not enabled size topics. They need quantity/race/timeline templates
that represent those dimensions honestly. Geographic area still needs reliable
outline acquisition before automatic selection is enabled. Broadening topics
does not change measured size into a stand-in for another quantity.

### Run settings

Edit [`config.json`](config.json) to change the niche, eligible measurements,
idea-batch size, retry policy, request budget and asset provider. Default unattended
metrics are diameter, height, length, width, wingspan and volume. **Area is excluded**
until a reliable real-outline acquisition provider is connected. Existing authored
area comparisons still work. Generated cutouts approximate real objects and still
need visual review; they are not verified scans.

Quota exhaustion is a deferred outcome, with a notice rather than a failed
workflow. No finished video is claimed, and it does not consume a content attempt.
The retry time uses the provider's reported interval plus a small buffer, or a
60-minute fallback. Explicit resumes during backoff make no API calls. Quota
deferral also applies when topic selection has not yet reserved a job.
Network failures retain a 60-minute delay and count toward the three automatic
content attempts per job. A future run resumes a due job before choosing another topic.
Validation failures move to `needs-review`; an actual duplicate is skipped before
asset creation. The schedule is daily, so a retry delay does not itself trigger
another run. Trigger one manually to retry sooner once due.

The default budget retains 12 logical Groq requests and 65,000 reported tokens
per invocation. Before a call, the controller reserves a conservative input-byte
estimate plus the requested completion size and overhead. Provider HTTP retries
and unreported failed calls still mean this is not a billing guarantee. No
server-managed tools are allowed through the comparison automation client.

An application-budget deferral is distinct from provider quota exhaustion. Read
`automation-usage.json` or the per-request summary table to see the stage, tokens
and outcome. A new invocation resets its local counters, but resumes cached work.
Cloudflare image usage is separate; existing asset receipts avoid regenerating
successful images. Provider quota exhaustion remains a deferral, not a claim that
an MP4 was produced.

### Bounded source research

The controller runs a compact source plan, retrieves pages locally, then asks
Groq to extract measurements from bounded excerpts. It does **not** call Groq's
server-managed `browser_search` for comparisons.

Per job/checkpoint, local code enforces:

| Resource | Limit |
| --- | --- |
| Wikimedia article-discovery searches | 6 |
| Source page attempts (including failures) | 8 |
| Total HTTP requests, including redirects | 20 |
| Redirects per resource | 2 |
| Response size / request deadline | 1 MiB / 12 seconds |
| Evidence per page / all excerpts | 1,800 / 10,800 characters |

The limits live in `src/pipeline/bounded-research.ts`. Wikimedia discovery uses
its public REST search endpoint. Likely primary URLs and old source URLs are
untrusted hints until fetched again. Wikipedia can provide secondary evidence;
it is explicitly identified as such, not described as primary verification.
Sources that are blocked, empty, unsupported PDFs, or lack measurement text are
rejected. Only HTTPS endpoints with public DNS/IP addresses are fetched; redirects
are checked again. Source content is data, never instructions or executable code.

The source plan excludes candidates that contradict the inclusion policy, even
when an old concept chose one as its payoff. Extracted measurements require an
exact quotation, its literal numeric value and adjacent unit. Local code converts
units and circumference to diameter, sorts the values, and rejects datasets whose
values/source IDs do not match that evidence (0.5% rounding tolerance). Endpoint
changes are documented from the quote-checked measurements without an extra model
call purely for audit metadata. These checks do not prove every semantic claim
or establish a world ranking; ambiguous or missing evidence still needs review.

`research-web.json` persists discovery, attempted pages, excerpts and failures.
Counts survive runner restarts; budget deferral does not reset browsing limits.
`research-plan.json`, `research-measurements.json` and `research-receipt.json`
preserve the source plan, quotations and completed evidence. Failed dataset drafts
are revalidated/repaired on resume, rather than regenerated blindly. A focused
repair uses the same remaining HTTP/page budget; it cannot start a new web loop.

Old agentic `research.json` files without the new receipt are preserved as
`research.legacy.json` and re-researched once. Completed legacy videos and supplied
curated datasets remain usable. If bounded source acquisition cannot produce four
usable measurements, inspect the rejected URLs/gaps; do not repeatedly increase
the budget or discard checkpoints automatically.

The ledger uses GitHub's expected file SHA to reject concurrent updates. It is
durable branch data, not an evictable Actions cache. Do not delete it unless you
intend to discard topic history. Checkpoint artifacts retain raw data, generated
assets, receipts, logs and intermediate render files for seven days. Model weights
use an optional Actions cache; a cache miss downloads them again.

An interrupted job can restore only its own generated directories from a checkpoint
created by the trusted workflow on the default branch. Missing/expired checkpoints
may require regeneration for unfinished jobs. A job already marked `rendered`
must restore a matching checkpoint to retry archival; it will not silently pay to
regenerate. Changes to code/assets invalidate render receipts. Review a
`needs-review` job's saved error and checkpoint before retrying it explicitly with
`resume_job` (or local `--resume`). Jobs that exhausted the attempt limit still
require manual review of the ledger; no automatic attempt-reset command is provided.

Short provider throttles are handled inside the running job. Retry durations
recognize milliseconds, seconds and compound minute/hour durations; `525ms`
means 0.525 seconds, never 525 minutes. The Groq client retries transient rate
limits up to six HTTP responses with increasing waits, at most 60 seconds per
wait and 120 seconds total retry waiting per logical call. Longer waits defer
the saved job. Network/server failures retain their three-failure bound.
Successful token-limit/remaining/reset headers also pace later requests for the
same model. This reduces self-throttling; other account usage can still cause 429s.

Ledger loading also repairs dates produced by the old milliseconds-as-minutes
parser. Migration only applies when the stored date matches that exact erroneous
calculation from the saved error and its timestamp; genuine long waits and
operator-modified dates are preserved. The next new run persists the correction
before selection/resume. When a saved backoff still applies, the summary labels
the previous provider error as historical and explicitly states that no new
provider request was made.

After code changes are committed and pushed, start a **new** workflow dispatch on
`main` to test them. Re-running an old Actions run uses its original code revision;
uncommitted local changes are never visible to GitHub Actions.

Final video artifacts last 30 days. Download them or add permanent storage later;
the ledger retains their artifact IDs but cannot extend artifact retention. A
successful local run instead archives to `out/automation/delivery/<job-id>`.
Cleanup never removes the ledger or final delivery and is refused before completion.
YouTube publication is a separate future stage.

## Local execution

Keep using `.env.local` for the existing Groq/Cloudflare credentials. To use the
Linux-compatible cutout provider locally, install Python 3.11 and run:

```sh
npm ci
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements-linux.txt
export BACKGROUND_REMOVAL_PYTHON="$PWD/.venv/bin/python"
.venv/bin/python scripts/remove-image-background.py --warmup

# Select/reserve a topic without making images or rendering:
npm run automate -- --select-only

# Resume that reservation, or choose a new topic when none is pending:
npm run automate

# Optional supplied topic (still subject to duplicate checks):
npm run automate -- --topic "From a hummingbird to the widest-winged aircraft"

# Explicit recovery of a saved job:
npm run automate -- --resume short-YYYY-MM-DD-hash

# Remove archived intermediates after a successful local run:
npm run automate -- --resume short-YYYY-MM-DD-hash --cleanup
```

Install FFmpeg and allow Remotion to install/run Chromium locally. Linux runners
use `bash scripts/ci/setup-linux.sh`; this installer requires `sudo` and targets
Ubuntu 24.04. Local history lives in ignored `.automation/state.json` and is
separate from GitHub's ledger. Only one local controller may hold
`.automation/run.lock`; remove a stale lock only after its process has stopped.
Never run automatic local and GitHub generation against independent histories if
you expect deduplication between them.

## Verification and limits

```sh
npm run typecheck
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
npm run compare:examples -- --only wingspan
```

Tests cover topic queues, paraphrased/actual-set duplicates, quota deferral,
request budgets, checkpoint boundaries, archive retry without regeneration,
cleanup ordering and GitHub state conflicts. The Python test runs real CPU
foreground inference. Linux workflow syntax can also be checked with `actionlint`.

Bounded sports research was also tested live with a temporary GPT-OSS 20B model
override: 6 searches, 7 page attempts, 13 HTTP requests and 5 source-quoted
measurements used 9,622 reported tokens (including one extraction repair).
The prior agentic research request reported 403,863 tokens. This is one diagnostic
case, not a universal per-video cost estimate, and the configured default models
remain unchanged. Dataset recovery reused the saved research/draft without new
AI calls. Cloudflare then rejected image generation because its daily free
allowance was exhausted. A separate renderer verification using those new
measurements and existing local materials produced a 30-second 1080×1920 H.264
MP4; it does not establish successful fresh Cloudflare generation or a hosted
end-to-end run of this revision. Push the revision and start a new workflow run
after provider quota is available to verify that remaining path.

The first hosted Linux verification passed on November 11, 2026 (Asia/Kolkata):
[run 42876349482](https://github.com/gogeta01011969/remotion/actions/runs/42876349482),
commit `bbdeb7f`. Dependency setup, typechecking/tests, real CPU foreground
extraction, offline video rendering and artifact upload all succeeded.
The downloadable artifact is `linux-smoke-42876349482-1`.

This offline run does not prove a fresh live Groq topic will pass research/schema validation or fit
account quotas. Current live runs previously encountered quota/schema failures;
the controller now records and handles them, but does not guarantee content
accuracy or editorial quality. Review initial hosted outputs before scheduling.

Foreground extraction uses [rembg](https://github.com/danielgatis/rembg) with
[`isnet-general-use` from DIS](https://github.com/xuebinqin/DIS), explicitly avoiding
rembg's changing default model. See the upstream repositories for model licenses.
