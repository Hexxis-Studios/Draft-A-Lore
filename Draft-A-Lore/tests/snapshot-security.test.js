const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
function api(){
 const DAL={uid:prefix=>prefix+'_id',sanitizeRichHTML:html=>String(html||'').replace(/<img[^>]*>/g,''),safeImportedImage:value=>String(value||'').startsWith('data:image/png;base64,')?value:'',SCHEMA_VERSION:3};
 const start=source.indexOf('DAL.normalizeProject ='),end=source.indexOf('\nDAL.defaultBible =',start);
 vm.runInNewContext(source.slice(start,end),{DAL,Array,Number,String,Math,parseInt});
 return DAL;
}
test('imported and previously saved snapshots are sanitized before use',()=>{
 for(const sanitize of [true,false]){
  const DAL=api(),payload='<p>Keep this</p><img src=x onerror=alert(1)>',make=()=>({name:'Snapshot',chapters:[{id:'c',title:'Chapter',contentHTML:payload}]});
  const project={name:'Project',chapters:[{id:'c',title:'Chapter',contentHTML:'<p>Current</p>'}],versions:[{data:make()}],history:[make()],redoStack:[make()]};
  DAL.normalizeProject(project,sanitize);
  for(const snap of [project.versions[0].data,project.history[0],project.redoStack[0]]) assert.equal(snap.chapters[0].contentHTML,'<p>Keep this</p>');
  assert.equal(project.chapters[0].contentHTML,'<p>Current</p>');
 }
});
test('nested snapshot fields do not cause recursive normalization',()=>{
 const DAL=api(),nested={name:'Nested',chapters:[]}; nested.versions=[{data:nested}];
 const p={name:'Project',chapters:[],versions:[{data:nested}]};
 assert.doesNotThrow(()=>DAL.normalizeProject(p,true));
});

test('local snapshots retain image references while unsafe markup is sanitized',()=>{
 const DAL=api();
 const snapshot={name:'Snapshot',chapters:[{id:'c',title:'Chapter',contentHTML:'<p>Text</p><img src=x onerror=alert(1)>',images:[{src:'blob:local-illustration'}]}],images:[{id:'i',src:'blob:local-illustration'}]};
 const project={name:'Project',chapters:[],versions:[{data:snapshot}]};
 DAL.normalizeProject(project,false);
 assert.equal(snapshot.chapters[0].contentHTML,'<p>Text</p>');
 assert.equal(snapshot.chapters[0].images[0].src,'blob:local-illustration');
 assert.equal(snapshot.images[0].src,'blob:local-illustration');
});
