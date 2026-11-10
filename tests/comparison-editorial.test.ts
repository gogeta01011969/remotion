import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {comparisonIdeasSchema,comparisonIdeasGenerationSchema} from '../src/shorts/comparison-editorial';
import {sizeDatasetSchema} from '../src/shorts/size-data';
import {planComparisonStory} from '../src/pipeline/comparison-story';
import {compileSizeComparison,defaultSizeEpisode} from '../src/pipeline/size-comparison';
import {planComparisonIdeas,validateConceptSelection,comparisonGenerationSchema,normalizeComparisonGeneration} from '../src/pipeline/comparison-ideas';
import {generateComparisonData} from '../src/pipeline/comparison-run';
import {comparisonSubjectHint,needsCountry} from '../src/shorts/comparison-context';
import {ideaFixture,editorialFixture} from './helpers/comparison-editorial';
import type {ChatRequest} from '../src/pipeline/groq';
import {z} from 'zod';
import {structuredStage} from '../src/pipeline/stages';

function fixture(){
  const data=sizeDatasetSchema.parse({template:'size-comparison',id:'editorial-test',title:'Synthetic reference to the extreme',metric:'height',unit:'m',basis:'Synthetic complete-object heights on one ground baseline.',context:'Synthetic editorial contract test',items:[1,2,4,10].map((value,i)=>({id:`item-${i}`,label:`Reference ${i}`,value,color:'#AABBCC',sourceIds:['s1'],visual:{kind:'box',widthToHeight:.5,depthToHeight:.5}})),sources:[{id:'s1',title:'Synthetic test reference',url:'https://example.com/source'}]});
  return sizeDatasetSchema.parse({...data,editorial:editorialFixture(data)});
}
test('new idea output requires contextual backgrounds while saved legacy plans remain readable',()=>{
  const legacy=ideaFixture();legacy.concepts.forEach(c=>{delete c.background;});
  assert.equal(comparisonIdeasSchema.safeParse(legacy).success,true);
  assert.equal(comparisonIdeasGenerationSchema.safeParse(legacy).success,false);
  assert.equal(comparisonIdeasGenerationSchema.safeParse(ideaFixture()).success,true);
  const duplicate=ideaFixture();duplicate.concepts[1].id=duplicate.concepts[0].id;
  assert.equal(comparisonIdeasGenerationSchema.safeParse(duplicate).success,false);
});
test('the model contract requires a non-null background and repairs an omitted setting',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'required-concept-bg-'));const calls:ChatRequest[]=[];
  try{
    const ideas=await planComparisonIdeas({topic:'Synthetic object heights',id:'required-bg',root,directory:root,log:()=>{}},{config:{apiKey:'test',researchModel:'test',scriptModel:'test',motionModel:'test'},client:{chat:async request=>{
      calls.push(request);const draft=ideaFixture();if(calls.length===1)draft.concepts.forEach(c=>{delete c.background;});
      return {choices:[{message:{content:JSON.stringify({...draft,...(calls.length===2?{$schema:'https://json-schema.org/draft/2020-12/schema'}:{})})}}]};
    }}});
    assert.equal(calls.length,2);assert.ok(ideas.concepts.every(c=>c.background));
    const objects:Record<string,any>[]=[];
    const visit=(v:any)=>{if(v&&typeof v==='object'){if(v.properties?.background)objects.push(v);Object.values(v).forEach(visit);}};
    assert.equal(calls[0].response_format?.type,'json_object');
    const contract=JSON.parse(calls[0].messages[0].content.split('Match this schema; do not repeat schema keywords in the output:\n')[1]);
    assert.equal(contract.$schema,undefined);visit(contract);
    assert.equal(objects.length,1);assert.ok(objects[0].required.includes('background'));
    assert.equal(objects[0].properties.background.anyOf,undefined);
    assert.ok(calls[1].messages.some(m=>m.content.includes('background')));
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('concept plans reject incompatible dimensions and unsupported visual approaches',()=>{
  const ideas=ideaFixture();assert.equal(comparisonIdeasSchema.safeParse(ideas).success,true);
  for(const changes of [{metric:'wingspan',visualApproach:'textured-spheres'},{metric:'area',unit:'km2',visualApproach:'side-cutouts'},{metric:'volume',unit:'m',visualApproach:'equivalent-volume-models'},{metric:'length',visualApproach:'grounded-cutouts'}]){
    assert.equal(comparisonIdeasSchema.safeParse({...ideas,concepts:ideas.concepts.map((c,i)=>i?c:{...c,...changes})}).success,false);
  }
  assert.equal(comparisonIdeasSchema.safeParse({...ideas,selectedId:'not-a-concept'}).success,false);
});
test('a compact model contract does not relax the renderer visual and asset-path checks',()=>{
  const data=fixture();
  const raw={...data,items:data.items.map(item=>({...item,visual:{kind:'cutout',src:'../private.png',view:'side',attribution:'Untrusted test output',referenceUrls:['https://example.com/source']}}))};
  assert.equal(comparisonGenerationSchema(data.metric).safeParse(raw).success,false);
  assert.equal(sizeDatasetSchema.safeParse(raw).success,false);
});
test('model role records normalize into the persistent editorial script without duplicating measured objects',()=>{
  const data=fixture(),{items:objectRoles,...editorial}=data.editorial!;
  const normalized=sizeDatasetSchema.parse(normalizeComparisonGeneration({...data,editorial:{...editorial,objectRoles}}));
  assert.deepEqual(normalized,data);
  const reordered=sizeDatasetSchema.parse(normalizeComparisonGeneration({...data,context:'Long metadata '.repeat(20),items:[...data.items].reverse(),editorial:{...data.editorial,items:[...data.editorial!.items].reverse()}}));
  assert.deepEqual(reordered.items,data.items);assert.deepEqual(reordered.editorial!.items,data.editorial!.items);assert.equal(reordered.context.length,100);
  assert.throws(()=>normalizeComparisonGeneration({...data,editorial:{...data.editorial,objectRoles}}),/Full objects|full objects/);
});
test('constrained planning can omit optional facts without inventing them, while URL validation stays local',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'comparison-optional-')),schema=z.object({url:z.string().url(),note:z.string().optional()});
  const calls:ChatRequest[]=[];
  try{
    const result=await structuredStage({stage:'motion',artifact:'optional-test',constrained:true,nullableOptionals:true,compactSchema:true,model:'test',schema,system:'Return the supplied reference as JSON.',input:'Use https://example.com; no note is known.',directory:root,log:()=>{},validate:raw=>schema.parse(raw),client:{chat:async request=>{calls.push(request);return {choices:[{message:{content:JSON.stringify({url:'https://example.com',note:null})}}]};}}});
    assert.equal(result.note,undefined);assert.equal(result.url,'https://example.com');
    const providerSchema=(calls[0].response_format as {json_schema:{schema:{properties:{note:{anyOf:unknown[]}}}}}).json_schema.schema;
    assert.equal(providerSchema.properties.note.anyOf.length,2);
    assert.ok(!JSON.stringify(providerSchema).includes('"format"'));
    assert.equal(schema.safeParse({url:'not-a-url'}).success,false);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('selection cannot lose the opening, actual payoff, adjacent comparison or sourced claim',()=>{
  const data=fixture(),e=data.editorial!;
  for(const editorial of [
    {...e,opening:{...e.opening,itemId:'item-1'}},
    {...e,payoff:{...e.payoff,itemId:'item-2'}},
    {...e,familiarAnchor:{...e.familiarAnchor,itemId:'missing'}},
    {...e,surprisingPair:{...e.surprisingPair,largerId:'item-3'}},
    {...e,items:[...e.items].reverse()},
    {...e,items:e.items.map(item=>({...item,reason:'Identical filler repeated for every selected object.'}))},
    {...e,claim:{...e.claim,sourceIds:['invented']}},
    {...e,claim:{...e.claim,kind:'top-n'}},
  ])assert.equal(sizeDatasetSchema.safeParse({...data,editorial}).success,false);
  assert.equal(sizeDatasetSchema.safeParse({...data,asOf:'2026-11-10',editorial:{...e,claim:{...e.claim,kind:'top-n'}}}).success,true);
});
test('close comparisons remain valid; an equal-size ladder cannot pretend to escalate',()=>{
  const data=fixture();
  assert.equal(sizeDatasetSchema.safeParse({...data,items:data.items.map((item,i)=>({...item,value:1+i*.01}))}).success,true);
  const equal={...data,items:data.items.map(item=>({...item,value:1}))};
  assert.equal(sizeDatasetSchema.safeParse(equal).success,false);
  assert.equal(sizeDatasetSchema.safeParse({...equal,editorial:{...data.editorial,strategy:'hidden-differences'}}).success,true);
});
test('the selected concept survives dataset compilation into the writing brief and video metadata',()=>{
  const data=fixture(),concept=ideaFixture().concepts[0];
  assert.equal(validateConceptSelection(data,concept),data);
  assert.throws(()=>validateConceptSelection({...data,editorial:undefined},concept),/editorial/);
  assert.throws(()=>validateConceptSelection({...data,metric:'length'},concept),/metric/);
  assert.throws(()=>validateConceptSelection({...data,editorial:{...data.editorial!,viewerQuestion:'An unrelated question silently replaced the chosen angle?'}},concept),/viewer question/);
  const corrected={...data,editorial:{...data.editorial!,viewerQuestion:'How do these sourced examples compare on one consistent scale?',questionRevision:{originalQuestion:concept.viewerQuestion,reason:'Research required a more precise question without an unverified world-record premise.'}}};
  assert.equal(validateConceptSelection(corrected,concept),corrected);
  const changed={...data,items:data.items.map((item,i)=>i===3?{...item,label:'Verified replacement'}:item)};
  assert.throws(()=>validateConceptSelection(changed,concept),/payoff adjustment/);
  changed.editorial!.conceptAdjustments.push({role:'payoff',originalCandidate:concept.payoffCandidate,replacementItemId:'item-3',reason:'The candidate was replaced by a supported larger example after checking the reference sources.'});
  assert.equal(validateConceptSelection(changed,concept),changed);
  const plan=planComparisonStory(data),brief=compileSizeComparison(data,defaultSizeEpisode(data));
  assert.equal(plan.writingBrief.hook,concept.viewerQuestion);
  assert.deepEqual(plan.writingBrief.objectRoles,data.editorial!.items);
  assert.equal(plan.writingBrief.payoff!.itemId,data.items.at(-1)!.id);
  assert.ok(brief.description.includes(concept.viewerQuestion));
  assert.ok(brief.scenes.every(scene=>scene.cues.length===0));
});
test('ideas can be reviewed and resumed without research, images, or repeated model calls',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'comparison-ideas-')),calls:ChatRequest[]=[];
  const options={topic:'A broad synthetic comparison topic',id:'idea-test',directory:root,root,log:()=>{}};
  const deps={config:{apiKey:'test',researchModel:'test',scriptModel:'test',motionModel:'test'},client:{chat:async(request:ChatRequest)=>{calls.push(request);return {choices:[{message:{content:JSON.stringify(ideaFixture())}}]};}}};
  try{
    const ideas=await planComparisonIdeas(options,deps);assert.equal(calls.length,1);assert.equal(calls[0].tools,undefined);
    assert.deepEqual(await planComparisonIdeas(options,deps),ideas);assert.equal(calls.length,1);
    assert.equal(JSON.parse(readFileSync(path.join(root,'request.json'),'utf8')).planningVersion,2);
    await assert.rejects(()=>planComparisonIdeas({...options,topic:'An incompatible new topic'},deps),/different request/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('new concepts repair a generic studio choice when a subject clearly calls for a contextual setting',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'comparison-concept-bg-'));let calls=0;
  try{
    const result=await planComparisonIdeas({topic:'Size comparison of flying objects',id:'background-ideas',root,directory:root,log:()=>{}},{config:{apiKey:'test',researchModel:'test',scriptModel:'test',motionModel:'test'},client:{chat:async()=>{
      calls++;const ideas=ideaFixture();for(const c of ideas.concepts)c.background={environment:calls===1?'studio':'sky',reason:'A shared sky connects the flying subjects across the complete comparison episode.'};
      return {choices:[{message:{content:JSON.stringify(ideas)}}]};
    }}});
    assert.ok(result.concepts.every(c=>c.background?.environment==='sky'));assert.equal(calls,2);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('completed legacy datasets resume without being reinterpreted by the new concept stage',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'comparison-legacy-')),data=fixture();delete data.editorial;
  const options={topic:'Original scope',id:'legacy-test',directory:root,root,log:()=>{}};
  try{
    writeFileSync(path.join(root,'request.json'),JSON.stringify({id:options.id,topic:options.topic}));
    writeFileSync(path.join(root,'dataset.raw.json'),JSON.stringify(data));
    const deps={client:{chat:async()=>{throw new Error('No model call should be made');}}};
    assert.deepEqual(await generateComparisonData(options,deps),data);
    await assert.rejects(()=>planComparisonIdeas(options,deps),/new ID/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('mixed fixed structures receive the same country context as statues and buildings',()=>{
  assert.equal(comparisonSubjectHint('Tallest structures in the world'),'structures');assert.ok(needsCountry('structures'));
  const data=fixture();assert.equal(sizeDatasetSchema.safeParse({...data,subject:'structures'}).success,false);
  assert.equal(sizeDatasetSchema.safeParse({...data,subject:'structures',items:data.items.map(item=>({...item,country:'Test country'}))}).success,true);
});
test('missing evidence resumes an interrupted research checkpoint before selection, preserving source IDs',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'comparison-evidence-')),data=fixture(),order:string[]=[];
  data.sources.push({id:'s3',title:'New payoff evidence',url:'https://example.com/payoff'});data.items.at(-1)!.sourceIds=['s3'];
  const completion=(urls:string[])=>({choices:[{message:{content:'Reviewed synthetic measurement definitions, selected references and object appearances. '.repeat(4),executed_tools:[{type:'browser_search'},...urls.map(url=>({name:'browser.open',search_results:{results:[{url,content:'Primary synthetic reference\nKnown measurements'}]}}))]}}]});
  let researchCalls=0;
  const options={topic:'A synthetic reference ladder',id:'evidence-test',root,directory:root,log:()=>{}};
  const dependencies={config:{apiKey:'test',researchModel:'test',scriptModel:'test',motionModel:'test'},client:{chat:async(request:ChatRequest)=>{
      if(request.tools){order.push('research');researchCalls++;if(researchCalls===2)throw new Error('Synthetic quota interruption');return completion(researchCalls===1?['https://example.com/source','https://example.com/other']:['https://example.com/source','https://example.com/payoff']);}
      const input=JSON.parse(request.messages[1].content);
      if(!input.selectedConcept){order.push('ideas');return {choices:[{message:{content:JSON.stringify(ideaFixture())}}]};}
      order.push('selection');return {choices:[{message:{content:JSON.stringify(data)}}]};
    }}};
  try{
    await assert.rejects(()=>generateComparisonData(options,dependencies),/quota interruption/);
    assert.equal(JSON.parse(readFileSync(path.join(root,'research-gap.json'),'utf8')).status,'pending');
    const generated=await generateComparisonData(options,dependencies);
    assert.deepEqual(order,['ideas','research','selection','research','research','selection']);
    assert.equal(generated.sources.find(s=>s.id==='s3')!.url,'https://example.com/payoff');
    const saved=JSON.parse(readFileSync(path.join(root,'research.json'),'utf8'));assert.equal(saved.sources.find((s:{id:string})=>s.id==='s1').url,'https://example.com/source');
  }finally{rmSync(root,{recursive:true,force:true});}
});
