import {createHash, randomUUID} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {z} from 'zod';
import {briefSchema, type Brief} from '../shorts/schema';
import {previewInput} from '../shorts/defaults';
import {compileStory} from '../shorts/motion';
import {GroqClient, loadGroqConfig, redact} from './groq';
import {researchSchema, scriptSchemaFor, validateScript, type Research, type Script} from './contracts';
import {researchFromCompletion} from './research';
import {motionSystem, researchInput, promptsFor} from './prompts';
import {structuredStage, completionRecord, writeJson} from './stages';
import {languageSchema, voiceFor, type Language} from '../shorts/locale';
import {captionModeSchema} from '../shorts/delivery';
import {presentationSchema,type Presentation} from '../shorts/presentation';
import {structureSchema, type Structure} from '../shorts/structure';
import {planMotion} from './plan-motion';
import {detectGenre, genreSchema, presentations, type Genre} from '../shorts/genres';

const motionOutputSchema = z.object({actors: briefSchema.shape.actors, scenes: briefSchema.shape.scenes}).strict();
const jobIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60);
const requestSchema = z.object({id: jobIdSchema, topic: z.string().min(5).max(200), presentation:presentationSchema.default('narrated'), language: languageSchema.default('en'), captionMode: captionModeSchema.default('sentence'), adaptFrom: jobIdSchema.optional(), structure: structureSchema.optional(), genre: genreSchema.default('what-if'), feedback: z.string().max(2500).default(''), provider: z.literal('groq'), createdAt: z.string(), models: z.object({research: z.string(), script: z.string(), motion: z.string()})}).strict();
type JobRequest = z.infer<typeof requestSchema>;
type Stage = 'research' | 'script' | 'motion' | 'render';
export type GenerateOptions = {presentation?:Presentation; captionMode?: 'sentence' | 'phrase'; language?: Language; adaptFrom?: string; structure?: Structure; genre?: Genre; topic?: string; id?: string; resume?: string; restartFrom?: Stage; feedback?: string; models?: Partial<{research: string; script: string; motion: string}>; planOnly?: boolean; root?: string; log?: (line: string) => void};
export type GenerateResult = {ok: true; jobId: string; jobDir: string; briefPath: string; videoPath: string | null; plannedOnly: boolean};
export class GenerationError extends Error {
  constructor(public readonly jobId: string, public readonly stage: Stage, public readonly jobDir: string, message: string) {super(message); this.name = 'GenerationError';}
}

export function validateMotion(raw: unknown, script: Script, research: Research, request: {id: string; topic: string; genre?: Genre; structure?: Structure; language?: Language; captionMode?: 'sentence' | 'phrase';presentation?:Presentation}): Brief {
  const motion = motionOutputSchema.parse(raw);
  if (request.genre === 'mythology' && motion.actors.some(a => a.kind === 'comparison')) throw new Error('Mythology cannot use a gravity-comparison renderer.');
  if (motion.scenes.length !== script.scenes.length || motion.scenes.some((s, i) => s.title !== script.scenes[i].title || JSON.stringify(s.cues) !== JSON.stringify(script.scenes[i].cues) || JSON.stringify(s.spokenCues ?? null) !== JSON.stringify(script.scenes[i].spokenCues ?? null) || JSON.stringify(s.delivery ?? null) !== JSON.stringify(script.scenes[i].delivery ?? null))) {
    throw new Error('Motion planning must preserve every approved scene title and narration cue verbatim, in the same order.');
  }
  const brief = briefSchema.parse({
    ...motion, presentation:request.presentation??'narrated', captionMode: request.captionMode ?? 'sentence', language: request.language ?? 'en', structure: request.structure, genre: request.genre ?? 'what-if', schemaVersion: 2, id: request.id, topic: request.topic, voice: voiceFor(request.language ?? 'en'), wordsPerMinute: request.language && request.language !== 'en' ? 160 : 172, seed: 42, accent: presentations[request.genre ?? 'what-if'].accent,
    sources: research.sources.map(({title, url}) => ({title, url})),
    description: `${script.description}\n\nAssumptions: ${script.assumptions.join(' ')}${motion.actors.some(a => a.kind === 'comparison') ? ' Comparison demonstrations use ideal mechanics, ignore air resistance, and keep the initial conditions identical.' : ''}\n\n${presentations[request.genre ?? 'what-if'].tags}`,
  });
  compileStory(previewInput(brief));
  return brief;
}
async function runRenderer(root: string, briefPath: string, logPath: string, log: (line: string) => void) {
  const env = {...process.env}; delete env.GROQCLOUD_API_KEY; delete env.GROQ_API_KEY;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', path.join(root, 'scripts', 'build-short.ts'), briefPath], {cwd: root, env, stdio: ['ignore', 'pipe', 'pipe']});
    let tail = '';
    writeFileSync(logPath, '');
    const receive = (chunk: Buffer) => {
      const value = chunk.toString(); tail = (tail + value).slice(-5000);
      writeFileSync(logPath, value, {flag: 'a'}); log(value.trimEnd());
    };
    child.stdout.on('data', receive); child.stderr.on('data', receive);
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`Local renderer exited ${code}. ${tail}`)));
  });
}

export async function generateShort(options: GenerateOptions, dependencies: {
  config?: ReturnType<typeof loadGroqConfig>; client?: Pick<GroqClient, 'chat'>; renderer?: typeof runRenderer;
} = {}): Promise<GenerateResult> {
  const root = path.resolve(options.root ?? process.cwd());
  const log = options.log ?? (line => process.stderr.write(`${line}\n`));
  const config = dependencies.config ?? loadGroqConfig(path.join(root, '.env.local'));
  const client = dependencies.client ?? new GroqClient({apiKey: config.apiKey, onRetry: log});
  const jobs = path.join(root, 'out', 'jobs'); mkdirSync(jobs, {recursive: true});
  const id = jobIdSchema.parse(options.resume ?? options.id ?? `job-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`);
  const directory = path.join(jobs, id);
  if (options.restartFrom && !options.resume) throw new Error('--restart-from requires --resume.');
  if (options.resume && options.adaptFrom) throw new Error('Use --adapt-from for a new job, not with --resume.');
  let request: JobRequest;
  let previousScript: unknown;
  if (options.resume) {
    request = requestSchema.parse(JSON.parse(readFileSync(path.join(directory, 'request.json'), 'utf8')));
    if (request.id !== id || options.topic && options.topic !== request.topic) throw new Error('Resume topic/job ID does not match the saved request.');
    if(options.presentation&&options.presentation!==request.presentation)throw new Error('Changing presentation requires a new adaptation job.');
    if (options.captionMode && options.captionMode !== request.captionMode) throw new Error('Changing caption mode requires a new adaptation job.');
    if (options.language && options.language !== request.language) throw new Error('Changing language requires a new adaptation job.');
    if (options.structure && JSON.stringify(options.structure) !== JSON.stringify(request.structure)) throw new Error('Changing timed structure requires a new job.');
    if (options.genre && options.genre !== request.genre) throw new Error('Changing genre requires a new job so old research and narration are not reused.');
    if (options.feedback !== undefined) {
      if (!['research', 'script'].includes(options.restartFrom ?? '')) throw new Error('Editorial feedback requires restarting from script or research.');
      const savedScript = path.join(directory, 'script.json');
      if (existsSync(savedScript)) previousScript = JSON.parse(readFileSync(savedScript, 'utf8'));
      if (previousScript) writeJson(path.join(directory, 'revision-draft.json'), previousScript);
      request = requestSchema.parse({...request, feedback: options.feedback});
      writeJson(path.join(directory, 'request.json'), request);
    }
    if (options.models && !options.restartFrom) throw new Error('Changing saved models requires --restart-from.');
    if (options.models) {
      const allowed = options.restartFrom === 'research' ? ['research', 'script', 'motion'] : options.restartFrom === 'script' ? ['script', 'motion'] : options.restartFrom === 'motion' ? ['motion'] : [];
      if (Object.keys(options.models).some(stage => !allowed.includes(stage))) throw new Error('A model override targets a completed stage. Restart from that stage or earlier.');
      request = requestSchema.parse({...request, models: {...request.models, ...options.models}});
      writeJson(path.join(directory, 'request.json'), request);
    }
  } else {
    const sourceDir = options.adaptFrom ? path.join(jobs, jobIdSchema.parse(options.adaptFrom)) : null;
    const sourceRequest = sourceDir ? requestSchema.parse(JSON.parse(readFileSync(path.join(sourceDir, 'request.json'), 'utf8'))) : null;
    if (sourceRequest && options.topic && sourceRequest.topic !== options.topic) throw new Error('An adaptation must retain its source topic.');
    const topic = options.topic ?? sourceRequest?.topic;
    const language = options.language ?? sourceRequest?.language ?? 'en';
    const structure = options.structure ?? (sourceRequest?.structure ? {...sourceRequest.structure, hook: language === sourceRequest.language ? sourceRequest.structure.hook : undefined} : undefined);
    request = requestSchema.parse({id, topic, language, presentation:options.presentation??'silent', captionMode: options.captionMode ?? sourceRequest?.captionMode ?? 'sentence', adaptFrom: options.adaptFrom, structure, genre: options.genre ?? sourceRequest?.genre ?? detectGenre(topic ?? ''), feedback: options.feedback ?? '', provider: 'groq', createdAt: new Date().toISOString(), models: {research: config.researchModel, script: config.scriptModel, motion: config.motionModel, ...options.models}});
    if (existsSync(directory) || existsSync(path.join(root, 'out', 'shorts', id))) throw new Error('Job ID already exists. Use --resume or a new --id.');
    mkdirSync(directory); writeJson(path.join(directory, 'request.json'), request);
    if (sourceDir && sourceRequest) {
      const sourceResearch = researchSchema.parse(JSON.parse(readFileSync(path.join(sourceDir, 'research.json'), 'utf8')));
      if (sourceResearch.topic !== request.topic) throw new Error('Source research topic does not match adaptation.');
      const sourceScript = validateScript(JSON.parse(readFileSync(path.join(sourceDir, 'script.json'), 'utf8')), sourceResearch, sourceRequest.genre, sourceRequest.structure, sourceRequest.language, sourceRequest.presentation);
      writeJson(path.join(directory, 'research.json'), sourceResearch);
      writeJson(path.join(directory, 'source-script.json'), sourceScript);
      writeJson(path.join(directory, 'adaptation.json'), {sourceJob: sourceRequest.id, sourceLanguage: sourceRequest.language, targetLanguage: language});
    }
  }
  if (options.restartFrom) {
    const prefixes = {research: ['research', 'script', 'motion', 'brief', 'render.log'], script: ['script', 'motion', 'brief', 'render.log'], motion: ['motion', 'brief', 'render.log'], render: ['render.log']}[options.restartFrom];
    const archive = path.join(directory, 'history', `${Date.now()}-${randomUUID().slice(0, 8)}`);
    const files = readdirSync(directory).filter(name => prefixes.some(prefix => name.startsWith(prefix)));
    if (files.length) {mkdirSync(archive, {recursive: true}); files.forEach(name => renameSync(path.join(directory, name), path.join(archive, name)));}
    log(`Restarting from ${options.restartFrom}; prior stage artifacts archived.`);
  }
  const prompts = promptsFor(request.genre, request.structure, request.language, request.presentation);
  const fingerprint = createHash('sha256').update(prompts.research + prompts.script + motionSystem(path.join(root, 'shorts', 'PLANNER.md'))).digest('hex');
  const statusPath = path.join(directory, 'status.json');
  const completed: Stage[] = [];
  let stage: Stage = 'research';
  const update = (status: string, extra: Record<string, unknown> = {}) => writeJson(statusPath, {jobId: id, provider: 'groq', genre: request.genre, language: request.language, status, stage, completedStages: completed, updatedAt: new Date().toISOString(), promptFingerprint: fingerprint, ...extra});
  const researchPath = path.join(directory, 'research.json');
  const scriptPath = path.join(directory, 'script.json');
  const briefPath = path.join(directory, 'brief.json');
  if (!previousScript && request.feedback && existsSync(path.join(directory, 'revision-draft.json'))) previousScript = JSON.parse(readFileSync(path.join(directory, 'revision-draft.json'), 'utf8'));
  const videoPath = path.join(root, 'out', 'shorts', id, `${id}.mp4`);
  try {
    update('running'); log(`Job ${id} [${request.genre}]: ${request.topic}`);
    let research: Research;
    if (existsSync(researchPath)) {research = researchSchema.parse(JSON.parse(readFileSync(researchPath, 'utf8'))); log('research: reused saved browser research');}
    else {
      let problem = '';
      let result: Research | undefined;
      for (let attempt = 1; attempt <= 2; attempt++) {
        log(`research: browser search ${attempt}/2 (${request.models.research})`);
        const completion = await client.chat({
          model: request.models.research, messages: [{role: 'system', content: prompts.research}, {role: 'user', content: `Topic: ${request.topic}\nResearch the topic for genre ${request.genre}, following its narrative/evidence requirements. Open at least TWO reliable pages, not only search results.${problem ? `\nPrevious attempt was insufficient: ${problem}` : ''}`}],
          tools: [{type: 'browser_search'}], tool_choice: 'required', reasoning_effort: 'medium', max_completion_tokens: 6500, temperature: 0.3,
        });
        writeJson(path.join(directory, `research-attempt-${attempt}.json`), {...completionRecord(completion), tools: completion.choices?.[0]?.message?.executed_tools});
        try {result = researchFromCompletion(request.topic, request.models.research, completion); break;} catch (error) {problem = error instanceof Error ? error.message : 'Research validation failed';}
      }
      if (!result) throw new Error(`Research failed after two attempts: ${problem}`);
      research = result; writeJson(researchPath, research);
    }
    if (research.topic !== request.topic) throw new Error('Cached research topic does not match this job.');
    completed.push('research'); stage = 'script'; update('running');
    const sourceScriptPath = path.join(directory, 'source-script.json');
    const sourceScript: Script | undefined = existsSync(sourceScriptPath) ? JSON.parse(readFileSync(sourceScriptPath, 'utf8')) : undefined;
    const sourceScriptInput = sourceScript ? {title: sourceScript.title, throughline: sourceScript.throughline, scenes: sourceScript.scenes.map(({title, cues, spokenCues, sourceIds}) => ({title, cues, spokenCues, sourceIds}))} : undefined;
    const script = existsSync(scriptPath)
      ? validateScript(JSON.parse(readFileSync(scriptPath, 'utf8')), research, request.genre, request.structure, request.language, request.presentation)
      : await structuredStage({stage, model: request.models.script, client, schema: scriptSchemaFor(request.genre, request.structure, request.language, request.presentation), system: prompts.script, input: JSON.stringify({...JSON.parse(researchInput(research)), structure: request.structure, language: request.language, presentation:request.presentation, sourceScript: sourceScriptInput, editorialFeedback: request.feedback, previousDraft: request.structure ? undefined : previousScript}), validate: raw => validateScript(raw, research, request.genre, request.structure, request.language, request.presentation), directory, log});
    writeJson(scriptPath, script); completed.push('script'); stage = 'motion'; update('running');
    writeFileSync(path.join(directory, 'script.txt'), `${script.title}\n\n${script.scenes.map(s => `${s.title}\n${s.cues.join(' ')}`).join('\n\n')}\n`);
    const cached = existsSync(briefPath) ? briefSchema.parse(JSON.parse(readFileSync(briefPath, 'utf8'))) : null;
    if (cached && (cached.id !== request.id || cached.topic !== request.topic)) throw new Error('Cached motion plan does not match this job.');
    const brief = cached
      ? validateMotion({actors: cached.actors, scenes: cached.scenes}, script, research, request)
      : validateMotion(await planMotion({script, research, presentation:request.presentation, language: request.language, genre: request.genre, model: request.models.motion, client, directory, root, log}), script, research, request);
    writeJson(briefPath, brief); completed.push('motion');
    if (options.planOnly) {update('planned', {briefPath}); return {ok: true, jobId: id, jobDir: directory, briefPath, videoPath: null, plannedOnly: true};}
    stage = 'render'; update('running');
    await (dependencies.renderer ?? runRenderer)(root, briefPath, path.join(directory, 'render.log'), log);
    if (!existsSync(videoPath)) throw new Error('Renderer finished without the expected MP4.');
    completed.push('render'); update('complete', {briefPath, videoPath});
    return {ok: true, jobId: id, jobDir: directory, briefPath, videoPath, plannedOnly: false};
  } catch (error) {
    const safe = redact(error instanceof Error ? error.message : 'Generation failed', [config.apiKey]);
    update('failed', {error: safe, resumeCommand: `npm run generate -- --resume ${id}`});
    throw new GenerationError(id, stage, directory, `Job ${id} failed at ${stage}: ${safe}. Resume with --resume ${id}`);
  }
}
