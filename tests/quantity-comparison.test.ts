import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {sizeDatasetSchema} from '../src/shorts/size-data';
import {convertMeasurement,quantityDomain,quantityTemplate,quantityMetrics} from '../src/shorts/measurements';
import {compileSizeComparison,defaultSizeEpisode} from '../src/pipeline/size-comparison';
import {planComparisonStory} from '../src/pipeline/comparison-story';
import {previewInput} from '../src/shorts/defaults';
import {shortDuration} from '../src/shorts/schema';
import {validateResearchFacts} from '../src/pipeline/bounded-research';
import {ideaFixture} from './helpers/comparison-editorial';
import {automationConfigSchema} from '../src/pipeline/topic-automation';
import {sampleQuantityBars} from '../src/shorts/quantity-bars';
import {evidenceExcerpt} from '../src/pipeline/research-web';
export function quantityFixture(metric='mass',unit='kg',values=[1,2,4,8]){
  return sizeDatasetSchema.parse({template:'size-comparison',id:`test-${metric}`,title:`Synthetic ${metric} comparison`,metric,unit,basis:'Synthetic fixture values only, one common measurement definition and shared conditions.',context:'Synthetic fixture, not researched real-world claims',countBasis:metric==='count'?'fixed':undefined,environment:'laboratory',items:values.map((value,i)=>({id:`reference-${i}`,label:`Reference ${String.fromCharCode(65+i)}`,value,color:['#73DDD1','#78AEFC','#C5A4FB','#FFBD77'][i%4],sourceIds:['s1'],visual:{kind:'box',widthToHeight:1,depthToHeight:1}})),sources:[{id:'s1',title:'Synthetic values for renderer tests only',url:'https://example.com/synthetic-fixture'}]});
}
test('all new measurements compile through the count-based silent pipeline without geometry scaling',()=>{
  const units={mass:'kg',count:'count',speed:'m/s',duration:'year',energy:'kWh',power:'W',temperature:'C'};
  for(const metric of quantityMetrics){
    const data=quantityFixture(metric,units[metric],metric==='temperature'?[-40,0,20,100]:[1,2,4,8]);
    const plan=planComparisonStory(data),input=previewInput(compileSizeComparison(data,defaultSizeEpisode(data)));
    assert.equal(plan.template,quantityTemplate(metric));assert.equal(plan.scaling.dimension,0);
    assert.ok(plan.scaling.objects.every(o=>o.width===1&&o.height===1));
    assert.deepEqual(plan.shots.slice(0,-1).map(s=>s.visible),data.items.map((_,i)=>data.items.slice(0,i+1).map((_,j)=>j)));
    assert.equal(plan.shots.at(-1)!.visible.length,data.items.length);
    assert.equal(input.presentation,'silent');assert.equal(shortDuration(input),defaultSizeEpisode(data).scenes.reduce((sum,s)=>sum+s.durationSeconds,0)*input.fps);
    assert.ok(automationConfigSchema.parse({niche:'Comparison test fixture',allowedMetrics:[metric],assetProvider:'unused'}));
  }
});
test('vertical bars reveal one subject at a time and keep previous values while reframing',()=>{
  const values=[1,2,4,8];
  const first=sampleQuantityBars(values,'mass',0,60,30);
  assert.deepEqual(first.bars.map(b=>b.visible),[true,false,false,false]);
  const arriving=sampleQuantityBars(values,'mass',1,0,30);
  assert.equal(arriving.bars[0].value,1);assert.equal(arriving.bars[1].opacity,0);
  const second=sampleQuantityBars(values,'mass',1,60,30);
  assert.equal(second.bars[0].value,1);assert.equal(second.bars[1].value,2);
  assert.equal(second.bars[1].height/second.bars[0].height,2);
  assert.equal(second.domain.max,2);assert.equal(second.zeroY,second.chart.top+second.chart.height);
  const final=sampleQuantityBars(values,'mass',3,60,30,true);
  assert.ok(final.bars.every(b=>b.visible&&b.opacity===1));assert.deepEqual(final.bars.map(b=>b.value),values);
  assert.equal(final.bars[3].height/final.bars[0].height,8);
});
test('signed temperature bars share zero, include negative values and handle all-zero quantities',()=>{
  const signed=sampleQuantityBars([-40,0,20,100],'temperature',3,90,30,true);
  assert.ok(signed.bars[0].endY>signed.zeroY);assert.ok(signed.bars[3].endY<signed.zeroY);
  assert.equal(signed.bars[1].height,0);assert.ok(Math.abs(signed.bars[3].height/signed.bars[0].height-2.5)<1e-10);
  const zero=sampleQuantityBars([0,0,0,0],'count',3,90,30,true);
  assert.ok(zero.bars.every(b=>b.height===0&&Number.isFinite(b.top)));
});
test('units distinguish mass, count, speed, duration, energy, power and affine temperature conversions',()=>{
  assert.equal(convertMeasurement(1,'t','kg'),1000);assert.equal(convertMeasurement(1,'kWh','J'),3600000);
  assert.equal(convertMeasurement(36,'km/h','m/s'),10);assert.equal(convertMeasurement(2,'h','min'),120);
  assert.equal(convertMeasurement(1.5,'million','count'),1500000);
  assert.ok(Math.abs(convertMeasurement(-40,'F','C')+40)<1e-9);assert.equal(convertMeasurement(0,'C','K'),273.15);
  assert.throws(()=>convertMeasurement(1,'W','J'),/Incompatible/);
  assert.throws(()=>convertMeasurement(-274,'C','K'),/absolute zero/);
});
test('temperature has a signed shared axis with differences and no Celsius ratio evidence',()=>{
  const data=quantityFixture('temperature','C',[-40,0,20,100]),plan=planComparisonStory(data);
  assert.deepEqual(quantityDomain(data.items.map(i=>i.value),'temperature'),{min:-40,max:100});
  assert.equal(plan.evidence.largestToSmallest,null);assert.ok(plan.shots.every(s=>s.metric==='difference'));
  assert.throws(()=>quantityFixture('temperature','K',[-1,0,20,100]),/absolute zero/);
  assert.throws(()=>quantityFixture('mass','kg',[-1,0,20,100]),/positive/);
});
test('population counts require dated scope while fixed counts may be undated; fractional individuals are rejected',()=>{
  const data=quantityFixture('count','count');
  assert.equal(sizeDatasetSchema.safeParse({...data,countBasis:'population'}).success,false);
  assert.equal(sizeDatasetSchema.safeParse({...data,countBasis:'population',asOf:'2026-01-01'}).success,true);
  assert.throws(()=>quantityFixture('count','count',[1,2,3.5,8]),/integers/);
  assert.equal(quantityDomain([0,0,0,0],'count').max,1);
});
test('quoted research converts signed temperatures and population multipliers; derived units are not misread',()=>{
  const concept={...ideaFixture().concepts[0],metric:'temperature' as const,unit:'C' as const,visualApproach:'temperature-axis' as const};
  const values=[-40,0,20,100],targets=values.map((_,i)=>`Reference ${i}`);
  const pages=values.map((value,i)=>({id:`s${i}`,url:`https://example.com/${i}`,title:'Synthetic evidence',text:`Reference ${i} has a temperature of ${value} degrees Celsius under the documented conditions.`}));
  const facts={measurements:values.map((value,i)=>({candidate:targets[i],sourceId:`s${i}`,quote:pages[i].text,sourceValue:value,sourceUnit:'C',conversion:'direct',qualifier:'Synthetic test'})),gaps:[]};
  assert.deepEqual(validateResearchFacts(facts,pages,concept,targets).measurements.map(m=>m.value),values);
  const energy={...concept,metric:'energy' as const,unit:'J' as const,visualApproach:'quantity-bars' as const};
  const invalid={measurements:values.map((_,i)=>({candidate:targets[i],sourceId:`s${i}`,quote:`Reference ${i} has a specific energy of 10 J/kg under documented conditions.`,sourceValue:10,sourceUnit:'J',conversion:'direct',qualifier:'Synthetic test'})),gaps:[]};
  assert.throws(()=>validateResearchFacts(invalid,pages.map((p,i)=>({...p,text:invalid.measurements[i].quote})),energy,targets),/quoted unit/);
});
test('source excerpts retain short infobox masses and measurements inside long paragraphs',()=>{
  const text=`Weight\n4 kg\n${'Unrelated introductory detail. '.repeat(120)}Adult males weigh 4000 kg. ${'Additional background. '.repeat(120)}`;
  const excerpt=evidenceExcerpt(text,'Animal mass',400);
  assert.ok(excerpt.includes('4 kg'));assert.ok(excerpt.includes('Adult males weigh 4000 kg.'));
});

test('a population date cannot be mistaken for the population value',()=>{
  const concept={...ideaFixture().concepts[0],metric:'count' as const,unit:'count' as const,visualApproach:'quantity-bars' as const};
  const targets=['A','B','C','D'];
  const pages=targets.map((name,i)=>({id:`s${i}`,url:`https://example.com/${i}`,title:'Synthetic population',text:`${name} population in 2024 was estimated at 3 million individuals.`}));
  const facts={measurements:targets.map((candidate,i)=>({candidate,sourceId:`s${i}`,quote:pages[i].text,sourceValue:2024,sourceUnit:'count',conversion:'direct',qualifier:'Synthetic year misread'})),gaps:[]};
  assert.throws(()=>validateResearchFacts(facts,pages,concept,targets),/quoted unit/);
  const corrected={measurements:facts.measurements.map(f=>({...f,sourceValue:3,sourceUnit:'million'})),gaps:[]};
  assert.ok(validateResearchFacts(corrected,pages,concept,targets).measurements.every(m=>m.value===3000000));
});

test('an adult comparison rejects a sourced newborn mass',()=>{
  const concept={...ideaFixture().concepts[0],metric:'mass' as const,unit:'kg' as const,visualApproach:'quantity-bars' as const,measurementBasis:'Adult body mass under common conditions'};
  const targets=['A','B','C','D'];
  const pages=targets.map((name,i)=>({id:`s${i}`,url:`https://example.com/${i}`,title:'Synthetic evidence',text:`At birth, the calf weighs about 100 kg.`}));
  const facts={measurements:targets.map((candidate,i)=>({candidate,sourceId:`s${i}`,quote:pages[i].text,sourceValue:100,sourceUnit:'kg',conversion:'direct',qualifier:'Birth weight'})),gaps:[]};
  assert.throws(()=>validateResearchFacts(facts,pages,concept,targets),/juvenile/);
});

test('eight-column overviews keep bar and image bounds inside the chart',()=>{
  const sample=sampleQuantityBars([1,2,3,4,5,6,7,8],'mass',7,90,30,true);
  for(const bar of sample.bars){
    assert.ok(bar.x-bar.width/2>=sample.chart.left);
    assert.ok(bar.x+bar.width/2<=sample.chart.left+sample.chart.width);
    assert.ok(bar.top>=sample.chart.top&&bar.top+bar.height<=sample.chart.top+sample.chart.height);
  }
});

test('chart-only subjects skip image planning and discard unused legacy image requests',async()=>{
  const {ensureComparisonImages}=await import('../src/pipeline/comparison-images');
  const original=quantityFixture();
  const withImages=sizeDatasetSchema.parse({...original,items:original.items.map(item=>({...item,visual:{kind:'cutout',src:`${item.id}.png`,view:'front',attribution:'Legacy image',referenceUrls:['https://example.com/reference'],generation:{prompt:'A complete isolated reference object with realistic shape and material, no labels or scenery.'}}}))});
  const chart=await ensureComparisonImages(withImages,{directory:'unused',model:'unused',log:()=>{},client:{chat:async()=>{throw new Error('Chart must not request image planning');}}});
  assert.deepEqual(chart.items.map(i=>i.value),original.items.map(i=>i.value));
  assert.ok(chart.items.every(i=>i.visual?.kind==='box'&&!i.appearance));
});

test('all allowed subject counts compile to count-based durations and counts outside 4–8 are rejected',()=>{
  for(let count=4;count<=8;count++){
    const data=quantityFixture('mass','kg',Array.from({length:count},(_,i)=>i+1));
    const input=previewInput(compileSizeComparison(data,defaultSizeEpisode(data)));
    assert.equal(input.scenes.length,count);assert.equal(shortDuration(input),defaultSizeEpisode(data).scenes.reduce((sum,s)=>sum+s.durationSeconds,0)*input.fps);
    assert.equal(planComparisonStory(data).shots.at(-1)!.visible.length,count);
  }
  assert.throws(()=>quantityFixture('mass','kg',[1,2,3]));
  assert.throws(()=>quantityFixture('mass','kg',Array.from({length:9},(_,i)=>i+1)));
});
