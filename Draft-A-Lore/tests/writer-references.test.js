const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadUiResources}=require('./helpers/ui-resources.cjs');
const {holder}=require('./helpers/manuscript-dom.cjs');

function setup(){
  const chapter={id:'one',title:'Chapter One',contentHTML:'<p dir="rtl"><strong><span data-highlight-id="h">Mira</span></strong></p>'};
  const project={id:'project',chapters:[chapter],characters:[{id:'person:one',name:'Mira'}],lore:{entries:[]},plots:[],adventure:{nodes:[]},history:[],writer:{comments:[],highlights:[],bookmarks:[],footnotes:[],sources:[]}};
  const ed=holder(chapter.contentHTML),fields={},calls={commands:[],warnings:[],modals:[],saved:0,history:[],closed:0,renders:0,events:[]};let current=project,counter=0;
  ed.focus=()=>{calls.focus='editorContent';};ed.contains=node=>{while(node){if(node===ed)return true;node=node.parentNode;}return false;};
  function range(collapsed=false){return {commonAncestorContainer:ed.firstChild,collapsed,toString:()=>collapsed?'':'Mira',cloneRange(){return range(this.collapsed);},collapse(){this.collapsed=true;}};}
  const selection={rangeCount:1,range:range(),getRangeAt(){return this.range;},removeAllRanges(){this.rangeCount=0;},addRange(r){this.range=r;this.rangeCount=1;}};
  function field(id,value=''){return fields[id]={id,value,disabled:false,setAttribute(name,value){this[name]=value;},focus(){calls.focus=id;}};}
  ['writerLinkUrl','writerInternalLink','writerFootnoteText','sourceTitle','sourceAuthor','sourceEdition','sourceDate','sourceReference','sourceUrl','sourceNote'].forEach(id=>field(id));
  const DAL={currentProjectId:project.id,currentTool:'manuscript',selectedChapterId:chapter.id,_writerRange:range(),currentWriterProject:()=>current,writerProject:p=>p.writer,chapterById:(p,id)=>p.chapters.find(c=>c.id===id),uid:kind=>kind+(++counter),
    escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),registerActionHandler:fn=>{calls.handler=fn;},
    pushHistory(){const {history,...rest}=project,snapshot=JSON.parse(JSON.stringify(rest));project.history.push(snapshot);calls.history.push(snapshot);},saveState(){calls.saved++;calls.savedContent=chapter.contentHTML;calls.savedWriter=JSON.parse(JSON.stringify(project.writer));if(calls.saveThrows)throw Error('blocked storage');return calls.saveResult===undefined?true:calls.saveResult;},
    saveChapterContent(){chapter.contentHTML=ed.innerHTML;},modal:(title,body,options)=>calls.modals.push({title,body,options}),toast:message=>calls.warnings.push(message),closeModal:()=>{calls.closed++;},render:()=>{calls.renders++;if(DAL.currentTool==='manuscript'){ed.innerHTML=DAL.chapterById(project,DAL.selectedChapterId).contentHTML;ed.querySelectorAll('h1,h2,h3,h4').forEach(n=>{n.scrollIntoView=()=>{calls.scrolled=n.textContent;calls.scrolledIndex=Array.from(ed.querySelectorAll('h1,h2,h3,h4')).indexOf(n);};});}}};
  const document={createElement:()=>{const root=holder();root.insertAdjacentHTML=(position,html)=>{assert.equal(position,'beforeend');root.innerHTML+=html.replaceAll('<hr>','<hr/>');};return root;},getElementById:id=>id==='editorContent'?(calls.editorUnavailable?null:ed):fields[id]||null,querySelector:()=>({focus(){calls.focus='toggle-chapters';}}),querySelectorAll:selectors=>selectors.split(',').map(s=>fields[s.slice(1)]).filter(Boolean),addEventListener:(kind,fn)=>calls.events.push({kind,fn}),
    execCommand(cmd,ui,value){calls.commands.push({cmd,value});if(calls.commandFails)return false;if(cmd==='insertHTML')ed.innerHTML+=value;return true;}};
  loadUiResources(DAL);
  calls.timers=[];vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/writer-tools.js'),'utf8'),{DAL,document,window:{getSelection:()=>selection,open:()=>{calls.opened=true;},location:{}},CSS:{escape:String},Date,URL,setTimeout:fn=>calls.timers.push(fn),clearTimeout});
  const button={disabled:false,getAttribute:()=>null},action=(name,id)=>calls.handler(name,id===undefined?button:{getAttribute:()=>id});
  const clickLink=href=>calls.events.filter(e=>e.kind==='click').forEach(e=>e.fn({ctrlKey:true,preventDefault(){calls.prevented=true;},target:{closest:selector=>selector==='#editorContent a[href]'?{getAttribute:()=>href}:null}}));
  const outlineJump=(cid,heading=null)=>calls.handler('writer-outline-jump',{getAttribute:key=>key==='data-cid'?cid:heading});
  return {DAL,project,chapter,ed,fields,calls,button,action,range,clickLink,outlineJump,changeProject:()=>{current={...project,id:'different',writer:{sources:[],footnotes:[]}};}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('footnotes number in chapter/passage order, preserve detached records and handle prototype-like IDs',()=>{
  const q=setup();q.ed.innerHTML='<p>Earlier<sup data-footnote-id="__proto__">[2]</sup> later<sup data-footnote-id="old">[1]</sup></p>';q.chapter.contentHTML=q.ed.innerHTML;
  q.project.writer.footnotes.push({id:'old',text:'Later',number:1},{id:'detached',text:'Keep detached',number:2},{id:'__proto__',text:'Earlier',number:3});
  q.DAL.showWriterReferences();assert.deepEqual(Array.from(q.project.writer.footnotes,f=>f.id),['__proto__','old','detached']);assert.equal(q.ed.querySelector('[data-footnote-id="__proto__"]').textContent,'[1]');assert.equal(q.ed.querySelector('[data-footnote-id="old"]').textContent,'[2]');assert.equal(q.project.writer.footnotes[2].text,'Keep detached');
});

test('link fields and imported record IDs are named and escaped without mutating prose',()=>{
  const q=setup();q.project.characters.push({id:'x" autofocus="true',name:'<Name>'});const before=q.ed.innerHTML;q.action('writer-link');
  const modal=q.calls.modals.at(-1);assert.match(modal.body,/for="writerLinkUrl"/);assert.match(modal.body,/for="writerInternalLink"/);assert.equal(modal.options.initialFocus,'#writerLinkUrl');
  assert.match(modal.body,/character:x&quot; autofocus=&quot;true/);assert.ok(!modal.body.includes('value="character:x" autofocus="true"'));assert.equal(q.ed.innerHTML,before);
});
test('linking selected prose uses native createLink instead of replacing formatted HTML',()=>{
  const q=setup(),before=q.ed.innerHTML;q.action('writer-link');q.fields.writerLinkUrl.value='https://example.com/reference';q.action('writer-link-save');
  assert.equal(q.calls.commands[0].cmd,'createLink');assert.equal(q.calls.commands[0].value,'https://example.com/reference');assert.equal(q.ed.innerHTML,before);assert.equal(q.calls.closed,1);
});
test('collapsed caret inserts an escaped address while malformed, unsafe and credential URLs cannot replace text',()=>{
  for(const address of ['', 'https://','https:///','javascript:alert(1)','data:text/html,test','https://name:password@example.com','mailto:','mailto:not-an-address','https://example.com/\nnew']){
    const q=setup();q.action('writer-link');q.fields.writerLinkUrl.value=address;q.action('writer-link-save');assert.equal(q.calls.commands.length,0,address);assert.equal(q.calls.closed,0);assert.equal(q.calls.focus,'writerLinkUrl');
  }
  const q=setup();q.DAL._writerRange=q.range(true);q.action('writer-link');q.fields.writerLinkUrl.value='https://example.com/?a=1&b=2';q.action('writer-link-save');assert.equal(q.calls.commands[0].cmd,'insertHTML');assert.match(q.calls.commands[0].value,/a=1&amp;b=2/);
  const mail=setup();mail.action('writer-link');mail.fields.writerLinkUrl.value='mailto:writer@example.com';mail.action('writer-link-save');assert.equal(mail.calls.commands[0].value,'mailto:writer@example.com');
});
test('internal links preserve colon IDs, reject missing records and refuse stale manuscript selections',()=>{
  const q=setup();q.action('writer-link');q.fields.writerInternalLink.value='character:person:one';q.action('writer-link-save');assert.equal(q.calls.commands[0].value,'#dal:character:person:one');
  const missing=setup();missing.action('writer-link');missing.fields.writerInternalLink.value='scene:missing';missing.action('writer-link-save');assert.equal(missing.calls.commands.length,0);
  for(const stale of [q=>q.changeProject(),q=>{q.DAL.selectedChapterId='different';},q=>{q.ed.innerHTML+='<p>New words</p>';},q=>{q.DAL.currentTool='characters';}]){
    const x=setup();x.action('writer-link');x.fields.writerLinkUrl.value='https://example.com';stale(x);x.action('writer-link-save');assert.equal(x.calls.commands.length,0);assert.match(x.calls.warnings.at(-1),/selection changed/);
  }
});
test('unsupported editor commands keep the link dialog open and saved prose unchanged',()=>{
  const q=setup();q.calls.commandFails=true;q.action('writer-link');q.fields.writerLinkUrl.value='https://example.com';q.action('writer-link-save');assert.equal(q.calls.closed,0);assert.equal(q.calls.saved,0);assert.match(q.calls.warnings.at(-1),/could not be inserted/);
});
test('internal navigation verifies the record before changing the selected entity',()=>{
  const q=setup();q.clickLink('#dal:character:missing');assert.equal(q.calls.renders,0);assert.equal(q.DAL.currentTool,'manuscript');assert.match(q.calls.warnings.at(-1),/no longer exists/);
  q.clickLink('#dal:character:person:one');assert.equal(q.DAL.selectedCharId,'person:one');assert.equal(q.DAL.currentTool,'characters');assert.equal(q.calls.renders,1);
});

test('touch/keyboard open-link action follows a selected internal link and refuses a stale or absent link',()=>{
  const q=setup();q.ed.innerHTML='<p><a href="#dal:character:person:one"><strong>Mira</strong></a></p>';q.DAL._writerRange={commonAncestorContainer:q.ed.firstChild.firstChild.firstChild};q.action('writer-link-open');assert.equal(q.DAL.currentTool,'characters');assert.equal(q.DAL.selectedCharId,'person:one');assert.equal(q.calls.renders,1);
  const plain=setup();plain.action('writer-link-open');assert.equal(plain.calls.renders,0);assert.match(plain.calls.warnings.at(-1),/cursor inside a link/);
  const stale=setup();stale.DAL._writerRange={commonAncestorContainer:holder('<a href="#dal:chapter:one">Old</a>')};stale.action('writer-link-open');assert.equal(stale.calls.renders,0);
});
test('references escape imported IDs, use distinct delete names and retain detached notes',()=>{
  const q=setup();q.project.writer.sources.push({id:'source" onclick="oops',title:'<Book>',note:'Kept'});q.project.writer.footnotes.push({id:'foot" onclick="oops',number:1,chapterId:'missing',text:'Detached'});
  q.action('writer-references');const html=q.calls.modals.at(-1).body;assert.match(html,/source&quot; onclick=&quot;oops/);assert.match(html,/aria-label="Delete source: &lt;Book&gt;"/);assert.match(html,/aria-label="Delete footnote \[1\]"/);assert.match(html,/Detached/);assert.equal(q.project.writer.footnotes.length,1);
});
test('source dialogs name every field, preserve partial notes, validate blank/invalid input and cancel without writes',()=>{
  const q=setup();q.action('writer-source-add');const modal=q.calls.modals.at(-1);for(const id of Object.keys(q.fields).filter(id=>id.startsWith('source')))assert.ok(modal.body.includes('for="'+id+'"'));
  assert.equal(modal.options.initialFocus,'#sourceTitle');q.action('writer-source-save');assert.equal(q.project.writer.sources.length,0);assert.equal(q.calls.focus,'sourceTitle');
  q.fields.sourceTitle.value='Research';q.fields.sourceUrl.value='javascript:alert(1)';q.action('writer-source-save');assert.equal(q.project.writer.sources.length,0);assert.equal(q.calls.focus,'sourceUrl');
  q.action('writer-references');assert.equal(q.project.writer.sources.length,0);assert.equal(q.calls.saved,0);
});
test('source add, edit, delete and retry preserve metadata and provide project undo snapshots',async()=>{
  const q=setup();q.action('writer-source-add');q.fields.sourceTitle.value='Field Notes';q.fields.sourceAuthor.value='QA author';q.fields.sourceReference.value='Verse 7';q.fields.sourceNote.value='  Keep whitespace\nNew line  ';q.fields.sourceUrl.value='https://example.com';
  q.action('writer-source-save');assert.equal(q.button.disabled,true);await settle();assert.equal(q.button.disabled,false);assert.equal(q.calls.modals.at(-1).title,'References');
  const saved=JSON.parse(JSON.stringify(q.project.writer.sources[0]));assert.equal(saved.note,'  Keep whitespace\nNew line  ');assert.equal(q.calls.history.length,1);assert.equal(q.calls.history[0].writer.sources.length,0);
  q.action('writer-source-edit',saved.id);q.fields.sourceTitle.value='Revised Notes';q.action('writer-source-save');await settle();assert.equal(q.project.writer.sources[0].title,'Revised Notes');assert.equal(q.calls.history[1].writer.sources[0].title,'Field Notes');
  q.action('writer-source-delete',saved.id);assert.equal(q.project.writer.sources.length,0);assert.equal(q.calls.history.at(-1).writer.sources[0].title,'Revised Notes');assert.equal(q.chapter.contentHTML,q.ed.innerHTML);assert.equal(q.DAL._writerReviewBarrier.snapshot,q.project.history.at(-1));
});
test('failed durable source save keeps the form and memory record, and retry never duplicates it',async()=>{
  for(const mode of ['false','rejection','throw']){
    const q=setup();q.calls.saveResult=mode==='rejection'?Promise.reject(Error('quota')):false;q.calls.saveThrows=mode==='throw';q.action('writer-source-add');q.fields.sourceNote.value='Only a research note';q.action('writer-source-save');q.action('writer-source-save');await settle();
    assert.equal(q.project.writer.sources.length,1);assert.equal(q.calls.saved,1);assert.equal(q.calls.modals.at(-1).title,'Add Source');assert.match(q.calls.warnings.at(-1),/still in memory/);assert.equal(q.fields.sourceNote.disabled,false);
    q.calls.saveResult=true;q.calls.saveThrows=false;q.action('writer-source-save');await settle();assert.equal(q.project.writer.sources.length,1);assert.equal(q.calls.history.length,1);assert.equal(q.calls.modals.at(-1).title,'References');
  }
});
test('stale source editors and delayed save callbacks cannot write into or reopen another project',async()=>{
  const q=setup();q.action('writer-source-add');q.fields.sourceTitle.value='Draft';q.changeProject();q.action('writer-source-save');assert.equal(q.calls.saved,0);assert.equal(q.project.writer.sources.length,0);
  const delayed=setup();let resolve;delayed.calls.saveResult=new Promise(r=>resolve=r);delayed.action('writer-source-add');delayed.fields.sourceTitle.value='Captured';delayed.action('writer-source-save');delayed.action('writer-references');delayed.action('writer-source-add');const count=delayed.calls.modals.length;resolve(true);await settle();assert.equal(delayed.calls.modals.length,count);
  const missing=setup();missing.project.writer.sources.push({id:'old',title:'Keep'});missing.action('writer-source-edit','old');missing.project.writer.sources=[];missing.action('writer-source-save');assert.equal(missing.project.writer.sources.length,0);
});
test('footnote edits are named, validated, durable and undoable without recreating stale records',async()=>{
  const q=setup();q.project.writer.footnotes.push({id:'f',number:1,text:'Original',chapterId:'one'});q.action('writer-footnote-edit','f');assert.match(q.calls.modals.at(-1).body,/for="writerFootnoteText"/);assert.equal(q.calls.modals.at(-1).options.initialFocus,'#writerFootnoteText');
  q.action('writer-footnote-save');assert.equal(q.calls.saved,0);q.fields.writerFootnoteText.value='Revised';q.action('writer-footnote-save');await settle();assert.equal(q.project.writer.footnotes[0].text,'Revised');assert.equal(q.calls.history[0].writer.footnotes[0].text,'Original');
  q.action('writer-footnote-edit','f');q.project.writer.footnotes=[];q.action('writer-footnote-save');assert.equal(q.project.writer.footnotes.length,0);assert.match(q.calls.warnings.at(-1),/no longer exists/);
});
test('new footnotes preserve selected prose and failed saves retry the same marker and record',async()=>{
  const q=setup(),before=q.ed.textContent;q.calls.saveResult=false;q.DAL.writerFootnoteEditor();q.fields.writerFootnoteText.value='New footnote';q.action('writer-footnote-save');await settle();
  assert.ok(q.ed.textContent.startsWith(before));assert.equal(q.calls.commands[0].cmd,'insertHTML');assert.equal(q.project.writer.footnotes.length,1);assert.equal(q.DAL._writerRange.collapsed,true);assert.equal(q.calls.history[0].writer.footnotes.length,0);
  q.calls.saveResult=true;q.action('writer-footnote-save');await settle();assert.equal(q.project.writer.footnotes.length,1);assert.equal(q.calls.commands.length,1);assert.equal(q.ed.querySelectorAll('[data-footnote-id]').length,1);
});

test('footnote order and undo boundary are synchronized before the durable write, not after it',async()=>{
  const q=setup();q.project.writer.footnotes.push({id:'later',text:'Later',number:1},{id:'earlier',text:'Before',number:2});q.ed.innerHTML='<p>Earlier<sup data-footnote-id="earlier">[2]</sup> then later<sup data-footnote-id="later">[1]</sup></p>';q.chapter.contentHTML=q.ed.innerHTML;
  q.DAL.writerFootnoteEditor(q.project.writer.footnotes[1]);q.fields.writerFootnoteText.value='Edited earlier';q.action('writer-footnote-save');await settle();
  assert.equal(q.calls.savedWriter.footnotes[0].id,'earlier');assert.equal(q.calls.savedWriter.footnotes[0].number,1);assert.match(q.calls.savedContent,/data-footnote-id="earlier">\[1\]/);assert.equal(q.DAL._writerReviewBarrier.html,q.ed.innerHTML);
});

test('published footnote list retains the manuscript reference number rather than restarting at one',()=>{
  const q=setup();q.DAL.sanitizeRichHTML=html=>html;q.chapter.contentHTML='<p dir="rtl">Mira<sup class="writer-footnote-ref" data-footnote-id="second">[2]</sup></p>';
  q.project.writer.footnotes.push({id:'second',number:2,text:'<Citation>'});const output=q.DAL.writerPublishHTML(q.project,q.chapter);
  assert.match(output,/<li value="2">&lt;Citation&gt;<\/li>/);assert.match(output,/dir="rtl"/);assert.match(output,/\[2\]/);assert.equal(q.project.writer.footnotes[0].number,2);
});

test('outline renders named, escaped chapter/heading buttons using fresh live prose without writes',()=>{
  const q=setup();q.chapter.id='chapter" onclick="oops';q.chapter.title='<Chapter>';q.DAL.selectedChapterId=q.chapter.id;q.ed.innerHTML='<h2>New &amp; current heading</h2><p dir="rtl">Keep draft</p>';const before=q.chapter.contentHTML;
  q.DAL.showWriterOutline();const modal=q.calls.modals.at(-1);assert.match(modal.body,/data-cid="chapter&quot; onclick=&quot;oops"/);assert.match(modal.body,/aria-label="Open heading 1: New &amp; current heading in &lt;Chapter&gt;"/);assert.match(modal.body,/type="button"/);assert.equal(q.chapter.contentHTML,before);assert.equal(q.calls.saved,0);
});
test('outline chapter jump from another tool switches to Manuscript and returns focus without opening the keyboard',()=>{
  const q=setup();q.DAL.currentTool='characters';q.DAL.showWriterOutline();q.outlineJump('one');assert.equal(q.DAL.currentTool,'manuscript');assert.equal(q.DAL.selectedChapterId,'one');assert.equal(q.calls.renders,1);assert.equal(q.calls.focus,'toggle-chapters');assert.equal(q.calls.closed,1);
});
test('outline heading jump selects the exact repeated heading and preserves pending manuscript prose',()=>{
  const q=setup();q.ed.innerHTML='<h2>Repeated</h2><p>New pending words</p><h2>Repeated</h2><p dir="rtl">Keep direction</p>';q.DAL.showWriterOutline();q.outlineJump('one','1');q.calls.timers.at(-1)();assert.equal(q.calls.scrolled,'Repeated');assert.equal(q.calls.scrolledIndex,1);assert.match(q.chapter.contentHTML,/New pending words/);assert.match(q.chapter.contentHTML,/dir="rtl"/);
});
test('outline refuses removed chapters, malformed indices, changed headings and another project without navigating',()=>{
  for(const mutate of [q=>{q.project.chapters=[];},q=>q.changeProject(),q=>{q.ed.innerHTML+='<h2>Added</h2>'; }]){
    const q=setup();q.ed.innerHTML='<h2>Original</h2>';q.DAL.showWriterOutline();mutate(q);q.outlineJump('one','0');assert.equal(q.calls.renders,0);assert.equal(q.calls.closed,0);assert.match(q.calls.warnings.at(-1),/outline changed/);
  }
  for(const index of ['-2','NaN','1x','99']){const q=setup();q.ed.innerHTML='<h2>Original</h2>';q.DAL.showWriterOutline();q.outlineJump('one',index);assert.equal(q.calls.renders,0);}
});
test('delayed outline scrolling never targets a missing editor, changed chapter/tool/project or newer outline',()=>{
  for(const mutate of [q=>{q.calls.editorUnavailable=true;},q=>{q.DAL.selectedChapterId='other';},q=>{q.DAL.currentTool='characters';},q=>q.changeProject(),q=>q.DAL.showWriterOutline(),q=>{q.ed.innerHTML+='<p>Changed after render</p>'; }]){
    const q=setup();q.ed.innerHTML='<h2>Original</h2>';q.DAL.showWriterOutline();q.outlineJump('one','0');mutate(q);assert.doesNotThrow(()=>q.calls.timers.at(-1)());assert.equal(q.calls.scrolled,undefined);
  }
});
test('empty outline explains how to populate it without creating placeholder content',()=>{
  const q=setup();q.project.chapters=[];q.DAL.showWriterOutline();assert.match(q.calls.modals.at(-1).body,/Add chapters or headings/);assert.equal(q.project.chapters.length,0);assert.equal(q.calls.saved,0);
});
