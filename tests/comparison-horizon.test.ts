import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {horizonBrief,horizonPriority,topicFamily,futureComparisonDimensions} from '../src/pipeline/comparison-horizon';
import {automationConfigSchema,reserveTopic,ledgerSchema,jobSchema} from '../src/pipeline/topic-automation';
import {planComparisonIdeas} from '../src/pipeline/comparison-ideas';
import {ideaFixture} from './helpers/comparison-editorial';
const now='2026-11-11T00:00:00.000Z';
const candidates=[
  {topic:'How do remarkable radio towers compare in height?',metric:'height',family:'landmarks',angle:'record-ladder',depth:'accessible',scopeKey:'radio-tower-height',entityKeys:['Mast A','Tower B','Tower C','Mast D'],whyInteresting:'Familiar silhouettes establish a clear reference for unusual tower heights.'},
  {topic:'How long are different ships from bow to stern?',metric:'length',family:'watercraft',angle:'familiar-to-extreme',depth:'accessible',scopeKey:'ship-overall-length',entityKeys:['Dinghy','Tugboat','Ferry','Container ship'],whyInteresting:'A familiar small boat anchors a progression to enormous working ships.'},
  {topic:'Which flying animals have surprisingly wide wings?',metric:'wingspan',family:'winged-life',angle:'unexpected-neighbors',depth:'specialist',scopeKey:'animal-extended-wingspan',entityKeys:['Hawk','Albatross','Condor','Flying fox'],whyInteresting:'Recognizable flyers reveal useful unexpected neighbors in wingspan.'},
];
const config=automationConfigSchema.parse({niche:'Silent physical-size comparisons',allowedMetrics:['height','length','wingspan'],assetProvider:'unused'});
test('the horizon exposes only compatible measurements and leaves future quantitative dimensions disabled',()=>{
  const horizon=horizonBrief(['wingspan']);
  assert.ok(horizon.families.some(f=>f.id==='winged-life'));
  assert.equal(horizon.families.some(f=>f.id==='land-vehicles'),false);
  assert.ok(horizon.families.every(f=>f.metrics.every(m=>m==='wingspan')));
  assert.equal(futureComparisonDimensions.some(d=>String(d.dimension)==='mass'),false);
  assert.equal(automationConfigSchema.safeParse({...config,allowedMetrics:['mass']}).success,true);
  assert.equal(automationConfigSchema.safeParse({...config,allowedMetrics:['density']}).success,false);
});
test('coverage ranking encourages new families, angles and depth while retaining familiar subjects',()=>{
  const history=[{topic:'Tallest landmarks',metric:'height',family:'landmarks',angle:'record-ladder',depth:'accessible'}];
  assert.ok(horizonPriority(candidates[1],history)<horizonPriority(candidates[0],history));
  assert.ok(horizonPriority({...candidates[0],angle:'hidden-differences'},history)<horizonPriority(candidates[0],history));
  assert.ok(horizonPriority({...candidates[0],depth:'specialist'},history)<horizonPriority(candidates[0],history));
  assert.equal(topicFamily({topic:'The wingspans of birds',metric:'wingspan'}),'winged-life');
});
test('new ideas are capability-checked and selected by coverage rather than first position',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'horizon-selection-'));let calls=0;let input:any;
  const ledger=ledgerSchema.parse({version:1,queue:[],jobs:[{id:'short-old-landmarks',topic:'A previous monument-height selection',metric:'height',scopeKey:'previous-landmarks',entityKeys:['Old one','Old two','Old three','Old four'],family:'landmarks',angle:'record-ladder',depth:'accessible',status:'complete',attempts:1,createdAt:now,updatedAt:now}]});
  try{
    const result=await reserveTopic({ledger,config,root,directory:root,now,model:'test',log:()=>{},client:{chat:async request=>{calls++;input=JSON.parse(request.messages[1].content);return {choices:[{message:{content:JSON.stringify({candidates})}}]};}}});
    assert.equal(result.family,'winged-life');assert.equal(result.angle,'unexpected-neighbors');assert.equal(ledger.queue.length,2);assert.equal(calls,1);
    assert.ok(input.horizon.families.length>5);assert.ok(input.recentHistory.length<=8);
    assert.equal(jobSchema.safeParse({...result,family:undefined,angle:undefined,depth:undefined}).success,true);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('a mismatched family and metric must be repaired before topic reservation',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'horizon-invalid-'));let calls=0;
  try{
    await reserveTopic({ledger:ledgerSchema.parse({version:1,queue:[],jobs:[]}),config,root,directory:root,now,model:'test',log:()=>{},client:{chat:async()=>{calls++;const drafts=structuredClone(candidates);if(calls===1)drafts[0].family='watercraft';return {choices:[{message:{content:JSON.stringify({candidates:drafts})}}]};}}});
    assert.equal(calls,2);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('incompatible catalog configuration stops before spending model requests',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'horizon-empty-'));let calls=0;
  try{
    await assert.rejects(()=>reserveTopic({ledger:ledgerSchema.parse({version:1,queue:[],jobs:[]}),config:{...config,allowedMetrics:['wingspan'],enabledFamilies:['watercraft']},root,directory:root,now,model:'test',log:()=>{},client:{chat:async()=>{calls++;throw new Error('Unexpected model call');}}}),/No enabled subject family/);
    assert.equal(calls,0);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('the chosen family, angle, depth and curiosity rationale reach concept planning and checkpoints',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'horizon-brief-'));let input:any;
  const topicBrief={family:'landmarks',angle:'within-one-family',depth:'specialist',whyInteresting:'A familiar landmark makes a specialist group understandable.',proposedObjects:['Reference 0','Reference 1','Reference 2','Reference 3']};
  try{
    await planComparisonIdeas({topic:'A synthetic landmark comparison',id:'horizon-brief',directory:root,root,log:()=>{},topicBrief},{config:{apiKey:'test',researchModel:'test',motionModel:'test',scriptModel:'test'},client:{chat:async request=>{input=JSON.parse(request.messages[1].content);return {choices:[{message:{content:JSON.stringify(ideaFixture())}}]};}}});
    assert.deepEqual(input.topicBrief,topicBrief);
    assert.deepEqual(JSON.parse(readFileSync(path.join(root,'request.json'),'utf8')).topicBrief,topicBrief);
  }finally{rmSync(root,{recursive:true,force:true});}
});
