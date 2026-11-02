import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,existsSync,writeFileSync,symlinkSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {EventEmitter} from 'node:events';
import {spawnSync} from 'node:child_process';
import {executeCampaign,buildProductionHooks,isolation,runtime} from './runtime.mjs';
import {VM} from '../pilot/node_modules/@earendil-works/gondolin/dist/src/index.js';
const root=new URL('../..',import.meta.url).pathname;
const cfg=JSON.parse(readFileSync(new URL('../../evaluation/full-config.json',import.meta.url)));
const spec=JSON.parse(readFileSync(new URL('../../evaluation/parallel-task-spec.json',import.meta.url)));
const schedule=['parallel','context7'].map((workflow,order)=>({execution_id:`nextjs-02-${workflow}-1`,question_id:'nextjs-02',workflow,repeat:1,order}));
const outcome=(status='completed',extra={})=>({event:'outcome',status,pause_required:false,retrieval_ms:2,answer_ms:1,total_ms:3,model_usage:[],...extra});
const raw=e=>JSON.stringify(e)+'\n';
async function fixture(scenario,options={}) {
 const run=mkdtempSync(join(tmpdir(),'docs-check-runtime-'));let created=0,closed=0;
 const hooksFactory=options=>({httpHooks:options,env:{}});
 const vmFactory=async options=>{
  const ordinal=created++;let release;
  const closing=new Promise(r=>{release=r;});
  return {id:`fake-${ordinal}`,fs:{mkdir:async()=>{},writeFile:async()=>{}},close:async()=>{closed++;release();optionsFor.onClose?.(run);if(optionsFor.closeError)throw new Error('fixture close failure');},exec:()=>{
    const stderr=new EventEmitter();let finish;
    const finished=new Promise(r=>{finish=r;});
    return {stderr,then:(...args)=>finished.then(...args),async *[Symbol.asyncIterator](){try{yield* scenario({options,run,ordinal,closing,stderr});}finally{finish();}}};
  }};
 };
 const optionsFor=options;
 try{
  let error=null;
  options.before?.(run);
  try{await executeCampaign({root,run,manifest:{config:cfg,config_hash:'fixture'},schedule,rt:{sandbox:{}},model:{},bundle:Buffer.from('// no model'),auth:{token:'fake-token',account:'fake-account',parallel:'fake-key',context:null},vmFactory,hooksFactory,isolationCheck:options.isolationCheck??(async()=>({host_mounts:[]})),hostDeadlineMs:options.deadline??1000});}catch(e){error=e;}
  const outcomes=schedule.map(e=>JSON.parse(readFileSync(join(run,'executions',e.execution_id,'outcome.json'))));
  return {error,outcomes,created,closed,pauseEvents:existsSync(join(run,'pause-events.jsonl'))?readFileSync(join(run,'pause-events.jsonl'),'utf8').trim().split('\n').map(JSON.parse):[],terminal:existsSync(join(run,'campaign-terminal.json'))?JSON.parse(readFileSync(join(run,'campaign-terminal.json'))):null,isolation:existsSync(join(run,'executions',schedule[0].execution_id,'isolation.json'))?JSON.parse(readFileSync(join(run,'executions',schedule[0].execution_id,'isolation.json'))):null,raw:existsSync(join(run,'executions',schedule[0].execution_id,'raw/worker-stdout.jsonl'))?readFileSync(join(run,'executions',schedule[0].execution_id,'raw/worker-stdout.jsonl'),'utf8'):''};
 }finally{rmSync(run,{recursive:true,force:true});}
}
test('fresh VM per execution, chunks preserved byte-for-byte, no repeats',async()=>{
 const text=raw(outcome());
 const f=await fixture(async function*(){yield Buffer.from(text.slice(0,7));yield Buffer.from(text.slice(7));});
 assert.equal(f.error,null);assert.equal(f.created,2);assert.equal(f.closed,2);assert.equal(f.raw,text);assert.deepEqual(f.outcomes.map(x=>x.status),['completed','completed']);
});
test('ordinary failed execution is kept without replacement; later independent rows run',async()=>{
 const f=await fixture(async function*({ordinal}){yield Buffer.from(raw(outcome(ordinal?'completed':'failed',{error:'malformed Task findings'})));});
 assert.equal(f.created,2);assert.deepEqual(f.outcomes.map(x=>x.status),['failed','completed']);
});
test('auth/quota systemic failure pauses remaining rows without calling another VM',async()=>{
 const f=await fixture(async function*(){yield Buffer.from(raw(outcome('failed',{classification:'auth',pause_required:true})));});
 assert.equal(f.error,null);assert.equal(f.created,1);assert.equal(f.closed,1);assert.deepEqual(f.outcomes.map(x=>x.status),['failed','not_run']);assert.equal(f.terminal.status,'paused');
});
test('host audit failure overrides worker outcome and pauses',async()=>{
 const f=await fixture(async function*({options}){
  try{await options.httpHooks.onRequest(new Request('https://chatgpt.com/backend-api/codex/responses',{method:'POST',body:JSON.stringify({model:'forbidden'})}));}catch{}
  yield Buffer.from(raw(outcome()));
 });
 assert.equal(f.created,1);assert.deepEqual(f.outcomes.map(x=>x.status),['failed','not_run']);assert.match(f.outcomes[0].error,/AUDIT/);
});
test('isolation failure preserves diagnostics and pauses before worker',async()=>{
 const f=await fixture(async function*(){assert.fail('worker must not start');},{isolationCheck:async()=>isolation({exec:async()=>({ok:false,exitCode:43,stdout:'probe stdout',stderr:'probe stderr'})},root,'/private-canary')});
 assert.equal(f.created,1);assert.deepEqual(f.outcomes.map(x=>x.status),['failed','not_run']);
 assert.equal(f.isolation.stdout,'probe stdout');assert.equal(f.isolation.stderr,'probe stderr');assert.equal(f.isolation.exit_code,43);assert.ok(f.isolation.checked_paths.includes('/private-canary'));
});
test('only exact preflight GET probes are exempt, unexpected preflight and worker probes latch audit failure',async()=>{
 const make=()=>buildProductionHooks({workflow:'parallel',cfg,spec,canary:'private-canary',auth:{token:'fake-token',account:'fake-account',parallel:'fake-key'},hooksFactory:o=>({httpHooks:o,env:{}})});
 for(const url of ['https://example.com/','http://169.254.169.254/latest/meta-data/']) {
  const h=make();assert.equal((await h.httpHooks.onRequest(new Request(url))).status,403);assert.equal(h.auditFailure,null);
  h.enterWorker();await assert.rejects(h.httpHooks.onRequest(new Request(url)),/AUDIT/);assert.match(h.auditFailure,/AUDIT/);
 }
 for(const req of [new Request('https://example.com/?extra=1'),new Request('https://example.com/',{method:'POST'}),new Request('http://169.254.169.254/latest/meta-data/child')]) {
  const h=make();await assert.rejects(h.httpHooks.onRequest(req),/AUDIT/);assert.throws(()=>h.enterWorker(),/AUDIT/);
 }
});
test('latched audit failure blocks subsequent valid requests and preflight probes locally',async()=>{
 for(const worker of [false,true]) {
  const records=[];
  const h=buildProductionHooks({workflow:'parallel',cfg,spec,canary:'private-canary',auth:{token:'fake-token',account:'fake-account',parallel:'fake-key'},record:r=>records.push(r),hooksFactory:o=>({httpHooks:o,env:{}})});
  if(worker)h.enterWorker();
  await assert.rejects(h.httpHooks.onRequest(new Request('https://example.com/unexpected')),/AUDIT/);
  const failure=h.auditFailure;
  const valid=new Request('https://api.parallel.ai/v1/tasks/runs',{method:'POST',body:JSON.stringify({input:'public',processor:'core-fast',task_spec:spec,memory_scope_key:`docscheck_${'1'.repeat(48)}`})});
  await assert.rejects(h.httpHooks.onRequest(valid),{message:failure});
  await assert.rejects(h.httpHooks.onRequest(new Request('https://example.com/')),{message:failure});
  assert.equal(h.auditFailure,failure);assert.equal(records.length,0);
 }
});
async function createdTask(options) {
 const request=new Request('https://api.parallel.ai/v1/tasks/runs',{method:'POST',body:JSON.stringify({input:'public',processor:'core-fast',task_spec:spec,memory_scope_key:`docscheck_${'1'.repeat(48)}`})});
 await options.httpHooks.onRequest(request);
 await options.httpHooks.onResponse(new Response(JSON.stringify({run_id:'trun_host_recorded'}),{status:202}),request);
}
test('expected probe URL after worker stage still fails audit and pauses campaign',async()=>{
 const f=await fixture(async function*({options}){try{await options.httpHooks.onRequest(new Request('https://example.com/'));}catch{}yield Buffer.from(raw(outcome()));});
 assert.equal(f.created,1);assert.deepEqual(f.outcomes.map(x=>x.status),['failed','not_run']);assert.match(f.outcomes[0].error,/AUDIT/);
});
test('host creation ID survives worker timeout outcome with missing ID',async()=>{
 const f=await fixture(async function*({options}){await createdTask(options);yield Buffer.from(raw(outcome('failed',{classification:'deadline',run_id:null,outstanding_task:null})));});
 assert.equal(f.outcomes[0].run_id,'trun_host_recorded');assert.equal(f.outcomes[0].outstanding_task,'trun_host_recorded');
});
test('host deadline closes VM, preserves host task ID and pauses',async()=>{
 const f=await fixture(async function*({options,closing}){await createdTask(options);yield Buffer.from(raw({event:'started'}));await closing;},{deadline:15});
 assert.equal(f.created,1);assert.equal(f.closed,1);assert.equal(f.outcomes[0].status,'failed');assert.equal(f.outcomes[0].run_id,'trun_host_recorded');assert.equal(f.outcomes[1].status,'not_run');
});
test('malformed worker output preserves original failure and pauses',async()=>{
 const f=await fixture(async function*({options}){await createdTask(options);yield Buffer.from('not json\n');});
 assert.equal(f.outcomes[0].run_id,'trun_host_recorded');assert.equal(f.created,1);assert.equal(f.outcomes[0].status,'failed');assert.equal(f.raw,'not json\n');
});
test('canary leakage is caught before next execution and quarantines artifacts',async()=>{
 const f=await fixture(async function*({run}){const canary=readFileSync(join(run,'private-canary.txt'),'utf8').trim();yield Buffer.from(raw({event:'answer',text:canary}));yield Buffer.from(raw(outcome()));});
 assert.match(String(f.error),/Private canary/);assert.equal(f.created,1);assert.equal(f.outcomes[0].status,'failed');assert.equal(f.outcomes[1].status,'not_run');
});
test('VM close failure pauses before next execution without replacing completed answer',async()=>{
 const f=await fixture(async function*(){yield Buffer.from(raw(outcome()));},{closeError:true});
 assert.equal(f.created,1);assert.equal(f.outcomes[0].status,'completed');assert.equal(f.outcomes[1].status,'not_run');assert.equal(f.terminal.status,'paused');
});

for(const status of ['completed','failed'])test(`signals drain active ${status}, do not replace, restore handlers`,async()=>{
 const before=['SIGINT','SIGTERM'].map(s=>process.listeners(s));
 const f=await fixture(async function*(){
  process.emit('SIGINT');process.emit('SIGTERM');process.emit('SIGINT');
  await new Promise(r=>setTimeout(r,5));
  yield Buffer.from(raw(outcome(status)));
 });
 assert.equal(f.error,null);assert.equal(f.created,1);assert.equal(f.closed,1);
 assert.deepEqual(f.outcomes.map(x=>x.status),[status,'not_run']);
 assert.equal(f.pauseEvents.filter(x=>x.event==='request').length,3);
 assert.equal(f.pauseEvents.filter(x=>x.event==='acknowledged').length,1);
 assert.equal(f.terminal.status,'paused');
 ['SIGINT','SIGTERM'].forEach((s,i)=>assert.deepEqual(process.listeners(s),before[i]));
});
for(const content of ['{}','{invalid','null'])test(`preexisting pause file fails closed: ${content}`,async()=>{
 const f=await fixture(async function*(){assert.fail('no worker');},{before:run=>writeFileSync(join(run,'pause-request.json'),content)});
 assert.equal(f.error,null);assert.equal(f.created,0);assert.equal(f.closed,0);
 assert.deepEqual(f.outcomes.map(x=>x.status),['not_run','not_run']);assert.equal(f.terminal.status,'paused');
 assert.equal(f.pauseEvents.at(-1).event,'acknowledged');
});
test('pause file after outcome during VM close blocks next VM',async()=>{
 const f=await fixture(async function*(){yield Buffer.from(raw(outcome()));},{onClose:run=>writeFileSync(join(run,'pause-request.json'),'{}')});
 assert.equal(f.created,1);assert.equal(f.closed,1);assert.equal(f.outcomes[1].status,'not_run');
});
test('signals cannot extend original active deadline',async()=>{
 const f=await fixture(async function*({closing}){process.emit('SIGINT');process.emit('SIGTERM');await closing;},{deadline:15});
 assert.equal(f.created,1);assert.equal(f.closed,1);assert.match(f.outcomes[0].error,/deadline/);assert.equal(f.outcomes[1].status,'not_run');
});

for(const kind of ['dangling-symlink','directory','fifo'])test(`nonregular pause file fails closed without reading: ${kind}`,async()=>{
 const f=await fixture(async function*(){assert.fail('no worker');},{before:run=>{
  const path=join(run,'pause-request.json');
  if(kind==='dangling-symlink')symlinkSync(join(run,'missing'),path);
  else if(kind==='directory')mkdirSync(path);
  else assert.equal(spawnSync('mkfifo',[path]).status,0);
 }});
 assert.equal(f.error,null);assert.equal(f.created,0);assert.equal(f.closed,0);
 assert.deepEqual(f.outcomes.map(x=>x.status),['not_run','not_run']);
 assert.equal(f.pauseEvents[0].source,'non-regular-pause-file');assert.equal(f.terminal.status,'paused');
});

test('real offline VM drains on direct Node PID signals (not process-group interrupts)',{timeout:180000},async()=>{
 const run=mkdtempSync(join(tmpdir(),'direct-pid-pause-'));
 const before=['SIGINT','SIGTERM'].map(s=>process.listeners(s));
 let created=0,closed=0,signalled=false;
 try{
  const rt=runtime(root);
  await executeCampaign({root,run,manifest:{config:cfg,config_hash:'offline-signal'},schedule,rt,model:{},
   bundle:`console.log(JSON.stringify({event:'started'})); setTimeout(()=>console.log(${JSON.stringify(raw(outcome()).trim())}),150);`,
   auth:{token:'offline-only',account:'offline-account',parallel:'offline-key'},
   vmFactory:async options=>{
    created++;
    const vm=await VM.create(options),exec=vm.exec.bind(vm),close=vm.close.bind(vm);
    vm.close=async()=>{closed++;return close();};
    vm.exec=(...args)=>{
     const proc=exec(...args);
     if(!Array.isArray(args[0]))return proc;
     return {stderr:proc.stderr,then:proc.then.bind(proc),async *[Symbol.asyncIterator](){
      for await(const chunk of proc){
       if(!signalled){signalled=true;process.kill(process.pid,'SIGINT');process.kill(process.pid,'SIGTERM');}
       yield chunk;
      }
     }};
    };
    return vm;
   }});
  assert.equal(signalled,true);assert.equal(created,1);assert.equal(closed,1);
  assert.deepEqual(schedule.map(e=>JSON.parse(readFileSync(join(run,'executions',e.execution_id,'outcome.json'))).status),['completed','not_run']);
  assert.equal(JSON.parse(readFileSync(join(run,'campaign-terminal.json'))).status,'paused');
 }finally{
  ['SIGINT','SIGTERM'].forEach((s,i)=>assert.deepEqual(process.listeners(s),before[i]));
  rmSync(run,{recursive:true,force:true});
 }
});
