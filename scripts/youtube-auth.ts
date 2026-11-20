import {createServer} from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,chmodSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {z} from 'zod';
import {youtubeScopes} from '../src/pipeline/youtube';

async function main(){
  const {values}=parseArgs({options:{client:{type:'string'},'env-file':{type:'string',default:'.env.local'},help:{type:'boolean'}}});
  if(values.help){console.log('npm run youtube:auth -- --client .automation/youtube-client.json [--env-file .env.local]\nUse a Google Desktop app OAuth client. The browser sign-in stores credentials locally; tokens are never printed.');return;}
  if(!values.client)throw new Error('Download a Desktop app OAuth client to .automation/youtube-client.json and pass --client.');
  const client=z.object({installed:z.object({client_id:z.string().min(1),client_secret:z.string().min(1)})}).parse(JSON.parse(readFileSync(values.client,'utf8'))).installed;
  const verifier=randomBytes(32).toString('base64url'),state=randomBytes(32).toString('base64url');
  let redirect='';
  let resolveCode!:(code:string)=>void,rejectCode!:(error:Error)=>void;
  const authorizationCode=new Promise<string>((resolve,reject)=>{resolveCode=resolve;rejectCode=reject;});
  const server=createServer((request,response)=>{
    const url=new URL(request.url??'/',redirect);
    if(url.pathname!=='/'){response.writeHead(404).end();return;}
    if(url.searchParams.get('state')!==state){response.writeHead(400).end('Invalid OAuth state. Return to the local authorization command.');return;}
    if(url.searchParams.has('error')){response.writeHead(400).end('Authorization was not granted.');rejectCode(new Error('Google authorization was declined.'));return;}
    const code=url.searchParams.get('code');if(!code){response.writeHead(400).end('Missing authorization code.');return;}
    response.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}).end('Authorization received. Return to the terminal for the channel confirmation. You can close this tab.');
    resolveCode(code);
  });
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve());});
  const address=server.address();if(!address||typeof address==='string')throw new Error('Could not start OAuth loopback callback.');
  redirect=`http://127.0.0.1:${address.port}/`;
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search=new URLSearchParams({client_id:client.client_id,redirect_uri:redirect,response_type:'code',scope:youtubeScopes.join(' '),access_type:'offline',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
  console.log('Open this URL in your browser and choose the intended YouTube channel:\n'+url.href);
  const timeout=setTimeout(()=>rejectCode(new Error('Authorization timed out after five minutes. Run the command again.')),5*60000);
  try{
    const code=await authorizationCode;
    const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:client.client_id,client_secret:client.client_secret,code,redirect_uri:redirect,grant_type:'authorization_code',code_verifier:verifier}),signal:AbortSignal.timeout(30000)});
    if(!tokenResponse.ok)throw new Error(`Google authorization exchange failed (HTTP ${tokenResponse.status}).`);
    const tokens=await tokenResponse.json() as {refresh_token?:string;access_token?:string};
    if(!tokens.refresh_token||!tokens.access_token)throw new Error('No offline refresh token received. Reauthorize with consent.');
    const channelResponse=await fetch('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true',{headers:{Authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(30000)});
    if(!channelResponse.ok)throw new Error(`Could not verify the authorized channel (HTTP ${channelResponse.status}).`);
    const channel=await channelResponse.json() as {items?:{id:string;snippet?:{title?:string}}[]};
    if(channel.items?.length!==1||!/^UC[A-Za-z0-9_-]{22}$/.test(channel.items[0].id))throw new Error('Authorization must select exactly one YouTube channel. Check your Google/Brand Account selection.');
    const settings={YOUTUBE_CLIENT_ID:client.client_id,YOUTUBE_CLIENT_SECRET:client.client_secret,YOUTUBE_REFRESH_TOKEN:tokens.refresh_token,YOUTUBE_CHANNEL_ID:channel.items[0].id};
    const filename=values['env-file']!,existing=existsSync(filename)?readFileSync(filename,'utf8'):'';
    const lines=existing.split('\n').filter(line=>!Object.keys(settings).some(key=>new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(line)));
    writeFileSync(filename,lines.join('\n').trimEnd()+'\n\n# YouTube OAuth (private; never commit this file)\n'+Object.entries(settings).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n')+'\n',{mode:0o600});chmodSync(filename,0o600);
    console.log(`Connected channel: ${channel.items[0].snippet?.title??''} (${channel.items[0].id}).\nCredentials saved to ${filename}; no video was uploaded. Next: npm run youtube:check`);
  }finally{clearTimeout(timeout);server.closeAllConnections();server.close();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'YouTube authorization failed.');process.exitCode=1;});
