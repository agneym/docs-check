import {test} from 'node:test';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildSync} from '../pilot/node_modules/esbuild/lib/main.js';
import assert from 'node:assert/strict';
import {createTransport,classify} from './transport.mjs';
import {validateQueries} from '../pilot/core.mjs';
const response=(body,status=200,headers={})=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers});
function fixture(sequence) {
  let time=0,calls=0; const events=[],delays=[];
  const transport=createTransport({fetch:async()=>{const item=sequence[calls++];if(item instanceof Error)throw item;return typeof item==='function'?item():item;},now:()=>time,wallNow:()=>0,sleep:async ms=>{delays.push(ms);time+=ms;},emit:(event,data)=>events.push({event,...data})});
  return {...transport,events,delays,calls:()=>calls,setTime:t=>time=t};
}
const url='https://api.parallel.ai/v1/tasks/runs/id/result';
test('success and empty results retain raw responses',async()=>{
  for(const body of [{output:{content:{findings:[{url:'https://example.com'}]}}},{findings:[]}]) {
    const f=fixture([response(body)]); assert.deepEqual(await f.api(url,{deadline:10000}),body);assert.equal(f.events[1].text,JSON.stringify(body));
  }
});
const docsURL='https://context7.com/api/v2/context?libraryId=%2Fpublic%2Fdocs&query=usage';
test('native docs plaintext and empty bodies retain text and response metadata',async()=>{
  for(const text of ['# Public docs\nUse the documented API. https://example.com/docs','']) {
    const f=fixture([response(text,200,{'content-type':'text/plain; charset=utf-8','x-request-id':'fixture-id'})]);
    assert.deepEqual(await f.api(docsURL,{deadline:10000}),{unparsed_text:text});
    assert.deepEqual(f.events[1],{event:'api_response',call:1,attempt:0,status:200,text,data:{unparsed_text:text},content_type:'text/plain; charset=utf-8',request_id:'fixture-id',elapsed_ms:0});
    assert.equal(f.calls(),1);
  }
});
test('plaintext exception is exact-route GET only; declared malformed JSON and HTML are rejected',async()=>{
  const cases=[
    [url,'GET','text/plain','docs'],
    ['https://context7.com/api/v2/libs/search','GET','text/plain','docs'],
    ['https://example.com/api/v2/context','GET','text/plain','docs'],
    [docsURL,'POST','text/plain','docs'],
    ['https://context7.com/api/v2/context/','GET','text/plain','docs'],
    [docsURL,'GET','application/json','{broken'],
    [docsURL,'GET','application/problem+json','{broken'],
    [docsURL,'GET','text/json; charset=utf-8','{broken'],
    [docsURL,'GET','text/html','Login required'],
    [docsURL,'GET','text/plain','<!DOCTYPE html><html><body>Login</body></html>'],
    [docsURL,'GET','text/plain','<form action="/login">Sign in</form>'],
    [docsURL,'GET','text/plain','<!-- gateway --><html><body>Error</body></html>'],
    [docsURL,'GET','text/plain','<h1>Login required</h1>'],
  ];
  for(const [target,method,type,text] of cases) {
    const f=fixture([response(text,200,{'content-type':type})]);
    await assert.rejects(f.api(target,{method,deadline:10000}),{classification:'bad_json'});
    assert.equal(f.calls(),1);assert.equal(f.events[1].text,text);assert.equal(f.events[1].content_type,type);
  }
});
test('docs format failures pause, while Task and resolution bad JSON do not',async()=>{
  for(const target of [docsURL,url,'https://context7.com/api/v2/libs/search?libraryName=public&query=usage']) {
    const f=fixture([response('{broken',200,{'content-type':'application/json'})]);
    await assert.rejects(f.api(target,{deadline:10000}),error=>{
      assert.equal(error.classification,'bad_json');
      assert.deepEqual(classify(error),{classification:'bad_json',pause_required:target===docsURL});
      return true;
    });
    assert.equal(f.calls(),1);
  }
  const html=fixture([response('<html>Login</html>',200,{'content-type':'text/html'})]);
  await assert.rejects(html.api(docsURL,{deadline:10000}),error=>{assert.equal(classify(error).pause_required,true);return error.classification==='bad_json';});
});
test('parsed null is successful empty docs only, never a parse-failure sentinel',async()=>{
  for(const target of [docsURL,url,'https://context7.com/api/v2/libs/search']) {
    const f=fixture([response('null',200,{'content-type':'application/json'})]);
    if(target===docsURL)assert.equal(await f.api(target,{deadline:10000}),null);
    else await assert.rejects(f.api(target,{deadline:10000}),{classification:'bad_json'});
    assert.equal(f.events[1].data,null);assert.equal(f.events[1].text,'null');assert.equal(f.calls(),1);
  }
});
test('docs JSON remains parsed and HTTP failures are not successful plaintext',async()=>{
  const f=fixture([response({documents:[]},200,{'content-type':'application/json'})]);
  assert.deepEqual(await f.api(docsURL,{deadline:10000}),{documents:[]});
  const g=fixture([response('Not found',404,{'content-type':'text/plain'})]);
  await assert.rejects(g.api(docsURL,{deadline:10000}),{classification:'provider_error'});
});
test('bad JSON does not retry',async()=>{const f=fixture([response('invalid')]);await assert.rejects(f.api(url,{deadline:10000}),{classification:'bad_json'});assert.equal(f.calls(),1);});
test('429 safe GET retries once',async()=>{const f=fixture([response({},429),response({ok:true})]);assert.deepEqual(await f.api(url,{deadline:10000}),{ok:true});assert.deepEqual(f.delays,[2000]);});
test('temporary quota 429 retries docs and model; exhausted quota and 402 pause',async()=>{
  for(const model of [false,true]) {
    const f=fixture([response({error:'quota temporarily exceeded'},429),response({ok:true})]);
    if(model)assert.equal((await f.modelFetch(url,{},10000)).status,200);
    else assert.deepEqual(await f.api(url,{deadline:10000}),{ok:true});
    assert.equal(f.calls(),2);
    for(const [status,body] of [[402,{}],[429,{error:'quota exhausted'}]]) {
      const g=fixture([response(body,status)]);
      if(model)assert.equal((await g.modelFetch(url,{},10000)).status,status);
      else await assert.rejects(g.api(url,{deadline:10000}),{classification:'quota'});
      assert.equal(g.calls(),1);assert.equal(classify(new Error(`HTTP ${status}: ${JSON.stringify(body)}`)).pause_required,true);
    }
  }
});
test('model never retries expired request or backoff crossing deadline',async()=>{
  const f=fixture([()=>{f.setTime(101);throw new Error('reset');}]);
  await assert.rejects(f.modelFetch(url,{},100),{classification:'deadline'});assert.equal(f.calls(),1);
  const g=fixture([response({},503),response({})]);await assert.rejects(g.modelFetch(url,{},1000),{classification:'deadline'});assert.equal(g.calls(),1);
});
test('date Retry-After',async()=>{const f=fixture([response({},429,{'retry-after':'Thu, 01 Jan 1970 00:00:03 GMT'}),response({})]);await f.api(url,{deadline:10000});assert.deepEqual(f.delays,[3000]);});
test('safe GET transport retry',async()=>{const f=fixture([new Error('reset'),response({})]);await f.api(url,{deadline:10000});assert.equal(f.calls(),2);});
test('ambiguous POST never retries',async()=>{const f=fixture([new Error('reset')]);await assert.rejects(f.api(url,{method:'POST',body:{},deadline:10000}),{ambiguous_submission:true});assert.equal(f.calls(),1);});
test('failed resolution rejects invented ID',()=>{assert.throws(()=>validateQueries({queries:[{libraryId:'/invented',query:'docs'}],version_notes:''},[{response:{results:[]}}]),/Unresolved/);});
test('pending 408 is not retry or resubmission',async()=>{const f=fixture([response({},408)]);assert.deepEqual(await f.api(url,{deadline:10000}),{pending:true});assert.equal(f.calls(),1);});
test('deadline includes response body',async()=>{const f=fixture([()=>({status:200,ok:true,headers:new Headers(),text:()=>new Promise(()=>{})})]);await assert.rejects(f.api(url,{deadline:10}),{classification:'deadline'});assert.equal(f.calls(),1);});
test('late completion rejected',async()=>{const f=fixture([()=>{f.setTime(101);return response({});}]);await assert.rejects(f.api(url,{deadline:100}),{classification:'deadline'});});
test('model transient retry once but never authentication or quota',async()=>{
  const f=fixture([response({},503),response({})]);
  assert.equal((await f.modelFetch(url,{},10000)).status,200);assert.equal(f.calls(),2);
  for(const [status,body] of [[401,{}],[403,{}],[429,{error:'quota exhausted'}]]) {
    const g=fixture([response(body,status)]);assert.equal((await g.modelFetch(url,{},10000)).status,status);assert.equal(g.calls(),1);
  }
});
test('standalone bundled worker emits failure outcome without dependencies or calls',()=>{
  const directory=mkdtempSync(join(tmpdir(),'full-worker-'));
  try {
    const outfile=join(directory,'worker.mjs');
    buildSync({entryPoints:[new URL('./worker.mjs',import.meta.url).pathname],outfile,bundle:true,platform:'node',format:'esm',target:'node22'});
    const preload=join(directory,'preload.mjs');
    writeFileSync(preload,`import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module'; const original=fs.readFileSync; fs.readFileSync=function(path,...args){if(path==='/input/request.json')return JSON.stringify({public_request:{product:'test',version_context:'test',question:'test'},workflow:'invalid'});return original.call(this,path,...args)};syncBuiltinESMExports();globalThis.fetch=()=>{throw new Error('Unexpected paid call')};`);
    const result=spawnSync(process.execPath,['--import',preload,outfile],{cwd:directory,encoding:'utf8'});
    assert.equal(result.status,1,result.stderr);
    const events=result.stdout.trim().split('\n').map(x=>JSON.parse(x));
    assert.equal(events.at(-1).event,'outcome');assert.equal(events.at(-1).status,'failed');assert.match(events.at(-1).error,/Unknown workflow/);
    for(const mode of ['auth','timeout']) {
      writeFileSync(preload,`import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module'; const original=fs.readFileSync; fs.readFileSync=function(path,...args){if(path==='/input/request.json')return JSON.stringify({public_request:{product:'test',version_context:'test',question:'test'},workflow:'parallel',processor:'core-fast',task_spec:{output_schema:{type:'json'}},settings:{retrieval_ms:250,total_ms:500}});return original.call(this,path,...args)};syncBuiltinESMExports(); let calls=0; globalThis.fetch=async()=>{calls++; if('${mode}'==='auth')return new Response('{}',{status:401});if(calls===1)return new Response(JSON.stringify({run_id:'fixture-task'}));return new Promise(()=>{});};`);
      const run=spawnSync(process.execPath,['--import',preload,outfile],{cwd:directory,encoding:'utf8'});
      assert.equal(run.status,1,run.stderr);
      const records=run.stdout.trim().split('\n').map(x=>JSON.parse(x)),outcome=records.at(-1);
      assert.equal(outcome.status,'failed');
      if(mode==='auth'){assert.equal(outcome.classification,'auth');assert.equal(outcome.pause_required,true);}
      else {assert.equal(outcome.classification,'deadline');assert.equal(outcome.outstanding_task,'fixture-task');assert.equal(records.filter(x=>x.event==='api_request'&&x.method==='POST').length,1);}
    }
    const spec=JSON.parse(readFileSync(new URL('../../evaluation/parallel-task-spec.json',import.meta.url),'utf8'));
    for(const mode of ['empty_success','answer_error','answer_timeout','malformed']) {
      const request={public_request:{product:'test',version_context:'test',question:'test'},workflow:'parallel',processor:'core-fast',task_spec:spec,model:{id:'gpt-6.1-terra',name:'fixture',provider:'openai-codex',api:'openai-codex-responses',baseUrl:'https://chatgpt.com/backend-api',reasoning:true,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:200000,maxTokens:4096},settings:{retrieval_ms:5000,total_ms:10000,answer_ms:mode==='answer_timeout'?25:3000}};
      const useful={title:'Official docs',url:'https://docs.example/useful',finding:'Useful source documentation',excerpt:null,source_version:'v1'};
      const content=mode==='malformed'?{findings:'invalid'}:{findings:mode==='empty_success'?[]:[useful],version_notes:'fixture scope',unresolved:[]};
      writeFileSync(preload,`import {zstdDecompressSync} from 'node:zlib';import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module'; const original=fs.readFileSync;fs.readFileSync=function(path,...args){if(path==='/input/request.json')return ${JSON.stringify(JSON.stringify(request))};return original.call(this,path,...args)};syncBuiltinESMExports();process.env.CODEX_TOKEN='e30.'+Buffer.from(JSON.stringify({'https://api.openai.com/auth':{chatgpt_account_id:'fixture-account'}})).toString('base64url')+'.fixture';
        globalThis.fetch=async(url,options)=>{
          if(url.includes('api.parallel.ai')) {
            if(options.method==='POST')return new Response(JSON.stringify({run_id:'fixture-task'}));
            if(url.endsWith('/result'))return new Response(JSON.stringify({output:{content:${JSON.stringify(content)}}}));
            return new Response(JSON.stringify({status:'completed'}));
          }
          if(!url.includes('chatgpt.com'))throw new Error('Unexpected destination');
          console.log(JSON.stringify({event:'fixture_model_request',body:JSON.parse(options.headers.get('content-encoding')==='zstd'?zstdDecompressSync(options.body).toString():options.body)}));
          if('${mode}'==='answer_timeout')return new Promise(()=>{});
          const item={type:'message',id:'msg_fixture',role:'assistant',status:'completed',content:[{type:'output_text',text:'Evidence is insufficient.',annotations:[]}]};
          const events='${mode}'==='answer_error'?[{type:'response.failed',response:{status:'failed',error:{code:'fixture_error',message:'fixture answer failure'}}}]:[{type:'response.created',response:{id:'resp_fixture'}},{type:'response.output_item.added',output_index:0,item:{...item,content:[]}},{type:'response.output_item.done',output_index:0,item},{type:'response.completed',response:{id:'resp_fixture',status:'completed',output:[item],usage:{input_tokens:10,output_tokens:4,total_tokens:14,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:0}}}}];
          return new Response(events.map(e=>'data: '+JSON.stringify(e)+'\\n\\n').join(''),{headers:{'content-type':'text/event-stream'}});
        };`);
      const run=spawnSync(process.execPath,['--import',preload,outfile],{cwd:directory,encoding:'utf8',timeout:15000});
      const records=run.stdout.trim().split('\n').map(x=>JSON.parse(x)),outcome=records.findLast(x=>x.event==='outcome');
      assert.equal(outcome?.event,'outcome',JSON.stringify({mode,status:run.status,signal:run.signal,error:String(run.error),stderr:run.stderr,stdout:run.stdout.slice(-3000)}));assert.equal(outcome.status,mode==='empty_success'?'completed':'failed',JSON.stringify(outcome));
      const calls=records.filter(x=>x.event==='fixture_model_request');
      assert.equal(calls.length,mode==='malformed'?0:1,'No repair, retry or fallback answering call');
      if(mode==='malformed'){assert.equal(records.some(x=>x.event==='answer'),false);continue;}
      assert.equal(calls[0].body.input.length,1);assert.equal(calls[0].body.tools?.length??0,0);
      const evidence=records.find(x=>x.event==='evidence').packet;
      if(mode==='empty_success') {assert.match(JSON.stringify(calls[0].body),/No documentation evidence returned/);assert.equal(records.filter(x=>x.event==='answer').length,1);assert.equal(outcome.model_usage.length,1);}
      else {assert.match(evidence.text,/Useful source documentation/);assert.equal(outcome.phase,'answering');assert.equal(records.some(x=>x.event==='answer'),false);if(mode==='answer_timeout')assert.equal(outcome.classification,'deadline');}
    }
  } finally {rmSync(directory,{recursive:true,force:true});}
});
test('auth quota sustained failure and leakage pause',async()=>{
  for(const classification of ['auth','quota','sustained_failure','leakage'])assert.equal(classify({classification}).pause_required,true);
  const f=fixture([response({},503),response({},503)]);await assert.rejects(f.api(url,{deadline:10000}),{classification:'sustained_failure'});
});
