// Trusted host runtime. Credentials never cross the Gondolin boundary.
import {VM,createHttpHooks} from '../pilot/node_modules/@earendil-works/gondolin/dist/src/index.js';
import {readFileSync,existsSync,mkdirSync,writeFileSync,readdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,dirname} from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {json,sha,fileSha,treeDigest,saveNew,createAudit} from './control.mjs';
import {publicRow,apiPathAllowed} from '../pilot/core.mjs';
import {campaignPause} from './pause.mjs';

export function runtime(root) {
  const qemuRoot=process.env.DOCS_CHECK_QEMU_ROOT??join(homedir(),'.cache/docs-check-runtime/qemu');
  process.env.PATH=`${qemuRoot}/usr/bin:${process.env.PATH}`;
  process.env.LD_LIBRARY_PATH=`${qemuRoot}/usr/lib/x86_64-linux-gnu${process.env.LD_LIBRARY_PATH?':'+process.env.LD_LIBRARY_PATH:''}`;
  const image=join(homedir(),'.cache/gondolin/images/objects/f59d9a69-1f62-57e0-a392-6800d3dd021d');
  if(!existsSync(join(image,'manifest.json')))throw new Error('Pinned Gondolin image missing: no floating image fallback permitted');
  const imageManifest=json(join(image,'manifest.json')),verifiedAssets={};
  for(const [key,name] of Object.entries(imageManifest.assets)){const digest=fileSha(join(image,name));if(digest!==imageManifest.checksums[key])throw new Error(`Pinned image asset checksum mismatch: ${key}`);verifiedAssets[key]=digest;}
  const sandbox={qemuPath:join(root,'scripts/pilot/qemu-x86_64.sh'),accel:'tcg',memory:'1536M',cpus:2,imagePath:image};
  return {sandbox,metadata:{gondolin:'0.14.0',pi_ai:'1.4.0',node:process.version,sandbox,host_mounts:[],dns:'synthetic',websockets:false,image_manifest:imageManifest,image_assets:verifiedAssets,qemu_binary_sha256:fileSha(join(qemuRoot,'usr/bin/qemu-system-x86_64')),qemu_runtime_tree:treeDigest(qemuRoot)}};
}
export function safeModel(cfg) {
  const model=json(join(homedir(),'.pi/agent/models-store.json'))['openai-codex'].models.find(x=>x.id===cfg.answering_model.id);
  if(!model||model.thinkingLevelMap?.medium!=='medium')throw new Error('Frozen model/reasoning unavailable');
  return Object.fromEntries(['id','name','api','provider','baseUrl','reasoning','input','cost','contextWindow','maxTokens','thinkingLevelMap','compat'].map(k=>[k,model[k]]));
}
export function credentials() {
  const authProcess=spawnSync('pi',['auth','check','--provider','openai-codex','--json','--credentials'],{cwd:'/tmp',encoding:'utf8',timeout:30000});
  if(authProcess.status!==0)throw new Error('Model OAuth unavailable');
  const token=JSON.parse(authProcess.stdout).credentials;
  if(typeof token!=='string')throw new Error('Unexpected model credential response');
  const account=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString())['https://api.openai.com/auth'].chatgpt_account_id;
  const python=process.env.PARALLEL_PYTHON??join(homedir(),'.local/share/mise/installs/pipx-parallel-web-tools/0.9.4/parallel-web-tools/bin/python');
  const pk=spawnSync(python,['-c','import os; from parallel_web_tools.core.credentials import get_selected_api_key; k=os.environ.get("PARALLEL_API_KEY") or get_selected_api_key(); assert k; print(k)'],{encoding:'utf8',timeout:10000});
  if(pk.status!==0)throw new Error('Parallel key unavailable; no login/provisioning/topup attempted');
  const cp=join(process.env.XDG_CONFIG_HOME??join(homedir(),'.config'),'context7/credentials.json');
  const context=process.env.CONTEXT7_API_KEY??(existsSync(cp)?json(cp).access_token:null);
  return {token,account,parallel:pk.stdout.trim(),context};
}
export async function isolation(vm,root,canaryPath) {
  const paths=[join(root,'evaluation/answer-key.json'),join(root,'sources'),join(homedir(),'.pi/agent/sessions'),join(homedir(),'.config/parallel-web-tools/auth.json'),canaryPath,'/tmp/previous-execution-marker','/workspace/evaluation/answer-key.json','/data/workspace/evaluation/answer-key.json'];
  const script=`for p in ${paths.map(p=>"'"+p.replaceAll("'","'\\''")+"'").join(' ')}; do if test -e "$p"; then echo "UNEXPECTED_FILE:$p"; exit 41; fi; done; test -z "$PI_SESSION_FILE" || exit 42; code=$(curl --max-time 8 -s -o /tmp/blocked-body -w '%{http_code}' https://example.com/); test "$code" = 403 || exit 43; code=$(curl --max-time 8 -s -o /tmp/blocked-internal -w '%{http_code}' http://169.254.169.254/latest/meta-data/); test "$code" = 403 || exit 44; echo FILESYSTEM_AND_EGRESS_BLOCKED`;
  const r=await vm.exec(script);
  const result={exit_code:r.exitCode,stdout:r.stdout,stderr:r.stderr,checked_paths:paths,host_mounts:[]};
  if(!r.ok||!r.stdout.includes('FILESYSTEM_AND_EGRESS_BLOCKED'))throw Object.assign(new Error('Isolation preflight failed'),{isolation:result});
  return result;
}
export function buildProductionHooks({workflow,cfg,spec,canary,auth,hooksFactory=createHttpHooks,record=()=>{},onResponse}) {
  let stage='preflight',auditFailure=null;
  const check=createAudit({workflow,cfg,spec,canary});
  const marker=randomBytes(24).toString('hex'),accountPlaceholder=`account_${marker}`;
  const fakeJwt=[Buffer.from('{"alg":"none"}').toString('base64url'),Buffer.from(JSON.stringify({'https://api.openai.com/auth':{chatgpt_account_id:accountPlaceholder}})).toString('base64url'),marker].join('.');
  const defs={CODEX_TOKEN:{hosts:['chatgpt.com'],value:auth.token,placeholder:fakeJwt},CODEX_ACCOUNT:{hosts:['chatgpt.com'],value:auth.account,placeholder:accountPlaceholder},...(workflow==='parallel'?{PARALLEL_KEY:{hosts:['api.parallel.ai'],value:auth.parallel}}:auth.context?{CONTEXT7_TOKEN:{hosts:['context7.com'],value:auth.context}}:{})};
  const hooks=hooksFactory({allowedHosts:['chatgpt.com',workflow==='parallel'?'api.parallel.ai':'context7.com'],blockInternalRanges:true,secrets:defs,isRequestAllowed:req=>apiPathAllowed(req,workflow),
    onRequest:async req=>{
      if(auditFailure)throw new Error(auditFailure);
      if(stage==='preflight'&&req.method==='GET'&&['https://example.com/','http://169.254.169.254/latest/meta-data/'].includes(req.url)) {
        record({utc:new Date().toISOString(),method:req.method,url:req.url,status:403,decision:'local-preflight-denial-no-forwarding'});
        return new Response('Forbidden',{status:403});
      }
      try {const result=await check(req);if(stage==='preflight')throw new Error('AUDIT: unexpected preflight request');record(result);}catch(err){auditFailure=String(err);throw err;}
    },onResponse:async(res,req)=>{try{await onResponse?.(res,req,check);}catch(err){auditFailure=String(err);throw err;}}});
  return {...hooks,check,get auditFailure(){return auditFailure;},enterWorker(){if(auditFailure)throw new Error(auditFailure);stage='worker';}};
}
export async function preflight(root,run,rt) {
  let vm;
  const start=performance.now();
  const canaryPath=join(run,'preflight-host-canary.txt'),canary=randomBytes(32).toString('hex');
  saveNew(canaryPath,canary);
  try {
    const cfg=json(join(root,'evaluation/full-config.json')),spec=json(join(root,cfg.parallel.task_spec_path));
    const workflows=[];
    for(const workflow of ['parallel','context7']) {
      const hooks=buildProductionHooks({workflow,cfg,spec,canary,auth:{token:'fake-only-token',account:'fake-only-account',parallel:'fake-only-parallel',context:'fake-only-context'},record:record=>{const p=join(run,'isolation-preflight-audit.jsonl');writeFileSync(p,JSON.stringify({workflow,...record})+'\n',{flag:'a',mode:0o600});}});
      const {httpHooks,env}=hooks;
      vm=await VM.create({sandbox:rt.sandbox,httpHooks,env,dns:{mode:'synthetic'},allowWebSockets:false});
      const check=await isolation(vm,root,canaryPath);
      hooks.enterWorker();
      await vm.fs.writeFile('/tmp/previous-execution-marker','must not survive');
      workflows.push({workflow,...check,vm_id:vm.id});
      await vm.close();vm=null;
    }
    saveNew(join(run,'isolation-preflight.json'),{workflows,elapsed_ms:performance.now()-start,host_mounts:[]});
  } catch(err) {if(err.isolation)saveNew(join(run,'isolation-preflight.json'),err.isolation);throw err;} finally {await vm?.close();}
}
export async function executeCampaign({root,run,manifest,schedule,rt,model,bundle,auth,vmFactory=options=>VM.create(options),hooksFactory=createHttpHooks,isolationCheck=isolation,hostDeadlineMs=390000}) {
  const cfg=manifest.config,spec=json(join(root,cfg.parallel.task_spec_path));
  const questions=readFileSync(join(root,'evaluation/questions.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  const secretValues=[auth.token,auth.account,auth.parallel,auth.context].filter(Boolean);
  const scrub=x=>{let s=typeof x==='string'?x:JSON.stringify(x);for(const secret of secretValues)s=s.split(secret).join('[REDACTED]');return s;};
  const save=(path,x)=>saveNew(join(run,path),scrub(x));
  const canary=randomBytes(32).toString('hex');saveNew(join(run,'private-canary.txt'),canary);
  let paused=false;
  const pause=campaignPause(run);
  try {
  for(const entry of schedule) {
    paused=pause.check()||paused;
    pause.acknowledge();
    const prefix=`executions/${entry.execution_id}`,startUtc=new Date().toISOString();
    const base={...entry,config_hash:manifest.execution_config_hash??manifest.config_hash,host_start_utc:startUtc,start_utc:startUtc,provider_charge:null,currency:null,accounting_status:'unavailable',model_usage:[],run_id:null,selected_libraries:null,evidence_original_bytes:null,evidence_retained_bytes:null,evidence_original_tokens:null,evidence_retained_tokens:null,evidence_truncated:null};
    if(paused){save(`${prefix}/outcome.json`,{...base,end_utc:new Date().toISOString(),status:'not_run',reason:'Campaign paused; no invocation or replacement',total_ms:null,retrieval_ms:null,answer_ms:null});continue;}
    const audit=[],events=[];let vm,wallStart=null,stdout='',stderr='',outcomeWritten=false,auditFailure=null;
    const setupStart=performance.now();
    const append=(path,x,raw=false)=>{const p=join(run,prefix,path);mkdirSync(dirname(p),{recursive:true,mode:0o700});writeFileSync(p,scrub(x)+(raw?'':'\n'),{flag:'a',mode:0o600});};
    console.log('START',entry.execution_id);
    try {
      const hooks=buildProductionHooks({workflow:entry.workflow,cfg,spec,canary,auth,hooksFactory,record:record=>{audit.push(record);append('raw/outbound-audit.jsonl',record);},
        onResponse:async (res,req,check)=>{
          const record={utc:new Date().toISOString(),url:req.url,method:req.method,status:res.status};audit.push(record);append('raw/outbound-audit.jsonl',record);
          if(req.method==='POST'&&new URL(req.url).hostname==='api.parallel.ai'&&res.ok){try{const text=await res.clone().text();save(`${prefix}/raw/task-creation-response.json`,{status:res.status,text});const data=JSON.parse(text);check.registerTask(data.run_id);save(`${prefix}/task-created-host.json`,{run_id:data.run_id,utc:record.utc});}catch(err){auditFailure=String(err);throw err;}}
        }});
      const {httpHooks,env}=hooks;
      vm=await vmFactory({sandbox:rt.sandbox,httpHooks,env,dns:{mode:'synthetic'},allowWebSockets:false,sessionLabel:`full-${entry.execution_id}`});
      const iso=await isolationCheck(vm,root,join(run,'private-canary.txt'));
      hooks.enterWorker();
      const public_request=publicRow(questions.find(q=>q.id===entry.question_id));
      save(`${prefix}/public-request.json`,public_request);
      await vm.fs.mkdir('/input',{recursive:true});
      await vm.fs.writeFile('/input/request.json',JSON.stringify({public_request,workflow:entry.workflow,model,processor:cfg.parallel.processor,task_spec:spec,memory_scope_key:`docscheck_${randomBytes(24).toString('hex')}`,settings:cfg.settings}));
      await vm.fs.writeFile('/tmp/worker.mjs',bundle);
      save(`${prefix}/isolation.json`,{...iso,vm_id:vm.id,setup_ms:performance.now()-setupStart});
      wallStart=performance.now();
      const proc=vm.exec(['/usr/bin/node','/tmp/worker.mjs'],{stdout:'pipe',stderr:'pipe'});
      proc.stderr.on('data',b=>{stderr+=b.toString();append('raw/worker-stderr.txt',b.toString(),true);});
      let tail='';
      const consume=(async()=>{for await(const chunk of proc){const text=chunk.toString();stdout+=text;tail+=text;append('raw/worker-stdout.jsonl',text,true);if(stdout.includes(canary)){auditFailure='Private canary leakage in worker stdout';throw new Error(auditFailure);}let nl;while((nl=tail.indexOf('\n'))>=0){const line=tail.slice(0,nl);tail=tail.slice(nl+1);if(!line)continue;const e=JSON.parse(line);events.push(e);append('events.jsonl',e);if(e.event==='task_created')save(`${prefix}/task-created.json`,e);}}})();
      let timer;try {await Promise.race([Promise.all([proc,consume]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Host execution deadline exceeded')),hostDeadlineMs);})]);}finally{clearTimeout(timer);}
      auditFailure??=hooks.auditFailure;
      const outcome=events.findLast(e=>e.event==='outcome');
      if(!outcome)throw new Error('Worker terminated without outcome');
      const evidence=events.find(e=>e.event==='evidence')?.packet;
      if(evidence)save(`${prefix}/evidence.json`,evidence);
      const answer=events.find(e=>e.event==='answer');if(answer)save(`${prefix}/answer.json`,answer);
      const selected=events.find(e=>e.event==='query_plan')?.selection??null;
      if(stderr.includes(canary))auditFailure='Private canary leakage in worker stderr';
      const hostTask=existsSync(join(run,prefix,'task-created-host.json'))?json(join(run,prefix,'task-created-host.json')).run_id:null;
      const runId=outcome.run_id??hostTask;
      const outstanding=outcome.outstanding_task??(runId&&!events.some(e=>e.event==='parallel_result')?runId:null);
      save(`${prefix}/outcome.json`,{...base,...outcome,start_utc:events.find(e=>e.event==='started')?.utc??startUtc,run_id:runId,outstanding_task:outstanding,status:auditFailure?'failed':outcome.status,pause_required:!!auditFailure||outcome.pause_required,error:auditFailure??outcome.error??null,end_utc:new Date().toISOString(),host_wall_ms:performance.now()-wallStart,setup_ms:wallStart-setupStart,selected_libraries:selected,api_attempts:events.filter(e=>e.event==='api_request').length,model_attempts:audit.filter(e=>e.method==='POST'&&e.url.includes('chatgpt.com')&&e.body).length,evidence_original_bytes:evidence?.original_bytes??null,evidence_retained_bytes:evidence?.retained_bytes??null,evidence_original_tokens:evidence?.original_tokens??null,evidence_retained_tokens:evidence?.retained_tokens??null,evidence_truncated:evidence?.truncated??null});
      outcomeWritten=true;paused=!!auditFailure||!!outcome.pause_required||pause.check();
      console.log('FINISH',entry.execution_id,outcome.status,paused?'PAUSED':'');
    } catch(err) {
      if(err.isolation)save(`${prefix}/isolation.json`,{...err.isolation,vm_id:vm?.id,setup_ms:performance.now()-setupStart});
      if(!outcomeWritten)save(`${prefix}/outcome.json`,{...base,status:'failed',phase:wallStart?'worker':'setup',pause_required:true,error:String(err),end_utc:new Date().toISOString(),host_wall_ms:wallStart?performance.now()-wallStart:null,total_ms:wallStart?performance.now()-wallStart:null,retrieval_ms:null,answer_ms:null,run_id:events.find(e=>e.event==='task_created')?.run_id??(existsSync(join(run,prefix,'task-created-host.json'))?json(join(run,prefix,'task-created-host.json')).run_id:null),outstanding_task:'unknown; reconcile host creation record and audit, never resubmit'});
      paused=true;console.log('FAILED',entry.execution_id,'campaign paused; see private artifacts');
    } finally {try{await vm?.close();}catch(err){paused=true;save(`${prefix}/vm-close-error.json`,{error:String(err)});}
      paused=pause.check()||paused;pause.acknowledge();
    }
  }
  const files=[];
  function walk(dir){for(const f of readdirSync(dir,{withFileTypes:true})){const p=join(dir,f.name);if(f.isDirectory())walk(p);else if(p!==join(run,'private-canary.txt'))files.push(p);}}
  walk(join(run,'executions'));
  for(const file of files)if(readFileSync(file,'utf8').includes(canary))throw new Error('Private canary leaked into artifacts; campaign quarantined');
  save('leakage-audit.json',{passed:true,files_checked:files.length,canary_seen:false,no_host_mounts:true,no_contestant_tools:true});
  save('campaign-terminal.json',{ended_at:new Date().toISOString(),status:paused?'paused':'pass-ended',planned:schedule.length,additional_attempts:0});
  console.log('PASS_STOPPED',run,paused?'PAUSED':'awaiting independent blinded scoring');
  } finally {pause.close();}
}
