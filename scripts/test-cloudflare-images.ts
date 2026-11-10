import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {generateCloudflareImage,loadCloudflareImageConfig,type CloudflareImageModel} from '../src/pipeline/cloudflare-images';

async function main(){
  const {values}=parseArgs({options:{model:{type:'string',default:'flux-1-schnell'},'prompt-file':{type:'string'},reference:{type:'string'},steps:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
  if(values.help){console.log('npm run image:test -- --prompt-file prompt.txt --output out/test.jpg [--model flux-1-schnell|flux-2-dev|flux-2-klein-4b] [--steps N] [--reference reference-512.png]');return;}
  if(!['flux-1-schnell','flux-2-dev','flux-2-klein-4b'].includes(values.model!))throw new Error('Unsupported test model.');
  if(!values['prompt-file']||!values.output)throw new Error('Provide --prompt-file and --output.');
  const config=loadCloudflareImageConfig(),model=values.model as CloudflareImageModel;
  const prompt=readFileSync(values['prompt-file'],'utf8').trim(),steps=values.steps?Number(values.steps):model==='flux-2-dev'?20:4;
  const result=await generateCloudflareImage({model,prompt,steps,references:values.reference?[readFileSync(values.reference)]:undefined},config);
  mkdirSync(path.dirname(values.output),{recursive:true});writeFileSync(values.output,result.bytes);
  const report={model,steps,prompt,reference:values.reference??null,imagePath:values.output,width:result.width,height:result.height,neurons:result.neurons,elapsedSeconds:result.elapsedSeconds,bytes:result.bytes.length,contentType:result.contentType};
  writeFileSync(`${values.output}.report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Cloudflare image test failed.');process.exitCode=1;});
