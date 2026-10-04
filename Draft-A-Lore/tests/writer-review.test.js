const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {holder}=require('./helpers/manuscript-dom.cjs');

function setup(){
  const chapter={id:'first',title:'One',updatedAt:1,contentHTML:'<p><strong><span data-highlight-id="h" style="background-color: rgb(255, 245, 157);">Mira</span></strong> keeps <span data-highlight-id="h" style="background-color: rgb(255, 245, 157);">her promise</span>.</p><p dir="rtl">نص <span dir="ltr">Mira</span></p>'};
  const second={id:'second',title:'Two',updatedAt:2,contentHTML:'<p>Another chapter.</p>'};
  const records={comments:[],highlights:[{id:'h',chapterId:'first',color:'rgb(255, 245, 157)',label:'Research',note:'Keep this note'}],bookmarks:[],footnotes:[],sources:[],exportOptions:{highlights:false,comments:false,footnotes:true,callouts:true}};
  const project={id:'project',chapters:[chapter,second],writer:records,history:[]};
  const ed=holder(chapter.contentHTML),fields={highlightEditColor:{value:'#b9f6ca'},highlightEditLabel:{value:'Continuity'},highlightEditNote:{value:'Saved note'}};
  const calls={saved:0,history:[],warnings:[],renders:0},modals=[];
  const DAL={currentProjectId:project.id,currentTool:'manuscript',selectedChapterId:chapter.id,currentWriterProject:()=>project,writerProject:p=>p.writer,chapterById:(p,id)=>p.chapters.find(c=>c.id===id),
    escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
    registerActionHandler:fn=>{calls.handler=fn;},saveState:()=>{calls.saved++;},pushHistory:()=>{const {history,...content}=project,snapshot=JSON.parse(JSON.stringify(content));calls.history.push(snapshot);history.push(snapshot);},
    modal:(title,body,options)=>modals.push({title,body,options}),toast:message=>calls.warnings.push(message),closeModal(){},render:()=>{calls.renders++;}};
  const sandbox={DAL,document:{createElement:()=>holder(),getElementById:id=>id==='editorContent'?ed:fields[id]||null,addEventListener(){}},window:{getSelection:()=>null},CSS:{escape:String},Date,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/writer-tools.js'),'utf8'),sandbox);
  const action=(name,id)=>calls.handler(name,{getAttribute:()=>id});
  return {DAL,project,chapter,second,records,ed,fields,calls,modals,action};
}

test('highlight edit uses named fields, converts CSS colors and leaves notes untouched before save',()=>{
  const q=setup(),before=JSON.stringify(q.project);
  q.action('writer-highlight-edit','h');
  const modal=q.modals.at(-1);
  assert.match(modal.body,/id="highlightEditColor" value="#fff59d"/);
  for(const id of ['highlightEditColor','highlightEditLabel','highlightEditNote'])assert.ok(modal.body.includes('for="'+id+'"'));
  assert.equal(modal.options.initialFocus,'#highlightEditLabel');assert.equal(JSON.stringify(q.project),before);
});

test('highlight save updates every split mark in the live editor without losing newer prose',()=>{
  const q=setup(),other=JSON.stringify(q.second);
  q.ed.innerHTML+='<p>Latest pending words.</p>';
  q.action('writer-highlight-edit','h');q.action('writer-highlight-save');
  const nodes=q.ed.querySelectorAll('[data-highlight-id="h"]');
  assert.equal(nodes.length,2);nodes.forEach(n=>assert.equal(n.style.backgroundColor,'#b9f6ca'));
  assert.equal(q.chapter.contentHTML,q.ed.innerHTML);assert.match(q.chapter.contentHTML,/Latest pending words/);
  assert.match(q.chapter.contentHTML,/<strong>/);assert.match(q.chapter.contentHTML,/dir="rtl"/);
  assert.equal(q.records.highlights[0].note,'Saved note');assert.equal(q.records.highlights[0].label,'Continuity');
  assert.equal(JSON.stringify(q.second),other);assert.equal(q.calls.history.length,1);assert.equal(q.calls.saved,1);
  assert.match(q.calls.history[0].chapters[0].contentHTML,/Latest pending words/);
  assert.equal(q.DAL._writerHighlightId,null);
  assert.equal(q.DAL._writerReviewBarrier.editor,q.ed);assert.equal(q.DAL._writerReviewBarrier.html,q.ed.innerHTML);
  assert.equal(q.DAL._writerReviewBarrier.snapshot,q.project.history.at(-1));
});

test('explicit highlight deletion unwraps all segments but preserves text, direction and other records',()=>{
  const q=setup(),other=JSON.stringify(q.second);
  q.records.highlights.push({id:'detached',chapterId:'first',note:'Do not lose this'});
  const beforeText=q.ed.textContent;q.action('writer-highlight-delete','h');
  assert.equal(q.ed.textContent,beforeText);assert.equal(q.ed.querySelectorAll('[data-highlight-id="h"]').length,0);
  assert.equal(q.chapter.contentHTML,q.ed.innerHTML);assert.match(q.chapter.contentHTML,/<strong>Mira<\/strong>/);
  assert.match(q.chapter.contentHTML,/dir="rtl"/);assert.equal(JSON.stringify(q.second),other);
  assert.equal(q.records.highlights.length,1);assert.equal(q.records.highlights[0].note,'Do not lose this');
  assert.equal(q.calls.history[0].writer.highlights.length,2);
});

test('opening review never discards detached notes or trusts prototype keys or imported CSS',()=>{
  const q=setup();
  q.records.highlights.push({id:'__proto__',chapterId:'missing',note:'Retain detached',color:'red;position:fixed;inset:0'});
  q.records.bookmarks.push({id:'b" onclick="oops',chapterId:'missing',name:'<Name>'});
  q.records.footnotes.push({id:'f',chapterId:'missing',text:'Retain footnote'});
  const timestamp=q.chapter.updatedAt;q.DAL.showWriterReview();
  assert.equal(q.records.highlights.length,2);assert.equal(q.records.bookmarks.length,1);assert.equal(q.records.footnotes.length,1);
  assert.equal(q.records.highlights[1].chapterId,'missing');assert.equal(q.chapter.updatedAt,timestamp);
  const html=q.modals.at(-1).body;assert.match(html,/Retain detached/);assert.match(html,/Detached highlight/);
  assert.ok(!html.includes('position:fixed'));assert.ok(!html.includes('data-id="b" onclick="oops"'));
  assert.match(html,/aria-label="Delete highlight"/);
  q.action('writer-highlight-jump','__proto__');assert.equal(q.calls.renders,0);assert.equal(q.DAL.selectedChapterId,'first');assert.match(q.calls.warnings[0],/saved notes/);
});

test('editing another chapter never borrows the open editor content',()=>{
  const q=setup();q.second.contentHTML='<p><span data-highlight-id="other">Other text</span></p>';
  q.records.highlights.push({id:'other',chapterId:'second',color:'#fff59d'});
  const live=q.ed.innerHTML;q.action('writer-highlight-edit','other');q.action('writer-highlight-save');
  assert.equal(q.ed.innerHTML,live);assert.match(q.second.contentHTML,/Other text/);assert.match(q.second.contentHTML,/#b9f6ca/);
});

test('footnote deletion and renumbering keep the live manuscript synchronized',()=>{
  const q=setup();q.ed.innerHTML='<p>Words<sup data-footnote-id="f1">[1]</sup> here<sup data-footnote-id="f2">[2]</sup>.</p>';
  q.chapter.contentHTML=q.ed.innerHTML;
  q.records.footnotes.push({id:'f1',chapterId:'first',text:'First',number:1},{id:'f2',chapterId:'first',text:'Second',number:2});
  const other=JSON.stringify(q.second);q.action('writer-footnote-delete','f1');
  assert.equal(q.ed.querySelectorAll('[data-footnote-id="f1"]').length,0);
  assert.equal(q.ed.querySelector('[data-footnote-id="f2"]').textContent,'[1]');
  assert.equal(q.chapter.contentHTML,q.ed.innerHTML);assert.equal(JSON.stringify(q.second),other);
  assert.equal(q.records.footnotes[0].text,'Second');assert.equal(q.calls.history.length,1);
});

test('bookmark deletion removes all of its live markers without losing manuscript prose',()=>{
  const q=setup();q.ed.innerHTML='<p>Before<span data-bookmark-id="b">marker</span>After<span data-bookmark-id="b">marker</span></p>';
  q.chapter.contentHTML=q.ed.innerHTML;q.records.bookmarks.push({id:'b',chapterId:'first',name:'Bookmark'});
  q.action('writer-bookmark-delete','b');assert.equal(q.ed.textContent,'BeforeAfter');
  assert.equal(q.chapter.contentHTML,q.ed.innerHTML);assert.equal(q.records.bookmarks.length,0);
  assert.equal(q.calls.history[0].writer.bookmarks[0].name,'Bookmark');
  assert.equal(q.DAL._writerReviewBarrier.editor,q.ed);
});
