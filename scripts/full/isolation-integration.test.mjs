import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync,existsSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {VM} from '../pilot/node_modules/@earendil-works/gondolin/dist/src/index.js';
import {runtime,buildProductionHooks,isolation,preflight} from './runtime.mjs';
const root=new URL('../..',import.meta.url).pathname;
const cfg=JSON.parse(readFileSync(join(root,'evaluation/full-config.json')));
const spec=JSON.parse(readFileSync(join(root,cfg.parallel.task_spec_path)));
test('offline preflight boots both production workflows and persists checks',{timeout:180000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'offline-preflight-integration-'));
 try {
  writeFileSync(join(dir,'private-canary.txt'),'host-only-canary');
  await preflight(root,dir,runtime(root));
  const result=JSON.parse(readFileSync(join(dir,'isolation-preflight.json')));
  const canaryPath=join(dir,'preflight-host-canary.txt');
  assert.ok(existsSync(canaryPath));assert.equal(statSync(canaryPath).mode&0o077,0);
  const secret=readFileSync(canaryPath,'utf8').trim();assert.match(secret,/^[a-f0-9]{64}$/);
  assert.ok(result.workflows.every(x=>x.checked_paths.includes(canaryPath)));
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.deepEqual(result.workflows.map(x=>x.workflow),['parallel','context7']);
  assert.notEqual(result.workflows[0].vm_id,result.workflows[1].vm_id);
  assert.ok(result.workflows.every(x=>x.exit_code===0&&x.stdout.includes('FILESYSTEM_AND_EGRESS_BLOCKED')));
  const records=readFileSync(join(dir,'isolation-preflight-audit.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(records.length,4);assert.ok(records.every(x=>x.status===403));
  assert.ok(!JSON.stringify(records).includes(secret));
  await assert.rejects(preflight(root,dir,runtime(root)),{code:'EEXIST'});
  assert.equal(readFileSync(canaryPath,'utf8').trim(),secret);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
// Real production hooks and real Gondolin; no worker, credentials, or allowed destination requests.
for(const workflow of ['parallel','context7'])test(`real VM isolation with ${workflow} production hooks`,{timeout:180000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'isolation-integration-')),canary=join(dir,'private-canary.txt');
 writeFileSync(canary,'host-private-marker');
 const rt=runtime(root),records=[];
 const make=()=>buildProductionHooks({workflow,cfg,spec,canary:'host-private-marker',auth:{token:'fake-only-token',account:'fake-only-account',parallel:'fake-only-parallel',context:'fake-only-context'},record:r=>records.push(r)});
 let vm;
 try {
  let hooks=make();
  vm=await VM.create({sandbox:rt.sandbox,httpHooks:hooks.httpHooks,env:hooks.env,dns:{mode:'synthetic'},allowWebSockets:false});
  const first=vm.id;
  const result=await isolation(vm,root,canary);
  assert.ok(result.checked_paths.includes(canary));assert.ok(result.checked_paths.includes('/tmp/previous-execution-marker'));
  assert.equal(hooks.auditFailure,null);assert.equal(records.length,2);assert.ok(records.every(r=>r.status===403&&r.decision==='local-preflight-denial-no-forwarding'));
  await vm.fs.writeFile('/tmp/previous-execution-marker','previous VM private marker');
  await vm.close();vm=null;
  hooks=make();
  vm=await VM.create({sandbox:rt.sandbox,httpHooks:hooks.httpHooks,env:hooks.env,dns:{mode:'synthetic'},allowWebSockets:false});
  assert.notEqual(vm.id,first);await isolation(vm,root,canary);
  const unexpected=await vm.exec("curl --max-time 8 -s -o /tmp/unexpected -w '%{http_code}' https://example.com/unexpected");
  assert.equal(unexpected.stdout,'502');assert.match(hooks.auditFailure,/AUDIT/);assert.throws(()=>hooks.enterWorker(),/AUDIT/);
  await vm.close();vm=null;
  hooks=make();hooks.enterWorker();
  vm=await VM.create({sandbox:rt.sandbox,httpHooks:hooks.httpHooks,env:hooks.env,dns:{mode:'synthetic'},allowWebSockets:false});
  const workerProbe=await vm.exec("curl --max-time 8 -s -o /tmp/worker-probe -w '%{http_code}' https://example.com/");
  assert.equal(workerProbe.stdout,'502');assert.match(hooks.auditFailure,/AUDIT/);
 } finally {await vm?.close();rmSync(dir,{recursive:true,force:true});}
});
