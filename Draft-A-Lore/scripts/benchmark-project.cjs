const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const os=require('node:os');
const {holder}=require('../tests/helpers/manuscript-dom.cjs');

const root=path.resolve(__dirname,'..');
const core=fs.readFileSync(path.join(root,'src/core.js'),'utf8');
const DAL={clone:obj=>JSON.parse(JSON.stringify(obj)),registerAfterRender(){},registerActionHandler(){}};
const context={DAL,document:{createElement:()=>holder()},TextEncoder,TextDecoder,Uint8Array,Date,Promise,Blob,Response,DecompressionStream};
vm.createContext(context);
function extract(start,end){
  const at=core.indexOf(start),until=core.indexOf(end,at);
  assert.ok(at>=0&&until>at,'Benchmark source boundaries changed');
  vm.runInContext(core.slice(at,until),context);
}
extract('DAL.manuscriptTextModel =','DAL.formatNumber =');
extract('DAL.getProjectWordCount =','/* Daily word history');
extract('DAL.HISTORY_EXCLUDE =','DAL.applySnapshot =');
vm.runInContext(fs.readFileSync(path.join(root,'src/bundle.js'),'utf8'),context);
const search=fs.readFileSync(path.join(root,'src/story-tools.js'),'utf8');
vm.runInContext(search.slice(search.indexOf('DAL.findTextMatches ='),search.indexOf('DAL.findMatches =')),context);

function measure(operation,iterations=15){
  for(let i=0;i<3;i++)operation();
  const samples=[];
  for(let i=0;i<iterations;i++){const start=performance.now();operation();samples.push(performance.now()-start);}
  samples.sort((a,b)=>a-b);
  return {medianMs:+samples[Math.floor(samples.length/2)].toFixed(3),p95Ms:+samples[Math.ceil(samples.length*.95)-1].toFixed(3)};
}

async function main(){
  const results=[];
  for(const totalWords of [10000,100000,1000000]){
    const prose='Mira opened the grimoire beside the quiet library rainy window. '.repeat(totalWords/10/20).trim();
    const project={id:'synthetic-benchmark',title:'Synthetic benchmark only',chapters:Array.from({length:20},(_,index)=>({id:'chapter-'+index,title:'Chapter '+index,contentHTML:'<p><strong>'+prose+'</strong></p>'})),characters:[{id:'mira',name:'Mira',traits:['curious']}],items:[{id:'book',name:'Grimoire'}]};
    const expected=JSON.stringify(project);
    const historySnapshot=JSON.parse(expected);
    project.history=Array(40).fill(historySnapshot);project.versions=Array(20).fill({data:historySnapshot});
    const snapshot=DAL.snapshotProject(project);
    assert.equal(JSON.stringify(snapshot),expected,'Snapshot altered project content');
    snapshot.chapters[0].title='Independent copy';
    assert.equal(project.chapters[0].title,'Chapter 0');
    const encoded=new TextEncoder().encode(expected);
    const zip=DAL.makeZip([{name:'project.json',data:encoded}]);
    const opened=DAL.readZip(zip);
    assert.deepEqual(Buffer.from(await opened.read(opened.entries[0])),Buffer.from(encoded));
    assert.equal(DAL.countWordsText(prose)*20,totalWords);
    assert.equal(DAL.findTextMatches(prose,{query:'Mira',wholeWord:true}).length*20,totalWords/10);
    results.push({words:totalWords,chapters:20,historyEntries:40,snapshots:20,jsonBytes:encoded.byteLength,zipBytes:zip.byteLength,
      snapshot:measure(()=>DAL.snapshotProject(project)),
      chapterWordCount:measure(()=>DAL.countWordsText(prose)),
      manuscriptLiteralSearch:measure(()=>project.chapters.forEach(()=>DAL.findTextMatches(prose,{query:'Mira',wholeWord:true}))),
      serializeProject:measure(()=>JSON.stringify(historySnapshot)),
      reopenProject:measure(()=>JSON.parse(expected)),
      zipExport:measure(()=>DAL.makeZip([{name:'project.json',data:encoded}]),5)});
  }
  for(const result of results){
    const formattedHTML=('<p><strong>Mira</strong> opened the grimoire beside the quiet library rainy window.<sup contenteditable="false">1</sup></p>').repeat(result.words/10/20);
    const formattedRoot=holder(formattedHTML);
    const formattedProject={chapters:Array.from({length:20},()=>({contentHTML:formattedHTML}))};
    assert.equal(DAL.countManuscriptWords(formattedRoot)*20,result.words);
    assert.equal(DAL.getProjectWordCount(formattedProject).manuscript,result.words);
    function coldProjectCount(){DAL._chapterWordCounts=new WeakMap();return DAL.getProjectWordCount(formattedProject);}
    result.formattedLiveChapterWordCount=measure(()=>DAL.countManuscriptWords(formattedRoot));
    result.coldFormattedProjectWordCount=measure(coldProjectCount,5);
    assert.equal(DAL.getProjectWordCount(formattedProject).manuscript,result.words);
    result.warmFormattedProjectWordCount=measure(()=>DAL.getProjectWordCount(formattedProject));
  }
  console.log(JSON.stringify({environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model},scope:'Node code-path baseline with synthetic XML DOM for formatted counters, not browser DOM performance; excludes actual storage I/O, startup, scrolling and native devices. Synthetic content only; no files written or uploaded.',results},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
