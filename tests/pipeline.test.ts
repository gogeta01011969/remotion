import {strict as assert} from 'node:assert';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {GroqClient, type ChatRequest, type Completion} from '../src/pipeline/groq';
import {researchFromCompletion} from '../src/pipeline/research';
import {validateScript} from '../src/pipeline/contracts';
import {generateShort, validateMotion} from '../src/pipeline/workflow';
import sample from '../shorts/half-gravity.json';
import {prepareSilentInput} from '../src/shorts/silent';

const researchCompletion: Completion = {model: 'test', choices: [{finish_reason: 'stop', message: {
  content: 'Research fixture: weight changes while mass stays fixed. Free-fall and jump equations require fixed acceleration and no air resistance. '.repeat(2),
  executed_tools: [
    {type: 'browser_search', name: 'browser.search'},
    {type: 'browser.open', search_results: {results: [{url: 'https://example.org/physics', title: 'Physics', content: 'L0: URL: https://example.org/physics\nL1: Physics reference'}]}},
    {type: 'browser.open', search_results: {results: [{url: 'https://example.edu/gravity', title: 'Gravity', content: 'L0: URL: https://example.edu/gravity\nL1: Gravity reference'}]}},
  ],
}}]};
const research = researchFromCompletion(sample.topic, 'test', researchCompletion);
const fixtureActors = sample.actors.filter(a => !['normal-height', 'half-height'].includes(a.id));
const fixtureScenes = sample.scenes.map(s => ({...s, motion: s.motion.filter(m => !['normal-height', 'half-height'].includes(m.actor)), cues: s.cues.flatMap(cue => {
  const words = cue.split(/\s+/);
  return words.length > 18 ? [words.slice(0, 12).join(' '), words.slice(12).join(' ')] : [cue];
})}));
const script = {
  title: sample.topic, description: 'A sourced hypothetical comparison of weaker gravity near the surface.', assumptions: ['Ignore air resistance and keep launch speed fixed.'],
  scenes: fixtureScenes.map(s => ({title: s.title, cues: s.cues, visualIntent: 'Compare subject positions and forces through explicit state changes.', sourceIds: ['s1']})),
};
const motion = {actors: fixtureActors, scenes: fixtureScenes};
const content = (value: unknown): Completion => ({model: 'test', choices: [{finish_reason: 'stop', message: {content: JSON.stringify(value)}}]});

test('new automation jobs default to a silent visual script and preserve that mode through planning and resume',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'silent-workflow-'));
  mkdirSync(path.join(root,'shorts'));writeFileSync(path.join(root,'shorts','PLANNER.md'),'Use supported persistent actors.');
  const notes=[['What if gravity were halved?','Same mass. Half the weight.'],['Same launch speed.','Twice the jump height.'],['Same drop height.','The fall takes longer.'],['Same launch speed.','Longer airtime.']];
  const visualScript={...script,scenes:script.scenes.map((s,i)=>({...s,cues:notes[i]}))};
  let calls=0;
  const dependencies={config:{apiKey:'fixture',researchModel:'research',scriptModel:'script',motionModel:'motion'},client:{chat:async(request:ChatRequest):Promise<Completion>=>{
    calls++;
    if(request.tools)return researchCompletion;
    if(request.model==='script'){assert.ok(request.messages[0].content.includes('SILENT visual story'));return content(visualScript);}
    if(request.messages[0].content.includes('VISUAL DIRECTION'))return content({renderer:'actors',reason:'Use existing motion actors.'});
    if(request.messages[0].content.includes('CAST PLANNING STEP'))return content({actors:fixtureActors});
    const index=JSON.parse(request.messages.find(m=>m.role==='user')!.content).sceneIndex;
    return content({motion:fixtureScenes[index].motion});
  }},renderer:async(_root:string,filename:string)=>{
    const brief=JSON.parse(readFileSync(filename,'utf8')),input=prepareSilentInput(brief);
    assert.equal(brief.presentation,'silent');assert.equal(input.audio,undefined);
    const dir=path.join(root,'out','shorts',brief.id);mkdirSync(dir,{recursive:true});writeFileSync(path.join(dir,`${brief.id}.mp4`),'mock video');
  }};
  try{
    await generateShort({root,topic:sample.topic,id:'silent-auto',log:()=>{}},dependencies);
    const before=calls;
    await generateShort({root,resume:'silent-auto',log:()=>{}},dependencies);
    assert.equal(calls,before);
    await assert.rejects(generateShort({root,resume:'silent-auto',presentation:'narrated',log:()=>{}},dependencies),/Changing presentation/);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('research requires actual search execution and two opened pages', () => {
  assert.equal(research.sources.length, 2);
  assert.equal(research.sources[0].url, 'https://example.org/physics');
  assert.throws(() => researchFromCompletion('Topic', 'test', content({sources: ['https://invented.example']})), /did not execute/);
  const onlySearch = structuredClone(researchCompletion);
  onlySearch.choices![0].message!.executed_tools = [{type: 'browser_search', search_results: {results: [{url: 'https://example.org', title: 'Only a search result'}]}}];
  assert.throws(() => researchFromCompletion('Topic', 'test', onlySearch), /open at least two/);
});

test('script sources and exact narration survive the motion handoff', () => {
  const approved = validateScript(script, research);
  assert.equal(validateMotion(motion, approved, research, {id: 'test', topic: sample.topic}).scenes.length, 4);
  const altered = structuredClone(motion); altered.scenes[0].cues[0] = 'Changed script';
  assert.throws(() => validateMotion(altered, approved, research, {id: 'test', topic: sample.topic}), /verbatim/);
  const fabricated = structuredClone(script); fabricated.scenes[0].sourceIds = ['not-a-source'];
  assert.throws(() => validateScript(fabricated, research), /not present/);
  const symbolic = structuredClone(script); symbolic.scenes[1].cues[0] += ' x=2';
  assert.throws(() => validateScript(symbolic, research), /plain spoken words/);
});

test('provider retries transient errors and puts credentials only in the auth header', async () => {
  const key = 'secret-test-value'; const delays: number[] = []; let calls = 0;
  const client = new GroqClient({apiKey: key, sleep: async ms => {delays.push(ms);}, fetcher: async (_url, init) => {
    calls++; assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${key}`);
    assert.ok(!String(init?.body).includes(key));
    return calls === 1 ? new Response('{"error":{"message":"rate limited"}}', {status: 429, headers: {'retry-after': '0'}}) : Response.json(content({ok: true}));
  }});
  await client.chat({model: 'test', messages: [{role: 'user', content: 'Hi'}], max_completion_tokens: 100, temperature: 0});
  assert.equal(calls, 2); assert.deepEqual(delays, [1000]);
  const rejecting = new GroqClient({apiKey: key, fetcher: async () => Response.json({error: {message: `Rejected ${key}`}}, {status: 401})});
  await assert.rejects(rejecting.chat({model: 'test', messages: [], max_completion_tokens: 100, temperature: 0}), error => error instanceof Error && !error.message.includes(key) && error.message.includes('[redacted]'));
});

test('Groq rate-limit retries honor the reset interval in a JSON error without a Retry-After header',async()=>{
  const delays:number[]=[];let calls=0;
  const client=new GroqClient({apiKey:'test',sleep:async ms=>{delays.push(ms);},fetcher:async()=>++calls===1?Response.json({error:{message:'Token limit reached. Please try again in 25.515s.'}},{status:429}):Response.json(content({ok:true}))});
  await client.chat({model:'test',messages:[],max_completion_tokens:100,temperature:0});
  assert.deepEqual(delays,[25765]);assert.equal(calls,2);
  const longWait=new GroqClient({apiKey:'test',sleep:async()=>{throw new Error('Do not wait over a minute');},fetcher:async()=>Response.json({error:{message:'Please try again in 3600s.'}},{status:429})});
  await assert.rejects(()=>longWait.chat({model:'test',messages:[],max_completion_tokens:100,temperature:0}),/wait longer than 60 seconds/);
});

test('three-stage controller repairs invalid outputs and resumes without repeating AI calls', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'motion-pipeline-'));
  mkdirSync(path.join(root, 'shorts')); writeFileSync(path.join(root, 'shorts', 'PLANNER.md'), 'Use the supported motion contract.');
  const order: string[] = []; let scriptCalls = 0; let firstSceneCalls = 0; let renders = 0; let interruptScene = true;
  const dependencies = {
    config: {apiKey: 'not-a-real-key', researchModel: 'research-test', scriptModel: 'script-test', motionModel: 'motion-test'},
    client: {chat: async (request: ChatRequest): Promise<Completion> => {
      if (request.tools) {order.push('research'); return researchCompletion;}
      if (request.model === 'script-test') {
        order.push('script'); scriptCalls++;
        if (scriptCalls === 1) {const bad = structuredClone(script); bad.scenes[0].sourceIds = ['invalid']; return content(bad);}
        if (scriptCalls === 2) assert.ok(request.messages.some(m => m.content.includes('validation')));
        else assert.ok(request.messages.some(m => m.content.includes('EDITORIAL REVISION')));
        return content(script);
      }
      if (request.messages[0].content.includes('VISUAL DIRECTION')) {order.push('direction'); return content({renderer: 'actors', reason: 'Use the generic world for this fixture.'});}
      if (request.messages[0].content.includes('CAST PLANNING STEP')) {order.push('cast'); return content({actors: fixtureActors});}
      const index = JSON.parse(request.messages.find(m => m.role === 'user')!.content).sceneIndex as number;
      order.push(`scene-${index}`);
      if (index === 2 && interruptScene) {interruptScene = false; throw new Error('Simulated interrupted planning request');}
      const output = {motion: structuredClone(fixtureScenes[index].motion)};
      if (index === 0 && ++firstSceneCalls === 1) output.motion[0].actor = 'unknown-actor';
      return content(output);
    }},
    renderer: async (_root: string, briefPath: string) => {
      renders++; const brief = JSON.parse(readFileSync(briefPath, 'utf8'));
      const dir = path.join(root, 'out', 'shorts', brief.id); mkdirSync(dir, {recursive: true});
      writeFileSync(path.join(dir, `${brief.id}.mp4`), 'mock renderer artifact');
    },
  };
  try {
    await assert.rejects(generateShort({presentation:'narrated',topic: sample.topic, id: 'integration-test', root, planOnly: true, log: () => {}}, dependencies), /interrupted planning request/);
    const planned = await generateShort({resume: 'integration-test', root, planOnly: true, log: () => {}}, dependencies);
    assert.equal(planned.plannedOnly, true); assert.equal(renders, 0);
    assert.deepEqual(order, ['research', 'script', 'script', 'direction', 'cast', 'scene-0', 'scene-0', 'scene-1', 'scene-2', 'scene-2', 'scene-3']);
    await generateShort({resume: 'integration-test', restartFrom: 'motion', root, planOnly: true, log: () => {}}, dependencies);
    assert.deepEqual(order.slice(-6), ['direction', 'cast', 'scene-0', 'scene-1', 'scene-2', 'scene-3']);
    assert.equal(scriptCalls, 2);
    const complete = await generateShort({resume: 'integration-test', root, log: () => {}}, dependencies);
    assert.equal(complete.plannedOnly, false); assert.equal(renders, 1); assert.equal(order.length, 17);
    const status = JSON.parse(readFileSync(path.join(complete.jobDir, 'status.json'), 'utf8'));
    assert.equal(status.status, 'complete'); assert.deepEqual(status.completedStages, ['research', 'script', 'motion', 'render']);
    assert.ok(!readFileSync(path.join(complete.jobDir, 'request.json'), 'utf8').includes('not-a-real-key'));
    const feedback = 'Remove unsupported promises and explain only the controlled comparisons.';
    await generateShort({resume: 'integration-test', restartFrom: 'script', feedback, root, planOnly: true, log: () => {}}, dependencies);
    const revised = JSON.parse(readFileSync(path.join(complete.jobDir, 'request.json'), 'utf8'));
    assert.equal(revised.feedback, feedback);
    assert.equal(scriptCalls, 3);
    assert.ok(readFileSync(path.join(complete.jobDir, 'revision-draft.json'), 'utf8').includes(script.title));
  } finally {rmSync(root, {recursive: true, force: true});}
});
