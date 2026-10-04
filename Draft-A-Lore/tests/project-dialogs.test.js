const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadUiResources}=require('./helpers/ui-resources.cjs');
const {holder}=require('./helpers/manuscript-dom.cjs');
const {loadWordCounters}=require('./helpers/word-counters.cjs');
const source=fs.readFileSync(path.join(__dirname,'../src/views.js'),'utf8');
function runtime(){
  const fields={},events=[],notice={textContent:''},modal={querySelector:()=>notice};
  const button={disabled:false,attributes:{},setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];},getAttribute:()=> 'qa'};
  let currentModal=modal,sequence=0;
  const DAL={state:{projects:{},projectOrder:[]},folderHandles:{},uid:prefix=>prefix+(++sequence),clone:obj=>JSON.parse(JSON.stringify(obj)),escapeHtml:value=>String(value||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),toast:(...args)=>events.push(['toast',...args]),saveState:()=>true,closeModal:()=>{events.push(['close']);currentModal=null;},navigate:(...args)=>events.push(['navigate',...args]),render:()=>events.push(['render']),queueFolderSync:()=>events.push(['sync'])};
  const document={createElement:()=>holder(),getElementById:id=>id==='modalBackdrop'?currentModal:fields[id],querySelectorAll:()=>[]};
  DAL.getProjectWordCount=project=>({manuscript:project.chapters.reduce((sum,chapter)=>sum+chapter.contentHTML.replace(/<[^>]+>/g,' ').trim().split(/\s+/).filter(Boolean).length,0),supplementary:0});
  DAL.getGlobalWordCount=()=>Object.values(DAL.state.projects).reduce((total,project)=>{const count=DAL.getProjectWordCount(project);total.manuscript+=count.manuscript;return total;},{manuscript:0,supplementary:0});
  DAL.todayKey=()=> '2026-10-02';DAL.state.wordHistory={};DAL.state.wordBaseline=null;
  const context=vm.createContext({DAL,document,Intl,Date});
  loadUiResources(DAL);
  const core=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
  loadWordCounters(DAL,document);
  vm.runInContext(core.slice(core.indexOf('DAL.defaultProject ='),core.indexOf('DAL.defaultChapter =')),context);
  vm.runInContext(core.slice(core.indexOf('DAL.updateWordHistory ='),core.indexOf('/* Goal periods')),context);
  vm.runInContext(source.slice(source.indexOf('DAL.showSaveAsModal ='),source.indexOf('DAL.showDeleteConfirm =')),context);
  vm.runInContext(source.slice(source.indexOf('DAL.handleClick ='),source.indexOf("document.addEventListener('input'")),context);
  function field(id,value){return fields[id]={value,attributes:{},setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];},focus(){events.push(['focus',id]);}};}
  field('npName','New world');field('npType','dual');field('npLanguage','en');
  return {DAL,fields,field,events,button,notice,modal,setModal:value=>{currentModal=value;},run:action=>DAL.handleClick(action,button,{stopPropagation(){}})};
}
test('invalid writing-language codes leave project and modal unchanged and identify the field',()=>{
  const qa=runtime();qa.fields.npLanguage.value='en, fr';
  const error=qa.field('npError','');
  qa.run('create-project');assert.equal(qa.DAL.state.projectOrder.length,0);
  assert.equal(qa.fields.npLanguage.attributes['aria-invalid'],'true');assert.match(error.textContent,/one language code/);
  assert.ok(qa.events.some(event=>event[0]==='focus'));assert.ok(!qa.events.some(event=>event[0]==='close'));
});
test('creation waits for durable save, ignores double submits and retries the same unsaved project',async()=>{
  const qa=runtime();qa.DAL._newProjectDraftId='draft';let resolve;
  qa.DAL.saveState=immediate=>{assert.equal(immediate,true);return new Promise(done=>{resolve=done;});};
  const pending=qa.run('create-project');qa.run('create-project');
  assert.equal(qa.DAL.state.projectOrder.length,1);assert.equal(qa.button.disabled,true);
  assert.equal(qa.DAL.state.projects.draft.adventure.stats.length,2);
  assert.ok(!qa.events.some(event=>event[0]==='toast'&&event[2]==='success'));
  resolve(false);assert.equal(await pending,false);assert.equal(qa.button.disabled,false);
  assert.match(qa.notice.textContent,/only in this session/);assert.ok(!qa.events.some(event=>event[0]==='close'));
  qa.DAL.state.projects.draft.chapters.push({contentHTML:'<b>Preserved draft</b>'});
  qa.DAL.saveState=()=>true;assert.equal(await qa.run('create-project'),true);
  assert.equal(qa.DAL.state.projectOrder.length,1);assert.equal(qa.DAL.state.projects.draft.chapters[0].contentHTML,'<b>Preserved draft</b>');
  assert.ok(qa.events.some(event=>event[0]==='navigate'&&event[2]==='draft'));
});
test('failed settings saves preserve manuscript, keep controls retryable and never report success',async()=>{
  for(const failure of [()=>false,()=>Promise.reject(new Error('quota')),()=>{throw new Error('quota');}]){
    const qa=runtime(),project=qa.DAL.defaultProject('Original','dual');project.id='qa';project.chapters=[{contentHTML:'<b>Original manuscript</b>'}];qa.DAL.state.projects.qa=project;
    qa.field('psName','Renamed');qa.field('psStatus','drafting');qa.field('psLanguage','FR-fr');
    qa.field('psCoverTitle','New title');qa.field('psCoverSubtitle','Subtitle');qa.field('psCoverAuthor','Pen name');qa.DAL.saveState=failure;
    assert.equal(await qa.run('save-project-settings'),false);assert.equal(project.language,'fr-FR');
    assert.equal(project.chapters[0].contentHTML,'<b>Original manuscript</b>');assert.equal(project.cover.author,'Pen name');
    assert.equal(qa.button.disabled,false);assert.ok(!qa.events.some(event=>event[0]==='close'||event[2]==='success'));
    qa.DAL.saveState=()=>true;assert.equal(await qa.run('save-project-settings'),true);
    assert.ok(qa.events.some(event=>event[0]==='close'));assert.ok(qa.events.some(event=>event[0]==='render'));
  }
});
test('finishing a save never closes a replacement dialog or navigates away from it',async()=>{
  const qa=runtime();let resolve;qa.DAL.saveState=()=>new Promise(done=>{resolve=done;});
  const pending=qa.run('create-project');qa.setModal({querySelector:()=>({})});resolve(true);await pending;
  assert.ok(!qa.events.some(event=>['close','navigate'].includes(event[0])));
});
test('Save As retry preserves a single independent copy and all original content',async()=>{
  const qa=runtime(),project=qa.DAL.defaultProject('Original','dual');project.id='qa';project.chapters=[{contentHTML:'<p>Original</p>'}];qa.DAL.state.projects.qa=project;qa.DAL.state.projectOrder=['qa'];qa.DAL.currentProjectId='qa';
  qa.field('saNewName','Branch');const original=JSON.stringify(project);qa.DAL.saveState=()=>false;
  await qa.run('save-as-confirm');const id=qa.DAL._saveAsRetryId;qa.DAL.saveState=()=>true;await qa.run('save-as-confirm');
  assert.equal(qa.DAL.state.projectOrder.length,2);assert.equal(qa.DAL.state.projects[id].name,'Branch');
  assert.equal(JSON.stringify(project),original);qa.DAL.state.projects[id].chapters[0].contentHTML='Edited copy';
  assert.equal(project.chapters[0].contentHTML,'<p>Original</p>');
});
test('project dialog fields have labels and untrusted folder metadata is escaped',()=>{
  const qa=runtime(),project=qa.DAL.defaultProject('Original','novel');project.id='qa';project.linkedFolderName='<img onerror="leak">';qa.DAL.state.projects.qa=project;
  let html,footer;qa.DAL.modal=(title,body,options)=>{html=body;footer=options.footer;};
  qa.DAL.showProjectSettingsModal('qa');
  for(const id of ['psName','psStatus','psLanguage'])assert.ok(html.includes('for="'+id+'"'));
  assert.ok(html.includes('aria-label="Cover title"'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img onerror'));
  assert.ok(footer.includes('data-project-save-status'));qa.DAL.showNewProjectModal();
  for(const id of ['npName','npType','npLanguage'])assert.ok(html.includes('for="'+id+'"'));
});

test('Save As excludes copied words from output but preserves earlier and subsequent writing',async()=>{
  const qa=runtime(),project=qa.DAL.defaultProject('Original','dual');project.id='qa';project.chapters=[{contentHTML:'<b>Seven original words already written in here</b>'}];qa.DAL.state.projects.qa=project;qa.DAL.state.projectOrder=['qa'];qa.DAL.currentProjectId='qa';
  qa.DAL.state.wordBaseline={manuscript:6,supplementary:0};qa.DAL.state.wordHistory['2026-10-02']={manuscript:6,supplementary:0};
  qa.field('saNewName','Branch');await qa.run('save-as-confirm');qa.DAL.updateWordHistory();
  assert.equal(qa.DAL.state.wordHistory['2026-10-02'].manuscript,7);
  const copy=Object.values(qa.DAL.state.projects).find(item=>item.id!=='qa');copy.chapters[0].contentHTML+=' Four new branch words';qa.DAL.updateWordHistory();
  assert.equal(qa.DAL.state.wordHistory['2026-10-02'].manuscript,11);
});
