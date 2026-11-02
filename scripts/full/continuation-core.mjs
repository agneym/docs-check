// Controller-only append-only continuation. It cannot schedule another attempt.
import {readFileSync,readdirSync,existsSync,mkdirSync,writeFileSync,realpathSync} from 'node:fs';
import {join,isAbsolute,dirname} from 'node:path';
import {homedir} from 'node:os';
import {sha,json,validateConfig,makeSchedule,inputPaths,authorize} from './control.mjs';

export const GLOBAL_CLAIM=join(homedir(),'random/docs-check-runs/docs-check-full-first-pass-consumed.json');
const mutableOriginal=new Set(['README.md','evaluation/PROTOCOL.md','evaluation/full-preparation.md','scripts/full/README.md','scripts/full/API-CONTRACT.md','scripts/full/JUDGING.md','scripts/full/runtime.mjs','scripts/full/runtime.test.mjs','scripts/full/scoring.py','scripts/full/test_scoring.py']);
export const readSchedule=run=>readFileSync(join(run,'schedule.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
function safePath(path){if(isAbsolute(path)||path.split('/').includes('..'))throw new Error('Unsafe archive path');return path;}
export function dependencies(root) {
 const files={};
 function walk(dir){for(const f of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=join(dir,f.name);if(f.isDirectory())walk(p);else if(f.isFile())files[p.slice(root.length+1)]=sha(readFileSync(p));}}
 walk(join(root,'scripts/pilot/node_modules'));
 return {tree_sha256:sha(JSON.stringify(files)),files:Object.keys(files).length};
}
export function inspectOrigin(root,original,{claimPath=GLOBAL_CLAIM}={}) {
 original=realpathSync(original);
 const manifestBytes=readFileSync(join(original,'manifest.json')),m=JSON.parse(manifestBytes),digest=sha(manifestBytes);
 if(readFileSync(join(original,'freeze.sha256'),'utf8').trim()!==digest||m.phase!=='full-first-pass')throw new Error('Invalid original freeze');
 validateConfig(m.config);
 if(m.config_hash!==sha(JSON.stringify(m.config)))throw new Error('Original config hash changed');
 const changes=[];
 for(const [path,hash] of Object.entries(m.hashes)) {
  safePath(path);
  if(path==='schedule.jsonl'){if(sha(readFileSync(join(original,path)))!==hash)throw new Error('Original schedule changed');continue;}
  if(sha(readFileSync(join(original,'frozen',path)))!==hash)throw new Error(`Original frozen archive changed: ${path}`);
  const current=sha(readFileSync(join(root,path)));
  if(current!==hash){if(!mutableOriginal.has(path))throw new Error(`Unapproved contestant/input/code change: ${path}`);changes.push({path,original_sha256:hash,continuation_sha256:current});}
 }
 if(JSON.stringify(json(join(root,'evaluation/full-config.json')))!==JSON.stringify(m.config))throw new Error('Settings changed');
 const questions=readFileSync(join(root,'evaluation/questions.jsonl'),'utf8').trim().split('\n').map(JSON.parse),schedule=readSchedule(original);
 if(JSON.stringify(schedule)!==JSON.stringify(makeSchedule(questions,m.config)))throw new Error('Original seeded schedule changed');
 const launch=json(join(original,'launch.json'));
 if(launch.manifest_sha256!==digest)throw new Error('Original launch manifest mismatch');
 authorize(launch.approval,digest,m.config);
 const resolved={...m.config,spending:launch.approval.spending,authorization:{full_run_approved:true,extra_executions_approved:false}};
 if(JSON.stringify(resolved)!==JSON.stringify(launch.resolved_config)||sha(JSON.stringify(resolved))!==launch.execution_config_hash)throw new Error('Original resolved execution settings changed');
 const claim=json(claimPath);
 if(realpathSync(claim.run)!==original||claim.manifest_sha256!==digest||claim.executions!==96||claim.attempts!==1)throw new Error('Original consumed claim mismatch');
 if(json(join(original,'campaign-terminal.json')).status!=='paused')throw new Error('Original is not a paused campaign');
 const outcomes={},remaining=[],retained=[];
 for(const row of schedule){
  const path=join(original,'executions',row.execution_id,'outcome.json'),bytes=readFileSync(path),o=JSON.parse(bytes);outcomes[row.execution_id]=sha(bytes);
  if(o.execution_id!==row.execution_id||o.question_id!==row.question_id||o.workflow!==row.workflow||o.repeat!==1||o.config_hash!==launch.execution_config_hash)throw new Error('Original outcome identity/config mismatch');
  if(o.status==='not_run'){
   if(['public-request.json','events.jsonl','answer.json','evidence.json','task-created.json','task-created-host.json','raw'].some(p=>existsSync(join(original,'executions',row.execution_id,p))))throw new Error('An allegedly unrun entry has attempt artifacts');
   remaining.push(row);
  }else retained.push(row);
 }
 if(remaining.length!==95||retained.length!==1||retained[0].execution_id!==schedule[0].execution_id)throw new Error('This incident continuation permits exactly the 95 previously unrun entries');
 const failed=json(join(original,'executions',retained[0].execution_id,'outcome.json'));
 if(failed.status!=='failed'||failed.phase!=='setup'||failed.run_id!==null)throw new Error('First setup failure must be retained unchanged');
 for(const [file,hash] of [['model.json',m.model_sha256],['worker.bundle.mjs',m.worker_bundle_sha256],['offline-checks.json',m.offline_checks_sha256],['isolation-preflight.json',m.isolation_preflight_sha256]])if(sha(readFileSync(join(original,file)))!==hash)throw new Error(`Original ${file} changed`);
 if(sha(readFileSync(join(original,'references/archive-index.json')))!==m.api_references?.archive_index_sha256)throw new Error('Original reference index changed');
 for(const record of m.api_references.records)if(sha(readFileSync(join(original,'references',safePath(record.path))))!==record.sha256)throw new Error('Original reference body changed');
 return {manifest:m,launch,schedule,remaining,retained,changes,origin:{run:original,manifest_sha256:digest,launch_sha256:sha(readFileSync(join(original,'launch.json'))),claim_path:claimPath,claim_sha256:sha(readFileSync(claimPath)),schedule_sha256:sha(readFileSync(join(original,'schedule.jsonl'))),terminal_sha256:sha(readFileSync(join(original,'campaign-terminal.json'))),outcomes}};
}
export function verifyContinuation(root,run,options={}) {
 const bytes=readFileSync(join(run,'manifest.json')),m=JSON.parse(bytes);
 if(sha(bytes)!==readFileSync(join(run,'freeze.sha256'),'utf8').trim()||m.phase!=='full-first-pass-continuation'||m.executions!==95||m.repeat!==1)throw new Error('Invalid continuation freeze');
 validateConfig(m.config);
 const current=inspectOrigin(root,m.origin.run,options);
 if(JSON.stringify(current.origin)!==JSON.stringify(m.origin)||JSON.stringify(current.manifest.config)!==JSON.stringify(m.config)||m.config_hash!==sha(JSON.stringify(m.config)))throw new Error('Original archive, outcomes or settings changed since continuation freeze');
 for(const path of inputPaths(root))if(!m.hashes[path])throw new Error(`Unfrozen continuation file: ${path}`);
 for(const [path,hash] of Object.entries(m.hashes)){
  safePath(path);
  if(path==='schedule.jsonl'){if(sha(readFileSync(join(run,path)))!==hash)throw new Error('Continuation schedule changed');continue;}
  if(sha(readFileSync(join(root,path)))!==hash||sha(readFileSync(join(run,'frozen',path)))!==hash)throw new Error(`Continuation code/input changed: ${path}`);
 }
 if(JSON.stringify(readSchedule(run))!==JSON.stringify(current.remaining))throw new Error('Continuation is not exactly the unrun original schedule in original order');
 for(const [file,hash] of [['model.json',current.manifest.model_sha256],['worker.bundle.mjs',current.manifest.worker_bundle_sha256],['offline-checks.json',m.offline_checks_sha256],['isolation-preflight.json',m.isolation_preflight_sha256]])if(sha(readFileSync(join(run,file)))!==hash)throw new Error(`Frozen continuation runtime artifact changed: ${file}`);
 if(m.isolation_preflight_audit_sha256&&sha(readFileSync(join(run,'isolation-preflight-audit.jsonl')))!==m.isolation_preflight_audit_sha256)throw new Error('Preflight audit changed');
 if(m.execution_config_hash!==current.launch.execution_config_hash||JSON.stringify(m.runtime)!==JSON.stringify(current.manifest.runtime)||JSON.stringify(m.dependencies)!==JSON.stringify(current.manifest.dependencies))throw new Error('Continuation changed answering/runtime settings');
 return {manifest:m,current};
}
export function authorizeContinuation(a,digest,m) {
 if(a?.phase!=='full-first-pass-continuation'||a.manifest_sha256!==digest||a.original_manifest_sha256!==m.origin.manifest_sha256||a.executions!==95||a.attempts!==1||a.approved!==true||a.preserve_failed_entries!==true||a.extra_executions_approved!==false||a.automatic_topups!==false||typeof a.approved_by!=='string'||!a.approved_by.trim()||typeof a.user_authorization!=='string'||!a.user_authorization.trim())throw new Error('Explicit incident approval for only the 95 unrun entries required');
 if(a.spending?.policy!=='uncapped-explicitly-approved'||a.spending.cap!==null||a.spending.automatic_topups!==false)throw new Error('Continuation must keep the explicitly approved uncapped/no-topup policy');
 return true;
}
export function copyExact(source,target){mkdirSync(dirname(target),{recursive:true,mode:0o700});writeFileSync(target,readFileSync(source),{flag:'wx',mode:0o400});}
