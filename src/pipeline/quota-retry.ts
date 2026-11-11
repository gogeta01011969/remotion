import {messageRetryMs} from './rate-limit';
// Quota exhaustion is a scheduling condition, not a failed content attempt.
export function quotaDeferral(message:string,now=Date.now(),fallbackMinutes=60){
  if(!/429|rate.limit|quota|usage budget reached/i.test(message))return null;
  // Waiting cannot make an individually oversized request fit the provider limit.
  if(/request too large|reduce (?:the )?(?:size|length)|exceeds.*(?:context|token).*limit/i.test(message))return null;
  const wait=messageRetryMs(message);
  return new Date(now+(wait!==null?Math.max(60000,wait+15000):fallbackMinutes*60000)).toISOString();
}

// Parsing fixes must also repair ledger dates written by the old parser. Only
// change dates that exactly match its known ms-as-minutes calculation.
export function repairLegacyMillisecondBackoff(job:{status:string;error?:string;updatedAt:string;retryAt?:string},fallbackMinutes=60){
  if(job.status!=='retry-later'||!job.error||!job.retryAt||!/(?:\d+(?:\.\d+)?)ms\b/i.test(job.error))return false;
  const anchor=Date.parse(job.updatedAt);if(!Number.isFinite(anchor))return false;
  const interval=job.error.match(/try again in\s+((?:\d+(?:\.\d+)?\s*[dhms]\s*)+)/i)?.[1];
  if(!interval)return false;
  let seconds=0;
  for(const part of interval.matchAll(/(\d+(?:\.\d+)?)\s*([dhms])/gi))seconds+=Number(part[1])*({d:86400,h:3600,m:60,s:1}[part[2].toLowerCase()]??0);
  const legacy=anchor+Math.max(60,seconds+15)*1000,corrected=quotaDeferral(job.error,anchor,fallbackMinutes);
  if(!corrected||Math.abs(Date.parse(job.retryAt)-legacy)>1000||Date.parse(corrected)>=Date.parse(job.retryAt))return false;
  job.retryAt=corrected;return true;
}
