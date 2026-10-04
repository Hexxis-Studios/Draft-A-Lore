const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function api(){
  const store=new Map(),original={projectOrder:['old'],projects:{old:{id:'old',name:'Original'}},setting:'keep'},incoming={projectOrder:['new'],projects:{new:{id:'new',name:'Restored'}}},handles={old:{name:'Original folder'}},calls=[];
  const DAL={state:original,folderHandles:handles,clone:value=>JSON.parse(JSON.stringify(value)),normalizeWorkspace:value=>value,saveState:async()=>true,finishStateLoad(){},closeModal(){calls.push('close');},navigate(){calls.push('navigate');},toast(){calls.push('toast');}};
  const context={DAL,Date,localStorage:{setItem(key,value){store.set(key,value);},getItem:key=>store.get(key)}};
  const source=fs.readFileSync(path.join(__dirname,'../src/views.js'),'utf8'),start=source.indexOf('DAL.restoreWorkspaceSafely='),end=source.indexOf('\n};',start)+3;vm.runInNewContext(source.slice(start,end),context);
  return {DAL,original,incoming,handles,store,calls,context};
}
test('workspace restoration saves verified recovery and disconnects old folder handles',async()=>{
  const qa=api();assert.equal(await qa.DAL.restoreWorkspaceSafely(qa.incoming),true);assert.equal(qa.DAL.state.projects.new.name,'Restored');assert.equal(Object.keys(qa.DAL.folderHandles).length,0);assert.deepEqual(JSON.parse(Array.from(qa.store.values())[0]),qa.original);assert.equal(qa.DAL._workspaceRestoreBusy,false);
});
test('failed initial save preserves the workspace without publishing the backup',async()=>{
  const qa=api();qa.DAL.saveState=async()=>false;await assert.rejects(qa.DAL.restoreWorkspaceSafely(qa.incoming),/current workspace could not be saved/);assert.equal(qa.DAL.state,qa.original);assert.equal(qa.DAL.folderHandles,qa.handles);assert.equal(qa.store.size,0);assert.equal(qa.calls.length,0);
});
test('recovery quota failure prevents workspace replacement',async()=>{
  const qa=api();qa.context.localStorage.setItem=()=>{throw Error('Quota full');};await assert.rejects(qa.DAL.restoreWorkspaceSafely(qa.incoming),/Quota full/);assert.equal(qa.DAL.state,qa.original);assert.equal(qa.calls.length,0);
});
test('failed restore persistence rolls back an unchanged staged workspace',async()=>{
  const qa=api();let saves=0;qa.DAL.saveState=async()=>++saves!==2;await assert.rejects(qa.DAL.restoreWorkspaceSafely(qa.incoming),/restored workspace could not be saved/);assert.equal(qa.DAL.state,qa.original);assert.equal(qa.DAL.folderHandles,qa.handles);assert.equal(saves,3);assert.equal(qa.store.size,1);
});
test('a missing backup attachment leaves the original workspace intact',async()=>{
  const qa=api();qa.DAL.validateFolderAssets=async()=>{throw Error('Missing asset');};await assert.rejects(qa.DAL.restoreWorkspaceSafely(qa.incoming),/Missing asset/);assert.equal(qa.DAL.state,qa.original);assert.equal(qa.store.size,0);
});
test('edits made during failed restore saving are not rolled back',async()=>{
  const qa=api();let saves=0;qa.DAL.saveState=async()=>{if(++saves===2){qa.DAL.state.projects.new.name='Newer edit';return false;}return true;};await assert.rejects(qa.DAL.restoreWorkspaceSafely(qa.incoming),/Newer edits remain in memory/);assert.equal(qa.DAL.state.projects.new.name,'Newer edit');assert.equal(qa.store.size,1);
});

test('an initialization exception returns the previous workspace and its folders',async()=>{
  const qa=api();qa.DAL.finishStateLoad=()=>{if(qa.DAL.state!==qa.original)throw Error('Initialization failed');};await assert.rejects(qa.DAL.restoreWorkspaceSafely(qa.incoming),/Initialization failed/);assert.equal(qa.DAL.state,qa.original);assert.equal(qa.DAL.folderHandles,qa.handles);assert.equal(qa.DAL._workspaceRestoreBusy,false);
});

test('automatic version snapshots do not prevent failed-save rollback',async()=>{
  const qa=api(),source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8'),start=source.indexOf('DAL.checkVersionSnapshot ='),end=source.indexOf('\n};',start)+3;vm.runInNewContext(source.slice(start,end),qa.context);qa.DAL.currentProjectId='new';qa.incoming.projects.new.versions=[];let saves=0;qa.DAL.saveState=async()=>{qa.DAL.checkVersionSnapshot();return ++saves!==2;};await assert.rejects(qa.DAL.restoreWorkspaceSafely(qa.incoming),/restored workspace could not be saved/);assert.equal(qa.DAL.state,qa.original);assert.equal(saves,3);
});

test('a user-created version during failed restore persistence is preserved as newer work',async()=>{
  const qa=api();let saves=0;qa.DAL.saveState=async()=>{if(++saves===2){qa.DAL.state.projects.new.versions=[{auto:false,data:{name:'User snapshot'}}];return false;}return true;};await assert.rejects(qa.DAL.restoreWorkspaceSafely(qa.incoming),/Newer edits remain in memory/);assert.equal(qa.DAL.state.projects.new.versions[0].data.name,'User snapshot');
});

test('rollback persistence failure keeps original content and reports memory-only recovery',async()=>{
  const qa=api();let saves=0;qa.DAL.saveState=async()=>++saves===1;await assert.rejects(qa.DAL.restoreWorkspaceSafely(qa.incoming),/previous workspace is back in memory but could not be saved/);assert.equal(qa.DAL.state,qa.original);assert.equal(qa.DAL.folderHandles,qa.handles);
});

test('a recovery copy never overwrites an existing timestamp key',async()=>{
  const qa=api();qa.context.Date={now:()=>123};qa.store.set('draftALore-recovery-123','Existing recovery');await qa.DAL.restoreWorkspaceSafely(qa.incoming);assert.equal(qa.store.get('draftALore-recovery-123'),'Existing recovery');assert.deepEqual(JSON.parse(qa.store.get('draftALore-recovery-124')),qa.original);
});

test('workspace restore refuses an active folder transaction without touching data',async()=>{
  const qa=api();qa.DAL._folderRestoreBusy=true;await assert.rejects(qa.DAL.restoreWorkspaceSafely(qa.incoming),/folder operation to finish/);assert.equal(qa.DAL.state,qa.original);assert.equal(qa.DAL.folderHandles,qa.handles);assert.equal(qa.store.size,0);assert.equal(qa.DAL._workspaceRestoreBusy,undefined);
});
