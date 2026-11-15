const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
function make(storage){
  const values=new Map(Object.entries(storage||{}));
  const localStorage={getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,value)};
  const DAL={storageHealth:{},setSaveStatus(){},toast(){}};
  const context={DAL,window:{localStorage},Date,Promise};
  const start=source.indexOf('DAL.preserveDamagedWorkspace ='),end=source.indexOf('DAL.loadState =',start);
  vm.runInNewContext(source.slice(start,end),context);
  const saveStart=source.indexOf('DAL._doSave = function(){'),saveEnd=source.indexOf('  try{',saveStart);
  vm.runInNewContext(source.slice(saveStart,saveEnd)+'};',context);
  return {DAL,values,localStorage};
}
test('damaged bytes are verified and existing recovery copies are preserved',()=>{
  const q=make(); assert.equal(q.DAL.preserveDamagedWorkspace('{bad'),true);
  assert.equal(q.DAL.preserveDamagedWorkspace('{other'),true);
  assert.deepEqual([...q.values.values()],['{bad','{other']);
});
test('quota failure blocks saves without touching the damaged original',async()=>{
  const q=make({draftALore:'{bad'});q.localStorage.setItem=()=>{throw Error('Quota full');};
  assert.equal(q.DAL.preserveDamagedWorkspace('{bad'),false);
  assert.equal(await q.DAL._doSave(),false);
  assert.equal(q.values.get('draftALore'),'{bad');
  assert.equal(q.DAL.storageHealth.mode,'memory');
});
test('a silently rejected recovery copy also pauses saving',async()=>{
  const q=make();q.localStorage.setItem=()=>{};
  assert.equal(q.DAL.preserveDamagedWorkspace('{bad'),false);
  assert.equal(await q.DAL._doSave(),false);
});

test('loading damaged local data with a full disk keeps both original stores untouched',async()=>{
  const q=make({draftALore:'{bad',draftALoreSavedAt:'1'}), writes=[];
  q.localStorage.setItem=()=>{throw Error('Quota full');};
  Object.assign(q.DAL,{_initStorage(){},_storage:{getItem:key=>q.localStorage.getItem(key)},normalizeWorkspace:JSON.parse,stateDB:{get:async()=>({json:'{"projects":{},"projectOrder":[]}',savedAt:2}),put:async()=>writes.push('db')},defaultState:()=>({projects:{},projectOrder:[]}),finishStateLoad(){}});
  const ctx={DAL:q.DAL,window:{localStorage:q.localStorage},Date,Promise,Blob};
  const start=source.indexOf('DAL.loadState = function(){'),end=source.indexOf('\nDAL.saveState =',start);
  vm.runInNewContext(source.slice(start,end),ctx);
  await q.DAL.loadState();
  assert.match(q.DAL._loadWarning,/Saving is paused/);
  assert.equal(await q.DAL._doSave(),false);
  assert.equal(q.values.get('draftALore'),'{bad');
  assert.deepEqual(writes,[]);
});
test('loading damaged IndexedDB data with a full disk does not overwrite either copy',async()=>{
  const good=JSON.stringify({projects:{},projectOrder:[]}),q=make({draftALore:good,draftALoreSavedAt:'1'}),writes=[];
  q.localStorage.setItem=()=>{throw Error('Quota full');};
  Object.assign(q.DAL,{_initStorage(){},_storage:{getItem:key=>q.localStorage.getItem(key)},normalizeWorkspace:JSON.parse,stateDB:{get:async()=>({json:'{bad',savedAt:2}),put:async()=>writes.push('db')},defaultState:()=>({}),finishStateLoad(){}});
  const ctx={DAL:q.DAL,window:{localStorage:q.localStorage},Date,Promise,Blob};
  const start=source.indexOf('DAL.loadState = function(){'),end=source.indexOf('\nDAL.saveState =',start);
  vm.runInNewContext(source.slice(start,end),ctx);
  await q.DAL.loadState();
  assert.match(q.DAL._loadWarning,/Saving is paused/);
  assert.equal(await q.DAL._doSave(),false);
  assert.equal(q.values.get('draftALore'),good);
  assert.deepEqual(writes,[]);
});
