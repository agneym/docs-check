// Second incident continuation: exactly the 88 untouched rows, never a rerun.
import {readFileSync,existsSync,realpathSync} from 'node:fs';
import {join,isAbsolute} from 'node:path';
import {spawnSync} from 'node:child_process';
import {sha,json,validateConfig,makeSchedule,inputPaths} from './control.mjs';
import {readSchedule} from './continuation-core.mjs';
const amended=new Set(['README.md','evaluation/PROTOCOL.md','evaluation/full-preparation.md','scripts/full/README.md','scripts/full/CONTINUATION.md','scripts/full/API-CONTRACT.md','scripts/full/JUDGING.md','scripts/full/runtime.mjs','scripts/full/runtime.test.mjs','scripts/full/transport.mjs','scripts/full/transport.test.mjs','scripts/full/evidence.mjs','scripts/full/evidence.test.mjs','scripts/full/assemble.py','scripts/full/operations.py','scripts/full/test_operations.py','scripts/full/scoring.py','scripts/full/test_scoring.py']);
function safe(path){if(isAbsolute(path)||path.split('/').includes('..'))throw new Error('Unsafe frozen path');return path;}
export function selectRemaining(s) {
 if(s.view_kind!=='first-continuation-view')throw new Error('This continuation requires the first partial view');
 validateConfig(s.manifest.config);
 if(s.schedule.length!==96||new Set(s.schedule.map(r=>r.execution_id)).size!==96)throw new Error('Expected the original 96-entry schedule');
 const remaining=[],retained=[],counts={};
 for(const [i,row] of s.schedule.entries()){
  const record=s.outcomes[row.execution_id],o=record?.outcome;
  if(!o||o.execution_id!==row.execution_id||o.question_id!==row.question_id||o.workflow!==row.workflow||o.repeat!==1||o.config_hash!==s.launch.execution_config_hash||record.sha256!==s.base_view.outcomes[row.execution_id])throw new Error('Base outcome identity/config/hash mismatch');
  counts[o.status]=(counts[o.status]??0)+1;
  if(o.status==='not_run'){if(i<8)throw new Error('Expected only the final 88 entries unrun');remaining.push(row);}else{if(i>=8)throw new Error('Previously attempted entry in approved remainder');retained.push({...row,status:o.status,outcome_sha256:record.sha256});}
 }
 if(counts.completed!==2||counts.failed!==6||counts.not_run!==88||remaining.length!==88||retained.length!==8)throw new Error('Approved base must retain two completions and all six failures, with only 88 unrun');
 if(JSON.stringify(remaining)!==JSON.stringify(s.schedule.slice(8)))throw new Error('Remainder order changed');
 return {remaining,retained};
}
export function inspectBase(root,view) {
 view=realpathSync(view);
 const result=spawnSync('python3',[join(root,'scripts/full/base_snapshot.py'),view],{cwd:root,encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},timeout:60000,maxBuffer:8*1024*1024});
 if(result.status!==0)throw new Error(`Base view integrity check failed: ${result.stderr.slice(0,3000)}`);
 const s=JSON.parse(result.stdout),selection=selectRemaining(s),cfg=s.manifest.config;
 if(JSON.stringify(json(join(root,'evaluation/full-config.json')))!==JSON.stringify(cfg))throw new Error('Original workflow settings changed');
 const questions=readFileSync(join(root,'evaluation/questions.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 if(JSON.stringify(makeSchedule(questions,cfg))!==JSON.stringify(s.schedule))throw new Error('Original seeded schedule changed');
 const changes=[];
 for(const [path,oldHash] of Object.entries(s.first_continuation_manifest.hashes)){
  if(path==='schedule.jsonl')continue;safe(path);
  const current=sha(readFileSync(join(root,path)));
  if(current!==oldHash){if(!amended.has(path))throw new Error(`Unapproved input/contestant change: ${path}`);changes.push({path,previous_sha256:oldHash,new_sha256:current});}
 }
 if(s.base_view.run!==view||s.base_view.manifest_sha256!==sha(readFileSync(join(view,'manifest.json')))||s.launch.manifest_sha256!==s.base_view.manifest_sha256)throw new Error('Base identity mismatch');
 if(sha(JSON.stringify(s.launch.resolved_config))!==s.launch.execution_config_hash)throw new Error('Resolved settings hash mismatch');
 return {...s,...selection,changes};
}
export function verifyRemainder(root,run) {
 const bytes=readFileSync(join(run,'manifest.json')),m=JSON.parse(bytes);
 if(m.phase!=='full-first-pass-continuation-2'||m.executions!==88||m.repeat!==1||sha(bytes)!==readFileSync(join(run,'freeze.sha256'),'utf8').trim())throw new Error('Invalid 88-entry freeze');
 const base=inspectBase(root,m.base_view.run);
 if(JSON.stringify(base.base_view)!==JSON.stringify(m.base_view)||JSON.stringify(base.manifest.config)!==JSON.stringify(m.config)||m.config_hash!==sha(JSON.stringify(m.config)))throw new Error('Base or original configuration changed');
 if(JSON.stringify(readSchedule(run))!==JSON.stringify(base.remaining))throw new Error('Not exactly the original 88 unrun entries in order');
 if(JSON.stringify(m.retained_entries)!==JSON.stringify(base.retained))throw new Error('Retained eight-outcome metadata changed');
 const sensitivity={primary_includes_all_failed_zeros:true,infrastructure_affected_question_ids:[...new Set(base.retained.filter(row=>row.status==='failed').map(row=>row.question_id))].sort(),paired_exclusion_diagnostic_only:true};
 if(JSON.stringify(m.sensitivity_plan)!==JSON.stringify(sensitivity))throw new Error('Predeclared infrastructure diagnostic changed');
 for(const p of inputPaths(root))if(!m.hashes[p])throw new Error(`Unfrozen file: ${p}`);
 for(const [p,digest] of Object.entries(m.hashes)){
  safe(p);
  if(p==='schedule.jsonl'){if(sha(readFileSync(join(run,p)))!==digest)throw new Error('Remainder schedule changed');continue;}
  if(sha(readFileSync(join(root,p)))!==digest||sha(readFileSync(join(run,'frozen',p)))!==digest)throw new Error(`Frozen implementation/input changed: ${p}`);
 }
 for(const [p,field] of [['model.json','model_sha256'],['worker.bundle.mjs','worker_bundle_sha256'],['offline-checks.json','offline_checks_sha256'],['isolation-preflight.json','isolation_preflight_sha256'],['isolation-preflight-audit.jsonl','isolation_preflight_audit_sha256'],['incident-report.md','incident_report_sha256']])if(sha(readFileSync(join(run,p)))!==m[field])throw new Error(`Frozen runtime file changed: ${p}`);
 if(m.execution_config_hash!==base.launch.execution_config_hash||JSON.stringify(m.runtime)!==JSON.stringify(base.manifest.runtime)||JSON.stringify(m.dependencies)!==JSON.stringify(base.manifest.dependencies)||m.model_sha256!==base.manifest.model_sha256||m.worker_bundle_sha256===base.first_continuation_manifest.worker_bundle_sha256)throw new Error('Settings drift or missing parser correction bundle');
 return {manifest:m,base};
}
export function authorizeRemainder(a,digest,m) {
 if(a?.phase!=='full-first-pass-continuation-2'||a.manifest_sha256!==digest||a.base_provenance_sha256!==m.base_view.provenance_sha256||a.executions!==88||a.attempts!==1||a.approved!==true||a.preserve_previous_entries!==true||a.extra_executions_approved!==false||a.automatic_topups!==false||typeof a.approved_by!=='string'||!a.approved_by.trim()||typeof a.user_authorization!=='string'||!a.user_authorization.trim())throw new Error('Explicit approval for only the 88 unrun entries, retaining all prior outcomes, required');
 if(a.spending?.policy!=='uncapped-explicitly-approved'||a.spending.cap!==null||a.spending.automatic_topups!==false)throw new Error('Keep approved uncapped/no-topup terms');
 return true;
}
