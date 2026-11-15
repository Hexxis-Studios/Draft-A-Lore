const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function bundleApi() {
  const sandbox = {
    DAL: { registerAfterRender() {}, registerActionHandler() {} }, TextEncoder, TextDecoder, Uint8Array, Date, Promise,
    Blob, Response, DecompressionStream
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'bundle.js'), 'utf8'), sandbox, { filename: 'bundle.js' });
  sandbox.document={getElementById:()=>null};
  sandbox.DAL.currentView='projects';
  sandbox.DAL.getProjectWordCount=()=>({manuscript:0,supplementary:0});
  sandbox.DAL.updateWordHistory=()=>{if(!sandbox.DAL.state.wordBaseline)sandbox.DAL.state.wordBaseline={manuscript:0,supplementary:0};};
  const library=fs.readFileSync(path.join(__dirname,'../src/library.js'),'utf8');
  vm.runInContext(library.slice(library.indexOf('  DAL.importText ='),library.indexOf('  DAL.openProjectImport =')),sandbox);
  vm.runInContext(library.slice(library.indexOf('  DAL.publishImportedProject ='),library.indexOf('  DAL.importProjectFile =')),sandbox);
  return sandbox.DAL;
}

test('new project exports use a standard ZIP filename and keep old extension import compatibility',async()=>{
  const DAL=bundleApi(),project={id:'p',name:'A Story'};let saved;
  DAL.state={projects:{p:project}};DAL.toast=()=>{};DAL.projectBundleBytes=async()=>new Uint8Array([80,75,3,4]);
  DAL.sanitizeFilename=name=>name;DAL.download=async(filename,data,mime)=>{saved={filename,data:Array.from(data),mime};return true;};
  assert.equal(await DAL.exportProjectBundle('p'),true);assert.equal(saved.filename,'A Story.zip');assert.equal(saved.mime,'application/zip');
  const source=fs.readFileSync(path.join(__dirname,'../src/bundle.js'),'utf8');
  assert.match(source,/input\.accept = '\.zip,\.dalz,application\/zip/);
});
test('project ZIP creation and reading round-trip exact bytes', async () => {
  const DAL = bundleApi();
  const source = new TextEncoder().encode('A portable project ✓');
  const zip = DAL.makeZip([{ name: 'project.json', data: source }]);
  const opened = DAL.readZip(zip);
  const result = await opened.read(opened.entries[0]);
  assert.deepEqual(Array.from(result), Array.from(source));
});

test('bundle reader rejects unsafe paths', () => {
  const DAL = bundleApi();
  for (const name of ['../project.json', '/project.json', 'C:/project.json']) {
    assert.throws(()=>DAL.makeZip([{name,data:new Uint8Array([1])}]),/unsafe file path/);
    const safe='x'.repeat(name.length),zip = DAL.makeZip([{ name:safe, data: new Uint8Array([1]) }]);
    const encoded=new TextEncoder().encode(name);
    zip.set(encoded,30);
    zip.set(encoded,30+safe.length+1+46);
    assert.throws(() => DAL.readZip(zip), /unsafe file path/);
  }
});

test('bundle reader rejects duplicate normalized paths',()=>{
  const DAL=bundleApi();
  const zip=DAL.makeZip([{name:'Assets/image1.png',data:new Uint8Array([1])},{name:'Assets/image2.png',data:new Uint8Array([2])}]);
  const needle=new TextEncoder().encode('Assets/image2.png');
  for(let at=0;at<=zip.length-needle.length;at++){
    if(needle.every((value,index)=>zip[at+index]===value))zip[at+'Assets/image'.length]=49;
  }
  assert.throws(()=>DAL.readZip(zip),/duplicate/);
});

test('bundle export rejects unreadable file counts, names and conflicting assets',()=>{
  const DAL=bundleApi(),data=new Uint8Array([1]);
  assert.throws(()=>DAL.makeZip(Array.from({length:10001},(_,i)=>({name:String(i),data}))),/too many/);
  assert.throws(()=>DAL.makeZip([{name:'x'.repeat(65536),data}]),/too long/);
  assert.throws(()=>DAL.makeZip([{name:'Assets/image.png',data},{name:'Assets\\image.png',data}]),/duplicate/);
});

test('deflated bundle entries stop expanding at their declared size',async()=>{
  const DAL=bundleApi();
  const {deflateRawSync}=require('node:zlib');
  const packed=deflateRawSync(Buffer.from('too much expanded content'));
  const largeZip=DAL.makeZip([{name:'project.json',data:new Uint8Array(packed)}]);
  const archive=DAL.readZip(largeZip);
  archive.entries[0].method=8;archive.entries[0].size=1;
  await assert.rejects(archive.read(archive.entries[0]),/declared size/);
});

test('bundle reader verifies stored-entry checksums', async () => {
  const DAL = bundleApi();
  const zip = DAL.makeZip([{ name: 'project.json', data: new Uint8Array([1, 2, 3, 4]) }]);
  const damaged = new Uint8Array(zip);
  damaged[30 + 'project.json'.length] ^= 0xff;
  const opened = DAL.readZip(damaged);
  await assert.rejects(opened.read(opened.entries[0]), /integrity check/);
});

test('backup packing uses one project snapshot while the writer keeps editing',async()=>{
  const DAL=bundleApi(),project={name:'Before',assets:{images:[{id:'old'}]}};
  DAL.clone=value=>JSON.parse(JSON.stringify(value));
  let assetSnapshot;
  DAL.projectTextFiles=value=>[{name:'project.json',data:new TextEncoder().encode(JSON.stringify(value))}];
  DAL.projectAssetFiles=async value=>{assetSnapshot=value;await Promise.resolve();return [];};
  const pending=DAL.projectFolderFiles(project);
  project.name='After';project.assets.images.push({id:'new'});
  const files=await pending;
  assert.equal(assetSnapshot.name,'Before');assert.equal(assetSnapshot.assets.images.length,1);
  assert.equal(JSON.parse(new TextDecoder().decode(files[0].data)).name,'Before');
});

test('same-named world records export to distinct readable files',()=>{
  const DAL=bundleApi();DAL.clone=value=>JSON.parse(JSON.stringify(value));DAL.sanitizeFilename=value=>value;
  const files=DAL.projectTextFiles({characters:[{name:'Mira',backstory:'First'},{name:'Mira',backstory:'Second'}],lore:{entries:[{title:'City',content:'One'},{title:'City',content:'Two'}]},plots:[{title:'Quest',description:'A'},{title:'Quest',description:'B'}]});
  assert.equal(new Set(files.map(file=>file.name)).size,files.length);
  assert.ok(files.some(file=>file.name==='characters/01-Mira.txt'));
  assert.ok(files.some(file=>file.name==='characters/02-Mira.txt'));
});

test('bundle import rejects ambiguous project records before adopting a project',async()=>{
  const DAL=bundleApi();let adopted=0,message='';
  DAL.toast=value=>{message=value;};DAL.adoptImportedProject=()=>{adopted++;};
  const bytes=DAL.makeZip([
    {name:'project.json',data:new TextEncoder().encode('{}')},
    {name:'another/project.json',data:new TextEncoder().encode('{}')}
  ]);
  assert.equal(await DAL.importProjectBundle(new Blob([bytes])),false);
  assert.equal(adopted,0);assert.match(message,/more than one project/);
});

test('successful bundle import commits one project after assets and durable save',async()=>{
  const DAL=bundleApi(),project={id:'imported',name:'Book',assets:{images:[]}},events=[];
  DAL.state={projects:{},projectOrder:[],bibles:{},bibleOrder:[]};
  DAL.toast=(message,type)=>events.push(type);
  DAL.ASSET_FOLDERS=[];
  DAL.adoptImportedProject=(data,staged)=>{assert.equal(staged,true);return project;};
  DAL.primeAssetUrls=async()=>{assert.equal(DAL.state.projects.imported,undefined);events.push('assets');};
  DAL.saveState=async immediate=>{assert.equal(immediate,true);assert.equal(DAL.state.projects.imported,project);events.push('saved');return true;};
  DAL.closeModal=()=>{};DAL.render=()=>events.push('render');
  const bytes=DAL.makeZip([{name:'project.json',data:new TextEncoder().encode('{}')}]);
  assert.equal(await DAL.importProjectBundle(new Blob([bytes])),project);
  assert.equal(DAL.state.projectOrder.length,1);
  assert.ok(events.indexOf('assets')<events.indexOf('saved'));
  assert.ok(events.indexOf('saved')<events.indexOf('success'));
});

test('bundle import warns rather than claiming durable success when storage fails',async()=>{
  const DAL=bundleApi(),project={id:'memory',name:'Book',assets:{}},messages=[];
  DAL.state={projects:{},projectOrder:[],bibles:{},bibleOrder:[]};
  DAL.toast=(message,type)=>messages.push({message,type});DAL.ASSET_FOLDERS=[];
  DAL.adoptImportedProject=()=>project;DAL.primeAssetUrls=async()=>{};
  DAL.saveState=async()=>false;DAL.closeModal=()=>{};DAL.render=()=>{};
  const bytes=DAL.makeZip([{name:'project.json',data:new TextEncoder().encode('{}')}]);
  assert.equal(await DAL.importProjectBundle(new Blob([bytes])),project);
  assert.equal(messages.some(item=>item.type==='success'),false);
  assert.ok(messages.some(item=>item.type==='warning'&&/memory only/.test(item.message)));
});

test('bundle asset import runs sequentially and never publishes a failed project', async () => {
  const DAL=bundleApi(),project={id:'new',name:'Imported',assets:{images:[]}};
  DAL.state={projects:{},projectOrder:[],bibles:{},bibleOrder:[]};
  DAL.toast=()=>{};
  DAL.ASSET_FOLDERS=[{key:'images',dir:'Images'}];
  DAL.adoptImportedProject=(data,staged)=>{assert.equal(staged,true);return project;};
  let active=0,maxActive=0,imports=0;
  DAL.remapImportedAsset=async()=>{active++;maxActive=Math.max(maxActive,active);await Promise.resolve();active--;imports++;if(imports===2)throw new Error('Asset storage full');return {};};
  const bytes=DAL.makeZip([
    {name:'project.json',data:new TextEncoder().encode('{}')},
    {name:'Assets/Images/first.png',data:new Uint8Array([1])},
    {name:'Assets/Images/second.png',data:new Uint8Array([2])}
  ]);
  assert.equal(await DAL.importProjectBundle(new Blob([bytes])),false);
  assert.equal(maxActive,1);
  assert.equal(imports,2);
  assert.equal(DAL.state.projectOrder.length,0);
  assert.equal(Object.keys(DAL.state.projects).length,0);
});

test('portable restore rejects missing assets before publishing metadata',async()=>{
  const DAL=bundleApi();DAL.state={projects:{},projectOrder:[]};DAL.toast=()=>{};DAL.ASSET_FOLDERS=[];
  DAL.adoptImportedProject=()=>({id:'new',assets:{images:[{id:'missing',name:'missing.png'}]}});
  DAL.validateFolderAssets=async()=>{throw new Error('Missing asset');};let published=0;DAL.finishImportedProject=async()=>{published++;};
  const zip=DAL.makeZip([{name:'project.json',data:new TextEncoder().encode('{}')}]);
  assert.equal(await DAL.importProjectBundle(new Blob([zip])),false);assert.equal(published,0);assert.equal(DAL._bundleImportBusy,false);
});

test('portable restore rejects changed workspace and concurrent restoration without adding a project',async()=>{
  const DAL=bundleApi();DAL.state={projects:{},projectOrder:[]};DAL.toast=()=>{};DAL.ASSET_FOLDERS=[];
  DAL.adoptImportedProject=()=>({id:'new',assets:{}});let published=0;DAL.finishImportedProject=async()=>{published++;};
  const zip=DAL.makeZip([{name:'project.json',data:new TextEncoder().encode('{}')}]);
  DAL.validateFolderAssets=async()=>{DAL.state={projects:{},projectOrder:[]};};
  assert.equal(await DAL.importProjectBundle(new Blob([zip])),false);assert.equal(published,0);
  DAL._workspaceRestoreBusy=true;assert.equal(await DAL.importProjectBundle(new Blob([zip])),false);assert.equal(published,0);
});
