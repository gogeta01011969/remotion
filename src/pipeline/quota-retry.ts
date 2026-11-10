// Quota exhaustion is a scheduling condition, not a failed content attempt.
export function quotaDeferral(message:string,now=Date.now(),fallbackMinutes=60){
  if(!/429|rate.limit|quota|usage budget reached/i.test(message))return null;
  // Waiting cannot make an individually oversized request fit the provider limit.
  if(/request too large|reduce (?:the )?(?:size|length)|exceeds.*(?:context|token).*limit/i.test(message))return null;
  const interval=message.match(/try again in\s+((?:\d+(?:\.\d+)?\s*[dhms]\s*)+)/i)?.[1];
  let seconds=0;
  if(interval)for(const part of interval.matchAll(/(\d+(?:\.\d+)?)\s*([dhms])/gi))seconds+=Number(part[1])*({d:86400,h:3600,m:60,s:1}[part[2].toLowerCase()]??0);
  return new Date(now+(seconds>0?Math.max(60,seconds+15):fallbackMinutes*60)*1000).toISOString();
}
