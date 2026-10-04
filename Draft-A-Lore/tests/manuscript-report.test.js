const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {holder}=require('./helpers/manuscript-dom.cjs');
const {loadWordCounters}=require('./helpers/word-counters.cjs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/story-tools.js'),'utf8');
function api(){
  const DAL={escapeHtml:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')};
  const document={createElement:()=>holder()};loadWordCounters(DAL,document);
  const context=vm.createContext({DAL,document});
  vm.runInContext(source.slice(source.indexOf('DAL.plainChapter ='),source.indexOf('DAL.commentBadge =')),context);
  vm.runInContext(source.slice(source.indexOf('DAL.syllables ='),source.indexOf('DAL.BEAT_TEMPLATES=')),context);
  return DAL;
}
test('report totals match manuscript counts across formatted multilingual prose and protected markers',()=>{
  const DAL=api(),project={language:'en',chapters:[{title:'Mixed',contentHTML:'<p><strong>Mira</strong> keeps the promise. مرحبا بالعالم</p><h2>章 中文</h2><sup contenteditable="false">[1]</sup>'}]};
  const before=JSON.stringify(project),r=DAL.report(project);
  assert.equal(r.total.words,8);assert.equal(r.chapters[0].words,DAL.countWords(project.chapters[0].contentHTML));assert.equal(r.total.paragraphs,2);assert.equal(r.total.sentences,3);assert.equal(r.total.grade,null);assert.equal(JSON.stringify(project),before);
});
test('report keeps paragraph boundaries, empty lines and punctuation-only blocks out of sentences',()=>{
  const DAL=api(),r=DAL.report({chapters:[{title:'Blocks',contentHTML:'<p>One. Two?</p><p><br/></p><h2>Three</h2><p>!!!</p><p>四。五！</p>'}]});
  assert.equal(r.total.paragraphs,4);assert.equal(r.total.sentences,5);assert.equal(r.total.longest.length,5);
  assert.equal(r.total.words,DAL.countWords('<p>One. Two?</p><h2>Three</h2><p>!!!</p><p>四。五！</p>'));
});
test('repeated words retain Unicode accents, require actual repetition and handle prototype names safely',()=>{
  const DAL=api(),r=DAL.report({language:'fr',chapters:[{title:'Words',contentHTML:'<p>café café unique constructor constructor prototype prototype</p>'}]});
  assert.equal(r.total.counts['café'],2);assert.ok(r.total.repeated.includes('café (2)'));assert.ok(r.total.repeated.includes('constructor (2)'));assert.ok(!r.total.repeated.some(x=>x.startsWith('unique')));assert.equal(r.total.grade,null);
});
test('English grade remains finite and empty manuscripts keep safe zero totals',()=>{
  const DAL=api(),r=DAL.report({language:'en-US',chapters:[{title:'English',contentHTML:'<p>Mira was surprised. She quietly opened a book.</p>'}]});
  assert.ok(Number.isFinite(r.total.grade));assert.equal(r.total.passive,1);assert.equal(r.total.adverbs,1);
  const empty=DAL.report({chapters:[]});assert.equal(empty.total.words,0);assert.equal(empty.total.grade,0);assert.equal(empty.total.sentences,0);
});
test('report flushes live manuscript before analysis and renders honest unavailable-language explanation',()=>{
  const DAL=api(),project={language:'ar',chapters:[{title:'RTL',contentHTML:'<p>old</p>'}]};
  let html='',saved=0;DAL.currentWriterProject=()=>project;DAL.currentTool='manuscript';DAL.saveChapterContent=()=>{saved++;project.chapters[0].contentHTML='<p>مرحبا بالعالم</p>';};DAL.modal=(title,body)=>{html=body;};
  DAL.showReadability();assert.equal(saved,1);assert.match(html,/<strong>2<\/strong>words/);assert.match(html,/English-only heuristics/);assert.match(html,/<strong>—<\/strong>Flesch/);assert.ok(!html.includes('NaN'));
  DAL.currentTool='overview';DAL.showReadability();assert.equal(saved,1);
});

test('report renders real ICU plurals and locale numbers without interpreting or changing manuscript text',async()=>{
  const DAL=api(),engine=require('i18next').createInstance(),ICU=require('i18next-icu').default;
  const english=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../src/locales/en.json'),'utf8'));
  await engine.use(new ICU()).init({lng:'en',initImmediate:false,resources:{en:{translation:english}}});
  DAL.i18n={text:(key,fallback,values)=>engine.t(key,{...values,defaultValue:fallback})};DAL.formatNumber=(value,options)=>new Intl.NumberFormat('de',options).format(value);
  const project={language:'en',chapters:[{title:'<notes> {words}',contentHTML:'<p>One.</p>'}]};const original=JSON.stringify(project);
  let body;DAL.currentWriterProject=()=>project;DAL.modal=(title,html)=>{body=html;};DAL.showReadability();
  assert.match(body,/1 word · 1 sentence · 1 paragraph/);assert.match(body,/&lt;notes&gt; \{words\}/);assert.equal(JSON.stringify(project),original);
  project.chapters[0].contentHTML='<p>'+Array(1000).fill('word').join(' ')+'</p>';DAL.showReadability();assert.match(body,/<strong>1\.000<\/strong>words/);assert.match(body,/word \(1\.000\)/);
  DAL.i18n.text=(key,fallback)=>key==='reportTitle'?'<Translated report>':key==='reportChapters'?'<Chapters & text>':fallback;
  DAL.showReadability();assert.match(body,/&lt;Chapters &amp; text&gt;/);
});

test('empty report has useful guidance and does not present a readability grade without prose',()=>{
  const DAL=api();let body,footer;DAL.currentWriterProject=()=>({chapters:[]});DAL.modal=(title,html,options)=>{body=html;footer=options.footer;};DAL.showReadability();
  assert.match(body,/Add chapters and prose/);assert.match(body,/<strong>—<\/strong>Flesch/);assert.ok(!body.includes('NaN'));assert.match(footer,/data-action="close-modal"/);
});
