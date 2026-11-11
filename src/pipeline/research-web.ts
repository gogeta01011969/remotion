import https from 'node:https';
import {lookup} from 'node:dns';
import {isIP} from 'node:net';
import {Parser} from 'htmlparser2';

export function publicAddress(address:string){
  if(isIP(address)===6)return /^[23][0-9a-f]{0,3}:/i.test(address);
  if(isIP(address)!==4)return false;
  const [a,b,c]=address.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19)||a===192&&b===0||a===198&&b===51&&c===100||a===203&&b===0&&c===113);
}
export function publicUrl(input:string){
  const url=new URL(input),host=url.hostname.replace(/^\[|\]$/g,'');
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||/^(localhost|.*\.(local|internal|localhost))$/i.test(host)||isIP(host)&&!publicAddress(host))throw new Error('Research URLs must use public HTTPS endpoints.');
  url.hash='';return url.href;
}
export type WebResponse={status:number;headers:Record<string,string|undefined>;body:string};
export type WebFetch=(url:string)=>Promise<WebResponse>;
// Resolve and pin the actual connection to public addresses. URL validation alone
// does not prevent a model-supplied domain resolving to localhost or metadata.
export const fetchResearchPage:WebFetch=url=>new Promise((resolve,reject)=>{
  publicUrl(url);
  const req=https.get(url,{headers:{'User-Agent':'MotionLabResearch/1.0 (+https://github.com/gogeta01011969/remotion)','Accept':'text/html,application/json,text/plain;q=0.9','Accept-Encoding':'identity'},lookup:(host,_options,callback)=>{
    lookup(host,{all:true},(error,addresses)=>{
      if(error)return callback(error,'',4);
      if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))return callback(new Error('Research DNS resolved to a non-public address.'),'',4);
      // Node may ask for all addresses for its connection-family selection.
      if(typeof _options==='object'&&_options.all)(callback as unknown as (e:Error|null,a:typeof addresses)=>void)(null,addresses);
      else callback(null,addresses[0].address,addresses[0].family);
    });
  }},response=>{
    const chunks:Buffer[]=[];let bytes=0;
    response.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>1024*1024){response.destroy(new Error('Research response exceeds 1 MiB.'));return;}chunks.push(chunk);});
    response.on('error',reject);
    response.on('end',()=>resolve({status:response.statusCode??0,headers:{'content-type':String(response.headers['content-type']??''),location:response.headers.location},body:Buffer.concat(chunks).toString('utf8')}));
  });
  const deadline=setTimeout(()=>req.destroy(new Error('Research HTTP timeout.')),12000);
  req.on('close',()=>clearTimeout(deadline));req.on('error',reject);
});

export function pageText(html:string){
  let text='',title='',skip=0,inTitle=false;
  const hidden=new Set(['script','style','noscript','svg']);
  const parser=new Parser({onopentag(name){if(hidden.has(name))skip++;if(name==='title')inTitle=true;if(!skip&&/^(p|div|li|tr|h[1-6]|br)$/.test(name))text+='\n';},ontext(value){if(!skip){text+=value;if(inTitle)title+=value;}},onclosetag(name){if(hidden.has(name))skip=Math.max(0,skip-1);if(name==='title')inTitle=false;if(!skip&&/^(p|div|li|tr|h[1-6])$/.test(name))text+='\n';}},{decodeEntities:true});
  parser.write(html);parser.end();
  return {title:title.replace(/\s+/g,' ').trim().slice(0,180),text:text.split('\n').map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n')};
}
export function blockedPage(text:string){return /you do not have access to this site|access denied|verify (?:that )?you are human|just a moment\.\.\.|enable javascript and cookies to continue|captcha|this page does not exist|page not found|robot challenge/i.test(text.slice(0,2500));}
export function evidenceExcerpt(text:string,query:string,max=1800){
  const words=query.toLowerCase().match(/[a-z]{4,}/g)??[];
  const lines=text.split('\n').filter(s=>s.length>20&&s.length<2500);
  const ranked=lines.map((line,index)=>({line,index,score:(/\d/.test(line)?3:0)+(/diameter|circumference|wingspan|height|length|capacity|metres?|meters?|centimet|millimet|\b(?:mm|cm|km|litres?|liters?|feet|ft|inches)\b/i.test(line)?6:0)+words.filter(w=>line.toLowerCase().includes(w)).length})).sort((a,b)=>b.score-a.score||a.index-b.index);
  let selected='';
  for(const entry of ranked){if(selected.length+entry.line.length+1<=max)selected+=entry.line+'\n';}
  return selected.trim()||text.slice(0,max);
}
