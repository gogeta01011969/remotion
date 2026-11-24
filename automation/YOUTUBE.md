# Connect the Shorts pipeline to your YouTube channel

Uploads are enabled in code and fixed to private during testing. The shared settings in [youtube-settings.ts](../src/pipeline/youtube-settings.ts) control local uploads and GitHub Actions:

```ts
uploadEnabled: true,
privacy: 'private',
```

OAuth credentials and the channel ID still come from GitHub settings. No paid API or new runtime dependency is required.

## 1. Configure Google Cloud once

Use the Google Account that owns the intended channel, including the correct
Brand Account channel where applicable.

1. Select your project in [Google Cloud Console](https://console.cloud.google.com/).
2. In **APIs & Services → Library**, enable **YouTube Data API v3**.
3. Open **Google Auth Platform** and configure the app's audience/branding:
   - For an app used exclusively by the account creating it, Personal mode is an
     option during initial setup. It avoids the seven-day testing token expiry.
     It cannot later be converted to a shared app; an existing External app
     cannot be switched to Personal. See [Google's current setup guide](https://support.google.com/cloud/answer/15544987).
   - Otherwise use External, fill app/support/contact details, and add your
     Google Account as a test user during initial testing. For ongoing unattended
     use, move the app to **In production** before generating the final token.
     External Testing refresh tokens for these scopes expire after seven days;
     after changing publishing status, run the authorization command again.
     See [Google's token-expiration documentation](https://developers.google.com/identity/protocols/oauth2#expiration).
4. Under **Data Access**, add these scopes if your console requires them:
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube.readonly`
5. Under **Clients**, create an OAuth client with application type **Desktop app**.
   Download its JSON into `.automation/youtube-client.json`. This directory is
   Git-ignored. A Web application client, API key, or service-account JSON is not
   the credential expected by our helper.

The desktop flow uses a browser, a random loopback port, PKCE, and an OAuth state
check, following [Google's desktop OAuth flow](https://developers.google.com/identity/protocols/oauth2/native-app).
You do not need a public callback server or hosted UI.

## 2. Authorize locally once

From the project directory:

```sh
mkdir -p .automation
# Save the downloaded Desktop OAuth JSON as .automation/youtube-client.json.
npm run youtube:auth -- --client .automation/youtube-client.json
```

Open the printed URL in your browser. Sign in and select the exact channel you
want the pipeline to use. Grant upload and read access. The helper reads the
selected channel and stores four values in `.env.local`, preserving existing
Groq/Cloudflare settings:

```dotenv
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REFRESH_TOKEN=...
YOUTUBE_CHANNEL_ID=UC...
```

It prints the channel's name/ID, never the tokens. Confirm the channel is correct:

```sh
npm run youtube:check
```

This is read-only and uploads nothing. If it identifies the wrong channel, run
the authorization helper again with the correct account/channel selection.
Do not paste credentials into chat, commit them, or put them in workflow YAML.

## 3. Configure GitHub Actions

Open the repository's **Settings → Secrets and variables → Actions**.
Copy the three OAuth values from `.env.local` into **repository secrets**, without
surrounding quotes:

| Secret | Value |
| --- | --- |
| `YOUTUBE_CLIENT_ID` | OAuth client ID |
| `YOUTUBE_CLIENT_SECRET` | OAuth client secret |
| `YOUTUBE_REFRESH_TOKEN` | Refresh token saved by the helper |

Add **repository variables**:

| Variable | Initial value |
| --- | --- |
| `YOUTUBE_CHANNEL_ID` | The `UC...` channel ID saved by the helper |
| `YOUTUBE_MADE_FOR_KIDS` | `false` for the intended general-audience comparisons; change if your actual content is directed at children |
| `YOUTUBE_CONTAINS_SYNTHETIC_MEDIA` | `true`, because this pipeline uses realistic generated imagery |

`YOUTUBE_CHANNEL_ID` may also be a repository secret; the Actions variable takes precedence if both exist. OAuth credentials remain secrets. Environment-scoped values require a job bound to that environment; this workflow uses repository-level settings.

Every run reads the hardcoded upload settings and reports **YouTube upload configuration** in its summary. `YOUTUBE_UPLOAD_ENABLED` and `YOUTUBE_PRIVACY_STATUS` secrets/variables are no longer read and may be removed. The settings command makes no API calls and does not upload anything:

```sh
npm run youtube:upload -- --settings
```

The existing Groq/Cloudflare secrets remain required. The scheduled trigger still
uses the existing `AUTOMATION_ENABLED=true` variable; upload enablement alone does
not turn on scheduling.

## 4. Run one private test

On **Actions → Create a comparison Short → Run workflow**:

1. Branch: `main` (after the upload changes have been pushed).
2. Mode: `auto`.
3. Topic: optionally supply a broad comparison likely to support eight or more
   objects (a smaller verified subset is acceptable), or leave blank for automatic selection.
4. Leave Resume job empty for a new test.

The workflow will:

1. Check that OAuth connects to the configured channel, before generation costs.
2. Plan the topic and approximate comparison values, generate images and render/verify the Short.
3. Keep the existing final-video artifact as a fallback.
4. Prepare the title, description, sources, credits and explicit audience/privacy
   settings, then persist the upload intent to the durable ledger.
5. Upload the MP4 via one resumable session and save the returned video ID/URL.
6. Persist the outcome, then clean generated intermediates after confirmed upload.

The Actions summary includes the video link. A private video can be reviewed in
YouTube Studio by the channel owner. YouTube processing can continue after the
upload API accepts the video; this integration confirms the transfer/video ID,
not processing completion or publication availability.

Once the private test looks correct, change `privacy: 'private'` to `privacy: 'public'` in `src/pipeline/youtube-settings.ts` and push to main. Future
runs request public uploads. Existing private videos remain private; change them
in Studio if you want to publish them. YouTube recognizes eligible portrait
uploads as Shorts automatically—there is no separate Shorts upload endpoint.
See [YouTube's Shorts rules](https://support.google.com/youtube/answer/15424877).

To disable automatic uploads while keeping generation, change `uploadEnabled` to `false` in the same settings file.

## Metadata, retries and limits

- After rendering/verification, Groq writes a dedicated YouTube title, a short
  viewer-facing description, topic-specific tags and two or three hashtags.
  It uses only the final dataset: objects that actually rendered, measurement,
  values, conditions and approximation status. It cannot change the video or
  private/audience settings. Image credits, source references and the applicable
  approximation disclosure are appended by trusted code.
- The metadata stage makes at most one logical request with a 1,400-token
  completion cap, within the existing shared 12-request/65,000-token budget.
  Quota/network errors or unusable copy fall back to existing metadata rather
  than blocking a finished video. Optional fields are normalized locally.
- The Actions summary reports whether metadata was Groq-generated or a local
  fallback, along with the selected upload title.
- `youtube-metadata.json` records the copy, status, model and final-dataset
  fingerprint. It is included in the final video artifact and checkpoint.
  A matching cache (including fallback) is reused; changing the final dataset
  invalidates it. Upload preparation/dry runs only read this cache and never
  call Groq. The exact chosen metadata is frozen in the saved upload intent,
  so transfer retries cannot change titles/descriptions or create extra uploads.
- Titles aim for clear subjects, honest curiosity and recognizable search terms;
  descriptions explain the actual comparison. Tags supplement that context,
  without unrelated keywords, fake trends or unsupported record claims.
  This is presentation improvement, not a promise of views. See YouTube's
  [metadata guidance](https://support.google.com/youtube/answer/16559650) and
  [Shorts discovery guidance](https://support.google.com/youtube/answer/11914225?co=YOUTUBE._YTVideoType%3Dshorts&hl=en).
- Uploads default to private. Subscriber notifications are disabled. AI-content
  disclosure is enabled; audience settings are explicit, not inferred from topic.
- The credential token is refreshed automatically. Revocation or an expired
  Testing token requires repeating local authorization and updating GitHub's
  refresh-token secret.
- A completed job's YouTube ID/URL remains in the lightweight ledger after local
  cleanup. Uploading an already-uploaded job is a no-op.
- A short transfer interruption triggers a bounded session-status probe and
  resumes acknowledged bytes. The client never starts another `videos.insert`
  when initiation or completion is uncertain. A stale upload intent or failed
  transfer requires manual review, rather than risking duplicate videos.
- If upload fails, the workflow fails visibly and retains the existing video
  artifact/checkpoint. The generated job remains archived; the next scheduled
  trigger can create a new topic instead of repeatedly reposting the failed job.
  Inspect YouTube Studio and the recorded outcome before any manual recovery.
- Refresh tokens, access tokens and resumable session URLs are never stored in
  the public ledger, logs or generated artifacts. The ledger does contain video
  IDs/URLs and channel IDs.
- Existing fallback artifacts retain their configured 30-day retention and
  checkpoints seven days. Removing these after successful YouTube delivery is a
  separate storage-policy change; no permanent video store has been added.
- Google currently documents a default allowance of 100 `videos.insert` calls
  per day; check your project's actual quota in Cloud Console. This pipeline
  starts at most one upload session per job attempt and uses no YouTube search.
  See [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert).
- As of November 2, 2026, YouTube removed the old blanket private-only restriction
  for unverified API projects. OAuth consent/verification requirements are
  separate. See [YouTube's revision history](https://developers.google.com/youtube/v3/revision_history).

Advanced local diagnostics for a generated automation job:

```sh
npm run youtube:upload -- --job short-YOUR-JOB-ID --dry-run
```

This validates the MP4 and prints the upload metadata without contacting YouTube.
It expects local OAuth configuration from step 2. In CI, `--prepare` writes an
intent, the state-save step persists it, and only then does `--send` upload.
Do not clear upload intents to blindly retry an ambiguous run. If a video exists
in Studio, do not repost it; use its existing video ID for manual reconciliation.
