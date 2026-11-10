import {readFileSync,appendFileSync} from 'node:fs';
import {jobSchema} from '../../src/pipeline/topic-automation';
async function main(){
  const id=process.env.CURRENT_JOB_ID!;
  const job=JSON.parse(readFileSync('.automation/state.json','utf8')).jobs.find((j:{id:string})=>j.id===id);jobSchema.parse(job);
  const name=`checkpoint-${id}`,repo=process.env.GITHUB_REPOSITORY!,token=process.env.GITHUB_TOKEN!;
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo)||!token)throw new Error('Missing repository/token.');
  const get=async(route:string)=>{const r=await fetch(`https://api.github.com/repos/${repo}${route}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Checkpoint lookup HTTP ${r.status}`);return r.json();};
  const list=await get(`/actions/artifacts?name=${encodeURIComponent(name)}&per_page=100`);
  const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!,'utf8')),branch=event.repository.default_branch;
  for(const artifact of list.artifacts){
    if(artifact.name!==name||artifact.expired||Date.parse(artifact.created_at)<Date.parse(job.createdAt))continue;
    const run=await get(`/actions/runs/${artifact.workflow_run.id}`);
    if(run.path.split('@')[0]!=='.github/workflows/create-short.yml'||run.head_branch!==branch||run.head_repository.full_name.toLowerCase()!==repo.toLowerCase())continue;
    appendFileSync(process.env.GITHUB_OUTPUT!,`run_id=${run.id}\nartifact_name=${name}\n`);return;
  }
  appendFileSync(process.env.GITHUB_OUTPUT!,'run_id=\n');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
