import {existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';

export type Message = {role: 'system' | 'user' | 'assistant'; content: string};
export type ToolExecution = {name?: string; type?: string; arguments?: string; output?: string; search_results?: {results?: {title?: string; url?: string; content?: string}[]}};
export type Completion = {
  id?: string; model?: string; usage?: Record<string, unknown>;
  choices?: {finish_reason?: string; message?: {content?: string | null; executed_tools?: ToolExecution[]}}[];
};
export type ChatRequest = {model: string; messages: Message[]; max_completion_tokens: number; temperature: number; reasoning_effort?: string; tools?: {type: string}[]; tool_choice?: string; response_format?: Record<string, unknown>};
export type GroqOptions = {apiKey: string; fetcher?: typeof fetch; sleep?: (ms: number) => Promise<void>; onRetry?: (message: string) => void};

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
  constructor(private options: GroqOptions) {
    this.fetcher = options.fetcher ?? fetch;
    this.sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  }
  async chat(request: ChatRequest): Promise<Completion> {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response;
      try {
        response = await this.fetcher('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST', headers: {Authorization: `Bearer ${this.options.apiKey}`, 'Content-Type': 'application/json'},
          body: JSON.stringify(request), signal: AbortSignal.timeout(120000),
        });
      } catch {
        if (attempt === 2) throw new Error('GroqCloud network request failed or timed out after three attempts.');
        this.options.onRetry?.('GroqCloud network error; retrying.');
        await this.sleep(1000 * 2 ** attempt); continue;
      }
      if (!response.ok) {
        const raw = await response.text();
        let detail = `HTTP ${response.status}`;
        try { const parsed = JSON.parse(raw); detail += `: ${parsed.error?.message ?? parsed.error?.code ?? 'request rejected'}`; } catch { /* Do not expose arbitrary response bodies. */ }
        detail = redact(detail, [this.options.apiKey]).slice(0, 900);
        const transient = response.status === 429 || response.status === 408 || response.status >= 500;
        if (transient && attempt < 2) {
          const header = response.headers.get('retry-after');
          const seconds = header ? Number(header) : NaN;
          // Groq sometimes supplies its reset interval only in the JSON error.
          const bodySeconds=response.status===429?detail.match(/try again in\s+([\d.]+)s/i)?.[1]:undefined;
          const delay = Number.isFinite(seconds) ? seconds * 1000 : header ? Date.parse(header) - Date.now() : bodySeconds ? Math.ceil(Number(bodySeconds)*1000)+250 : 1000 * 2 ** attempt;
          if (delay > 60000) throw new Error(`${detail}. Retry later with --resume; server requests a wait longer than 60 seconds.`);
          this.options.onRetry?.(`GroqCloud HTTP ${response.status}; retrying in ${Math.ceil(Math.max(1000, delay) / 1000)}s.`);
          await this.sleep(Math.max(1000, Number.isFinite(delay) ? delay : 1000)); continue;
        }
        throw new Error(`GroqCloud ${detail}`);
      }
      const result = await response.json() as Completion;
      const choice = result.choices?.[0];
      if (choice?.finish_reason === 'length') throw new Error('GroqCloud response reached its token limit; no truncated output was accepted.');
      if (!choice?.message?.content?.trim()) throw new Error('GroqCloud returned no content.');
      return result;
    }
    throw new Error('GroqCloud request exhausted retries.');
  }
}
