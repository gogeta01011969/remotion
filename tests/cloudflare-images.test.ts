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

test('transient image failures retry the same request without changing the model or prompt',async()=>{
  const waits:number[]=[],logs:string[]=[];let calls=0;
  const result=await generateCloudflareImage({model:'flux-2-klein-4b',prompt:'An isolated flying fox bat',steps:4},config,async(_url,request)=>{
    calls++;assert.equal((request?.body as FormData).get('prompt'),'An isolated flying fox bat');
    return calls===1?new Response(JSON.stringify({success:false,errors:[{code:3043,message:'Image generation processing error'}]}),{status:500}):new Response(JSON.stringify({success:true,result:{image:jpeg.toString('base64')}}));
  },{sleep:async ms=>{waits.push(ms);},onRetry:message=>logs.push(message)});
  assert.equal(calls,2);assert.deepEqual(waits,[2000]);assert.equal(result.attempts,2);assert.deepEqual(result.bytes,jpeg);assert.match(logs[0],/retrying image request 2\/3/);
});
test('HTML server errors have a bounded three-request retry limit',async()=>{
  let calls=0;const waits:number[]=[];
  await assert.rejects(()=>generateCloudflareImage({model:'flux-2-klein-4b',prompt:'An isolated bat',steps:4},config,async()=>{calls++;return new Response('<html>Upstream error</html>',{status:502});},{sleep:async ms=>{waits.push(ms);}}),/HTTP 502/);
  assert.equal(calls,3);assert.deepEqual(waits,[2000,4000]);
});
test('image retries respect short Retry-After waits and defer long throttles without sleeping',async()=>{
  const waits:number[]=[];let calls=0;
  await generateCloudflareImage({model:'flux-2-klein-4b',prompt:'An isolated bat',steps:4},config,async()=>++calls===1?new Response('{"success":false}',{status:429,headers:{'Retry-After':'3'}}):new Response(JSON.stringify({image:jpeg.toString('base64')})),{sleep:async ms=>{waits.push(ms);}});
  assert.deepEqual(waits,[3000]);calls=0;
  await assert.rejects(()=>generateCloudflareImage({model:'flux-2-klein-4b',prompt:'An isolated bat',steps:4},config,async()=>{calls++;return new Response('{"success":false}',{status:429,headers:{'Retry-After':'120'}});},{sleep:async()=>{throw new Error('Do not sleep on long throttles');}}),/try again in 120000ms/);
  assert.equal(calls,1);
});
test('permanent errors and uncertain POST outcomes do not trigger duplicate generation requests',async()=>{
  for(const status of [400,401,403,404]){
    let calls=0;
    await assert.rejects(()=>generateCloudflareImage({model:'flux-2-klein-4b',prompt:'An isolated bat',steps:4},config,async()=>{calls++;return new Response('{"success":false}',{status});},{sleep:async()=>{throw new Error('Do not retry permanent errors');}}),new RegExp(`HTTP ${status}`));
    assert.equal(calls,1);
  }
  let calls=0;
  await assert.rejects(()=>generateCloudflareImage({model:'flux-2-klein-4b',prompt:'An isolated bat',steps:4},config,async()=>{calls++;throw new Error('Network timeout with unknown outcome');}),/unknown outcome/);
  assert.equal(calls,1);
});
