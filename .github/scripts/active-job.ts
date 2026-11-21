import {readFileSync,appendFileSync} from 'node:fs';
import {jobSchema} from '../../src/pipeline/topic-automation';
const id=process.env.CREATED_JOB_ID||process.env.SELECTED_JOB_ID;
const ledger=JSON.parse(readFileSync('.automation/state.json','utf8'));
const job=jobSchema.parse(ledger.jobs.find((entry:{id:string})=>entry.id===id));
appendFileSync(process.env.GITHUB_OUTPUT!,`job_id=${job.id}\nstatus=${job.status}\n`);
