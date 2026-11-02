import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scheduleRemaining,validateContinuationApproval,retryIds,verifyOrigin,prepare,verify,planAdjudications,continuationPrompt,continuationAdjudicationPrompt} from './llm-continuation.mjs';
import {prompt,adjudicationPrompt} from './llm-judge-core.mjs';
const ps=Array.from({length:96},(_,i)=>({anonymous_id:'A'+String(i+1).padStart(4,'0')}));
const byJudge={'judge-1':ps,'judge-2':[...ps].reverse()};
function previous(){const result={};for(let i=1;i<=36;i++)if(i!==28)result['judge-1-A'+String(i).padStart(4,'0')]={status:'completed'};for(const id of retryIds)result[id]={status:'failed'};return result;}
test('exactly 155 unattempted slots and only two authorized retries, no completed replacements',()=>{
 const prev=previous(),before=JSON.stringify(prev),schedule=scheduleRemaining(byJudge,prev);
 assert.equal(schedule.length,157);assert.equal(schedule.filter(r=>r.attempt===2).length,2);
 assert.deepEqual(schedule.slice(0,2).map(r=>r.id),retryIds);
 assert.equal(schedule.filter(r=>r.attempt===1).length,155);
 assert.ok(schedule.every(r=>prev[r.id]?.status!=='completed'));
 assert.equal(new Set(schedule.map(r=>r.id)).size,157);
 assert.deepEqual(schedule.filter(r=>r.judge==='judge-2').map(r=>r.anonymous_id),byJudge['judge-2'].map(p=>p.anonymous_id));
 assert.equal(JSON.stringify(prev),before);
});
test('schedule rejects unrelated failure, missing original failure, extra or nonterminal call',()=>{
 for(const change of [p=>p['judge-1-A0001'].status='failed',p=>delete p[retryIds[0]],p=>p['judge-3-A0001']={status:'failed'},p=>p['judge-1-A0001'].status='running']){
  const p=previous();change(p);assert.throws(()=>scheduleRemaining(byJudge,p));
 }
});
test('explicit incident-bound approval, no implicit additional retries',()=>{
 const a={phase:'full-first-pass-llm-judging-continuation-v1',manifest_sha256:'new',origin_manifest_sha256:'old',approved:true,approved_by:'user',user_authorization:'yes, go ahead',new_initial_calls:157,unattempted_initial_calls:155,retry_ids:retryIds,max_adjudications:96,other_retries:0,benchmark_reruns:false,automatic_topups:false,spending:{policy:'uncapped-explicitly-approved',cap:null}};
 validateContinuationApproval(a,'new','old');
 for(const [k,v] of [['manifest_sha256','wrong'],['origin_manifest_sha256','wrong'],['other_retries',1],['new_initial_calls',158],['unattempted_initial_calls',156],['max_adjudications',97],['retry_ids',[...retryIds,'judge-1-A0001']],['approved',false],['benchmark_reruns',true],['automatic_topups',true]])assert.throws(()=>validateContinuationApproval({...a,[k]:v},'new','old'));
});
test('quote reliability append does not change original substantive prompts',()=>{
 assert.ok(continuationPrompt.startsWith(prompt));assert.ok(continuationAdjudicationPrompt.startsWith(adjudicationPrompt));
 assert.match(continuationPrompt,/must not change factual rubric credit/);
 assert.match(continuationAdjudicationPrompt,/Never invent a missing assessment or count it as zero/);
});
test('missing initial pair is adjudicated without inventing a judgment',()=>{
 const dir=mkdtempSync(join(tmpdir(),'llm-plan-'));
 try {
  writeFileSync(join(dir,'judge-1-packets.json'),JSON.stringify(ps));
  const j={criteria:[{id:'c1',score:1,retained_support:'unknown'}],version:{status:'exact',compliant:true},extra_claims:[],reference_concerns:[]};
  const rows=ps.flatMap(p=>['judge-1','judge-2'].map(judge=>({id:judge+'-'+p.anonymous_id,outcome:{status:'completed'},judgment:j})));
  rows.splice(rows.findIndex(r=>r.id==='judge-2-A0001'),1);
  mkdirSync(join(dir,'calls'));
  assert.deepEqual(planAdjudications(dir,{rows}).map(p=>p.anonymous_id),['A0001']);
 }finally{rmSync(dir,{recursive:true});}
});
test('offline continuation freeze binds all original logs, rejects tampering and overwrite',()=>{
 const original=join(process.env.HOME ?? '', 'random/docs-check-runs/2026-11-02-first-pass-llm-judging-1');
 if(!existsSync(original))return;
 const tmp=mkdtempSync(join(tmpdir(),'llm-freeze-')),origin=join(tmp,'origin'),work=join(tmp,'continuation');
 try {
  cpSync(original,origin,{recursive:true});
  const hash=readFileSync(join(origin,'freeze.sha256'),'utf8').trim();
  writeFileSync(join(tmp,'docs-check-llm-judging-consumed.json'),JSON.stringify({work:origin,manifest_sha256:hash}));
  prepare(origin,work);verify(work,{source:false,dependencies:false});
  assert.throws(()=>prepare(origin,work),/EEXIST/);
  writeFileSync(join(origin,'controller.log'),'tampered original log');
  assert.throws(()=>verify(work,{source:false,dependencies:false}),/original artifacts changed/);
 }finally{rmSync(tmp,{recursive:true});}
});
test('real paused origin validates frozen originals without modifying them or requiring live implementation equality',()=>{
 const origin=join(process.env.HOME ?? '', 'random/docs-check-runs/2026-11-02-first-pass-llm-judging-1');
 if(!existsSync(origin))return;
 const a=verifyOrigin(origin,{source:false,dependencies:false});
 assert.equal(a.rows.length,37);assert.equal(a.rows.filter(r=>r.judgment).length,35);assert.equal(a.schedule.length,157);
 const b=verifyOrigin(origin,{source:false,dependencies:false});assert.deepEqual(a.hashes,b.hashes);
});
