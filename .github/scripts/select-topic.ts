import {spawnSync} from 'node:child_process';
const topic=process.env.REQUESTED_TOPIC?.trim();
const resume=process.env.REQUESTED_RESUME_JOB?.trim();
if(topic&&resume)throw new Error('Choose either a topic override or a saved job ID.');
const result=spawnSync(process.execPath,['--import','tsx','scripts/automate.ts','--select-only',...(topic?['--topic',topic]:[]),...(resume?['--resume',resume]:[])],{stdio:'inherit'});
process.exitCode=result.status??1;
