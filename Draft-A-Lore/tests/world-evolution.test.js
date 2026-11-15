const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function api(){
  const listeners={},messages=[];
  const document={addEventListener(name,handler){(listeners[name]||=[]).push(handler);},getElementById(){return null;},querySelector(){return null;},createElement(){return {set textContent(value){this.innerHTML=String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}};}};
  const sandbox={DAL:{},document,window:{},navigator:{},console,setTimeout,clearTimeout,Blob,URL,Promise,Date,Intl,Set,Map,WeakMap};vm.createContext(sandbox);
  function load(name){vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),sandbox);}
  load('core.js');const DAL=sandbox.DAL;DAL.state=DAL.defaultState();DAL.handleStoryClick=()=>{};DAL.afterStoryRender=()=>{};DAL.render=()=>{};DAL.toast=(...args)=>messages.push(args);DAL.saveState=async()=>true;load('world-tools.js');load('continuity-tools.js');load('encyclopedia-tools.js');
  return {DAL,sandbox,load,listeners,messages};
}
test('shared world record edits have guarded Undo and Redo without reverting another record',()=>{
  const {DAL}=api(),bible=DAL.defaultBible('World');bible.characters=[{id:'mira',name:'Mira'},{id:'other',name:'Other'}];
  const before=DAL.clone(bible.characters[0]);bible.characters[0].name='Mira Dawn';DAL.pushBibleHistory(bible,[{section:'characters',id:'mira',index:0,before,after:DAL.clone(bible.characters[0])}]);bible.characters[1].name='Other changed';
  assert.equal(DAL.stepBibleHistory(bible,false),true);assert.equal(bible.characters[0].name,'Mira');assert.equal(bible.characters[1].name,'Other changed');
  assert.equal(DAL.stepBibleHistory(bible,true),true);assert.equal(bible.characters[0].name,'Mira Dawn');
  bible.characters[0].name='Newer edit';assert.equal(DAL.stepBibleHistory(bible,false),false);assert.equal(bible.characters[0].name,'Newer edit');
});
test('world import refuses unrelated JSON, newer schemas, duplicate IDs and unsafe properties',()=>{
  const {DAL}=api(),bible=DAL.defaultBible('World');
  assert.throws(()=>DAL.stageBibleImport('{}'),/structure/);
  assert.throws(()=>DAL.stageBibleImport(JSON.stringify({...bible,chapters:[]})),/project or workspace/);
  assert.throws(()=>DAL.stageBibleImport(JSON.stringify({kind:'draft-a-lore-bible',schemaVersion:DAL.SCHEMA_VERSION+1,bible})),/unsupported/);
  bible.characters=[{id:'same',name:'One'},{id:'same',name:'Two'}];assert.throws(()=>DAL.stageBibleImport(JSON.stringify(bible)),/duplicate/);
  assert.throws(()=>DAL.stageBibleImport('{"__proto__":{}}'),/unsafe/);
});
test('Bible fact zero and false survive normalization',()=>{
  const {DAL}=api(),bible=DAL.defaultBible('World');bible.glossary=[{id:'term',term:'Magic',facts:[{key:'cost',value:0},{key:'enabled',value:false}]}];
  const result=DAL.stageBibleImport(JSON.stringify(bible));assert.equal(result.glossary[0].facts[0].value,'0');assert.equal(result.glossary[0].facts[1].value,'false');
});
test('asynchronous Bible import cannot relink a switched project',async()=>{
  const {DAL}=api(),project=DAL.defaultProject('Book','novel');DAL.state.projects[project.id]=project;DAL.currentProjectId=project.id;DAL._bibleImportGeneration=1;
  let finish;const file={size:100,text:()=>new Promise(resolve=>finish=resolve)},promise=DAL.importBibleFile(file,project,1);DAL.currentProjectId='other';finish(JSON.stringify(DAL.defaultBible('World')));
  await assert.rejects(promise,/project changed/);assert.equal(DAL.state.bibleOrder.length,0);assert.ok(!project.bibleId);
});
test('Unicode names stay distinct and do not match inside larger words',()=>{
  const {DAL}=api();assert.notEqual(DAL.continuityKey('مريم'),DAL.continuityKey('نور'));assert.notEqual(DAL.continuityKey('Élodie'),DAL.continuityKey('Elodie'));
  assert.deepEqual(Array.from(DAL.continuityMentions('Élodie Élodier Élodie','Élodie')),[0,15]);assert.equal(DAL.continuityMentions('anything','').length,0);
});
test('encyclopedia retains prior user decisions after names leave the manuscript',()=>{
  const {DAL}=api(),project=DAL.defaultProject('Book','novel');project.chapters=[];project.encyclopedia={auto:true,candidates:[{id:'one',key:'mira',name:'Mira',status:'dismissed',mentions:3,facts:[]},{id:'two',key:'dawn',name:'Dawn',status:'added',mentions:2,facts:[]}]};
  const result=DAL.runEncyclopediaScan(project);assert.equal(result.length,2);assert.equal(result[0].status,'dismissed');assert.equal(result[1].status,'added');assert.equal(result[0].mentions,0);
});
test('requesting a Bible addition without a Bible cannot create a local record',()=>{
  const {DAL}=api(),project=DAL.defaultProject('Book','novel');assert.throws(()=>DAL.addEncyclopediaCandidate(project,{name:'Mira',kind:'character',facts:[]},true),/Connect a World Bible/);assert.equal(project.characters.length,0);
});
test('pacing avoids fabricated language scores and merges overlapping aliases',()=>{
  const {DAL,load}=api();load('analytics-tools.js');
  const pacing=DAL.analyzePacing('مرحبا يا عالم.','ar');assert.equal(pacing.words,3);assert.equal(pacing.score,null);assert.equal(pacing.actionDensity,null);
  assert.equal(DAL.povMentions('Mira Dawn met Mira.',{name:'Mira Dawn',aliases:['Mira','Mira Dawn']}),2);
});

test('POV rendering scans each chapter and character once and preserves chapter ordering',()=>{
  const {DAL,load}=api();load('analytics-tools.js');const project=DAL.defaultProject('Book','novel');
  project.characters=[{id:'mira',name:'Mira',aliases:['Mira Dawn']},{id:'kel',name:'Kel'}];
  project.chapters=[{id:'later',title:'Later',order:2,contentHTML:'<p>Mira Dawn met Mira.</p>'},{id:'first',title:'First',order:1,contentHTML:'<p>Kel spoke to Kel.</p>'}];
  const before=JSON.stringify(project),mentions=DAL.povMentions,records=DAL.povRecords;let scans=0,recordScans=0;
  DAL.povMentions=(...args)=>{scans++;return mentions(...args);};DAL.povRecords=(...args)=>{recordScans++;return records(...args);};
  const html=DAL.renderStoryAnalytics(project);assert.equal(scans,4);assert.equal(recordScans,1);assert.ok(html.indexOf('data-cid="first"')<html.indexOf('data-cid="later"'));assert.match(html,/2 mentions/);assert.equal(JSON.stringify(project),before);
});

test('POV suggestions use the same counts as the heatmap and do not treat non-English I as narration',()=>{
  const {DAL,load}=api();load('analytics-tools.js');const project=DAL.defaultProject('Book','novel');
  project.characters=[{id:'mira',name:'Mira',aliases:['Mira Dawn']}];project.chapters=[{id:'chapter',contentHTML:'<p>Mira Dawn met Mira.</p>'}];
  const report=DAL.storyAnalytics(project);assert.deepEqual(Array.from(report.rows[0].mentions),[2]);assert.equal(report.maxMention,2);assert.equal(report.rows[0].suggestion.id,'mira');
  const text='I I I I I I';project.chapters[0].contentHTML=text;assert.equal(DAL.storyAnalytics(project).rows[0].suggestion.id,'first-person');project.language='tr';assert.equal(DAL.storyAnalytics(project).rows[0].suggestion,null);
  project.genres=['__proto__','constructor','unrecognized'];assert.deepEqual(Array.from(DAL.projectPacingTarget(project)),[42,68]);
});

test('continuity compares equivalent fact labels while preserving negative years',()=>{
  const {DAL}=api(),project=DAL.defaultProject('Book','novel');
  project.lore.entries=[{id:'one',title:'Mira',facts:[{key:'born',value:'-12'}]},{id:'two',title:'Mira',facts:[{key:'birth year',value:'12'}]}];
  assert.equal(DAL.continuityYear('Year -12'),-12);
  assert.equal(DAL.runContinuity(project).issues.filter(issue=>issue.rule==='contradictory-fact').length,1);
  assert.equal(DAL.continuitySceneYear({},'There were 25 guards.'),null);
  assert.equal(DAL.continuitySceneYear({},'In Year -12 the gates opened.'),-12);
});

test('post-death review uses local context instead of a cue anywhere in the chapter',()=>{
  const {DAL}=api(),project=DAL.defaultProject('Book','novel');
  project.characters=[{id:'mira',name:'Mira',deceased:true,deathChapterId:'death'}];
  project.chapters=[{id:'death',title:'Death',order:0,contentHTML:'Mira died.'},{id:'later',title:'Later',order:1,contentHTML:'A ghost floated outside. '+('They walked through the city. '.repeat(25))+'Mira opened the door.'}];
  let issues=DAL.runContinuity(project).issues.filter(issue=>issue.rule==='post-death-appearance');assert.equal(issues.length,1);assert.equal(issues[0].severity,'warning');
  project.chapters[1].contentHTML='They remembered Mira fondly.';assert.equal(DAL.runContinuity(project).issues.filter(issue=>issue.rule==='post-death-appearance').length,0);
});

function backgroundApi(gate){
  const setup=api(),blobs=new Map(),workers=[];let next=0;
  setup.sandbox.URL={createObjectURL(blob){const id='blob:'+ ++next;blobs.set(id,blob);return id;},revokeObjectURL(id){blobs.delete(id);}};
  setup.sandbox.Worker=class Worker{
    constructor(url){this.blob=blobs.get(url);workers.push(this);}
    terminate(){this.terminated=true;}
    postMessage(message){
      Promise.resolve(gate).then(async()=>{
        if(this.terminated)return;
        const context={postMessage:data=>{if(!this.terminated&&this.onmessage)this.onmessage({data});},console};vm.createContext(context);
        try{vm.runInContext(await this.blob.text(),context);context.onmessage({data:JSON.parse(JSON.stringify(message))});}
        catch(error){if(this.onerror)this.onerror(error);}
      });
    }
  };
  setup.load('world-analysis.js');return {...setup,blobs,workers};
}

test('background scanner executes the generated worker code and releases its resources',async()=>{
  const {DAL,blobs,workers}=backgroundApi(),project=DAL.defaultProject('Book','novel');
  project.chapters=[{id:'c',title:'Later',order:0,contentHTML:'Élodie crossed the bridge. Élodie returned.'}];DAL.state.projects[project.id]=project;
  const result=await DAL.analyzeWorldAsync(project,{continuity:true,encyclopedia:true,manual:true});
  assert.ok(result.report.issues.some(issue=>issue.rule==='uncatalogued-name'&&issue.needle==='Élodie'));
  assert.ok(project.encyclopedia.candidates.some(candidate=>candidate.name==='Élodie'));assert.equal(workers[0].terminated,true);assert.equal(blobs.size,0);
});

test('worker results cannot overwrite a chapter edited while scanning',async()=>{
  let release;const gate=new Promise(resolve=>release=resolve),{DAL,blobs}=backgroundApi(gate),project=DAL.defaultProject('Book','novel');
  project.chapters=[{id:'c',title:'Draft',order:0,contentHTML:'Mira opened a door. Mira returned.'}];DAL.state.projects[project.id]=project;
  const previous=project.encyclopedia,result=DAL.analyzeWorldAsync(project,{encyclopedia:true});project.chapters[0].contentHTML='Newer writing';release();
  assert.equal(await result,null);assert.equal(project.encyclopedia,previous);assert.equal(project.chapters[0].contentHTML,'Newer writing');assert.equal(blobs.size,0);
});

test('cancelling analysis terminates the worker without changing writing or decisions',async()=>{
  let release;const gate=new Promise(resolve=>release=resolve),{DAL,workers,blobs}=backgroundApi(gate),project=DAL.defaultProject('Book','novel');
  project.chapters=[];DAL.state.projects[project.id]=project;const previous=project.encyclopedia,result=DAL.analyzeWorldAsync(project,{encyclopedia:true});DAL.cancelWorldAnalysis();release();
  assert.equal(await result,null);assert.equal(project.encyclopedia,previous);assert.equal(workers[0].terminated,true);assert.equal(blobs.size,0);
});

test('manual world scans fall back locally when a WebView worker fails and release resources',async()=>{
  const {DAL,sandbox,workers,blobs}=backgroundApi(),project=DAL.defaultProject('Book','novel');
  project.chapters=[{id:'c',title:'Chapter 1',order:0,contentHTML:'Mira crossed the bridge. Mira returned.'}];DAL.state.projects[project.id]=project;
  sandbox.Worker=class FailedWorker{constructor(url){this.url=url;workers.push(this);}terminate(){this.terminated=true;}postMessage(){this.onerror(new Error('Worker blocked'));}};
  const result=await DAL.analyzeWorldAsync(project,{continuity:true,manual:true});
  assert.equal(result.foreground,true);assert.ok(result.report);assert.equal(workers[0].terminated,true);assert.equal(blobs.size,0);
});
test('missing worker support does not run automatic analysis on the typing thread',async()=>{
  const {DAL,load}=api(),project=DAL.defaultProject('Book','novel');DAL.state.projects[project.id]=project;let scans=0;DAL.runContinuity=()=>{scans++;return {issues:[]};};load('world-analysis.js');
  assert.equal(await DAL.analyzeWorldAsync(project,{continuity:true}),null);assert.equal(scans,0);
  assert.ok(await DAL.analyzeWorldAsync(project,{continuity:true,manual:true}));assert.equal(scans,1);
});
