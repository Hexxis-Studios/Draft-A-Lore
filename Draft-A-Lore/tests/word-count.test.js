const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {holder}=require('./helpers/manuscript-dom.cjs');
const {loadWordCounters}=require('./helpers/word-counters.cjs');
const core=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
const story=fs.readFileSync(path.join(__dirname,'../src/story-tools.js'),'utf8');
function api(){
  let parsed=0;const document={createElement:()=>{parsed++;return holder();}};
  const chapter={id:'one',contentHTML:'<p><em>The storm ends.</em> Chapter seven stays second.</p><h2>QA outline heading</h2><h2>QA outline heading</h2>'};
  const project={id:'project',chapters:[chapter],characters:[{appearance:'One fact'}],adventure:{nodes:[{text:'One choice'}]}};
  const DAL={state:{projects:{project},wordCountVersion:1,wordBaseline:{manuscript:13,supplementary:2},wordHistory:{'2026-10-01':{manuscript:20,supplementary:7}}},clone:obj=>JSON.parse(JSON.stringify(obj)),todayKey:()=> '2026-10-02'};
  loadWordCounters(DAL,document);
  const context=vm.createContext({DAL,document});
  vm.runInContext(core.slice(core.indexOf('DAL.getProjectWordCount ='),core.indexOf('/* Daily word history')),context);
  vm.runInContext(core.slice(core.indexOf('DAL.updateWordHistory ='),core.indexOf('/* Goal periods')),context);
  vm.runInContext(story.slice(story.indexOf('DAL.plainChapter ='),story.indexOf('DAL.commentBadge =')),context);
  return {DAL,document,chapter,project,parsed:()=>parsed};
}

test('saved HTML and live manuscript count paragraph/headings as separate words while inline styles join correctly',()=>{
  const q=api(),before=q.chapter.contentHTML;assert.equal(q.DAL.countWords(before),13);assert.equal(q.DAL.countManuscriptWords(holder(before)),13);
  assert.equal(q.DAL.countWords('<p>sun<strong>flower</strong> ca<em>fé</em></p>'),2);assert.equal(q.chapter.contentHTML,before);
  assert.equal(q.DAL.countWords('<p>a<br/>b</p><ul><li>c</li><li>d</li></ul><table><tr><td>e</td><td>f</td></tr></table>'),6);
});
test('counts exclude protected annotations/scripts but retain Unicode whitespace, direction and authored prose',()=>{
  const q=api(),html='<p dir="rtl">نص <span dir="ltr">Mira</span></p><span contenteditable="false">🔖 bookmark label</span><sup contenteditable="false">[1]</sup><style>ignored rule</style><script>ignored script</script><p>A&#160;B&#8195;C</p>';
  assert.equal(q.DAL.countWords(html),5);assert.equal(q.DAL.countWords(''),0);assert.equal(q.DAL.countManuscriptWords(holder('<p><br/></p>')),0);
  assert.equal(q.DAL.manuscriptTextModel(holder(html),false).nodes.length,0);assert.ok(q.DAL.manuscriptTextModel(holder(html)).nodes.length>0);
});
test('project and report text use the same boundaries without counting RPG or supplementary prose twice',()=>{
  const q=api();assert.deepEqual(JSON.parse(JSON.stringify(q.DAL.getProjectWordCount(q.project))),{manuscript:15,supplementary:2,total:17});assert.equal(q.DAL.countWordsText(q.DAL.plainChapter(q.chapter)),13);
});
test('unchanged chapters reuse counts and changed markup or restored chapter objects never inherit stale counts',()=>{
  const q=api();assert.equal(q.DAL.chapterWordCount(q.chapter),13);const first=q.parsed();q.DAL.getProjectWordCount(q.project);q.DAL.getGlobalWordCount();assert.equal(q.parsed(),first);
  q.chapter.contentHTML='<p>One</p><p>Two</p>';assert.equal(q.DAL.chapterWordCount(q.chapter),2);assert.equal(q.parsed(),first+1);
  const clone={...q.chapter,contentHTML:'<p>Fresh</p>'};assert.equal(q.DAL.chapterWordCount(clone),1);assert.equal(q.parsed(),first+2);
  q.chapter.contentHTML='<p>Live update</p>';q.DAL.cacheChapterWordCount(q.chapter,q.DAL.countManuscriptWords(holder(q.chapter.contentHTML)));assert.equal(q.DAL.chapterWordCount(q.chapter),2);assert.equal(q.parsed(),first+2);
});
test('baseline migration changes no daily totals or authored content and preserves the old baseline once',()=>{
  const q=api(),history=JSON.stringify(q.DAL.state.wordHistory),prose=JSON.stringify(q.project);q.DAL.migrateWordCountBaseline();assert.equal(q.DAL.state.wordCountVersion,2);assert.equal(q.DAL.state.wordBaseline.manuscript,15);assert.equal(q.DAL.state.wordBaseline.supplementary,2);assert.equal(q.DAL.state.wordCountBaselineLegacy.baseline.manuscript,13);
  q.DAL.updateWordHistory();assert.equal(JSON.stringify(q.DAL.state.wordHistory),history);assert.equal(JSON.stringify(q.project),prose);const backup=JSON.stringify(q.DAL.state.wordCountBaselineLegacy);q.DAL.migrateWordCountBaseline();assert.equal(JSON.stringify(q.DAL.state.wordCountBaselineLegacy),backup);
});
test('migration retains genuine pending output, then typing/deleting/undo use the corrected baseline',()=>{
  const q=api();q.DAL.state.wordBaseline.manuscript=11;q.DAL.updateWordHistory();assert.equal(q.DAL.state.wordHistory['2026-10-02'].manuscript,2);
  const previous=q.chapter.contentHTML;q.chapter.contentHTML+='<p>Fresh word</p>';q.DAL.updateWordHistory();assert.equal(q.DAL.state.wordHistory['2026-10-02'].manuscript,4);q.chapter.contentHTML=previous;q.DAL.updateWordHistory();assert.equal(q.DAL.state.wordHistory['2026-10-02'].manuscript,2);assert.equal(q.DAL.state.wordHistory['2026-10-01'].manuscript,20);
});
test('marker exclusion never credits activity and an old sprint is not inflated by corrected paragraph boundaries',()=>{
  const q=api();q.DAL.state.writerTools={sprint:{projectId:'project',startWords:13,endsAt:123}};q.DAL.migrateWordCountBaseline();assert.equal(q.DAL.state.writerTools.sprint.startWords,15);assert.equal(q.DAL.state.wordCountBaselineLegacy.sprintStartWords,13);
  const notes=api();notes.chapter.contentHTML='<p>Real words</p><span contenteditable="false"> artificial count</span>';notes.project.adventure.nodes=[];notes.DAL.state.wordBaseline.manuscript=4;notes.DAL.updateWordHistory();assert.equal(notes.DAL.state.wordBaseline.manuscript,2);assert.equal(notes.DAL.state.wordHistory['2026-10-02'],undefined);
});
test('invalid baselines become a safe current baseline, while unknown future versions remain untouched',()=>{
  for(const base of [null,{manuscript:NaN,supplementary:0},{manuscript:1,supplementary:Infinity}]){const q=api();q.DAL.state.wordBaseline=base;q.DAL.updateWordHistory();assert.equal(q.DAL.state.wordBaseline.manuscript,15);assert.equal(q.DAL.state.wordHistory['2026-10-02'],undefined);}
  const q=api();q.DAL.state.wordCountVersion=999;const before=JSON.stringify(q.DAL.state);q.DAL.updateWordHistory();assert.equal(JSON.stringify(q.DAL.state),before);
});
