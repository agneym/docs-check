#!/usr/bin/env node
// Approved parser/pause correction; exactly 88 unrun rows. No old runner replay.
import {readFileSync,readdirSync,mkdirSync,existsSync,lstatSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {build} from '../pilot/node_modules/esbuild/lib/main.js';
import {sha,json,saveNew,freezeInputs,externalRoot,assertPrivate,inputPaths} from './control.mjs';
import {dependencies,copyExact,readSchedule} from './continuation-core.mjs';
import {inspectBase,verifyRemainder,authorizeRemainder} from './remainder-core.mjs';
import {runtime,safeModel,credentials,preflight,executeCampaign} from './runtime.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const [mode,one,two,...rest]=process.argv.slice(2);
function check(command,args){const r=spawnSync(command,args,{cwd:ROOT,encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},timeout:300000,maxBuffer:8*1024*1024});if(r.status!==0)throw new Error(`Offline check failed: ${command} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);return {command:[command,...args],status:r.status,stdout:r.stdout,stderr:r.stderr};}
function sourceSnapshot(){return Object.fromEntries([...new Set([...inputPaths(ROOT),'evaluation/full-run-report.md'])].map(path=>[path,sha(readFileSync(join(ROOT,path)))]));}
function currentRuntime(m,model){const rt=runtime(ROOT);if(JSON.stringify(rt.metadata)!==JSON.stringify(m.runtime)||JSON.stringify(dependencies(ROOT))!==JSON.stringify(m.dependencies)||JSON.stringify(safeModel(m.config))!==JSON.stringify(model))throw new Error('Runtime/model/dependency drift');return rt;}
if(mode==='--prepare'){
 if(!one||!two||rest.length)throw new Error('Usage: remainder.mjs --prepare <first-partial-view> <new-run-dir>');
 const base=inspectBase(ROOT,one),target=resolve(two),claim=join(base.original_root,'continuation-2-consumed.json');
 assertPrivate(base.original_root);assertPrivate(dirname(base.original_root));
 if(existsSync(target)||existsSync(claim))throw new Error('Existing target or consumed second continuation; no replay');
 const parent=externalRoot(dirname(target),ROOT,homedir());assertPrivate(parent);mkdirSync(target,{mode:0o700});
 const sourcesBefore=sourceSnapshot();
 const checks=[check('python3',['scripts/compile_dataset.py','--validate-only']),check('python3',['scripts/test_compile_dataset.py','-v']),check(process.execPath,['--test','scripts/pilot/core.test.mjs',...readdirSync(join(ROOT,'scripts/full')).filter(x=>x.endsWith('.test.mjs')).sort().map(x=>`scripts/full/${x}`)]),check('python3',['-m','unittest','discover','-s','scripts/full','-p','test_*.py','-v'])];
 saveNew(join(target,'offline-checks.json'),checks);
 copyExact(join(base.original_root,'model.json'),join(target,'model.json'));
 const rt=currentRuntime(base.manifest,json(join(target,'model.json')));
 const built=await build({entryPoints:[join(ROOT,'scripts/full/worker.mjs')],bundle:true,platform:'node',format:'esm',target:'node24',write:false,banner:{js:'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'},logLevel:'warning'});
 saveNew(join(target,'worker.bundle.mjs'),Buffer.from(built.outputFiles[0].contents).toString());
 const bundleHash=sha(readFileSync(join(target,'worker.bundle.mjs')));
 if(bundleHash===base.first_continuation_manifest.worker_bundle_sha256)throw new Error('Parser correction bundle was not rebuilt');
 await preflight(ROOT,target,rt);
 const after=inspectBase(ROOT,one);if(JSON.stringify(after.base_view)!==JSON.stringify(base.base_view))throw new Error('Prior records changed during offline preparation');
 if(JSON.stringify(sourceSnapshot())!==JSON.stringify(sourcesBefore))throw new Error('Sources changed during checks/build/preflight; preserve partial preparation, do not launch');
 currentRuntime(base.manifest,json(join(target,'model.json')));
 copyExact(join(ROOT,'evaluation/full-run-report.md'),join(target,'incident-report.md'));
 freezeInputs(ROOT,target,base.manifest.config,base.remaining,{phase:'full-first-pass-continuation-2',executions:88,repeat:1,checked_source_snapshot_sha256:sha(JSON.stringify(sourcesBefore)),base_view:base.base_view,retained_entries:base.retained,sensitivity_plan:{primary_includes_all_failed_zeros:true,infrastructure_affected_question_ids:[...new Set(base.retained.filter(row=>row.status==='failed').map(row=>row.question_id))].sort(),paired_exclusion_diagnostic_only:true},changes_from_previous_implementation:after.changes,execution_config_hash:base.launch.execution_config_hash,runtime:rt.metadata,dependencies:base.manifest.dependencies,model_sha256:base.manifest.model_sha256,worker_bundle_sha256:bundleHash,prompts:base.first_continuation_manifest.prompts,offline_checks_sha256:sha(readFileSync(join(target,'offline-checks.json'))),isolation_preflight_sha256:sha(readFileSync(join(target,'isolation-preflight.json'))),isolation_preflight_audit_sha256:sha(readFileSync(join(target,'isolation-preflight-audit.jsonl'))),incident_report_sha256:sha(readFileSync(join(target,'incident-report.md'))),approved_changes:['Accept native plaintext only for the exact Context7 documentation endpoint, matching preserved pilot behavior; Task and library-resolution JSON remain strict','Graceful host pause file/SIGINT/SIGTERM drains current execution under original deadlines before another VM starts','Append-only second-continuation/report chain; all 8 prior attempts preserved including 6 failed/zero entries'],pause_policy:{file:'pause-request.json',signals:['SIGINT','SIGTERM'],finish_current_with_original_deadline:true,no_replacement:true},deviations:['Interrupted implementation/window and 6 infrastructure failures remain disclosed in full primary; no provider-quality winner inferred from controller errors','Two independent human reviewers/cached citation verification remain required; no automated grader substituted']});
 console.log('REMAINDER_88_FROZEN_OFFLINE_ONLY',target,'MANIFEST_SHA256',readFileSync(join(target,'freeze.sha256'),'utf8').trim());process.exit(0);
}
if(!['--verify','--run'].includes(mode)||!one)throw new Error('Usage: remainder.mjs --verify <run> | --run <run> --approval <approval.json>');
const run=externalRoot(one,ROOT,homedir());assertPrivate(run);assertPrivate(dirname(run));
const {manifest:m,base}=verifyRemainder(ROOT,run),rt=currentRuntime(m,json(join(run,'model.json')));
if(mode==='--verify'){if(two||rest.length)throw new Error('Unexpected arguments');console.log('REMAINDER_88_VERIFIED_NO_PROVIDER_CALLS',run);process.exit(0);}
if(two!=='--approval'||rest.length!==1)throw new Error('Incident approval required');
const approval=json(resolve(rest[0])),digest=sha(readFileSync(join(run,'manifest.json')));
authorizeRemainder(approval,digest,m);
const claim=join(base.original_root,'continuation-2-consumed.json');
if(existsSync(claim)||existsSync(join(run,'launch.json'))||existsSync(join(run,'executions')))throw new Error('Second continuation consumed; do not replay or delete claims');
// A present/dangling/special/unreadable pause path blocks even credential startup.
try{lstatSync(join(run,'pause-request.json'));throw new Error('Launch paused before credentials/claim: pause-request.json is present');}catch(error){if(error.code!=='ENOENT')throw error;}
const auth=credentials();
saveNew(claim,{phase:m.phase,run,manifest_sha256:digest,base_provenance_sha256:m.base_view.provenance_sha256,utc:new Date().toISOString(),executions:88,attempts:1,preserve_previous_entries:true});
saveNew(join(run,'launch.json'),{phase:m.phase,utc:new Date().toISOString(),manifest_sha256:digest,base_provenance_sha256:m.base_view.provenance_sha256,approval,claim_path:claim,resolved_config:base.launch.resolved_config,execution_config_hash:base.launch.execution_config_hash});
await executeCampaign({root:ROOT,run,manifest:m,schedule:readSchedule(run),rt,model:json(join(run,'model.json')),bundle:readFileSync(join(run,'worker.bundle.mjs')),auth});
const after=inspectBase(ROOT,m.base_view.run);if(JSON.stringify(after.base_view)!==JSON.stringify(m.base_view))throw new Error('Old records changed during this continuation');
saveNew(join(base.original_root,'continuation-2-terminal-link.json'),{run,manifest_sha256:digest,terminal_sha256:sha(readFileSync(join(run,'campaign-terminal.json'))),executions:88,attempts:1,previous_outcomes_unchanged:true,utc:new Date().toISOString()});
