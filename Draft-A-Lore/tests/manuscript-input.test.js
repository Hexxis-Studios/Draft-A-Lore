const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadWordCounters}=require('./helpers/word-counters.cjs');

test('an immediate save replaces a pending save instead of serializing the workspace twice',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
  const start=source.indexOf('DAL.saveState = function(immediate){'),end=source.indexOf('DAL._saveChain',start);
  let scheduled,cancelled=0,saved=0;
  const DAL={_saveTimer:null,setSaveStatus(){},_doSave(){saved++;return true;}};
  vm.runInNewContext(source.slice(start,end),{DAL,setTimeout(fn){scheduled=fn;return 42;},clearTimeout(id){assert.equal(id,42);cancelled++;scheduled=null;}});
  DAL.saveState();assert.equal(saved,0);
  assert.equal(DAL.saveState(true),true);
  assert.equal(saved,1);assert.equal(cancelled,1);assert.equal(scheduled,null);assert.equal(DAL._saveTimer,null);
});

test('typing captures formatted manuscript immediately without reparsing its HTML for word count',()=>{
  const listeners={},footer={textContent:''},chapter={id:'chapter'},project={chapters:[chapter]};
  const attributes={};
  const editor={getAttribute:key=>attributes[key],setAttribute:(key,value)=>{attributes[key]=value;},innerHTML:'<p><strong>Two words</strong></p>',textContent:'Two words',parentElement:{parentElement:{querySelector:()=>footer}},addEventListener:(name,handler)=>{listeners[name]=handler;}};
  let saved=0,timer;
  const DAL={selectedChapterId:chapter.id,state:{autosave:true},countWordsText:text=>text.trim().split(/\s+/).length,countWords:()=>{throw new Error('Unexpected HTML parse during typing');},saveState:()=>{saved++;},setSaveStatus:()=>{}};
  const source=fs.readFileSync(path.join(__dirname,'../src/story-tools.js'),'utf8');
  const core=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
  loadWordCounters(DAL,{createElement(){throw Error('Unexpected HTML parse during typing');}});
  vm.runInNewContext(core.slice(core.indexOf('DAL.formatNumber ='),core.indexOf('DAL.formatTimestamp =')),{DAL});
  vm.runInNewContext(core.slice(core.indexOf('DAL.applyWritingDirection ='),core.indexOf('DAL.formatDate =')),{DAL});
  const start=source.indexOf('DAL.afterStoryRender = function(proj){');
  const end=source.indexOf('  // Bind canvas interactions',start);
  vm.runInNewContext(source.slice(start,end)+'};',{DAL,document:{getElementById:()=>editor,activeElement:null},Date,setTimeout:fn=>{timer=fn;return 1;},clearTimeout(){}});
  DAL.afterStoryRender(project);listeners.input();
  assert.equal(attributes.dir,'auto');
  assert.equal(chapter.contentHTML,editor.innerHTML);assert.equal(footer.textContent,'2 words');
  assert.equal(saved,0);timer();assert.equal(saved,1);
  listeners.input();DAL.state.autosave=false;timer();assert.equal(saved,1);
  assert.equal(chapter.contentHTML,editor.innerHTML);
});

test('review boundary undoes markup and notes together while later text keeps native undo',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
  const ed={innerHTML:'<p>Review edit</p>',focus(){}},snapshot={},project={history:[snapshot]};let commands=0,syncs=0;
  const DAL={currentProjectId:'p',selectedChapterId:'ch',state:{projects:{p:project}},_liveEditor:()=>ed,_syncEditor:()=>{syncs++;},toast(){}};
  vm.runInNewContext(source.slice(source.indexOf('DAL._driveEditorCommand ='),source.indexOf('DAL._syncEditor =')),{DAL,document:{queryCommandEnabled:()=>true,execCommand:()=>{commands++;}}});
  const boundary=()=>({editor:ed,html:'<p>Review edit</p>',projectId:'p',chapterId:'ch',snapshot});
  DAL._writerReviewBarrier=boundary();assert.equal(DAL._driveEditorCommand('undo','Undo'),false);assert.equal(commands,0);assert.equal(DAL._writerReviewBarrier,null);
  DAL._writerReviewBarrier=boundary();ed.innerHTML='<p>Later typing</p>';
  assert.equal(DAL._driveEditorCommand('undo','Undo'),true);assert.equal(commands,1);assert.equal(syncs,1);
  ed.innerHTML='<p>Review edit</p>';project.history.push({});
  assert.equal(DAL._driveEditorCommand('undo','Undo'),true);assert.equal(commands,2);
  project.history.pop();DAL.selectedChapterId='other';assert.equal(DAL._driveEditorCommand('undo','Undo'),true);
});

test('manuscript keyboard undo and redo use the same routing as Edit without intercepting other fields',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8'),start=source.indexOf("document.addEventListener('keydown', function(e){",source.indexOf('DAL.fireAction =')),end=source.indexOf('\n});',start)+5;
  let handler,undo=0,redo=0;
  const DAL={inTextField:()=>true,undo:()=>{undo++;},redo:()=>{redo++;}};
  vm.runInNewContext(source.slice(start,end),{DAL,document:{addEventListener:(name,fn)=>{handler=fn;}}});
  const event=(key,manuscript=true,shiftKey=false)=>({key,shiftKey,ctrlKey:true,target:{closest:()=>manuscript?{}:null},preventDefault(){this.prevented=true;}});
  let e=event('z');handler(e);assert.equal(undo,1);assert.equal(e.prevented,true);
  e=event('Z',true,true);handler(e);assert.equal(redo,1);assert.equal(e.prevented,true);
  e=event('y');handler(e);assert.equal(redo,2);
  e=event('z',false);handler(e);assert.equal(undo,1);assert.equal(e.prevented,undefined);
});
