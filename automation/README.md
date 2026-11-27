# Automatic comparison Shorts on Linux

The workflow selects a topic, checks history, runs the existing comparison pipeline,
renders a narration-free MP4 with optional background music, archives the result, and cleans that job's intermediate files.
Optional YouTube upload is available after [one-time OAuth setup](YOUTUBE.md). Uploads are enabled and public in `src/pipeline/youtube-settings.ts`. Existing `compare` commands and Mac foreground
extraction remain available.

## Start on GitHub

1. Push this project, including `package-lock.json`, curated examples and their
   source assets, to a GitHub repository. Do not commit `.env.local`, `.venv`,
   `.cache`, `.automation` or `out`.
2. Run **Linux verification**, or **Create a comparison Short → mode: smoke**.
   This needs no API secrets. It typechecks, runs tests, extracts a real foreground
   using CPU inference, renders a fixed wingspan comparison, and uploads artifacts.
3. Add repository Actions secrets `GROQCLOUD_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`,
   and `CLOUDFLARE_API_TOKEN`. Comparison planning uses a compact JSON completion; no
   browsing or search API is required.
   No `.env.local` file is needed on the runner.
4. Run **Create a comparison Short → mode: auto** on the default branch.
   Leave `topic` blank for automatic selection, or supply a comparison topic.
   To retry a known job after fixing a validation failure, leave `topic` blank
   and enter its ID in `resume_job`. This explicitly resumes the saved job and
   restores its checkpoint; the existing attempt limit still applies.
5. Download the `short-<job-id>` artifact from the run. Review the MP4, thumbnail,
   render inputs, metadata, sources and available editorial/background plans.
6. After a successful hosted run, set repository Actions variable
   `AUTOMATION_ENABLED=true` to enable the weekly two/three-runs-per-day schedule. Leave it unset
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
   coverage, or ask Groq for three feasible ideas. Candidates contain a topic, measurement and curiosity rationale; local code
   assigns scheduling metadata. The next stage chooses the actual objects. Remaining
   candidates stay in the queue for later runs.
3. Check normalized titles, stable scope keys and substantially repeated object
   sets. Save the reservation remotely **before** paid generation work begins.
4. Ask Groq for one simple plan: meaningful objects, approximate values in one
   unit, appearance briefs and a related background. No mandatory research, source
   quotes or separate script/motion requests. Check the selected object set against
   history again before making images. Values are marked approximate and disclosed.
5. Require per-run Cloudflare imagery for every depicted real object, including
   familiar sports balls and planets. Missing image briefs are completed before
   rendering. Create images with Klein 4B at four steps. Remove
   backgrounds locally using the explicitly selected ISNet model, calibrate assets,
   retain the concept-linked background, and render with the shared size template.
6. Verify the actual exported file: H.264, 1080×1920, expected FPS/frame count and
   duration, with no audio track. Use one optional Groq request to write YouTube
   metadata from the final rendered objects. Save a render receipt and final
   delivery folder, including `youtube-metadata.json`.
7. Upload the finished artifact. Only a successful artifact ID changes `rendered`
   to `complete`. Persist that status, then remove this job's generated directories.

Deduplication is a practical heuristic, not a semantic guarantee. Titles are
normalized, scopes are compared within the same metric, and object sets are
rejected at ≥75% Jaccard overlap when both contain at least four items. Proposed
and selected sets are both retained. Failed/rejected topics remain in history,
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

The topic engine now explores 25 subject families: worlds, stars, sports equipment,
landmarks, infrastructure, aircraft, land vehicles, watercraft, land animals,
marine life, winged life, trees/plants, everyday objects, machines, microscopic
subjects, storage capacity, compatible cross-category comparisons, mass, population,
fixed counts, speed, durations, energy, power and temperature. These are
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

Mass, counts, speed, duration, energy, power and temperature are enabled.
Sequential vertical bars encode values with colored names below the chart and
real subject thumbnails and no duplicate focus headings. Quantity charts plan
identification cutouts through the existing cached image provider. Each subject enters individually, earlier bars remain, and the final
labelled overview includes all subjects. Quantity axes stay fixed throughout the full video;
temperature bars can extend below zero. Counts declare fixed/inventory/population scope; changing counts require
a date. Units are dimension-checked; temperature uses differences, never ratios. Geographic area still needs reliable
outline acquisition before automatic selection is enabled. Broadening topics
does not change measured size into a stand-in for another quantity.

### Run settings

Edit [`config.json`](config.json) to change the niche, eligible measurements,
idea-batch size, retry policy, request budget and asset provider. Default unattended
metrics include physical dimensions plus mass, count, speed, duration, energy,
power and temperature. **Area is excluded**
until a reliable real-outline acquisition provider is connected. Existing authored
area comparisons still work. Generated cutouts approximate real objects and still
need visual review; they are not verified scans.

Recovery is deliberately best-effort. A job gets at most three started attempts
(`maxAttemptsPerJob`), including quota deferrals and archive-only retries. Provider
clients still handle short transient errors within a call. Long quota waits save
progress and return `retry-later`; provider retry times (plus a small buffer) are
honoured, with a 60-minute fallback. Explicit resumes during active backoff make
no API calls and do not consume another attempt. Topic-selection quota failures
before reservation defer only that workflow invocation.

At the next trigger, a due job can resume within its attempt limit. A job whose
retry time is still in the future does not block selecting a fresh topic. Repeated
failures eventually become `needs-review`, and selection moves on. Unusable plans stop after bounded correction; duplicates stop before asset creation.
Optional metadata issues are repaired locally. Fewer than two usable objects or
incompatible measurement units still stop a comparison.
Failed jobs remain failed, never `complete`. No retry worker or extra schedule is
introduced: retries wait for a normal scheduled or manual trigger.

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

### Simple comparison planning

Automatic topic selection normally needs one request when the topic queue is empty; queued or explicit topics skip it. One additional request normally plans the entire video, including object appearance. After rendering, one optional request writes viewer-facing YouTube metadata from the final objects; this uses the same budget and falls back locally if unavailable. A malformed plan gets at most one correction request. Local code fills identifiers, palette, visual descriptors, pacing and layout. The existing 12-request/65,000-token run budget remains a guard against retry loops, not a target to spend. Actual provider quotas still apply.

Target 8–15 meaningful objects; a coherent smaller set is accepted (minimum two). Typical representative objects and rounded estimates are allowed. Every new estimate is marked approximate and the video description discloses that no source verification was performed. No mandatory web requests, exact quotes, source repair or evidence-ID selection remain in the default path. The optional legacy researched adapter retains its stricter evidence policy for callers explicitly choosing it.

Klein 4B at four steps creates each depicted real object; volume cubes remain local mathematical graphics. Image requests and successful assets are cached. Cutout framing and final media checks still apply. Total duration follows scale-sensitive arrivals for sizes or proportional bar growth for quantities, settled reading time and the overview. No extra narration is required.

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

The default no longer depends on live source websites. Tests cover the simple plan, optional-field normalization, approximate labeling, no-browsing behavior, source-contract compatibility, unchanged render templates and workflow lifecycle. Provider quotas/outages and generated-image likeness still require monitoring; a successful render is not a factual accuracy certificate.

Foreground extraction uses [rembg](https://github.com/danielgatis/rembg) with
[`isnet-general-use` from DIS](https://github.com/xuebinqin/DIS), explicitly avoiding
rembg's changing default model. See the upstream repositories for model licenses.

Presentation finalization runs on fresh and resumed comparisons before image preparation. Recommendations are advisory; headlines use measurement-based hooks or concise curiosity questions and quantity videos can extend to 90 seconds. Optional corrections are recorded in `quality-warnings.json`; numeric, asset-safety and valid-media requirements remain enforced. No additional AI review stage is introduced.

## Run-level resilience

A topic is an attempt, not the unit of success for the automatic workflow. `maxTopicsPerRun` defaults to three. If bounded research cannot establish two comparable measurements, structured planning cannot produce usable instructions, or the final dataset duplicates a previous video, that automatic topic is recorded as skipped and the controller tries a fresh queued candidate in the same invocation. It does not replay the skipped topic indefinitely. Old automatically selected jobs are recognized by their populated scope/object metadata; new jobs record `selectionMode` explicitly.

All topic attempts share the existing 12-request/65,000-token client; fallback never resets it. The controller starts another fresh attempt only with at least three logical requests and 16,000 accounted tokens remaining. These are work-budget guards, not editorial requirements. A replacement uses the same approximate-value policy and media checks. Explicitly entered topics remain manual: unsupported manual prompts do not silently become a different subject.

Outcomes are explicit:

| Outcome | Meaning |
| --- | --- |
| `rendered` | A verified MP4 exists for the final job and can proceed to artifact archival/upload. |
| `retry-later` / `deferred` | Quota or a transient provider problem paused work; no video is claimed. Provider quota cooldown is shared across triggers and prevents fresh selection calls until it expires. Application invocation budgets reset on the next run. |
| `no-video` | No workable topic completed within the run's topic/budget bounds; no artifact upload or YouTube upload is attempted. The next trigger can use fresh candidates. |
| Hard failure | Invalid credentials/configuration, unsafe filesystem operations, broken rendering/media verification, or an unexpected system error requiring investigation. |

`out/automation/attempts.json` and the Actions summary identify every topic tried. GitHub resolves the final job ID after generation, and uses that ID consistently for checkpointing, video artifacts, archival confirmation, YouTube intent/upload and cleanup. A missing automatic checkpoint can be abandoned in favor of a fresh topic. YouTube uploads still require a successfully verified and archived delivery and persisted upload intent.

To test automatic recovery, start a **new** `Create a comparison Short` workflow from `main`, choose `auto`, and leave both `topic` and `resume_job` blank. An explicit resume is supported but is no longer required to move past an unsuitable automatic topic. External provider outages and quotas cannot guarantee a video on every trigger; they are reported honestly rather than passed off as successful deliveries.

Cloudflare moderation refusals (`3030`) are handled per object: cache the refusal, omit that object and continue when at least two usable objects remain. No alternative prompt/model is used. The final delivery includes `asset-selection.json` and reflects only rendered objects. Authentication failures and provider-wide quotas/outages are not converted into per-object skips.

## Production storage policy

After upload and durable status persistence, all generated local job directories, delivery copies, staged/restored checkpoints and upload manifests are removed. The GitHub artifact sweeper deletes video/checkpoint artifacts for uploaded jobs. The ledger retains the YouTube ID and URL.

Failed runs have up to 72 hours of artifact recovery; only the newest checkpoint per job is retained. Diagnostics have a 24-hour window. Known pipeline artifacts target at most 128 MiB and 20 artifacts; oldest finished-run artifacts can be removed earlier to stay within that budget, so recovery is best effort. Active runs and unrelated artifacts are protected. Repository-level limits do not cover other repositories' storage. GitHub caches retain their platform-managed eviction policy.

The end-of-run sweep and **Pipeline storage cleanup** workflow (daily and after generation/verification workflows finish) use `actions: write`. The maintenance workflow also runs on relevant code pushes for one-time cleanup. Maintenance is serialized separately so it cannot replace queued generation triggers; active generation artifacts are protected through the run-status API. It deletes at most 200 artifacts per invocation; larger backlogs continue on subsequent sweeps. Existing source fixtures, branding, credentials and durable history are preserved. Terminal history is bounded to 200 jobs and a 512 KiB target; pending work and unresolved upload intents are kept. Older terminal topics may eventually become eligible again. Git commit history is not rewritten.

The production video schedule uses a weekly 2/3/2/3/2/3/2 pattern: 17 scheduled runs per week and at most three per IST day. It is enabled by the existing `AUTOMATION_ENABLED=true` repository variable. GitHub cron expressions are UTC; the table below is IST. Manual `auto` runs are available independently and consume additional quota. The storage maintenance schedule runs daily regardless of generation enablement.

| Day | Runs | IST times |
| --- | --- | --- |
| Monday | 2 | 08:00, 20:00 |
| Tuesday | 3 | 07:00, 14:00, 21:00 |
| Wednesday | 2 | 10:00, 22:00 |
| Thursday | 3 | 09:00, 16:00, 23:00 |
| Friday | 2 | 11:00, 19:00 |
| Saturday | 3 | 08:00, 13:00, 18:00 |
| Sunday | 2 | 12:00, 21:00 |

This calendar pattern repeats each week, so Sunday and the following Monday both have two runs. Scheduled runs are at least five hours apart. GitHub can delay scheduled workflow starts; these are requested times rather than exact publication guarantees.

Topic-policy version 2 discards older queued suggestions once, while preserving posted-topic history and in-progress jobs. Newly generated ideas and objects prioritize familiar, relatable comparisons for a general audience.


## Background audio rollout and cleanup

Background music is enabled by default for scheduled/public comparison runs. The switch lives in `src/pipeline/comparison-audio-settings.ts`; no new secret, workflow input, paid service or model call is needed. One of the 12 bundled tracks is selected deterministically per run ID. Local `compare --soundtrack off` runs can explicitly disable music. See `comparisons/README.md` for preview commands and mixing policy.

Audio belongs to the existing per-job directories: the plan in `out/shorts/<id>/`, the prepared WAV in `public/shorts/<id>/`, and AAC inside the delivered MP4. Render receipts hash the waveform and plan, in addition to source/settings/assets, so changed soundtracks invalidate cached renders. The normal checkpoint and post-delivery cleanup paths include those directories. Bundled source music under `public/assets/audio/` is a fixed reusable library, not growing per-run storage. Temporary raw audio is removed after mixing, including on failure. Optional audio preparation errors export a muted video. Failed background-audio attachment or audio verification retries the final export without sound, clears the audio declaration/credit and allows upload. Final picture/media failures still stop the run; required narration in legacy narrated jobs is not silently dropped.
