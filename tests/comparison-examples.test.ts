import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {sizeDatasetSchema,objectExtent,formatMeasurement,comparisonRuler} from '../src/shorts/size-data';
import {sampleSizeShots} from '../src/shorts/size-shots';
import {planComparisonStory} from '../src/pipeline/comparison-story';
import {geographicOutline} from '../src/pipeline/geographic-outline';

test('capacity cubes preserve cube-root ratios after oblique projection',()=>{
  const visual={kind:'box' as const,widthToHeight:1,depthToHeight:1,projection:'isometric' as const};
  const a=objectExtent({value:1,visual},'volume'),b=objectExtent({value:1000,visual},'volume');
  assert.ok(Math.abs(b.width/a.width-10)<1e-10);assert.ok(Math.abs(b.height/a.height-10)<1e-10);
  assert.ok(Math.abs(a.width-1.38)<1e-10);assert.ok(Math.abs(a.height-1.26)<1e-10);
});
test('microscopic and astronomical measurements remain readable and rulers calibrated',()=>{
  assert.equal(formatMeasurement(6e-8,'m',true),'60 nm');
  assert.equal(formatMeasurement(3e-5,'m',true),'30 µm');
  assert.equal(formatMeasurement(1.3914e9,'m',true),'1,391,400 km');
  for(const scale of [1e-12,1e-7,.01,1,1000,1e10]){
    const ruler=comparisonRuler(scale,'m');assert.ok(ruler.width>100&&ruler.width<400);
    assert.equal(ruler.width,ruler.value*scale);assert.ok(!ruler.label.startsWith('0 '));
  }
  const data=sizeDatasetSchema.parse(JSON.parse(readFileSync('comparisons/examples/zoom.json','utf8'))),plan=planComparisonStory(data);
  for(let phase=0;phase<=8;phase+=.025){
    const sample=sampleSizeShots(data.items,plan.shots,phase,'diameter');
    for(const body of sample.bodies)for(const value of [body.x,body.y,body.width,body.height])assert.ok(Number.isFinite(value));
    assert.ok(Math.abs(sample.bodies[7].width/sample.bodies[0].width-data.items[7].value/data.items[0].value)/(data.items[7].value/data.items[0].value)<1e-12);
  }
});
test('map projection preserves equal area and refuses unsplit date-line geometry',()=>{
  const rectangle=(lat:number)=>({type:'Polygon' as const,coordinates:[[[0,lat],[10,lat],[10,lat+10],[0,lat+10],[0,lat]]]});
  const equator=geographicOutline(rectangle(0),'#AABBCC'),north=geographicOutline(rectangle(60),'#AABBCC');
  // Normalize away raster fitting: polygon area follows spherical land area.
  const expected=(Math.sin(70*Math.PI/180)-Math.sin(60*Math.PI/180))/Math.sin(10*Math.PI/180);
  const area=(shape:ReturnType<typeof geographicOutline>)=>{
    const points=Array.from(shape.path.matchAll(/[ML]([\d.-]+),([\d.-]+)/g),m=>[Number(m[1]),Number(m[2])]);
    return Math.abs(points.reduce((sum,p,i)=>{const next=points[(i+1)%points.length];return sum+p[0]*next[1]-next[0]*p[1];},0)/2)/shape.scale**2;
  };
  assert.ok(Math.abs(area(north)/area(equator)-expected)<1e-5);
  assert.throws(()=>geographicOutline({type:'Polygon',coordinates:[[[179,0],[-179,0],[-179,10],[179,10]]]},'#AABBCC'),/antimeridian/);
});
