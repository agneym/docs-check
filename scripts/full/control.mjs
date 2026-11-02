// Host-only scheduling, freeze verification, authorization, and request audit.
import {readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, realpathSync, openSync, readSync, closeSync, statSync, readlinkSync} from 'node:fs';
import {resolve, relative, dirname, join, isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {publicRow, decodeRequestBody, apiPathAllowed} from '../pilot/core.mjs';

export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const json = p => JSON.parse(readFileSync(p, 'utf8'));
export function fileSha(path) {
  const h=createHash('sha256'),fd=openSync(path,'r'),buffer=Buffer.alloc(1024*1024);
  try{for(;;){const n=readSync(fd,buffer,0,buffer.length,null);if(!n)break;h.update(buffer.subarray(0,n));}return h.digest('hex');}finally{closeSync(fd);}
}
export function treeDigest(root) {
  const entries={};
  function walk(dir){for(const f of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){const p=join(dir,f.name),key=relative(root,p);if(f.isDirectory())walk(p);else if(f.isSymbolicLink()){let target;try{target=statSync(p);}catch(error){if(error.code!=='ENOENT')throw error;}entries[key]={link:readlinkSync(p),target_type:target?(target.isFile()?'file':'directory'):'dangling',sha256:target?.isFile()?fileSha(p):null};}else if(f.isFile())entries[key]={sha256:fileSha(p)};}}
  walk(root);return {sha256:sha(JSON.stringify(entries)),files:Object.keys(entries).length};
}
export function assertPrivate(path) {if(statSync(path).mode&0o077)throw new Error('Campaign and parent must have private permissions (chmod 700)');}
export function saveNew(path, value) {
  mkdirSync(dirname(path), {recursive:true,mode:0o700});
  writeFileSync(path, (typeof value==='string'?value:JSON.stringify(value,null,2))+'\n', {flag:'wx',mode:0o600});
}
export function validateConfig(c) {
  if(c.phase!=='full-first-pass'||c.question_count!==48||c.repeats!==1||c.planned_workflow_executions!==96 ||
     JSON.stringify(c.workflows)!=='["parallel","context7"]'||c.answering_model?.provider!=='openai-codex'||c.answering_model.id!=='gpt-6.1-terra'||c.answering_model.reasoning_effort!=='medium'||
     c.parallel?.processor!=='core-fast'||c.parallel.transport!=='direct-task-api'||c.parallel.task_spec_path!=='evaluation/parallel-task-spec.json'||c.authorization?.extra_executions_approved!==false||c.spending?.automatic_topups!==false) throw new Error('Full-pass invariant mismatch');
  const expected={retrieval_ms:300000,answer_ms:60000,total_ms:360000,evidence_proxy_tokens:12000,output_proxy_tokens:4096,safe_operation_retries:1,poll_ms:5000,concurrency:1,context7_max_resolutions:2,context7_max_queries:4,client_cache:false};
  for(const [k,v] of Object.entries(expected)) if(c.settings?.[k]!==v)throw new Error(`Unfrozen setting: ${k}`);
  if(!Number.isSafeInteger(c.schedule?.seed)||c.schedule.algorithm!=='sha256-counter-fisher-yates-v1'||c.schedule.first_slots_each!==24||c.schedule.paired!==true)throw new Error('Invalid schedule policy');
  if(c.judging?.type!=='two-independent-human-reviewers'||c.judging.bootstrap_samples!==10000||!Number.isSafeInteger(c.judging.seed)||!Number.isSafeInteger(c.judging.bootstrap_seed))throw new Error('Invalid judge policy');
  return c;
}
export function rng(seed) {
  let counter=0;
  return n => {
    // Rejection sampling avoids modulo bias. SHA input and byte order are frozen.
    const bound=Math.floor(0x100000000/n)*n;
    for(;;) {const x=createHash('sha256').update(`${seed}:${counter++}`).digest().readUInt32BE();if(x<bound)return x%n;}
  };
}
function shuffle(a,next) {a=[...a];for(let i=a.length-1;i>0;i--){const j=next(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function makeSchedule(questions,cfg) {
  validateConfig(cfg);
  if(questions.length!==48||new Set(questions.map(q=>q.id)).size!==48||questions.some(q=>typeof q.id!=='string'||! /^[a-z]+-\d\d$/.test(q.id)))throw new Error('Expected 48 unique public question IDs');
  questions.forEach(publicRow);
  const next=rng(cfg.schedule.seed), ids=shuffle(questions.map(q=>q.id).sort(),next);
  const first=shuffle([...Array(24).fill('parallel'),...Array(24).fill('context7')],next);
  return ids.flatMap((id,i)=>[first[i],first[i]==='parallel'?'context7':'parallel'].map(workflow=>({execution_id:`${id}-${workflow}-1`,question_id:id,workflow,repeat:1,order:i*2+(workflow===first[i]?0:1)})));
}
export function inputPaths(root) {
  const out=['README.md','scripts/compile_dataset.py','scripts/test_compile_dataset.py','scripts/pilot/core.test.mjs','evaluation/full-config.json','evaluation/full-preparation.md','evaluation/parallel-task-spec.json','evaluation/questions.jsonl','evaluation/answer-key.json','evaluation/validation-report.json','sources/manifest.json','evaluation/PROTOCOL.md','scripts/pilot/core.mjs','scripts/pilot/package.json','scripts/pilot/package-lock.json','scripts/pilot/qemu-x86_64.sh'];
  for(const f of readdirSync(join(root,'scripts/full')).sort())if(/\.(mjs|py|md)$/.test(f))out.push(`scripts/full/${f}`);
  for(const f of readdirSync(join(root,'evaluation/drafts')).sort())if(f.endsWith('.json'))out.push(`evaluation/drafts/${f}`);
  return out;
}
export function externalRoot(path,root,home) {
  const p=resolve(path);
  mkdirSync(p,{recursive:true,mode:0o700});
  const real=realpathSync(p),repo=realpathSync(root);
  const rel=relative(repo,real);
  if(real===repo||(rel!=='..'&&!rel.startsWith('../'))||real===resolve(home))throw new Error('Run root must be private and outside the repository, not the home root');
  return real;
}
export function freezeInputs(root,run,cfg,schedule,extra={}) {
  const hashes={};
  for(const path of inputPaths(root)) {
    const bytes=readFileSync(join(root,path));hashes[path]=sha(bytes);
    const target=join(run,'frozen',path);mkdirSync(dirname(target),{recursive:true,mode:0o700});writeFileSync(target,bytes,{flag:'wx',mode:0o400});
  }
  saveNew(join(run,'schedule.jsonl'),schedule.map(x=>JSON.stringify(x)).join('\n'));
  hashes['schedule.jsonl']=sha(readFileSync(join(run,'schedule.jsonl')));
  const git=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
  const manifest={schema_version:1,phase:'full-first-pass',created_at:new Date().toISOString(),git_commit:git.stdout.trim(),config:cfg,config_hash:sha(JSON.stringify(cfg)),hashes,...extra};
  saveNew(join(run,'manifest.json'),manifest);
  saveNew(join(run,'freeze.sha256'),sha(readFileSync(join(run,'manifest.json'))));
  return manifest;
}
export function verifyFreeze(root,run) {
  const bytes=readFileSync(join(run,'manifest.json')),m=JSON.parse(bytes);
  if(sha(bytes)!==readFileSync(join(run,'freeze.sha256'),'utf8').trim())throw new Error('Manifest hash changed');
  validateConfig(m.config);
  if(m.config_hash!==sha(JSON.stringify(m.config)))throw new Error('Config hash mismatch');
  if(JSON.stringify(json(join(root,'evaluation/full-config.json')))!==JSON.stringify(m.config))throw new Error('Current config differs from freeze');
  const paths=inputPaths(root);
  for(const path of paths)if(!m.hashes[path])throw new Error(`Unfrozen code/input: ${path}`);
  for(const [path,digest] of Object.entries(m.hashes)) {
    if(path==='schedule.jsonl') {if(sha(readFileSync(join(run,path)))!==digest)throw new Error('Schedule changed');continue;}
    if(isAbsolute(path)||path.split('/').includes('..'))throw new Error('Invalid frozen path');
    if(sha(readFileSync(join(root,path)))!==digest||sha(readFileSync(join(run,'frozen',path)))!==digest)throw new Error(`Frozen input changed: ${path}`);
  }
  const q=readFileSync(join(root,'evaluation/questions.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  const schedule=readFileSync(join(run,'schedule.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  if(JSON.stringify(makeSchedule(q,m.config))!==JSON.stringify(schedule))throw new Error('Schedule does not match frozen policy');
  return m;
}
export function authorize(approval,manifestDigest,cfg) {
  if(approval?.phase!=='full-first-pass'||approval.manifest_sha256!==manifestDigest||approval.executions!==96||approval.attempts!==1||approval.extra_executions_approved!==false||approval.automatic_topups!==false||approval.approved!==true||typeof approval.approved_by!=='string'||!approval.approved_by.trim()||typeof approval.user_authorization!=='string'||!approval.user_authorization.trim())throw new Error('Missing explicit full-pass spending authorization tied to this freeze');
  if(approval.spending?.policy!=='uncapped-explicitly-approved'||approval.spending.cap!==null)throw new Error('Capped launch blocked: live charge accounting and bounded outstanding exposure are not yet available');
  if(cfg.spending.policy!=='pending-full-run-authorization')throw new Error('Unexpected configuration spending state');
  return true;
}
export function createAudit({workflow,cfg,spec,canary}) {
  let creates=0,resolutions=0,queries=0;const bodies=new Map(),runIds=new Set();
  const audit = async req => {
    if(!apiPathAllowed(req,workflow))throw new Error('AUDIT: destination blocked');
    const bytes=req.method==='POST'?Buffer.from(await req.clone().arrayBuffer()):Buffer.alloc(0);
    const body=decodeRequestBody(bytes,req.headers.get('content-encoding'));
    if(body?.includes(canary)||req.url.includes(canary))throw new Error('AUDIT: private canary leakage');
    const data=body?JSON.parse(body):null,u=new URL(req.url);
    if(u.hostname==='chatgpt.com') {
      const digest=sha(body),n=(bodies.get(digest)??0)+1;bodies.set(digest,n);
      if(n>2||bodies.size>(workflow==='context7'?3:1))throw new Error('AUDIT: model budget exceeded');
      if(data.model!==cfg.answering_model.id||data.reasoning?.effort!=='medium'||data.store!==false||data.tools?.length||data.previous_response_id||data.input?.length!==1||data.input[0].role!=='user')throw new Error('AUDIT: model/context/tools mismatch');
    } else if(u.hostname==='api.parallel.ai') {
      if(req.method==='POST') {
        if(++creates>1)throw new Error('AUDIT: duplicate Task creation');
        if(data.processor!=='core-fast'||typeof data.memory_scope_key!=='string'||!/^docscheck_[a-f0-9]{48}$/.test(data.memory_scope_key)||data.previous_interaction_id||JSON.stringify(data.task_spec)!==JSON.stringify(spec)||Object.keys(data).sort().join(',')!=='input,memory_scope_key,processor,task_spec')throw new Error('AUDIT: Task settings mismatch');
      } else if(!runIds.has(u.pathname.split('/')[4])) throw new Error('AUDIT: unowned task');
    } else {
      if(u.pathname.endsWith('/search')&&++resolutions>4)throw new Error('AUDIT: resolution retry budget');
      if(u.pathname.endsWith('/context')&&++queries>8)throw new Error('AUDIT: docs retry budget');
    }
    return {utc:new Date().toISOString(),method:req.method,url:req.url,body:data,wire_body_bytes:bytes.length,content_encoding:req.headers.get('content-encoding')};
  };
  audit.registerTask = id => {if(typeof id!=='string'||! /^[A-Za-z0-9_-]+$/.test(id)||runIds.size)throw new Error('AUDIT: invalid/duplicate task id');runIds.add(id);};
  return audit;
}
