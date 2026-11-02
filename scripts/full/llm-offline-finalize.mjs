#!/usr/bin/env node
// OFFLINE ONLY. Explicit post-hoc idempotent duplicate-object normalization.
// No model/auth imports beyond the existing modules' inert definitions; never calls a provider.
import {readFileSync,readdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,settings,validateJudgment,auditPayload} from './llm-judge-core.mjs';
import {verifyOrigin,validateContinuationApproval,planAdjudications,continuationPrompt,continuationAdjudicationPrompt} from './llm-continuation.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=p=>hash(readFileSync(p));
const need=(ok,msg)=>{if(!ok)throw Error(msg);};
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export function deduplicateExactCriteria(j) {
 const result=structuredClone(j),seen=new Map(),removed=[];
 need(Array.isArray(result.criteria),'Missing criteria');
 result.criteria=result.criteria.filter((c,index)=>{
  if(!seen.has(c.id)){seen.set(c.id,c);return true;}
  need(canonical(seen.get(c.id))===canonical(c),'Non-identical duplicate criterion: no normalization allowed');
  removed.push({id:c.id,removed_index:index});return false;
 });
 return {judgment:result,removed};
}
function filesUnder(dir,prefix='') {
 const result={};
 for(const item of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const name=prefix+item.name,p=join(dir,item.name);need(!item.isSymbolicLink(),'Unexpected symlink');if(item.isDirectory())Object.assign(result,filesUnder(p,name+'/'));else {need(item.isFile(),'Nonregular file');result[name]=sha(p);}}
 return result;
}
export function audit(work) {
 const m=read(join(work,'manifest.json')),launch=read(join(work,'launch.json')),terminal=read(join(work,'terminal.json'));
 need(m.phase==='full-first-pass-llm-judging-continuation-v1'&&sha(join(work,'manifest.json'))===readFileSync(join(work,'freeze.sha256'),'utf8').trim(),'Continuation freeze changed');
 for(const [p,h] of Object.entries(m.files))need(sha(join(work,p))===h,'Frozen continuation file changed');
 // New offline files are additions. Every implementation actually used for the paid run stays identical.
 for(const [p,h] of Object.entries(m.implementation))need(sha(join(root,p))===h&&sha(join(work,'frozen',p))===h,'Paid-run implementation changed');
 need(m.node===process.version&&JSON.stringify(m.settings)===JSON.stringify({...settings,concurrency:2}),'Settings/runtime changed');
 const old=verifyOrigin(m.origin.run);
 need(JSON.stringify(old.hashes)===JSON.stringify(m.origin.hashes)&&sha(join(m.origin.run,'manifest.json'))===m.origin.manifest_sha256,'Original artifacts changed');
 need(JSON.stringify(old.schedule)===JSON.stringify(read(join(work,'schedule.json'))),'Initial schedule changed');
 validateContinuationApproval(launch.approval,sha(join(work,'manifest.json')),m.origin.manifest_sha256);
 need(launch.manifest_sha256===sha(join(work,'manifest.json'))&&terminal.sdk_retries===0&&terminal.other_retries===0&&terminal.benchmark_calls===0,'Launch/scope changed');
 const packets=read(join(work,'judge-1-packets.json')),byId=new Map(packets.map(p=>[p.anonymous_id,p])),initial={},chosen={},normalizations=[],outcomes=old.rows.map(r=>r.outcome),callHashes={};
 const expected=new Set();
 for(const p of packets)initial[p.anonymous_id]=['judge-1','judge-2'].map(judge=>old.rows.find(r=>r.id===`${judge}-${p.anonymous_id}`&&r.outcome.status==='completed')?.judgment??null);
 function inspect(id,p,judge,req,{allowNormalization=false,ordinaryFailure=false}={}) {
  const dir=join(work,'calls',id),o=read(join(dir,'outcome.json'));
  need(canonical(read(join(dir,'request.json')))===canonical(req),'Request changed');
  auditPayload(read(join(dir,'outbound.json')),{id:settings.model},req.system,req.user);
  need(o.anonymous_id===p.anonymous_id&&o.judge_id===judge&&o.judge_type==='llm'&&o.fetches===1,'Call identity/count changed');
  expected.add(id);outcomes.push(o);Object.assign(callHashes,Object.fromEntries(Object.entries(filesUnder(dir)).map(([name,h])=>[id+'/'+name,h])));
  if(o.status==='failed'&&ordinaryFailure)return null;
  const raw=read(join(dir,'raw-result.json'));
  need(raw.stopReason==='stop'&&raw.model===settings.model&&raw.provider===settings.provider&&read(join(dir,'http-status.json')).status===200,'Incomplete raw judgment');
  need(canonical(raw.usage)===canonical(o.usage),'Usage changed');
  const rawJudgment=JSON.parse(raw.content.filter(b=>b.type==='text').map(b=>b.text).join('\n'));
  const {judgment,removed}=allowNormalization?deduplicateExactCriteria(rawJudgment):{judgment:rawJudgment,removed:[]};
  validateJudgment(judgment,p);
  if(removed.length){
   need(o.status==='failed'&&o.error==='Error: Criterion set mismatch','Duplicate exception cannot excuse another failure');
   normalizations.push({call_id:id,anonymous_id:p.anonymous_id,removed,original_status:o.status,original_error:o.error,raw_result_sha256:sha(join(dir,'raw-result.json')),raw_judgment:rawJudgment,normalized_judgment:judgment,rule:'Remove only deeply identical repeated criterion objects; preserve all remaining fields/quotes/scores. Applied symmetrically to all final adjudications. No unknown criterion removal, score/quote changes, conflicting-duplicate resolution or paid calls.'});
  }else{
   need(o.status==='completed'&&canonical(read(join(dir,'judgment.json')))===canonical(rawJudgment),'Selected valid judgment changed');
  }
  return judgment;
 }
 for(const e of old.schedule){
  const p=byId.get(e.anonymous_id),req={system:continuationPrompt,user:JSON.stringify({packet:p})};
  const j=inspect(e.id,p,e.judge,req,{ordinaryFailure:true}),o=outcomes.at(-1);
  need(o.attempt===e.attempt&&o.retry_of===(e.retry_of??null),'Attempt identity changed');
  initial[p.anonymous_id][e.judge==='judge-1'?0:1]=j;
 }
 const plan=planAdjudications(work,old),ids=plan.map(p=>p.anonymous_id);
 need(JSON.stringify(ids)===JSON.stringify(read(join(work,'adjudication-plan.json')).anonymous_ids)&&ids.length<=96,'Adjudication set changed');
 for(const p of packets){
  if(!ids.includes(p.anonymous_id)){need(initial[p.anonymous_id].every(Boolean),'Missing final judgment');chosen[p.anonymous_id]=initial[p.anonymous_id][0];continue;}
  const assessments=[...initial[p.anonymous_id]];if(parseInt(hash(p.anonymous_id).slice(0,8),16)%2)assessments.reverse();
  chosen[p.anonymous_id]=inspect('adjudicator-'+p.anonymous_id,p,'adjudicator',{system:continuationAdjudicationPrompt,user:JSON.stringify({packet:p,prior_assessments:assessments})},{allowNormalization:true});
 }
 need(JSON.stringify([...expected].sort())===JSON.stringify(readdirSync(join(work,'calls')).sort())&&expected.size===terminal.calls_started&&expected.size===157+ids.length,'Unexpected/missing calls');
 need(outcomes.length===194+ids.length&&outcomes.filter(o=>o.retry_of).length===2&&outcomes.filter(o=>o.status==='failed').length===terminal.failed_calls+2,'Attempt/failure counts changed');
 need(normalizations.length>0&&terminal.status==='paused','Use the strict audit for an ordinary completed run');
 const usage={input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,catalog_estimate_usd:0,provider_usage_unavailable_calls:0};
 for(const o of outcomes){if(!(o.usage?.totalTokens>0)){usage.provider_usage_unavailable_calls++;continue;}for(const k of ['input','output','cacheRead','cacheWrite','totalTokens'])if(typeof o.usage[k]==='number')usage[k]+=o.usage[k];if(typeof o.usage.cost?.total==='number')usage.catalog_estimate_usd+=o.usage.cost.total;}
 return {initial,chosen,adjudicated_ids:ids,normalizations,strict_unresolved_anonymous_ids:normalizations.map(n=>n.anonymous_id),call_hashes:callHashes,
  metadata:{judge_type:'llm',model:settings.model,provider:settings.provider,reasoning:'medium',human_validated:false,calls:outcomes.length,initial_calls:194,initial_slots:192,initial_retries:2,other_retries:0,adjudication_calls:ids.length,missing_valid_initial_answers:Object.keys(initial).filter(aid=>initial[aid].some(j=>!j)),failed_calls_preserved:outcomes.filter(o=>o.status==='failed').length,usage,actual_charges:null,accounting_status:'Actual charges unavailable, not zero. Observed catalog estimates are not actual bills; interrupted usage remains unknown.',manifest_sha256:sha(join(work,'manifest.json')),original_manifest_sha256:m.origin.manifest_sha256,strict_run_status:terminal.status,strict_review_complete:false,offline_duplicate_normalized_review_complete:true,posthoc_validation_amendment:true,duplicate_normalized_adjudications:normalizations.length,normalized_anonymous_ids:normalizations.map(n=>n.anonymous_id),origin_preserved:true,source_fingerprint:m.source_fingerprint,started_at:read(join(m.origin.run,'launch.json')).started_at,continuation_started_at:launch.started_at,ended_at:terminal.ended_at}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{need(process.argv[2],'Existing continuation required');console.log(JSON.stringify(audit(resolve(process.argv[2]))));}catch(e){console.error(String(e));process.exitCode=1;}
}
