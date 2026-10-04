const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function api(native=true){
  const calls=[],messages=[],chunks=[],revoked=[];
  const plugin={begin:async options=>{calls.push(['begin',options]);return{token:'active'};},append:async options=>{calls.push(['append',options.offset]);chunks.push(Buffer.from(options.data,'base64'));return{written:options.offset+chunks.at(-1).length};},save:async options=>{calls.push(['save',options]);return{saved:true};},abort:async options=>{calls.push(['abort',options]);}};
  const DAL={toast:(...message)=>messages.push(message)};
  const sandbox={DAL,window:native?{Capacitor:{getPlatform:()=> 'android',Plugins:{FileExport:plugin}}}:{},document:{body:{appendChild:()=>calls.push(['appendLink'])},createElement:()=>({click:()=>calls.push(['click']),remove:()=>calls.push(['remove'])})},URL:{createObjectURL:()=> 'blob:export',revokeObjectURL:url=>revoked.push(url)},setTimeout:callback=>callback(),FileReader:class{readAsDataURL(blob){blob.arrayBuffer().then(bytes=>{this.result='data:application/octet-stream;base64,'+Buffer.from(bytes).toString('base64');this.onload();});}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/native-export.js'),'utf8'),sandbox);
  return{DAL,plugin,calls,messages,chunks,revoked,sandbox};
}

test('injected Android bridge without registerPlugin exports bounded ordered binary chunks',async()=>{
  const qa=api(),bytes=Buffer.alloc(600000);for(let index=0;index<bytes.length;index++)bytes[index]=index%251;
  assert.equal(await qa.DAL.saveExportBlob('world.dalz',new Blob([bytes],{type:'application/zip'})),true);
  assert.deepEqual(Buffer.concat(qa.chunks),bytes);assert.ok(qa.chunks.every(chunk=>chunk.length<=256*1024));assert.deepEqual(qa.calls.filter(call=>call[0]==='append').map(call=>call[1]),[0,262144,524288]);assert.equal(qa.calls.at(-1)[0],'save');assert.equal(qa.DAL._nativeExportBusy,false);
});

test('bundled Capacitor registrar remains supported when injected plugin is absent',async()=>{
  const qa=api();delete qa.sandbox.window.Capacitor.Plugins;
  qa.sandbox.window.Capacitor.registerPlugin=name=>{assert.equal(name,'FileExport');return qa.plugin;};
  assert.equal(await qa.DAL.saveExportBlob('notes.txt',new Blob(['Notes'])),true);
});

test('native cancellation is not reported as a successful export',async()=>{
  const qa=api();qa.plugin.save=async()=>({cancelled:true});assert.equal(await qa.DAL.saveExportBlob('notes.txt',new Blob(['Notes'])),false);assert.ok(qa.messages.some(message=>/cancelled/.test(message[0])));assert.equal(qa.messages.filter(message=>message[1]==='success').length,0);assert.equal(qa.DAL._nativeExportBusy,false);
});

test('incomplete native chunk acknowledgement aborts staging without opening the picker',async()=>{
  const qa=api();qa.plugin.append=async()=>({written:0});assert.equal(await qa.DAL.saveExportBlob('notes.txt',new Blob(['Notes'])),false);assert.equal(qa.calls.at(-1)[0],'abort');assert.equal(qa.calls.filter(call=>call[0]==='save').length,0);assert.equal(qa.DAL._nativeExportBusy,false);
});

test('native provider failure reports an error and frees the export slot',async()=>{
  const qa=api();qa.plugin.save=async()=>{throw Error('No space');};assert.equal(await qa.DAL.saveExportBlob('notes.txt',new Blob(['Notes'])),false);assert.match(qa.messages.at(-1)[0],/No space/);assert.equal(qa.calls.at(-1)[0],'abort');assert.equal(qa.DAL._nativeExportBusy,false);
});

test('a second native export cannot replace the first pending Save File picker',async()=>{
  const qa=api();let resolveSave;qa.plugin.save=()=>new Promise(resolve=>{resolveSave=resolve;});const first=qa.DAL.saveExportBlob('first.txt',new Blob([]));await new Promise(resolve=>setImmediate(resolve));assert.equal(await qa.DAL.saveExportBlob('second.txt',new Blob(['Second'])),false);assert.equal(qa.calls.filter(call=>call[0]==='begin').length,1);resolveSave({saved:true});assert.equal(await first,true);
});

test('oversized Android exports fail before transfer or picker creation',async()=>{
  const qa=api();assert.equal(await qa.DAL.saveExportBlob('large.dalz',{size:256*1024*1024+1}),false);assert.equal(qa.calls.length,0);
});

test('browser exports retain the download path and release object URLs',async()=>{
  const qa=api(false);assert.equal(await qa.DAL.saveExportBlob('notes.txt',new Blob(['Notes'])),true);assert.deepEqual(qa.calls.map(call=>call[0]),['appendLink','click','remove']);assert.deepEqual(qa.revoked,['blob:export']);
});

test('browser download failure does not leave its link or object URL behind',async()=>{
  const qa=api(false);qa.sandbox.document.createElement=()=>({click(){throw Error('Blocked');},remove:()=>qa.calls.push(['remove'])});assert.equal(await qa.DAL.saveExportBlob('notes.txt',new Blob(['Notes'])),false);assert.deepEqual(qa.revoked,['blob:export']);assert.ok(qa.calls.some(call=>call[0]==='remove'));assert.match(qa.messages[0][0],/Blocked/);
});

test('browser Save File fallback survives rerender and replaces old links with bounded URL cleanup',()=>{
  const nodes=[],timers=[],revoked=[],renderHooks=[],container={appendChild(node){nodes.push(node);node.isConnected=true;}};
  function element(){return{children:[],handlers:{},setAttribute(){},appendChild(node){this.children.push(node);},addEventListener(name,handler){this.handlers[name]=handler;},remove(){this.isConnected=false;}};}
  const DAL={registerAfterRender:hook=>renderHooks.push(hook)},sandbox={DAL,window:{},document:{createElement:element,getElementById:()=>container},URL:{revokeObjectURL:url=>revoked.push(url)},setTimeout:(callback,time)=>{timers.push({callback,time});return timers.length;},clearTimeout(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/native-export.js'),'utf8'),sandbox);
  DAL.offerDownload('<private>.epub','blob:first',container);assert.equal(nodes[0].children[0].textContent,'Export ready: <private>.epub');assert.equal(nodes[0].children[1].download,'<private>.epub');nodes[0].isConnected=false;renderHooks[0]();assert.equal(nodes.length,2);
  DAL.offerDownload('second.epub','blob:second',container);assert.equal(nodes[0].isConnected,false);assert.ok(timers.some(timer=>timer.time===120000));timers.find(timer=>timer.time===1000).callback();assert.deepEqual(revoked,['blob:first']);const fallback=DAL._downloadFallback;fallback.notice.children[2].handlers.click();assert.equal(DAL._downloadFallback,null);assert.equal(fallback.notice.isConnected,false);
});
