import {existsSync,readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {GitHubStateStore,type StateSnapshot} from '../../src/pipeline/github-state';
import {automationConfigSchema,initialLedger,ledgerSchema} from '../../src/pipeline/topic-automation';
import {writeJson} from '../../src/pipeline/stages';
async function main(){
  const directory=path.resolve('.automation');mkdirSync(directory,{recursive:true});
  const store=new GitHubStateStore({repository:process.env.GITHUB_REPOSITORY!,token:process.env.GITHUB_TOKEN!,baseCommit:process.env.GITHUB_SHA!});
  const state=path.join(directory,'state.json'),meta=path.join(directory,'github-state.json');
  if(process.argv[2]==='restore'){
    const restored=await store.load(),config=automationConfigSchema.parse(JSON.parse(readFileSync('automation/config.json','utf8')));
    writeJson(state,restored.ledger??initialLedger(config,process.cwd()));writeJson(meta,restored.snapshot);
  }else if(process.argv[2]==='save'){
    if(!existsSync(state)||!existsSync(meta))throw new Error('State must be restored before it can be saved.');
    const ledger=ledgerSchema.parse(JSON.parse(readFileSync(state,'utf8'))),snapshot=JSON.parse(readFileSync(meta,'utf8')) as StateSnapshot;
    writeJson(meta,await store.save(ledger,snapshot));
  }else throw new Error('Use restore or save.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
