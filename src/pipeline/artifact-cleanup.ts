// Storage policy applies only to this application's known artifact names.
export type ManagedArtifact={id:number;name:string;size_in_bytes:number;created_at:string;workflow_run?:{id:number}};
export const artifactStoragePolicy={maximumBytes:128*1024*1024,maximumArtifacts:20,recoveryHours:72,diagnosticHours:24} as const;
const jobId='short-[a-z0-9-]+';
export function artifactKind(name:string){
  const checkpoint=name.match(new RegExp(`^checkpoint-(${jobId})$`));if(checkpoint)return {kind:'checkpoint' as const,jobId:checkpoint[1]};
  const video=name.match(new RegExp(`^short-(${jobId})$`));if(video)return {kind:'video' as const,jobId:video[1]};
  if(/^(?:automation-result|linux-smoke)-\d+-\d+$/.test(name))return {kind:'diagnostic' as const,jobId:undefined};
  return null;
}
export function planArtifactCleanup(artifacts:ManagedArtifact[],uploaded:Set<string>,protectedRuns:Set<number>,now=Date.now()){
  const managed=artifacts.filter(a=>artifactKind(a.name));
  const removals=new Map<number,{artifact:ManagedArtifact;reason:string}>();
  const remove=(artifact:ManagedArtifact,reason:string)=>removals.set(artifact.id,{artifact,reason});
  const safe=managed.filter(a=>!protectedRuns.has(a.workflow_run?.id??0));
  for(const a of managed){const type=artifactKind(a.name)!;
    if(type.jobId&&uploaded.has(type.jobId))remove(a,'YouTube upload confirmed');
  }
  const newestCheckpoints=new Set<string>();
  for(const a of [...safe].sort((a,b)=>b.created_at.localeCompare(a.created_at))){
    const type=artifactKind(a.name)!;
    const ttl=type.kind==='diagnostic'?artifactStoragePolicy.diagnosticHours:artifactStoragePolicy.recoveryHours;
    if(now-Date.parse(a.created_at)>ttl*3600000)remove(a,'retention window expired');
    if(type.kind==='checkpoint'){
      if(newestCheckpoints.has(type.jobId!))remove(a,'superseded checkpoint');
      newestCheckpoints.add(type.jobId!);
    }
  }
  const kept=()=>managed.filter(a=>!removals.has(a.id));
  for(const a of [...safe].sort((a,b)=>a.created_at.localeCompare(b.created_at))){
    if(kept().length<=artifactStoragePolicy.maximumArtifacts&&kept().reduce((sum,a)=>sum+a.size_in_bytes,0)<=artifactStoragePolicy.maximumBytes)break;
    if(!removals.has(a.id))remove(a,'managed storage budget');
  }
  return {removals:[...removals.values()],remainingBytes:kept().reduce((sum,a)=>sum+a.size_in_bytes,0),remainingArtifacts:kept().length};
}

export class GitHubArtifactCleaner{
  private base:string;
  constructor(private options:{repository:string;token:string;fetcher?:typeof fetch}){
    if(!/^[\w.-]+\/[\w.-]+$/.test(options.repository)||!options.token)throw new Error('Artifact cleanup needs repository credentials.');
    this.base=`https://api.github.com/repos/${options.repository}`;
  }
  private async request(route:string,method='GET'){
    const response=await (this.options.fetcher??fetch)(this.base+route,{method,headers:{Authorization:`Bearer ${this.options.token}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
    if(method==='DELETE'&&(response.status===204||response.status===404))return null;
    if(!response.ok)throw new Error(`Artifact cleanup HTTP ${response.status}; no credentials or provider response body are logged.`);
    return response.json();
  }
  async clean(options:{uploaded:Set<string>;finishedRun?:number;now?:number}){
    const artifacts:ManagedArtifact[]=[];
    for(let page=1;page<=100;page++){
      const list=await this.request(`/actions/artifacts?per_page=100&page=${page}`);artifacts.push(...list.artifacts);
      if(list.artifacts.length<100)break;
      if(page===100)throw new Error('Too many artifacts for one bounded cleanup; inspect repository storage.');
    }
    const protectedRuns=new Set<number>();
    for(let page=1;page<=10;page++){
      const list=await this.request(`/actions/runs?status=in_progress&per_page=100&page=${page}`);
      for(const run of list.workflow_runs)if(run.id!==options.finishedRun)protectedRuns.add(run.id);
      if(list.workflow_runs.length<100)break;
      if(page===10)throw new Error('Cannot safely enumerate active runs.');
    }
    const plan=planArtifactCleanup(artifacts,options.uploaded,protectedRuns,options.now);
    let removedBytes=0,removedArtifacts=0;
    // Bound one-time cleanup API usage; subsequent triggers continue the sweep.
    for(const {artifact} of plan.removals.slice(0,200)){
      await this.request(`/actions/artifacts/${artifact.id}`,'DELETE');removedBytes+=artifact.size_in_bytes;removedArtifacts++;
    }
    return {removedArtifacts,removedBytes,pendingRemovals:Math.max(0,plan.removals.length-removedArtifacts),remainingManagedBytes:plan.remainingBytes+plan.removals.slice(200).reduce((sum,r)=>sum+r.artifact.size_in_bytes,0)};
  }
}
