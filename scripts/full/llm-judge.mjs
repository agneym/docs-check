#!/usr/bin/env node
// Host-only judge calls: explicit bounded approval, fresh API contexts, no contestant calls.
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,statSync} from 'node:fs';
import {resolve,dirname,join,relative} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {normalizeContext} from '../pilot/node_modules/@earendil-works/pi-ai/dist/index.js';
import {stream} from '../pilot/node_modules/@earendil-works/pi-ai/dist/api/openai-codex-responses.js';
import {getEncoding} from '../pilot/node_modules/js-tiktoken/dist/index.js';
import {treeDigest} from './control.mjs';
import {hash,json,settings,prompt,adjudicationPrompt,validateJudgment,validateApproval,needsAdjudication,auditPayload,pool} from './llm-judge-core.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=p=>hash(readFileSync(p));
const need=(ok,msg)=>{if(!ok)throw new Error(msg);};
const save=(path,value)=>{mkdirSync(dirname(path),{recursive:true,mode:0o700});writeFileSync(path,json(value),{flag:'wx',mode:0o600});};
function sourceSnapshot(run) {
 const p=spawnSync('python3',[join(root,'scripts/full/llm_report.py'),'verify-source',run],{encoding:'utf8',timeout:120000,maxBuffer:10*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 if(p.status!==0)throw new Error('Source verification failed: '+p.stderr);
 return JSON.parse(p.stdout);
}
function implementation() {
 return Object.fromEntries(readdirSync(join(root,'scripts/full')).filter(n=>/\.(mjs|py)$/.test(n)).sort().map(n=>['scripts/full/'+n,sha(join(root,'scripts/full',n))]));
}
function privatePath(path) {need((statSync(path).mode&0o077)===0,'Private permissions required: '+path);}
export function prepare(run,work) {
 run=resolve(run);work=resolve(work);
 const rel=relative(root,work);
 need(rel==='..'||rel.startsWith('../'),'Judge storage must be outside checkout');
 privatePath(dirname(work));
 const snapshot=sourceSnapshot(run);
 need(snapshot.executions===96&&snapshot.judging.bootstrap_samples===10000&&snapshot.judging.bootstrap_seed===settings.bootstrap_seed,'Expected complete frozen 96-entry source');
 const store=read(join(homedir(),'.pi/agent/models-store.json'));
 const m=store[settings.provider]?.models.find(m=>m.id===settings.model);
 need(m?.thinkingLevelMap?.medium==='medium'&&m.provider===settings.provider&&m.api==='openai-codex-responses','Approved model unavailable');
 const model=Object.fromEntries(['id','name','api','provider','baseUrl','reasoning','input','cost','contextWindow','maxTokens','thinkingLevelMap','compat'].filter(k=>m[k]!==undefined).map(k=>[k,m[k]]));
 need(new URL(model.baseUrl).origin==='https://chatgpt.com','Unexpected judge endpoint');
 mkdirSync(work,{mode:0o700});
 const files={};
 function storeFile(name,bytes) {mkdirSync(dirname(join(work,name)),{recursive:true,mode:0o700});writeFileSync(join(work,name),bytes,{flag:'wx',mode:0o600});files[name]=hash(bytes);}
 for(const name of ['judge-1-packets.json','judge-2-packets.json'])storeFile(name,readFileSync(join(run,'judging',name)));
 storeFile('controller/blind-map.json',readFileSync(join(run,'judging/blind-map.json')));
 storeFile('source-snapshot.json',json(snapshot));storeFile('model.json',json(model));
 storeFile('judge-prompt.txt',prompt);storeFile('adjudication-prompt.txt',adjudicationPrompt);
 const impl=implementation();
 for(const name of Object.keys(impl))storeFile('frozen/'+name,readFileSync(join(root,name)));
 storeFile('protocol-amendment.md',readFileSync(join(root,'scripts/full/LLM-JUDGING.md')));
 const manifest={phase:'full-first-pass-llm-judging-v1',prepared_at:new Date().toISOString(),source_run:run,source_fingerprint:snapshot.fingerprint,settings,
   judge_type:'llm',human_validated:false,files,implementation:impl,dependencies:treeDigest(join(root,'scripts/pilot/node_modules')),node:process.version,
   agreement_policy:'Two same-model fresh-context passes; adjudicate any criterion score/support, version classification/compliance or extra-claim classification difference; also any major/critical flag, drift/dispute or reference concern. Rationale-only differences do not trigger adjudication.',
   citation_policy:'No independently fetched citation verification. Report support precision and verified coverage as unavailable, never zero/perfect.',
   original_protocol_preserved:true};
 save(join(work,'manifest.json'),manifest);
 writeFileSync(join(work,'freeze.sha256'),sha(join(work,'manifest.json'))+'\n',{flag:'wx',mode:0o600});
 return manifest;
}
function verify(work,{source=true,dependencies=true}={}) {
 privatePath(work);privatePath(dirname(work));
 const m=read(join(work,'manifest.json'));
 need(sha(join(work,'manifest.json'))===readFileSync(join(work,'freeze.sha256'),'utf8').trim(),'Judge manifest changed');
 need(m.phase==='full-first-pass-llm-judging-v1'&&JSON.stringify(m.settings)===JSON.stringify(settings)&&m.node===process.version,'Unapproved judging settings/runtime');
 for(const [p,h] of Object.entries(m.files))need(sha(join(work,p))===h,'Frozen judging file changed: '+p);
 need(JSON.stringify(implementation())===JSON.stringify(m.implementation),'Judge implementation changed');
 if(dependencies)need(JSON.stringify(treeDigest(join(root,'scripts/pilot/node_modules')))===JSON.stringify(m.dependencies),'Pinned dependencies changed');
 if(source)need(sourceSnapshot(m.source_run).fingerprint===m.source_fingerprint,'Source artifacts changed');
 return m;
}
function packets(work,judge) {return read(join(work,`${judge}-packets.json`));}
function prior(work,judge,p) {return read(join(work,'calls',`${judge}-${p.anonymous_id}`,'judgment.json'));}
function adjudicationItems(work) {
 return packets(work,'judge-1').filter(p=>needsAdjudication(prior(work,'judge-1',p),prior(work,'judge-2',p)));
}
function request(work,judge,p) {
 if(judge!=='adjudicator')return {system:prompt,user:JSON.stringify({packet:p})};
 const assessments=[prior(work,'judge-1',p),prior(work,'judge-2',p)];
 if(parseInt(hash(p.anonymous_id).slice(0,8),16)%2)assessments.reverse();
 return {system:adjudicationPrompt,user:JSON.stringify({packet:p,prior_assessments:assessments})};
}
function authorize(work,m,approval) {
 need(m.phase==='full-first-pass-llm-judging-v1','Unexpected judging phase');
 validateApproval(approval,sha(join(work,'manifest.json')));
}
export async function run(work,approvalPath) {
 const m=verify(work),approval=read(approvalPath);
 authorize(work,m,approval);
 const globalClaim=join(dirname(work),'docs-check-llm-judging-consumed.json');
 need(!existsSync(globalClaim)&&!existsSync(join(work,'launch.json'))&&!existsSync(join(work,'calls')),'Judging claim consumed; never replay calls');
 // Exclusive global and local claims before credential resolution or any inference call.
 save(globalClaim,{work,manifest_sha256:sha(join(work,'manifest.json')),claimed_at:new Date().toISOString()});
 save(join(work,'launch.json'),{approval,manifest_sha256:sha(join(work,'manifest.json')),started_at:new Date().toISOString()});
 const model=read(join(work,'model.json')),encoding=getEncoding('o200k_base');
 let stopped=false,signalSeen=false,total=0;
 const stop=()=>{stopped=true;signalSeen=true;};
 process.on('SIGTERM',stop);process.on('SIGINT',stop);
 const auth=()=>{
   const proc=spawnSync('pi',['auth','check','--provider',settings.provider,'--json','--credentials'],{cwd:'/tmp',encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
   if(proc.status!==0)throw new Error('Judge OAuth unavailable; no fallback or retry');
   const value=JSON.parse(proc.stdout);
   need(value.status==='ready'&&typeof value.credentials==='string','Judge credential unavailable');
   return value.credentials;
 };
 let failure;
 try {
  for(const judge of ['judge-1','judge-2','adjudicator']) {
   if(stopped)throw new Error('Stop requested; active calls drained');
   const items=judge==='adjudicator'?adjudicationItems(work):packets(work,judge);
   need(items.length<=(judge==='adjudicator'?96:96),'Judge call limit exceeded');
   if(judge==='adjudicator')save(join(work,'adjudication-plan.json'),{anonymous_ids:items.map(p=>p.anonymous_id),policy:m.agreement_policy});
   await pool(items,settings.concurrency,async p=>{
    if(stopped)throw new Error('Stop requested; no new calls');
    need(++total<=288,'Global judge call limit exceeded');
    const dir=join(work,'calls',`${judge}-${p.anonymous_id}`);
    mkdirSync(dir,{recursive:true,mode:0o700});
    const req=request(work,judge,p);save(join(dir,'request.json'),req);
    const started=performance.now(),startedAt=new Date().toISOString();let token='',fetches=0,result;
    const scrub=value=>{const str=json(value);return token?str.split(token).join('[REDACTED]'):str;};
    const record=(name,value)=>writeFileSync(join(dir,name),scrub(value),{flag:'wx',mode:0o600});
    try {
     token=auth();
     const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),settings.deadline_ms);
     try {
      const s=stream(model,normalizeContext({systemPrompt:req.system,messages:[{role:'user',content:req.user,timestamp:Date.now()}],tools:[]}),{
       apiKey:token,reasoningEffort:'medium',transport:'sse',cacheRetention:'none',toolChoice:'none',maxRetries:0,signal:controller.signal,
       onPayload:payload=>{auditPayload(payload,model,req.system,req.user);record('outbound.json',payload);},
       fetch:async(url,options)=>{need(++fetches===1,'Judge retry forbidden');const u=new URL(url);need(u.origin==='https://chatgpt.com'&&u.pathname==='/backend-api/codex/responses'&&options.method==='POST','Unapproved judge request');return fetch(url,options);},
       onResponse:response=>record('http-status.json',{status:response.status}),
      });
      const consume=(async()=>{let output='';for await(const event of s)if(event.type==='text_delta'){output+=event.delta;if(encoding.encode(output).length>settings.output_proxy_tokens)controller.abort();}})();
      [result]=await Promise.all([s.result(),consume]);
     } finally {clearTimeout(timer);}
     record('raw-result.json',result);
     need(result.stopReason==='stop'&&!result.content.some(b=>b.type==='toolCall'),'Judge failed: '+(result.errorMessage??result.stopReason));
     const answer=result.content.filter(b=>b.type==='text').map(b=>b.text).join('\n');
     need(encoding.encode(answer).length<=settings.output_proxy_tokens,'Judge output cap exceeded');
     const judgment=validateJudgment(JSON.parse(answer),p);
     record('judgment.json',judgment);
     record('outcome.json',{status:'completed',judge_id:judge,judge_type:'llm',model:model.id,provider:model.provider,reasoning:'medium',anonymous_id:p.anonymous_id,started_at:startedAt,ended_at:new Date().toISOString(),elapsed_ms:performance.now()-started,fetches,usage:result.usage,actual_charge:null,accounting_status:'unavailable; catalog estimates are not bills'});
     console.log('JUDGE_FINISH',judge,p.anonymous_id);
    } catch(error) {
     stopped=true;
     record('outcome.json',{status:'failed',judge_id:judge,judge_type:'llm',anonymous_id:p.anonymous_id,started_at:startedAt,ended_at:new Date().toISOString(),fetches,elapsed_ms:performance.now()-started,usage:result?.usage??null,actual_charge:null,error:String(error)});
     console.log('JUDGE_FAILED',judge,p.anonymous_id,'paused; see private outcome');
     throw error;
    }
   });
  }
 } catch(error) {failure=error;}
 finally {
  process.off('SIGTERM',stop);process.off('SIGINT',stop);
  save(join(work,'terminal.json'),{status:failure||signalSeen?'paused':'completed',ended_at:new Date().toISOString(),calls_started:total,error:failure?'Judging paused; inspect preserved call outcomes':null,no_retries:true,no_benchmark_calls:true});
 }
 if(failure)throw new Error('Judging paused; no automatic retry/resume. Inspect preserved artifacts.');
 console.log('LLM_JUDGING_COMPLETE',work,total);
}
export function audit(work) {
 const m=verify(work),launch=read(join(work,'launch.json'));
 authorize(work,m,launch.approval);
 need(launch.manifest_sha256===sha(join(work,'manifest.json')),'Launch manifest changed');
 const terminal=read(join(work,'terminal.json'));
 need(terminal.status==='completed'&&terminal.no_retries===true&&terminal.no_benchmark_calls===true,'Judging incomplete; no quality report');
 const chosen={},initial={},outcomes=[],expected=[];
 const ps=packets(work,'judge-1');
 const plan=adjudicationItems(work);
 need(JSON.stringify(read(join(work,'adjudication-plan.json')).anonymous_ids)===JSON.stringify(plan.map(p=>p.anonymous_id)),'Adjudication plan changed');
 const adjSet=new Set(plan.map(p=>p.anonymous_id));
 for(const p of ps) {
  const js=[];
  for(const judge of ['judge-1','judge-2',...(adjSet.has(p.anonymous_id)?['adjudicator']:[])]) {
   const id=`${judge}-${p.anonymous_id}`,dir=join(work,'calls',id);expected.push(id);
   const req=request(work,judge,p),raw=read(join(dir,'raw-result.json')),j=read(join(dir,'judgment.json')),outcome=read(join(dir,'outcome.json'));
   need(JSON.stringify(read(join(dir,'request.json')))===JSON.stringify(req),'Judge request changed');
   auditPayload(read(join(dir,'outbound.json')),read(join(work,'model.json')),req.system,req.user);
   need(read(join(dir,'http-status.json')).status===200&&raw.stopReason==='stop'&&raw.model===settings.model&&raw.provider===settings.provider,'Judge raw response mismatch');
   need(JSON.stringify(JSON.parse(raw.content.filter(b=>b.type==='text').map(b=>b.text).join('\n')))===JSON.stringify(j),'Judgment differs from raw result');
   validateJudgment(j,p);
   need(outcome.status==='completed'&&outcome.fetches===1&&outcome.judge_type==='llm'&&outcome.model===settings.model&&outcome.reasoning==='medium'&&outcome.judge_id===judge&&outcome.anonymous_id===p.anonymous_id,'Judge outcome mismatch');
   need(JSON.stringify(outcome.usage)===JSON.stringify(raw.usage),'Judge usage changed');
   js.push(j);outcomes.push(outcome);
  }
  initial[p.anonymous_id]=js.slice(0,2);chosen[p.anonymous_id]=adjSet.has(p.anonymous_id)?js.at(-1):js[0];
 }
 need(JSON.stringify(readdirSync(join(work,'calls')).sort())===JSON.stringify(expected.sort()),'Extra/missing judging calls');
 need(expected.length===terminal.calls_started&&expected.length===192+plan.length&&plan.length<=96,'Judging count mismatch');
 const usage=outcomes.reduce((a,o)=>{for(const k of ['input','output','cacheRead','cacheWrite','totalTokens']){if(typeof o.usage?.[k]==='number')a[k]=(a[k]??0)+o.usage[k];}a.catalog_estimate_usd+=(o.usage?.cost?.total??0);return a;},{catalog_estimate_usd:0});
 return {chosen,initial,adjudicated_ids:plan.map(p=>p.anonymous_id),metadata:{model:settings.model,provider:settings.provider,reasoning:'medium',judge_type:'llm',human_validated:false,calls:outcomes.length,initial_calls:192,adjudication_calls:plan.length,retries:0,usage,actual_charges:null,accounting_status:'unavailable; catalog estimate excludes subscription accounting and is not actual spend',manifest_sha256:sha(join(work,'manifest.json')),started_at:launch.started_at,ended_at:terminal.ended_at}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const [command,arg,...rest]=process.argv.slice(2);
 try {
  need(arg,'Usage: --prepare SOURCE --out NEW | --run WORK --approval FILE | --verify WORK | --audit WORK');
  if(command==='--prepare'){need(rest[0]==='--out'&&rest[1]&&rest.length===2,'New --out required');prepare(arg,rest[1]);console.log('LLM_JUDGING_PREPARED',resolve(rest[1]));}
  else if(command==='--verify'){verify(resolve(arg));console.log('LLM_JUDGING_VERIFIED');}
  else if(command==='--run'){need(rest[0]==='--approval'&&rest[1]&&rest.length===2,'Explicit --approval required');await run(resolve(arg),resolve(rest[1]));}
  else if(command==='--audit')console.log(JSON.stringify(audit(resolve(arg))));
  else throw new Error('Unknown command');
 } catch(error) {console.error(String(error));process.exitCode=1;}
}
