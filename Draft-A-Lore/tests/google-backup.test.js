const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function client(fetcher){
  const sandbox={DAL:{},window:{},URL,URLSearchParams,Blob,AbortController,Date,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/google-backup.js'),'utf8'),sandbox);
  const api=new sandbox.DAL.GoogleBackupClient(fetcher);api.authorize('test-token',3600);return api;
}

test('native Google backup accepts only the app-private grant and never persists tokens',async()=>{
  let disconnects=0;
  const api=client(async()=>{});
  const plugin={connect:async()=>({accessToken:'native-test-token',expiresIn:3000,scope:'https://www.googleapis.com/auth/drive.appdata'}),disconnect:async()=>{disconnects++;}};
  assert.equal(await api.connectNative(plugin),true);
  assert.equal(api.token,'native-test-token');
  api.disconnect();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(api.token,'');assert.equal(disconnects,1);
});

test('native Google consent cancellation ignores a late authorization result',async()=>{
  let complete,disconnects=0;
  const api=client(async()=>{});
  const pending=api.connectNative({connect:()=>new Promise(resolve=>{complete=resolve;}),disconnect:async()=>{disconnects++;}});
  await new Promise(resolve=>setImmediate(resolve));
  api.disconnect();await assert.rejects(pending,/cancelled/);
  complete({accessToken:'late-token',expiresIn:3000,scope:'https://www.googleapis.com/auth/drive.appdata'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(api.token,'');assert.equal(disconnects,1);
});

test('a cancelled native attempt failing late cannot disconnect a newer account',async()=>{
  let failOld,oldDisconnects=0,newDisconnects=0;const api=client(async()=>{});
  const old=api.connectNative({connect:()=>new Promise((resolve,reject)=>{failOld=reject;}),disconnect:async()=>{oldDisconnects++;}});
  await new Promise(resolve=>setImmediate(resolve));api.disconnect();await assert.rejects(old,/cancelled/);
  await api.connectNative({connect:async()=>({accessToken:'new-account-token',expiresIn:3000,scope:'https://www.googleapis.com/auth/drive.appdata'}),disconnect:async()=>{newDisconnects++;}});
  failOld(new Error('Old consent ended'));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(api.token,'new-account-token');assert.equal(oldDisconnects,1);assert.equal(newDisconnects,0);
});

test('native authorization refuses broader or missing grants and invalid token lifetimes',async()=>{
  for(const response of [null,{scope:'https://www.googleapis.com/auth/drive',accessToken:'token',expiresIn:3600},{scope:'https://www.googleapis.com/auth/drive.appdata',accessToken:'token',expiresIn:Infinity},{scope:'https://www.googleapis.com/auth/drive.appdata',accessToken:'token with spaces',expiresIn:3600}]){
    const api=client(async()=>{});let disconnects=0;
    await assert.rejects(api.connectNative({connect:async()=>response,disconnect:async()=>{disconnects++;}}));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(api.token,'');assert.equal(disconnects,1);
  }
});

test('disconnect cancels a backup while its response body is being read',async()=>{
  let release,signal;
  const api=client(async(url,options)=>{
    signal=options.signal;
    return {status:200,ok:true,json:()=>new Promise(resolve=>{release=resolve;})};
  });
  const pending=api.list();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(api.controllers.length,1);
  api.disconnect();
  assert.equal(signal.aborted,true);
  release({files:[]});
  await assert.rejects(pending,/cancelled/);
  assert.equal(api.controllers.length,0);
});
test('Google backup refuses expired authorization before transmitting',async()=>{
  let calls=0;const api=client(async()=>{calls++;});api.expiresAt=0;
  await assert.rejects(api.list(),/Reconnect/);assert.equal(calls,0);
});
test('Google backup refuses off-domain upload addresses without leaking authorization',async()=>{
  let calls=0;const api=client(async()=>{calls++;return new Response('',{headers:{Location:'https://example.com/upload'}});});
  await assert.rejects(api.upload('Book',new Blob(['backup']),'project'),/unsafe/);assert.equal(calls,1);
});
test('Google backup uses immutable private-folder uploads and transfers exact bytes',async()=>{
  const calls=[];const api=client(async(url,options)=>{
    calls.push({url,options});
    if(calls.length===1)return new Response('',{headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=session'}});
    return Response.json({id:'backup-id'});
  });
  const bytes=new Blob(['full project']);await api.upload('Book',bytes,'project');
  const metadata=JSON.parse(calls[0].options.body);
  assert.deepEqual(metadata.parents,['appDataFolder']);assert.equal(metadata.appProperties.draftalore,'bundle-v1');assert.match(metadata.name,/\.zip$/);
  assert.equal(calls[0].options.method,'POST');assert.equal(calls[1].options.method,'PUT');
  assert.equal(await calls[1].options.body.text(),await bytes.text());assert.equal(calls[1].options.redirect,'error');
});
test('Google backup paginates only its own app-data files',async()=>{
  let calls=0;const api=client(async url=>{
    const query=new URL(url).searchParams;assert.equal(query.get('spaces'),'appDataFolder');
    calls++;return Response.json(calls===1?{files:[{id:'one'}],nextPageToken:'next'}:{files:[{id:'two'}]});
  });
  assert.equal((await api.list()).length,2);assert.equal(calls,2);
});
test('Google backup does not import an incomplete download',async()=>{
  let calls=0;const api=client(async()=>++calls===1?Response.json({size:'20',mimeType:'application/zip',appProperties:{draftalore:'bundle-v1'}}):new Response('short'));
  await assert.rejects(api.download('backup-id'),/incomplete/);
});

test('Google backup rejects invalid declared sizes before downloading',async()=>{
  for(const size of ['-1','1.5','NaN','Infinity','536870913']){
    let calls=0;
    const api=client(async()=>{calls++;return Response.json({size,mimeType:'application/zip',appProperties:{draftalore:'bundle-v1'}});});
    await assert.rejects(api.download('backup-id'),/supported size/);
    assert.equal(calls,1);
  }
});

test('oversized cloud download stops reading and cancels its stream',async()=>{
  let calls=0,reads=0,cancelled=false,released=false;
  const api=client(async()=>++calls===1?Response.json({size:'3',mimeType:'application/zip',appProperties:{draftalore:'bundle-v1'}}):{
    status:200,ok:true,body:{getReader:()=>({read:async()=>{reads++;return {done:false,value:new Uint8Array(4)};},cancel:async()=>{cancelled=true;},releaseLock:()=>{released=true;}})}
  });
  await assert.rejects(api.download('backup-id'),/larger/);
  assert.equal(reads,1);assert.equal(cancelled,true);assert.equal(released,true);
});

test('cloud download preserves complete bytes and validates the ZIP size',async()=>{
  let calls=0;
  const api=client(async()=>++calls===1?Response.json({size:'7',mimeType:'application/zip',appProperties:{draftalore:'bundle-v1'}}):new Response('archive'));
  const blob=await api.download('backup-id');
  assert.equal(await blob.text(),'archive');assert.equal(blob.type,'application/zip');
});
test('Google authorization failure clears in-memory credentials',async()=>{
  const api=client(async()=>new Response('',{status:401}));
  await assert.rejects(api.list(),/expired/);assert.equal(api.token,'');assert.equal(api.controllers.length,0);
});

test('large Google backups send bounded chunks and respect acknowledged offsets',async()=>{
  let calls=0;const ranges=[];const blob=new Blob([new Uint8Array(4*1024*1024+10)]);
  const api=client(async(url,options)=>{
    if(++calls===1)return new Response('',{headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=session'}});
    ranges.push(options.headers['Content-Range']);
    assert.ok(options.body.size<=4*1024*1024);
    if(calls===2)return new Response('',{status:308,headers:{Range:'bytes=0-4194303'}});
    return Response.json({id:'complete'});
  });
  assert.equal((await api.upload('Book',blob,'project')).id,'complete');
  assert.deepEqual(ranges,['bytes 0-4194303/4194314','bytes 4194304-4194313/4194314']);
});

test('stalled Google upload acknowledgments fail instead of looping forever',async()=>{
  let calls=0;const api=client(async()=>++calls===1?new Response('',{headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=session'}}):new Response('',{status:308}));
  await assert.rejects(api.upload('Book',new Blob(['backup']),'project'),/acknowledge/);
  assert.equal(calls,2);
});

test('Google connection requests only backup access and keeps authorization in memory',async()=>{
  const api=client(async()=>{});let requested;
  const provider={hasGrantedAllScopes(response,scope){return response.scope===scope;},initTokenClient(options){requested=options;return {requestAccessToken(){options.callback({access_token:'granted',expires_in:3600,scope:options.scope});}};}};
  assert.equal(await api.connect('public-client.apps.googleusercontent.com',provider),true);
  assert.equal(requested.scope,'https://www.googleapis.com/auth/drive.appdata');
  assert.equal(requested.include_granted_scopes,false);assert.equal(api.token,'granted');
});

test('disconnect cancels pending Google connection and ignores late authorization',async()=>{
  const api=client(async()=>{});let callback;
  const provider={hasGrantedAllScopes(){return true;},initTokenClient(options){callback=options.callback;return {requestAccessToken(){}};}};
  const pending=api.connect('public-client.apps.googleusercontent.com',provider);
  api.disconnect();await assert.rejects(pending,/cancelled/);
  callback({access_token:'late',expires_in:3600});assert.equal(api.token,'');
});

test('partial Google consent does not authorize backup requests',async()=>{
  const api=client(async()=>{});
  const provider={hasGrantedAllScopes(){return false;},initTokenClient(options){return {requestAccessToken(){options.callback({access_token:'partial',expires_in:3600});}};}};
  await assert.rejects(api.connect('public-client.apps.googleusercontent.com',provider),/not granted/);
  assert.equal(api.token,'');
});

test('Google backup rejects unexpected ports and URL fragments before sending credentials',async()=>{
  let calls=0;const api=client(async()=>{calls++;});
  for(const url of ['https://www.googleapis.com:8443/drive/v3/files','https://www.googleapis.com/drive/v3/files#unexpected'])
    await assert.rejects(api.request(url),/unsafe/);
  assert.equal(calls,0);
});

test('disconnect rejects an in-flight response even if the transport ignores abort',async()=>{
  let finish;const api=client(()=>new Promise(resolve=>{finish=resolve;}));
  const pending=api.list();api.disconnect();
  finish(Response.json({files:[{id:'late'}]}));
  await assert.rejects(pending,/cancelled/);
  assert.equal(api.token,'');assert.equal(api.controllers.length,0);
});

test('Google backup lists are bounded and reject malformed continuation tokens',async()=>{
  let calls=0;const api=client(async()=>Response.json({files:[],nextPageToken:'page-'+(++calls)}));
  await assert.rejects(api.list(),/5,000-file safety limit/);assert.equal(calls,50);
  for(const nextPageToken of [{},'x'.repeat(4097)]){
    const malformed=client(async()=>Response.json({files:[],nextPageToken}));await assert.rejects(malformed.list(),/invalid backup list/);
  }
});

test('prototype-like backup pagination tokens cannot cause a false repeated-page error',async()=>{
  let calls=0;const api=client(async()=>Response.json(++calls===1?{files:[],nextPageToken:'__proto__'}:{files:[]}));
  assert.equal((await api.list()).length,0);assert.equal(calls,2);
});

test('cloud uploads require a well-formed completion identifier and matching declared size',async()=>{
  for(const result of [null,{id:{}},{id:'complete',size:'100'}]){
    let calls=0;const api=client(async()=>++calls===1?new Response('',{headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=session'}}):Response.json(result));
    await assert.rejects(api.upload('Book',new Blob(['backup']),'project'),/confirm|different backup size/);assert.equal(calls,2);
  }
});
