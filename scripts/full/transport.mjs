export class TransportError extends Error {
  constructor(message, classification='transport', details={}) { super(message); this.classification=classification; Object.assign(this,details); }
}
export function classify(error) {
  const text=String(error);
  const temporaryQuota=/quota\s+(?:temporarily|temporar(?:y|ily))|temporary\s+quota/i.test(text);
  const classification=error.classification ?? (/leak|canary/i.test(text)?'leakage':/401|403|unauthor|authentication/i.test(text)?'auth':/HTTP\s*402\b/i.test(text)||(!temporaryQuota && /quota|credit|billing|usage limit/i.test(text))?'quota':/deadline|timeout|abort/i.test(text)?'deadline':'invalid_response');
  return {classification,pause_required:error.pause_required===true || ['auth','quota','sustained_failure','leakage'].includes(classification)};
}
export function createTransport({fetch:fetcher=globalThis.fetch,now=()=>performance.now(),wallNow=()=>Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms)),emit=()=>{}}={}) {
  let calls=0;
  async function within(operation,deadline) {
    const remaining=deadline-now();
    if(remaining<=0) throw new TransportError('Deadline exceeded','deadline');
    const ac=new AbortController(); let timer;
    try {
      const value=await Promise.race([Promise.resolve().then(()=>operation(ac.signal)),new Promise((_,reject)=>{timer=setTimeout(()=>{ac.abort();reject(new TransportError('Deadline exceeded','deadline'));},remaining);})]);
      if(now()>=deadline) throw new TransportError('Late completion after deadline','deadline');
      return value;
    } finally {clearTimeout(timer);}
  }
  async function wait(ms,deadline) {return within(()=>sleep(ms),deadline);}
  async function api(url,{method='GET',body,headers={},deadline}={}) {
    const call=++calls;
    for(let attempt=0;attempt<2;attempt++) {
      const start=now(); emit('api_request',{call,attempt,method,url,body:body??null});
      let response,text;
      try {
        ({response,text}=await within(async signal=>{
          const response=await fetcher(url,{method,headers:{accept:'application/json',...headers,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal,redirect:'error'});
          return {response,text:await response.text()};
        },deadline));
      } catch(error) {
        emit('api_transport_error',{call,attempt,error:String(error),elapsed_ms:now()-start});
        if(method!=='GET') throw new TransportError(String(error),error.classification??'ambiguous_submission',{ambiguous_submission:true});
        if(error.classification==='deadline') throw error;
        if(attempt) throw new TransportError(String(error),'sustained_failure');
        await wait(2000,deadline); continue;
      }
      const contentType=response.headers.get('content-type');
      const route=new URL(url);
      const nativeDocs=method==='GET' && route.origin==='https://context7.com' && route.pathname==='/api/v2/context';
      const declaredJSON=/^[\w!#$&^_.+-]+\/(?:[\w.-]+\+)?json\s*(?:;|$)/i.test(contentType??'');
      const html=/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(contentType??'') || /^\s*(?:<!--[\s\S]*?-->\s*)*(?:<!doctype\s+html\b|<\/?(?:html|head|body|title|form|div|h1|script|meta)\b)/i.test(text);
      let data,parsed=false; try {data=JSON.parse(text);parsed=true;} catch {
        data=nativeDocs && !declaredJSON && !html ? {unparsed_text:text} : null;
      }
      emit('api_response',{call,attempt,status:response.status,text,data,content_type:contentType,request_id:response.headers.get('x-request-id'),elapsed_ms:now()-start});
      if(response.status===408 && /\/result$/.test(new URL(url).pathname)) return {pending:true};
      if(!response.ok || data?.error) {
        const failure=classify(new Error(`HTTP ${response.status}: ${text}`));
        if(failure.pause_required) throw new TransportError(`HTTP ${response.status}: ${text}`,failure.classification);
        if(method==='GET' && attempt===0 && (response.status===429 || response.status>=500)) {
          const ra=response.headers.get('retry-after');
          const delay=ra===null?2000:Number.isFinite(Number(ra))?Math.max(0,Number(ra)*1000):Math.max(0,Date.parse(ra)-wallNow());
          await wait(Number.isFinite(delay)?delay:2000,deadline); continue;
        }
        throw new TransportError(`HTTP ${response.status}: ${text}`,response.status===429||response.status>=500?'sustained_failure':'provider_error');
      }
      if(data===null && !(nativeDocs && parsed)) throw new TransportError('Invalid JSON response','bad_json',{pause_required:nativeDocs});
      return data;
    }
  }
  async function modelFetch(url,options,deadline) {
    for(let attempt=0;attempt<2;attempt++) {
      let response;
      try {response=await within(()=>fetcher(url,options),deadline);}
      catch(error) {
        if(attempt || error.classification==='deadline' || options.signal?.aborted) throw error;
        emit('model_retry',{attempt,reason:String(error)});
        await wait(2000,deadline); continue;
      }
      emit('model_http_response',{attempt,status:response.status});
      if(attempt || ![429,500,502,503,504].includes(response.status)) return response;
      // Inspect a clone so quota failures are never retried, and keep the original for pi-ai.
      const text=await within(()=>response.clone().text(),deadline);
      if(classify(new Error(`HTTP ${response.status}: ${text}`)).pause_required) return response;
      const ra=response.headers.get('retry-after');
      const delay=ra===null?2000:Number.isFinite(Number(ra))?Math.max(0,Number(ra)*1000):Math.max(0,Date.parse(ra)-wallNow());
      await response.body?.cancel();
      emit('model_retry',{attempt,status:response.status});
      await wait(Number.isFinite(delay)?delay:2000,deadline);
    }
  }
  return {api,within,wait,now,modelFetch};
}
