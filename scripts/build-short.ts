import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {renderPrepared} from '../src/pipeline/render-prepared';
import {buildSilent} from '../src/pipeline/build-silent';
import {briefSchema, shortDuration, shortSchema} from '../src/shorts/schema';
import {speechText} from '../src/shorts/locale';
import {layoutDirectedCues, makeCaptionChunks} from '../src/shorts/delivery';
import {layoutTimedCues} from '../src/shorts/structure';
import {compileStory, motionReport} from '../src/shorts/motion';

const root = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const filename = args.find(arg => !arg.startsWith('--')) ?? 'shorts/earth-stops.json';
const prepareOnly = args.includes('--prepare-only');
const sampleRate = 48000;
const fps = 30;

function run(command: string, argv: string[]) {
  const result = spawnSync(command, argv, {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout;
}
function wav(samples: Int16Array) {
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + samples.byteLength, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(samples.byteLength, 40);
  return Buffer.concat([header, Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)]);
}
function subtitleTime(seconds: number) {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
}

async function main() {
  const brief = briefSchema.parse(JSON.parse(readFileSync(path.resolve(filename), 'utf8')));
  run('ffmpeg', ['-version']);
  if (brief.presentation === 'silent') {await buildSilent(brief,root,prepareOnly);return;}
  if (process.platform !== 'darwin') throw new Error('The bundled speech adapter uses macOS say. Supply a local TTS adapter in scripts/build-short.ts on other systems.');
  const assetDir = path.join(root, 'public', 'shorts', brief.id);
  const outputDir = path.join(root, 'out', 'shorts', brief.id);
  const cacheDir = path.join(root, 'out', 'speech-cache');
  [assetDir, outputDir, cacheDir].forEach(dir => mkdirSync(dir, {recursive: true}));
  const voiceSegments: {start: number; samples: Buffer}[] = [];
  const cuts: number[] = [];
  let globalFrame = 0;
  console.log(`Preparing: ${brief.topic}`);
  const timingReport: {title: string; from: number; duration: number; speechRate: number; cueRates: number[]; spokenSeconds: number; directed: boolean}[] = [];
  function speech(caption: string, rate: number) {
    const text = speechText(caption, brief.language);
    const hash = createHash('sha256').update(JSON.stringify({text, voice: brief.voice, rate, adapter: brief.structure ? 'macos-say-v2-timed' : 'macos-say-v1'})).digest('hex').slice(0, 20);
    const aiff = path.join(cacheDir, `${hash}.aiff`), pcm = path.join(cacheDir, `${hash}.pcm`);
    if (!existsSync(pcm) || readFileSync(pcm).length < sampleRate / 5) {
      run('say', ['-v', brief.voice, '-r', String(rate), '-o', aiff, text]);
      const trim = brief.structure ? ['-af', 'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_duration=0.02:start_threshold=-50dB,areverse'] : [];
      run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', aiff, ...trim, '-ar', String(sampleRate), '-ac', '1', '-f', 's16le', pcm]);
      rmSync(aiff, {force: true});
    }
    const samples = readFileSync(pcm);
    if (samples.length < sampleRate / 5) throw new Error(`Speech synthesis produced no audio for: ${text}. Check macOS voice availability and speech-service access.`);
    return {samples, duration: Math.ceil((samples.length / 2 / sampleRate) * fps)};
  }
  const scenes = brief.scenes.map((scene, index) => {
    cuts.push(globalFrame / fps);
    let rate = brief.wordsPerMinute;
    let cueRates = scene.cues.map((_, i) => scene.delivery?.rates?.[i] ?? rate);
    let segments = scene.cues.map((text, i) => speech(scene.spokenCues?.[i] ?? text, cueRates[i]));
    const budget = brief.structure ? brief.structure.beats[index].durationSeconds * fps : null;
    if (budget && !scene.delivery) {
      const available = budget - 3 - (segments.length - 1) * 2;
      for (let attempt = 0; attempt < 3 && segments.reduce((sum, c) => sum + c.duration, 0) > available; attempt++) {
        const total = segments.reduce((sum, c) => sum + c.duration, 0);
        const nextRate = Math.min(brief.language !== 'en' ? 210 : 260, Math.ceil(rate * total / available * 1.025));
        if (nextRate <= rate) break;
        rate = nextRate; cueRates = scene.cues.map(() => rate); segments = scene.cues.map((text, i) => speech(scene.spokenCues?.[i] ?? text, rate));
      }
    }
    let localFrame = 5;
    let timings: {from: number; duration: number}[];
    try {
      if (budget) timings = scene.delivery ? layoutDirectedCues(segments.map(c => c.duration), budget, fps, scene.delivery) : layoutTimedCues(segments.map(c => c.duration), budget);
      else timings = segments.map((segment, i) => {
        const timing = {from: localFrame, duration: segment.duration};
        localFrame += segment.duration + (scene.delivery ? Math.round(scene.delivery.pausesAfterMs[i] * fps / 1000) : 2);
        return timing;
      });
    } catch (error) {throw new Error(`${scene.title}: ${error instanceof Error ? error.message : 'Narration timing failed'}`);}
    const captions = scene.cues.map((text, i) => {
      voiceSegments.push({start: (globalFrame + timings[i].from) * sampleRate / fps, samples: segments[i].samples});
      return {text, ...timings[i], chunks: brief.captionMode === 'phrase' ? makeCaptionChunks(text, timings[i].from, timings[i].duration, fps) : undefined};
    });
    const durationInFrames = budget ?? localFrame + 6;
    timingReport.push({title: scene.title, from: globalFrame / fps, duration: durationInFrames / fps, speechRate: rate, cueRates, directed: Boolean(scene.delivery), spokenSeconds: segments.reduce((sum, c) => sum + c.duration, 0) / fps});
    globalFrame += durationInFrames;
    console.log(`  ${index + 1}. ${scene.title} · ${(durationInFrames / fps).toFixed(2)}s${scene.delivery ? ` · directed ${Math.min(...cueRates)}–${Math.max(...cueRates)} wpm` : budget ? ` · speech ${rate} wpm` : ''}`);
    return {title: scene.title, motion: scene.motion, durationInFrames, captions};
  });
  writeFileSync(path.join(outputDir, 'timing-report.json'), JSON.stringify(timingReport, null, 2) + '\n');
  // Only add a closing hold when necessary. Never speed up or truncate narration.
  if (!brief.structure && globalFrame < fps * 30) {
    scenes[scenes.length - 1].durationInFrames += fps * 30 - globalFrame;
    globalFrame = fps * 30;
  }
  const input = shortSchema.parse({presentation:brief.presentation, captionMode: brief.captionMode, language: brief.language, structure: brief.structure, genre: brief.genre, schemaVersion: brief.schemaVersion, topic: brief.topic, seed: brief.seed, accent: brief.accent, actors: brief.actors, fps, audio: `shorts/${brief.id}/soundtrack.wav`, scenes});
  compileStory(input); // Resolve and validate the complete timeline before rendering.
  writeFileSync(path.join(outputDir, 'motion-report.json'), JSON.stringify(motionReport(input), null, 2) + '\n');
  const totalSamples = globalFrame * sampleRate / fps;
  const narration = new Float32Array(totalSamples);
  voiceSegments.forEach(({start, samples}) => {
    for (let i = 0; i < samples.length / 2; i++) narration[start + i] = samples.readInt16LE(i * 2) / 32768;
  });
  const mixed = new Int16Array(totalSamples);
  let noiseState = brief.seed >>> 0 || 1;
  const quietRanges = brief.actors.flatMap(actor => actor.kind === 'sacred-symbol' ? actor.steps.flatMap((step, i) => step.mode === 'silence' ? [{from: cuts[i], to: cuts[i+1] ?? globalFrame / fps}] : []) : []);
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const fade = Math.min(1, t / 0.6, (totalSamples / sampleRate - t) / 0.9);
    let ambience = 1;
    for (const range of quietRanges) {
      if (t >= range.from && t < range.to) ambience = Math.min(ambience, Math.max(0, (range.from + .3 - t) / .3));
      if (t >= range.to && t < range.to + .3) ambience = Math.min(ambience, (t - range.to) / .3);
    }
    const pad = (Math.sin(t * Math.PI * 110) * 0.013 + Math.sin(t * Math.PI * 164.812) * 0.007 + Math.sin(t * Math.PI * 220) * 0.004) * fade;
    const beat = t % 0.6;
    const pulse = (brief.genre === 'mythology' ? 0 : 1) * Math.sin(2 * Math.PI * (55 * beat + 12 * (1 - Math.exp(-beat * 30)))) * Math.exp(-beat * 19) * 0.025 * fade;
    noiseState = (Math.imul(1664525, noiseState) + 1013904223) >>> 0;
    const noise = noiseState / 4294967296 * 2 - 1;
    let fx = 0;
    for (const cut of (brief.genre === 'mythology' ? [] : cuts)) {
      const delta = t - cut;
      if (delta > -0.25 && delta < 0) fx += noise * (1 + delta / 0.25) ** 2 * 0.035;
      if (delta >= 0 && delta < 0.6) fx += Math.sin(2 * Math.PI * (70 * delta - 25 * delta * delta)) * Math.exp(-delta * 12) * 0.11;
    }
    mixed[i] = Math.round(Math.max(-1, Math.min(1, narration[i] * 0.88 + pad * ambience + pulse + fx)) * 32767);
  }
  const rawMix = path.join(outputDir, 'mix.wav');
  writeFileSync(rawMix, wav(mixed));
  writeFileSync(path.join(outputDir, 'narration.wav'), wav(Int16Array.from(narration, n => Math.round(n * 32767))));
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', rawMix, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=9', '-ar', String(sampleRate), path.join(assetDir, 'soundtrack.wav')]);
  rmSync(rawMix, {force: true});
  const propsPath = path.join(assetDir, 'video.json');
  writeFileSync(propsPath, JSON.stringify(input, null, 2) + '\n');
  let offset = 0;
  let subtitleIndex = 0;
  const subtitles: string[] = [];
  scenes.forEach(scene => {
    scene.captions.forEach(parent => (parent.chunks ?? [parent]).forEach(c => subtitles.push(`${++subtitleIndex}\n${subtitleTime((offset + c.from) / fps)} --> ${subtitleTime((offset + c.from + c.duration) / fps)}\n${c.text}\n`)));
    offset += scene.durationInFrames;
  });
  writeFileSync(path.join(outputDir, 'captions.srt'), subtitles.join('\n'));
  writeFileSync(path.join(outputDir, 'youtube.txt'), `${brief.topic}\n\n${brief.description}\n\nResearch:\n${brief.sources.map(s => `${s.title}: ${s.url}`).join('\n')}\n`);
  console.log(`Prepared ${(shortDuration(input) / fps).toFixed(2)}s. Props: ${path.relative(root, propsPath)}`);
  if (prepareOnly) return;
  await renderPrepared({input,root,outputDir,id:brief.id});
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
