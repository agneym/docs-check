import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sha,json,saveNew,makeSchedule,freezeInputs} from './control.mjs';
import {inspectOrigin,verifyContinuation,authorizeContinuation,copyExact} from './continuation-core.mjs';
const ROOT=new URL('../..',import.meta.url).pathname.replace(/\/$/,'');
const cfg=json(join(ROOT,'evaluation/full-config.json'));
const questions=readFileSync(join(ROOT,'evaluation/questions.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
function fixture(){
 const tmp=mkdtempSync(join(tmpdir(),'docs-check-continuation-')),original=join(tmp,'original'),claim=join(tmp,'original-claim.json'),next=join(tmp,'continuation');mkdirSync(original);mkdirSync(next);
 const schedule=makeSchedule(questions,cfg);
 for(const [p,data] of [['model.json',{id:'fixture-model'}],['worker.bundle.mjs','// fixture only; never executed'],['offline-checks.json',[]],['isolation-preflight.json',{fixture:true}],['references/archive-index.json',{fixture:true}]])saveNew(join(original,p),data);
 const refs=[];for(let i=0;i<10;i++){const path=`reference-${i}.md`;saveNew(join(original,'references',path),'fixture document');refs.push({path,sha256:sha(readFileSync(join(original,'references',path)))});}
 const manifest=freezeInputs(ROOT,original,cfg,schedule,{runtime:{fixture:true},dependencies:{tree_sha256:'fixture'},model_sha256:sha(readFileSync(join(original,'model.json'))),worker_bundle_sha256:sha(readFileSync(join(original,'worker.bundle.mjs'))),offline_checks_sha256:sha(readFileSync(join(original,'offline-checks.json'))),isolation_preflight_sha256:sha(readFileSync(join(original,'isolation-preflight.json'))),api_references:{archive_index_sha256:sha(readFileSync(join(original,'references/archive-index.json'))),records:refs}});
 const digest=sha(readFileSync(join(original,'manifest.json'))),approval={phase:'full-first-pass',manifest_sha256:digest,executions:96,attempts:1,approved:true,approved_by:'fixture',user_authorization:'fixture only, never paid',spending:{policy:'uncapped-explicitly-approved',cap:null,automatic_topups:false},automatic_topups:false,extra_executions_approved:false};
 const resolved={...cfg,spending:approval.spending,authorization:{full_run_approved:true,extra_executions_approved:false}},configHash=sha(JSON.stringify(resolved));
 saveNew(join(original,'launch.json'),{manifest_sha256:digest,approval,resolved_config:resolved,execution_config_hash:configHash});saveNew(claim,{run:original,manifest_sha256:digest,executions:96,attempts:1});saveNew(join(original,'campaign-terminal.json'),{status:'paused'});
 for(const row of schedule)saveNew(join(original,'executions',row.execution_id,'outcome.json'),{...row,status:row.order===0?'failed':'not_run',phase:row.order===0?'setup':null,run_id:null,config_hash:configHash});
 return {tmp,original,claim,next,schedule,manifest,configHash,close(){rmSync(tmp,{recursive:true,force:true});},freeze(){
  const origin=inspectOrigin(ROOT,original,{claimPath:claim});
  for(const p of ['model.json','worker.bundle.mjs'])copyExact(join(original,p),join(next,p));
  saveNew(join(next,'offline-checks.json'),[]);saveNew(join(next,'isolation-preflight.json'),{fixture:true});
  return freezeInputs(ROOT,next,cfg,origin.remaining,{phase:'full-first-pass-continuation',executions:95,repeat:1,origin:origin.origin,execution_config_hash:configHash,runtime:manifest.runtime,dependencies:manifest.dependencies,offline_checks_sha256:sha(readFileSync(join(next,'offline-checks.json'))),isolation_preflight_sha256:sha(readFileSync(join(next,'isolation-preflight.json')))});
 }};
}
const overwrite=(path,value)=>{chmodSync(path,0o600);writeFileSync(path,value);};
const change=(path,fn)=>{const value=json(path);fn(value);overwrite(path,JSON.stringify(value));};
test('continuation selects only original unrun rows, retains initial failed/zero and original order',()=>{
 const f=fixture();try{const before=readFileSync(join(f.original,'executions',f.schedule[0].execution_id,'outcome.json'));const result=inspectOrigin(ROOT,f.original,{claimPath:f.claim});assert.equal(result.remaining.length,95);assert.deepEqual(result.remaining,f.schedule.slice(1));assert.equal(result.retained[0].execution_id,f.schedule[0].execution_id);assert.deepEqual(readFileSync(join(f.original,'executions',f.schedule[0].execution_id,'outcome.json')),before);}finally{f.close();}
});
test('frozen continuation verifies its original hashes and unchanged contestant bundle/settings',()=>{
 const f=fixture();try{f.freeze();const v=verifyContinuation(ROOT,f.next,{claimPath:f.claim});assert.equal(v.manifest.executions,95);assert.equal(v.manifest.execution_config_hash,f.configHash);assert.equal(v.current.remaining.length,95);}finally{f.close();}
});
test('changed original failure, unrun placeholder, claim, or schedule cannot be silently replaced',()=>{
 for(const target of ['failure','placeholder','claim','schedule']){
  const f=fixture();try{f.freeze();if(target==='failure'||target==='placeholder'){const index=target==='failure'?0:1;change(join(f.original,'executions',f.schedule[index].execution_id,'outcome.json'),o=>o.reason='tampered');}else if(target==='claim')change(f.claim,c=>c.nonce='changed');else overwrite(join(f.original,'schedule.jsonl'),'changed');assert.throws(()=>verifyContinuation(ROOT,f.next,{claimPath:f.claim}));}finally{f.close();}
 }
});
test('already attempted entry or first failure added to remaining is rejected',()=>{
 const f=fixture();try{change(join(f.original,'executions',f.schedule[1].execution_id,'outcome.json'),o=>o.status='failed');assert.throws(()=>inspectOrigin(ROOT,f.original,{claimPath:f.claim}),/95 previously/);}finally{f.close();}
 const g=fixture();try{g.freeze();overwrite(join(g.next,'schedule.jsonl'),g.schedule.map(r=>JSON.stringify(r)).join('\n'));assert.throws(()=>verifyContinuation(ROOT,g.next,{claimPath:g.claim}),/schedule changed/);}finally{g.close();}
});
test('attempt artifacts under a not_run placeholder block continuation',()=>{
 const f=fixture();try{saveNew(join(f.original,'executions',f.schedule[1].execution_id,'public-request.json'),{fixture:true});assert.throws(()=>inspectOrigin(ROOT,f.original,{claimPath:f.claim}),/attempt artifacts/);}finally{f.close();}
});
test('changed continuation bundle or frozen source is rejected',()=>{
 for(const target of ['bundle','code']){const f=fixture();try{f.freeze();const path=target==='bundle'?join(f.next,'worker.bundle.mjs'):join(f.next,'frozen/scripts/full/continuation.mjs');overwrite(path,'changed');assert.throws(()=>verifyContinuation(ROOT,f.next,{claimPath:f.claim}),/changed/);}finally{f.close();}}
});
test('continuation archive refuses modified original input or reference archive',()=>{
 for(const path of ['frozen/evaluation/questions.jsonl','references/reference-0.md']){const f=fixture();try{overwrite(join(f.original,path),'changed');assert.throws(()=>inspectOrigin(ROOT,f.original,{claimPath:f.claim}),/changed/);}finally{f.close();}}
});
test('only explicit incident approval for 95 unrun rows and preserved failure authorizes continuation',()=>{
 const f=fixture();try{const m=f.freeze(),digest=sha(readFileSync(join(f.next,'manifest.json'))),a={phase:'full-first-pass-continuation',manifest_sha256:digest,original_manifest_sha256:m.origin.manifest_sha256,executions:95,attempts:1,approved:true,preserve_failed_entries:true,extra_executions_approved:false,automatic_topups:false,approved_by:'fixture',user_authorization:'yes (fixture only)',spending:{policy:'uncapped-explicitly-approved',cap:null,automatic_topups:false}};assert.equal(authorizeContinuation(a,digest,m),true);for(const update of [x=>x.executions=96,x=>x.preserve_failed_entries=false,x=>x.attempts=2,x=>x.original_manifest_sha256='other',x=>x.spending.cap=50,x=>x.approved=false,x=>x.user_authorization='']){const b=structuredClone(a);update(b);assert.throws(()=>authorizeContinuation(b,digest,m));}}finally{f.close();}
});
