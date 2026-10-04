const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

test('import normalization supplies missing status without losing custom status or formatted chapters',()=>{
  const DAL=api(),project=DAL.defaultProject('Imported','novel');delete project.status;project.chapters=[{id:'five',title:'Chapter Five',contentHTML:'<p><strong>Keep this</strong></p>'}];const normalized=DAL.normalizeProject(project,false);assert.equal(normalized.status,'development');assert.equal(normalized.chapters[0].id,'five');assert.equal(normalized.chapters[0].contentHTML,'<p><strong>Keep this</strong></p>');normalized.status='Awaiting editor';assert.equal(DAL.normalizeProject(normalized,false).status,'Awaiting editor');
});

test('manuscript direction is independent of the interface without rewriting formatted prose',()=>{
  const DAL=api();
  for(const explicit of [null,'ltr','rtl','auto']){
    const attributes={dir:explicit},html='<p dir="rtl"><strong>نص</strong> English</p>';
    const editor={innerHTML:html,getAttribute:key=>attributes[key],setAttribute:(key,value)=>{attributes[key]=value;}};
    DAL.applyWritingDirection(editor);
    assert.equal(attributes.dir,explicit||'auto');assert.equal(editor.innerHTML,html);
    DAL.applyWritingDirection(editor);assert.equal(attributes.dir,explicit||'auto');
  }
});

test('project snapshots exclude live histories before cloning and preserve authored content',()=>{
  const DAL=api(),project={name:'Book',chapters:[{id:'one',contentHTML:'<p>Keep this</p>'}],history:[],redoStack:[],versions:[]};
  project.history.push(project);
  project.folderHandle={live:true};
  const snapshot=DAL.snapshotProject(project);
  assert.equal(snapshot.chapters[0].contentHTML,'<p>Keep this</p>');
  assert.equal(snapshot.history,undefined);assert.equal(snapshot.redoStack,undefined);assert.equal(snapshot.versions,undefined);
  assert.equal(project.history[0],project);assert.equal(project.folderHandle.live,true);
  snapshot.chapters[0].contentHTML='Changed';assert.equal(project.chapters[0].contentHTML,'<p>Keep this</p>');
});

test('recovery versions capture same-word-count revisions and avoid scanning before due',()=>{
  const DAL=api(),project=DAL.defaultProject('Book','novel');
  project.chapters=[{id:'one',contentHTML:'First sentence.'}];
  DAL.state.projects[project.id]=project;DAL.currentProjectId=project.id;
  let counts=0;DAL.getProjectWordCount=()=>{counts++;return {total:2};};
  DAL.checkVersionSnapshot();assert.equal(project.versions.length,1);
  project.chapters[0].contentHTML='Changed sentence.';
  DAL.checkVersionSnapshot();assert.equal(counts,1);assert.equal(project.versions.length,1);
  project.versions[0].ts=Date.now()-600001;
  DAL.checkVersionSnapshot();assert.equal(project.versions.length,2);
  assert.equal(project.versions[1].data.chapters[0].contentHTML,'Changed sentence.');
  project.versions[1].ts=Date.now()-600001;
  DAL.checkVersionSnapshot();assert.equal(project.versions.length,2);assert.equal(counts,2);
});

test('recovery snapshots track RPG changes independently across equal-word-count projects',()=>{
  const DAL=api(),first=DAL.defaultProject('First','dual'),second=DAL.defaultProject('Second','dual');
  DAL.state.projects[first.id]=first;DAL.state.projects[second.id]=second;
  DAL.getProjectWordCount=()=>({total:10});
  DAL.currentProjectId=first.id;DAL.checkVersionSnapshot();
  DAL.currentProjectId=second.id;DAL.checkVersionSnapshot();
  assert.equal(first.versions.length,1);assert.equal(second.versions.length,1);
  first.characters=[{id:'hero',name:'Mira',status:'alive'}];
  first.adventure.nodes=[{id:'scene',text:'An unchanged passage',choices:[{targetId:'ending'}]}];
  first.versions[0].ts=Date.now()-600001;
  DAL.currentProjectId=first.id;DAL.checkVersionSnapshot();
  assert.equal(first.versions.length,2);assert.equal(second.versions.length,1);
  const recovered=first.versions[1].data;
  assert.equal(recovered.characters[0].name,'Mira');
  assert.equal(recovered.adventure.nodes[0].choices[0].targetId,'ending');
  first.characters[0].status='dead';
  assert.equal(recovered.characters[0].status,'alive');
});

test('legacy snapshot restore cannot overwrite live undo or versions and removes later content fields',()=>{
  const DAL=api(),history=[{name:'Before restore'}],versions=[{ts:1}],project={name:'Current',history,versions,redoStack:[],laterField:'new'};
  DAL.applySnapshot(project,{name:'Restored',history:[{name:'obsolete'}],versions:[],chapters:[]});
  assert.equal(project.name,'Restored');assert.equal(project.history,history);assert.equal(project.versions,versions);
  assert.equal(project.laterField,undefined);
});

test('snapshot restore persists recovery before replacing content and retains it after reload',async()=>{
  const DAL=api(),p=DAL.defaultProject('Current','novel');DAL.state.projects[p.id]=p;
  p.chapters=[{id:'chapter',contentHTML:'Current prose'}];
  DAL.getProjectWordCount=()=>({total:2});DAL.toast=()=>{};
  const saved=[];DAL.saveState=async()=>{saved.push(JSON.parse(JSON.stringify(p)));return true;};
  assert.equal(await DAL.restoreWithRecovery(p,()=>{p.chapters[0].contentHTML='Old prose';}),true);
  assert.equal(saved[0].chapters[0].contentHTML,'Current prose');
  assert.equal(saved[1].chapters[0].contentHTML,'Old prose');
  assert.equal(saved[1].versions.at(-1).data.chapters[0].contentHTML,'Current prose');
  assert.equal(saved[1].versions.at(-1).data.history,undefined);
});

test('snapshot restore refuses failed recovery persistence and rolls back failed final persistence',async()=>{
  const DAL=api(),p=DAL.defaultProject('Current','novel');DAL.state.projects[p.id]=p;
  DAL.getProjectWordCount=()=>({total:0});DAL.toast=()=>{};
  DAL.saveState=async()=>false;
  let changed=false;
  assert.equal(await DAL.restoreWithRecovery(p,()=>{changed=true;p.name='Old';}),false);
  assert.equal(changed,false);assert.equal(p.name,'Current');
  let calls=0;DAL.saveState=async()=>++calls===1;
  assert.equal(await DAL.restoreWithRecovery(p,()=>{p.name='Old';}),false);
  assert.equal(p.name,'Current');assert.equal(DAL._restoringSnapshot,false);
});

test('snapshot restore does not overwrite edits made while recovery is saving',async()=>{
  const DAL=api(),p=DAL.defaultProject('Current','novel');DAL.state.projects[p.id]=p;
  DAL.getProjectWordCount=()=>({total:0});DAL.toast=()=>{};
  DAL.saveState=async()=>{p.name='New edit';return true;};
  assert.equal(await DAL.restoreWithRecovery(p,()=>{p.name='Old';}),false);
  assert.equal(p.name,'New edit');
});

test('rejected recovery save and failed final save never discard concurrent edits',async()=>{
  const DAL=api(),p=DAL.defaultProject('Current','novel');DAL.state.projects[p.id]=p;
  DAL.getProjectWordCount=()=>({total:0});DAL.toast=()=>{};
  DAL.saveState=async()=>{p.name='Newer edit';throw new Error('Disk failed');};
  assert.equal(await DAL.restoreWithRecovery(p,()=>{p.name='Old';}),false);
  assert.equal(p.name,'Newer edit');
  let calls=0;DAL.saveState=async()=>{if(++calls===1)return true;p.name='Edited after restore';return false;};
  assert.equal(await DAL.restoreWithRecovery(p,()=>{p.name='Old';}),false);
  assert.equal(p.name,'Edited after restore');
});

test('File menu folder command reaches the existing folder action without a second implementation',()=>{
  const DAL=api(),item=DAL.MENUS.file.find(entry=>entry.action==='link-folder');
  assert.ok(item);
  let dispatched;
  DAL.closeMenu=()=>{};DAL.handleClick=(action,el)=>{dispatched={action,el};};
  const el={getAttribute:key=>key==='data-do'?item.action:null};
  DAL.runAction('menu',el,{});
  assert.equal(dispatched.action,'link-folder');assert.equal(dispatched.el,el);
});

function api(windowOverrides,documentOverrides) {
  const document = {
    createElement(){return {set innerHTML(value){this.textContent=String(value).replace(/<[^>]*>/g,' ');}};},
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getElementById() { return null; }, body: {}, documentElement: {}
  };
  Object.assign(document,documentOverrides||{});
  const sandbox = {
    DAL: {}, document, window: Object.assign({ addEventListener() {}, innerWidth: 1200 },windowOverrides), navigator: {},
    localStorage: {}, indexedDB: {}, crypto: webcrypto, console,
    setTimeout, clearTimeout, setInterval, clearInterval, Date, Promise, Blob, URL,
    TextEncoder, TextDecoder, structuredClone
  };
  vm.createContext(sandbox);
  for (const file of ['core.js', 'library.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8'), sandbox, { filename: file });
  }
  sandbox.DAL.sanitizeRichHTML = value => String(value || '');
  sandbox.DAL.ensureAssets = project => { if (!project.assets) project.assets = { images: [], sounds: [], fonts: [], documents: [] }; };
  sandbox.DAL.state = sandbox.DAL.defaultState();
  return sandbox.DAL;
}

test('JSON import rejects unrelated, damaged and newer formats without changing local work',async()=>{
  for(const payload of ['broken',JSON.stringify({projects:{}}),JSON.stringify({type:'novel',schemaVersion:999}),JSON.stringify({project:{type:'novel'},linkedBible:{schemaVersion:999}})]){
    const DAL=api();DAL.toast=()=>{};const before=JSON.stringify(DAL.state);
    assert.equal(await DAL.importProjectJSON({text:async()=>payload,size:payload.length}),false);
    assert.equal(JSON.stringify(DAL.state),before);
  }
  const DAL=api();DAL.toast=()=>{};let read=false;
  assert.equal(await DAL.importProjectJSON({size:513*1024*1024,text:async()=>{read=true;return '{}';}}),false);
  assert.equal(read,false);
});

test('JSON imports await storage, preserve failed imports in memory and never invent writing output',async()=>{
  for(const outcome of [()=>false,()=>Promise.reject(new Error('quota')),()=>{throw new Error('quota');}]){
    const DAL=api(),project=DAL.defaultProject('Imported world','dual'),messages=[];
    project.chapters=[{id:'five',order:5,title:'Chapter Five',contentHTML:'<b>Three imported words</b>'}];
    project.linkedFolderName='Old device folder';const source=JSON.stringify(project);
    DAL.primeAssetUrls=async p=>{assert.equal(DAL.state.projects[p.id],undefined);};DAL.allAssets=()=>[];
    DAL.render=()=>{};DAL.toast=(message,type)=>messages.push({message,type});DAL.saveState=immediate=>{assert.equal(immediate,true);return outcome();};
    DAL.state.wordHistory[DAL.todayKey()]={manuscript:4,supplementary:0};DAL.state.wordBaseline={manuscript:0,supplementary:0};
    const imported=await DAL.importProjectJSON({text:async()=>source,size:source.length});
    assert.ok(imported,JSON.stringify(messages));assert.notEqual(imported.id,project.id);assert.equal(imported.linkedFolderName,null);
    assert.equal(imported.chapters[0].id,'five');assert.equal(imported.chapters[0].order,5);assert.equal(imported.chapters[0].contentHTML,project.chapters[0].contentHTML);
    DAL.updateWordHistory();assert.equal(DAL.state.wordHistory[DAL.todayKey()].manuscript,4);
    assert.ok(messages.some(item=>item.type==='warning'&&/memory only/.test(item.message)));assert.ok(!messages.some(item=>item.type==='success'));
    assert.equal(JSON.stringify(project),source);
    DAL.primeAssetUrls=async()=>{};DAL.saveState=()=>true;await DAL.finishImportedProject(imported);DAL.updateWordHistory();
    assert.equal(DAL.state.projectOrder.length,1);assert.equal(DAL.state.wordHistory[DAL.todayKey()].manuscript,4);
  }
});

test('staged import publishes neither project nor Bible when asset preparation fails',async()=>{
  const DAL=api(),project=DAL.defaultProject('World','dual'),bible=DAL.defaultBible('Shared');const messages=[];
  DAL.primeAssetUrls=async()=>{throw new Error('media unavailable');};DAL.toast=(...args)=>messages.push(args);
  const original=JSON.stringify(DAL.state);
  assert.equal(await DAL.importProjectJSON({text:async()=>JSON.stringify({project,linkedBible:bible})}),false);
  assert.equal(JSON.stringify(DAL.state),original);assert.ok(messages.some(item=>item[1]==='error'));
});

test('import completion leaves an actively edited workspace alone',async()=>{
  const DAL=api(),project=DAL.adoptImportedProject(DAL.defaultProject('World','novel'),true);let rendered=false;
  DAL.currentView='workspace';DAL.primeAssetUrls=async()=>{};DAL.saveState=async()=>true;DAL.toast=()=>{};DAL.render=()=>{rendered=true;};
  await DAL.finishImportedProject(project);assert.equal(rendered,false);assert.equal(DAL.state.projectOrder.length,1);
});

test('import completion closes only its original dialog after durable save confirmation',async()=>{
  for(const replaceDialog of [false,true]){
    const original={name:'import'},replacement={name:'new draft'};let currentDialog=original,settle,closed=0,started;
    const saveStarted=new Promise(resolve=>{started=resolve;});
    const DAL=api(null,{getElementById:()=>currentDialog}),project=DAL.adoptImportedProject(DAL.defaultProject('World','novel'),true);
    DAL.currentView='workspace';DAL.primeAssetUrls=async()=>{};DAL.toast=()=>{};DAL.closeModal=()=>{closed++;currentDialog=null;};
    DAL.saveState=()=>new Promise(resolve=>{settle=resolve;started();});
    const finished=DAL.finishImportedProject(project);await saveStarted;
    assert.equal(closed,0);if(replaceDialog)currentDialog=replacement;
    settle(true);await finished;
    assert.equal(closed,replaceDialog?0:1);assert.equal(currentDialog,replaceDialog?replacement:null);
    assert.equal(DAL.state.projects[project.id],project);
  }
});

test('folder permission failure keeps staged project and linked Bible out of the workspace',async()=>{
  const project={type:'novel',chapters:[],name:'Folder world'},bible={name:'Bible'};
  const dir={getFileHandle:async()=>({getFile:async()=>({text:async()=>JSON.stringify({project,linkedBible:bible})})})};
  const DAL=api({showDirectoryPicker:async()=>dir});let finish;
  const done=new Promise(resolve=>{finish=resolve;});DAL.closeModal=()=>{};DAL.toast=(message,type)=>{if(type==='error')finish(message);};
  DAL.readAssetsFolder=async()=>{throw new Error('Permission revoked');};
  DAL.importProjectFolder();assert.match(await done,/Permission revoked/);
  assert.equal(DAL.state.projectOrder.length,0);assert.equal(DAL.state.bibleOrder.length,0);
});

test('repeated JSON import makes independent project and Bible IDs without replacing existing work',async()=>{
  const DAL=api(),source={project:DAL.defaultProject('World','dual'),linkedBible:DAL.defaultBible('Shared')};
  DAL.render=()=>{};DAL.primeAssetUrls=async()=>{};DAL.allAssets=()=>[];DAL.toast=()=>{};DAL.saveState=async()=>true;
  const file={text:async()=>JSON.stringify(source)};
  const first=await DAL.importProjectJSON(file),second=await DAL.importProjectJSON(file);
  assert.notEqual(first.id,second.id);assert.notEqual(first.bibleId,second.bibleId);
  assert.equal(DAL.state.projectOrder.length,2);assert.equal(DAL.state.bibleOrder.length,2);
  second.characters.push({name:'Later cast'});assert.equal(first.characters.length,0);
});

test('folder asset reader propagates permission failures but tolerates absent asset directories', async () => {
  const DAL=api();
  const missing={getDirectoryHandle:async()=>{throw Object.assign(new Error('Missing'),{name:'NotFoundError'});}};
  assert.equal(await DAL.readAssetsFolder(missing,{}),0);
  const denied={getDirectoryHandle:async()=>{throw Object.assign(new Error('Access revoked'),{name:'NotAllowedError'});}};
  await assert.rejects(DAL.readAssetsFolder(denied,{}),/Access revoked/);
});

test('staged project adoption leaves the library unchanged until import completes', () => {
  const DAL=api(),source=DAL.defaultProject('Staged book','novel');
  const imported=DAL.adoptImportedProject(source,true);
  assert.equal(imported.name,'Staged book');
  assert.equal(DAL.state.projects[imported.id],undefined);
  assert.equal(DAL.state.projectOrder.includes(imported.id),false);
});

test('asset remapping repairs chapter art, scene art, narration, and illustration bindings',()=>{
  const DAL=api();DAL.ASSET_FOLDERS=[{key:'images'}];
  const project={assets:{images:[{id:'old'},{id:'new'}]},chapters:[{imageAssetId:'old',images:[{assetId:'old'}],audio:{voice:'old'}}],adventure:{nodes:[{images:[{assetId:'old'}],audio:{ambient:'old',sfx:'old'}}]},illustrations:[{assetId:'old'}]};
  DAL.rebindAsset(project,'old','new');
  assert.equal(project.chapters[0].imageAssetId,'new');assert.equal(project.chapters[0].images[0].assetId,'new');
  assert.equal(project.chapters[0].audio.voice,'new');assert.equal(project.adventure.nodes[0].images[0].assetId,'new');
  assert.equal(project.adventure.nodes[0].audio.ambient,'new');assert.equal(project.adventure.nodes[0].audio.sfx,'new');
  assert.equal(project.illustrations[0].assetId,'new');assert.equal(project.assets.images.length,1);
});

test('a complete project keeps ordering, links, writing records, and RPG state after cross-platform import', () => {
  const DAL = api();
  const project = DAL.defaultProject('Portable Campaign', 'dual');
  project.chapters = [
    { id: 'chapter-5', title: 'Chapter Five', order: 0, contentHTML: '<p>Fifth chapter manuscript 15.</p>', images: [], createdAt: 1, updatedAt: 2 },
    { id: 'chapter-1', title: 'Chapter One', order: 1, contentHTML: '<p>Deliberately second in this project.</p>', images: [], createdAt: 3, updatedAt: 4 }
  ];
  project.characters = [{ id: 'hero', name: 'Hero', linkedPlotIds: ['quest'] }];
  project.relationships = [{ id: 'bond', fromCharId: 'hero', toCharId: 'guide', type: 'ally' }];
  project.plots = [{ id: 'quest', title: 'Quest', linkedChapterIds: ['chapter-5'], linkedCharacterIds: ['hero'] }];
  project.lore = { folders: ['Places'], entries: [{ id: 'city', folder: 'Places', title: 'City', linkedCharIds: ['hero'], linkedPlotIds: ['quest'] }] };
  project.timeline = [{ id: 'event', title: 'Arrival', chapterId: 'chapter-5', characterIds: ['hero'], plotIds: ['quest'] }];
  project.mindmap = { nodes: [{ id: 'idea-a', text: 'Cause' }, { id: 'idea-b', text: 'Effect' }], edges: [{ id: 'idea-edge', from: 'idea-a', to: 'idea-b' }] };
  project.writerTools = {
    comments: [{ id: 'comment', chapterId: 'chapter-5', body: 'Revise this verse.' }],
    highlights: [{ id: 'highlight', chapterId: 'chapter-5', color: '#fff59d' }],
    bookmarks: [{ id: 'bookmark', chapterId: 'chapter-5', name: 'Return here' }],
    footnotes: [{ id: 'footnote', chapterId: 'chapter-5', number: 1, text: 'Source note' }],
    sources: [{ id: 'source', title: 'Archive' }], structure: { beats: [{ id: 'beat', chapterId: 'chapter-5' }] }, exportOptions: { highlights: true }
  };
  project.adventure.stats = [{ id: 'health', key: 'health', label: 'Health', default: 10 }];
  project.adventure.traits = [{ id: 'brave', name: 'Brave' }];
  project.adventure.items = [{ id: 'key', name: 'Key', useEffects: [{ type: 'stat', key: 'health', op: 'add', value: 1 }] }];
  project.adventure.nodes = [
    { id: 'start', title: 'Start', choices: [{ id: 'choice', targetId: 'end', conditions: [{ type: 'trait', key: 'brave' }], effects: [{ type: 'inventory', key: 'key', op: 'give', value: 1 }] }], entryEffects: [] },
    { id: 'end', title: 'End', choices: [], entryEffects: [] }
  ];
  project.adventure.startNodeId = 'start';
  project.adventure.playtestState = { nodeId: 'start', stats: { health: 10 }, traits: ['brave'], inventory: { key: 1 } };

  const linkedBible = DAL.defaultBible('Shared Realm');
  linkedBible.characters.push({ id: 'shared-hero', name: 'Shared Hero', aliases: ['The Wanderer'], facts: [{ id: 'fact-1', key: 'birth year', value: '12' }] });
  linkedBible.lore.entries.push({ id: 'shared-city', title: 'Shared City', folder: 'Locations', content: 'Founded in Year 1.', aliases: [], facts: [] });
  project.bibleId = linkedBible.id;
  const imported = DAL.adoptImportedProject(JSON.parse(JSON.stringify({ project, linkedBible })));

  assert.notEqual(imported.id, project.id);
  assert.deepEqual(Array.from(imported.chapters, chapter => chapter.id), ['chapter-5', 'chapter-1']);
  assert.equal(imported.chapters[0].contentHTML, '<p>Fifth chapter manuscript 15.</p>');
  assert.deepEqual(Array.from(imported.plots[0].linkedChapterIds), ['chapter-5']);
  assert.equal(imported.timeline[0].chapterId, 'chapter-5');
  assert.equal(imported.writerTools.comments[0].chapterId, 'chapter-5');
  assert.equal(imported.writerTools.structure.beats[0].chapterId, 'chapter-5');
  assert.equal(JSON.stringify(imported.mindmap.edges[0]), JSON.stringify({ id: 'idea-edge', from: 'idea-a', to: 'idea-b' }));
  assert.equal(imported.adventure.nodes[0].choices[0].targetId, 'end');
  assert.equal(JSON.stringify(imported.adventure.playtestState.inventory), JSON.stringify({ key: 1 }));
  assert.ok(imported.bibleId);
  assert.notEqual(imported.bibleId, linkedBible.id);
  assert.equal(DAL.state.bibles[imported.bibleId].characters[0].aliases[0], 'The Wanderer');
  assert.equal(DAL.state.bibles[imported.bibleId].lore.entries[0].title, 'Shared City');
});
