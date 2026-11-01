// Runs only inside a fresh Gondolin VM. Never import coding-agent/session APIs.
import {readFileSync} from 'node:fs';
import {normalizeContext} from '@earendil-works/pi-ai';
import {stream} from '@earendil-works/pi-ai/api/openai-codex-responses';
import {RETRIEVAL,ANSWERING,PLAN_LIBRARIES,PLAN_QUERIES,publicText,parsePlan,validateLibraries,validateQueries,validateFindings,packet,sourceUrls,phaseTimeout,encoding} from './core.mjs';

const emit=(event,data={})=>console.log(JSON.stringify({event,utc:new Date().toISOString(),...data}));
const input=JSON.parse(readFileSync('/input/request.json','utf8'));
const question=publicText(input.public_request);
const start=performance.now(), retrievalDeadline=start+300000, endDeadline=start+360000;
let phase='retrieval',callIndex=0;
const usage=[];

async function llm(systemPrompt,user,deadline,label) {
  const context=normalizeContext({systemPrompt,messages:[{role:'user',content:user,timestamp:Date.now()}],tools:[]});
  emit('model_context',{label,context});
  let count=0,partial='';
  const ac=new AbortController();
  const signal=AbortSignal.any([phaseTimeout(deadline,60000),ac.signal]);
  const s=stream(input.model,context,{
    apiKey:process.env.CODEX_TOKEN,reasoningEffort:'medium',transport:'sse',cacheRetention:'none',maxRetries:1,maxRetryDelayMs:10000,
    signal,timeoutMs:60000,toolChoice:'none',textVerbosity:'medium',
    onPayload:body=>{emit('model_payload',{label,payload:body});},
    onProviderStreamEvent:data=>{if(data.type==='response.completed'||data.type==='response.failed')emit('model_provider_terminal',{label,data});},
  });
  for await (const event of s) {
    if(event.type==='text_delta') {
      partial+=event.delta;
      if(++count%16===0 && encoding().encode(partial).length>4096) ac.abort();
    }
  }
  const result=await s.result();
  usage.push({phase:label,usage:result.usage});
  emit('model_result',{label,result});
  if(result.stopReason!=='stop') throw new Error(`${label}: ${result.stopReason}: ${result.errorMessage??'incomplete output'}`);
  const text=result.content.filter(x=>x.type==='text').map(x=>x.text).join('\n');
  if(encoding().encode(text).length>4096) throw new Error(`${label}: local output token cap exceeded`);
  return {text,result};
}
async function api(url,{method='GET',body,headers={}}={}) {
  const call=++callIndex;
  for(let attempt=0;attempt<2;attempt++) {
    const t=performance.now();
    emit('api_request',{call,attempt,method,url,body:body??null});
    let response,text;
    try {
      response=await fetch(url,{method,headers:{accept:'application/json',...headers,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:phaseTimeout(retrievalDeadline),redirect:'error'});
      text=await response.text();
    } catch(err) {
      emit('api_transport_error',{call,attempt,message:String(err),elapsed_ms:performance.now()-t});
      // POST submission ambiguity must never create a second task.
      if(method!=='GET'||attempt===1) throw err;
      await new Promise(r=>setTimeout(r,2000)); continue;
    }
    let data;
    try {data=JSON.parse(text);} catch {data={unparsed_text:text};}
    emit('api_response',{call,attempt,status:response.status,data,elapsed_ms:performance.now()-t,request_id:response.headers.get('x-request-id')});
    if(response.status===408 && /\/result$/.test(new URL(url).pathname)) return {pending:true};
    if(!response.ok) {
      if(method==='GET' && attempt===0 && (response.status===429||response.status>=500)) {
        const ra=response.headers.get('retry-after');
        const seconds=ra ? Number(ra) : 2;
        const delay=Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,Date.parse(ra)-Date.now());
        if(performance.now()+delay>=retrievalDeadline) throw new Error(`HTTP ${response.status}: retry exceeds deadline`);
        await new Promise(r=>setTimeout(r,delay));continue;
      }
      throw new Error(`HTTP ${response.status}: ${text.slice(0,2000)}`);
    }
    if(data.error) throw new Error(`Provider error: ${JSON.stringify(data)}`);
    return data;
  }
}
async function parallel() {
  const headers={'x-api-key':process.env.PARALLEL_KEY};
  const task=await api('https://api.parallel.ai/v1/tasks/runs',{method:'POST',headers,body:{input:`${RETRIEVAL}\n\n${question}`,processor:input.processor,task_spec:input.task_spec,memory_scope_key:input.memory_scope_key}});
  if(typeof task.run_id!=='string') throw new Error('Task creation returned no run_id');
  emit('task_created',{run_id:task.run_id,memory_scope_key:input.memory_scope_key});
  while(performance.now()<retrievalDeadline) {
    const state=await api(`https://api.parallel.ai/v1/tasks/runs/${encodeURIComponent(task.run_id)}`,{headers});
    emit('task_status',{run_id:task.run_id,status:state.status});
    if(['failed','cancelled','action_required'].includes(state.status)) throw new Error(`Task terminal status: ${state.status}`);
    if(state.status==='completed') {
      const result=await api(`https://api.parallel.ai/v1/tasks/runs/${encodeURIComponent(task.run_id)}/result`,{headers});
      if(result.pending) {await new Promise(r=>setTimeout(r,5000));continue;}
      let content=result.output?.content;
      if(typeof content==='string') content=JSON.parse(content);
      validateFindings(content,input.task_spec);
      emit('parallel_result',{result});
      return {findings:content,basis:result.output?.basis??result.basis??[]};
    }
    await new Promise(r=>setTimeout(r,Math.min(5000,Math.max(0,retrievalDeadline-performance.now()))));
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
  const evidence=input.workflow==='parallel'?await parallel():await context7();
  const normalized=packet(JSON.stringify(evidence,null,2));
  normalized.source_urls=sourceUrls(normalized.text);
  emit('evidence',{packet:normalized});
  const retrieval_ms=performance.now()-start;
  if(retrieval_ms>300000) throw new Error('Retrieval deadline exceeded during normalization');
  phase='answering';
  const answerStart=performance.now();
  const answer=await llm(ANSWERING,`REQUEST\n${question}\n\nDOCUMENTATION EVIDENCE\n${normalized.text||'[No documentation evidence returned]'}`,Math.min(endDeadline,answerStart+60000),'answering');
  emit('answer',{text:answer.text,usage:answer.result.usage,response_id:answer.result.responseId,finish_reason:answer.result.stopReason});
  emit('outcome',{status:'completed',retrieval_ms,answer_ms:performance.now()-answerStart,total_ms:performance.now()-start,model_usage:usage,provider_charge:null,accounting_status:'unavailable; model usage includes catalog estimates, not actual subscription charges'});
} catch(err) {
  emit('outcome',{status:'failed',phase,error:String(err),total_ms:performance.now()-start,model_usage:usage,provider_charge:null});
  process.exitCode=1;
}
