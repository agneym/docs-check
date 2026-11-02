import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeEvidence,evidenceBlocks} from './evidence.mjs';
import {encoding} from '../pilot/core.mjs';
const finding=(n,body='excerpt')=>({title:`Title ${n}`,url:`https://example.com/${n}`,source_version:'v2',finding:body,excerpt:null});
const parallel={findings:{findings:[finding(1),finding(2)],version_notes:'v2 requested',unresolved:['missing example']},basis:[{url:'https://support.example/basis',support:'source support'}]};
test('ordered findings, version/unresolved and separate basis support links',()=>{
  const p=normalizeEvidence('parallel',parallel);
  assert.equal(p.truncated,false);assert.equal(p.truncation_boundary,null);
  assert.deepEqual(p.included_block_ids,['metadata','finding-1','finding-2','basis']);
  assert.deepEqual(p.included_source_ids,['https://example.com/1','https://example.com/2','https://support.example/basis']);
  assert.ok(p.text.indexOf('URL "https://example.com/1"')<p.text.indexOf('"finding"'));
  assert.match(p.text,/v2 requested/);assert.match(p.text,/missing example/);assert.match(p.text,/SOURCE VERSION "v2"/);
  assert.equal(p.native_evidence_bytes,Buffer.byteLength(JSON.stringify(parallel,null,2)));assert.equal(p.native_evidence_proxy_tokens,encoding().encode(JSON.stringify(parallel,null,2)).length);
  assert.equal(p.original_bytes,Buffer.byteLength(p.text));assert.equal(p.retained_tokens,encoding().encode(p.text).length);
});
test('Context7 preserves request/response order and prefixes URLs',()=>{
  const p=normalizeEvidence('context7',{version_notes:'requested snapshot unavailable',documents:[{query:{libraryId:'/first',query:'one'},result:{text:'first https://docs.example/one'}},{query:{libraryId:'/second',query:'two'},result:{text:'second https://docs.example/two'}}]});
  assert.ok(p.text.indexOf('/first')<p.text.indexOf('/second'));
  assert.ok(p.text.indexOf('SOURCE URLS [\n  "https://docs.example/one"')<p.text.indexOf('first https://docs.example/one'));
  assert.match(p.text,/snapshot unavailable/);
});
test('truncation is deterministic prefix and never partially emits a header',()=>{
  const blocks=evidenceBlocks('parallel',parallel),enc=encoding();
  const metadata=blocks[0].header+blocks[0].content+'\n\n';
  const budget=enc.encode(metadata+blocks[1].header).length-1;
  const p=normalizeEvidence('parallel',parallel,budget);
  assert.equal(p.text,metadata);assert.deepEqual(p.included_source_ids,[]);
  assert.equal(p.truncation_boundary.reason,'header_does_not_fit');
  assert.deepEqual(p,normalizeEvidence('parallel',parallel,budget));
});
test('unicode truncation remains valid prefix and always re-encodes within limit',()=>{
  const e={findings:{findings:[finding(1,'🙂漢字é👩‍💻'.repeat(120))],version_notes:'v2',unresolved:[]},basis:[]};
  const full=normalizeEvidence('parallel',e);
  for(let budget=0;budget<full.original_tokens;budget+=7) {
    const p=normalizeEvidence('parallel',e,budget);
    assert.ok(encoding().encode(p.text).length<=budget);
    assert.ok(full.text.startsWith(p.text));assert.ok(!p.text.includes('\uFFFD'));
    assert.equal(p.retained_bytes,Buffer.byteLength(p.text));
    assert.equal(p.retained_tokens,encoding().encode(p.text).length);
  }
});
test('native plaintext empty wrappers are explicitly marked without discarding raw evidence',()=>{
  for(const text of ['', ' \n\t']) {
    const evidence={version_notes:'public fixture',documents:[{query:{libraryId:'/public/docs'},result:{unparsed_text:text}}]};
    const blocks=evidenceBlocks('context7',evidence);
    assert.deepEqual(blocks.map(b=>b.kind),['empty','metadata','document']);
    assert.match(blocks[0].content,/\[No documentation evidence returned\]/);
    assert.deepEqual(JSON.parse(blocks[2].content),{unparsed_text:text});
    const packet=normalizeEvidence('context7',evidence);
    assert.match(packet.text,/\[No documentation evidence returned\]/);
    assert.equal(packet.native_evidence_bytes,Buffer.byteLength(JSON.stringify(evidence,null,2)));
  }
  for(const result of [{unparsed_text:'Documentation'}, {unparsed_text:'',text:'Documentation'}]) {
    assert.equal(evidenceBlocks('context7',{documents:[{result}]}).some(b=>b.kind==='empty'),false);
  }
  assert.equal(evidenceBlocks('context7',{documents:[{result:{unparsed_text:''}},{result:{unparsed_text:'Documentation'}}]}).some(b=>b.kind==='empty'),false);
});
test('empty results explicitly marked and retain metadata/support',()=>{
  for(const [workflow,e] of [['parallel',{findings:{findings:[],version_notes:'unsupported',unresolved:['unknown']},basis:[{url:'https://support.example/empty'}]}],['context7',{version_notes:'unavailable',documents:[{query:{libraryId:'/x'},result:[]}]}]]) {
    const p=normalizeEvidence(workflow,e);assert.match(p.text,/\[No documentation evidence returned\]/);assert.match(p.text,/unsupported|unavailable/);
  }
  const emptySnippets=normalizeEvidence('context7',{version_notes:'unsupported version',documents:[{query:{libraryId:'/x'},result:{codeSnippets:[],infoSnippets:[],metadata:{version:'v1',url:'https://docs.example/metadata'}}}]});
  assert.match(emptySnippets.text,/\[No documentation evidence returned\]/);assert.match(emptySnippets.text,/https:\/\/docs.example\/metadata/);assert.match(emptySnippets.text,/unsupported version/);
  const worker=readFileSync(new URL('./worker.mjs',import.meta.url),'utf8');
  assert.match(worker,/normalizeEvidence\(input.workflow,evidence,settings.evidence_proxy_tokens\)/);
});
