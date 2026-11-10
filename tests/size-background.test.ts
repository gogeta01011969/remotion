import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {sizeDatasetSchema} from '../src/shorts/size-data';
import {resolveSizeBackground,sizeEnvironments} from '../src/shorts/size-environment';
import {ComparisonBackground} from '../src/shorts/ComparisonBackground';
import {compileSizeComparison,defaultSizeEpisode} from '../src/pipeline/size-comparison';
import {planComparisonStory} from '../src/pipeline/comparison-story';

const data=(title:string,subject='generic')=>sizeDatasetSchema.parse({template:'size-comparison',id:'background-test',title,subject,metric:'height',unit:'m',basis:'Synthetic height references for background selection.',context:'Synthetic setting test',items:[1,2,3,4].map((value,i)=>({id:`item-${i}`,label:`Object ${i}`,value,color:'#AABBCC',sourceIds:['s1'],visual:{kind:'box',widthToHeight:.5,depthToHeight:.5}})),sources:[{id:'s1',title:'Synthetic test data',url:'https://example.com/source'}]});

test('automatic backgrounds follow the episode concept across supported subjects',()=>{
  for(const [title,expected] of [
    ['Flying objects: birds to airships','sky'],['Aircraft through history','sky'],
    ['Ships from small to enormous','water'],['Reservoir capacities','water'],
    ['Tallest structures worldwide','architecture'],['Forest tree heights','nature'],
    ['Country land area comparison','geography'],['Container capacity models','storage'],
    ['Microscopic particles compared','laboratory'],['Microscopic to astronomical scale','space'],
    ['Basketball and other sports balls','sports'],['Unclassified physical dimensions','studio'],
  ])assert.equal(resolveSizeBackground(data(title)).environment,expected,title);
  assert.equal(resolveSizeBackground(data('Ground vehicle lengths','vehicles')).environment,'transport');
  assert.equal(resolveSizeBackground(data('Objects bearing the name Moon','geography')).environment,'geography');
});

test('an explicit shared setting and rationale survive story planning and compiled Studio props',()=>{
  const raw={...data('Flying objects'),environment:'sky',backgroundReason:'One shared atmosphere connects birds, aircraft and airships throughout the episode.'};
  const parsed=sizeDatasetSchema.parse(raw),plan=planComparisonStory(parsed),brief=compileSizeComparison(parsed,defaultSizeEpisode(parsed));
  assert.equal(plan.background.source,'planned');assert.equal(plan.background.reason,raw.backgroundReason);
  const actor=brief.actors[0];assert.equal(actor.kind,'size-comparison');
  if(actor.kind==='size-comparison'){assert.equal(actor.data.environment,'sky');assert.equal(actor.data.backgroundReason,raw.backgroundReason);}
  const automatic=compileSizeComparison(data('Flying objects'),defaultSizeEpisode(data('Flying objects')));
  if(automatic.actors[0].kind==='size-comparison')assert.equal(automatic.actors[0].data.environment,'sky');
  assert.equal(resolveSizeBackground({...parsed,environment:'studio'}).environment,'studio');
});

test('every procedural background is deterministic under seeking and leaves text to the foreground',()=>{
  for(const preset of sizeEnvironments){
    const render=(frame:number)=>renderToStaticMarkup(createElement(ComparisonBackground,{preset,frame,fps:30,seed:42}));
    const expected=render(120);render(480);render(0);
    assert.equal(render(120),expected,preset);
    assert.ok(expected.includes(`data-comparison-background="${preset}"`));
    assert.ok(expected.includes('comparison-quiet-zones'));
    assert.ok(!expected.includes('<text'),preset);
    if(['sky','water','laboratory'].includes(preset))assert.notEqual(render(450),expected);
  }
});
