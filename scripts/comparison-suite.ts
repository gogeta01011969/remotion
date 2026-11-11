import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {parseArgs} from 'node:util';

const {values}=parseArgs({options:{only:{type:'string'},'prepare-only':{type:'boolean'}}});
const suite=JSON.parse(readFileSync('comparisons/examples/suite.json','utf8')) as {key:string;id:string;data:string;assetRoot:string;episode?:string}[];
if(values.only&&!suite.some(run=>run.key===values.only))throw new Error(`Unknown comparison. Choose ${suite.map(run=>run.key).join(', ')}.`);
for(const run of suite.filter(run=>!values.only||run.key===values.only)){
  console.log(`Comparison example: ${run.key}`);
  const result=spawnSync(process.execPath,['--import','tsx','scripts/compare.ts','--data',run.data,'--id',run.id,'--asset-root',run.assetRoot,...(run.episode?['--episode',run.episode]:[]),...(values['prepare-only']?['--prepare-only']:[])],{stdio:'inherit'});
  if(result.error||result.status!==0){process.exitCode=1;break;}
}
