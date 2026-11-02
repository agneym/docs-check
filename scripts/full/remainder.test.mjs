import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {sha,json,makeSchedule} from './control.mjs';
import {selectRemaining,authorizeRemainder,inspectBase} from './remainder-core.mjs';
const ROOT=new URL('../..',import.meta.url).pathname.replace(/\/$/,''),cfg=json(join(ROOT,'evaluation/full-config.json'));
const questions=readFileSync(join(ROOT,'evaluation/questions.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
function fixture(){
 const schedule=makeSchedule(questions,cfg),hash='unchanged-execution-config',outcomes={},recordHashes={};
 for(const row of schedule){const outcome={...row,status:row.order<8?([2,5].includes(row.order)?'completed':'failed'):'not_run',config_hash:hash};const digest=sha(JSON.stringify(outcome));outcomes[row.execution_id]={sha256:digest,outcome};recordHashes[row.execution_id]=digest;}
 return {view_kind:'first-continuation-view',manifest:{config:cfg},launch:{execution_config_hash:hash},schedule,outcomes,base_view:{run:'/private/base',provenance_sha256:'base-digest',outcomes:recordHashes}};
}
test('second incident remainder is exactly 88 tail rows, preserving all 2 completions and 6 failures',()=>{
 const s=fixture(),before=structuredClone(s),r=selectRemaining(s);assert.equal(r.remaining.length,88);assert.equal(r.retained.length,8);assert.equal(r.retained.filter(x=>x.status==='completed').length,2);assert.equal(r.retained.filter(x=>x.status==='failed').length,6);assert.deepEqual(r.remaining,s.schedule.slice(8));assert.deepEqual(s,before);
 const counts={};for(const row of r.remaining)counts[row.workflow]=(counts[row.workflow]??0)+1;assert.deepEqual(counts,{context7:44,parallel:44});
});
test('never replay attempted rows, move earlier unrun rows, replace old outcomes or change configuration',()=>{
 for(const mutate of [s=>s.outcomes[s.schedule[2].execution_id].outcome.status='not_run',s=>s.outcomes[s.schedule[8].execution_id].outcome.status='completed',s=>s.outcomes[s.schedule[9].execution_id].outcome.config_hash='different',s=>s.outcomes[s.schedule[0].execution_id].sha256='different',s=>s.view_kind='second-continuation-view',s=>s.schedule=s.schedule.slice(1),s=>s.schedule[1]=s.schedule[0]]){const s=fixture();mutate(s);assert.throws(()=>selectRemaining(s));}
});
test('outcome identity/workflow/repeat must match original selected row',()=>{
 for(const [key,value] of [['execution_id','other'],['question_id','other'],['workflow','different'],['repeat',2]]){const s=fixture();s.outcomes[s.schedule[8].execution_id].outcome[key]=value;assert.throws(()=>selectRemaining(s),/identity/);}
});
test('only explicit new 88-entry incident approval can authorize; first pass and95 approvals cannot',()=>{
 const m={base_view:{provenance_sha256:'base-digest'}},a={phase:'full-first-pass-continuation-2',manifest_sha256:'new-digest',base_provenance_sha256:'base-digest',executions:88,attempts:1,approved:true,preserve_previous_entries:true,extra_executions_approved:false,automatic_topups:false,approved_by:'fixture',user_authorization:'yes, approved (fixture only)',spending:{policy:'uncapped-explicitly-approved',cap:null,automatic_topups:false}};
 assert.equal(authorizeRemainder(a,'new-digest',m),true);
 for(const mutate of [x=>x.phase='full-first-pass',x=>x.executions=95,x=>x.executions=96,x=>x.attempts=2,x=>x.preserve_previous_entries=false,x=>x.base_provenance_sha256='changed',x=>x.spending.cap=10,x=>x.spending.automatic_topups=true,x=>x.approved=false,x=>x.user_authorization='']){const b=structuredClone(a);mutate(b);assert.throws(()=>authorizeRemainder(b,'new-digest',m));}
});
const real=join(process.env.HOME ?? '', 'random/docs-check-runs/2026-11-01-first-pass-view-1');
test('read-only actual partial-view validation finds 88 unrun and eight immutable prior attempts',{skip:!existsSync(join(real,'view-provenance.json'))},()=>{
 const base=inspectBase(ROOT,real);assert.equal(base.remaining.length,88);assert.equal(base.retained.length,8);assert.equal(base.changes.some(x=>x.path==='scripts/full/transport.mjs'),true);assert.ok(Object.keys(base.base_view.source_log_hashes).length>0);
});
