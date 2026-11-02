#!/usr/bin/env node
// Incident-scoped append-only judging continuation. Never reruns contestant workflows.
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,statSync} from 'node:fs';
import {join,resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {normalizeContext} from '../pilot/node_modules/@earendil-works/pi-ai/dist/index.js';
import {stream} from '../pilot/node_modules/@earendil-works/pi-ai/dist/api/openai-codex-responses.js';
import {getEncoding} from '../pilot/node_modules/js-tiktoken/dist/index.js';
import {treeDigest} from './control.mjs';
import {hash,json,settings,prompt,adjudicationPrompt,validateJudgment,validateApproval,needsAdjudication,auditPayload,pool} from './llm-judge-core.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const PHASE='full-first-pass-llm-judging-continuation-v1';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=p=>hash(readFileSync(p));
const need=(ok,msg)=>{if(!ok)throw new Error(msg);};
const save=(p,v)=>{mkdirSync(dirname(p),{recursive:true,mode:0o700});writeFileSync(p,json(v),{mode:0o600,flag:'wx'});};
export const retryIds=['judge-1-A0028','judge-1-A0063'];
const quoteGuidance='\nQuotation reliability reminder: use SHORT, exact substrings (prefer 3-12 words) for answer, reference and retained quotes. Do not reconstruct a sentence, remove Markdown, or unescape literal JSON text. If no exact retained quotation can be copied confidently, use retained_support unknown and omit retained_quote; this diagnostic uncertainty must not change factual rubric credit.';
export const continuationPrompt=prompt+quoteGuidance;
export const continuationAdjudicationPrompt=adjudicationPrompt+quoteGuidance+'\nOne or both prior assessments may be null because no valid initial judgment is available. Never invent a missing assessment or count it as zero. Independently grade the candidate using the frozen reference. This is the single authorized adjudication, not a retry of an initial call.';
function privatePath(p){need((statSync(p).mode&0o077)===0,'Private permissions required');}
function filesUnder(dir,prefix='') {
 const result={};
 for(const item of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
  const name=prefix+item.name,p=join(dir,item.name);
  need(!item.isSymbolicLink(),'Symlink in judging artifacts');
  if(item.isDirectory())Object.assign(result,filesUnder(p,name+'/'));else if(item.isFile())result[name]=sha(p);else throw Error('Nonregular artifact');
 }
 return result;
}
function implementation(){return Object.fromEntries(readdirSync(join(root,'scripts/full')).filter(n=>/\.(mjs|py)$/.test(n)).sort().map(n=>['scripts/full/'+n,sha(join(root,'scripts/full',n))]));}
function verifySource(run){
 const p=spawnSync('python3',[join(root,'scripts/full/llm_report.py'),'verify-source',run],{encoding:'utf8',timeout:120000,maxBuffer:10*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 need(p.status===0,'Source verification failed: '+p.stderr);return JSON.parse(p.stdout);
}
function packetMap(origin){return new Map(read(join(origin,'judge-1-packets.json')).map(p=>[p.anonymous_id,p]));}
function requestFor(p,judge,assessments) {
 if(judge!=='adjudicator')return {system:continuationPrompt,user:JSON.stringify({packet:p})};
 assessments=[...assessments];if(parseInt(hash(p.anonymous_id).slice(0,8),16)%2)assessments.reverse();
 return {system:continuationAdjudicationPrompt,user:JSON.stringify({packet:p,prior_assessments:assessments})};
}
export function scheduleRemaining(packetsByJudge,previous) {
 const all=['judge-1','judge-2'].flatMap(judge=>packetsByJudge[judge].map(p=>({id:`${judge}-${p.anonymous_id}`,judge,anonymous_id:p.anonymous_id,attempt:1})));
 need(new Set(all.map(x=>x.id)).size===all.length,'Duplicate initial slot');
 const expected=new Set(all.map(x=>x.id));
 need(Object.keys(previous).every(id=>expected.has(id)),'Unexpected prior call');
 const failed=Object.entries(previous).filter(([,o])=>o.status==='failed').map(([id])=>id).sort();
 need(JSON.stringify(failed)===JSON.stringify([...retryIds].sort()),'Only two approved failures may retry');
 need(Object.values(previous).every(o=>['completed','failed'].includes(o.status)),'Nonterminal prior call');
 const retries=retryIds.map(id=>({...all.find(x=>x.id===id),attempt:2,retry_of:id}));
 return [...retries,...all.filter(x=>!(x.id in previous))];
}
function validateCall(dir,p,req,judge,{requireCompleted=true}={}) {
 const outcome=read(join(dir,'outcome.json'));
 need(JSON.stringify(read(join(dir,'request.json')))===JSON.stringify(req),'Call request changed');
 if(existsSync(join(dir,'outbound.json')))auditPayload(read(join(dir,'outbound.json')),{id:settings.model},req.system,req.user);
 need(outcome.anonymous_id===p.anonymous_id&&outcome.judge_id===judge&&outcome.judge_type==='llm'&&outcome.fetches===1,'Call identity/request count mismatch');
 if(outcome.status!=='completed') {
  need(!requireCompleted&&outcome.status==='failed'&&typeof outcome.error==='string','Valid completed judgment required');
  return {outcome,judgment:null};
 }
 const raw=read(join(dir,'raw-result.json')),j=read(join(dir,'judgment.json'));
 need(read(join(dir,'http-status.json')).status===200&&raw.stopReason==='stop'&&raw.model===settings.model&&raw.provider===settings.provider,'Raw judge result mismatch');
 need(JSON.stringify(JSON.parse(raw.content.filter(b=>b.type==='text').map(b=>b.text).join('\n')))===JSON.stringify(j),'Judgment differs from raw output');
 validateJudgment(j,p);
 need(outcome.model===settings.model&&outcome.reasoning==='medium'&&JSON.stringify(outcome.usage)===JSON.stringify(raw.usage),'Model/usage mismatch');
 return {outcome,judgment:j};
}
export function verifyOrigin(origin,{source=true,dependencies=true}={}) {
 privatePath(origin);privatePath(dirname(origin));
 const m=read(join(origin,'manifest.json'));
 need(sha(join(origin,'manifest.json'))===readFileSync(join(origin,'freeze.sha256'),'utf8').trim(),'Original manifest changed');
 need(m.phase==='full-first-pass-llm-judging-v1'&&JSON.stringify(m.settings)===JSON.stringify(settings)&&m.node===process.version,'Wrong original freeze');
 for(const [p,h] of Object.entries(m.files))need(sha(join(origin,p))===h,'Original frozen file changed: '+p);
 // Validate the ORIGINAL frozen implementations, not a later repository revision.
 for(const [p,h] of Object.entries(m.implementation))need(sha(join(origin,'frozen',p))===h,'Original frozen implementation changed');
 const launch=read(join(origin,'launch.json')),terminal=read(join(origin,'terminal.json'));
 validateApproval(launch.approval,sha(join(origin,'manifest.json')));
 need(launch.manifest_sha256===sha(join(origin,'manifest.json'))&&terminal.status==='paused'&&terminal.calls_started===37&&terminal.no_retries===true&&terminal.no_benchmark_calls===true,'Wrong paused origin');
 const claim=read(join(dirname(origin),'docs-check-llm-judging-consumed.json'));
 need(claim.work===origin&&claim.manifest_sha256===sha(join(origin,'manifest.json')),'Original claim changed');
 if(source)need(verifySource(m.source_run).fingerprint===m.source_fingerprint,'Original benchmark source changed');
 if(dependencies)need(JSON.stringify(treeDigest(join(root,'scripts/pilot/node_modules')))===JSON.stringify(m.dependencies),'Pinned dependencies changed');
 const packets=packetMap(origin),previous={},rows=[];
 for(const id of readdirSync(join(origin,'calls')).sort()) {
  const match=/^(judge-[12])-(A\d{4})$/.exec(id);need(match&&packets.has(match[2]),'Unexpected original call');
  const p=packets.get(match[2]),req={system:prompt,user:JSON.stringify({packet:p})};
  const call=validateCall(join(origin,'calls',id),p,req,match[1],{requireCompleted:false});
  previous[id]=call.outcome;rows.push({id,...call});
 }
 need(rows.length===37&&rows.filter(r=>r.outcome.status==='completed').length===35,'Wrong original attempt counts');
 const schedule=scheduleRemaining(Object.fromEntries(['judge-1','judge-2'].map(j=>[j,read(join(origin,`${j}-packets.json`))])),previous);
 need(schedule.length===157&&schedule.filter(x=>x.attempt===2).length===2,'Wrong incident remainder');
 return {manifest:m,rows,schedule,hashes:filesUnder(origin)};
}
export function prepare(origin,work) {
 origin=resolve(origin);work=resolve(work);const rel=relative(root,work);
 need(rel==='..'||rel.startsWith('../'),'Continuation must be outside checkout');privatePath(dirname(work));
 const old=verifyOrigin(origin),impl=implementation();mkdirSync(work,{mode:0o700});
 const files={};
 function copy(name,bytes){mkdirSync(dirname(join(work,name)),{recursive:true,mode:0o700});writeFileSync(join(work,name),bytes,{mode:0o600,flag:'wx'});files[name]=hash(bytes);}
 for(const name of ['judge-1-packets.json','judge-2-packets.json','controller/blind-map.json','source-snapshot.json','model.json'])copy(name,readFileSync(join(origin,name)));
 copy('judge-prompt.txt',continuationPrompt);copy('adjudication-prompt.txt',continuationAdjudicationPrompt);
 copy('schedule.json',json(old.schedule));copy('protocol-amendment.md',readFileSync(join(root,'scripts/full/LLM-CONTINUATION.md')));
 for(const p of Object.keys(impl))copy('frozen/'+p,readFileSync(join(root,p)));
 const m={phase:PHASE,prepared_at:new Date().toISOString(),origin:{run:origin,manifest_sha256:sha(join(origin,'manifest.json')),hashes:old.hashes},source_run:old.manifest.source_run,source_fingerprint:old.manifest.source_fingerprint,settings:{...settings,concurrency:2},files,implementation:impl,dependencies:old.manifest.dependencies,node:process.version,
   initial_new_calls:157,remaining_initial_slots:155,retry_ids:retryIds,max_adjudications:96,original_completed_retained:35,
   missing_initial_policy:'Preserve ordinary initial failures, never score them as contestant zeros. Continue independent scheduled slots; missing/invalid initial assessments trigger the one authorized adjudication. No extra initial retries. A failed adjudication blocks the complete quality report. Agreement uses available valid pairs only and reports missingness.',
   substantive_rubric_unchanged:true,quotation_guidance_appended:true,human_validated:false};
 save(join(work,'manifest.json'),m);writeFileSync(join(work,'freeze.sha256'),sha(join(work,'manifest.json'))+'\n',{mode:0o600,flag:'wx'});return m;
}
export function verify(work,{source=true,dependencies=true}={}) {
 privatePath(work);privatePath(dirname(work));const m=read(join(work,'manifest.json'));
 need(m.phase===PHASE&&sha(join(work,'manifest.json'))===readFileSync(join(work,'freeze.sha256'),'utf8').trim(),'Continuation manifest changed');
 need(m.node===process.version&&JSON.stringify(m.settings)===JSON.stringify({...settings,concurrency:2})&&m.initial_new_calls===157&&m.remaining_initial_slots===155&&m.max_adjudications===96&&JSON.stringify(m.retry_ids)===JSON.stringify(retryIds),'Continuation settings changed');
 for(const [p,h] of Object.entries(m.files))need(sha(join(work,p))===h,'Continuation frozen file changed');
 need(JSON.stringify(implementation())===JSON.stringify(m.implementation),'Continuation implementation changed');
 const old=verifyOrigin(m.origin.run,{source,dependencies});
 need(sha(join(m.origin.run,'manifest.json'))===m.origin.manifest_sha256&&JSON.stringify(old.hashes)===JSON.stringify(m.origin.hashes),'Preserved original artifacts changed');
 need(JSON.stringify(read(join(work,'schedule.json')))===JSON.stringify(old.schedule),'Continuation schedule changed');
 return {manifest:m,old};
}
export function validateContinuationApproval(a,manifestHash,originHash) {
 need(a.phase===PHASE&&a.manifest_sha256===manifestHash&&a.origin_manifest_sha256===originHash&&a.approved===true&&a.approved_by==='user'&&typeof a.user_authorization==='string'&&a.user_authorization.trim(),'Exact incident approval required');
 need(a.new_initial_calls===157&&a.unattempted_initial_calls===155&&JSON.stringify(a.retry_ids)===JSON.stringify(retryIds)&&a.max_adjudications===96&&a.other_retries===0&&a.benchmark_reruns===false&&a.automatic_topups===false&&a.spending?.policy==='uncapped-explicitly-approved'&&a.spending.cap===null,'Incident approval scope mismatch');
}
function selected(work,old,p,judge) {
 const id=`${judge}-${p.anonymous_id}`;
 const previous=old.rows.find(r=>r.id===id);
 if(previous?.outcome.status==='completed')return previous.judgment;
 const dir=join(work,'calls',id);
 if(!existsSync(join(dir,'outcome.json')))return null;
 return validateCall(dir,p,requestFor(p,judge),judge,{requireCompleted:false}).judgment;
}
export function planAdjudications(work,old) {
 return read(join(work,'judge-1-packets.json')).filter(p=>{
  const a=selected(work,old,p,'judge-1'),b=selected(work,old,p,'judge-2');return !a||!b||needsAdjudication(a,b);
 });
}
export async function run(work,approvalPath) {
 const {manifest:m,old}=verify(work),approval=read(approvalPath);
 validateContinuationApproval(approval,sha(join(work,'manifest.json')),m.origin.manifest_sha256);
 const claim=join(dirname(work),'docs-check-llm-judging-continuation-1-consumed.json');
 need(!existsSync(claim)&&!existsSync(join(work,'launch.json'))&&!existsSync(join(work,'calls')),'Continuation consumed; never replay');
 save(claim,{work,manifest_sha256:sha(join(work,'manifest.json')),claimed_at:new Date().toISOString()});
 save(join(work,'launch.json'),{approval,manifest_sha256:sha(join(work,'manifest.json')),started_at:new Date().toISOString()});
 const model=read(join(work,'model.json')),encoding=getEncoding('o200k_base'),packets=packetMap(work);
 let stopped=false,total=0,failures=0,consecutiveFailures=0,signaled=false;
 const stop=()=>{stopped=true;signaled=true;};process.on('SIGTERM',stop);process.on('SIGINT',stop);
 const auth=()=>{const p=spawnSync('pi',['auth','check','--provider',settings.provider,'--json','--credentials'],{cwd:'/tmp',encoding:'utf8',timeout:30000,maxBuffer:1024*1024});need(p.status===0,'AUTH: Judge credentials unavailable');const a=JSON.parse(p.stdout);need(a.status==='ready'&&typeof a.credentials==='string','AUTH: Judge credentials unavailable');return a.credentials;};
 let fatal;
 async function call(entry) {
  if(stopped)throw Error('Controller stopping; no new dispatch');
  need(++total<=253,'Continuation call cap exceeded');
  const p=packets.get(entry.anonymous_id),judge=entry.judge,dir=join(work,'calls',entry.id);
  const assessments=judge==='adjudicator'?['judge-1','judge-2'].map(j=>selected(work,old,p,j)):undefined;
  const req=requestFor(p,judge,assessments);mkdirSync(dir,{recursive:true,mode:0o700});save(join(dir,'request.json'),req);
  let token='',result,fetches=0,auditFailure=false;const start=performance.now(),startUtc=new Date().toISOString();
  const record=(name,value)=>writeFileSync(join(dir,name),token?json(value).split(token).join('[REDACTED]'):json(value),{mode:0o600,flag:'wx'});
  try {
   token=auth();const c=new AbortController(),timer=setTimeout(()=>c.abort(),settings.deadline_ms);
   try {
    const s=stream(model,normalizeContext({systemPrompt:req.system,messages:[{role:'user',content:req.user,timestamp:Date.now()}],tools:[]}),{
     apiKey:token,reasoningEffort:'medium',transport:'sse',cacheRetention:'none',toolChoice:'none',maxRetries:0,signal:c.signal,
     onPayload:payload=>{try{auditPayload(payload,model,req.system,req.user);record('outbound.json',payload);}catch(e){auditFailure=true;throw e;}},
     fetch:async(url,options)=>{const u=new URL(url);if(++fetches!==1||u.origin!=='https://chatgpt.com'||u.pathname!=='/backend-api/codex/responses'||options.method!=='POST'){auditFailure=true;throw Error('AUDIT: Unapproved request or retry');}return fetch(url,options);},
     onResponse:r=>record('http-status.json',{status:r.status}),
    });
    const consume=(async()=>{let output='';for await(const e of s)if(e.type==='text_delta'){output+=e.delta;if(encoding.encode(output).length>settings.output_proxy_tokens)c.abort();}})();
    [result]=await Promise.all([s.result(),consume]);
   }finally{clearTimeout(timer);}
   record('raw-result.json',result);need(result.stopReason==='stop'&&!result.content.some(b=>b.type==='toolCall'),'Judge failed: '+(result.errorMessage??result.stopReason));
   const answer=result.content.filter(b=>b.type==='text').map(b=>b.text).join('\n');need(encoding.encode(answer).length<=settings.output_proxy_tokens,'Output cap exceeded');
   record('judgment.json',validateJudgment(JSON.parse(answer),p));
   record('outcome.json',{status:'completed',judge_id:judge,judge_type:'llm',anonymous_id:p.anonymous_id,attempt:entry.attempt,retry_of:entry.retry_of??null,model:model.id,provider:model.provider,reasoning:'medium',fetches,started_at:startUtc,ended_at:new Date().toISOString(),elapsed_ms:performance.now()-start,usage:result.usage,actual_charge:null});
   consecutiveFailures=0;console.log('JUDGE_FINISH',entry.id,'attempt',entry.attempt);
  } catch(error) {
   failures++;consecutiveFailures++;
   const statusPath=join(dir,'http-status.json'),status=existsSync(statusPath)?read(statusPath).status:null;
   const systemic=auditFailure||[401,403,402,429].includes(status)||/AUTH:|quota|usage limit/i.test(String(error))||consecutiveFailures>=3;
   record('outcome.json',{status:'failed',judge_id:judge,judge_type:'llm',anonymous_id:p.anonymous_id,attempt:entry.attempt,retry_of:entry.retry_of??null,fetches,started_at:startUtc,ended_at:new Date().toISOString(),elapsed_ms:performance.now()-start,usage:result?.usage??null,actual_charge:null,error:String(error),systemic});
   console.log('JUDGE_FAILED',entry.id,systemic?'PAUSED':'preserved; no retry');
   if(systemic||judge==='adjudicator'){stopped=true;throw error;}
  }
 }
 try {
  const schedule=read(join(work,'schedule.json'));
  for(const judge of ['judge-1','judge-2'])await pool(schedule.filter(x=>x.judge===judge),m.settings.concurrency,call);
  if(stopped)throw Error('Stop requested');
  const plan=planAdjudications(work,old);need(plan.length<=96,'Adjudication cap exceeded');
  save(join(work,'adjudication-plan.json'),{anonymous_ids:plan.map(p=>p.anonymous_id),missing_initial_ids:plan.filter(p=>!selected(work,old,p,'judge-1')||!selected(work,old,p,'judge-2')).map(p=>p.anonymous_id)});
  await pool(plan.map(p=>({id:`adjudicator-${p.anonymous_id}`,anonymous_id:p.anonymous_id,judge:'adjudicator',attempt:1})),m.settings.concurrency,call);
 }catch(error){fatal=error;}
 finally {
  process.off('SIGTERM',stop);process.off('SIGINT',stop);
  save(join(work,'terminal.json'),{status:fatal||signaled?'paused':'completed',calls_started:total,failed_calls:failures,ended_at:new Date().toISOString(),sdk_retries:0,authorized_initial_retries:2,other_retries:0,benchmark_calls:0,error:fatal?'Paused; inspect preserved outcomes':null});
 }
 if(fatal)throw Error('Continuation paused; no further attempts authorized');
 console.log('LLM_CONTINUATION_COMPLETE',work,total,'new calls;',failures,'preserved new failures');
}
export function audit(work) {
 const {manifest:m,old}=verify(work),launch=read(join(work,'launch.json')),terminal=read(join(work,'terminal.json'));
 validateContinuationApproval(launch.approval,sha(join(work,'manifest.json')),m.origin.manifest_sha256);
 need(launch.manifest_sha256===sha(join(work,'manifest.json'))&&terminal.status==='completed'&&terminal.sdk_retries===0&&terminal.other_retries===0&&terminal.benchmark_calls===0,'Continuation incomplete; no quality report');
 const ps=read(join(work,'judge-1-packets.json')),plan=planAdjudications(work,old),planIds=plan.map(p=>p.anonymous_id);
 need(JSON.stringify(read(join(work,'adjudication-plan.json')).anonymous_ids)===JSON.stringify(planIds),'Adjudication plan changed');
 const expected=new Set(read(join(work,'schedule.json')).map(x=>x.id));for(const aid of planIds)expected.add('adjudicator-'+aid);
 need(JSON.stringify([...expected].sort())===JSON.stringify(readdirSync(join(work,'calls')).sort())&&expected.size===terminal.calls_started,'Unexpected/missing calls');
 const initial={},chosen={},outcomes=old.rows.map(r=>r.outcome),missing=[];
 for(const p of ps) {
  const pair=['judge-1','judge-2'].map(judge=>selected(work,old,p,judge));initial[p.anonymous_id]=pair;
  if(pair.some(j=>!j))missing.push(p.anonymous_id);
  if(planIds.includes(p.anonymous_id)){
   const call=validateCall(join(work,'calls','adjudicator-'+p.anonymous_id),p,requestFor(p,'adjudicator',pair),'adjudicator');chosen[p.anonymous_id]=call.judgment;outcomes.push(call.outcome);
  }else{need(pair.every(Boolean),'Missing initial judgments');chosen[p.anonymous_id]=pair[0];}
 }
 for(const e of read(join(work,'schedule.json'))) {
  const p=ps.find(p=>p.anonymous_id===e.anonymous_id),call=validateCall(join(work,'calls',e.id),p,requestFor(p,e.judge),e.judge,{requireCompleted:false});
  need(call.outcome.attempt===e.attempt&&call.outcome.retry_of===(e.retry_of??null),'Attempt identity changed');outcomes.push(call.outcome);
 }
 need(outcomes.length===194+plan.length&&outcomes.filter(o=>o.retry_of).length===2,'Total attempt/retry count mismatch');
 const usage={input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,catalog_estimate_usd:0,provider_usage_unavailable_calls:0};
 for(const o of outcomes) {
  // Interrupted streams can retain SDK-initialized zeros: do not call those zero consumption.
  const known=o.usage&&o.usage.totalTokens>0;
  if(!known){usage.provider_usage_unavailable_calls++;continue;}
  for(const k of ['input','output','cacheRead','cacheWrite','totalTokens'])if(typeof o.usage[k]==='number')usage[k]+=o.usage[k];
  if(typeof o.usage.cost?.total==='number')usage.catalog_estimate_usd+=o.usage.cost.total;
 }
 return {initial,chosen,adjudicated_ids:planIds,metadata:{judge_type:'llm',model:settings.model,provider:settings.provider,reasoning:'medium',human_validated:false,calls:outcomes.length,initial_calls:194,initial_slots:192,initial_retries:2,other_retries:0,adjudication_calls:plan.length,missing_valid_initial_answers:missing,failed_calls:outcomes.filter(o=>o.status==='failed').length,usage,actual_charges:null,accounting_status:'Unknown actual spend; observed catalog estimates are not bills; interrupted-call consumption remains unknown.',manifest_sha256:sha(join(work,'manifest.json')),original_manifest_sha256:m.origin.manifest_sha256,origin_preserved:true,source_fingerprint:m.source_fingerprint,started_at:read(join(m.origin.run,'launch.json')).started_at,continuation_started_at:launch.started_at,ended_at:terminal.ended_at,missing_initial_policy:m.missing_initial_policy,quotation_guidance_appended:true}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const [cmd,arg,...rest]=process.argv.slice(2);
 try {
  need(arg,'Expected --prepare ORIGIN --out NEW | --run WORK --approval FILE | --verify WORK | --audit WORK');
  if(cmd==='--prepare'){need(rest[0]==='--out'&&rest[1]&&rest.length===2,'New output required');prepare(arg,rest[1]);console.log('LLM_CONTINUATION_PREPARED',resolve(rest[1]));}
  else if(cmd==='--verify'){verify(resolve(arg));console.log('LLM_CONTINUATION_VERIFIED');}
  else if(cmd==='--run'){need(rest[0]==='--approval'&&rest[1]&&rest.length===2,'Incident approval required');await run(resolve(arg),resolve(rest[1]));}
  else if(cmd==='--audit')console.log(JSON.stringify(audit(resolve(arg))));
  else throw Error('Unknown command');
 }catch(error){console.error(String(error));process.exitCode=1;}
}
