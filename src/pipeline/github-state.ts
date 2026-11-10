import {ledgerSchema,type TopicLedger} from './topic-automation';
export type StateSnapshot={sha:string|null;exists:boolean};
export class GitHubStateStore{
  private base:string;
  constructor(private options:{repository:string;token:string;branch?:string;baseCommit:string;fetcher?:typeof fetch}){
    if(!/^[\w.-]+\/[\w.-]+$/.test(options.repository)||!options.token||!/^[a-f0-9]{40,64}$/i.test(options.baseCommit))throw new Error('GitHub state requires a valid repository, token and base commit.');
    if(!/^[a-z0-9-]+$/.test(options.branch??'automation-state'))throw new Error('Invalid state branch.');
    this.base=`https://api.github.com/repos/${options.repository}`;
  }
  private get branch(){return this.options.branch??'automation-state';}
  private async request(route:string,method='GET',body?:unknown,allow404=false){
    const response=await (this.options.fetcher??fetch)(this.base+route,{method,headers:{Authorization:`Bearer ${this.options.token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
    if(allow404&&response.status===404)return null;
    if(!response.ok)throw new Error(`GitHub durable state request failed (HTTP ${response.status}). State was not reset or overwritten.`);
    return response.json();
  }
  async load():Promise<{ledger:TopicLedger|null;snapshot:StateSnapshot}>{
    const ref=await this.request(`/git/ref/heads/${this.branch}`,'GET',undefined,true);
    if(!ref)return {ledger:null,snapshot:{sha:null,exists:false}};
    const file=await this.request(`/contents/automation/state.json?ref=${this.branch}`);
    if(file.encoding!=='base64'||typeof file.content!=='string')throw new Error('Durable ledger is missing or too large for the current state store. Refusing to reset history.');
    return {ledger:ledgerSchema.parse(JSON.parse(Buffer.from(file.content,'base64').toString('utf8'))),snapshot:{sha:file.sha,exists:true}};
  }
  async save(ledger:TopicLedger,snapshot:StateSnapshot):Promise<StateSnapshot>{
    const content=Buffer.from(JSON.stringify(ledgerSchema.parse(ledger),null,2)+'\n').toString('base64');
    if(snapshot.exists){
      if(!snapshot.sha)throw new Error('Existing state requires its expected SHA.');
      const result=await this.request('/contents/automation/state.json','PUT',{message:'Update video automation ledger',branch:this.branch,sha:snapshot.sha,content});
      return {exists:true,sha:result.content.sha};
    }
    // Build the initial commit before creating the ref: no empty-state branch
    // can be left behind by a network interruption between those operations.
    const base=await this.request(`/git/commits/${this.options.baseCommit}`);
    const blob=await this.request('/git/blobs','POST',{encoding:'base64',content});
    const tree=await this.request('/git/trees','POST',{base_tree:base.tree.sha,tree:[{path:'automation/state.json',mode:'100644',type:'blob',sha:blob.sha}]});
    const commit=await this.request('/git/commits','POST',{message:'Initialize video automation ledger',tree:tree.sha,parents:[this.options.baseCommit]});
    await this.request('/git/refs','POST',{ref:`refs/heads/${this.branch}`,sha:commit.sha});
    return {exists:true,sha:blob.sha};
  }
}
