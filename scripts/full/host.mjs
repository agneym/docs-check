#!/usr/bin/env node
// Dedicated full-pass controller. Never imports/invokes the consumed pilot host.
import {readFileSync,mkdirSync,existsSync,readdirSync,lstatSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {build} from '../pilot/node_modules/esbuild/lib/main.js';
import {RETRIEVAL,ANSWERING,PLAN_LIBRARIES,PLAN_QUERIES} from '../pilot/core.mjs';
import {sha,json,saveNew,validateConfig,makeSchedule,externalRoot,freezeInputs,verifyFreeze,authorize,assertPrivate} from './control.mjs';
import {runtime,safeModel,credentials,preflight,executeCampaign} from './runtime.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const [mode,path,...rest]=process.argv.slice(2);
const defaultParent=join(homedir(),'random/docs-check-runs');
const cfg=validateConfig(json(join(ROOT,'evaluation/full-config.json')));
if(!['--prepare','--verify','--run'].includes(mode)||!path)throw new Error('Usage: node scripts/full/host.mjs --prepare|--verify <external-campaign-dir> | --run <dir> --approval <external-approval.json>');
const target=resolve(path);
function check(command,args) {
  const result=spawnSync(command,args,{cwd:ROOT,encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},timeout:180000});
  if(result.status!==0)throw new Error(`Offline check failed: ${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return {command:[command,...args],status:result.status,stdout:result.stdout,stderr:result.stderr};
}
function archiveReferences(run) {
  const source=resolve(process.env.DOCS_CHECK_API_REFERENCES??join(homedir(),'random/docs-check-preflight/api-references-20261101'));
  const index=json(join(source,'archive-index.json'));
  if(index.records?.length!==10)throw new Error('Reviewed API-reference archive required before freeze');
  mkdirSync(join(run,'references'),{mode:0o700});
  for(const record of index.records){
    if(typeof record.path!=='string'||record.path.includes('/')||record.path.includes('..'))throw new Error('Invalid reference archive path');
    const bytes=readFileSync(join(source,record.path));if(sha(bytes)!==record.sha256)throw new Error('Reference archive hash mismatch');
    writeFileSync(join(run,'references',record.path),bytes,{flag:'wx',mode:0o400});
  }
  saveNew(join(run,'references/archive-index.json'),index);
  return {archive_index_sha256:sha(readFileSync(join(run,'references/archive-index.json'))),records:index.records};
}
function dependencies() {
  const files={};
  function walk(dir){for(const f of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=join(dir,f.name);if(f.isDirectory())walk(p);else if(f.isFile())files[p.slice(ROOT.length+1)]=sha(readFileSync(p));}}
  walk(join(ROOT,'scripts/pilot/node_modules'));
  return {tree_sha256:sha(JSON.stringify(files)),files: Object.keys(files).length};
}
if(mode==='--prepare') {
  if(existsSync(target))throw new Error('Refusing an existing campaign directory');
  const parent=externalRoot(dirname(target),ROOT,homedir());
  if(lstatSync(parent).mode&0o077)throw new Error('Run parent must have private permissions (chmod 700)');
  mkdirSync(target,{mode:0o700});
  const checks=[check('python3',['scripts/compile_dataset.py','--validate-only']),check('python3',['scripts/test_compile_dataset.py','-v']),check(process.execPath,['--test','scripts/pilot/core.test.mjs','scripts/full/control.test.mjs','scripts/full/transport.test.mjs','scripts/full/runtime.test.mjs','scripts/full/evidence.test.mjs']),check('python3',['-m','unittest','discover','-s','scripts/full','-p','test_*.py','-v'])];
  saveNew(join(target,'offline-checks.json'),checks);
  const built=await build({entryPoints:[join(ROOT,'scripts/full/worker.mjs')],bundle:true,platform:'node',format:'esm',target:'node24',write:false,banner:{js:'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'},logLevel:'warning'});
  const bundle=built.outputFiles[0].contents;saveNew(join(target,'worker.bundle.mjs'),Buffer.from(bundle).toString());
  const rt=runtime(ROOT),model=safeModel(cfg);
  saveNew(join(target,'model.json'),model);
  // This boots only a provider-denied VM: no credentials, models, or retrieval calls.
  await preflight(ROOT,target,rt);
  const questions=readFileSync(join(ROOT,'evaluation/questions.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  const schedule=makeSchedule(questions,cfg);
  const references=archiveReferences(target);
  freezeInputs(ROOT,target,cfg,schedule,{api_references:references,runtime:rt.metadata,model_sha256:sha(readFileSync(join(target,'model.json'))),worker_bundle_sha256:sha(readFileSync(join(target,'worker.bundle.mjs'))),dependencies:dependencies(),prompts:{retrieval:RETRIEVAL,answering:ANSWERING,plan_libraries:PLAN_LIBRARIES,plan_queries:PLAN_QUERIES},offline_checks_sha256:sha(readFileSync(join(target,'offline-checks.json'))),isolation_preflight_sha256:sha(readFileSync(join(target,'isolation-preflight.json'))),authorization_status:'pending; no full-run calls authorized',judge_process:'two independent human reviewers, human adjudication before unblinding',limitations:['o200k_base proxy tokenizer, not verified exact model tokenizer','4096 local output cap does not bound server-side charges after abort','Actual charges unavailable; capped launches fail closed','No post-timeout cancellation endpoint verified; reconcile late tasks without changing official failures','core-fast exercised in pilot; current public processor/pricing tables omit this selected alias; no substitution','No automated resume or extra attempts; systemic incident requires explicit review and approved continuation implementation']});
  console.log('FROZEN_OFFLINE_ONLY',target,'MANIFEST_SHA256',readFileSync(join(target,'freeze.sha256'),'utf8').trim());
  process.exit(0);
}
const run=externalRoot(target,ROOT,homedir());assertPrivate(run);assertPrivate(dirname(run));
const m=verifyFreeze(ROOT,run);
for(const [file,expected] of [['model.json',m.model_sha256],['worker.bundle.mjs',m.worker_bundle_sha256],['offline-checks.json',m.offline_checks_sha256],['isolation-preflight.json',m.isolation_preflight_sha256]])if(sha(readFileSync(join(run,file)))!==expected)throw new Error(`Frozen runtime artifact changed: ${file}`);
if(JSON.stringify(runtime(ROOT).metadata)!==JSON.stringify(m.runtime)||sha(JSON.stringify(safeModel(cfg)))!==sha(JSON.stringify(json(join(run,'model.json'))))||dependencies().tree_sha256!==m.dependencies.tree_sha256)throw new Error('Runtime/model/dependency drift; do not launch');
if(sha(readFileSync(join(run,'references/archive-index.json')))!==m.api_references.archive_index_sha256)throw new Error('Reference archive index changed');
for(const record of m.api_references.records)if(sha(readFileSync(join(run,'references',record.path)))!==record.sha256)throw new Error('Reference archive body changed');
if(mode==='--verify'){console.log('FREEZE_VERIFIED_NO_PROVIDER_CALLS',run);process.exit(0);}
if(rest[0]!=='--approval'||rest.length!==2)throw new Error('Explicit spending approval file required');
const approval=json(resolve(rest[1]));
authorize(approval,sha(readFileSync(join(run,'manifest.json'))),cfg);
if(existsSync(join(run,'launch.json'))||existsSync(join(run,'executions')))throw new Error('Campaign already started; no replay/resubmission');
// Claim globally, not per campaign or DOCS_CHECK_RUN_ROOT. Never delete automatically.
// A consumed claim blocks other freezes and crashes, even before first provider call.
mkdirSync(defaultParent,{recursive:true,mode:0o700});
const claim=join(defaultParent,'docs-check-full-first-pass-consumed.json');
const auth=credentials(); // only after full spending gate; does not launch an agent session
saveNew(claim,{phase:'full-first-pass',run,manifest_sha256:sha(readFileSync(join(run,'manifest.json'))),utc:new Date().toISOString(),nonce:randomBytes(24).toString('hex'),executions:96,attempts:1});
const resolvedConfig={...cfg,spending:approval.spending,authorization:{full_run_approved:true,extra_executions_approved:false}};
const executionConfigHash=sha(JSON.stringify(resolvedConfig));
saveNew(join(run,'launch.json'),{utc:new Date().toISOString(),approval,claim_path:claim,manifest_sha256:sha(readFileSync(join(run,'manifest.json'))),resolved_config:resolvedConfig,execution_config_hash:executionConfigHash});
const schedule=readFileSync(join(run,'schedule.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
await executeCampaign({root:ROOT,run,manifest:{...m,execution_config_hash:executionConfigHash},schedule,rt:runtime(ROOT),model:json(join(run,'model.json')),bundle:readFileSync(join(run,'worker.bundle.mjs')),auth});
