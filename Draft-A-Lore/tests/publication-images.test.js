const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {holder}=require('./helpers/manuscript-dom.cjs');
function api(){
  const listeners={};
  const DAL={state:{projects:{},authorName:''},clone:value=>JSON.parse(JSON.stringify(value)),escapeHtml:value=>String(value||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),registerActionHandler(){},sanitizeRichHTML:value=>value,
    bookPageImages:(proj,page)=>(proj.images||[]).filter(image=>image.bookPage===page),imageSrc:(proj,image)=>image.assetId?'blob:'+image.assetId:image.dataUrl,
    allAssets:proj=>proj.assets||[],blobUrl:id=>'blob:'+id,safeImportedImage:value=>/^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/.test(value)?value:'',blobStore:{get:async()=>({blob:new Blob(['image'],{type:'image/png'})})}};
  const sandbox={DAL,document:{createElement:tag=>holder('',tag),addEventListener:(name,callback)=>{listeners[name]=callback;}},window:{},Date,Map,Image:class{},TextEncoder,Uint8Array,atob,setTimeout,clearTimeout,
    FileReader:class{readAsDataURL(blob){blob.arrayBuffer().then(data=>{this.result='data:'+blob.type+';base64,'+Buffer.from(data).toString('base64');this.onload();});}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/publishing-tools.js'),'utf8'),sandbox);
  DAL.testChange=target=>listeners.change({target});
  return DAL;
}
test('EPUB embeds cover and chapter blob images without modifying the original project',async()=>{
  const DAL=api(),original={id:'book',name:'Book',language:'en',cover:{author:'Writer'},images:[{id:'cover',bookPage:1,assetId:'art',name:'Cover'}],assets:[{id:'art',name:'art.png'}],chapters:[{id:'one',title:'One',contentHTML:'<p>Hello <img src="blob:art"/></p>'}]},before=JSON.stringify(original);
  const prepared=await DAL.prepareEpub(DAL.clone(original));assert.equal(JSON.stringify(original),before);assert.equal(prepared.images[0].assetId,undefined);
  const files=DAL.epubFiles(prepared),text=file=>new TextDecoder().decode(file.data);
  assert.ok(files.some(file=>file.name==='EPUB/images/image-1.png'));
  assert.match(text(files.find(file=>file.name==='EPUB/text/chapter-1.xhtml')),/\.\.\/images\/image-1\.png/);
  assert.match(text(files.find(file=>file.name==='EPUB/cover.xhtml')),/images\/image-1\.png/);
  assert.equal(files.filter(file=>file.name.startsWith('EPUB/images/')).length,1);
});
test('EPUB preserves a legacy inline cover as its actual cover image',async()=>{
  const DAL=api(),project={id:'book',name:'Book',cover:{imageDataUrl:'data:image/png;base64,aW1hZ2U='},images:[],chapters:[]};
  const prepared=await DAL.prepareEpub(project);assert.equal(prepared.images[0].bookPage,1);assert.ok(DAL.epubFiles(prepared).some(file=>file.name==='EPUB/images/image-1.png'));
});
test('EPUB refuses missing or remote illustrations without downloading content',async()=>{
  const DAL=api(),project={id:'book',cover:{},images:[],assets:[],chapters:[{contentHTML:'<p><img src="https://example.com/private.png"/></p>'}]};
  await assert.rejects(DAL.prepareEpub(project),/Remote images are not downloaded/);
  project.chapters[0].contentHTML='<p><img src="blob:missing"/></p>';await assert.rejects(DAL.prepareEpub(project),/no longer available/);
});
test('book design preserves zero indentation and rejects injected typography',()=>{
  const DAL=api(),project={bookDesign:{typography:'__proto__',trim:'constructor',paragraphIndent:0}};
  const design=DAL.ensureBookDesign(project);assert.equal(design.paragraphIndent,0);assert.equal(design.trim,'paperback-6x9');assert.equal(design.typography,'classic');
});

test('book design restores absent imported dimensions without losing valid zero margins',()=>{
  const DAL=api(),project={bookDesign:{width:null,height:'',top:null,left:0,gutter:0}};
  const result=DAL.ensureBookDesign(project);assert.equal(result.width,6);assert.equal(result.height,9);assert.equal(result.top,.65);assert.equal(result.left,0);assert.equal(result.gutter,0);
});

test('book design rejects out-of-range typography without adding undo entries or saving',()=>{
  const DAL=api(),project={id:'book'};DAL.state.projects.book=project;DAL.currentProjectId='book';DAL.ensureBookDesign(project);let saves=0,history=0;
  DAL.pushHistory=()=>history++;DAL.saveState=()=>saves++;DAL.render=()=>{};DAL.toast=()=>{};
  const before=JSON.stringify(project.bookDesign);
  for(const [field,value] of [['fontSize','0'],['fontSize','25'],['lineHeight','.9'],['lineHeight','4'],['paragraphIndent','1.1'],['gutter','25'],['height','Infinity']]){
    const control={value,hasAttribute:key=>key==='data-book-design',getAttribute:()=>field};DAL.testChange(control);assert.equal(control.value,project.bookDesign[field]);assert.equal(JSON.stringify(project.bookDesign),before);
  }
  assert.equal(history,0);assert.equal(saves,0);
});

test('EPUB includes assigned chapter art and deduplicates shared asset bindings',async()=>{
  const DAL=api(),project={id:'book',name:'Book',cover:{},images:[{id:'art',bookPage:3,assetId:'art',name:'Map'}],assets:[{id:'art',name:'map.png'}],chapters:[{id:'one',title:'One',images:[{assetId:'art',name:'Map'}],contentHTML:'<p>The city.</p>'}]};
  const result=await DAL.prepareEpub(project);assert.equal((result.chapters[0].contentHTML.match(/<img /g)||[]).length,1);assert.match(result.chapters[0].contentHTML,/data:image\/png;base64/);
  const print=DAL.bookPrintDocument({...project,chapters:[{...project.chapters[0],contentHTML:'<p>The city.</p>'}]});assert.match(print.html,/publication-illustration/);
});

test('book design changes create undo before mutation and invalid dimensions preserve prior data',()=>{
  const DAL=api(),project={id:'book',bookDesign:{paragraphIndent:.25}},history=[];DAL.state.projects.book=project;DAL.currentProjectId='book';DAL.ensureBookDesign(project);
  DAL.pushHistory=()=>history.push(DAL.clone(project));DAL.saveState=()=>true;DAL.render=()=>{};DAL.toast=()=>{};
  function control(field,value){return{value,hasAttribute:key=>key==='data-book-design',getAttribute:()=>field};}
  DAL.testChange(control('paragraphIndent','0'));assert.equal(project.bookDesign.paragraphIndent,0);assert.equal(history.length,1);assert.equal(history[0].bookDesign.paragraphIndent,.25);
  DAL.testChange(control('width','0'));assert.equal(project.bookDesign.width,6);assert.equal(history.length,1);
  DAL.testChange(control('paragraphIndent','0'));assert.equal(history.length,1);
});

test('EPUB carries contents artwork and later illustration pages in spine order, excluding unassigned art',async()=>{
  const DAL=api(),project={id:'book',name:'Book',cover:{},images:[{bookPage:2,name:'Contents map',dataUrl:'data:image/png;base64,YQ=='},{bookPage:20,name:'Ending map',dataUrl:'data:image/png;base64,Yg=='},{bookPage:8,name:'Earlier map',dataUrl:'data:image/png;base64,Yw=='},{bookPage:0,name:'Private unused art',dataUrl:'data:image/png;base64,ZA=='}],chapters:[{title:'One',contentHTML:'<p>Story</p>'}]};
  const prepared=await DAL.prepareEpub(project),files=DAL.epubFiles(prepared),text=name=>new TextDecoder().decode(files.find(file=>file.name===name).data);
  assert.match(text('EPUB/nav.xhtml'),/Contents map/);assert.match(text('EPUB/package.opf'),/<itemref idref="cover"\/><itemref idref="nav"\/><itemref idref="chapter1"\/><itemref idref="artpage8"\/><itemref idref="artpage20"\/>/);assert.match(text('EPUB/text/illustration-20.xhtml'),/Ending map/);assert.doesNotMatch(files.map(file=>new TextDecoder().decode(file.data)).join(''),/Private unused art/);
});

test('offline print preparation includes cover, contents art, prose and later assigned pages without changing the source',async()=>{
  const DAL=api(),project={id:'book',name:'Book',cover:{},images:[{bookPage:1,name:'Cover art',dataUrl:'data:image/png;base64,YQ=='},{bookPage:2,name:'Contents art',dataUrl:'data:image/png;base64,Yg=='},{bookPage:900000000,name:'Last art',dataUrl:'data:image/png;base64,Yw=='}],chapters:[{title:'One',contentHTML:'<p>Story</p>'}]},before=JSON.stringify(project);
  const result=await DAL.prepareBookPrint(DAL.clone(project));assert.equal(JSON.stringify(project),before);assert.match(result.html,/print-cover/);assert.match(result.html,/Contents art/);assert.match(result.html,/Last art/);assert.ok(result.html.indexOf('Contents art')<result.html.indexOf('<p>Story</p>'));assert.equal((result.html.match(/<img /g)||[]).length,3);assert.ok(result.html.length<10000);
});

test('Book Preview renders a distant assigned page lazily instead of constructing every blank page',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/story-tools.js'),'utf8'),start=source.indexOf('DAL.renderBookPreview ='),end=source.indexOf('\n};',start)+3;
  const DAL=api(),artCalls=[];Object.assign(DAL,{state:{autoFillAuthor:false},readerPage:899999999,_readerPid:'book',uiLabel:(key,fallback)=>fallback,bookPageArt:(project,page)=>{artCalls.push(page);return page===900000000?'<p>Last art</p>':'';},readerStyleAttr:()=>'',readerControls:()=>''});vm.runInNewContext(source.slice(start,end),{DAL});
  const result=DAL.renderBookPreview({id:'book',name:'Book',cover:{},chapters:[],images:[{bookPage:900000000}]});assert.match(result,/Last art/);assert.match(result,/900000000 \/ 900000000/);assert.deepEqual(artCalls,[2,900000000]);assert.equal(DAL._readAloudCid,'');
});
