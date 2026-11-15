const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function api(){const document={addEventListener(){},getElementById(){return null;}};const sandbox={DAL:{},document,window:{},navigator:{},localStorage:{},indexedDB:{},console,Date,Blob,Promise,setTimeout,clearTimeout,Uint8Array,atob,File:class File{constructor(parts,name,options){this.parts=parts;this.name=name;this.type=options.type;}}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src','core.js'),'utf8'),sandbox);const DAL=sandbox.DAL;DAL.state=DAL.defaultState();DAL.handleStoryClick=function(){};DAL.render=function(){};DAL.toast=function(){};DAL.ensureAssets=function(project){project.assets=project.assets||{};};vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src','library.js'),'utf8'),sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src','sync-tools.js'),'utf8'),sandbox);return DAL;}

test('shared-folder sync stops when a remote copy changed',async()=>{const DAL=api(),project=DAL.defaultProject('Book','novel'),handle={checkedInitial:true};project.updatedAt=20;project.sync={mode:'shared',lastRemoteUpdatedAt:10,lastLocalUpdatedAt:15};DAL.readLinkedProject=async()=>({project:{id:project.id,updatedAt:30},updatedAt:30,data:{}});const allowed=await DAL.prepareFolderSync(project,handle);assert.equal(allowed,false);assert.equal(DAL.folderSyncHealth.status,'conflict');assert.equal(DAL._syncConflicts[project.id].updatedAt,30);});

test('known remote revision allows a local write without a false conflict',async()=>{const DAL=api(),project=DAL.defaultProject('Book','novel'),handle={checkedInitial:true};project.sync={mode:'shared',lastRemoteUpdatedAt:30,lastLocalUpdatedAt:20};DAL.readLinkedProject=async()=>({project:{id:project.id,updatedAt:30},updatedAt:30,data:{}});assert.equal(await DAL.prepareFolderSync(project,handle),true);});

test('backup mode avoids repeated folder reads after its safety check',async()=>{const DAL=api(),project=DAL.defaultProject('Book','novel'),handle={checkedInitial:true},original=DAL.readLinkedProject;let reads=0;DAL.readLinkedProject=async()=>{reads++;return original(project,handle);};assert.equal(await DAL.prepareFolderSync(project,handle),true);assert.equal(reads,0);});

test('failed folder asset loading preserves the local project and conflict',async()=>{
  const DAL=api(),local=DAL.defaultProject('Local book','novel'),handle={checkedInitial:false};
  DAL.state.projects[local.id]=local;
  const remote={project:JSON.parse(JSON.stringify(local)),data:{},updatedAt:30};remote.project.name='Remote book';
  DAL._syncConflicts[local.id]=remote;
  DAL.saveState=async()=>true;
  DAL.readAssetsFolder=async()=>{throw new Error('Folder access revoked');};
  await assert.rejects(DAL.applyRemoteProject(local,remote,handle),/access revoked/);
  assert.equal(DAL.state.projects[local.id],local);
  assert.equal(DAL._syncConflicts[local.id],remote);
  assert.equal(handle.checkedInitial,false);
});

test('overwrite refuses a folder revision that changed after review',async()=>{
  const DAL=api(),local=DAL.defaultProject('Book','novel'),handle={};DAL.state.projects[local.id]=local;DAL.folderHandles[local.id]=handle;
  const conflict={project:{id:local.id,updatedAt:20,name:'Reviewed'},data:{}};DAL.readLinkedProject=async()=>({project:{...conflict.project,name:'Newer'},data:{}});let writes=0;DAL.writeFile=async()=>writes++;
  await assert.rejects(DAL.keepLocalFolderVersion(local,conflict,handle),/changed since/);assert.equal(writes,0);assert.equal(handle.checkedInitial,false);
});

test('explicit overwrite preserves remote metadata before queuing a write',async()=>{
  const DAL=api(),local=DAL.defaultProject('Book','novel'),handle={};DAL.state.projects[local.id]=local;DAL.folderHandles[local.id]=handle;
  const conflict={project:{id:local.id,updatedAt:20,name:'Reviewed'},data:{project:{id:local.id,name:'Reviewed'},linkedBible:{id:'world'}}};DAL.readLinkedProject=async()=>conflict;DAL.saveState=async()=>true;
  let file,queued=0;DAL.writeFile=async(root,name,text)=>{file={root,name,data:JSON.parse(text)};};DAL.queueFolderSync=()=>queued++;
  await DAL.keepLocalFolderVersion(local,conflict,handle);assert.equal(file.root,handle);assert.match(file.name,/^project-before-overwrite-.*\.json$/);assert.equal(file.data.linkedBible.id,'world');assert.equal(queued,1);assert.equal(handle.checkedInitial,false);
});

test('shared sync detects different contents even when the timestamp is unchanged',async()=>{
  const DAL=api(),local=DAL.defaultProject('Book','novel'),handle={checkedInitial:true};local.sync.mode='shared';local.sync.lastRemoteUpdatedAt=20;
  const old={project:{id:local.id,updatedAt:20,name:'Original'},data:{}},newer={project:{...old.project,name:'Changed'},data:{}};
  handle.remoteRevision=DAL.folderRevision(old);DAL.readLinkedProject=async()=>newer;
  assert.equal(await DAL.prepareFolderSync(local,handle),false);assert.equal(DAL._syncConflicts[local.id],newer);
});

test('folder reads reject unsafe objects and oversized project metadata',async()=>{
  const DAL=api(),project=DAL.defaultProject('Book','novel');
  function handle(text){return{getFileHandle:async()=>({getFile:async()=>({text:async()=>text})})};}
  await assert.rejects(DAL.readLinkedProject(project,handle('{"__proto__":{}}')),/unsafe property/);
  await assert.rejects(DAL.readLinkedProject(project,handle('{"project":[]}')),/not a Draft A Lore/);
  await assert.rejects(DAL.readLinkedProject(project,handle(' '.repeat(32*1024*1024+1))),/32 MB/);
});

test('failed restore persistence rolls back the local project and suppression flag',async()=>{
  const DAL=api(),local=DAL.defaultProject('Local book','novel'),handle={checkedInitial:false};
  DAL.state.projects[local.id]=local;
  DAL._suppressFolderSync=true;
  DAL.saveState=async()=>{throw new Error('Storage full');};
  await assert.rejects(DAL.applyRemoteProject(local,{project:JSON.parse(JSON.stringify(local)),data:{},updatedAt:30},handle),/Storage full/);
  assert.equal(DAL.state.projects[local.id],local);
  assert.equal(DAL._suppressFolderSync,true);
  assert.equal(handle.checkedInitial,false);
});

test('memory-only save is not reported as a completed folder restore',async()=>{
  const DAL=api(),local=DAL.defaultProject('Original','novel'),handle={checkedInitial:false};
  DAL.state.projects[local.id]=local;
  DAL.saveState=async()=>false;
  await assert.rejects(DAL.applyRemoteProject(local,{project:JSON.parse(JSON.stringify(local)),data:{},updatedAt:30},handle),/could not be saved/);
  assert.equal(DAL.state.projects[local.id],local);
  assert.equal(handle.checkedInitial,false);
});

test('Android restore refuses missing assets instead of silently breaking bindings',async()=>{
  const DAL=api();DAL.ASSET_FOLDERS=[{key:'images',dir:'Images'}];
  DAL.nativeFolderPlugin=()=>({readFile:async()=>({exists:false})});DAL.importAssetFile=async()=>({id:'new'});
  await assert.rejects(DAL.nativePullAssets({id:'p',assets:{images:[{id:'old',name:'cover.png'}]}}),/missing asset/);
});

test('Android restore retains inline assets without requesting external files',async()=>{
  const DAL=api();DAL.ASSET_FOLDERS=[{key:'svgs',dir:'Vectors'}];let reads=0;
  DAL.nativeFolderPlugin=()=>({readFile:async()=>{reads++;}});DAL.importAssetFile=async()=>({id:'new'});
  assert.equal(await DAL.nativePullAssets({id:'p',assets:{svgs:[{id:'old',name:'art.svg',inline:'<svg/>'}]}}),0);
  assert.equal(reads,0);
});

test('workspace restore blocks folder replacement, overwrite and copy import',async()=>{
  const DAL=api(),local=DAL.defaultProject('Original','novel'),handle={},remote={project:JSON.parse(JSON.stringify(local)),data:{}};DAL.state.projects[local.id]=local;DAL.folderHandles[local.id]=handle;DAL._workspaceRestoreBusy=true;
  await assert.rejects(DAL.applyRemoteProject(local,remote,handle),/workspace restore/);await assert.rejects(DAL.keepLocalFolderVersion(local,remote,handle),/restore operation/);await assert.rejects(DAL.importRemoteFolderCopy(local,remote,handle),/restore operation/);assert.equal(DAL.state.projects[local.id],local);assert.equal(DAL._folderRestoreBusy,undefined);
});

test('folder copy import releases its lock and refuses a disconnected destination',async()=>{
  const DAL=api(),local=DAL.defaultProject('Original','novel'),handle={},remote={project:JSON.parse(JSON.stringify(local)),data:{}};DAL.state.projects[local.id]=local;DAL.folderHandles[local.id]=handle;let imported=0;DAL.finishImportedProject=async()=>{imported++;};DAL.readAssetsFolder=async()=>{delete DAL.folderHandles[local.id];return 0;};
  await assert.rejects(DAL.importRemoteFolderCopy(local,remote,handle),/linked folder changed/);assert.equal(imported,0);assert.equal(DAL._folderRestoreBusy,false);assert.equal(DAL.state.projects[local.id],local);
});

test('folder copy lock remains held until durable import finishes',async()=>{
  const DAL=api(),local=DAL.defaultProject('Original','novel'),handle={},remote={project:JSON.parse(JSON.stringify(local)),data:{}};DAL.state.projects[local.id]=local;DAL.folderHandles[local.id]=handle;DAL.readAssetsFolder=async()=>0;let finish;DAL.finishImportedProject=()=>new Promise(resolve=>{finish=resolve;});
  const operation=DAL.importRemoteFolderCopy(local,remote,handle);for(let turn=0;turn<10&&!finish;turn++)await Promise.resolve();assert.equal(DAL._folderRestoreBusy,true);await assert.rejects(DAL.importRemoteFolderCopy(local,remote,handle),/restore operation/);finish('Completed');assert.equal(await operation,'Completed');assert.equal(DAL._folderRestoreBusy,false);
});

test('folder sync retains Unicode names and avoids duplicate character, lore and plot paths',async()=>{
  const DAL=api(),p=DAL.defaultProject('World','novel');p.chapters=[];
  p.characters=[{name:'暗黑编年史',backstory:'one'},{name:'暗黑编年史',backstory:'two'}];
  p.lore={entries:[{folder:'世界',title:'Сага о Севере',content:'first'},{folder:'世界',title:'Сага о Севере',content:'second'}]};
  p.plots=[{title:'Café Ñandú',description:'plot one'},{title:'Café Ñandú',description:'plot two'}];
  DAL.currentProjectId=p.id;DAL.state.projects[p.id]=p;DAL.folderHandles[p.id]={};DAL.prepareFolderSync=async()=>true;DAL.finishFolderSync=()=>{};
  const written=new Map();DAL.getDir=async(parent,name)=>({path:(parent.path||'')+'/'+name});DAL.writeFile=async(dir,name,value)=>{const key=(dir.path||'')+'/'+name;assert.equal(written.has(key),false,'duplicate '+key);written.set(key,value);};
  assert.equal(await DAL.syncFolder(),true);
  assert.equal(written.get('/characters/01-暗黑编年史.txt'),'one');assert.equal(written.get('/characters/02-暗黑编年史.txt'),'two');
  assert.equal(written.get('/lore/世界/01-сага_о_севере.txt'),'first');assert.equal(written.get('/lore/世界/02-сага_о_севере.txt'),'second');
  assert.equal(written.get('/plots/01-café_ñandú.txt'),'plot one');assert.equal(written.get('/plots/02-café_ñandú.txt'),'plot two');
});
test('filenames avoid empty and Windows reserved names',()=>{const DAL=api();assert.equal(DAL.sanitizeFilename('CON'),'_con');assert.equal(DAL.sanitizeFilename('???'),'untitled');assert.equal(DAL.sanitizeFilename('A Story!'),'a_story_');});
