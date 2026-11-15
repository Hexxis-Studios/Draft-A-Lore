const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {validateResources}=require('../scripts/validate-locales.cjs');
const {loadUiResources}=require('./helpers/ui-resources.cjs');

test('translation validation rejects damaged ICU syntax and changed interpolation variables',()=>{
  const source={words:'{count, plural, one {# word} other {# words}}'};
  validateResources(source,{words:'{count, plural, one {# mot} other {# mots}}'});
  assert.throws(()=>validateResources(source,{words:'{count, plural, one {unfinished}'}));
  assert.throws(()=>validateResources(source,{words:'{number, plural, one {# mot} other {# mots}}'}),/variables/);
  assert.throws(()=>validateResources(source,{words:''}),/Blank/);
});

test('English project navigation resources preserve every existing tool name',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/story-tools.js'),'utf8');
  const resources=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/locales/en.json'),'utf8'));
  const workspace=source.slice(0,source.indexOf("  html += '</aside>';"));
  const entries=[...workspace.matchAll(/\['([a-z-]+)','([^']+)','/g)];
  assert.equal(entries.length,23);
  for(const entry of entries)assert.equal(resources['tool_'+entry[1]],entry[2]);
});

test('voice resources cover all migrated fallbacks and valid ICU variables',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/voice-tools.js'),'utf8');
  const english=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/locales/en.json'),'utf8'));
  const keys=new Set();
  for(const [,key,fallback] of source.matchAll(/voice(?:Text|Html)\('([^']+)',\s*'([^']*)'/g)){
    assert.equal(english[key],fallback,key);keys.add(key);
  }
  assert.equal(keys.size,55);
  validateResources(english,english);
  const context=runtime();await context.DAL.i18n.initialize();
  context.DAL.closeModal=()=>{};context.DAL.registerActionHandler=()=>{};
  vm.runInNewContext(source,context);
  const title="Writer's <notes> {title}";
  assert.equal(context.DAL.dictationDestination(title,null,false),'Destination: '+title+' — at the end of the chapter.');
  assert.equal(context.DAL.dictationDestination(title,{collapsed:false},true),'Destination: '+title+' — replacing the selected passage.');
  assert.equal(context.DAL.i18n.text('dictationStartError',undefined,{message:'Device said {message}'}),'Device said {message} Your draft is preserved.');
  context.DAL.i18n.lastError=new Error('Unavailable engine');
  assert.equal(context.DAL.dictationDestination(title,null,false),'Destination: '+title+' — at the end of the chapter.');
});

test('Settings uses escaped translated controls without changing actions or author data',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/views.js'),'utf8');
  const state={customFonts:[],authorName:'Original author',authorBio:'<p>Original bio</p>'};
  const original=JSON.stringify(state);
  const DAL={state,THEMES:[],ONLINE_FONTS:[],isOnline:()=>false,escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),i18n:{targets:[],text:(key,fallback)=>fallback||key}};
  DAL.i18n.text=(key,fallback)=>key==='saveAuthor'?'<Translated & save>':fallback||key;
  loadUiResources(DAL);
  vm.runInNewContext(source.slice(source.indexOf('DAL.renderSettings ='),source.indexOf('DAL.renderLibrary =')),{DAL});
  const html=DAL.renderSettings();
  assert.match(html,/data-action="save-author-info">&lt;Translated &amp; save&gt;/);
  assert.match(html,/for="setAuthorName"/);assert.match(html,/for="setAuthorBio"/);
  for(const action of ['manual-save','storage-center','backup-workspace','restore-workspace','clear-data','show-privacy-policy'])assert.ok(html.includes('data-action="'+action+'"'));
  assert.equal(JSON.stringify(state),original);
});

test('Settings resource migration preserves original English explanations and labels',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/views.js'),'utf8');
  const settings=source.slice(source.indexOf('DAL.renderSettings ='),source.indexOf('DAL.renderLibrary ='));
  const english=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/locales/en.json'),'utf8'));
  const entries=[...settings.matchAll(/text\('([^']+)','([^']+)'\)/g)];
  assert.ok(entries.length>=29);
  for(const [,key,fallback] of entries)assert.equal(english[key],fallback,key);
});

test('project and import resource migration covers every static label and preserves genre values',()=>{
  const english=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/locales/en.json'),'utf8'));
  const views=fs.readFileSync(path.join(__dirname,'../src/views.js'),'utf8');
  const library=fs.readFileSync(path.join(__dirname,'../src/library.js'),'utf8');
  const snippets=[views.slice(views.indexOf('DAL.renderProjects ='),views.indexOf('DAL.recoveryKeys =')),library.slice(library.indexOf('  DAL.importText ='),library.indexOf('  DAL.readAssetsFolder ='))];
  let checked=0;
  for(const code of snippets){
    for(const [,key,fallback] of code.matchAll(/(?:text|label)\('([^']+)','([^']+)'\)/g)){assert.equal(english[key],fallback,key);checked++;}
  }
  assert.ok(checked>=50);
  const DAL={};vm.runInNewContext(views.slice(views.indexOf('DAL.GENRES ='),views.indexOf('DAL.genreChoices =')),{DAL});
  assert.equal(DAL.GENRES.length,18);
  DAL.GENRES.forEach((genre,index)=>assert.equal(english['genre_'+index],genre));
  for(const status of ['development','drafting','proofreading','completed','published'])assert.equal(english['status_'+status],status);
  validateResources(english,english);
});

test('project cards use real ICU plural counts with readable English failure fallback',async()=>{
  const context=runtime();await context.DAL.i18n.initialize();
  const source=fs.readFileSync(path.join(__dirname,'../src/views.js'),'utf8'),DAL=context.DAL;
  DAL.escapeHtml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  DAL.formatNumber=value=>DAL.i18n.number(value);DAL.formatDate=()=> 'just now';
  DAL.state={projectOrder:['qa'],projects:{qa:{id:'qa',name:'<World>',type:'dual',status:'drafting',updatedAt:1}}};
  let count=1;DAL.getProjectWordCount=()=>({manuscript:count});
  vm.runInContext(source.slice(source.indexOf('DAL.renderProjects ='),source.indexOf('DAL.showSaveAsModal =')),context);
  const before=JSON.stringify(DAL.state);
  assert.match(DAL.renderProjects(),/1 manuscript word<\/div>/);
  count=1234;assert.match(DAL.renderProjects(),/1,234 manuscript words/);
  DAL.state.projects.qa.type='rpg';count=3;assert.match(DAL.renderProjects(),/3 words<\/div>/);assert.doesNotMatch(DAL.renderProjects(),/3 manuscript words/);
  DAL.state.projects.qa.type='dual';count=1234;
  DAL.i18n.lastError=new Error('engine unavailable');assert.match(DAL.renderProjects(),/1,234 manuscript words/);
  assert.ok(!DAL.renderProjects().includes('{count'));assert.equal(JSON.stringify(DAL.state),before);
  DAL.state.projectOrder=[];assert.match(DAL.renderProjects(),/>Import Project<\/button>/);
});

test('translated project dialogs escape labels while retaining field IDs, stored genres and project content',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/views.js'),'utf8');let opened;
  const project={id:'qa" unsafe="x',name:'<Original>',language:'ar',status:'drafting',genres:['Fantasy','Tabletop RPG'],chapters:[{contentHTML:'<p dir="rtl">نص</p>'}],cover:{title:'<Cover>',subtitle:'Original subtitle',author:'Original author'}};
  const DAL={state:{projects:{[project.id]:project},projectOrder:[project.id]},currentProjectId:project.id,uid:()=> 'draft',escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),modal:(title,body,options)=>{opened={title,body,options};},i18n:{text:(key,fallback)=>'<Translated & '+key+'>'}};
  loadUiResources(DAL);
  vm.runInNewContext(source.slice(source.indexOf('DAL.showSaveAsModal ='),source.indexOf('DAL.recoveryKeys =')),{DAL});
  const before=JSON.stringify(project);
  DAL.showProjectSettingsModal(project.id);
  assert.match(opened.body,/for="psName">&lt;Translated &amp; projectName&gt;/);assert.match(opened.body,/value="ar"/);assert.match(opened.body,/value="drafting" selected/);
  assert.match(opened.body,/value="Fantasy" checked/);assert.match(opened.body,/value="Tabletop RPG" checked/);
  assert.match(opened.body,/placeholder="&lt;Translated &amp; coverTitle&gt;"/);
  assert.match(opened.options.footer,/data-action="save-project-settings" data-pid="qa&quot; unsafe=&quot;x"/);
  DAL.showNewProjectModal();assert.match(opened.body,/option value="dual">&lt;Translated &amp; typeDualDetail&gt;/);assert.match(opened.options.footer,/data-action="create-project"/);
  DAL.showSaveAsModal();assert.match(opened.body,/id="saNewName"/);assert.match(opened.options.footer,/data-action="save-as-confirm"/);
  DAL.showDeleteConfirm(project.id,1);assert.match(opened.options.footer,/data-action="delete-project-confirm" data-pid="qa&quot; unsafe=&quot;x"/);
  assert.equal(JSON.stringify(project),before);
});

test('import dialog translates and escapes all choices without changing the supported entry points',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/library.js'),'utf8');let opened;
  const DAL={escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),modal:(title,body)=>{opened={title,body};},i18n:{text:(key,fallback)=>'<Translated & '+key+'>'}},window={};
  vm.runInNewContext(source.slice(source.indexOf('  DAL.importText ='),source.indexOf('  DAL.importProjectFolder =')),{DAL,window});
  DAL.openProjectImport();assert.match(opened.body,/&lt;Translated &amp; chooseBundle&gt;/);assert.match(opened.body,/&lt;Translated &amp; folderImportUnavailable&gt;/);
  for(const action of ['import-project-bundle','import-project-file'])assert.match(opened.body,new RegExp('data-action="'+action+'"'));
  assert.ok(!opened.body.includes('data-action="import-project-folder"'));
  window.showDirectoryPicker=()=>{};DAL.openProjectImport();assert.match(opened.body,/data-action="import-project-folder"/);assert.ok(!opened.body.includes('folderImportUnavailable'));
});

test('import ICU messages preserve names and specific reasons, and never expose syntax on engine failure',async()=>{
  const context=runtime();await context.DAL.i18n.initialize();
  const library=fs.readFileSync(path.join(__dirname,'../src/library.js'),'utf8');
  vm.runInContext(library.slice(library.indexOf('  DAL.importText ='),library.indexOf('  DAL.openProjectImport =')),context);
  const DAL=context.DAL;
  assert.equal(DAL.importText('projectImportedAssets','Fallback',{name:'Book {one}',count:1}),'Imported “Book {one}” with 1 asset');
  assert.equal(DAL.importText('projectImportedAssets','Fallback',{name:'Book',count:2}),'Imported “Book” with 2 assets');
  assert.match(DAL.importText('jsonExternalMedia','Fallback',{count:1}),/1 separately stored media file\./);
  assert.equal(DAL.importText('projectFileImportFailed','Fallback',{reason:'Permission denied'}),'Could not import that file: Permission denied');
  DAL.i18n.lastError=new Error('no engine');assert.equal(DAL.importText('projectImportedAssets','Imported Book with 1 asset',{name:'Book',count:1}),'Imported Book with 1 asset');
});

test('menu resource labels are escaped without changing action data or definitions',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/interaction.js'),'utf8'),item={label:'Import Project',labelKey:'importProject',action:'import-project'};
  const DAL={escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),i18n:{text:()=>'<Translated & import>'}};
  const start=source.indexOf('DAL.menuItemHtml =');
  vm.runInNewContext(source.slice(start,source.indexOf('\n};',start)+3),{DAL});
  const original=JSON.stringify(item),html=DAL.menuItemHtml(item,0);
  assert.match(html,/&lt;Translated &amp; import&gt;/);assert.match(html,/data-do="import-project"/);assert.equal(JSON.stringify(item),original);
});

test('manuscript toolbar English resources cover static controls, formatting commands, colors and structured inserts',()=>{
  const english=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/locales/en.json'),'utf8'));
  const story=fs.readFileSync(path.join(__dirname,'../src/story-tools.js'),'utf8'),writer=fs.readFileSync(path.join(__dirname,'../src/writer-tools.js'),'utf8'),assets=fs.readFileSync(path.join(__dirname,'../src/assets-ui.js'),'utf8');
  const snippets=[story.slice(story.indexOf('DAL.renderManuscript ='),story.indexOf('DAL.afterStoryRender =')),writer.slice(writer.indexOf('DAL.renderAdvancedWriterToolbar='),writer.indexOf('DAL.writerPublishHTML=')),assets.slice(assets.indexOf('DAL.renderAudioBinding ='),assets.indexOf('DAL.audioHolder ='))];
  let count=0;
  for(const code of snippets)for(const [,key,fallback] of code.matchAll(/(?:text|label)\('([^']+)','([^']+)'\)/g)){assert.equal(english[key],fallback,key);count++;}
  assert.ok(count>=55);
  for(const [command,name] of Object.entries({bold:'Bold',italic:'Italic',underline:'Underline',strikeThrough:'Strikethrough',justifyLeft:'Align Left',justifyCenter:'Center',justifyRight:'Right',justifyFull:'Justify'}))assert.equal(english['format_'+command],name);
  for(const [hex,name] of Object.entries({fff59d:'Yellow',b9f6ca:'Green',b3e5fc:'Blue',f8bbd0:'Pink',d1c4e9:'Purple',ffcc80:'Orange'}))assert.equal(english['highlightColor_'+hex],name);
  validateResources(english,english);
});

test('advanced toolbar translates visible and accessible labels without altering formatting or insertion values',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/writer-tools.js'),'utf8'),DAL={escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')};
  const start=source.indexOf('  DAL.renderAdvancedWriterToolbar='),end=source.indexOf('  DAL.writerPublishHTML=');
  loadUiResources(DAL);
  vm.runInNewContext(source.slice(source.indexOf('  var COLORS ='),source.indexOf('\n',source.indexOf('  var COLORS =')))+source.slice(start,end),{DAL});
  const original=DAL.renderAdvancedWriterToolbar();
  assert.match(original,/value="#fff59d">Yellow/);assert.match(original,/value="table-row-add">Table: add row/);
  DAL.i18n={text:(key,fallback)=>'<Translated & '+key+'>'};const translated=DAL.renderAdvancedWriterToolbar();
  assert.match(translated,/aria-label="&lt;Translated &amp; highlightSelectedText&gt;"/);assert.match(translated,/&lt;Translated &amp; highlightColor_fff59d&gt;/);
  assert.match(translated,/value="table-row-add">&lt;Translated &amp; insert_table-row-add&gt;/);
  const values=html=>[...html.matchAll(/(?:value|data-cmd|data-action|data-writer-control)="([^"]*)"/g)].map(match=>match[0]);
  assert.deepEqual(values(translated),values(original));
});

test('audio binding labels name all selectors and narration while preserving clip bindings and script',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/assets-ui.js'),'utf8'),project={assets:{sounds:[{id:'clip" unsafe="x',name:'<Ambient>'}]}},holder={audio:{ambient:'clip" unsafe="x',sfx:'',voice:''},narration:'<Keep this> نص'};
  const DAL={ensureAssets(){},escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),panel:(id,title,body)=>body,i18n:{text:(key,fallback)=>'<Translated & '+key+'>'}};
  vm.runInNewContext(source.slice(source.indexOf('  DAL.renderAudioBinding ='),source.indexOf('  DAL.audioHolder =')),{DAL});
  const before=JSON.stringify({project,holder}),html=DAL.renderAudioBinding(project,holder,'chapter','chapter" example="x');
  assert.match(html,/aria-label="&lt;Translated &amp; ambientTrack&gt;"/);assert.match(html,/aria-label="&lt;Translated &amp; narrationScript&gt;"/);
  assert.match(html,/value="clip&quot; unsafe=&quot;x" selected/);assert.match(html,/data-hid="chapter&quot; example=&quot;x"/);
  assert.match(html,/&lt;Keep this&gt; نص<\/textarea>/);assert.equal(JSON.stringify({project,holder}),before);
  project.assets.sounds=[];const empty=DAL.renderAudioBinding(project,holder,'chapter','one');
  assert.match(empty,/&lt;Translated &amp; noSoundsForBinding&gt;/);assert.ok(!empty.includes('data-action="bind-audio"'));
});

test('shared count formatting follows interface locale without changing numeric values',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
  const DAL={i18n:{number:value=>new Intl.NumberFormat('de').format(value)}};
  vm.runInNewContext(source.slice(source.indexOf('DAL.formatNumber ='),source.indexOf('DAL.applyWritingDirection =')),{DAL});
  const count=1234567;assert.equal(DAL.formatNumber(count),'1.234.567');assert.equal(count,1234567);
  DAL.i18n=null;assert.equal(DAL.formatNumber(count),Number(count).toLocaleString());
});

test('manuscript word labels use ICU and remain readable when localization fails',async()=>{
  const context=runtime();await context.DAL.i18n.initialize();
  const source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
  vm.runInContext(source.slice(source.indexOf('DAL.formatNumber ='),source.indexOf('DAL.formatTimestamp =')),context);
  assert.equal(context.DAL.formatWordCount(0),'0 words');assert.equal(context.DAL.formatWordCount(1),'1 word');
  assert.equal(context.DAL.formatWordCount(2),'2 words');
  context.DAL.i18n.lastError=new Error('test failure');assert.equal(context.DAL.formatWordCount(1),'1 word');
  assert.ok(!context.DAL.formatWordCount(2).includes('{count'));
  context.DAL.i18n=null;assert.equal(context.DAL.formatWordCount(1),'1 word');
});

test('recovery timestamps retain full date and seconds and follow the interface locale',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
  const DAL={i18n:{date:(value,options)=>new Intl.DateTimeFormat('de',options).format(value)}};
  vm.runInNewContext(source.slice(source.indexOf('DAL.formatTimestamp ='),source.indexOf('DAL.applyWritingDirection =')),{DAL,Date,isFinite});
  const stamp=new Date(2026,9,1,14,31,47).getTime();
  assert.equal(DAL.formatTimestamp(stamp),new Intl.DateTimeFormat('de',{dateStyle:'medium',timeStyle:'medium'}).format(new Date(stamp)));
  assert.ok(DAL.formatTimestamp(stamp).includes('47'));
  for(const value of [null,undefined,'',NaN,'invalid'])assert.equal(DAL.formatTimestamp(value),'—');
  assert.notEqual(DAL.formatTimestamp(0),'—');
  DAL.i18n=null;assert.ok(DAL.formatTimestamp(stamp).length>0);
});

test('project goal displayed numbers follow locale while editable values remain numeric',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/views.js'),'utf8');
  const start=source.indexOf('DAL.renderProjectGoalRow ='),end=source.indexOf('/* Word output bar graph',start);
  const DAL={escapeHtml:String,formatNumber:value=>new Intl.NumberFormat('de').format(value)};
  DAL.formatWordCount=value=>DAL.formatNumber(value)+(value===1?' word':' words');
  vm.runInNewContext(source.slice(start,end),{DAL});
  const st={set:true,target:100000,words:12345,remaining:87655,daysLeft:20,perDay:4383,percent:12,deadline:'2026-12-01'};
  const original=JSON.stringify(st),html=DAL.renderProjectGoalRow({id:'fixture',name:'Fixture'},st);
  assert.match(html,/value="100000"/);assert.match(html,/12\.345/);assert.match(html,/100\.000/);assert.match(html,/87\.655/);assert.match(html,/4\.383/);
  assert.equal(JSON.stringify(st),original);
});

test('project goal ICU messages cover singular, plural, completed and overdue states safely',async()=>{
  const context=runtime();await context.DAL.i18n.initialize();
  const core=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8'),source=fs.readFileSync(path.join(__dirname,'../src/views.js'),'utf8');
  vm.runInContext(core.slice(core.indexOf('DAL.formatNumber ='),core.indexOf('DAL.formatTimestamp =')),context);
  context.DAL.escapeHtml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const start=source.indexOf('DAL.renderProjectGoalRow =');
  vm.runInContext(source.slice(start,source.indexOf('/* Word output bar graph',start)),context);
  const project={id:'qa',name:'<World "Bible">'},state={set:true,target:1000,words:1,remaining:999,daysLeft:1,perDay:999,percent:0,deadline:'2026-12-01'};
  const before=JSON.stringify(state);
  let html=context.DAL.renderProjectGoalRow(project,state);
  assert.match(html,/1 day left/);assert.match(html,/999 words a day/);assert.ok(html.includes('&lt;World &quot;Bible&quot;&gt;'));
  html=context.DAL.renderProjectGoalRow(project,{...state,set:false});assert.match(html,/1 word written/);
  html=context.DAL.renderProjectGoalRow(project,{...state,daysLeft:-1,overdue:true});assert.match(html,/Deadline passed 2 days ago/);
  html=context.DAL.renderProjectGoalRow(project,{...state,done:true});assert.match(html,/Target reached/);assert.ok(!html.includes('to go'));
  assert.equal(JSON.stringify(state),before);
});

test('future relative timestamps do not round an extra minute ahead',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8'),now=Date.UTC(2026,9,2,12);
  class ClockDate extends Date{constructor(value){super(arguments.length?value:now);}}
  const DAL={i18n:{text:()=> 'just now',relative:(value,unit)=>value+' '+unit,date:()=> 'date'}};
  vm.runInNewContext(source.slice(source.indexOf('DAL.formatDate ='),source.indexOf('DAL.todayKey =')),{DAL,Date:ClockDate,isFinite,Math});
  assert.equal(DAL.formatDate(now+90000),'1 minute');assert.equal(DAL.formatDate(now-90000),'-1 minute');
  assert.equal(DAL.formatDate(now+5400000),'1 hour');assert.equal(DAL.formatDate(now-5400000),'-1 hour');
});
function runtime(){
  const context={DAL:{registerAfterRender(){}},DAL_LOCALE_CATALOG:JSON.parse(fs.readFileSync(path.join(__dirname,'../src/locales/catalog.json'),'utf8')),DAL_LOCALE_BUNDLES:{en:fs.readFileSync(path.join(__dirname,'../src/locales/en.json'),'utf8')},Intl,navigator:{languages:['fr-CA']},window:{},setTimeout,clearTimeout,document:{documentElement:{},addEventListener(){}},console};
  context.events={};context.document.addEventListener=(name,handler)=>{context.events[name]=handler;};
  context.document.getElementById=()=>null;
  vm.createContext(context);
  for(const filename of ['node_modules/i18next/dist/umd/i18next.min.js','node_modules/i18next-icu/i18nextICU.min.js','src/localization.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',filename),'utf8'),context);
  return context;
}

test('language preference write failures retain session language and preserve manuscript data',async()=>{
  for(const save of [()=>false,()=>Promise.reject(new Error('disk full')),()=>{throw new Error('unavailable');}]){
    const context=runtime(),warnings=[];
    const projects=[{id:'fixture',chapters:[{id:'chapter',content:'<p><b>Original</b> manuscript</p>'}]}];
    context.DAL.state={projects};const original=JSON.stringify(projects);
    context.DAL.saveState=save;context.DAL.toast=message=>warnings.push(message);
    let rendered=0;context.DAL.render=()=>rendered++;
    await context.DAL.i18n.initialize();
    context.events.change({target:{hasAttribute:()=>true,value:'en'}});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(context.DAL.state.interfaceLanguage,'en');
    assert.equal(rendered,1);assert.match(warnings[0],/changed for this session/);
    assert.equal(JSON.stringify(context.DAL.state.projects),original);
  }
});

test('obsolete language failures do not warn after a newer successful selection',async()=>{
  const context=runtime(),warnings=[];let rejectFirst;
  context.DAL.state={projects:[]};context.DAL.saveState=()=>true;
  context.DAL.render=()=>{};context.DAL.toast=message=>warnings.push(message);
  let calls=0;context.DAL.i18n.change=()=>++calls===1?new Promise((resolve,reject)=>{rejectFirst=reject;}):Promise.resolve('en');
  const target=value=>({target:{hasAttribute:()=>true,value}});
  context.events.change(target('system'));context.events.change(target('en'));
  await new Promise(resolve=>setImmediate(resolve));rejectFirst(new Error('old request'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(context.DAL.state.interfaceLanguage,'en');assert.equal(warnings.length,0);
});
test('offline browser bundles initialize ICU and fall back to reviewed English',async()=>{
  const context=runtime(),locale=context.DAL.i18n;
  await locale.initialize();assert.equal(locale.locale,'en');assert.equal(context.document.documentElement.lang,'en');
  assert.equal(locale.text('words',null,{count:1}),'1 word');assert.equal(locale.text('words',null,{count:2}),'2 words');
  assert.equal(locale.text('missing','Readable fallback'),'Readable fallback');assert.notEqual(locale.text('missing'),'missing');
  assert.equal(locale.targets.length,23);assert.equal(locale.targets.filter(item=>item.released).length,1);
});

test('failed language initialization falls back to usable English and can retry',async()=>{
  const context=runtime();let fail=true;
  const engine={use(){return this;},init(){return fail?Promise.reject(new Error('engine failure')):Promise.resolve();},changeLanguage(){return Promise.resolve();},dir(){return 'ltr';},t(key){return 'Recovered '+key;}};
  const applied=[];
  const locale=context.DAL.createLocalization(engine,context.i18nextICU,{languages:()=>Promise.reject(new Error('device unavailable')),apply:(...args)=>applied.push(args)});
  assert.equal(await locale.initialize(),'en');assert.ok(locale.lastError);
  assert.equal(locale.text('dashboard'),'Dashboard');assert.equal(locale.text('absent','Readable'),'Readable');
  assert.deepEqual(applied[0],['en','ltr']);
  fail=false;assert.equal(await locale.change('en'),'en');assert.equal(locale.lastError,null);
  assert.equal(locale.text('dashboard'),'Recovered dashboard');
});
test('locale matching uses exact then base and handles malformed tags',async()=>{
  const locale=runtime().DAL.i18n;
  assert.equal(locale.resolve(['pt-BR'],['en','pt','pt-BR']),'pt-BR');
  assert.equal(locale.resolve(['fr_CA'],['en','fr']),'fr');
  assert.equal(locale.resolve(['invalid!','ja-JP'],['en','ja']),'ja');
  assert.equal(locale.resolve(['ar']), 'en');
  assert.equal(locale.resolve(['zh-CN'],['en','zh-Hans']),'zh-Hans');
  assert.equal(locale.resolve(['zh-SG'],['en','zh-Hans']),'zh-Hans');
  assert.equal(locale.resolve(['zh-Hans-CN'],['en','zh-Hans']),'zh-Hans');
  assert.equal(locale.resolve(['zh-TW'],['en','zh-Hans']),'en');
  assert.equal(locale.resolve(['zh-Hant','fr-CA'],['en','zh-Hans','fr']),'fr');
  await locale.initialize('en');await locale.change('system');assert.equal(locale.locale,'en');assert.equal(locale.number(1234),'1,234');
});

test('a bundled test locale loads on demand and uses ICU language rules',async()=>{
  const context=runtime();context.DAL_LOCALE_CATALOG.fr.released=true;
  const translated=JSON.parse(context.DAL_LOCALE_BUNDLES.en);translated.words='{count, plural, one {# mot} other {# mots}}';
  context.DAL_LOCALE_BUNDLES.fr=JSON.stringify(translated);
  const engine=context.i18next.createInstance();let loads=0;
  const locale=context.DAL.createLocalization(engine,context.i18nextICU,{languages:()=>['fr-CA'],apply(){}});
  await locale.initialize('en');assert.equal(loads,0);
  const add=engine.addResourceBundle.bind(engine);engine.addResourceBundle=(...args)=>{loads++;return add(...args);};
  await locale.change('system');assert.equal(locale.locale,'fr');assert.equal(loads,1);
  assert.equal(locale.text('words',null,{count:0}),'0 mot');assert.equal(locale.text('words',null,{count:2}),'2 mots');
  await locale.change('en');await locale.change('fr');assert.equal(loads,1);
  assert.equal(context.DAL.i18n.targets.filter(item=>item.released).length,1);
});

test('rapid locale changes are serialized and do not rewrite project data',async()=>{
  const context=runtime(),applied=[],order=[],writing={contentHTML:'<p dir="rtl">نص manuscript</p>',language:'ar'};
  const before=JSON.stringify(writing);
  const engine={changeLanguage:async code=>{order.push(code);await Promise.resolve();},dir:()=> 'ltr'};
  const locale=context.DAL.createLocalization(engine,context.i18nextICU,{languages:()=>['en'],apply:code=>applied.push(code)});
  await Promise.all([locale.change('system'),locale.change('en'),locale.change('system')]);
  assert.equal(order.length,3);assert.deepEqual(applied,order);assert.equal(JSON.stringify(writing),before);
});

test('locale formatters reuse bounded instances and provide standard relative dates',async()=>{
  const locale=runtime().DAL.i18n;await locale.initialize();
  assert.equal(locale.relative(-2,'day'),'2 days ago');assert.equal(locale.relative(1,'day'),'tomorrow');
  for(let index=0;index<100;index++)assert.equal(locale.number(1234),'1,234');
  assert.match(locale.date('2026-10-01T12:00:00Z',{year:'numeric'}),/2026/);
});

test('Android locale source preserves device preference order and falls back safely',async()=>{
  const context=runtime();let result={languages:['de-DE','fr-CA']};
  context.window.Capacitor={getPlatform:()=> 'android',registerPlugin:()=>({languages:async()=>result})};
  assert.deepEqual(Array.from(await context.DAL.deviceLanguages()),['de-DE','fr-CA']);
  result={languages:[null,42,'']};assert.deepEqual(Array.from(await context.DAL.deviceLanguages()),['fr-CA']);
  context.window.Capacitor.registerPlugin=()=>{throw new Error('Bridge missing');};
  assert.deepEqual(Array.from(await context.DAL.deviceLanguages()),['fr-CA']);
});

test('injected Android locale plugin works without a JavaScript registrar',async()=>{
  const context=runtime();
  context.window.Capacitor={getPlatform:()=> 'android',Plugins:{DeviceLocale:{languages:async()=>({languages:['es-MX','en-US']})}}};
  assert.deepEqual(Array.from(await context.DAL.deviceLanguages()),['es-MX','en-US']);
});

test('stalled Android locale discovery cannot block app startup indefinitely',async()=>{
  const context=runtime();let timeout;
  context.setTimeout=callback=>{timeout=callback;return 1;};context.clearTimeout=()=>{};
  context.window.Capacitor={getPlatform:()=> 'android',registerPlugin:()=>({languages:()=>new Promise(()=>{})})};
  const pending=context.DAL.deviceLanguages();await Promise.resolve();timeout();
  assert.deepEqual(Array.from(await pending),['fr-CA']);
});
