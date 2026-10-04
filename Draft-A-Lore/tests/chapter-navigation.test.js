const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadUiResources}=require('./helpers/ui-resources.cjs');
const source=fs.readFileSync(path.join(__dirname,'../src/story-tools.js'),'utf8');

function api(narrow=false){
  let focused='',saved=0,histories=0,renders=0,counts=0;
  const project={id:'world',language:'en',chapters:[{id:'five',title:'Chapter Five',contentHTML:'<b>Keep first</b>',order:5,images:[]},{id:'seven',title:'Chapter Seven',contentHTML:'<em>Keep second</em>',order:7,images:[]}]};
  const button=(id,action,direction)=>({disabled:action==='chapter-move'&&(direction==='-1'?project.chapters[0].id===id:project.chapters.at(-1).id===id),getAttribute:key=>({'data-cid':id,'data-dir':direction}[key]),focus(){focused=action+':'+id;}});
  const document={querySelectorAll:selector=>project.chapters.flatMap(ch=>selector==='.chapter-open'?[button(ch.id,'select-chapter')]:[button(ch.id,'chapter-move','-1'),button(ch.id,'chapter-move','1')]),querySelector:()=>({focus(){focused='drawer-trigger';}})};
  const DAL={state:{projects:{world:project}},currentProjectId:'world',selectedChapterId:'five',chapterSidebarOpen:true,
    escapeHtml:value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
    countWords(){counts++;return 2;},chapterWordCount(ch){return DAL.countWords(ch.contentHTML);},formatWordCount:count=>count+' words',formatDate:()=>'',getFontList:()=>[],panel:(id,title,body)=>body,
    getChapterIllustrations:()=>[],renderAudioBinding:()=>'',pushHistory(){histories++;},saveState(){saved++;},render(){renders++;}
  };
  const sandbox={DAL,document,window:{matchMedia:()=>({matches:narrow})},Date};
  loadUiResources(DAL);
  vm.runInNewContext(source.slice(source.indexOf('DAL.focusChapterControl ='),source.indexOf('DAL.afterStoryRender =')),sandbox);
  const start=source.indexOf("  if(action === 'select-chapter'){");
  vm.runInNewContext('DAL.testChapterAction=function(action,el){'+source.slice(start,source.indexOf("  if(action === 'format-block'",start))+'};',sandbox);
  return {DAL,project,action:(name,id,direction)=>DAL.testChapterAction(name,button(id,name,direction)),status:()=>({focused,saved,histories,renders,counts})};
}

test('chapter titles are native named buttons with one current chapter and no redundant word scans',()=>{
  const {DAL,project,status}=api();project.chapters[1].id='chapter" onclick="bad';project.chapters[1].title='<Long & chapter>';
  DAL.selectedChapterId='stale-id';const html=DAL.renderManuscript(project);
  assert.equal(DAL.selectedChapterId,'five');assert.equal(status().counts,1);
  assert.match(html,/type="button" class="chapter-open"[^>]+aria-label="Open Chapter Five" aria-current="true"/);
  assert.equal((html.match(/aria-current="true"/g)||[]).length,1);
  assert.match(html,/data-cid="chapter&quot; onclick=&quot;bad"/);
  assert.match(html,/aria-label="Open &lt;Long &amp; chapter&gt;"/);
  assert.match(html,/data-drag-handle="\.drag-handle"/);assert.match(html,/data-ctx="chapter"/);
});

test('manuscript translation escapes labels without changing command values, writing or direction',()=>{
  const {DAL,project}=api(),before=JSON.stringify(project),original=DAL.renderManuscript(project);
  DAL.getFontList=()=>['Imported "Font" <Example>'];
  DAL.i18n={text:(key,fallback)=>'<Translated & '+key+'>'};
  const translated=DAL.renderManuscript(project);
  assert.match(translated,/aria-label="&lt;Translated &amp; openChapterNamed&gt;"/);
  assert.match(translated,/aria-label="&lt;Translated &amp; format_bold&gt;"/);
  assert.match(translated,/aria-label="&lt;Translated &amp; chapterManuscriptEditor&gt;"/);
  assert.match(translated,/class="btn focus-exit-button" data-action="fullscreen">&lt;Translated &amp; exitFocusMode&gt;/);
  assert.match(translated,/option value="Imported &quot;Font&quot; &lt;Example&gt;"/);
  const commands=html=>[...html.matchAll(/data-cmd="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(commands(translated),commands(original));assert.match(translated,/<b>Keep first<\/b>/);
  assert.equal(JSON.stringify(project),before);assert.match(translated,/lang="en"/);
});

test('empty manuscript retains disabled editing and a translated recovery instruction',()=>{
  const {DAL,project}=api();project.chapters=[];DAL.i18n={text:(key,fallback)=>key==='emptyManuscriptEditor'?'Add a chapter first':fallback};
  const html=DAL.renderManuscript(project);
  assert.match(html,/contenteditable="false"/);assert.match(html,/aria-disabled="true"/);assert.match(html,/aria-label="Add a chapter first"/);assert.match(html,/No chapters yet/);
});

test('chapter selection validates the target and returns focus without changing prose or opening a phone keyboard',()=>{
  for(const narrow of [false,true]){
    const {DAL,project,action,status}=api(narrow),before=JSON.stringify(project);
    action('select-chapter','missing');assert.equal(status().renders,0);
    action('select-chapter','seven');assert.equal(DAL.selectedChapterId,'seven');assert.equal(DAL.chapterSidebarOpen,false);
    assert.equal(status().focused,narrow?'drawer-trigger':'select-chapter:seven');assert.equal(JSON.stringify(project),before);assert.equal(status().saved,0);
  }
});

test('chapter movement preserves IDs and formatting and keeps focus when its button becomes disabled',()=>{
  const {DAL,project,action,status}=api(),first=project.chapters[0];
  action('chapter-move','five','1');
  assert.equal(project.chapters[1],first);assert.equal(first.contentHTML,'<b>Keep first</b>');assert.equal(DAL.selectedChapterId,'five');
  assert.deepEqual(project.chapters.map(ch=>ch.order),[0,1]);assert.equal(status().focused,'select-chapter:five');
  assert.equal(status().saved,1);assert.equal(status().histories,1);
  action('chapter-move','five','1');action('chapter-move','five','2');action('chapter-move','missing','-1');
  assert.equal(status().saved,1);assert.equal(status().histories,1);
  action('chapter-move','five','-1');assert.equal(project.chapters[0],first);assert.equal(status().saved,2);
});
