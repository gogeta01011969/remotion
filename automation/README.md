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
   and `CLOUDFLARE_API_TOKEN`. The Groq research model must support `browser_search`.
   No `.env.local` file is needed on the runner.
4. Run **Create a comparison Short → mode: auto** on the default branch.
   Leave `topic` blank for automatic selection, or supply a comparison topic.
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
2. Resume an unfinished eligible job, take a queued topic, or ask Groq for three
   feasible ideas. Candidates include a curiosity angle, measurement scope and
   proposed objects. Remaining candidates stay in the queue for later runs.
3. Check normalized titles, stable scope keys and substantially repeated object
   sets. Save the reservation remotely **before** paid generation work begins.
4. Use the existing concept → research → editorial selection → data pipeline.
   Check the researched object set against history again before making images.
5. Create per-run images with Klein 4B at four steps where required. Remove
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

## Configuration and recovery

Edit [`config.json`](config.json) to change the niche, eligible measurements,
idea-batch size, retry policy, request budget and asset provider. Default unattended
metrics are diameter, height, length, width, wingspan and volume. **Area is excluded**
until a reliable real-outline acquisition provider is connected. Existing authored
area comparisons still work. Generated cutouts approximate real objects and still
need visual review; they are not verified scans.

Quota/network failures use a 60-minute retry delay, with at most three automatic
attempts per job. A future run resumes a due job before choosing another topic.
Validation failures move to `needs-review`; an actual duplicate is skipped before
asset creation. The schedule is daily, so a one-hour delay does not itself trigger
another run. Trigger one manually to retry sooner once due.

The default budget allows at most 12 logical Groq stage requests and 65,000 reported
tokens per invocation. It stops subsequent requests once reached. These are
**not hard billing limits**: internal HTTP retries, missing usage reports, and the
last in-flight completion can consume additional quota. Image work has its own
bounded item count/provider timeout, rather than a billing cap.

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
`needs-review` job's saved error and checkpoint before explicitly resetting it in
the ledger; no automatic reset command is provided.

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

The first hosted Linux execution remains a deployment check. Offline tests do
not prove a fresh live Groq topic will pass research/schema validation or fit
account quotas. Current live runs previously encountered quota/schema failures;
the controller now records and handles them, but does not guarantee content
accuracy or editorial quality. Review initial hosted outputs before scheduling.

Foreground extraction uses [rembg](https://github.com/danielgatis/rembg) with
[`isnet-general-use` from DIS](https://github.com/xuebinqin/DIS), explicitly avoiding
rembg's changing default model. See the upstream repositories for model licenses.
