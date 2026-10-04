const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {holder}=require('./helpers/manuscript-dom.cjs');
const {loadWordCounters}=require('./helpers/word-counters.cjs');

function api(){
  const source=fs.readFileSync(path.join(__dirname,'../src/story-tools.js'),'utf8');
  const chapter={id:'chapter',title:'Chapter <One>',updatedAt:1,contentHTML:'<span contenteditable="false" data-bookmark-id="b">🔖</span><p><b>Mira keeps</b> her promise.</p><p dir="rtl">نص <span dir="ltr">Mira</span></p><sup contenteditable="false" data-footnote-id="f">[1]</sup>'};
  const project={id:'project',chapters:[chapter]},find={query:'Mira',replace:'',scope:'chapter',caseSensitive:false,wholeWord:false},fields={},calls={warnings:[],renders:0,saves:0,histories:0,modals:[]};
  const DAL={selectedChapterId:chapter.id,currentTool:'manuscript',currentWriterProject:()=>project,writerState:()=>({find}),chapterById:(p,id)=>p.chapters.find(c=>c.id===id),
    escapeHtml:v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
    closeModal(){},render:()=>{calls.renders++;},toast:m=>calls.warnings.push(m),modal:(...args)=>calls.modals.push(args),pushHistory:()=>{calls.histories++;},writerSave:()=>{calls.saves++;}};
  const editor=holder(chapter.contentHTML),selection={removeAllRanges(){},addRange(range){calls.range=range;}},document={createElement:()=>holder(),getElementById:id=>id==='editorContent'?editor:fields[id]||null,createRange:()=>({setStart(node,offset){this.start={node,offset};},setEnd(node,offset){this.end={node,offset};}})};
  editor.focus=()=>{};let callback;
  vm.runInNewContext(source.slice(source.indexOf('DAL.findOptions ='),source.indexOf('DAL.projectSearch =')),{DAL});
  loadWordCounters(DAL,document);
  vm.runInNewContext(source.slice(source.indexOf('DAL.chapterSearchModel ='),source.indexOf('DAL.showComments =')),{DAL,document,window:{getSelection:()=>selection},setTimeout:fn=>{callback=fn;}});
  const actionStart=source.indexOf('DAL.handleWriterAction=function'),actionEnd=source.indexOf("  if(action==='show-comments')",actionStart);
  vm.runInNewContext(source.slice(actionStart,actionEnd)+'return false;};',{DAL,document});
  const options=(extra={})=>Object.assign({query:'Mira',replace:'Lyra',scope:'chapter',caseSensitive:false,wholeWord:false},extra);
  const form=(extra={})=>{const o=options(extra);Object.assign(fields,{findQuery:{value:o.query},findReplace:{value:o.replace},findScope:{value:o.scope},findCase:{checked:o.caseSensitive},findWhole:{checked:o.wholeWord}});};
  return {DAL,chapter,project,editor,find,fields,calls,options,form,finish:()=>callback&&callback(),action:(name,index=0)=>DAL.handleWriterAction(name,{getAttribute:()=>String(index)})};
}

test('search maps editable Unicode prose, formatting and block boundaries without indexing reference markers',()=>{
  const q=api(),model=q.DAL.chapterSearchModel(q.chapter);
  assert.equal(model.text,'Mira keeps her promise.\nنص Mira\n');
  assert.equal(q.DAL.findMatches(q.project,q.options()).length,2);
  assert.equal(q.DAL.findMatches(q.project,q.options({query:'🔖'})).length,0);
  assert.equal(q.DAL.findMatches(q.project,q.options({query:'[1]'})).length,0);
  const root=holder('<p>a<br/>b</p><p>c</p>');assert.equal(q.DAL.manuscriptTextModel(root).text,'a\nb\nc\n');
});

test('second occurrence navigation selects its exact node rather than the first repeated phrase',()=>{
  const q=api(),matches=q.DAL.findMatches(q.project,q.options());
  q.DAL.openFindMatch(matches[1]);q.finish();
  assert.equal(q.calls.range.start.node.parentNode.getAttribute('dir'),'ltr');
  assert.equal(q.calls.range.start.offset,0);assert.equal(q.calls.range.end.offset,4);
  q.DAL.openFindMatch(matches[0]);q.finish();assert.equal(q.calls.range.start.node.parentNode.tagName,'b');
});

test('navigation supports phrases spanning formatted nodes and cancels stale or superseded jumps',()=>{
  const q=api(),m=q.DAL.findMatches(q.project,q.options({query:'keeps her'}))[0];
  q.DAL.openFindMatch(m);q.finish();assert.equal(q.calls.range.start.node.parentNode.tagName,'b');assert.equal(q.calls.range.end.node.parentNode.tagName,'p');
  q.calls.range=null;q.DAL.openFindMatch(m);q.DAL.selectedChapterId='another';q.finish();assert.equal(q.calls.range,null);
  q.DAL.selectedChapterId='chapter';q.chapter.contentHTML='<p>Newer writing</p>';q.DAL.openFindMatch(m);assert.match(q.calls.warnings.at(-1),/changed/);
});

test('replacement spans formatting while preserving tags, independent direction and reference metadata',()=>{
  const q=api();
  assert.equal(q.DAL.replaceTextNodes(q.chapter,q.options({query:'keeps her',replace:'holds'})),1);
  assert.match(q.chapter.contentHTML,/<b>Mira holds<\/b> promise\./);
  assert.match(q.chapter.contentHTML,/data-bookmark-id="b"/);assert.match(q.chapter.contentHTML,/data-footnote-id="f"/);
  assert.match(q.chapter.contentHTML,/dir="rtl"/);assert.match(q.chapter.contentHTML,/dir="ltr"/);
  assert.equal(q.DAL.replaceTextNodes(q.chapter,q.options({query:'[1]',replace:'broken'})),0);
});

test('replace-one uses the recorded offset and bulk replacements apply right to left with literal replacement text',()=>{
  const q=api(),second=q.DAL.findMatches(q.project,q.options())[1];
  assert.equal(q.DAL.replaceTextNodes(q.chapter,q.options(),second.index),1);
  assert.match(q.chapter.contentHTML,/<b>Mira keeps<\/b>/);assert.match(q.chapter.contentHTML,/>Lyra<\/span>/);
  q.chapter.contentHTML='<p><b>Mira Mira</b> Mira <i>Mira</i></p>';
  assert.equal(q.DAL.replaceTextNodes(q.chapter,q.options({replace:'$& <long>'})),4);
  const text=q.DAL.chapterSearchModel(q.chapter).text;assert.equal(text,'$& <long> $& <long> $& <long> $& <long>\n');assert.match(q.chapter.contentHTML,/&lt;long&gt;/);
  const before=q.chapter.contentHTML;assert.equal(q.DAL.replaceTextNodes(q.chapter,q.options({query:''})),0);assert.equal(q.chapter.contentHTML,before);
});

test('whole-word matching respects Unicode letters, combining marks and underscores, with literal regex characters',()=>{
  const q=api(),matches=(text,query)=>q.DAL.findTextMatches(text,q.options({query,wholeWord:true}));
  assert.equal(matches('é été étéx _été','été').length,1);
  assert.equal(matches('نور نوري نور','نور').length,2);
  assert.equal(matches('á áx','á').length,1);
  assert.equal(matches('𐐀name name𐐀 name','name').length,1);
  assert.equal(q.DAL.findTextMatches('a+b A+B ab',q.options({query:'a+b'})).length,2);
});

test('clearing the query is honored, while absent controls do not reset saved scope or flags',()=>{
  const q=api();q.form({query:'',scope:'manuscript',caseSensitive:true,wholeWord:true});
  assert.equal(q.DAL.readFindForm().query,'');assert.equal(q.find.scope,'manuscript');
  for(const key of Object.keys(q.fields))delete q.fields[key];q.DAL.readFindForm();assert.equal(q.find.caseSensitive,true);assert.equal(q.find.wholeWord,true);
});

test('result controls are native named buttons and stale query changes cannot replace older results',()=>{
  const q=api();q.DAL.showFindModal();const html=q.calls.modals.at(-1)[1];
  assert.match(html,/<button type="button" class="writer-result-jump"/);assert.match(html,/aria-label="Open match 2 in Chapter &lt;One&gt;"/);
  assert.match(html,/aria-label="Search scope"/);q.form({query:'promise'});q.action('find-replace-one',0);
  assert.equal(q.calls.histories,0);assert.equal(q.calls.saves,0);assert.match(q.calls.warnings.at(-1),/options changed/);
  q.form();q.DAL.showFindModal();q.chapter.contentHTML='<p>Newer writing</p>';q.action('find-replace-one',0);assert.equal(q.calls.saves,0);assert.match(q.calls.warnings.at(-1),/changed/);
});

test('replacement refreshes the open editor before reopening Find and preserves chapter scope',()=>{
  const q=api();q.project.chapters.push({id:'other',title:'Other',contentHTML:'<p>Mira elsewhere</p>'});q.form();q.DAL.showFindModal();
  q.action('find-replace-one',1);assert.equal(q.calls.renders,1);assert.equal(q.calls.saves,1);assert.match(q.chapter.contentHTML,/>Lyra<\/span>/);
  assert.equal(q.project.chapters[1].contentHTML,'<p>Mira elsewhere</p>');q.form({query:'missing'});q.action('find-replace-all');assert.equal(q.calls.histories,1);
});

test('Find Next advances between occurrences and resets when its query changes',()=>{
  const q=api(),opened=[];q.DAL.openFindMatch=m=>opened.push(m.index);q.form();
  q.action('find-next-modal');q.action('find-next');assert.notEqual(opened[0],opened[1]);
  q.form({query:'keeps'});q.action('find-next-modal');assert.equal(opened[2],5);
});

test('large result sets are paged without losing total matches or global replacement indices',()=>{
  const q=api();q.chapter.contentHTML='<p>'+'Mira '.repeat(120)+'</p>';q.form();q.DAL.showFindModal();
  assert.equal(q.DAL._findMatches.length,120);let html=q.calls.modals.at(-1)[1];assert.equal((html.match(/class="writer-result-jump"/g)||[]).length,50);assert.match(html,/Matches 1–50 of 120/);
  q.action('find-page-next');html=q.calls.modals.at(-1)[1];assert.match(html,/data-find-index="50"/);assert.match(html,/Matches 51–100 of 120/);
  q.action('find-page-next');html=q.calls.modals.at(-1)[1];assert.equal((html.match(/class="writer-result-jump"/g)||[]).length,20);assert.match(html,/data-action="find-page-next" disabled/);
  q.action('find-replace-one',119);assert.equal(q.DAL.findMatches(q.project,q.options()).length,119);assert.match(q.chapter.contentHTML,/Lyra <\/p>/);
  q.form({query:'Lyra'});q.action('find-run');assert.equal(q.DAL._findPage,0);
});

test('Enter runs Find from either text field without submitting during composition',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/story-tools.js'),'utf8'),start=source.indexOf("document.addEventListener('keydown', function(e){",source.indexOf('DAL.saveChapterContent =')),end=source.indexOf('\n});',start)+5;
  let handler,runs=0;const DAL={fireAction:action=>{assert.equal(action,'find-run');runs++;}};
  vm.runInNewContext(source.slice(start,end),{DAL,document:{addEventListener:(name,fn)=>{handler=fn;}}});
  function event(id,isComposing=false){return {key:'Enter',isComposing,target:{id,closest:()=>null},preventDefault(){this.prevented=true;}};}
  let e=event('findQuery');handler(e);assert.equal(e.prevented,true);handler(event('findReplace'));assert.equal(runs,2);
  e=event('findQuery',true);handler(e);assert.equal(runs,2);assert.equal(e.prevented,undefined);
});
