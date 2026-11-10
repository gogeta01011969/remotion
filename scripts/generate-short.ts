import {readFileSync} from 'node:fs';
import {structureSchema} from '../src/shorts/structure';
import {parseArgs} from 'node:util';
import {captionModeSchema} from '../src/shorts/delivery';
import {languageSchema} from '../src/shorts/locale';
import {presentationSchema} from '../src/shorts/presentation';
import {genreSchema} from '../src/shorts/genres';
import {generateShort, GenerationError} from '../src/pipeline/workflow';

async function main() {
  const {values} = parseArgs({options: {topic: {type: 'string'}, presentation:{type:'string'}, language: {type: 'string'}, 'caption-mode': {type: 'string'}, 'adapt-from': {type: 'string'}, genre: {type: 'string'}, structure: {type: 'string'}, id: {type: 'string'}, resume: {type: 'string'}, feedback: {type: 'string'}, 'restart-from': {type: 'string'}, 'research-model': {type: 'string'}, 'script-model': {type: 'string'}, 'motion-model': {type: 'string'}, 'plan-only': {type: 'boolean'}, help: {type: 'boolean'}}});
  if (values.help) {
    console.log('Usage: npm run generate -- --topic "What if ...?" [--id job-name] [--presentation silent|narrated] (new jobs default to silent) [--language en|hi|hinglish] [--adapt-from source-job] [--caption-mode sentence|phrase] [--genre what-if|mythology|explainer] [--structure path/to/structure.json] [--feedback "creative brief"] [--plan-only]\nResume: npm run generate -- --resume job-name [--restart-from research|script|motion|render] [--feedback "revision notes"]\nModels: --research-model ID --script-model ID --motion-model ID (resumed changes require --restart-from)\nProgress goes to stderr; the final result is JSON on stdout.'); return;
  }
  if (values.topic && values.resume || values.id && values.resume) throw new Error('Use --resume alone, or --topic with optional --id.');
  if (!values.topic && !values.resume && !values['adapt-from']) throw new Error('Provide --topic "What if ...?" or --resume job-name.');
  const restart = values['restart-from'];
  if (restart && !['research', 'script', 'motion', 'render'].includes(restart)) throw new Error('Invalid --restart-from stage.');
  const models = Object.fromEntries(['research', 'script', 'motion'].flatMap(stage => {const model = values[`${stage}-model` as 'research-model' | 'script-model' | 'motion-model']; return model ? [[stage, model]] : [];}));
  const result = await generateShort({presentation:values.presentation?presentationSchema.parse(values.presentation):undefined, captionMode: values['caption-mode'] ? captionModeSchema.parse(values['caption-mode']) : undefined, language: values.language ? languageSchema.parse(values.language) : undefined, adaptFrom: values['adapt-from'], structure: values.structure ? structureSchema.parse(JSON.parse(readFileSync(values.structure, 'utf8'))) : undefined, genre: values.genre ? genreSchema.parse(values.genre) : undefined, topic: values.topic, id: values.id, resume: values.resume, restartFrom: restart as 'research' | 'script' | 'motion' | 'render' | undefined, feedback: values.feedback, models: Object.keys(models).length ? models : undefined, planOnly: values['plan-only']});
  console.log(JSON.stringify(result));
}
main().catch(error => {
  console.log(JSON.stringify({ok: false, error: error instanceof Error ? error.message : 'Generation failed', ...(error instanceof GenerationError ? {jobId: error.jobId, stage: error.stage, jobDir: error.jobDir, resumeCommand: `npm run generate -- --resume ${error.jobId}`} : {})}));
  process.exitCode = 1;
});
