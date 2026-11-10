import {writeFileSync, renameSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import type {GroqClient, Completion} from './groq';

export function writeJson(filename: string, value: unknown) {
  const tmp = `${filename}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n'); renameSync(tmp, filename);
}
export function parseJsonContent(text: string) {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as unknown;
}
export function completionRecord(completion: Completion) {
  return {id: completion.id, model: completion.model, usage: completion.usage, finishReason: completion.choices?.[0]?.finish_reason, content: completion.choices?.[0]?.message?.content};
}
export async function structuredStage<T>(options: {
  stage: 'script' | 'motion'; maxCompletionTokens?:number; artifact?: string; repairInstruction?:string; constrained?:boolean; compactSchema?:boolean; nullableOptionals?:boolean; model: string; reasoningEffort?: 'low' | 'medium'; client: Pick<GroqClient, 'chat'>; schema: z.ZodType; system: string; input: string;
  validate: (raw: unknown) => T; directory: string; log: (line: string) => void;
  retryValidation?:(error:unknown)=>boolean;
}): Promise<T> {
  let previous = '';
  let error = '';
  let repairError='';
  const jsonSchema = z.toJSONSchema(options.schema, {reused: 'ref'});
  // Keep the shape/enum contract in token-limited planning requests. Detailed
  // bounds remain authoritative in local validation and repair feedback.
  const compact=(value:unknown):unknown=>{
    if(Array.isArray(value))return value.map(compact);
    if(!value||typeof value!=='object')return value;
    return Object.fromEntries(Object.entries(value).filter(([key])=>!['$schema','default','minLength','maxLength','minimum','maximum','exclusiveMinimum','exclusiveMaximum','minItems','maxItems','additionalProperties'].includes(key)).map(([key,item])=>[key,compact(item)]));
  };
  const promptSchema=options.compactSchema?compact(jsonSchema):jsonSchema;
  let editorialFeedback = '';
  let targetWords = 96;
  let timedStructure = false;
  let silent=false;
  if (options.stage === 'script') {
    try {
      const input = JSON.parse(options.input) as {presentation?:string; editorialFeedback?: string; language?: string; structure?: {beats: {durationSeconds: number}[]}};
      editorialFeedback = input.editorialFeedback ?? '';
      silent=input.presentation==='silent';
      if (input.structure?.beats) {timedStructure = true; targetWords = Math.round(input.structure.beats.reduce((sum, b) => sum + b.durationSeconds, 0) * (input.language && input.language !== 'en' ? 3.1 : 2.6));}
    } catch { /* Non-JSON inputs remain supported. */ }
  }
  const strictSchema = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strictSchema);
    if (!value || typeof value !== 'object') return value;
    const result = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'default' && key !== '$schema' && key !== 'format').map(([key, item]) => [key, strictSchema(item)]));
    if (result.properties && typeof result.properties === 'object') {
      const properties=result.properties as Record<string,unknown>,required=new Set(Array.isArray(result.required)?result.required:[]);
      if(options.nullableOptionals)for(const key of Object.keys(properties))if(!required.has(key))properties[key]={anyOf:[properties[key],{type:'null'}]};
      result.required = Object.keys(properties); result.additionalProperties = false;
    }
    return result;
  };
  const label = options.artifact ?? options.stage;
  // Timed structures use title-specific unions; prefer JSON mode and local validation
  // after repeated constrained-decoder failures across hosted models.
  let strictOutput = options.constrained ?? (options.stage === 'script' && !timedStructure && !silent);
  for (let attempt = 1; attempt <= 3; attempt++) {
    options.log(`${label}: request ${attempt}/3 (${options.model})`);
    let draftFeedback = '';
    if (previous && options.stage === 'script') {
      try {
        const draft = parseJsonContent(previous) as {scenes?: {cues?: string[]}[]};
        const count = draft.scenes?.flatMap(s => s.cues ?? []).join(' ').trim().split(/\s+/).length;
        if (count&&!silent) draftFeedback = `The previous draft has ${count} spoken words. Target ${targetWords} words: ${count < targetWords ? `add approximately ${targetWords - count}` : `remove approximately ${count - targetWords}`} words while keeping the same factual story. ${timedStructure ? 'Keep the supplied hook and beat boundaries. Expand the Explanation and Payoff to their word budgets; Hook and Ending may each have only one cue.' : 'Every scene needs at least two cues.'} Expand the existing explanation with concrete examples, not new unsupported claims.`;
      } catch { /* Standard validation feedback below covers malformed drafts. */ }
    }
    let completion: Completion;
    try { completion = await options.client.chat({
      model: options.model, reasoning_effort: options.model.startsWith('qwen/') ? 'none' : options.reasoningEffort ?? (options.stage === 'script' && !options.model.endsWith('-20b') ? 'medium' : 'low'), temperature: 0.25, max_completion_tokens: options.maxCompletionTokens ?? (options.stage === 'script' ? 2800 : 3500),
      // Prefer constrained output for narration; local validation is authoritative.
      response_format: strictOutput
        ? {type: 'json_schema', json_schema: {name: 'short_script', strict: true, schema: strictSchema(jsonSchema)}}
        : {type: 'json_object'},
      messages: [
        {role: 'system', content: `${options.system}\n\nReturn a JSON DATA INSTANCE, not a schema.${strictOutput?' Match the supplied response-format schema.':` Match this schema; do not repeat schema keywords in the output:\n${JSON.stringify(promptSchema)}`}`}, {role: 'user', content: options.input},
        ...(previous && options.stage === 'script' && previous.length < 9000 ? [{role: 'assistant' as const, content: previous}] : []),
        ...(previous ? [{role: 'user' as const, content: `Your previous JSON failed local validation. Return the COMPLETE corrected DATA OBJECT. ${options.repairInstruction ?? (options.stage === 'motion' ? 'Use only the supplied actors/properties; preserve the approved script.' : 'Preserve research scope and edit the draft rather than starting a new story.')} ${draftFeedback} Errors:\n${repairError.slice(0, 2400)}`}] : []),
        ...(editorialFeedback ? [{role: 'user' as const, content: `EDITORIAL REVISION — apply this brief to EVERY scene and to the throughline/description, overriding the old draft's wording and claims. Keep the topic and valid facts, not the old errors. Return the full revised script.\n${editorialFeedback}`}]: []),
      ],
    }); } catch (failure) {
      // Some Groq models reject a constrained decoder result before returning it.
      // Retry with JSON mode; the same local schema and semantic checks still apply.
      const message = failure instanceof Error ? failure.message : '';
      if (strictOutput && /HTTP 400:.*(Failed to (?:generate|validate) JSON|does not match the expected schema)/i.test(message) && attempt < 3) {
        options.log(`${label}: provider rejected constrained JSON; retrying with locally validated JSON mode.`);
        writeJson(path.join(options.directory, `${label}-provider-validation-${attempt}.json`), {error: message});
        strictOutput = false; continue;
      }
      throw failure;
    }
    previous = completion.choices![0].message!.content!;
    writeJson(path.join(options.directory, `${label}-attempt-${attempt}.json`), completionRecord(completion));
    try {
      const omitNulls=(value:unknown):unknown=>Array.isArray(value)?value.map(omitNulls):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([,item])=>item!==null).map(([key,item])=>[key,omitNulls(item)])):value;
      const parsed=parseJsonContent(previous);
      return options.validate(options.nullableOptionals?omitNulls(parsed):parsed);
    } catch (failure) {
      error = failure instanceof Error ? failure.message : 'Invalid stage output';
      // Repeated item errors must not hide other corrections at the end of a
      // long Zod report. Full diagnostics are still saved for inspection.
      repairError=failure instanceof z.ZodError?[...new Map(failure.issues.map(issue=>[issue.message,`${issue.path.join('.')}: ${issue.message}`])).values()].join('\n'):error;
      options.log(`${label}: validation failed; ${attempt < 3 ? 'requesting correction' : 'attempt limit reached'}.`);
      writeJson(path.join(options.directory, `${label}-validation-${attempt}.json`), {error});
      if(options.retryValidation?.(failure)===false)throw failure;
    }
  }
  throw new Error(`${options.stage} failed validation after three attempts: ${error.slice(0, 2500)}`);
}
