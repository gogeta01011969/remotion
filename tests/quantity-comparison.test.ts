import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {sizeDatasetSchema} from '../src/shorts/size-data';
import {convertMeasurement,quantityDomain,quantityTemplate,quantityMetrics,sampleRace,countDots,quantityAnimation} from '../src/shorts/measurements';
import {compileSizeComparison,defaultSizeEpisode} from '../src/pipeline/size-comparison';
import {planComparisonStory} from '../src/pipeline/comparison-story';
import {previewInput} from '../src/shorts/defaults';
import {shortDuration} from '../src/shorts/schema';
import {validateResearchFacts} from '../src/pipeline/bounded-research';
import {ideaFixture} from './helpers/comparison-editorial';
import {automationConfigSchema} from '../src/pipeline/topic-automation';
import {evidenceExcerpt} from '../src/pipeline/research-web';
export function quantityFixture(metric='mass',unit='kg',values=[1,2,4,8]){
  return sizeDatasetSchema.parse({template:'size-comparison',id:`test-${metric}`,title:`Synthetic ${metric} comparison`,metric,unit,basis:'Synthetic fixture values only, one common measurement definition and shared conditions.',context:'Synthetic fixture, not researched real-world claims',countBasis:metric==='count'?'fixed':undefined,environment:'laboratory',items:values.map((value,i)=>({id:`reference-${i}`,label:`Reference ${String.fromCharCode(65+i)}`,value,color:['#73DDD1','#78AEFC','#C5A4FB','#FFBD77'][i],sourceIds:['s1'],visual:{kind:'box',widthToHeight:1,depthToHeight:1}})),sources:[{id:'s1',title:'Synthetic values for renderer tests only',url:'https://example.com/synthetic-fixture'}]});
}
test('all new measurements compile through the existing silent 30-second pipeline without geometry scaling',()=>{
  const units={mass:'kg',count:'count',speed:'m/s',duration:'year',energy:'kWh',power:'W',temperature:'C'};
  for(const metric of quantityMetrics){
    const data=quantityFixture(metric,units[metric],metric==='temperature'?[-40,0,20,100]:[1,2,4,8]);
    const plan=planComparisonStory(data),input=previewInput(compileSizeComparison(data,defaultSizeEpisode(data)));
    assert.equal(plan.template,quantityTemplate(metric));assert.equal(plan.scaling.dimension,0);
    assert.ok(plan.scaling.objects.every(o=>o.width===1&&o.height===1));
    assert.ok(plan.shots.every(shot=>shot.visible.length===data.items.length));
    assert.equal(input.presentation,'silent');assert.equal(shortDuration(input),900);
    assert.ok(automationConfigSchema.parse({niche:'Comparison test fixture',allowedMetrics:[metric],assetProvider:'unused'}));
  }
});
test('all quantities use one continuous clock with a shared entrance and a final reading hold',()=>{
  const sample=(seconds:number)=>quantityAnimation(seconds*30,30,900);
  assert.equal(sample(0).progress,0);
  assert.equal(sample(.6).entrance,1);
  assert.equal(sample(3).progress,0);
  // Old per-object scene boundaries must not restart the values.
  const samples=[5,7,10,14,20,22,25.5,29].map(sample);
  assert.ok(samples.every((s,i)=>i===0||s.progress>=samples[i-1].progress));
  assert.equal(sample(25.5).progress,1);assert.equal(sample(29).progress,1);
  assert.equal(quantityAnimation(18,60,1800).entrance,sample(.3).entrance);
  assert.equal(quantityAnimation(900,60,1800).progress,sample(15).progress);
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
test('a race uses one clock and correct constant-speed distances independent of video timing',()=>{
  const sample=sampleRace([36,72],'km/h',100,.5);
  assert.equal(sample.elapsedSeconds,2.5);assert.deepEqual(sample.distances,[25,50]);assert.deepEqual(sample.fractions,[.25,.5]);
  assert.deepEqual(sampleRace([0,0],'m/s',100,1).distances,[0,0]);
});
test('count grids represent huge populations with bounded groups and honest partial dots',()=>{
  const plan=countDots(6,88);assert.equal(plan.perDot,10);assert.deepEqual(plan.fills,[.6]);
  const huge=countDots(8000000000,8000000000);assert.ok(huge.fills.length<=80);assert.equal(huge.fills.reduce((n,v)=>n+v,0)*huge.perDot,8000000000);
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
  const concept={...ideaFixture().concepts[0],metric:'count' as const,unit:'count' as const,visualApproach:'count-grid' as const};
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
