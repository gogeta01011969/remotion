import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {estimateImageNeurons,generateCloudflareImage} from '../src/pipeline/cloudflare-images';
const config={accountId:'test-account',apiToken:'test-token'};
const jpeg=Buffer.from([255,216,255,0]);
test('Neuron estimates match live measured Schnell and Dev configurations',()=>{
  assert.ok(Math.abs(estimateImageNeurons('flux-1-schnell',4)-172.8)<1e-8);
  assert.equal(estimateImageNeurons('flux-2-dev',20),3000);
  assert.equal(estimateImageNeurons('flux-2-dev',20,1024,1024,[{width:288,height:512}]),3210.9375);
});
test('Schnell sends the live accepted schema and records actual Neurons',async()=>{
  const result=await generateCloudflareImage({model:'flux-1-schnell',prompt:'An isolated ball',steps:4},config,async(_url,request)=>{
    assert.equal((request?.headers as Record<string,string>).Authorization,'Bearer test-token');
    assert.deepEqual(JSON.parse(request!.body as string),{prompt:'An isolated ball',steps:4});
    return new Response(JSON.stringify({success:true,result:{image:jpeg.toString('base64')}}),{headers:{'Content-Type':'application/json','cf-ai-neurons':'172.80'}});
  });assert.equal(result.neurons,172.8);assert.deepEqual(result.bytes,jpeg);
});
test('Dev uses multipart references and preserves the measured usage response',async()=>{
  const result=await generateCloudflareImage({model:'flux-2-dev',prompt:'Use the reference',steps:20,references:[jpeg]},config,async(_url,request)=>{
    const body=request?.body as FormData;assert.ok(body instanceof FormData);assert.equal(body.get('steps'),'20');assert.ok(body.get('input_image_0') instanceof Blob);
    return new Response(JSON.stringify({success:true,result:{image:jpeg.toString('base64')}}),{headers:{'Content-Type':'application/json','cf-ai-neurons':'3375.00'}});
  });assert.equal(result.neurons,3375);
});
test('provider failures redact credentials and unsupported reference inputs fail before a request',async()=>{
  await assert.rejects(()=>generateCloudflareImage({model:'flux-1-schnell',prompt:'A ball',steps:4},config,async()=>new Response(JSON.stringify({success:false,errors:[{message:'test-account test-token rejected'}]}),{status:403,headers:{'Content-Type':'application/json'}})),error=>{
    assert.ok(error instanceof Error);assert.ok(!error.message.includes('test-token')&&!error.message.includes('test-account'));return true;
  });
  await assert.rejects(()=>generateCloudflareImage({model:'flux-1-schnell',prompt:'A ball',steps:4,references:[jpeg]},config),/reference images/);
});

test('Klein uses fixed-step multipart generation and per-image pricing',async()=>{
  assert.ok(Math.abs(estimateImageNeurons('flux-2-klein-4b',4)-104.2)<1e-8);
  await assert.rejects(()=>generateCloudflareImage({model:'flux-2-klein-4b',prompt:'A statue',steps:20},config),/fixed 4-step/);
  const result=await generateCloudflareImage({model:'flux-2-klein-4b',prompt:'A statue',steps:4},config,async(_url,request)=>{
    const body=request?.body as FormData;assert.ok(body instanceof FormData);assert.equal(body.get('steps'),null);assert.equal(body.get('width'),'1024');
    return new Response(JSON.stringify({success:true,result:{image:jpeg.toString('base64')}}),{headers:{'Content-Type':'application/json','cf-ai-neurons':'104.20'}});
  });assert.equal(result.neurons,104.2);
});
