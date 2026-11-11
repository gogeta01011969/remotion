import {existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {durationMs,messageRetryMs,retryAfterMs} from './rate-limit';

export type Message = {role: 'system' | 'user' | 'assistant'; content: string};
export type ToolExecution = {name?: string; type?: string; arguments?: string; output?: string; search_results?: {results?: {title?: string; url?: string; content?: string}[]}};
export type Completion = {
  id?: string; model?: string; usage?: Record<string, unknown>;
  choices?: {finish_reason?: string; message?: {content?: string | null; executed_tools?: ToolExecution[]}}[];
};
export type ChatRequest = {model: string; messages: Message[]; max_completion_tokens: number; temperature: number; reasoning_effort?: string; tools?: {type: string}[]; tool_choice?: string; response_format?: Record<string, unknown>;stageLabel?:string};
export type GroqOptions = {apiKey: string; fetcher?: typeof fetch; sleep?: (ms: number) => Promise<void>; onRetry?: (message: string) => void;now?:()=>number};

export function loadGroqConfig(envFile = '.env.local') {
  if (existsSync(envFile)) loadEnvFile(envFile);
  const apiKey = process.env.GROQCLOUD_API_KEY?.trim();
  if (!apiKey) throw new Error('Set GROQCLOUD_API_KEY in .env.local or the process environment.');
  return {
    apiKey,
    researchModel: process.env.GROQ_RESEARCH_MODEL || 'openai/gpt-oss-120b',
    scriptModel: process.env.GROQ_SCRIPT_MODEL || 'openai/gpt-oss-120b',
    motionModel: process.env.GROQ_MOTION_MODEL || 'openai/gpt-oss-120b',
  };
}
export function redact(text: string, secrets: string[]) {
  let safe = text;
  for (const secret of secrets) if (secret) safe = safe.replaceAll(secret, '[redacted]');
  return safe.replace(/gsk_[A-Za-z0-9_-]+/g, '[redacted]');
}
export class GroqClient {
  private fetcher: typeof fetch;
  private sleep: (ms: number) => Promise<void>;
  private windows=new Map<string,{remaining:number;limit:number;at:number;reset:number}>();
  constructor(private options: GroqOptions) {
    this.fetcher = options.fetcher ?? fetch;
    this.sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  }
  async chat(request: ChatRequest): Promise<Completion> {
    const {stageLabel,...payload}=request; // Internal accounting metadata, never sent to Groq.
    const now=()=>this.options.now?.()??Date.now();
    const window=this.windows.get(request.model);
    if(window){
      const estimated=Math.ceil(Buffer.byteLength(JSON.stringify({messages:request.messages,response_format:request.response_format}))/3)+request.max_completion_tokens;
      const available=now()>=window.reset?window.limit:Math.min(window.limit,window.remaining+Math.max(0,now()-window.at)*window.limit/60000);
      if(estimated<=window.limit&&estimated>available){
        const delay=Math.min(60000,Math.max(1000,Math.min(Math.max(0,window.reset-now()),(estimated-available)*60000/window.limit)+250));
        this.options.onRetry?.(`GroqCloud: pacing ${request.model} for ${Math.ceil(delay)}ms using remaining-token headers.`);
        await this.sleep(delay);
      }
    }
    let failures=0,totalWait=0;
    for (let attempt = 0; attempt < 6; attempt++) {
      let response: Response;
      try {
        response = await this.fetcher('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST', headers: {Authorization: `Bearer ${this.options.apiKey}`, 'Content-Type': 'application/json'},
          body: JSON.stringify(payload), signal: AbortSignal.timeout(120000),
        });
      } catch {
        if (++failures>=3) throw new Error('GroqCloud network request failed or timed out after three attempts.');
        const delay=1000*2**attempt;
        if(totalWait+delay>120000)throw new Error('GroqCloud network retry wait budget exhausted.');
        totalWait+=delay;
        this.options.onRetry?.('GroqCloud network error; retrying.');
        await this.sleep(delay); continue;
      }
      if (!response.ok) {
        const raw = await response.text();
        let detail = `HTTP ${response.status}`;
        try { const parsed = JSON.parse(raw); detail += `: ${parsed.error?.message ?? parsed.error?.code ?? 'request rejected'}`; } catch { /* Do not expose arbitrary response bodies. */ }
        detail = redact(detail, [this.options.apiKey]).slice(0, 900);
        const transient = response.status === 429 || response.status === 408 || response.status >= 500;
        if(response.status!==429)failures++;
        if (transient && attempt < 5 && failures<3) {
          const headerDelay=retryAfterMs(response.headers.get('retry-after'),now());
          const bodyDelay=response.status===429?messageRetryMs(detail):null;
          const resetDelay=response.status===429?durationMs(response.headers.get('x-ratelimit-reset-tokens')??''):null;
          const requested=headerDelay??(bodyDelay!==null?bodyDelay+250:resetDelay??1000*2**attempt);
          const delay=Math.max(1000*2**Math.min(attempt,4),requested);
          if (delay > 60000) throw new Error(`${detail}. Retry later with --resume; server requests a wait longer than 60 seconds.`);
          if(totalWait+delay>120000)throw new Error(`${detail}. In-run retry wait budget exhausted; resume later.`);
          totalWait+=delay;
          this.options.onRetry?.(`GroqCloud HTTP ${response.status}; retrying in ${Math.ceil(delay)}ms.`);
          await this.sleep(delay); continue;
        }
        throw new Error(`GroqCloud ${detail}`);
      }
      const result = await response.json() as Completion;
      const remaining=Number(response.headers.get('x-ratelimit-remaining-tokens')),limit=Number(response.headers.get('x-ratelimit-limit-tokens'));
      if(response.headers.has('x-ratelimit-remaining-tokens')&&Number.isFinite(remaining)&&Number.isFinite(limit)&&limit>0){
        this.windows.set(request.model,{remaining,limit,at:now(),reset:now()+(durationMs(response.headers.get('x-ratelimit-reset-tokens')??'')??60000)});
      }
      const choice = result.choices?.[0];
      if (choice?.finish_reason === 'length') throw new Error('GroqCloud response reached its token limit; no truncated output was accepted.');
      if (!choice?.message?.content?.trim()) throw new Error('GroqCloud returned no content.');
      return result;
    }
    throw new Error('GroqCloud request exhausted retries.');
  }
}
