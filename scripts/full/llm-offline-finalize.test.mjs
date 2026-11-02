import test from 'node:test';
import assert from 'node:assert/strict';
import {deduplicateExactCriteria} from './llm-offline-finalize.mjs';
import {validateJudgment} from './llm-judge-core.mjs';
const p={anonymous_id:'A0001',answer:'Correct answer',retained_evidence:'Support',reference:{criteria:[{id:'c1'}],evidence:[{id:'e1',quote:'Support'}]}};
const c=()=>({id:'c1',score:1,quote:'Correct',rationale:'Complete',evidence_refs:['e1'],retained_support:'unknown'});
const j=()=>({anonymous_id:'A0001',criteria:[c()],version:{status:'exact',compliant:true,rationale:'Scope met'},extra_claims:[],reference_concerns:[]});
test('exact duplicate removal is idempotent, non-mutating and changes no criterion values',()=>{
 const raw=j();raw.criteria.push(structuredClone(raw.criteria[0]));const before=structuredClone(raw);
 assert.throws(()=>validateJudgment(raw,p),/Criterion set mismatch/);
 const normalized=deduplicateExactCriteria(raw);assert.equal(normalized.removed.length,1);assert.deepEqual(normalized.judgment,j());
 validateJudgment(normalized.judgment,p);assert.deepEqual(raw,before);
 assert.deepEqual(deduplicateExactCriteria(normalized.judgment),{judgment:j(),removed:[]});
});
test('key ordering only is immaterial; conflicting score, quote, rationale and refs cannot be selected away',()=>{
 const raw=j();raw.criteria.push(Object.fromEntries(Object.entries(c()).reverse()));validateJudgment(deduplicateExactCriteria(raw).judgment,p);
 for(const [key,value] of [['score',0],['quote','answer'],['rationale','Different'],['evidence_refs',['e2']],['retained_support','absent']]){
  const raw=j();raw.criteria.push({...c(),[key]:value});assert.throws(()=>deduplicateExactCriteria(raw),/Non-identical duplicate/);
 }
});
test('unknown criterion, missing criterion, invented quote and invalid score remain invalid',()=>{
 for(const alter of [raw=>raw.criteria.push({...c(),id:'c3'}),raw=>raw.criteria=[],raw=>raw.criteria[0].quote='invented',raw=>raw.criteria[0].score=.2]){
  const raw=j();alter(raw);assert.throws(()=>validateJudgment(deduplicateExactCriteria(raw).judgment,p));
 }
});
