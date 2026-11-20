import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SizeOverviewSummary} from '../src/shorts/SizeOverviewSummary';
import {sizeDatasetSchema} from '../src/shorts/size-data';

const data=()=>sizeDatasetSchema.parse({template:'size-comparison',id:'endpoint-fixture',title:'Synthetic height comparison',metric:'height',unit:'m',basis:'Complete object height from ground to top',context:'Synthetic fixture',items:[1,2,4,8].map((value,i)=>({id:`object-${i}`,label:['Small tower','Middle A','Middle B','Big tower'][i],value,color:'#78AEFC',sourceIds:['s1'],visual:{kind:'box',widthToHeight:1,depthToHeight:1}})),sources:[{id:'s1',title:'Synthetic test values',url:'https://example.com'}]});
const render=(dataset:ReturnType<typeof data>)=>renderToStaticMarkup(createElement(SizeOverviewSummary,{data:dataset,opacity:1,measure:(text,size)=>text.length*size*.5}));
test('the physical overview identifies exactly the smallest and largest with their measurements',()=>{
  const markup=render(data());
  assert.equal((markup.match(/data-size-endpoint=/g)??[]).length,2);
  for(const text of ['Small tower','Big tower','1 m','8 m','Smallest','Largest'])assert.ok(markup.includes(text));
  assert.ok(!markup.includes('Middle A')&&!markup.includes('Middle B'));
});
test('endpoint measurements preserve approximate notation and the chosen unit display',()=>{
  const dataset=data();dataset.items[0].approximate=true;
  assert.ok(render(dataset).includes('≈ 1 m'));
});
test('bar-chart metrics cannot display the physical overview summary',()=>{
  const dataset=data();
  for(const [metric,unit] of [['mass','kg'],['count','count'],['speed','m/s'],['duration','s'],['energy','J'],['power','W'],['temperature','C']]){
    const quantity=sizeDatasetSchema.parse({...dataset,metric,unit,countBasis:metric==='count'?'fixed':undefined});
    assert.equal(render(quantity),'');
  }
});
