// Offline only: archive absence skips archive tests, never falls back to a paid call.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readdirSync,readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {buildSync} from '../pilot/node_modules/esbuild/lib/main.js';
import {createTransport} from './transport.mjs';
import {normalizeEvidence} from './evidence.mjs';

const archives=[
  ['pilot',`${process.env.HOME}/random/docs-check-runs/2026-11-01T18-18-38-840Z-9cb372`,3],
  ['full',`${process.env.HOME}/random/docs-check-runs/2026-11-01-first-pass-continuation-1`,4],
];
const fixtures=[{name:'public plaintext',text:'# Public documentation\nUse the documented API. https://example.com/docs'}, {name:'empty plaintext',text:''}, {name:'whitespace plaintext',text:' \n\t'}, {name:'JSON null docs',text:'null',content_type:'application/json',jsonNull:true}];
for(const [kind,root,count] of archives) {
  const dir=join(root,'executions');
  if(!existsSync(dir)) {
    test(`${kind} archived docs replay (no paid fallback)`,{skip:'Read-only archive unavailable; no network or paid fallback'},()=>{});
    continue;
  }
  const found=[];
  for(const entry of readdirSync(dir).sort()) {
    const path=join(dir,entry,'events.jsonl');
    if(!existsSync(path))continue;
    const records=readFileSync(path,'utf8').trim().split('\n').map(JSON.parse),requests=new Map();
    records.forEach((e,index)=>{
      if(e.event==='api_request')requests.set(e.call,e);
      const request=requests.get(e.call);
      if(e.event!=='api_response'||!request?.url.startsWith('https://context7.com/api/v2/context?'))return;
      const text=kind==='pilot'?e.data?.unparsed_text:e.text;
      if(typeof text!=='string')return;
      assert.equal(e.status,200);
      found.push({name:`${kind}/${entry}/${e.call}`,path,index,text,url:request.url,status:e.status,request_id:e.request_id,content_type:e.content_type});
    });
  }
  test(`${kind} archive coverage`,()=>assert.equal(found.length,count));
  fixtures.push(...found);
}

const model={id:'gpt-6.1-terra',name:'fixture',provider:'openai-codex',api:'openai-codex-responses',baseUrl:'https://chatgpt.com/backend-api',reasoning:true,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:200000,maxTokens:4096};
const spec=JSON.parse(readFileSync(new URL('../../evaluation/parallel-task-spec.json',import.meta.url),'utf8'));

test('offline parser and fully bundled production worker response replay',{timeout:120000},async t=>{
  const dir=mkdtempSync(join(tmpdir(),'docs-response-replay-'));
  try {
    const outfile=join(dir,'worker.mjs'),preload=join(dir,'preload.mjs');
    buildSync({entryPoints:[new URL('./worker.mjs',import.meta.url).pathname],outfile,bundle:true,platform:'node',format:'esm',target:'node22'});
    // This preload intercepts every fetch. Unknown destinations/calls fail closed.
    writeFileSync(preload,`
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {zstdDecompressSync} from 'node:zlib';
const cfg=JSON.parse(process.env.REPLAY_CONFIG);
const original=fs.readFileSync;
let docs=cfg.text;
if(cfg.path){const e=JSON.parse(original(cfg.path,'utf8').trim().split('\\n')[cfg.index]);docs=e.text??e.data.unparsed_text;}
fs.readFileSync=function(path,...args){if(path==='/input/request.json')return JSON.stringify(cfg.request);return original.call(this,path,...args);};
syncBuiltinESMExports();
process.env.CODEX_TOKEN='e30.'+Buffer.from(JSON.stringify({'https://api.openai.com/auth':{chatgpt_account_id:'offline-fixture'}})).toString('base64url')+'.fixture';
let modelCalls=0,apiCalls=0;
const json=x=>new Response(JSON.stringify(x),{headers:{'content-type':'application/json'}});
globalThis.fetch=async(url,options)=>{
  url=String(url);
  if(url.startsWith('https://context7.com/api/v2/libs/search?')){
    if(++apiCalls!==1||options.method!=='GET')throw Error('Unexpected resolution request');
    return json({results:[{id:'/public/docs',title:'Public docs'}]});
  }
  if(url.startsWith('https://context7.com/api/v2/context?')){
    if(++apiCalls!==2||options.method!=='GET'||modelCalls!==2)throw Error('Unexpected docs request');
    const params=new URL(url).searchParams;
    if(params.get('libraryId')!=='/public/docs'||params.get('query')!=='usage')throw Error('Changed query');
    return new Response(docs,{headers:{'content-type':cfg.content_type??'text/plain; charset=utf-8','x-request-id':cfg.request_id??'offline-docs'}});
  }
  if(url.startsWith('https://api.parallel.ai/v1/tasks/runs')){
    apiCalls++;
    if(apiCalls===1&&url==='https://api.parallel.ai/v1/tasks/runs'&&options.method==='POST')return json({run_id:'offline-task'});
    if(apiCalls===2&&url.endsWith('/offline-task')&&options.method==='GET')return json({status:'completed'});
    if(apiCalls===3&&url.endsWith('/offline-task/result')&&options.method==='GET')return json({output:{content:{findings:[{title:'Public docs',url:'https://example.com/docs',finding:'Use the documented API.',excerpt:null,source_version:'v1'}],version_notes:'public fixture',unresolved:[]}}});
    throw Error('Unexpected Parallel request');
  }
  if(!url.startsWith('https://chatgpt.com/backend-api/'))throw Error('Network forbidden: '+url);
  const body=JSON.parse(options.headers.get('content-encoding')==='zstd'?zstdDecompressSync(options.body).toString():options.body);
  console.log(JSON.stringify({event:'offline_model_request',body}));
  const stage=modelCalls++;
  let text='Documentation answer.';
  if(cfg.request.workflow==='context7'){
    if(stage===0){if(apiCalls!==0)throw Error('Planning order');text=JSON.stringify({libraries:[{name:'public',query:'usage'}]});}
    else if(stage===1){if(apiCalls!==1)throw Error('Selection order');text=JSON.stringify({queries:[{libraryId:'/public/docs',query:'usage'}],version_notes:'public fixture'});}
    else if(stage!==2||apiCalls!==2)throw Error('Answer order');
  } else if(stage!==0||apiCalls!==3)throw Error('Parallel answer order');
  const item={type:'message',id:'msg_'+stage,role:'assistant',status:'completed',content:[{type:'output_text',text,annotations:[]}]};
  const events=[{type:'response.created',response:{id:'resp_'+stage}},{type:'response.output_item.added',output_index:0,item:{...item,content:[]}},{type:'response.output_item.done',output_index:0,item},{type:'response.completed',response:{id:'resp_'+stage,status:'completed',output:[item],usage:{input_tokens:10,output_tokens:4,total_tokens:14,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:0}}}}];
  return new Response(events.map(e=>'data: '+JSON.stringify(e)+'\\n\\n').join(''),{headers:{'content-type':'text/event-stream'}});
};
`);
    for(const fixture of [...fixtures,{name:'Parallel full JSON pipeline',parallel:true}])await t.test(fixture.name,async()=>{
      if(!fixture.parallel){
        const events=[];
        const transport=createTransport({fetch:async()=>new Response(fixture.text,{headers:{'content-type':fixture.content_type??'text/plain; charset=utf-8','x-request-id':fixture.request_id??'offline-docs'}}),emit:(event,data)=>events.push({event,...data})});
        assert.deepEqual(await transport.api(fixture.url??'https://context7.com/api/v2/context?libraryId=%2Fpublic%2Fdocs&query=usage',{deadline:performance.now()+5000}),fixture.jsonNull?null:{unparsed_text:fixture.text});
        assert.equal(events[1].text,fixture.text);assert.equal(events[1].request_id,fixture.request_id??'offline-docs');
        assert.equal(events[1].content_type,fixture.content_type??'text/plain; charset=utf-8');
      }
      const request={public_request:{product:'public',version_context:'v1',question:'usage'},workflow:fixture.parallel?'parallel':'context7',processor:'core-fast',task_spec:spec,model,settings:{retrieval_ms:15000,total_ms:20000,answer_ms:5000}};
      // Archive bytes stay in memory or are read directly by the child, never written into the repository.
      const config={...fixture,request};if(fixture.path)delete config.text;
      const run=spawnSync(process.execPath,['--import',preload,outfile],{cwd:dir,encoding:'utf8',timeout:25000,env:{...process.env,REPLAY_CONFIG:JSON.stringify(config)}});
      assert.equal(run.status,0,run.stderr+'\n'+run.stdout.slice(-3000));
      const records=run.stdout.trim().split('\n').map(JSON.parse),outcome=records.at(-1);
      assert.equal(outcome.status,'completed');
      const contexts=records.filter(e=>e.event==='model_context');
      assert.deepEqual(contexts.map(e=>e.label),fixture.parallel?['answering']:['library_planning','query_selection','answering']);
      assert.equal(outcome.model_usage.length,fixture.parallel?1:3);
      const calls=records.filter(e=>e.event==='offline_model_request');
      assert.equal(calls.length,fixture.parallel?1:3);
      for(const {body} of calls){assert.equal(body.input.length,1);assert.equal(body.tools?.length??0,0);}
      assert.equal(records.filter(e=>e.event==='answer').length,1);
      const evidence=records.find(e=>e.event==='evidence').packet;
      const answerContext=contexts.at(-1).context;
      if(!fixture.parallel){
        const docs=records.filter(e=>e.event==='api_response').at(-1);
        assert.equal(docs.text,fixture.text);assert.deepEqual(docs.data,fixture.jsonNull?null:{unparsed_text:fixture.text});
        assert.equal(docs.content_type,fixture.content_type??'text/plain; charset=utf-8');
        const expected=normalizeEvidence('context7',{version_notes:'public fixture',documents:[{query:{libraryId:'/public/docs',query:'usage'},result:fixture.jsonNull?null:{unparsed_text:fixture.text}}]},12000);
        assert.deepEqual(evidence,expected);
        assert.ok(answerContext.messages.at(-1).content.endsWith(expected.text));
        if(fixture.jsonNull || !fixture.text.trim()) {
          assert.match(evidence.text,/\[No documentation evidence returned\]/);
          assert.match(answerContext.messages.at(-1).content,/\[No documentation evidence returned\]/);
          assert.ok(evidence.included_block_ids.includes('document-1'));
        }
      } else assert.match(evidence.text,/Use the documented API/);
    });
  } finally {rmSync(dir,{recursive:true,force:true});}
});
