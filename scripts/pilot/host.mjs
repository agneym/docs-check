#!/usr/bin/env node
// Trusted controller. It exports allowlisted public data; never mounts the repo.
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,chmodSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {VM,createHttpHooks} from '@earendil-works/gondolin';
import {publicRow,apiPathAllowed,decodeRequestBody,PLAN_LIBRARIES,PLAN_QUERIES,RETRIEVAL,ANSWERING} from './core.mjs';

const HERE=dirname(fileURLToPath(import.meta.url)), ROOT=resolve(HERE,'../..');
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const cfg=json(join(ROOT,'evaluation/pilot-config.json'));
if(process.argv.includes('--run') && cfg.authorization.pilot_completed)throw new Error('The approved four-execution pilot is already completed; obtain fresh authorization before another campaign.');
const spec=json(join(ROOT,cfg.parallel.task_spec_path));
const qemuRoot=process.env.DOCS_CHECK_QEMU_ROOT??join(homedir(),'.cache/docs-check-runtime/qemu');
process.env.PATH=`${qemuRoot}/usr/bin:${process.env.PATH}`;
process.env.LD_LIBRARY_PATH=`${qemuRoot}/usr/lib/x86_64-linux-gnu${process.env.LD_LIBRARY_PATH?':'+process.env.LD_LIBRARY_PATH:''}`;
const campaign=process.env.DOCS_CHECK_CAMPAIGN??`${new Date().toISOString().replace(/[:.]/g,'-')}-${randomBytes(3).toString('hex')}`;
const RUN=resolve(process.env.DOCS_CHECK_RUN_ROOT??join(homedir(),'random/docs-check-runs'),campaign);
if(existsSync(RUN)) throw new Error('Refusing to overwrite an existing campaign');
mkdirSync(RUN,{recursive:true,mode:0o700});chmodSync(RUN,0o700);
const canary=randomBytes(32).toString('hex'),canaryPath=join(RUN,'private-canary.txt');
writeFileSync(canaryPath,canary,{mode:0o600,flag:'wx'});
const secretsToRedact=[];
function scrub(value) {
  let s=typeof value==='string'?value:JSON.stringify(value,null,2);
  for(const secret of secretsToRedact) if(secret) s=s.split(secret).join('[REDACTED]');
  return s;
}
function save(path,value){const p=join(RUN,path);mkdirSync(dirname(p),{recursive:true,mode:0o700});writeFileSync(p,scrub(value)+'\n',{mode:0o600,flag:'wx'});}
const print=(...x)=>console.log(...x);

await build({entryPoints:[join(HERE,'worker.mjs')],bundle:true,platform:'node',format:'esm',target:'node24',outfile:join(HERE,'worker.bundle.mjs'),banner:{js:'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'},logLevel:'warning'});
const bundle=readFileSync(join(HERE,'worker.bundle.mjs'));
const assetDir=join(homedir(),'.cache/gondolin/images/objects/f59d9a69-1f62-57e0-a392-6800d3dd021d');
const sandbox={qemuPath:join(HERE,'qemu-x86_64.sh'),accel:'tcg',memory:'1536M',cpus:2,...(existsSync(assetDir)?{imagePath:assetDir}:{})};
const manifest={campaign,created_at:new Date().toISOString(),mode:process.argv.includes('--run')?'pilot':'preflight',config:cfg,sandbox:{...sandbox,vmm:'qemu',host_mounts:[],dns:'synthetic',websockets:false},hashes:{},prompts:{retrieval:RETRIEVAL,answering:ANSWERING,plan_libraries:PLAN_LIBRARIES,plan_queries:PLAN_QUERIES},deviations:[
 'o200k_base is a pinned proxy tokenizer; exact gpt-6.1-terra tokenizer is not published/verified. Evidence counts are labeled estimates.',
 'Codex subscription transport does not send max_output_tokens. 4096 proxy-token output limit is enforced locally; provider charging may continue after client abort.',
 'VM boot, preflight, and bundle transfer are measured separately from workflow time. Workflow clocks start inside the ready guest.',
 'Pilot scoring is one reviewer; no comparative significance tests.'
]};
for(const p of ['evaluation/pilot-config.json','evaluation/parallel-task-spec.json','evaluation/questions.jsonl','evaluation/answer-key.json','evaluation/validation-report.json','sources/manifest.json','evaluation/PROTOCOL.md','scripts/pilot/host.mjs','scripts/pilot/worker.mjs','scripts/pilot/core.mjs','scripts/pilot/package-lock.json','scripts/pilot/qemu-x86_64.sh'])manifest.hashes[p]=sha(readFileSync(join(ROOT,p)));
manifest.hashes.worker_bundle=sha(bundle);
manifest.git_commit=spawnSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).stdout.trim();
manifest.image_manifest=existsSync(join(assetDir,'manifest.json'))?json(join(assetDir,'manifest.json')):null;
manifest.qemu_binary_sha256=sha(readFileSync(join(qemuRoot,'usr/bin/qemu-system-x86_64')));
save('manifest.json',manifest);
print('ARTIFACT_ROOT',RUN);

async function newVm(workflow,secretDefs={},audit=[]) {
 const allowedHosts=['chatgpt.com',...(workflow==='parallel'?['api.parallel.ai']:workflow==='context7'?['context7.com']:[])];
 let creates=0;
 const modelBodies=new Map();
 const {httpHooks,env}=createHttpHooks({allowedHosts,blockInternalRanges:true,secrets:secretDefs,
  isRequestAllowed:req=>apiPathAllowed(req,workflow),
  onRequest:async req=>{
   const bytes=req.method==='POST'?Buffer.from(await req.clone().arrayBuffer()):Buffer.alloc(0);
   const body=decodeRequestBody(bytes,req.headers.get('content-encoding'));
   if(body?.includes(canary))throw new Error('PRIVATE CANARY IN OUTBOUND REQUEST');
   let data=null; if(body)data=JSON.parse(body);
   const url=new URL(req.url);
   if(url.hostname==='chatgpt.com') {
    const digest=sha(body),attempts=(modelBodies.get(digest)??0)+1;
    modelBodies.set(digest,attempts);
    if(attempts>2||modelBodies.size>(workflow==='context7'?3:1))throw new Error('Model call/retry budget exceeded');
    if(data.model!==cfg.answering_model.id||data.reasoning?.effort!=='medium'||data.store!==false||data.tools?.length||data.previous_response_id||data.input?.length!==1||data.input[0].role!=='user')throw new Error('Unexpected model request, tools, or conversation history');
   }
   if(req.method==='POST'&&url.hostname==='api.parallel.ai') {
    if(++creates>1)throw new Error('Duplicate task creation blocked');
    if(data.processor!=='core-fast'||!data.memory_scope_key||data.previous_interaction_id||data.task_spec?.output_schema?.type!=='json')throw new Error('Unexpected Task configuration');
   }
   audit.push({utc:new Date().toISOString(),method:req.method,url:req.url,body:data,wire_body_bytes:bytes.length,content_encoding:req.headers.get('content-encoding')});
  },
  onResponse:(res,req)=>{audit.push({utc:new Date().toISOString(),method:req.method,url:req.url,status:res.status});},
 });
 return VM.create({sandbox,httpHooks,env,dns:{mode:'synthetic'},allowWebSockets:false,sessionLabel:`docs-check-${workflow}-${campaign}`});
}
async function isolation(vm,label) {
 const paths=[join(ROOT,'evaluation/answer-key.json'),join(ROOT,'sources'),join(homedir(),'.pi/agent/sessions'),join(homedir(),'.config/parallel-web-tools/auth.json'),canaryPath,'/tmp/previous-execution-marker','/workspace/evaluation/answer-key.json','/data/workspace/evaluation/answer-key.json'];
 const script=`for p in ${paths.map(p=>"'"+p.replaceAll("'","'\\''")+"'").join(' ')}; do if test -e "$p"; then echo "UNEXPECTED_FILE:$p"; exit 41; fi; done; test -z "$PI_SESSION_FILE" || exit 42; code=$(curl --max-time 8 -s -o /tmp/blocked-body -w '%{http_code}' https://example.com/); test "$code" = 403 || exit 43; code=$(curl --max-time 8 -s -o /tmp/blocked-internal -w '%{http_code}' http://169.254.169.254/latest/meta-data/); test "$code" = 403 || exit 44; echo FILESYSTEM_AND_EGRESS_BLOCKED`;
 const r=await vm.exec(script);
 const check={label,exit_code:r.exitCode,stdout:r.stdout,stderr:r.stderr,checked_paths:paths};
 if(!r.ok||!r.stdout.includes('FILESYSTEM_AND_EGRESS_BLOCKED'))throw new Error(`Isolation check failed: ${JSON.stringify(check)}`);
 return check;
}
const preStart=performance.now();
let preVm;
try {
 preVm=await newVm('preflight');
 const result=await isolation(preVm,'preflight');
 await preVm.fs.writeFile('/tmp/previous-execution-marker','must not survive to another VM');
 const details=await preVm.exec('node --version; uname -a; mount; env | cut -d= -f1 | sort');
 save('isolation-preflight.json',{...result,guest:details.stdout,elapsed_ms:performance.now()-preStart});
 print('ISOLATION_PREFLIGHT_PASS',Math.round(performance.now()-preStart)+'ms');
} finally {await preVm?.close();}
if(!process.argv.includes('--run'))process.exit(0);
if(!cfg.authorization.pilot_approved||cfg.planned_workflow_executions!==4||cfg.parallel.processor!=='core-fast')throw new Error('Pilot approval mismatch');

// Resolve credentials on the trusted host. Never print them or mount their stores.
const authProcess=spawnSync('pi',['auth','check','--provider','openai-codex','--json','--credentials'],{cwd:'/tmp',encoding:'utf8',timeout:30000});
if(authProcess.status!==0)throw new Error('Model OAuth unavailable');
const auth=JSON.parse(authProcess.stdout),codexToken=auth.credentials;
if(typeof codexToken!=='string')throw new Error('Unexpected model credential response');
const accountId=JSON.parse(Buffer.from(codexToken.split('.')[1],'base64url').toString())['https://api.openai.com/auth'].chatgpt_account_id;
const python=process.env.PARALLEL_PYTHON??join(homedir(),'.local/share/mise/installs/pipx-parallel-web-tools/0.9.4/parallel-web-tools/bin/python');
const pk=spawnSync(python,['-c','import os; from parallel_web_tools.core.credentials import get_selected_api_key; k=os.environ.get("PARALLEL_API_KEY") or get_selected_api_key(); assert k, "No stored API key"; print(k)'],{encoding:'utf8',timeout:10000});
if(pk.status!==0)throw new Error('No stored Parallel data API key; refusing interactive login or provisioning');
const parallelKey=pk.stdout.trim();
const ctxPath=join(process.env.XDG_CONFIG_HOME??join(homedir(),'.config'),'context7/credentials.json');
const contextToken=process.env.CONTEXT7_API_KEY??(existsSync(ctxPath)?json(ctxPath).access_token:undefined);
secretsToRedact.push(codexToken,accountId,parallelKey,contextToken);
const store=json(join(homedir(),'.pi/agent/models-store.json'));
const model=store['openai-codex'].models.find(x=>x.id===cfg.answering_model.id);
if(!model||model.thinkingLevelMap?.medium!=='medium')throw new Error('Requested model/reasoning not available');
const safeModel=Object.fromEntries(['id','name','api','provider','baseUrl','reasoning','input','cost','contextWindow','maxTokens','thinkingLevelMap','compat'].map(k=>[k,model[k]]));
save('model.json',safeModel);
const questions=readFileSync(join(ROOT,'evaluation/questions.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
// Seeded coin flip for first pair, reversed for the second; exactly one first slot each.
const seed=randomBytes(4).readUInt32BE();
const first=seed%2?['parallel','context7']:['context7','parallel'];
const schedule=cfg.question_ids.flatMap((id,i)=>(i?first.toReversed():first).map(workflow=>({execution_id:`${id}-${workflow}-1`,question_id:id,workflow,repeat:1})));
save('schedule.jsonl',schedule.map(x=>JSON.stringify(x)).join('\n'));
save('schedule-seed.json',{seed,algorithm:'parity coin flip for first pair, reverse order for second'});
let stop=false;
for(const run of schedule) {
 if(stop){save(`executions/${run.execution_id}/outcome.json`,{...run,status:'not_run',reason:'Campaign paused after a failed path; no replacement execution'});continue;}
 const prefix=`executions/${run.execution_id}`,audit=[],events=[];
 const q=questions.find(x=>x.id===run.question_id),public_request=publicRow(q);
 const memory_scope_key=`docscheck_${randomBytes(24).toString('hex')}`;
 const input={public_request,workflow:run.workflow,model:safeModel,processor:cfg.parallel.processor,task_spec:spec,memory_scope_key};
 save(`${prefix}/public-request.json`,public_request);
 let vm,setupStart=performance.now(),wallStart,stdout='',stderr='';
 print('START',run.execution_id);
 try {
  const marker=randomBytes(24).toString('hex');
  const accountPlaceholder=`account_${marker}`;
  const fakeJwt=[Buffer.from('{"alg":"none"}').toString('base64url'),Buffer.from(JSON.stringify({'https://api.openai.com/auth':{chatgpt_account_id:accountPlaceholder}})).toString('base64url'),marker].join('.');
  const defs={CODEX_TOKEN:{hosts:['chatgpt.com'],value:codexToken,placeholder:fakeJwt},CODEX_ACCOUNT:{hosts:['chatgpt.com'],value:accountId,placeholder:accountPlaceholder},...(run.workflow==='parallel'?{PARALLEL_KEY:{hosts:['api.parallel.ai'],value:parallelKey}}:contextToken?{CONTEXT7_TOKEN:{hosts:['context7.com'],value:contextToken}}:{})};
  vm=await newVm(run.workflow,defs,audit);
  const iso=await isolation(vm,run.execution_id);
  await vm.fs.mkdir('/input',{recursive:true});
  await vm.fs.writeFile('/input/request.json',JSON.stringify(input));
  await vm.fs.writeFile('/tmp/worker.mjs',bundle);
  save(`${prefix}/isolation.json`,{...iso,vm_id:vm.id,setup_ms:performance.now()-setupStart,host_mounts:[]});
  wallStart=performance.now();
  const proc=vm.exec(['/usr/bin/node','/tmp/worker.mjs'],{stdout:'pipe',stderr:'pipe'});
  proc.stderr.on('data',b=>{stderr+=b.toString();});
  let tail='';
  const consume=(async()=>{for await(const chunk of proc){const text=chunk.toString();stdout+=text;tail+=text;let nl;while((nl=tail.indexOf('\n'))>=0){const line=tail.slice(0,nl);tail=tail.slice(nl+1);if(!line)continue;const e=JSON.parse(line);events.push(e);if(e.event==='task_created') {save(`${prefix}/task-created.json`,e);print('TASK_CREATED',run.execution_id,e.run_id);}if(e.event==='task_status')print('TASK_STATUS',run.execution_id,e.status);}}})();
  const timeout=AbortSignal.timeout(390000);
  await Promise.race([Promise.all([proc,consume]),new Promise((_,reject)=>timeout.addEventListener('abort',()=>reject(new Error('Host execution deadline exceeded')),{once:true}))]);
  const outcome=events.findLast(x=>x.event==='outcome');
  if(!outcome)throw new Error(`Worker terminated without outcome: ${stderr.slice(0,1000)}`);
  save(`${prefix}/outcome.json`,{...run,...outcome,host_wall_ms:performance.now()-wallStart,config_hash:sha(JSON.stringify(cfg)),provider_charge:null});
  const evidence=events.find(x=>x.event==='evidence'); if(evidence)save(`${prefix}/evidence.json`,evidence.packet);
  const answer=events.find(x=>x.event==='answer');if(answer)save(`${prefix}/answer.json`,answer);
  print('FINISH',run.execution_id,outcome.status,Math.round(outcome.total_ms)+'ms');
  if(outcome.status!=='completed')stop=true;
 } catch(err) {
  save(`${prefix}/outcome.json`,{...run,status:'failed',error:String(err),host_wall_ms:wallStart?performance.now()-wallStart:null,provider_charge:null});
  print('FAILED',run.execution_id,String(err));stop=true;
 } finally {
  save(`${prefix}/events.jsonl`,events.map(x=>JSON.stringify(x)).join('\n'));
  save(`${prefix}/raw/worker-stdout.jsonl`,stdout);
  save(`${prefix}/raw/worker-stderr.txt`,stderr);
  save(`${prefix}/raw/outbound-audit.json`,audit);
  await vm?.close();
 }
}
for(const run of schedule) {
 const p=join(RUN,`executions/${run.execution_id}/outcome.json`);
 print('SUMMARY',run.execution_id,json(p).status);
}
const auditFiles=[];
function walk(dir){for(const f of readdirSync(dir,{withFileTypes:true})){const p=join(dir,f.name);if(f.isDirectory())walk(p);else if(p!==canaryPath)auditFiles.push(p);}}
walk(RUN);
for(const p of auditFiles)if(readFileSync(p,'utf8').includes(canary))throw new Error(`Private canary leaked: ${p}`);
save('leakage-audit.json',{passed:true,files_checked:auditFiles.length,canary_seen:false,no_host_mounts:true,no_contestant_tools:true});
print('COMPLETE',RUN);
