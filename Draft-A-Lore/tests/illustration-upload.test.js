const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function api(){
  const project={id:'qa',chapters:[{id:'chapter',images:[]}],images:[],adventure:{items:[{id:'item'}],nodes:[{id:'scene',images:[]}]}},events=[],files=[];
  const DAL={state:{projects:{qa:project}},currentProjectId:'qa',uid:()=>String(events.length),toast:(...args)=>events.push(['toast',...args]),pushHistory:()=>events.push(['history']),saveState:async()=>{events.push(['save']);return true;},render:()=>events.push(['render']),compressImage:(file,size,quality,cb)=>{files.push({file,size,quality,cb});}};
  const context={DAL,Array,Promise,Error,Number,Date};const source=fs.readFileSync(path.join(__dirname,'../src/views.js'),'utf8'),start=source.indexOf('DAL.importIllustrations='),end=source.indexOf('\n};',source.indexOf('DAL.setIllustrationProperty=',start))+3;vm.runInNewContext(source.slice(start,end),context);
  return{DAL,project,events,files};
}
const image=(name='cover.png')=>({name,size:100,type:'image/png'});
const data='data:image/png;base64,aGVsbG8=';
async function nextImage(q){for(let turn=0;turn<10&&q.files.length<2;turn++)await Promise.resolve();assert.equal(q.files.length,2);}
test('illustrations stage in selection order and commit once with undo and saving',async()=>{
  const q=api(),first=image('first.png'),second=image('second.png'),operation=q.DAL.importIllustrations(q.project,[first,second],'library');assert.equal(q.project.images.length,0);q.files[0].cb(data);await nextImage(q);assert.equal(q.project.images.length,0);q.files[1].cb(data);assert.equal(await operation,true);assert.deepEqual(q.project.images.map(x=>x.name),['first','second']);assert.equal(q.project.images[0].bookPage,0);assert.equal(q.events.filter(x=>x[0]==='history').length,1);assert.equal(q.events.filter(x=>x[0]==='save').length,1);
});
test('a failed image does not publish a partial batch or fake success',async()=>{
  const q=api(),operation=q.DAL.importIllustrations(q.project,[image(),image()],'library');q.files[0].cb(data);await nextImage(q);q.files[1].cb(null,Error('Decode failed'));assert.equal(await operation,false);assert.equal(q.project.images.length,0);assert.equal(q.events.filter(x=>x[0]==='save').length,0);assert.equal(q.DAL._illustrationImportBusy,false);assert.match(q.events.at(-1)[1],/Decode failed/);
});
test('navigation and workspace replacement discard obsolete decoded images',async()=>{
  for(const change of [q=>q.DAL.currentProjectId='other',q=>q.DAL.state={projects:{qa:q.project}}]){const q=api(),operation=q.DAL.importIllustrations(q.project,[image()],'library');change(q);q.files[0].cb(data);assert.equal(await operation,false);assert.equal(q.project.images.length,0);}
});
test('deleted chapter and scene destinations cannot receive delayed art',async()=>{
  for(const kind of ['chapter','scene']){const q=api(),collection=kind==='chapter'?q.project.chapters:q.project.adventure.nodes,target=collection[0],operation=q.DAL.importIllustrations(q.project,[image()],kind,target);collection.splice(0,1);q.files[0].cb(data);assert.equal(await operation,false);assert.equal(target.images.length,0);}
});
test('concurrent uploads and an exceeded chapter limit are refused',async()=>{
  const q=api(),chapter=q.project.chapters[0],operation=q.DAL.importIllustrations(q.project,[image()],'chapter',chapter);assert.equal(await q.DAL.importIllustrations(q.project,[image()],'library'),false);chapter.images.push({},{ });q.files[0].cb(data);assert.equal(await operation,false);assert.equal(chapter.images.length,2);
});
test('item images use the correct target after list reorder',async()=>{
  const q=api(),target=q.project.adventure.items[0],operation=q.DAL.importIllustrations(q.project,[image()],'item',target);q.project.adventure.items.unshift({id:'other'});q.files[0].cb(data);assert.equal(await operation,true);assert.equal(target.imageDataUrl,data);assert.equal(q.project.adventure.items[0].imageDataUrl,undefined);assert.equal(q.files[0].size,400);
});
test('failed persistence keeps added art and reports memory-only state',async()=>{
  const q=api();q.DAL.saveState=async()=>false;const operation=q.DAL.importIllustrations(q.project,[image()],'library');q.files[0].cb(data);assert.equal(await operation,true);assert.equal(q.project.images.length,1);assert.match(q.events.at(-1)[1],/memory only/);assert.equal(q.events.at(-1)[2],'warning');
});

test('page assignment validates whole safe numbers and moves the old assignment with one undo point',()=>{
  const q=api();q.project.images=[{name:'Cover',bookPage:1},{name:'Art',bookPage:12}];for(const value of ['1.5','-1','Infinity','9007199254740992'])assert.equal(q.DAL.setIllustrationProperty(q.project,1,'bookPage',value),false);assert.equal(q.project.images[0].bookPage,1);assert.equal(q.project.images[1].bookPage,12);assert.equal(q.events.filter(x=>x[0]==='history').length,0);assert.equal(q.DAL.setIllustrationProperty(q.project,1,'bookPage','1'),true);assert.equal(q.project.images[0].bookPage,0);assert.equal(q.project.images[1].bookPage,1);assert.equal(q.project.images[1].category,'cover');assert.equal(q.events.filter(x=>x[0]==='history').length,1);assert.equal(q.DAL.setIllustrationProperty(q.project,1,'bookPage',1),false);
});
test('illustration names coalesce typing undo and refuse invalid category or fit values',()=>{
  const q=api();q.project.images=[{name:'Art',category:'other',pageFit:'contain',bookPage:0}];q.DAL.setIllustrationProperty(q.project,0,'name','Artwork');q.DAL.setIllustrationProperty(q.project,0,'name','Artwork title');assert.equal(q.events.filter(x=>x[0]==='history').length,1);assert.equal(q.DAL.setIllustrationProperty(q.project,0,'category','unsafe'),false);assert.equal(q.DAL.setIllustrationProperty(q.project,0,'pageFit','unsafe'),false);q.DAL.setIllustrationProperty(q.project,0,'pageFit','cover');assert.equal(q.events.filter(x=>x[0]==='history').length,2);assert.equal(q.DAL._illustrationNameEdit,null);
});
test('illustration cards escape user names and provide named controls',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/story-tools.js'),'utf8'),start=source.indexOf('DAL.renderIllustrations ='),end=source.indexOf('\n};',start)+3;
  const DAL={escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),uiLabel:(key,fallback)=>fallback,imageSrc:()=>data,bookPageLabel:()=> 'Not assigned'};vm.runInNewContext(source.slice(start,end),{DAL});const html=DAL.renderIllustrations({images:[{name:'Art "<name>',category:'other',bookPage:0}]});assert.match(html,/aria-label="Image name for Art &quot;&lt;name>/);assert.match(html,/aria-label="Category for Art &quot;&lt;name>/);assert.match(html,/aria-label="Delete Art &quot;&lt;name>/);assert.match(html,/alt="Art &quot;&lt;name>/);
});

function compression(){
  let reader,decoded,timer,canvas;const calls=[],draws=[],context={DAL:{},Number,Math,Error,setTimeout:cb=>{timer=cb;return 1;},clearTimeout(){},FileReader:class{constructor(){reader=this;}readAsDataURL(file){this.file=file;}},Image:class{constructor(){decoded=this;}},document:{createElement(){canvas={width:0,height:0,getContext:()=>({drawImage(...args){draws.push(args.slice(3));}}),toDataURL:mime=>'data:'+mime+';base64,aGVsbG8='};return canvas;}}};
  const source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8'),start=source.indexOf('DAL.compressImage ='),end=source.indexOf('\n};',start)+3;vm.runInNewContext(source.slice(start,end),context);
  return{run(file,width=1000){return context.DAL.compressImage(file,width,.88,(...args)=>calls.push(args));},calls,draws,read(){reader.onload({target:{result:data}});return decoded;},canvas:()=>canvas,reader:()=>reader,timeout:()=>timer()};
}
test('compression rejects excessive input and SVG before reading',()=>{
  for(const file of [{...image(),size:20*1024*1024+1},{...image('art.svg'),type:'image/svg+xml'}]){const q=compression();q.run(file);assert.equal(q.reader(),undefined);assert.equal(q.calls[0][0],null);assert.ok(q.calls[0][1]);}
});
test('compression bounds both dimensions and preserves PNG transparency format',()=>{
  const q=compression();q.run(image());const img=q.read();img.naturalWidth=100;img.naturalHeight=10000;img.onload();assert.deepEqual(q.draws[0],[10,1000]);assert.match(q.calls[0][0],/^data:image\/png/);assert.equal(q.canvas().width,0);assert.equal(q.canvas().height,0);assert.equal(q.calls.length,1);
});
test('compression refuses extreme decoded dimensions and times out once',()=>{
  const q=compression();q.run(image());const img=q.read();img.naturalWidth=10000;img.naturalHeight=10000;img.onload();assert.match(q.calls[0][1].message,/24 million/);q.timeout();assert.equal(q.calls.length,1);
  const delayed=compression();delayed.run(image());delayed.timeout();assert.match(delayed.calls[0][1].message,/too long/);assert.equal(delayed.reader().onload,null);
});
test('cancel and file-read failures settle once without storing original undecodable bytes',()=>{
  const q=compression(),cancel=q.run(image());cancel();cancel();assert.equal(q.calls.length,1);assert.equal(q.calls[0][0],null);
  const failed=compression();failed.run(image());failed.reader().onerror();assert.match(failed.calls[0][1].message,/could not be read/);assert.equal(failed.reader().onerror,null);
});
