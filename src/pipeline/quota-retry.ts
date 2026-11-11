import {messageRetryMs} from './rate-limit';
// Quota exhaustion is a scheduling condition, not a failed content attempt.
export function quotaDeferral(message:string,now=Date.now(),fallbackMinutes=60){
  if(!/429|rate.limit|quota|usage budget reached/i.test(message))return null;
  // Waiting cannot make an individually oversized request fit the provider limit.
  if(/request too large|reduce (?:the )?(?:size|length)|exceeds.*(?:context|token).*limit/i.test(message))return null;
  const wait=messageRetryMs(message);
  return new Date(now+(wait!==null?Math.max(60000,wait+15000):fallbackMinutes*60000)).toISOString();
}
