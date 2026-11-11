const factors:Record<string,number>={ms:1,s:1000,m:60000,h:3600000,d:86400000};
// Longest unit first: matching m before ms turns 525ms into 525 minutes.
export function durationMs(value:string):number|null{
  const text=value.trim();
  if(!/^(?:\d+(?:\.\d+)?\s*(?:ms|d|h|m|s)\s*)+$/i.test(text))return null;
  let total=0;for(const match of text.matchAll(/(\d+(?:\.\d+)?)\s*(ms|d|h|m|s)/gi))total+=Number(match[1])*factors[match[2].toLowerCase()];
  return Number.isFinite(total)?total:null;
}
export function messageRetryMs(message:string):number|null{
  const interval=message.match(/try again in\s+((?:\d+(?:\.\d+)?\s*(?:ms|d|h|m|s)\s*)+)(?![a-z])/i)?.[1];
  return interval?durationMs(interval):null;
}
export function retryAfterMs(value:string|null,now=Date.now()):number|null{
  if(!value?.trim())return null;
  const seconds=Number(value);if(Number.isFinite(seconds)&&seconds>=0)return seconds*1000;
  const duration=durationMs(value);if(duration!==null)return duration;
  const date=Date.parse(value);return Number.isFinite(date)?Math.max(0,date-now):null;
}
