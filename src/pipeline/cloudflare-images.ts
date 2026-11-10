import {existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {redact} from './groq';

export type CloudflareImageModel='flux-1-schnell'|'flux-2-dev'|'flux-2-klein-4b';
export function loadCloudflareImageConfig(filename='.env.local'){
  if(existsSync(filename))loadEnvFile(filename);
  // Preserve compatibility with the names already present in this workspace.
  const accountId=process.env.CLOUDFLARE_ACCOUNT_ID??process.env.CLOUDFARE_ACCOUNT_ID;
  const apiToken=process.env.CLOUDFLARE_API_TOKEN??process.env.CLOUDFARE_API_TOKEN;
  if(!accountId||!apiToken)throw new Error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in .env.local (CLOUDFARE aliases are also accepted).');
  return {accountId,apiToken};
}
// Pricing verified against Cloudflare docs and live cf-ai-neurons responses.
// Costs are per generated asset, not per video frame or second.
export function estimateImageNeurons(model:CloudflareImageModel,steps:number,width=1024,height=1024,inputSizes:{width:number;height:number}[]=[]){
  const tiles=(w:number,h:number)=>w*h/(512*512);
  if(model==='flux-2-klein-4b')return 26.05*tiles(width,height)+5.37*inputSizes.reduce((sum,s)=>sum+tiles(s.width,s.height),0);
  return model==='flux-1-schnell'?tiles(width,height)*(4.8+9.6*steps):steps*(37.5*tiles(width,height)+18.75*inputSizes.reduce((sum,s)=>sum+tiles(s.width,s.height),0));
}
export async function generateCloudflareImage(options:{model:CloudflareImageModel;prompt:string;steps:number;width?:number;height?:number;references?:Buffer[]},config:ReturnType<typeof loadCloudflareImageConfig>,fetcher:typeof fetch=fetch){
  if(!options.prompt.trim()||options.prompt.length>2048)throw new Error('Image prompt must contain 1–2048 characters.');
  if(!Number.isInteger(options.steps)||options.steps<1||options.steps>(options.model==='flux-1-schnell'?8:50))throw new Error('Invalid model inference-step count.');
  if(options.model==='flux-2-klein-4b'&&options.steps!==4)throw new Error('Klein 4B has a fixed 4-step process.');
  if(options.references?.length&&options.model==='flux-1-schnell')throw new Error('Schnell does not accept reference images. Use FLUX.2 Dev or Klein 4B.');
  if((options.references?.length??0)>4)throw new Error('FLUX.2 models accept at most four references; resize each to <=512×512 before sending.');
  const width=options.width??1024,height=options.height??1024;
  if(options.model==='flux-1-schnell'&&(width!==1024||height!==1024))throw new Error('The tested Schnell endpoint uses a fixed 1024×1024 output.');
  if(options.model!=='flux-1-schnell'&&[width,height].some(n=>!Number.isInteger(n)||n<256||n>1920))throw new Error('FLUX.2 image dimensions must be 256–1920 pixels.');
  const headers:Record<string,string>={Authorization:`Bearer ${config.apiToken}`};
  let body:string|FormData;
  if(options.model==='flux-1-schnell'){
    headers['Content-Type']='application/json';body=JSON.stringify({prompt:options.prompt,steps:options.steps});
  }else{
    const form=new FormData();for(const [key,value] of Object.entries({prompt:options.prompt,width,height,...(options.model==='flux-2-dev'?{steps:options.steps}:{})}))form.append(key,String(value));
    options.references?.forEach((bytes,i)=>form.append(`input_image_${i}`,new Blob([new Uint8Array(bytes)]),`reference-${i}.png`));body=form;
  }
  const started=Date.now();
  const response=await fetcher(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/@cf/black-forest-labs/${options.model}`,{method:'POST',headers,body,signal:AbortSignal.timeout(180000)});
  const json=await response.json();
  if(!response.ok||json.success===false)throw new Error(redact(`Cloudflare image request failed (HTTP ${response.status}): ${JSON.stringify(json.errors??[])}`,[config.accountId,config.apiToken]).slice(0,1200));
  const encoded=json.result?.image??json.image;
  if(typeof encoded!=='string'||!encoded.length)throw new Error('Cloudflare returned no image.');
  const bytes=Buffer.from(encoded,'base64');
  const valid=bytes.subarray(0,3).equals(Buffer.from([255,216,255]))||bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(!valid)throw new Error('Cloudflare output is not a recognized JPEG or PNG.');
  const header=response.headers.get('cf-ai-neurons'),usage=json.result?.usage?.neurons??json.usage?.neurons;
  const neurons=header!==null?Number(header):typeof usage==='number'?usage:null;
  return {bytes,neurons:neurons!==null&&Number.isFinite(neurons)?neurons:null,elapsedSeconds:(Date.now()-started)/1000,contentType:bytes[0]===255?'image/jpeg':'image/png',width,height};
}
