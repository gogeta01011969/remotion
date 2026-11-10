import {researchSchema, type Research} from './contracts';
import type {Completion} from './groq';

export function researchFromCompletion(topic: string, model: string, completion: Completion): Research {
  const message = completion.choices?.[0]?.message;
  const tools = message?.executed_tools ?? [];
  const searched = tools.some(t => t.type === 'browser_search' || t.name === 'browser.search');
  if (!searched) throw new Error('Research did not execute browser search. Model memory alone is not accepted as research.');
  const opened = tools.filter(t => t.type === 'browser.open' || t.name === 'browser.open');
  const sources = new Map<string, {title: string; url: string}>();
  for (const tool of opened) {
    for (const result of tool.search_results?.results ?? []) {
      if (!result.url) continue;
      let url: URL;
      try {url = new URL(result.url);} catch {continue;}
      if (!['https:', 'http:'].includes(url.protocol)) continue;
      if (!result.content?.trim() && !tool.output?.trim()) continue;
      url.hash = '';
      const lines = (result.content || tool.output || '').split('\n').map(line => line.replace(/^L\d+:\s*/, '').trim());
      const title = lines.find(line => line && !line.startsWith('URL:') && !/^https?:/.test(line)) || result.title || url.hostname;
      sources.set(url.href, {title: title.replace(/\\/g, '').slice(0, 180), url: url.href});
    }
  }
  if (sources.size < 2) throw new Error('Research must open at least two distinct source pages; search-result links alone are insufficient.');
  return researchSchema.parse({topic, model, notes: message?.content, sources: [...sources.values()].slice(0, 10).map((s, i) => ({id: `s${i + 1}`, ...s})), searched: true, toolExecutions: tools.length});
}
