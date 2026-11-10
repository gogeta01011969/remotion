# GroqCloud topic-to-video automation

The application is callable without a UI. It uses separate research, script, and motion-planning stages on GroqCloud, followed by local Remotion and FFmpeg rendering. New jobs default to silent visual stories.

## Output mode

New `generate` jobs default to `--presentation silent`. The script stage writes concise on-screen notes and visual evidence, not a voice-over. Motion planning must visibly label subjects, conditions and results. Silent exports contain no audio track; no macOS voice or speech service is required. Reading/action timing replaces speech measurement. Use `--presentation narrated` explicitly for the optional older voice workflow.

Saved jobs without a presentation field retain narrated behavior when resumed. Authored legacy briefs without the field also remain narrated; new silent briefs explicitly contain `presentation: "silent"`. To convert an existing narrated job, create a new adaptation with `--presentation silent`; changing presentation in place on resume is rejected. Sections below describing voice adapters, word budgets, speech delivery and Hindi pronunciation apply to **narrated mode**. Silent scripts instead use at most two short notes per scene, each no longer than 12 words; attribution must be visible on screen.

The comparison workflow uses a separate validated data/visual-story contract; see [silent comparisons](comparisons/README.md). New topic runs use concept proposals → research → editorial item selection → assets → shared zoom template → local render. The selected viewer question, opening reference, contrasts and payoff travel with the dataset into its writing brief. `compare --ideas-only` previews provisional concepts without research, images or rendering. Existing curated datasets continue to work. Editorial choices remain hypotheses until videos are reviewed and audience performance is measured.

## GitHub Actions automation

Linux workflows now cover automatic topic selection, duplicate checks, durable
history, checkpoint recovery, CPU image cutouts, rendering, artifact archival and
cleanup. YouTube integration is deferred.

See [the Linux automation guide](automation/README.md) for repository setup,
secrets, scheduling, local commands, recovery rules and current limits. The main
workflow is [Create a comparison Short](.github/workflows/create-short.yml); its
`smoke` mode runs without API credentials. Production generation is opt-in and
runs on Ubuntu 24.04. Existing local comparison commands remain supported.

The repository is now connected, and [the first hosted Linux verification](https://github.com/gogeta01011969/remotion/actions/runs/42876349482)
passed dependency setup, tests, CPU foreground extraction, offline rendering and
artifact upload. Full automatic generation still needs its three Actions secrets
and a live validation run. A successful render/archive is
not a YouTube upload. Fresh live research remains subject to validation and API
quotas; the workflows preserve failures and defer retries rather than claiming
those jobs succeeded.

## Content profiles

The controller selects a content profile before research. The stages remain research → script → motion → local render. A `What if` opening selects `what-if`; recognized mythological names and terms select `mythology`; other topics select `explainer`. This is a conservative keyword heuristic, not an AI classifier. Use `--genre what-if|mythology|explainer` to override ambiguous prompts. The selected genre is saved in request, render props, and status. Change genre by creating a new job, so research for one profile cannot silently leak into another. Older jobs/briefs default to `what-if`.

```sh
npm run generate -- --topic "Why does Lord Shiva wear a crescent moon?" --id shiva-story
npm run generate -- --topic "The meaning of an ancient symbol" --genre mythology --id symbol-story
```

Mythology has its own research and writing briefs: research one attributed traditional account and its variants; write a direct curiosity hook, conflict, turning point, and resolution/meaning. No mandatory What if question, physics experiment, science hashtags, or thought-experiment branding. Narration must include story/tradition attribution. The target is 85–100 words (75–105 accepted to avoid padding a concise story); measured narration still controls the enforced 30–45-second duration. These checks establish structure, not a guarantee of historical accuracy or editorial quality.

The motion director can select a reusable `symbolic-story` module: `moon`, `flame`, or `lotus`; `shiva`, `sanctuary`, or `none` as guardian; and `reveal`, `diminish`, `approach`, `protect`, `renew` actions. It uses continuous poses and local SVG illustrations with a real lunar mask. The Shiva icon is only available for stories explicitly about Shiva. Other stories may use a generic protective arch or the existing actor planner; this is a small visual library, not an illustration system for every tradition. No arbitrary React or generated still assets are required.

The current rebuilt example is `out/shorts/shiva-crescent-story/shiva-crescent-story.mp4`. Preview its measured props with:

```sh
npm run dev -- --props=public/shorts/shiva-crescent-story/video.json
```

## Configure

Put the key in `.env.local`:

```dotenv
GROQCLOUD_API_KEY=your-key
```

The file is Git-ignored. The Node entry point reads it; the key is not placed in prompts, job metadata, logs, public assets, or renderer props. The renderer subprocess is launched without the Groq key environment variables. `.env.example` contains optional per-stage model overrides:

```dotenv
GROQ_RESEARCH_MODEL=openai/gpt-oss-120b
GROQ_SCRIPT_MODEL=openai/gpt-oss-120b
GROQ_MOTION_MODEL=openai/gpt-oss-120b
```

These are models hosted by **GroqCloud**, using its endpoint and key. No Gemini or OpenAI API credentials are used. Default model availability was checked against the configured Groq account. The research model must support Groq's `browser_search` tool; text-only models cannot serve as a silent research fallback.

Requires Node.js 20.12+ (native environment-file loader), installed project dependencies, FFmpeg/FFprobe, and macOS `say`. The current local speech voice is Daniel. AI planning needs internet access and uses the account's Groq quotas/billing; the media stages remain local.

## Trigger

```sh
npm run generate -- --topic "What if gravity near Earth's surface were half as strong?"

# Choose a unique ID for automation and resume
npm run generate -- --topic "What if Earth stopped rotating?" --id earth-run-001

# Generate and validate the plan without synthesizing/rendering
npm run generate -- --topic "What if gravity were half as strong?" --id gravity-plan --plan-only

# Resume that job through MP4 export
npm run generate -- --resume gravity-plan

# Regenerate a stage and everything after it; archive the previous attempts
npm run generate -- --resume gravity-plan --restart-from script

# Apply editorial feedback through the same pipeline
npm run generate -- --resume gravity-plan --restart-from script --feedback "Use a short hook and a fair comparison. Remove unsupported claims."

# Explicitly change models when the configured model's quota is unavailable
npm run generate -- --resume gravity-plan --restart-from script --script-model qwen/qwen3.8-27b --motion-model qwen/qwen3.8-27b
```

A job ID cannot overwrite an existing job or authored-plan output. Use `--resume` to continue an existing job. A resumed job uses its saved topic and model selections, with the current API key. It validates cached stage outputs before reuse. Saved per-scene motion chunks include an input hash; if their script or previous object states change, start a new job instead of silently reusing incompatible choreography.

`--restart-from research|script|motion|render` deliberately regenerates that stage and downstream stages. Prior JSON/log artifacts move into the job's `history/` directory. Run only one process per job ID at a time. Stage invalidation leaves existing media in place; a subsequent render can replace them.

For a scheduler or another automation process, suppress npm's own banners:

```sh
npm run --silent generate -- --topic "What if gravity were half as strong?" > result.json
```

Progress goes to **stderr**. The final success or failure is one JSON object on **stdout**; failures exit nonzero. Stage failures include `jobId`, `stage`, `jobDir`, and `resumeCommand` alongside the error. Direct invocation also works:

```sh
node --import tsx scripts/generate-short.ts --topic "What if gravity were half as strong?"
```

Example success:

```json
{"ok":true,"jobId":"job-example","jobDir":"/project/out/jobs/job-example","briefPath":"/project/out/jobs/job-example/brief.json","videoPath":"/project/out/shorts/job-example/job-example.mp4","plannedOnly":false}
```

The TypeScript function `generateShort()` in `src/pipeline/workflow.ts` is also importable. It accepts a topic, optional ID, root directory, plan-only flag, resume ID, and a progress callback, and resolves with the same result object.

## Stages

1. **Research:** uses actual Groq browser search and opens source pages. The response is rejected unless tool metadata records a search and at least two distinct opened source pages. Source URLs come from tool results, not model-invented links. The selected profile determines the evidence brief: controlled assumptions/consequences for hypotheticals, attributed accounts/variants for mythology, or a sourced explanation for other topics.
2. **Script:** receives research notes and source IDs. It generates 85–105 spoken words across 4–6 scenes, short cues, assumptions, visual intentions, and a description. Validation checks lengths and source references.
3. **Motion plan:** first selects visual direction. Supported mechanics stories use reusable comparison modules: the model chooses force/fall/launch mechanisms, gravity ratio, labels, headings and whether to emphasize height or airtime. The local compiler supplies reliable layout and narration-anchored progress; the renderer calculates the actual mechanics. Other subjects use the shared-cast and per-scene actor planner. Runtime checks reject unknown actors/properties, unsupported initial states, invalid anchors, missing subject motion, and collisions after preview frame rounding. Approved narration and titles are assembled by the controller and cannot be rewritten by the scene planner.
4. **Local production:** the validated brief is passed to the existing `build-short.ts` command. It synthesizes narration, resolves actual timing, compiles motion, renders, mixes/normalizes sound, and exports the MP4. FFprobe verifies dimensions, streams, and duration.

Groq browser search and structured output are separate requests. The script stage uses a strict provider schema to enforce the data shape; cast/direction/scene stages use JSON mode for their more flexible unions. All stages still pass full local Zod and semantic validation. See [Groq browser search](https://console.groq.com/docs/tool-use/built-in-tools/browser-search) and [output formats](https://console.groq.com/docs/structured-outputs).

The script brief now favors a short opening question, an immediate visible action, a small chain of everyday consequences, and a closing payoff. It avoids technical assumptions in the hook, formulas in narration, unrelated orbital/medical detours and unsupported absolute feats. Editorial `--feedback` is passed as an explicit final writing instruction and saved with the job. The previous draft is retained for revision; narration is also exported as `script.txt` for easy review. Validation feedback includes the measured word count so a short draft can be expanded instead of repeatedly regenerated from scratch.

## Saved artifacts and failures

Each job lives in `out/jobs/<id>/`:

- `request.json`: topic, provider, creation time, model selections; no credentials.
- `research.json`: notes and actual opened-source URLs.
- `script.json`: validated narration, assumptions, visual intentions, source references.
- `script.txt`: the same narration in a readable scene-by-scene format.
- `motion-direction.json`: selected visual grammar and its typed parameters.
- `motion-cast.json`, `motion-scene-NN.json`: validated motion checkpoints.
- `brief.json`: complete renderer-compatible storyboard.
- `status.json`: active stage, completed stages, status, and errors/resume command.
- Stage attempt/validation files: provider output, usage metadata, tool evidence, and local errors.
- `render.log`: local production progress.

Final media and supporting assets live in `out/shorts/<id>/`, as documented in [SHORTS.md](SHORTS.md). Preview generated inputs using:

```sh
npx remotion studio src/index.ts --props=public/shorts/<id>/video.json
```

Transient HTTP/network failures have bounded retries; rate-limit waits respect `Retry-After` up to 60 seconds. Longer waits or exhausted attempts fail with a resume command. Invalid research gets at most two attempts; invalid script/cast/scene JSON gets at most three attempts with local validation feedback. Completed stages and scene chunks are reused on resume. No unbounded correction loops or automatic paid-tier upgrades occur.

Source-access checks establish that browsing happened, not that every generated claim is true. Schema validation establishes supported choreography, not audience engagement. The visual vocabulary is still limited; unsupported topics may fail clearly. Publishing and YouTube credentials remain outside this workflow.

## Verify

```sh
npm run typecheck
npm test
```

Tests run without API calls. They cover research evidence, script source references, unchanged narration, rate-limit retries, credential redaction, bounded model correction, ordered stages, and cache/resume behavior, alongside the existing motion and timeline tests. Live integration is verified separately with an actual Groq-generated video.

Provider constrained-JSON decoder failures are retried in JSON-object mode within the same three-attempt limit. Runtime schema, source-ID, genre and narration checks still run; invalid JSON or an invalid script never proceeds to motion. This recovery does not bypass API quotas or silently change providers/models.


## Timed five-part Shorts

A structure file supplies exact section durations and an optional verbatim hook. The Om example follows 0–3 Hook, 3–12 Mystery, 12–40 Explanation, 40–55 Payoff, 55–60 Ending:

```sh
npm run generate -- --topic "Why is the Om symbol considered sacred?" --genre mythology --structure shorts/structures/sacred-symbol-60.json --id my-om-short
```

The structure is saved with the job and propagated through the script, brief, prepared props and render. One script scene corresponds to each beat. Narration length/cue counts are budgeted per section; longer explanations receive more content. Script corrections use the requested duration rather than the old 96-word target. The renderer measures speech, removes only outer silence for timed narration, and adjusts a section's speech rate when needed (bounded at 260 wpm). It rejects overflow instead of cutting speech or moving a boundary. Pauses use the remaining section time. `timing-report.json` records section starts, durations, measured speech and rates.

Timed structures may total 30–60 seconds. Videos without a structure retain the existing 30–45-second timing contract. Use a new job when changing structure. `endWithQuestion: true` requests a closing question.

For Om, the director selects the reusable `sacred-symbol` renderer. It loads the bundled Devanagari font, reveals the glyph, illustrates sound ripples, maps A/U/M to sourced meaning labels, and settles into a quiet payoff. Each association references its narration cue, so highlighting follows measured speech. The glyph's curves are not presented as phonetic parts or scientific measurements. The ambient bed drops out during the `silence` section; mythology uses a soft score without the science video's regular beat or transition hits.

The generated example is `out/shorts/om-sacred-60/om-sacred-60.mp4`. Preview with `npm run dev -- --props=public/shorts/om-sacred-60/video.json`.


## Hindi and existing-video adaptations

`--language en|hi|hinglish` selects the writing language, local speech voice and render locale. English remains the default; older jobs and briefs default to English. Hindi uses the installed macOS `Lekha` voice, language-aware narration budgets, shared local Devanagari font loading, and cue anchors for अ/आ, उ/ऊ and म/म्. The display glyph ॐ is normalized to ओम only for speech. Hindi timed speech is capped at 210 wpm; an overflowing section must be rewritten rather than truncated.

```sh
# Adapt the approved source topic and research, preserving its beat durations
npm run generate -- --adapt-from om-sacred-60 --language hi --id my-hindi-om

# Or generate a new topic directly in Hindi
npm run generate -- --topic "Why is Om considered sacred?" --genre mythology --language hi --structure shorts/structures/sacred-symbol-60-hi.json --id new-hindi-om
```

`--adapt-from` creates a separate job. It validates and reuses the source research, supplies the approved source narration to the writer, and saves `adaptation.json` and `source-script.json`. The original job is not modified. An English verbatim hook is cleared when the target language changes; an explicit target-language structure may supply its own hook. Language changes on `--resume` require a new adaptation job, so cached English narration cannot be silently read by a Hindi voice.

The Om renderer has Hindi headings, associations, reference labels and fixed copy; captions also use the bundled font and Hindi line spacing. Other visual modules may still have fixed English copy requiring further localization. Independent caption/narration language controls are not implemented; Hinglish is a dedicated combined profile described below. Translation still needs editorial review: the first Hindi Om run required grammar and philosophical-terminology corrections, recorded in `editorial-review.json`.

The reviewed Hindi output is `out/shorts/om-sacred-hi-60/om-sacred-hi-60.mp4`; its measured timing is in `timing-report.json`. Preview it using `npm run dev -- --props=public/shorts/om-sacred-hi-60/video.json`.


## Conversational Hinglish

```sh
npm run generate -- --adapt-from om-sacred-60 --language hinglish --id my-hinglish-om
```

Hinglish uses conversational Hindi-English code-switching with Roman-script display captions and short English/Hinglish labels. Each script scene also provides `spokenCues`: a pronunciation-ready Devanagari transcription of the same Hindi and borrowed English words for the single local Lekha voice. For example, display `Om ko sacred kyun kehte hain?` while speech reads `ओम को सेक्रेड क्यों कहते हैं?`. This avoids asking a Hindi voice to infer Roman Hindi spelling. It does not translate the borrowed English terms into formal Hindi.

The two arrays must match in count and order, and motion planning must preserve both verbatim. Timing is measured from `spokenCues`; captions retain `cues`. The fields are optional for older English/Hindi briefs and required by the Hinglish script validator. No external speech service or arbitrary code is needed. Check pronunciation and semantic equivalence during editorial review.

The reviewed comparison output is `out/shorts/om-sacred-hinglish-60/om-sacred-hinglish-60.mp4`, keeping the original 60-second structure. Preview with `npm run dev -- --props=public/shorts/om-sacred-hinglish-60/video.json`.

Timed scripts use JSON-object mode with local validation because title-specific scene schemas repeatedly triggered provider decoder failures. Non-timed scripts retain constrained JSON with the existing fallback. Both paths use the same bounded correction and semantic-validation rules.


## Editorial delivery and phrase captions

`--caption-mode sentence|phrase` is saved with a new job (default `sentence` for compatibility). Phrase mode displays short groups within each measured parent narration cue. Timing is estimated from the displayed words inside that measured audio interval; it is not word-level forced alignment. Parent cues stay intact, so motion anchors still refer to the original script cue indices. Exported SRT entries match the displayed phrases.

Each script scene may include a `delivery` object:

```json
{"rates":[155,158,155],"pausesAfterMs":[1800,120,100],"maxEndHoldMs":2000}
```

Arrays correspond one-to-one with narration cues. Rates are 130–210 wpm, pauses 0–2000 ms, and maximum final hold 0–3000 ms. The script and motion contracts preserve these settings together with caption and speech text. For timed beats, explicit delivery is measured and enforced: overflow is rejected rather than automatically accelerated, and excessive unplanned end holds are rejected. Ordinary clips without delivery retain their existing fitting behavior. For untimed scenes, declared rates and pauses determine the scene length, subject to the usual total-duration checks.

The reusable writing guidance now prioritizes a specific opening, familiar examples, progression without repeated definitions, an earned payoff and an ending connected to the hook. These are editorial instructions, not a guarantee of audience retention. The voice is still local macOS speech; the controls improve cadence and pauses rather than providing a new expressive voice model.

The reviewed version `out/shorts/om-hinglish-retention/om-hinglish-retention.mp4` uses a listening challenge and a brief deliberate silence in the payoff. Its original Hinglish comparison remains at `out/shorts/om-sacred-hinglish-60/om-sacred-hinglish-60.mp4`. The new `timing-report.json` includes per-cue rates and a directed-delivery flag. See the new job's `script.json` for actual cue-level delivery settings.
