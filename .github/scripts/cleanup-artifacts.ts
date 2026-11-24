import {appendFileSync} from 'node:fs';
import {GitHubArtifactCleaner} from '../../src/pipeline/artifact-cleanup';
import {GitHubStateStore} from '../../src/pipeline/github-state';
async function main(){
  const repository=process.env.GITHUB_REPOSITORY!,token=process.env.GITHUB_TOKEN!;
  const state=await new GitHubStateStore({repository,token,baseCommit:process.env.GITHUB_SHA!}).load();
  const uploaded=new Set(state.ledger?.jobs.filter(j=>j.youtube?.status==='uploaded').map(j=>j.id)??[]);
  const result=await new GitHubArtifactCleaner({repository,token}).clean({uploaded,...(process.argv.includes('--finished-generation')?{finishedRun:Number(process.env.GITHUB_RUN_ID)}:{})});
  console.log(JSON.stringify(result));
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`\n### Artifact storage cleanup\n\nRemoved ${result.removedArtifacts} artifacts (${(result.removedBytes/1048576).toFixed(1)} MiB). Remaining managed artifacts: ${(result.remainingManagedBytes/1048576).toFixed(1)} MiB. Pending removals: ${result.pendingRemovals}.\n`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Artifact cleanup failed');process.exitCode=1;});
