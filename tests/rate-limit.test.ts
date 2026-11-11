import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {durationMs,messageRetryMs,retryAfterMs} from '../src/pipeline/rate-limit';
import {quotaDeferral} from '../src/pipeline/quota-retry';
import {GroqClient} from '../src/pipeline/groq';
const request={model:'test',messages:[],max_completion_tokens:100,temperature:0};
const success=()=>Response.json({choices:[{message:{content:'{}'}}]});

test('milliseconds never match minutes, including decimals and compound reset durations',()=>{
  assert.equal(durationMs('525ms'),525);
  assert.equal(durationMs('1m525ms'),60525);
  assert.equal(durationMs('1h2m3.5s'),3723500);
  assert.equal(messageRetryMs('Please try again in 525ms.'),525);
  assert.equal(messageRetryMs('Please try again in 0.525s.'),525);
  assert.equal(messageRetryMs('Please try again in 525mss.'),null);
  assert.equal(retryAfterMs('0.525'),525);
  assert.equal(retryAfterMs('Thu, 01 Jan 2026 00:00:01 GMT',Date.parse('2026-01-01T00:00:00Z')),1000);
  const now=Date.parse('2026-01-01T00:00:00Z');
  assert.equal(quotaDeferral('HTTP 429 tokens per minute. Please try again in 525ms.',now),new Date(now+60000).toISOString());
});
test('the reported 525ms TPM error is retried in the same invocation without a job deferral',async()=>{
  const delays:number[]=[];let calls=0;
  const client=new GroqClient({apiKey:'test',sleep:async ms=>{delays.push(ms);},fetcher:async()=>++calls===1?Response.json({error:{message:'Rate limit reached on tokens per minute (TPM): Limit 8000, Used 2620, Requested 5450. Please try again in 525ms.'}},{status:429}):success()});
  await client.chat(request);assert.equal(calls,2);assert.deepEqual(delays,[1000]);
});
test('short repeated throttles get bounded increasing waits, while daily waits defer immediately',async()=>{
  const delays:number[]=[];let calls=0;
  const client=new GroqClient({apiKey:'test',sleep:async ms=>{delays.push(ms);},fetcher:async()=>++calls<5?Response.json({error:{message:'Please try again in 525ms.'}},{status:429}):success()});
  await client.chat(request);assert.equal(calls,5);assert.deepEqual(delays,[1000,2000,4000,8000]);
  const daily=new GroqClient({apiKey:'test',sleep:async()=>{assert.fail('Must not wait for daily quota');},fetcher:async()=>Response.json({error:{message:'Tokens per day exhausted. Please try again in 2h.'}},{status:429})});
  await assert.rejects(()=>daily.chat(request),/wait longer than 60 seconds/);
});
test('persistent throttling stops after six responses and uses no more than two minutes of retry waits',async()=>{
  const delays:number[]=[];let calls=0;
  const client=new GroqClient({apiKey:'test',sleep:async ms=>{delays.push(ms);},fetcher:async()=>{calls++;return Response.json({error:{message:'Please try again in 525ms.'}},{status:429});}});
  await assert.rejects(()=>client.chat(request),/HTTP 429/);assert.equal(calls,6);assert.ok(delays.reduce((n,d)=>n+d,0)<=120000);
});
test('successful token headers pace the next request and do not leak internal stage labels',async()=>{
  let time=1000,calls=0;const delays:number[]=[];
  const client=new GroqClient({apiKey:'test',now:()=>time,sleep:async ms=>{delays.push(ms);time+=ms;},fetcher:async(_url,init)=>{
    assert.equal(JSON.parse(String(init?.body)).stageLabel,undefined);
    calls++;return calls===1?Response.json({choices:[{message:{content:'{}'}}]},{headers:{'x-ratelimit-remaining-tokens':'0','x-ratelimit-limit-tokens':'8000','x-ratelimit-reset-tokens':'1s'}}):success();
  }});
  await client.chat({...request,stageLabel:'test-internal'});await client.chat({...request,max_completion_tokens:500});
  assert.equal(calls,2);assert.deepEqual(delays,[1250]);
});
