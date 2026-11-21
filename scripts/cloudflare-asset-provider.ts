import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import {z} from 'zod';
import {comparisonVisualSchema} from '../src/shorts/comparison-visual';
import {generateCloudflareImage,loadCloudflareImageConfig,type CloudflareImageModel} from '../src/pipeline/cloudflare-images';
import {inspectComparisonImage} from '../src/pipeline/comparison-assets';
import {cutoutBackend,cutoutMethod,removalCommand} from '../src/pipeline/background-removal';
import {comparisonWarningSink} from '../src/pipeline/comparison-warnings';
import {cutoutEdgeCount,framingRepairPrompt,reviewCutoutFraming} from '../src/pipeline/cutout-framing';
import {cloudflareObjectPrompt} from '../src/pipeline/comparison-images';

const requestSchema=z.object({outputDirectory:z.string(),objects:z.array(z.object({id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),label:z.string(),visual:comparisonVisualSchema}).passthrough())}).passthrough();
function command(program:string,args:string[],timeout=180000){
  const result=spawnSync(program,args,{encoding:'utf8',timeout,maxBuffer:1024*1024});
  if(result.error||result.status!==0)throw new Error(`${program} failed: ${result.error?.message??result.stderr.slice(-1200)}`);
}
async function main(){
  const {values,positionals}=parseArgs({allowPositionals:true,options:{model:{type:'string',default:'flux-2-klein-4b'},steps:{type:'string',default:'4'},'background-removal':{type:'string',default:'auto'},'cutout-model':{type:'string',default:'isnet-general-use'},python:{type:'string',default:process.env.BACKGROUND_REMOVAL_PYTHON??'python3'}}});
  if(positionals.length!==2)throw new Error('Expected asset request JSON and output manifest paths.');
  if(!['flux-1-schnell','flux-2-dev','flux-2-klein-4b'].includes(values.model!))throw new Error('Unsupported Cloudflare image model.');
  const model=values.model as CloudflareImageModel,steps=Number(values.steps);
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const request=requestSchema.parse(JSON.parse(readFileSync(positionals[0],'utf8'))),dir=path.resolve(request.outputDirectory);
  if(request.metric==='area')throw new Error('Area comparisons require real geographic outlines, not generated images. Configure an outline asset provider.');
  const backend=cutoutBackend(values['background-removal']!),method=cutoutMethod(backend,values['cutout-model']!);
  const script=path.join(root,backend==='rembg'?'scripts/remove-image-background.py':'scripts/remove-image-background.swift');
  const cutoutVersion=method+'/'+createHash('sha256').update(readFileSync(script)).digest('hex').slice(0,12);
  mkdirSync(dir,{recursive:true});const config=loadCloudflareImageConfig(path.join(root,'.env.local'));
  let cutoutTool:string|undefined;
  const visionTool=()=>{
    if(!cutoutTool){
      const source=path.join(root,'scripts/remove-image-background.swift'),digest=createHash('sha256').update(readFileSync(source)).digest('hex').slice(0,12);
      cutoutTool=path.join(root,'out','tools',`foreground-${digest}`);mkdirSync(path.dirname(cutoutTool),{recursive:true});
      if(!existsSync(cutoutTool))command('swiftc',['-module-cache-path',path.join(tmpdir(),'motion-lab-swift-cache'),source,'-o',cutoutTool]);
    }
    return cutoutTool;
  };
  const assets:{id:string;src:string;attribution:string}[]=[];
  const pending:{input:string;output:string;rawHash:string}[]=[];
  let newNeurons=0;
  for(const item of request.objects){
    const visual=item.visual;if(visual.kind==='box')continue;
    const brief=visual.generation?.prompt;if(!brief)throw new Error(`${item.label}: asset creation requires a generation prompt.`);
    const prompt=cloudflareObjectPrompt(item.label,visual.kind,brief);
    const width=1024,height=visual.kind==='sphere'?512:1024;
    const raw=path.join(dir,`${item.id}.jpg`),receipt=raw+'.report.json',target=path.join(dir,`${item.id}.png`);
    const previous=existsSync(raw)&&existsSync(receipt)?JSON.parse(readFileSync(receipt,'utf8')):null;
    const cached=previous&&previous.model===model&&previous.steps===steps&&(previous.basePrompt??previous.prompt)===prompt&&previous.width===width&&previous.height===height;
    if(!cached){
      console.log(`Generating ${item.label} with ${model}`);
      const result=await generateCloudflareImage({model,prompt,steps,width,height},config,fetch,{onRetry:console.log});
      writeFileSync(raw,result.bytes);writeFileSync(receipt,JSON.stringify({id:item.id,model,steps,prompt,width,height,actualNeurons:result.neurons,attempts:result.attempts,elapsedSeconds:result.elapsedSeconds,referenceImages:0},null,2)+'\n');
      newNeurons+=result.neurons??0;
    }else console.log(`Reusing ${item.label} generation`);
    const rawHash=createHash('sha256').update(readFileSync(raw)).digest('hex'),cutoutReceipt=target+'.receipt.json';
    const previousCutout=existsSync(cutoutReceipt)?JSON.parse(readFileSync(cutoutReceipt,'utf8')):null;
    const extraction=visual.kind==='sphere'?'static-raster':cutoutVersion;
    const prepared=existsSync(target)&&previousCutout?.rawHash===rawHash&&previousCutout?.method===extraction;
    if(!prepared){
      if(visual.kind==='sphere')command('ffmpeg',['-v','error','-y','-i',raw,'-frames:v','1',target]);
      else if(backend==='rembg')pending.push({input:raw,output:target,rawHash});
      else{
        command(visionTool(),[raw,target]);
      }
      if(visual.kind==='sphere'||backend==='vision')writeFileSync(cutoutReceipt,JSON.stringify({rawHash,method:extraction},null,2)+'\n');
    }
  }
  if(pending.length){
    const batch=path.join(dir,'background-removal-batch.json');writeFileSync(batch,JSON.stringify(pending,null,2)+'\n');
    const invocation=removalCommand(root,values.python!,batch,values['cutout-model']!);
    command(invocation.command,invocation.args,600000);
    for(const item of pending)writeFileSync(item.output+'.receipt.json',JSON.stringify({rawHash:item.rawHash,method:cutoutVersion},null,2)+'\n');
  }
  const warn=comparisonWarningSink(path.dirname(path.resolve(positionals[1])),console.log);
  let framingRetries=0;
  for(const item of request.objects){
    const visual=item.visual;if(visual.kind==='box')continue;
    const target=path.join(dir,`${item.id}.png`);
    const calibration=inspectComparisonImage(target,visual.kind==='cutout');
    if(visual.kind==='cutout'){
      const raw=path.join(dir,`${item.id}.jpg`),receipt=raw+'.report.json',cutoutReceipt=target+'.receipt.json';
      const repairFile=target+'.framing-repair.json';
      const rawHash=createHash('sha256').update(readFileSync(raw)).digest('hex');
      let priorRepair:{rawHash?:string}|undefined;
      try{if(existsSync(repairFile))priorRepair=JSON.parse(readFileSync(repairFile,'utf8'));}catch{/* Optional retry bookkeeping. */}
      const canRetry=cutoutEdgeCount(calibration)>0&&framingRetries<2&&priorRepair?.rawHash!==rawHash;
      await reviewCutoutFraming({label:item.label,calibration,warn,...(canRetry?{retry:async()=>{
        framingRetries++;
        // Persist before calling the provider so a resumed checkpoint cannot
        // repeatedly spend Neurons on the same boundary warning.
        writeFileSync(repairFile,JSON.stringify({rawHash,attempted:true})+'\n');
        const snapshots=[raw,receipt,target,cutoutReceipt].map(file=>({file,bytes:readFileSync(file)}));
        let retryNeurons:number|null=0;
        try{
          console.log(`Retrying ${item.label} framing with a wider empty margin`);
          const basePrompt=cloudflareObjectPrompt(item.label,'cutout',visual.generation!.prompt);
          const prompt=framingRepairPrompt(basePrompt);
          const result=await generateCloudflareImage({model,prompt,steps,width:1024,height:1024},config,fetch,{onRetry:console.log});
          newNeurons+=result.neurons??0;retryNeurons=result.neurons;
          const oldReceipt=JSON.parse(readFileSync(receipt,'utf8'));
          writeFileSync(raw,result.bytes);
          if(backend==='rembg'){
            const batch=path.join(dir,'framing-removal-batch.json');writeFileSync(batch,JSON.stringify([{input:raw,output:target}]));
            const invocation=removalCommand(root,values.python!,batch,values['cutout-model']!);command(invocation.command,invocation.args,600000);
          }else command(visionTool(),[raw,target]);
          const revised=inspectComparisonImage(target,true);
          if(cutoutEdgeCount(revised)>=cutoutEdgeCount(calibration)){
            for(const snapshot of snapshots)writeFileSync(snapshot.file,snapshot.bytes);
            warn(`${item.label}: framing retry did not reduce edge contact; keeping the original cutout.`);
            writeFileSync(repairFile,JSON.stringify({rawHash,attempted:true,discardedNeurons:result.neurons})+'\n');
            return calibration;
          }
          const nextHash=createHash('sha256').update(result.bytes).digest('hex');
          writeFileSync(receipt,JSON.stringify({...oldReceipt,basePrompt,prompt,actualNeurons:(oldReceipt.actualNeurons??0)+(result.neurons??0),elapsedSeconds:oldReceipt.elapsedSeconds+result.elapsedSeconds,framingRetry:true},null,2)+'\n');
          writeFileSync(cutoutReceipt,JSON.stringify({rawHash:nextHash,method:cutoutVersion})+'\n');
          writeFileSync(repairFile,JSON.stringify({rawHash:nextHash,attempted:true,neurons:result.neurons})+'\n');
          return revised;
        }catch(error){
          for(const snapshot of snapshots)writeFileSync(snapshot.file,snapshot.bytes);
          writeFileSync(repairFile,JSON.stringify({rawHash,attempted:true,discardedNeurons:retryNeurons})+'\n');
          throw error;
        }
      }}:{})});
    }
    assets.push({id:item.id,src:path.basename(target),attribution:`AI-generated with Cloudflare ${model}, ${steps} steps, text-only. ${visual.kind==='sphere'?'Local static texture':method}; illustrative, not an exact object scan.`});
  }
  writeFileSync(positionals[1],JSON.stringify({assets},null,2)+'\n');
  const receipts=request.objects.map(item=>{const file=path.join(dir,`${item.id}.jpg.report.json`);return existsSync(file)?JSON.parse(readFileSync(file,'utf8')):null;}).filter(Boolean);
  const discardedRetryNeurons=request.objects.reduce((sum,item)=>{const file=path.join(dir,`${item.id}.png.framing-repair.json`);try{return sum+(JSON.parse(readFileSync(file,'utf8')).discardedNeurons??0);}catch{return sum;}},0);
  writeFileSync(path.join(dir,'generation-summary.json'),JSON.stringify({model,steps,referenceImages:0,objects:receipts.length,newNeuronsThisInvocation:newNeurons,framingRetries,discardedRetryNeurons,totalReportedNeurons:discardedRetryNeurons+receipts.reduce((sum,r)=>sum+(r.actualNeurons??0),0),items:receipts.map(r=>({id:r.id,neurons:r.actualNeurons,seconds:r.elapsedSeconds}))},null,2)+'\n');
  console.log(`Prepared ${assets.length} assets; ${newNeurons.toFixed(2)} newly reported Neurons this invocation.`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Asset generation failed.');process.exitCode=1;});
