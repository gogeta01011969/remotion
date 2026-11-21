import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {sizeDatasetSchema} from '../src/shorts/size-data';
import {finalizeComparisonPresentation} from '../src/pipeline/comparison-presentation';
import {cloudflareObjectPrompt,objectAppearanceBrief} from '../src/pipeline/comparison-images';
import {comparisonObjectTiming,quantityFrameTiming} from '../src/shorts/comparison-timing';
import {sampleQuantityBars} from '../src/shorts/quantity-bars';
import {chartNameLayout,denseQuantityLabels,labelColor} from '../src/shorts/quantity-labels';
import {compileSizeComparison,defaultSizeEpisode} from '../src/pipeline/size-comparison';
import {prepareSilentInput} from '../src/shorts/silent';
import {bindVerifiedMeasurements,type VerifiedMeasurement} from '../src/pipeline/bounded-research';

const fixture=(values=[55,104,320,320,334.7,420])=>sizeDatasetSchema.parse({template:'size-comparison',id:'speed-regression',title:'When a Fish Beats a Supercar',metric:'speed',unit:'km/h',basis:'Maximum burst speed for animals; certified top speed for vehicles and rockets.',asOf:'2023-01-01',context:'Animals and machines',environment:'sky',backgroundReason:'Birds and rockets',items:values.map((value,i)=>({id:`item-${i}`,label:['Sailfish','Cheetah','Golden eagle','Shinkansen','Eurostar','Bugatti Chiron'][i]??`Subject ${i}`,value,color:'#800080',sourceIds:['s1'],note:['maximum reported speed range endpoint','maximum reported speed','maximum diving speed','regular commercial maximum speed','record speed on 30 July 2003','electronically limited top speed'][i]??'Documented conditions',visual:{kind:'box',widthToHeight:1,depthToHeight:1}})),sources:[{id:'s1',title:'Synthetic regression measurements, not real-world evidence',url:'https://example.com/measurements'}]});
test('final presentation is evidence-bound, condition-aware, idempotent and source-preserving',()=>{
  const raw=fixture(),warnings:string[]=[];
  const data=finalizeComparisonPresentation(raw,m=>warnings.push(m));
  assert.notEqual(data.title,raw.title);assert.ok(!data.title.includes('Beats'));assert.equal(data.asOf,undefined);
  assert.ok(!data.backgroundReason?.includes('rockets'));assert.equal(data.items[2].conditionLabel,'Diving');assert.equal(data.items[3].conditionLabel,'Service speed');assert.equal(data.items[4].conditionLabel,'Record run');
  assert.deepEqual(data.items.map(i=>[i.value,i.sourceIds,i.note]),raw.items.map(i=>[i.value,i.sourceIds,i.note]));
  assert.deepEqual(finalizeComparisonPresentation(data),data);assert.deepEqual(finalizeComparisonPresentation(JSON.parse(JSON.stringify(data))),data);
  assert.equal(raw.title,'When a Fish Beats a Supercar');assert.ok(warnings.length>=2);
});
test('cutout instructions cannot inherit texture mapping, annotations or rulers from a legacy brief',()=>{
  for(const brief of ['Create a seamless 2:1 equirectangular texture of a car suitable for mapping onto a sphere.','A tree with a ruler and dimension annotations.']){
    const clean=objectAppearanceBrief('Actual researched identity','cutout',brief);
    assert.ok(clean.includes('Actual researched identity'));assert.doesNotMatch(clean,/equirectangular|ruler|annotation|mapping/);
    const prompt=cloudflareObjectPrompt('Actual researched identity','cutout',brief);assert.doesNotMatch(prompt,/equirectangular|mapping onto a sphere/);assert.ok(prompt.includes('empty margins'));
  }
  assert.match(cloudflareObjectPrompt('Earth','sphere','Realistic Earth surface'),/equirectangular/);
  assert.match(cloudflareObjectPrompt('Bird','cutout','Realistic bird','top'),/top-down orthographic.*fully extended wings/);
});
test('quantity growth is proportional above its floor, frame-rounded once, with protected holds at all frame rates',()=>{
  for(const values of [[0,0],[1,1],[1,1e12],[55,104,320,320,334.7,420],Array.from({length:15},(_,i)=>100+i)]){
    const data=fixture(values),brief=compileSizeComparison(data,defaultSizeEpisode(data));
    for(const fps of [24,30,60]){
      const input=prepareSilentInput(brief,fps),actor=input.actors[0];assert.equal(actor.kind,'size-comparison');if(actor.kind!=='size-comparison')continue;
      assert.ok(input.scenes.reduce((n,s)=>n+s.durationInFrames,0)<=90*fps);
      data.items.forEach((item,i)=>{
        const timing=comparisonObjectTiming(data,i),schedule=quantityFrameTiming(actor.quantityTiming![i].growthSeconds,fps,i===values.length-1);
        assert.equal(input.scenes[i].durationInFrames,schedule.durationInFrames);assert.ok(schedule.growthFrames>=fps);assert.equal(schedule.holdFrames,2.5*fps);
        const max=Math.max(...values);if(max&&3*Math.abs(item.value)/max>=1)assert.ok(Math.abs(schedule.growthFrames/fps-3*Math.abs(item.value)/max)<=1/fps);
        const mid=sampleQuantityBars(values,'speed',i,schedule.growthFrames/2,fps,false,schedule.growthFrames/fps);
        assert.ok(Math.abs(mid.bars[i].value-item.value/2)<1e-5*Math.max(1,item.value));
        const start=sampleQuantityBars(values,'speed',i,0,fps,false,timing.transitionSeconds),end=sampleQuantityBars(values,'speed',i,schedule.growthFrames,fps,false,schedule.growthFrames/fps);
        assert.deepEqual(start.domain,end.domain);assert.equal(end.bars[i].value,item.value);
        if(i)assert.equal(start.bars[i-1].height,end.bars[i-1].height);
      });
    }
  }
});
test('signed quantities and zero values stay on the same axis without ratio-derived timing',()=>{
  const data=sizeDatasetSchema.parse({...fixture([1,2,3,4]),items:fixture([1,2,3,4]).items.map((item,i)=>({...item,value:[-40,0,20,100][i]})),metric:'temperature',unit:'C'});
  for(const fps of [24,30,60])assert.doesNotThrow(()=>prepareSilentInput(compileSizeComparison(data,defaultSizeEpisode(data)),fps));
  const mid=sampleQuantityBars([-40,0,20,100],'temperature',0,15,30,false,1);
  assert.equal(mid.bars[0].value,-20);assert.ok(mid.bars[0].endY>mid.zeroY);
});
test('chart labels preserve complete tokens and automatically use wider alternating rows when needed',()=>{
  const measure=(s:string,size:number)=>s.length*size*.6;
  assert.deepEqual(chartNameLayout('Shinkansen',60,25,measure).lines,['Shinkansen']);
  const name=chartNameLayout('Golden eagle',80,25,measure);assert.deepEqual(name.lines,['Golden','eagle']);
  assert.equal(denseQuantityLabels(['Shinkansen','Sailfish','Cheetah','Golden eagle','Eurostar','Bugatti Chiron'],6,measure),true);
  assert.notEqual(labelColor('#800080'),'#800080');
});
test('an unsupported individual selection is omitted while verified candidates survive unchanged',()=>{
  const data=fixture([55,104]);
  const facts=data.items.map((i,n)=>({evidenceId:`f${n}`,candidate:i.label,sourceId:'s1',quote:`Synthetic ${i.value} km/h under documented conditions.`,sourceValue:i.value,sourceUnit:'km/h',conversion:'direct',qualifier:i.note,value:i.value,unit:'km/h'})) as VerifiedMeasurement[];
  const raw={...data,items:[...data.items.map((item,i)=>({...item,evidenceId:`f${i}`})),{id:'unsupported',label:'Unsupported',evidenceId:'unknown'}, {...data.items[0],id:'duplicate',evidenceId:'f0'}]};
  const warnings:string[]=[];
  const result=bindVerifiedMeasurements(raw,facts,{skipInvalid:true,warn:m=>warnings.push(m)}) as typeof data;
  assert.equal(result.items.length,2);assert.deepEqual(result.items.map(i=>i.value),[55,104]);assert.equal(warnings.length,2);
  assert.throws(()=>bindVerifiedMeasurements(raw,facts),/no verified measurement/);
});
