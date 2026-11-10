import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {sizeDatasetSchema,formatRatio} from '../src/shorts/size-data';
import {needsCountry,comparisonSubjectHint} from '../src/shorts/comparison-context';
import {placeSizeLabels} from '../src/shorts/size-labels';
import {planComparisonStory} from '../src/pipeline/comparison-story';
import statues from '../comparisons/tallest-statues-preview.json';
import balls from '../comparisons/sports-balls.json';
import type {MeasureText} from '../src/shorts/text-metrics';
const measure:MeasureText=(text,size,weight)=>Array.from(text).reduce((sum,c)=>sum+(c==='W'?.98:c==='i'?.25:.6)*size,0)*(weight>=650?1.04:1);

test('landmark comparisons require country metadata while other subjects stay uncluttered',()=>{
  const data=sizeDatasetSchema.parse(statues);
  assert.ok(needsCountry(data.subject));assert.ok(data.items.every(i=>i.country));
  const missing={...data,items:data.items.map((i,n)=>n?i:{...i,country:undefined})};
  assert.equal(sizeDatasetSchema.safeParse(missing).success,false);
  assert.equal(sizeDatasetSchema.safeParse({...missing,subject:'buildings'}).success,false);
  assert.equal(sizeDatasetSchema.safeParse({...missing,subject:'generic'}).success,true);
  assert.equal(needsCountry(sizeDatasetSchema.parse(balls).subject),false);
  assert.deepEqual(planComparisonStory({...data,items:data.items.map(item=>({...item,visual:{kind:'box',widthToHeight:.5,depthToHeight:.5}}))}).context.requiredFields,['country']);
});

test('country sublabels reserve width and vertical room in normal comparison shots',()=>{
  const items=[{label:'First statue',country:'United Kingdom'},{label:'Second statue',country:'China'}];
  const labels=placeSizeLabels(items,[{x:300,diameter:200,opacity:1},{x:600,diameter:250,opacity:1}],1,0,measure,{showCountry:true});
  assert.equal(labels.length,2);assert.ok(labels.every(l=>l.country));
  assert.ok(Math.abs(labels[0].y-labels[1].y)>=64);
  for(const label of labels)assert.ok(label.width>=measure(label.country!,label.countryFontSize!,500));
});

test('size ratios use a literal x suffix',()=>{
  assert.equal(formatRatio(1.08),'1.08x');assert.equal(formatRatio(2),'2x');
  assert.ok(!formatRatio(1e12).includes('×'));
});

test('unambiguous statue and building topics require landmark context during AI planning',()=>{
  assert.equal(comparisonSubjectHint('Tallest statues in the world'),'statues');
  assert.equal(comparisonSubjectHint('Height comparison of skyscrapers'),'buildings');
  assert.equal(comparisonSubjectHint('Statues compared with buildings'),undefined);
  assert.equal(comparisonSubjectHint('Sports ball sizes'),undefined);
});
