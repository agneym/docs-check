import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync,existsSync,symlinkSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {zstdCompressSync} from 'node:zlib';
import {validateConfig,makeSchedule,authorize,createAudit,sha,saveNew,externalRoot,freezeInputs,verifyFreeze,inputPaths,treeDigest,assertPrivate} from './control.mjs';
const root=new URL('../..',import.meta.url).pathname;
const cfg=JSON.parse(readFileSync(new URL('../../evaluation/full-config.json',import.meta.url)));
const spec=JSON.parse(readFileSync(new URL('../../evaluation/parallel-task-spec.json',import.meta.url)));
const questions=readFileSync(new URL('../../evaluation/questions.jsonl',import.meta.url),'utf8').trim().split('\n').map(JSON.parse);
const copy=x=>structuredClone(x);
const canary='HOST_ONLY_SECRET_CANARY';
const req=(url,data,compressed=false)=>new Request(url,{method:'POST',headers:compressed?{'content-encoding':'zstd'}:{},body:compressed?zstdCompressSync(Buffer.from(JSON.stringify(data))):JSON.stringify(data)});
const modelBody={model:'gpt-6.1-terra',reasoning:{effort:'medium'},store:false,input:[{role:'user',content:'public'}],tools:[]};
const modelUrl='https://chatgpt.com/backend-api/codex/responses';
test('96 unique executions paired with exactly 24 first slots each and deterministic shuffle',()=>{
 const s=makeSchedule(questions,cfg);assert.equal(s.length,96);assert.equal(new Set(s.map(x=>x.execution_id)).size,96);assert.deepEqual(s,makeSchedule(questions.toReversed(),cfg));
 const first={parallel:0,context7:0};
 for(let i=0;i<96;i+=2){assert.equal(s[i].question_id,s[i+1].question_id);assert.notEqual(s[i].workflow,s[i+1].workflow);first[s[i].workflow]++;assert.equal(s[i].repeat,1);}
 assert.deepEqual(first,{parallel:24,context7:24});assert.throws(()=>makeSchedule(questions.slice(1),cfg));assert.throws(()=>makeSchedule([...questions.slice(1),questions[1]],cfg));
});
test('freeze invariant refuses wrong model, processor, retries, attempts, or API substitution',()=>{
 for(const change of [c=>c.repeats=2,c=>c.parallel.processor='core',c=>c.parallel.transport='research-cli',c=>c.answering_model.id='other',c=>c.settings.concurrency=2,c=>c.settings.safe_operation_retries=2,c=>c.spending.automatic_topups=true]){const c=copy(cfg);change(c);assert.throws(()=>validateConfig(c));}
});
test('no pilot approval, capped approval, wrong freeze, or extra attempt can authorize full pass',()=>{
 const a={phase:'full-first-pass',manifest_sha256:'digest',executions:96,attempts:1,extra_executions_approved:false,automatic_topups:false,approved:true,approved_by:'user',user_authorization:'I approve this single full pass uncapped',spending:{policy:'uncapped-explicitly-approved',cap:null}};
 assert.equal(authorize(a,'digest',cfg),true);assert.throws(()=>authorize({pilot_approved:true},'digest',cfg));assert.throws(()=>authorize(a,'other',cfg));
 for(const change of [x=>x.spending={policy:'capped',cap:10},x=>x.attempts=2,x=>x.executions=100,x=>x.extra_executions_approved=true,x=>x.user_authorization='']){const x=copy(a);change(x);assert.throws(()=>authorize(x,'digest',cfg));}
});
test('host audit validates zstd and rejects model/session/tool/canary leakage',async()=>{
 let audit=createAudit({workflow:'parallel',cfg,spec,canary});assert.equal((await audit(req(modelUrl,modelBody,true))).body.model,'gpt-6.1-terra');
 for(const extra of [{tools:[{type:'web_search'}]},{previous_response_id:'prior'},{input:[{role:'user',content:canary}]},{model:'different'},{reasoning:{effort:'high'}},{input:[{role:'user'},{role:'assistant'}]}]){
  audit=createAudit({workflow:'parallel',cfg,spec,canary});await assert.rejects(audit(req(modelUrl,{...modelBody,...extra})));
 }
 await assert.rejects(audit(req('https://example.com/',modelBody)));
});
test('host enforces model retry/call budgets',async()=>{
 const audit=createAudit({workflow:'parallel',cfg,spec,canary});await audit(req(modelUrl,modelBody));await audit(req(modelUrl,modelBody));await assert.rejects(audit(req(modelUrl,modelBody)),/budget/);
 const c=createAudit({workflow:'context7',cfg,spec,canary});for(let i=0;i<3;i++)await c(req(modelUrl,{...modelBody,input:[{role:'user',content:String(i)}]}));await assert.rejects(c(req(modelUrl,{...modelBody,input:[{role:'user',content:'4'}]})),/budget/);
});
test('host enforces exact structured Task spec, single creation, owned task status',async()=>{
 const data={input:'public request',processor:'core-fast',task_spec:spec,memory_scope_key:`docscheck_${'a'.repeat(48)}`};
 const audit=createAudit({workflow:'parallel',cfg,spec,canary});await audit(req('https://api.parallel.ai/v1/tasks/runs',data));await assert.rejects(audit(req('https://api.parallel.ai/v1/tasks/runs',data)),/Duplicate|duplicate/);
 await assert.rejects(audit(new Request('https://api.parallel.ai/v1/tasks/runs/unknown')),/unowned/);audit.registerTask('trun_owned');await audit(new Request('https://api.parallel.ai/v1/tasks/runs/trun_owned/result'));assert.throws(()=>audit.registerTask('another'));
 for(const extra of [{task_spec:{output_schema:{type:'auto'}}},{processor:'core'},{previous_interaction_id:'prior'},{memory_scope_key:''}]){const a=createAudit({workflow:'parallel',cfg,spec,canary});await assert.rejects(a(req('https://api.parallel.ai/v1/tasks/runs',{...data,...extra})));}
});
test('Context7 application request budgets include only one safe retry',async()=>{
 const a=createAudit({workflow:'context7',cfg,spec,canary});for(let i=0;i<4;i++)await a(new Request('https://context7.com/api/v2/libs/search?libraryName=x&query=y'));await assert.rejects(a(new Request('https://context7.com/api/v2/libs/search?libraryName=x&query=y')),/budget/);
});
test('storage refuses overwrite and repository/home mounts as roots',()=>{
 const tmp=mkdtempSync(join(tmpdir(),'docs-check-control-'));try{saveNew(join(tmp,'record.json'),{x:1});assert.throws(()=>saveNew(join(tmp,'record.json'),{}));assert.throws(()=>externalRoot(root,root,tmp));assert.throws(()=>externalRoot(tmp,root,tmp));}finally{rmSync(tmp,{recursive:true,force:true});}
});
test('runtime tree records dangling documentation symlinks and detects file/link/permission drift',()=>{
 const tmp=mkdtempSync(join(tmpdir(),'docs-check-tree-'));try{
  writeFileSync(join(tmp,'library'),'original');symlinkSync('missing-documentation',join(tmp,'doc-link'));symlinkSync('library',join(tmp,'lib-link'));
  const before=treeDigest(tmp);assert.equal(before.files,3);assert.deepEqual(before,treeDigest(tmp));writeFileSync(join(tmp,'library'),'changed');assert.notEqual(treeDigest(tmp).sha256,before.sha256);
  assertPrivate(tmp);chmodSync(tmp,0o755);assert.throws(()=>assertPrivate(tmp));
 }finally{rmSync(tmp,{recursive:true,force:true});}
});
test('freeze preserves original bytes and refuses changed code/input/schedule',()=>{
 const tmp=mkdtempSync(join(tmpdir(),'docs-check-freeze-')),repo=join(tmp,'repo'),run=join(tmp,'run');
 try{
  mkdirSync(join(repo,'scripts/full'),{recursive:true});mkdirSync(join(repo,'evaluation/drafts'),{recursive:true});mkdirSync(run);
  writeFileSync(join(repo,'scripts/full/code.mjs'),'// frozen code\n');
  for(const p of inputPaths(repo)){mkdirSync(dirname(join(repo,p)),{recursive:true});if(!existsSync(join(repo,p)))writeFileSync(join(repo,p),'{}');}
  writeFileSync(join(repo,'evaluation/full-config.json'),JSON.stringify(cfg));writeFileSync(join(repo,'evaluation/questions.jsonl'),questions.map(q=>JSON.stringify(q)).join('\n'));
  freezeInputs(repo,run,cfg,makeSchedule(questions,cfg));assert.equal(verifyFreeze(repo,run).phase,'full-first-pass');
  const p=join(repo,'scripts/full/code.mjs');writeFileSync(p,'// changed\n');assert.throws(()=>verifyFreeze(repo,run),/changed/);writeFileSync(p,'// frozen code\n');
  writeFileSync(join(run,'schedule.jsonl'),'changed');assert.throws(()=>verifyFreeze(repo,run),/Schedule changed/);
 }finally{rmSync(tmp,{recursive:true,force:true});}
});
