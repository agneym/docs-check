import test from 'node:test';
import {zstdCompressSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicRow,publicText,parsePlan,validateLibraries,validateQueries,validateFindings,packet,apiPathAllowed,decodeRequestBody,phaseTimeout} from './core.mjs';
const spec=JSON.parse(readFileSync(new URL('../../evaluation/parallel-task-spec.json',import.meta.url)));
const row={id:'secret-id',product:'Product',version_context:'Scope',question:'Question',reference_answer:'PRIVATE_CANARY',difficulty:'hard',criteria:['PRIVATE_CANARY']};
test('public export allowlists fields and never exports key metadata',()=>{
 assert.deepEqual(publicRow(row),{product:'Product',version_context:'Scope',question:'Question'});
 assert.equal(publicText(row),'Product: Product\nVersion context: Scope\nQuestion:\nQuestion');
 assert.ok(!JSON.stringify(publicRow(row)).includes('PRIVATE_CANARY'));
 assert.throws(()=>publicRow({question:'only'}));
});
test('planner JSON and library budgets',()=>{
 assert.deepEqual(parsePlan('```json\n{"libraries":[]}\n```'),{libraries:[]});
 assert.throws(()=>parsePlan('not json'));
 assert.throws(()=>validateLibraries({libraries:[]}));
 assert.throws(()=>validateLibraries({libraries:[{name:'x',query:'y'},{name:'x',query:'y'},{name:'x',query:'y'}]}));
 assert.equal(validateLibraries({libraries:[{name:'Official name',query:'lookup'}]}).length,1);
});
test('documentation queries cannot invent IDs and stay within budget',()=>{
 const plan={queries:[{libraryId:'/org/lib',query:'lookup'}],version_notes:''};
 assert.equal(validateQueries(plan,[{response:{results:[{id:'/org/lib'}]}}]).length,1);
 assert.throws(()=>validateQueries(plan,[{id:'/other/lib'}]));
 assert.throws(()=>validateQueries({...plan,queries:Array(5).fill(plan.queries[0])},[{id:'/org/lib'}]));
});
test('empty evidence is valid; malformed results and unsafe URLs fail',()=>{
 assert.deepEqual(validateFindings({findings:[],version_notes:'',unresolved:['No docs']},spec).findings,[]);
 assert.throws(()=>validateFindings({findings:[]},spec));
 assert.throws(()=>validateFindings({findings:[],version_notes:'',unresolved:[],answer:'secret'},spec));
 const content={findings:[{title:'Title',url:'https://official.example/doc',finding:'Fact',excerpt:null,source_version:null}],version_notes:'',unresolved:[]};
 assert.equal(validateFindings(content,spec).findings.length,1);
 assert.throws(()=>validateFindings({...content,findings:[{...content.findings[0],url:'file:///private/key'}]},spec));
});
test('evidence normalization enforces deterministic proxy-token cap',()=>{
 const text='long documentation '.repeat(400);
 const a=packet(text,100),b=packet(text,100);
 assert.deepEqual(a,b);assert.equal(a.retained_tokens,100);assert.equal(a.truncated,true);
 assert.ok(a.original_bytes>a.retained_bytes);assert.equal(packet('small',100).truncated,false);
});
test('outbound audit decodes Codex zstd payloads before JSON validation',()=>{
 const fixture=JSON.stringify({model:'fixture',input:[{role:'user',content:'public input'}]});
 assert.equal(decodeRequestBody(zstdCompressSync(Buffer.from(fixture)),'zstd'),fixture);
 assert.equal(decodeRequestBody(Buffer.from(fixture),null),fixture);
 assert.equal(decodeRequestBody(Buffer.alloc(0),null),null);
 assert.throws(()=>decodeRequestBody(Buffer.from(fixture),'unsupported'));
});
test('egress policy blocks other providers, local networks, unapproved methods/paths',()=>{
 const req=(url,method='GET')=>({url,method});
 assert.ok(apiPathAllowed(req('https://api.parallel.ai/v1/tasks/runs','POST'),'parallel'));
 assert.ok(apiPathAllowed(req('https://api.parallel.ai/v1/tasks/runs/trun_abc/result'),'parallel'));
 assert.ok(apiPathAllowed(req('https://context7.com/api/v2/context?libraryId=x'),'context7'));
 assert.ok(apiPathAllowed(req('https://chatgpt.com/backend-api/codex/responses','POST'),'context7'));
 for(const r of [req('http://169.254.169.254/'),req('https://example.com/'),req('https://context7.com/api/v2/context'),req('https://api.parallel.ai/v1/search','POST'),req('https://api.parallel.ai/v1/tasks/runs','DELETE')])assert.equal(apiPathAllowed(r,'parallel'),false);
 assert.equal(apiPathAllowed(req('https://api.parallel.ai/v1/tasks/runs','POST'),'context7'),false);
});
test('expired phase deadline fails without another call',()=>{
 assert.throws(()=>phaseTimeout(performance.now()-1));
 assert.ok(phaseTimeout(performance.now()+1000) instanceof AbortSignal);
});
