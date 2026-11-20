import {existsSync,readFileSync,openSync,readSync,closeSync,statSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {z} from 'zod';

export const youtubeScopes=['https://www.googleapis.com/auth/youtube.upload','https://www.googleapis.com/auth/youtube.readonly'];
export const youtubeConfigSchema=z.object({
  clientId:z.string().min(1),clientSecret:z.string().min(1),refreshToken:z.string().min(1),
  channelId:z.string().regex(/^UC[A-Za-z0-9_-]{22}$/),
  privacy:z.enum(['private','unlisted','public']).default('private'),madeForKids:z.boolean().default(false),
  containsSyntheticMedia:z.boolean().default(true),notifySubscribers:z.boolean().default(false),
});
export type YouTubeConfig=z.infer<typeof youtubeConfigSchema>;
const boolean=(value:string|undefined,fallback:boolean)=>{
  if(value===undefined||value==='')return fallback;
  if(value!=='true'&&value!=='false')throw new Error('YouTube boolean settings must be true or false.');
  return value==='true';
};
export function loadYouTubeConfig(envFile='.env.local',env:NodeJS.ProcessEnv=process.env):YouTubeConfig{
  if(env===process.env&&existsSync(envFile))loadEnvFile(envFile);
  return youtubeConfigSchema.parse({clientId:env.YOUTUBE_CLIENT_ID,clientSecret:env.YOUTUBE_CLIENT_SECRET,refreshToken:env.YOUTUBE_REFRESH_TOKEN,channelId:env.YOUTUBE_CHANNEL_ID,privacy:env.YOUTUBE_PRIVACY_STATUS||'private',madeForKids:boolean(env.YOUTUBE_MADE_FOR_KIDS,false),containsSyntheticMedia:boolean(env.YOUTUBE_CONTAINS_SYNTHETIC_MEDIA,true),notifySubscribers:boolean(env.YOUTUBE_NOTIFY_SUBSCRIBERS,false)});
}
export const youtubeMetadataSchema=z.object({
  snippet:z.object({title:z.string().min(1).max(100).refine(t=>!/[<>]/.test(t),'YouTube titles cannot contain angle brackets.'),description:z.string().refine(t=>Buffer.byteLength(t,'utf8')<=5000,'YouTube description must fit 5,000 UTF-8 bytes.').refine(t=>!/[<>]/.test(t),'YouTube descriptions cannot contain angle brackets.'),categoryId:z.literal('27'),defaultLanguage:z.literal('en'),tags:z.array(z.string()).max(10)}).strict(),
  status:z.object({privacyStatus:z.enum(['private','unlisted','public']),selfDeclaredMadeForKids:z.boolean(),containsSyntheticMedia:z.boolean()}).strict(),
}).strict();
export type YouTubeMetadata=z.infer<typeof youtubeMetadataSchema>;
export type UploadResult={videoId:string;channelId:string;privacy:YouTubeConfig['privacy'];url:string};
export function makeYouTubeMetadata(data:{title:string;context:string;basis?:string;sources:{title:string;url:string}[];items:{label:string;visual?:{kind:string;attribution?:string;referenceUrls?:string[]}}[]},config:Pick<YouTubeConfig,'privacy'|'madeForKids'|'containsSyntheticMedia'>):YouTubeMetadata{
  const credits=new Map<string,string[]>();
  for(const item of data.items){const visual=item.visual;if(!visual||visual.kind==='box')continue;const credit=visual.attribution??'';if(credit)credits.set(credit,[...(credits.get(credit)??[]),item.label]);}
  const extraReferences=[...new Set(data.items.flatMap(i=>i.visual?.referenceUrls??[]))].filter(url=>!data.sources.some(s=>s.url===url));
  const description=[data.context,data.basis?`Measurement basis: ${data.basis}`:'','Illustrative visuals; measurements are based on the sources below.',`Sources:\n${[...new Set(data.sources.map(s=>`${s.title}: ${s.url}`))].join('\n')}`,credits.size?`Visual credits:\n${[...credits].map(([credit,names])=>`${names.join(', ')}: ${credit}`).join('\n')}`:'',extraReferences.length?`Visual references:\n${extraReferences.join('\n')}`:'','#Shorts #Comparison'].filter(Boolean).join('\n\n');
  return youtubeMetadataSchema.parse({snippet:{title:data.title,description,categoryId:'27',defaultLanguage:'en',tags:['shorts','comparison']},status:{privacyStatus:config.privacy,selfDeclaredMadeForKids:config.madeForKids,containsSyntheticMedia:config.containsSyntheticMedia}});
}

export class YouTubeClient{
  private token='';
  constructor(private config:YouTubeConfig,private options:{fetcher?:typeof fetch;sleep?:(ms:number)=>Promise<void>}={}){}
  private async request(url:string,init:RequestInit,timeout=30000){
    return (this.options.fetcher??fetch)(url,{...init,redirect:'error',signal:AbortSignal.timeout(timeout)});
  }
  private async failure(response:Response):Promise<Error>{
    // Provider messages/headers can contain OAuth/session data. Expose only a
    // small machine-readable reason, never raw responses or upload URLs.
    const data=await response.json().catch(()=>({})) as {error?:{errors?:{reason?:string}[]}|string};
    const reason=typeof data.error==='string'?data.error: data.error?.errors?.[0]?.reason;
    const known=['invalid_grant','invalid_client','access_denied','quotaExceeded','dailyLimitExceeded','uploadLimitExceeded','insufficientPermissions','forbidden','youtubeSignupRequired','videoNotFound','invalidVideoMetadata'];
    return new Error(`YouTube API HTTP ${response.status}${reason&&known.includes(reason)?` (${reason})`:''}.`);
  }
  async authorize(){
    let response:Response;
    try{response=await this.request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:this.config.clientId,client_secret:this.config.clientSecret,refresh_token:this.config.refreshToken,grant_type:'refresh_token'})});}
    catch{throw new Error('Google OAuth refresh request failed or timed out.');}
    if(!response.ok)throw await this.failure(response);
    const data=await response.json() as {access_token?:string};
    if(!data.access_token)throw new Error('Google OAuth returned no access token. Reauthorize the YouTube connection.');
    this.token=data.access_token;
  }
  async checkChannel(){
    if(!this.token)await this.authorize();
    let response:Response;
    try{response=await this.request('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true',{headers:{Authorization:`Bearer ${this.token}`}});}
    catch{throw new Error('YouTube channel verification failed or timed out.');}
    if(!response.ok)throw await this.failure(response);
    const data=await response.json() as {items?:{id:string;snippet?:{title?:string}}[]};
    if(data.items?.length!==1||data.items[0].id!==this.config.channelId)throw new Error('Authorized YouTube channel does not match YOUTUBE_CHANNEL_ID. Select the correct channel during OAuth authorization. No video uploaded.');
    return {id:data.items[0].id,title:data.items[0].snippet?.title??''};
  }
  private async result(response:Response):Promise<UploadResult>{
    if(!response.ok)throw await this.failure(response);
    const data=await response.json() as {id?:string;snippet?:{channelId?:string};status?:{privacyStatus?:string}};
    if(!data.id||!/^[A-Za-z0-9_-]{11}$/.test(data.id)||data.snippet?.channelId!==this.config.channelId)throw new Error('Upload response could not confirm the video/channel. Inspect YouTube Studio before any retry.');
    const privacy=z.enum(['private','unlisted','public']).parse(data.status?.privacyStatus);
    return {videoId:data.id,channelId:data.snippet.channelId,privacy,url:`https://www.youtube.com/shorts/${data.id}`};
  }
  async upload(file:string,rawMetadata:YouTubeMetadata):Promise<UploadResult>{
    const metadata=youtubeMetadataSchema.parse(rawMetadata);
    await this.checkChannel();
    const size=statSync(file).size;if(size<=0)throw new Error('Cannot upload an empty video.');
    // Start ONE session only. An uncertain initiation/transfer is never replayed
    // as a new videos.insert, which could create duplicate posts.
    let response:Response;
    try{response=await this.request(`https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=${this.config.notifySubscribers}`,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'video/mp4','X-Upload-Content-Length':String(size)},body:JSON.stringify(metadata)});}
    catch{throw new Error('Upload initiation outcome is uncertain. Inspect YouTube Studio; no automatic new upload will be created.');}
    if(!response.ok)throw await this.failure(response);
    const location=response.headers.get('location');let session:URL;
    try{session=new URL(location??'');}catch{throw new Error('YouTube did not return a resumable upload session.');}
    if(session.protocol!=='https:'||session.hostname!=='www.googleapis.com'||!session.pathname.startsWith('/upload/youtube/')||session.username||session.password||session.port)throw new Error('YouTube returned an unexpected upload session endpoint.');
    const headers={Authorization:`Bearer ${this.token}`};
    let offset=0,failures=0,query=false;
    const fd=openSync(file,'r');
    try{
      while(failures<3){
        try{
          if(query){
            response=await this.request(session.href,{method:'PUT',headers:{...headers,'Content-Length':'0','Content-Range':`bytes */${size}`}});
          }else{
            const buffer=Buffer.alloc(Math.min(8*1024*1024,size-offset));
            const count=readSync(fd,buffer,0,buffer.length,offset);if(!count)throw new Error('Video became unreadable during upload.');
            response=await this.request(session.href,{method:'PUT',headers:{...headers,'Content-Type':'video/mp4','Content-Length':String(count),'Content-Range':`bytes ${offset}-${offset+count-1}/${size}`},body:new Uint8Array(buffer.subarray(0,count))},120000);
          }
        }catch{
          failures++;query=true;await (this.options.sleep??(ms=>new Promise(r=>setTimeout(r,ms))))(1000*failures);continue;
        }
        if([429,500,502,503,504].includes(response.status)){
          failures++;query=true;await (this.options.sleep??(ms=>new Promise(r=>setTimeout(r,ms))))(1000*failures);continue;
        }
        if(response.status===308){
          const range=response.headers.get('range'),match=range?.match(/^bytes=0-(\d+)$/);
          if(range&&!match)throw new Error('Invalid YouTube upload progress response.');
          const next=match?Number(match[1])+1:0;
          if(!Number.isSafeInteger(next)||next<offset||next>=size)throw new Error('Invalid YouTube upload offset. Inspect YouTube Studio before retrying.');
          if(next===offset&&!query)failures++;
          offset=next;query=false;continue;
        }
        return await this.result(response);
      }
      throw new Error('YouTube transfer could not be confirmed after three recoveries. Inspect YouTube Studio before retrying; no duplicate upload was started.');
    }finally{closeSync(fd);}
  }
}
