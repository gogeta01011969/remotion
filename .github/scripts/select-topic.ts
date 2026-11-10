import {spawnSync} from 'node:child_process';
const topic=process.env.REQUESTED_TOPIC?.trim();
const result=spawnSync(process.execPath,['--import','tsx','scripts/automate.ts','--select-only',...(topic?['--topic',topic]:[])],{stdio:'inherit'});
process.exitCode=result.status??1;
