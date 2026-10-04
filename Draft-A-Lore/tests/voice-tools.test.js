const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {loadUiResources}=require('./helpers/ui-resources.cjs');

function setup(local = true, native) {
  let instance, actionHandler, timer;
  class Recognition {
    constructor() { instance = this; if(local) this.processLocally = false; }
    start() { this.started = true; this.onstart(); }
    abort() { this.aborted = true; }
    stop() { this.onend(); }
  }
  const elements = {};
  const project = { id: 'p', language: 'en-US', dictationDraft: 'Existing note.',chapters:[] };
  const DAL = {
    state: { projects: { p: project } }, activeProject() { return project; },
    currentProjectId:'p',selectedChapterId: 'chapter', escapeHtml(value) { return String(value); },
    saveState() {}, closeModal() {for(const id of Object.keys(elements))if(id.startsWith('dictation'))delete elements[id];}, registerActionHandler(handler) { actionHandler = handler; },
    modal(title,body,options) {
      DAL.closeModal();
      DAL.lastModal={title,body,options};
      for(const id of ['dictationDraft','dictationStatus','dictationStart','dictationStop','dictationInterim','dictationLanguage','dictationNetwork'])
        elements[id] = { value: '', checked: false, addEventListener() {} };
      elements.dictationDraft.value = body.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)[1];
      elements.dictationLanguage.value = 'en-US';
    }
  };
  const context = { DAL, setTimeout(callback) { timer = callback; return 1; }, clearTimeout() { timer = null; }, window: { SpeechRecognition: Recognition }, navigator: { language: 'en-US' }, document: { getElementById(id) { return elements[id]; } } };
  if(native)context.window.Capacitor={getPlatform:()=> 'android',Plugins:{Voice:native}};
  loadUiResources(DAL);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/voice-tools.js'), 'utf8'), context);
  DAL.showDictation();
  return { DAL, elements, project, context,instance: () => instance, action: name => actionHandler(name), expire: () => { if(timer) timer(); } };
}

test('dictation destination accurately describes append, insertion and deliberate replacement',()=>{
  const {DAL}=setup();
  assert.match(DAL.dictationDestination('Seven',null,false),/end of the chapter/);
  assert.match(DAL.dictationDestination('Seven',{collapsed:true},true),/at your cursor/);
  assert.match(DAL.dictationDestination('Seven',{collapsed:false},false),/keeping its text/);
  assert.match(DAL.dictationDestination('Seven',{collapsed:false},true),/replacing the selected passage/);
  assert.match(DAL.dictationDestination('',null,false),/Untitled chapter/);
});

test('translated voice controls are escaped, consent stays opt-in and user notes are unchanged',()=>{
  const api=setup();
  api.DAL.escapeHtml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  api.DAL.i18n={text:(key,fallback)=>key==='dictationStart'?'<Start & listen>':fallback};
  const original=api.project.dictationDraft;
  api.DAL.showDictation();
  assert.match(api.DAL.lastModal.body,/data-action="dictation-start"[^>]*>&lt;Start &amp; listen&gt;/);
  assert.match(api.DAL.lastModal.body,/id="dictationNetwork">/);
  assert.doesNotMatch(api.DAL.lastModal.body,/id="dictationNetwork" checked/);
  assert.match(api.DAL.lastModal.options.footer,/data-action="dictation-insert" disabled/);
  assert.equal(api.project.dictationDraft,original);
  assert.equal(api.elements.dictationDraft.value,original);
  assert.match(api.DAL.dictationDestination('A {title}',null,false),/Destination: A \{title\}/);
});

test('failed Android stop unlocks dictation immediately and releases its listener',async()=>{
  let removed=0;
  const native={addListener:async()=>({remove:async()=>{removed++;}}),start:async()=>{},stop:async options=>{if(!options.abort)throw new Error('Speech service stopped unexpectedly.');}};
  const api=setup(true,native);await api.DAL.startDictation();
  api.action('dictation-stop');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(api.elements.dictationStart.disabled,false);
  assert.equal(api.elements.dictationDraft.readOnly,false);
  assert.match(api.elements.dictationStatus.textContent,/unexpectedly/);
  assert.equal(removed,1);assert.equal(api.project.dictationDraft,'Existing note.');
});

test('Android without speech services explains the limitation and disables listening',async()=>{
  const api=setup(true,{capabilities:async()=>({recognition:false,offline:false})});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(api.elements.dictationStart.disabled,true);
  assert.match(api.elements.dictationStatus.textContent,/No speech recognition service/);
  assert.equal(api.elements.dictationDraft.value,'Existing note.');
});

test('dictation preserves existing draft and commits only final speech results', async () => {
  const api = setup();
  await api.DAL.startDictation();
  const speech = api.instance();
  assert.equal(speech.processLocally, true);
  speech.onresult({ resultIndex: 0, results: [Object.assign([{transcript:'New words.'}], {isFinal:true}), Object.assign([{transcript:'unfinished'}], {isFinal:false})] });
  assert.equal(api.project.dictationDraft, 'Existing note. New words.');
  assert.equal(api.elements.dictationInterim.textContent, 'unfinished');
  api.DAL.stopDictation();
  speech.onresult({ resultIndex: 0, results: [Object.assign([{transcript:'Late words'}], {isFinal:true})] });
  assert.equal(api.project.dictationDraft, 'Existing note. New words.');
  assert.equal(speech.aborted, true);
});

test('browser-only online recognition requires explicit consent', async () => {
  const api = setup(false);
  await api.DAL.startDictation();
  assert.equal(api.instance().started, undefined);
  assert.match(api.elements.dictationStatus.textContent, /Offline recognition is not supported/);
  api.elements.dictationNetwork.checked = true;
  await api.DAL.startDictation();
  assert.equal(api.instance().started, true);
});

test('recognition failure preserves draft and unlocks review controls', async () => {
  const api = setup();
  await api.DAL.startDictation();
  api.instance().onerror({error:'not-allowed'});
  assert.equal(api.elements.dictationDraft.readOnly, false);
  assert.equal(api.elements.dictationStart.disabled, false);
  assert.equal(api.project.dictationDraft, 'Existing note.');
  assert.match(api.elements.dictationStatus.textContent, /denied/);
});

test('dictation insertion separates neighboring prose without separating punctuation', () => {
  const { DAL } = setup();
  assert.equal(DAL.dictationInsertionText('New sentence.', 'Previous sentence.', ''), ' New sentence.');
  assert.equal(DAL.dictationInsertionText('new', 'A ', 'word'), 'new ');
  assert.equal(DAL.dictationInsertionText('word', 'A ', '.'), 'word');
  assert.equal(DAL.dictationInsertionText(',', 'word', ' next'), ',');
});

test('a stalled Stop aborts recognition and preserves the reviewable draft', async () => {
  const api = setup();
  await api.DAL.startDictation();
  const speech = api.instance();
  speech.stop = () => {};
  api.action('dictation-stop');
  assert.equal(api.elements.dictationDraft.readOnly, true);
  api.expire();
  assert.equal(speech.aborted, true);
  assert.equal(api.elements.dictationDraft.readOnly, false);
  assert.equal(api.project.dictationDraft, 'Existing note.');
  assert.match(api.elements.dictationStatus.textContent, /did not finish/);
});

test('a completed Stop cancels the timeout without replacing completion status', async () => {
  const api = setup();
  await api.DAL.startDictation();
  api.action('dictation-stop');
  api.expire();
  assert.match(api.elements.dictationStatus.textContent, /Stopped. Review/);
  assert.notEqual(api.instance().aborted, true);
});

test('re-emitted final results and revised results update their positions without duplicate prose',async()=>{
  const api=setup();await api.DAL.startDictation();const speech=api.instance();
  const final=text=>Object.assign([{transcript:text}],{isFinal:true}),partial=text=>Object.assign([{transcript:text}],{isFinal:false});
  speech.onresult({resultIndex:0,results:[final('First sentence.'),partial('unfinished')]});
  speech.onresult({resultIndex:0,results:[final('First sentence.'),partial('unfinished')]});
  assert.equal(api.project.dictationDraft,'Existing note. First sentence.');
  speech.onresult({resultIndex:1,results:[final('First sentence.'),final('Second sentence.')]});
  speech.onresult({resultIndex:1,results:[final('First sentence.'),final('Second sentence revised.')]});
  assert.equal(api.project.dictationDraft,'Existing note. First sentence. Second sentence revised.');assert.equal(api.elements.dictationInterim.textContent,'');
});
test('dictation preserves the exact typed note when only interim or malformed results arrive',async()=>{
  const api=setup();api.elements.dictationDraft.value='  Heading\n\nOriginal note.\n';await api.DAL.startDictation();
  api.instance().onresult({resultIndex:0,results:[Object.assign([{transcript:'preview only'}],{isFinal:false})]});
  assert.equal(api.project.dictationDraft,'  Heading\n\nOriginal note.\n');api.instance().onresult({results:[null,[]]});assert.equal(api.project.dictationDraft,'  Heading\n\nOriginal note.\n');
  api.instance().onresult({results:[Object.assign([{transcript:'More words.'}],{isFinal:true})]});assert.equal(api.project.dictationDraft,'  Heading\n\nOriginal note.\nMore words.');
});
test('reopening Voice Notes saves the previous project note before switching targets',()=>{
  const api=setup(),other={id:'other',language:'en',dictationDraft:'Other note.',chapters:[]};
  api.elements.dictationDraft.value='Unsaved old project note.';api.DAL.state.projects.other=other;api.DAL.activeProject=()=>other;api.DAL.currentProjectId='other';api.DAL.showDictation();
  assert.equal(api.project.dictationDraft,'Unsaved old project note.');assert.equal(other.dictationDraft,'Other note.');assert.equal(api.elements.dictationDraft.value,'Other note.');
});
test('late speech after switching projects aborts the microphone without contaminating the new project',async()=>{
  const api=setup();await api.DAL.startDictation();const speech=api.instance();api.DAL.currentProjectId='other';
  speech.onresult({results:[Object.assign([{transcript:'stale speech'}],{isFinal:true})]});assert.equal(speech.aborted,true);assert.equal(api.project.dictationDraft,'Existing note.');assert.equal(api.elements.dictationDraft.readOnly,false);
});

function insertionSetup(){
  const api=setup(),node={};
  const editor={innerHTML:'<p>Original passage.</p>',contains:value=>value===node,focus(){}};
  const chapter={id:'chapter',title:'Draft',contentHTML:editor.innerHTML};api.project.chapters=[chapter];api.project.history=[{sentinel:true}];api.project.redoStack=[{redo:true}];api.project.historyIndex=0;
  const selected={commonAncestorContainer:node,collapsed:false,startContainer:node,endContainer:node,startOffset:0,endOffset:17,cloneRange(){return {...this,cloneRange:this.cloneRange,collapse:this.collapse,selectNodeContents:this.selectNodeContents,setEnd:this.setEnd,setStart:this.setStart,toString:this.toString};},collapse(){this.collapsed=true;this.startOffset=this.endOffset;},selectNodeContents(){},setEnd(){this.side='before';},setStart(){this.side='after';},toString(){return this.side==='before'?'Original passage.':'';}};
  api.elements.editorContent=editor;api.DAL._writerRange=selected;
  let closed=0,commands=0,insertedRange,commandText;
  const originalClose=api.DAL.closeModal;
  api.DAL.closeModal=()=>{closed++;originalClose();};api.DAL.pushHistory=()=>{api.project.history.push({chapters:[{...chapter}]});api.project.redoStack=[];};
  api.DAL.saveChapterContent=()=>{chapter.contentHTML=editor.innerHTML;};api.DAL.toast=()=>{};
  api.context.window.getSelection=()=>({removeAllRanges(){},addRange:range=>{insertedRange=range;}});
  api.context.document.execCommand=(cmd,_,text)=>{commands++;commandText=text;editor.innerHTML+='<p>'+text+'</p>';return true;};
  api.DAL.showDictation();closed=0;api.elements.dictationDraft.value='Spoken words.';api.elements.dictationReplaceSelection={checked:false};
  return {...api,editor,chapter,selected,closed:()=>closed,commands:()=>commands,range:()=>insertedRange,text:()=>commandText};
}
test('insertion keeps selected prose by default and replaces it only with explicit opt-in',()=>{
  const api=insertionSetup();api.DAL.insertDictation();assert.equal(api.range().collapsed,true);assert.equal(api.commands(),1);assert.equal(api.text(),' Spoken words.');assert.equal(api.closed(),1);assert.equal(api.project.dictationDraft,'');assert.equal(api.project.history[1].chapters[0].contentHTML,'<p>Original passage.</p>');
  const replacing=insertionSetup();replacing.elements.dictationReplaceSelection.checked=true;replacing.DAL.insertDictation();assert.equal(replacing.range().collapsed,false);assert.equal(replacing.selected.collapsed,false);
});
test('changed chapter content, detached editors and reused project IDs cannot receive a stale insertion',()=>{
  for(const mutate of [api=>{api.editor.innerHTML+='<p>Newer edit</p>';},api=>{api.elements.editorContent={...api.editor};},api=>{api.DAL.state.projects.p={...api.project};},api=>{api.project.chapters=[{...api.chapter}];}]){
    const api=insertionSetup();mutate(api);api.DAL.insertDictation();assert.equal(api.commands(),0);assert.equal(api.closed(),0);assert.equal(api.elements.dictationDraft.value,'Spoken words.');
  }
});
test('unavailable insertion keeps the review dialog/draft and leaves existing project undo/redo untouched',()=>{
  for(const fail of [()=>false,()=>{throw new Error('unsupported');}]){
    const api=insertionSetup(),history=JSON.stringify(api.project.history),redo=api.project.redoStack;api.context.document.execCommand=fail;api.DAL.insertDictation();
    assert.equal(api.editor.innerHTML,'<p>Original passage.</p>');assert.equal(api.closed(),0);assert.equal(api.elements.dictationDraft.value,'Spoken words.');assert.equal(JSON.stringify(api.project.history),history);assert.equal(api.project.redoStack,redo);assert.match(api.elements.dictationStatus.textContent,/Insertion was unavailable/);
  }
});

test('range checkpoints preserve exact node paths and UTF-16 offsets after a layout rerender',()=>{
  const api=setup(),{holder}=require('./helpers/manuscript-dom.cjs'),root=holder('<p><strong>😀Mira</strong> and <em>rain</em></p>'),copy=holder(root.innerHTML);
  const original={startContainer:root.firstChild.firstChild.firstChild,startOffset:2,endContainer:root.firstChild.lastChild.firstChild,endOffset:3};
  const points=api.DAL.dictationRangePoints(root,original);assert.deepEqual(JSON.parse(JSON.stringify(points)),{start:{path:[0,0,0],offset:2},end:{path:[0,2,0],offset:3}});
  api.context.document.createRange=()=>({setStart(node,offset){this.startContainer=node;this.startOffset=offset;},setEnd(node,offset){this.endContainer=node;this.endOffset=offset;}});
  const restored=api.DAL.restoreDictationRange(copy,points);assert.equal(restored.startContainer,copy.firstChild.firstChild.firstChild);assert.equal(restored.startOffset,2);assert.equal(restored.endContainer,copy.firstChild.lastChild.firstChild);assert.equal(restored.endOffset,3);assert.notEqual(restored.startContainer,original.startContainer);
  assert.equal(api.DAL.restoreDictationRange(holder('<p>Changed</p>'),points),null);
  assert.equal(api.DAL.restoreDictationRange(copy,{...points,start:{path:[0,0,0],offset:999}}),null);
  assert.equal(api.DAL.dictationRangePoints(copy,original),null);
  api.context.document.createRange=()=>{throw new Error('Range unavailable');};assert.equal(api.DAL.restoreDictationRange(copy,points),null);
});
test('native listener cleanup failures never trap review controls or discard the completed draft',async()=>{
  for(const remove of [()=>{throw new Error('already removed');},()=>undefined,()=>Promise.reject(new Error('gone'))]){
    const native={addListener:async()=>({remove}),start:async()=>{},stop:async()=>{}};const api=setup(true,native);await api.DAL.startDictation();api.DAL.stopDictation();await new Promise(resolve=>setImmediate(resolve));assert.equal(api.elements.dictationDraft.readOnly,false);assert.equal(api.project.dictationDraft,'Existing note.');
  }
});
test('an insertion exception after changing the editor keeps its recovery history and draft for review',()=>{
  const api=insertionSetup();api.context.document.execCommand=()=>{api.editor.innerHTML+='<p>Partial insertion</p>';throw new Error('interrupted');};api.DAL.insertDictation();assert.equal(api.closed(),0);assert.equal(api.project.history.length,2);assert.equal(api.project.history[1].chapters[0].contentHTML,'<p>Original passage.</p>');assert.equal(api.elements.dictationDraft.value,'Spoken words.');assert.match(api.elements.dictationStatus.textContent,/Review your chapter/);
});

test('closing Voice Notes flushes its current draft immediately instead of relying on a pending save timer',()=>{
  const api=setup(),writes=[];api.DAL.saveState=immediate=>{writes.push({immediate,draft:api.project.dictationDraft});return true;};api.elements.dictationDraft.value='  A note before reload.\n';api.DAL.closeModal();assert.deepEqual(writes,[{immediate:true,draft:'  A note before reload.\n'}]);assert.equal(api.elements.dictationDraft,undefined);
});

test('successful insertion flushes the new chapter and cleared draft together before closing',()=>{
  const api=insertionSetup(),writes=[];
  api.DAL.saveState=immediate=>{writes.push({immediate,chapter:api.chapter.contentHTML,draft:api.project.dictationDraft});};
  api.DAL.insertDictation();
  assert.deepEqual(writes,[{immediate:true,chapter:api.editor.innerHTML,draft:''}]);
  assert.match(writes[0].chapter,/Spoken words/);
  assert.equal(api.elements.dictationDraft,undefined);
});
