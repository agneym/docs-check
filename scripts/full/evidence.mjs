import {encoding,sourceUrls} from '../pilot/core.mjs';
const EMPTY='[No documentation evidence returned]';
const json=value=>JSON.stringify(value??null,null,2);
export function evidenceBlocks(workflow,evidence) {
  const blocks=[];
  const add=(id,kind,header,content,urls=sourceUrls(content))=>blocks.push({id,kind,source_ids:urls,header:`BLOCK ${id} (${kind})\n${header}\nSOURCE URLS ${json(urls)}\n`,content:typeof content==='string'?content:json(content)});
  if(workflow==='parallel') {
    const findings=evidence.findings?.findings??[];
    if(!findings.length)add('empty','empty','',EMPTY,[]);
    add('metadata','metadata','', {version_notes:evidence.findings?.version_notes??null,unresolved:evidence.findings?.unresolved??null});
    findings.forEach((f,i)=>add(`finding-${i+1}`,'finding',`TITLE ${json(f.title)}\nURL ${json(f.url)}\nSOURCE VERSION ${json(f.source_version)}`,f,sourceUrls(f)));
    if(evidence.basis!=null)add('basis','basis','',evidence.basis);
  } else if(workflow==='context7') {
    const docs=evidence.documents??[];
    const empty=x=>x==null||x===''||(typeof x==='object'&&(Object.keys(x).length===0 || (Object.keys(x).length===1 && typeof x.unparsed_text==='string' && !x.unparsed_text.trim()) || (['codeSnippets','infoSnippets'].some(k=>Array.isArray(x[k])) && ['codeSnippets','infoSnippets'].every(k=>x[k]==null || (Array.isArray(x[k])&&x[k].length===0)))));
    if(!docs.length||docs.every(x=>empty(x.result)))add('empty','empty','',EMPTY,[]);
    add('metadata','metadata','',{version_notes:evidence.version_notes??null,unresolved:evidence.unresolved??null});
    docs.forEach((d,i)=>add(`document-${i+1}`,'document',`REQUEST ${json(d.query)}`,d.result));
  } else throw new Error('Unknown evidence workflow');
  return blocks;
}
export function normalizeEvidence(workflow,evidence,limit=12000) {
  if(!Number.isSafeInteger(limit)||limit<0)throw new Error('Invalid evidence proxy-token budget');
  const blocks=evidenceBlocks(workflow,evidence),enc=encoding();
  const native=blocks.map(b=>b.header+b.content+'\n\n').join('');
  let text='',boundary=null;const included=[],retainedBlocks=[];
  const fits=s=>enc.encode(s).length<=limit;
  for(let index=0;index<blocks.length;index++) {
    const b=blocks[index],prefix=text+b.header;
    if(!fits(prefix)) {boundary={block_id:b.id,block_index:index,reason:'header_does_not_fit',retained_content_bytes:0};break;}
    const full=prefix+b.content+'\n\n';
    included.push(...b.source_ids);retainedBlocks.push(b.id);
    if(fits(full)){text=full;continue;}
    // Search by Unicode scalar boundaries, verifying the final re-encoded count.
    // Token counts need not be monotonic, so decrement from a bounded token prefix.
    const tokens=enc.encode(b.content),room=Math.max(0,limit-enc.encode(prefix).length);
    let retained=enc.decode(tokens.slice(0,room));
    // A token slice can end within a UTF-8 scalar; never introduce replacement text.
    while(retained && !b.content.startsWith(retained))retained=Array.from(retained).slice(0,-1).join('');
    while(retained && !fits(prefix+retained))retained=Array.from(retained).slice(0,-1).join('');
    text=prefix+retained;
    boundary={block_id:b.id,block_index:index,reason:'content_prefix',retained_content_bytes:Buffer.byteLength(retained)};break;
  }
  // original_* describe the complete header-enriched normalization, not native JSON.
  const nativeEvidence=JSON.stringify(evidence,null,2);
  return {text,native_evidence_bytes:Buffer.byteLength(nativeEvidence),native_evidence_proxy_tokens:enc.encode(nativeEvidence).length,original_bytes:Buffer.byteLength(native),retained_bytes:Buffer.byteLength(text),original_tokens:enc.encode(native).length,retained_tokens:enc.encode(text).length,truncated:text!==native,truncation_boundary:boundary,included_source_ids:[...new Set(included)],source_urls:[...new Set(included)],included_block_ids:retainedBlocks,tokenizer:'js-tiktoken@1.0.21/o200k_base',token_count_is_model_proxy:true};
}
