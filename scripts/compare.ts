import {existsSync,readFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {compileSizeComparison,defaultSizeEpisode,comparisonEpisodeSchema} from '../src/pipeline/size-comparison';
import {formatRatio,sizeDatasetSchema} from '../src/shorts/size-data';
import {planComparisonStory} from '../src/pipeline/comparison-story';
import {prepareComparisonAssets} from '../src/pipeline/comparison-assets';
import {assetRequests,applyAssetManifest,runAssetProvider,generateComparisonData} from '../src/pipeline/comparison-run';
import {writeJson} from '../src/pipeline/stages';
import {planComparisonIdeas} from '../src/pipeline/comparison-ideas';

async function main(){
  const {values}=parseArgs({options:{data:{type:'string'},topic:{type:'string'},id:{type:'string'},episode:{type:'string'},'asset-root':{type:'string'},'asset-manifest':{type:'string'},'asset-provider':{type:'string'},'ideas-only':{type:'boolean'},'plan-only':{type:'boolean'},'prepare-only':{type:'boolean'},help:{type:'boolean'}}});
  if(values.help){console.log('npm run compare -- --data dataset.json [--asset-root directory] [--episode episode.json]\nPrompt: npm run compare -- --topic "Tallest structures" --id structure-run [--asset-provider provider.json]\nOptional: --ideas-only (topic input only; three concepts, no research/images/render), --asset-manifest manifest.json, --plan-only, --prepare-only.\nRepeat the same topic and ID to reuse saved stages.');return;}
  if(Boolean(values.data)===Boolean(values.topic))throw new Error('Provide exactly one of --data dataset.json or --topic.');
  if(values.topic&&!values.id)throw new Error('Prompt runs require --id so research and assets can be resumed.');
  if(values['asset-provider']&&values['asset-manifest'])throw new Error('Use either --asset-provider or --asset-manifest.');
  if(values['plan-only']&&values['prepare-only'])throw new Error('Choose either --plan-only or --prepare-only.');
  if(values['ideas-only']&&(!values.topic||values['plan-only']||values['prepare-only']||values['asset-provider']||values['asset-manifest']||values.episode))throw new Error('--ideas-only requires --topic and cannot be combined with asset, episode or render options.');
  const root=process.cwd(),read=(file:string)=>JSON.parse(readFileSync(path.resolve(file),'utf8'));
  let data=values.data?sizeDatasetSchema.parse(read(values.data)):undefined;
  const episode=values.episode?comparisonEpisodeSchema.parse(read(values.episode)):undefined;
  const id=values.id??episode?.id??defaultSizeEpisode(data!).id;
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)||id.length>60)throw new Error('Invalid episode ID.');
  const directory=path.resolve('out','comparisons',id);mkdirSync(directory,{recursive:true});
  const assetRoot=path.resolve(values['asset-root']??(values.data?path.dirname(path.resolve(values.data)):path.join(directory,'assets')));mkdirSync(assetRoot,{recursive:true});
  const statusPath=path.join(directory,'status.json');
  const preserveComplete=values['ideas-only']&&existsSync(statusPath)&&JSON.parse(readFileSync(statusPath,'utf8')).status==='complete';
  const status=(state:string,extra:Record<string,unknown>={})=>{if(!preserveComplete)writeJson(statusPath,{id,status:state,updatedAt:new Date().toISOString(),...extra});};
  try{
    status('preparing');
    if(values['ideas-only']){
      const ideas=await planComparisonIdeas({topic:values.topic!,id,directory,root,log:s=>process.stderr.write(s+'\n')});
      status('ideas-planned',{selectedId:ideas.selectedId});
      console.log(JSON.stringify({status:'ideas-planned',id,ideaPath:path.join(directory,'idea-plan.json'),selected:ideas.concepts.find(c=>c.id===ideas.selectedId),selectionReason:ideas.selectionReason}));return;
    }
    data??=await generateComparisonData({topic:values.topic!,id,directory,root,log:s=>process.stderr.write(s+'\n')});
    const requests=assetRequests(data);writeJson(path.join(directory,'asset-requests.json'),{...requests,outputDirectory:assetRoot});
    if(values['asset-manifest'])data=applyAssetManifest(data,read(values['asset-manifest']));
    else if(values['asset-provider'])data=runAssetProvider(data,{configFile:path.resolve(values['asset-provider']),directory,assetRoot,root});
    const missing=data.items.filter(item=>{
      const visual=item.visual;if(!visual||visual.kind==='box')return false;
      const src=visual.kind==='cutout'?visual.src:visual.texture;
      return !existsSync(path.join(assetRoot,src))&&!(visual.calibration&&existsSync(path.join(root,'public',src)));
    }).map(item=>item.id);
    if(missing.length){
      writeJson(path.join(directory,'dataset.raw.json'),data);status('needs-assets',{missing,assetRoot,requestPath:path.join(directory,'asset-requests.json')});
      console.log(JSON.stringify({status:'needs-assets',id,missing,assetRoot,requestPath:path.join(directory,'asset-requests.json'),dataPath:path.join(directory,'dataset.raw.json')}));return;
    }
    data=prepareComparisonAssets(data,{root,assetRoot,runId:id});writeJson(path.join(directory,'dataset.json'),data);
    const chosen={...(episode??defaultSizeEpisode(data)),id};
    const story=planComparisonStory(data),brief=compileSizeComparison(data,chosen);
    writeJson(path.join(directory,'episode.json'),chosen);writeJson(path.join(directory,'story-plan.json'),story);
    writeJson(path.join(directory,'background-plan.json'),story.background);
    writeJson(path.join(directory,'brief.json'),brief);
    writeJson(path.join(directory,'visual-manifest.json'),{presentation:brief.presentation,environment:story.environment,background:story.background,metric:data.metric,basis:data.basis,objects:data.items.map(item=>({id:item.id,renderer:item.visual?.kind??(item.appearance?'mapped-sphere':'procedural-sphere'),visual:item.visual??null,appearance:item.appearance??null,material:item.material,deterministic:true}))});
    writeJson(path.join(directory,'measurements.json'),{metric:data.metric,unit:data.unit,basis:data.basis,asOf:data.asOf,items:data.items.map((item,i)=>({...item,ratioToFirst:item.value/data!.items[0].value,ratioToPrevious:i?formatRatio(item.value/data!.items[i-1].value):'1x'}))});
    console.log(`Compiled ${id}: ${path.join(directory,'brief.json')}`);
    if(values['plan-only']){status('planned');console.log(JSON.stringify({status:'planned',id,briefPath:path.join(directory,'brief.json')}));return;}
    status(values['prepare-only']?'preparing':'rendering');
    const env={...process.env};delete env.GROQCLOUD_API_KEY;delete env.GROQ_API_KEY;
    const result=spawnSync(process.execPath,['--import','tsx','scripts/build-short.ts',...(values['prepare-only']?['--prepare-only']:[]),path.join(directory,'brief.json')],{stdio:'inherit',env});
    if(result.error||result.status!==0)throw new Error(result.error?.message??'Comparison build failed.');
    status(values['prepare-only']?'prepared':'complete');
    console.log(JSON.stringify({status:values['prepare-only']?'prepared':'complete',id,propsPath:path.join(root,'public','shorts',id,'video.json'),...(!values['prepare-only']?{videoPath:path.join(root,'out','shorts',id,`${id}.mp4`)}:{})}));
  }catch(error){status('failed',{error:error instanceof Error?error.message:'Comparison failed'});throw error;}
}
main().catch(error=>{console.error(error instanceof Error?error.message.replace('Retry later with --resume','Repeat the same topic and ID later to resume'):error);process.exitCode=1;});
