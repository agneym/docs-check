import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeContext} from '../pilot/node_modules/@earendil-works/pi-ai/dist/index.js';
import {stream} from '../pilot/node_modules/@earendil-works/pi-ai/dist/api/openai-codex-responses.js';
import {validateJudgment,validateApproval,needsAdjudication,auditPayload,pool,prompt} from './llm-judge-core.mjs';
const packet={anonymous_id:'A0001',answer:'Correct answer.',retained_evidence:'Official support.',reference:{criteria:[{id:'c1',weight:1}],evidence:[{id:'e1',quote:'Official support.'}]}};
const judgment=()=>({anonymous_id:'A0001',criteria:[{id:'c1',score:1,quote:'Correct',rationale:'Substantive support.',evidence_refs:['e1'],retained_support:'consistent_with_reference',retained_quote:'Official support'}],extra_claims:[],version:{status:'unsupported',compliant:true,rationale:'Honest version caveat.'},reference_concerns:[]});
test('strict valid schema and literal quotations',()=>{
 assert.equal(validateJudgment(judgment(),packet).criteria[0].score,1);
 for(const [field,value] of [['score',true],['score',0.2],['quote','Invented'],['retained_quote','Invented'],['evidence_refs',['unknown']]]){
  const j=judgment();j.criteria[0][field]=value;assert.throws(()=>validateJudgment(j,packet));
 }
 const j=judgment();j.criteria[0].omission='Missing';assert.throws(()=>validateJudgment(j,packet));
 const dup=judgment();dup.criteria.push({...dup.criteria[0]});assert.throws(()=>validateJudgment(dup,packet));
 const spoof=judgment();spoof.judge_type='human';assert.throws(()=>validateJudgment(spoof,packet));
 const extra=judgment();extra.unexpected='field';assert.throws(()=>validateJudgment(extra,packet));
});
test('empty answer cannot earn credit; omissions allowed',()=>{
 const p={...packet,answer:''},j=judgment();delete j.criteria[0].quote;j.criteria[0].omission='No answer';
 assert.throws(()=>validateJudgment(j,p));j.criteria[0].score=0;validateJudgment(j,p);
});
test('extra claims need source proof, not model recollection',()=>{
 const j=judgment();j.extra_claims=[{quote:'Correct',verdict:'incorrect',severity:'major',rationale:'Contradicted.',evidence_refs:['e1']}];
 assert.throws(()=>validateJudgment(j,packet));
 j.extra_claims[0].reference_quote='Official support';validateJudgment(j,packet);
 j.extra_claims[0].reference_quote='Invented';assert.throws(()=>validateJudgment(j,packet));
 j.extra_claims[0]={quote:'Correct',verdict:'unverifiable',severity:'minor',rationale:'Outside supplied excerpts.',evidence_refs:[]};validateJudgment(j,packet);
});
test('adjudication uses decisions, not prose differences',()=>{
 const a=judgment(),b=judgment();b.criteria[0].rationale='Different wording';b.criteria[0].quote='answer';
 assert.equal(needsAdjudication(a,b),false);
 b.criteria[0].score=.5;assert.equal(needsAdjudication(a,b),true);
 for(const alter of [j=>j.version.compliant=false,j=>j.version.status='drift',j=>j.reference_concerns.push('Possible ambiguity'),j=>j.criteria[0].retained_support='unknown']){
  const j=judgment();alter(j);assert.equal(needsAdjudication(a,j),true);
 }
 const j=judgment();j.extra_claims.push({quote:'Correct',verdict:'unverifiable',severity:'major'});assert.equal(needsAdjudication(j,j),true);
});
test('pool bounded concurrency; on failure drain without new dispatch',async()=>{
 let active=0,max=0,started=[];
 await assert.rejects(pool([0,1,2,3,4],2,async n=>{started.push(n);active++;max=Math.max(active,max);await new Promise(r=>setTimeout(r,n===0?5:20));active--;if(n===0)throw Error('fixture');}));
 assert.equal(max,2);assert.equal(active,0);assert.deepEqual(started,[0,1]);
});
test('real pinned SDK payload tested offline before any fetch',async()=>{
 const model={id:'gpt-6.1-terra',provider:'openai-codex',api:'openai-codex-responses',baseUrl:'https://chatgpt.com/backend-api/codex',reasoning:true,thinkingLevelMap:{medium:'medium'},cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:200000,maxTokens:10000,input:['text']};
 const token=['e30',Buffer.from(JSON.stringify({'https://api.openai.com/auth':{chatgpt_account_id:'fake'}})).toString('base64url'),'signature'].join('.');
 const user=JSON.stringify({packet});let audited=0,fetches=0;
 const s=stream(model,normalizeContext({systemPrompt:prompt,messages:[{role:'user',content:user,timestamp:0}],tools:[]}),{
  apiKey:token,reasoningEffort:'medium',transport:'sse',cacheRetention:'none',toolChoice:'none',maxRetries:0,
  onPayload:payload=>{auditPayload(payload,model,prompt,user);audited++;throw Error('OFFLINE_STOP_BEFORE_FETCH');},
  fetch:()=>{fetches++;throw Error('Network forbidden');},
 });
 const result=await s.result();assert.equal(result.stopReason,'error');assert.match(result.errorMessage,/OFFLINE_STOP_BEFORE_FETCH/);assert.equal(audited,1);assert.equal(fetches,0);
});
test('approval binds freeze and explicitly bounded uncapped judging only',()=>{
 const a={phase:'full-first-pass-llm-judging-v1',manifest_sha256:'frozen',approved:true,approved_by:'user',spending:{policy:'uncapped-explicitly-approved',cap:null},initial_calls:192,max_adjudications:96,retries:0,benchmark_reruns:false,automatic_topups:false,user_authorization:'no spending cap.'};
 validateApproval(a,'frozen');
 for(const [field,value] of [['manifest_sha256','wrong'],['approved',false],['initial_calls',193],['max_adjudications',97],['retries',1],['benchmark_reruns',true],['automatic_topups',true],['user_authorization','']]){
  assert.throws(()=>validateApproval({...a,[field]:value},'frozen'));
 }
 assert.throws(()=>validateApproval({...a,spending:{policy:'capped',cap:10}},'frozen'));
});
test('pinned SDK SSE success and 429 do not retry, all offline',async()=>{
 const model={id:'gpt-6.1-terra',provider:'openai-codex',api:'openai-codex-responses',baseUrl:'https://chatgpt.com/backend-api/codex',reasoning:true,thinkingLevelMap:{medium:'medium'},cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:200000,maxTokens:10000,input:['text']};
 const token=['e30',Buffer.from(JSON.stringify({'https://api.openai.com/auth':{chatgpt_account_id:'fake'}})).toString('base64url'),'signature'].join('.');
 for(const fail of [false,true]) {
  let fetches=0,audited=0;
  const user=JSON.stringify({packet}),j=judgment();
  const item={id:'msg_fixture',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(j),annotations:[]}]};
  const events=[{type:'response.created',response:{id:'resp_fixture'}},{type:'response.output_item.added',output_index:0,item:{...item,content:[]}},{type:'response.output_item.done',output_index:0,item},{type:'response.completed',response:{id:'resp_fixture',status:'completed',output:[item],usage:{input_tokens:10,output_tokens:4,total_tokens:14,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:0}}}}];
  const s=stream(model,normalizeContext({systemPrompt:prompt,messages:[{role:'user',content:user,timestamp:0}],tools:[]}),{
   apiKey:token,reasoningEffort:'medium',transport:'sse',cacheRetention:'none',toolChoice:'none',maxRetries:0,
   onPayload:p=>{auditPayload(p,model,prompt,user);audited++;},
   fetch:async()=>{fetches++;return fail?new Response('{"error":{"message":"Fixture quota"}}',{status:429}):new Response(events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});},
  });
  const result=await s.result();assert.equal(fetches,1);assert.equal(audited,1);
  assert.equal(result.stopReason,fail?'error':'stop');
  if(!fail)validateJudgment(JSON.parse(result.content.filter(b=>b.type==='text').map(b=>b.text).join('\n')),packet);
 }
});
test('payload audit blocks history, tools, model changes and leaked metadata',()=>{
 const m={id:'gpt-6.1-terra'},p={model:m.id,reasoning:{effort:'medium'},store:false,tool_choice:'none',instructions:'judge',input:[{role:'user',content:[{type:'input_text',text:'packet'}]}]};
 auditPayload(p,m,'judge','packet');
 for(const change of [p=>p.store=true,p=>p.tools=[{name:'shell'}],p=>p.model='other',p=>p.input.push({role:'assistant'}),p=>p.previous_response_id='old',p=>p.prompt_cache_key='shared',p=>p.input[0].content[0].text='map and costs']){
  const q=structuredClone(p);change(q);assert.throws(()=>auditPayload(q,m,'judge','packet'));
 }
});
