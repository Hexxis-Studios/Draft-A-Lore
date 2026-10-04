const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function api(){
  const readers=[],results=[],DAL={},source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8'),start=source.indexOf('DAL.readJSON ='),end=source.indexOf('\n};',start)+3;
  vm.runInNewContext(source.slice(start,end),{DAL,FileReader:class{constructor(){readers.push(this);}readAsText(file){this.file=file;if(file.throwOnRead)throw Error('Unavailable');}}});
  return{DAL,readers,results,read:file=>DAL.readJSON(file,(value,error)=>results.push({value,error}))};
}
test('backup reader rejects oversized files before allocating a FileReader',()=>{
  const qa=api();qa.read({size:32*1024*1024+1});assert.equal(qa.readers.length,0);assert.match(qa.results[0].error.message,/32 MB/);
});
test('backup reader preserves formatted chapter data and completes only once',()=>{
  const qa=api();qa.read({size:100});qa.readers[0].onload({target:{result:'{"projects":{"book":{"chapters":[{"id":"five","contentHTML":"<p><strong>Keep</strong></p>"}]}}}'}});qa.readers[0].onerror();assert.equal(qa.results.length,1);assert.equal(qa.results[0].value.projects.book.chapters[0].id,'five');assert.equal(qa.results[0].value.projects.book.chapters[0].contentHTML,'<p><strong>Keep</strong></p>');
});
test('backup reader refuses prototype properties and exposes malformed JSON safely',()=>{
  for(const json of ['{"__proto__":{"polluted":true}}','{"projects":{"constructor":{}}}','{bad']){const qa=api();qa.read({size:100});qa.readers[0].onload({target:{result:json}});assert.equal(qa.results[0].value,null);assert.ok(qa.results[0].error);}
  assert.equal({}.polluted,undefined);
});
test('backup reader reports cancellation, provider failure and synchronous read errors',()=>{
  for(const mode of ['abort','error','throw']){const qa=api();qa.read({size:100,throwOnRead:mode==='throw'});if(mode!=='throw')qa.readers[0][mode==='abort'?'onabort':'onerror']();assert.equal(qa.results.length,1);assert.equal(qa.results[0].value,null);assert.ok(qa.results[0].error);}
});
test('callback exceptions are not mistaken for parse errors or invoked a second time',()=>{
  const qa=api();let calls=0;qa.DAL.readJSON({size:2},()=>{calls++;throw Error('Caller failed');});assert.throws(()=>qa.readers[0].onload({target:{result:'{}'}}),/Caller failed/);assert.equal(calls,1);
});
