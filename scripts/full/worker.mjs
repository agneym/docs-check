// Runs only inside a fresh Gondolin VM. Never import coding-agent/session APIs.
import {readFileSync} from 'node:fs';
import {normalizeContext} from '../pilot/node_modules/@earendil-works/pi-ai/dist/utils/transcript.js';
import {stream} from '../pilot/node_modules/@earendil-works/pi-ai/dist/api/openai-codex-responses.js';
import {createTransport,classify} from './transport.mjs';
import {normalizeEvidence} from './evidence.mjs';
import {RETRIEVAL,ANSWERING,PLAN_LIBRARIES,PLAN_QUERIES,publicText,parsePlan,validateLibraries,validateQueries,validateFindings,encoding} from '../pilot/core.mjs';

const emit=(event,data={})=>console.log(JSON.stringify({event,utc:new Date().toISOString(),...data}));
const input=JSON.parse(readFileSync('/input/request.json','utf8'));
const question=publicText(input.public_request);
const settings={retrieval_ms:300000,answer_ms:60000,total_ms:360000,evidence_proxy_tokens:12000,...input.settings};
const start=performance.now(), retrievalDeadline=start+settings.retrieval_ms, endDeadline=start+settings.total_ms;
const transport=createTransport({emit});
let taskId=null,taskComplete=false,answerStart=null,retrieval_ms=null;
if(input.workflow==='parallel' && (input.processor!=='core-fast'||input.task_spec?.output_schema?.type!=='json')) throw new Error('Require core-fast and explicit JSON Task schema');
let phase='retrieval';
const usage=[];

async function llm(systemPrompt,user,deadline,label) {
  const context=normalizeContext({systemPrompt,messages:[{role:'user',content:user,timestamp:Date.now()}],tools:[]});
  emit('model_context',{label,context});
  let count=0,partial='',modelHttpStatus=null;
  const ac=new AbortController();
  deadline=Math.min(deadline,endDeadline,performance.now()+60000);
  return transport.within(async signal=>{
  const s=stream(input.model,context,{
    apiKey:process.env.CODEX_TOKEN,reasoningEffort:'medium',transport:'sse',cacheRetention:'none',maxRetries:0,maxRetryDelayMs:10000,
    // Client retry catch is broad enough to retry auth: use bounded transient-only fetch.
    fetch:(url,options)=>transport.modelFetch(url,options,deadline),
    signal:AbortSignal.any([signal,ac.signal]),timeoutMs:60000,toolChoice:'none',textVerbosity:'medium',
    onResponse:response=>{modelHttpStatus=response.status;},
    onPayload:body=>{emit('model_payload',{label,payload:body});},
    onProviderStreamEvent:data=>{if(data.type==='response.completed'||data.type==='response.failed')emit('model_provider_terminal',{label,data});},
  });
  for await (const event of s) {
    emit('model_event',{label,data:event});
    if(event.type==='text_delta') {
      partial+=event.delta;
      if(++count%16===0 && encoding().encode(partial).length>4096) ac.abort();
    }
  }
  const result=await s.result();
  usage.push({phase:label,usage:result.usage});
  emit('model_result',{label,result});
  if(result.stopReason!=='stop') throw new Error(`${label}: HTTP ${modelHttpStatus??'unknown'}: ${result.stopReason}: ${result.errorMessage??'incomplete output'}`);
  const text=result.content.filter(x=>x.type==='text').map(x=>x.text).join('\n');
  if(encoding().encode(text).length>4096) throw new Error(`${label}: local output token cap exceeded`);
  return {text,result};
  },deadline);
}
const api=(url,options={})=>transport.api(url,{...options,deadline:Math.min(retrievalDeadline,endDeadline)});
async function parallel() {
  const headers={'x-api-key':process.env.PARALLEL_KEY};
  const task=await api('https://api.parallel.ai/v1/tasks/runs',{method:'POST',headers,body:{input:`${RETRIEVAL}\n\n${question}`,processor:input.processor,task_spec:input.task_spec,memory_scope_key:input.memory_scope_key}});
  if(typeof task.run_id!=='string') throw new Error('Task creation returned no run_id');
  taskId=task.run_id;
  emit('task_created',{run_id:task.run_id,memory_scope_key:input.memory_scope_key});
  while(performance.now()<retrievalDeadline) {
    const state=await api(`https://api.parallel.ai/v1/tasks/runs/${encodeURIComponent(task.run_id)}`,{headers});
    emit('task_status',{run_id:task.run_id,status:state.status});
    if(['failed','cancelled','action_required'].includes(state.status)) throw new Error(`Task terminal status: ${state.status}`);
    if(state.status==='completed') {
      const result=await api(`https://api.parallel.ai/v1/tasks/runs/${encodeURIComponent(task.run_id)}/result`,{headers});
      if(result.pending) {await transport.wait(5000,Math.min(retrievalDeadline,endDeadline));continue;}
      let content=result.output?.content;
      if(typeof content==='string') content=JSON.parse(content);
      validateFindings(content,input.task_spec);
      taskComplete=true;
      emit('parallel_result',{result});
      return {findings:content,basis:result.output?.basis??result.basis??[]};
    }
    await transport.wait(Math.min(5000,Math.max(0,retrievalDeadline-performance.now())),Math.min(retrievalDeadline,endDeadline));
  }
  throw new Error('Retrieval deadline exceeded (task may still be running)');
}
async function context7() {
  const headers={'X-Context7-Source':'cli','X-Context7-Client-IDE':'ctx7-cli','X-Context7-Client-Version':'0.8.2','X-Context7-Transport':'cli'};
  if(process.env.CONTEXT7_TOKEN) headers.authorization=`Bearer ${process.env.CONTEXT7_TOKEN}`;
  const plan=validateLibraries(parsePlan((await llm(PLAN_LIBRARIES,question,retrievalDeadline,'library_planning')).text));
  emit('library_plan',{plan});
  const candidates=[];
  for(const lib of plan) {
    const params=new URLSearchParams({libraryName:lib.name,query:lib.query});
    const response=await api(`https://context7.com/api/v2/libs/search?${params}`,{headers});
    candidates.push({requested:lib,response});
  }
  const selection=parsePlan((await llm(PLAN_QUERIES,JSON.stringify({public_request:input.public_request,candidates}),retrievalDeadline,'query_selection')).text);
  const queries=validateQueries(selection,candidates);
  emit('query_plan',{selection});
  const documents=[];
  for(const query of queries) {
    const params=new URLSearchParams(query);
    documents.push({query,result:await api(`https://context7.com/api/v2/context?${params}`,{headers})});
  }
  return {version_notes:selection.version_notes,documents};
}

try {
  emit('started',{workflow:input.workflow});
  if(!['parallel','context7'].includes(input.workflow)) throw new Error('Unknown workflow');
  const evidence=input.workflow==='parallel'?await parallel():await context7();
  const normalized=normalizeEvidence(input.workflow,evidence,settings.evidence_proxy_tokens);
  emit('evidence',{packet:normalized});
  retrieval_ms=performance.now()-start;
  if(performance.now()>=Math.min(retrievalDeadline,endDeadline)) throw new Error('Retrieval deadline exceeded during normalization');
  phase='answering';
  answerStart=performance.now();
  const answer=await llm(ANSWERING,`REQUEST\n${question}\n\nDOCUMENTATION EVIDENCE\n${normalized.text||'[No documentation evidence returned]'}`,Math.min(endDeadline,answerStart+settings.answer_ms),'answering');
  emit('answer',{text:answer.text,usage:answer.result.usage,response_id:answer.result.responseId,finish_reason:answer.result.stopReason});
  emit('outcome',{status:'completed',pause_required:false,error_classification:null,run_id:taskId,outstanding_task:null,retrieval_ms,answer_ms:performance.now()-answerStart,total_ms:performance.now()-start,model_usage:usage,provider_charge:null,accounting_status:'unavailable; model usage includes catalog estimates, not actual subscription charges'});
} catch(err) {
  emit('outcome',{status:'failed',phase,...classify(err),error:String(err),ambiguous_submission:err.ambiguous_submission??false,run_id:taskId,outstanding_task:taskId&&!taskComplete?taskId:null,retrieval_ms:retrieval_ms??performance.now()-start,answer_ms:answerStart===null?null:performance.now()-answerStart,total_ms:performance.now()-start,model_usage:usage,provider_charge:null,accounting_status:'unavailable; timeout does not establish server cancellation'});
  process.exitCode=1;
}
