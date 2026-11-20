import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {writeJson} from './stages';

// Quality diagnostics are advisory and remain with the generated checkpoint.
export function comparisonWarningSink(directory:string,log:(message:string)=>void){
  const filename=path.join(directory,'quality-warnings.json');
  let warnings:string[]=[];
  if(existsSync(filename)){try{const prior=JSON.parse(readFileSync(filename,'utf8'));if(Array.isArray(prior.warnings))warnings=prior.warnings.filter((v:unknown)=>typeof v==='string');}catch{/* Replace an invalid optional diagnostic file. */}}
  return (message:string)=>{
    if(!warnings.includes(message)){warnings.push(message);writeJson(filename,{policy:'correct-or-warn-and-continue',warnings});}
    log(`Quality warning: ${message}`);
  };
}
