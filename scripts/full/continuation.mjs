#!/usr/bin/env node
// Only the 95 never-invoked rows from the approved paused first pass; not a replay.
import {readFileSync,existsSync,mkdirSync,realpathSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {sha,json,saveNew,externalRoot,assertPrivate,freezeInputs} from './control.mjs';
import {inspectOrigin,verifyContinuation,authorizeContinuation,copyExact,dependencies,readSchedule} from './continuation-core.mjs';
import {runtime,safeModel,credentials,preflight,executeCampaign} from './runtime.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const [mode,one,two,...rest]=process.argv.slice(2);
function check(command,args){const result=spawnSync(command,args,{cwd:ROOT,encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},timeout:240000});if(result.status!==0)throw new Error(`Offline check failed: ${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);return {command:[command,...args],status:result.status,stdout:result.stdout,stderr:result.stderr};}
function checkCurrentRuntime(m){
 const rt=runtime(ROOT);
 if(JSON.stringify(rt.metadata)!==JSON.stringify(m.runtime)||JSON.stringify(dependencies(ROOT))!==JSON.stringify(m.dependencies)||JSON.stringify(safeModel(m.config))!==JSON.stringify(json(join(m.origin.run,'model.json'))))throw new Error('Runtime, model, image or dependency drift');
 return rt;
}
if(mode==='--prepare') {
 if(!one||!two||rest.length)throw new Error('Usage: continuation.mjs --prepare <original-run> <new-continuation-dir>');
 const original=realpathSync(one),target=resolve(two),origin=inspectOrigin(ROOT,original);
 assertPrivate(original);assertPrivate(dirname(original));
 if(existsSync(target)||existsSync(join(original,'continuation-1-consumed.json')))throw new Error('Existing continuation target or already-consumed continuation; no replay');
 const parent=externalRoot(dirname(target),ROOT,homedir());assertPrivate(parent);mkdirSync(target,{mode:0o700});
 const nodeTests=(await import('node:fs')).readdirSync(join(ROOT,'scripts/full')).filter(x=>x.endsWith('.test.mjs')).sort().map(x=>`scripts/full/${x}`);
 const checks=[check('python3',['scripts/compile_dataset.py','--validate-only']),check('python3',['scripts/test_compile_dataset.py','-v']),check(process.execPath,['--test','scripts/pilot/core.test.mjs',...nodeTests]),check('python3',['-m','unittest','discover','-s','scripts/full','-p','test_*.py','-v'])];
 saveNew(join(target,'offline-checks.json'),checks);
 const rt=checkCurrentRuntime({...origin.manifest,origin:origin.origin});
 copyExact(join(original,'model.json'),join(target,'model.json'));
 // The contestant executable is EXACTLY the initial freeze's bundle; no rebuild.
 copyExact(join(original,'worker.bundle.mjs'),join(target,'worker.bundle.mjs'));
 await preflight(ROOT,target,rt);
 // Recheck origin and sources after tests/preflight; tests never touch originals.
 const after=inspectOrigin(ROOT,original);
 if(JSON.stringify(after.origin)!==JSON.stringify(origin.origin))throw new Error('Original artifacts changed during offline checks');
 copyExact(join(ROOT,'evaluation/full-run-report.md'),join(target,'incident-report.md'));
 freezeInputs(ROOT,target,origin.manifest.config,origin.remaining,{phase:'full-first-pass-continuation',executions:95,repeat:1,origin:origin.origin,retained_failed_execution:origin.retained[0].execution_id,changes_from_original:after.changes,execution_config_hash:origin.launch.execution_config_hash,runtime:rt.metadata,dependencies:origin.manifest.dependencies,model_sha256:origin.manifest.model_sha256,worker_bundle_sha256:origin.manifest.worker_bundle_sha256,prompts:origin.manifest.prompts,offline_checks_sha256:sha(readFileSync(join(target,'offline-checks.json'))),isolation_preflight_sha256:sha(readFileSync(join(target,'isolation-preflight.json'))),isolation_preflight_audit_sha256:sha(readFileSync(join(target,'isolation-preflight-audit.jsonl'))),incident_report_sha256:sha(readFileSync(join(target,'incident-report.md'))),deviations:['Original first entry remains failed/zero; original 95 not_run records are never overwritten','Remaining original order is preserved, but the first pair and campaign window are interrupted by a documented setup incident','Only host isolation integration/diagnostics and append-only continuation/report automation changed; contestant bundle/settings/dataset are byte-identical','Two independent human reviewers and source-cache adjudication remain required; no automated judge substitution']});
 console.log('CONTINUATION_FROZEN_OFFLINE_ONLY',target,'MANIFEST_SHA256',readFileSync(join(target,'freeze.sha256'),'utf8').trim());
 process.exit(0);
}
if(!['--verify','--run'].includes(mode)||!one)throw new Error('Usage: continuation.mjs --verify <dir> | --run <dir> --approval <approval.json>');
const run=externalRoot(one,ROOT,homedir());assertPrivate(run);assertPrivate(dirname(run));
const {manifest:m,current}=verifyContinuation(ROOT,run),rt=checkCurrentRuntime(m);
if(sha(readFileSync(join(run,'incident-report.md')))!==m.incident_report_sha256)throw new Error('Frozen incident report changed');
if(mode==='--verify'){if(two||rest.length)throw new Error('Unexpected arguments');console.log('CONTINUATION_VERIFIED_NO_PROVIDER_CALLS',run);process.exit(0);}
if(two!=='--approval'||rest.length!==1)throw new Error('Explicit incident spending approval file required');
const approval=json(resolve(rest[0])),digest=sha(readFileSync(join(run,'manifest.json')));
authorizeContinuation(approval,digest,m);
if(existsSync(join(run,'launch.json'))||existsSync(join(run,'executions')))throw new Error('Continuation already started; no replay');
const claimPath=join(m.origin.run,'continuation-1-consumed.json');
if(existsSync(claimPath))throw new Error('Incident continuation already consumed; do not delete claim');
const auth=credentials(); // approval precedes credential resolution; no coding-agent session
saveNew(claimPath,{phase:'full-first-pass-continuation',run,manifest_sha256:digest,original_manifest_sha256:m.origin.manifest_sha256,utc:new Date().toISOString(),executions:95,attempts:1,preserve_failed_entries:true});
saveNew(join(run,'launch.json'),{phase:'full-first-pass-continuation',utc:new Date().toISOString(),manifest_sha256:digest,original_manifest_sha256:m.origin.manifest_sha256,approval,claim_path:claimPath,resolved_config:current.launch.resolved_config,execution_config_hash:current.launch.execution_config_hash});
await executeCampaign({root:ROOT,run,manifest:{...m,execution_config_hash:current.launch.execution_config_hash},schedule:readSchedule(run),rt,model:json(join(run,'model.json')),bundle:readFileSync(join(run,'worker.bundle.mjs')),auth});
const post=inspectOrigin(ROOT,m.origin.run);
if(JSON.stringify(post.origin)!==JSON.stringify(m.origin))throw new Error('Original artifacts changed during continuation; do not claim unchanged outcomes');
saveNew(join(m.origin.run,'continuation-1-terminal-link.json'),{run,manifest_sha256:digest,terminal_sha256:sha(readFileSync(join(run,'campaign-terminal.json'))),executions:95,attempts:1,retained_failed_execution:m.retained_failed_execution,original_outcomes_unchanged:true});
