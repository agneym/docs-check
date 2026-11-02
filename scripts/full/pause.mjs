// Host-only graceful stop control. Never copied into a worker.
// Prefer pause-request.json. Signal draining is safe only for signals delivered
// DIRECTLY to the Node PID: terminal Ctrl-C / hc interrupt may also signal QEMU
// in the same process group and must NOT be used to pause a paid run.
import {lstatSync,openSync,fstatSync,closeSync,constants,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

export function campaignPause(run) {
  let requested=false,acknowledged=false;
  const append=record=>writeFileSync(join(run,'pause-events.jsonl'),JSON.stringify({utc:new Date().toISOString(),...record})+'\n',{flag:'a',mode:0o600});
  const request=source=>{append({event:'request',source});requested=true;};
  const handlers=new Map(['SIGINT','SIGTERM'].map(signal=>[signal,()=>request(signal)]));
  for(const [signal,handler] of handlers)process.on(signal,handler);
  return {
    check() {
      if(!requested) {
        try {
          const path=join(run,'pause-request.json');
          let stat;
          try{stat=lstatSync(path);}catch(err){if(err.code==='ENOENT')return false;throw err;}
          if(!stat.isFile()){request('non-regular-pause-file');return true;}
          // Once observed, even disappearance/read failure requests a pause.
          let text,fd;
          try{
            fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
            if(!fstatSync(fd).isFile()){request('non-regular-pause-file');return true;}
            text=readFileSync(fd,'utf8');
          }catch{request('unreadable-pause-file');return true;}
          finally{if(fd!==undefined)closeSync(fd);}
          const value=JSON.parse(text);
          // Any present file requests a pause; invalid content fails closed too.
          request(value&&typeof value==='object'&&!Array.isArray(value)?'pause-file':'malformed-pause-file');
        } catch(err) {if(err.code!=='ENOENT')request('unreadable-or-malformed-pause-file');}
      }
      return requested;
    },
    acknowledge() {
      if(requested&&!acknowledged){append({event:'acknowledged'});acknowledged=true;console.log('PAUSE_ACKNOWLEDGED',run);}
    },
    close(){for(const [signal,handler] of handlers)process.removeListener(signal,handler);}
  };
}
