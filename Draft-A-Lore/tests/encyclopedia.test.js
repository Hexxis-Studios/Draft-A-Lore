const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function api(timerOverrides){
  const document={addEventListener(){},createElement(){return{textContent:'',get innerHTML(){return this.textContent;}};},getElementById(){return null;}};
  const sandbox={DAL:{},document,window:{getSelection(){return null;}},navigator:{},localStorage:{},indexedDB:{},console,Date,Blob,Promise,setTimeout,clearTimeout,confirm(){return true;}};
  Object.assign(sandbox,timerOverrides||{});
  vm.createContext(sandbox);
  for(const file of ['core.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src',file),'utf8'),sandbox);
  sandbox.DAL.state=sandbox.DAL.defaultState();sandbox.DAL.handleStoryClick=function(){};sandbox.DAL.afterStoryRender=function(){};sandbox.DAL.saveState=function(){};
  for(const file of ['world-tools.js','continuity-tools.js','encyclopedia-tools.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src',file),'utf8'),sandbox);
  return sandbox.DAL;
}

test('delayed world analysis respects autosave and never annotates another project',()=>{
  let callback,saves=0,marks=0,scans=0;
  const DAL=api({setTimeout(fn){callback=fn;return 1;},clearTimeout(){}});
  const project=DAL.defaultProject('Book','novel'),chapter={id:'chapter'};
  project.continuity.live=true;DAL.state.projects[project.id]=project;
  DAL.currentProjectId='another-project';DAL.selectedChapterId='another-chapter';
  DAL.state.autosave=false;DAL.saveState=()=>{saves++;};DAL.runContinuity=()=>{scans++;};DAL.applyLiveContinuityMarks=()=>{marks++;};
  DAL.scheduleWorldAnalysis(project,chapter);callback();
  assert.equal(scans,1);assert.equal(saves,0);assert.equal(marks,0);
  DAL.currentProjectId=project.id;DAL.selectedChapterId=chapter.id;
  DAL.scheduleWorldAnalysis(project,chapter);callback();
  assert.equal(marks,1);
  DAL.state.projects[project.id]=DAL.defaultProject('Replacement','novel');
  callback();assert.equal(scans,2);
});

test('deferred continuity rendering ignores a chapter that is no longer open',()=>{
  let callback,marks=0;
  const DAL=api({setTimeout(fn){callback=fn;return 1;},clearTimeout(){}});
  const project=DAL.defaultProject('Book','novel');project.chapters=[{id:'first'}];
  DAL.state.projects[project.id]=project;DAL.currentProjectId=project.id;
  DAL.currentTool='manuscript';DAL.selectedChapterId='first';DAL.applyLiveContinuityMarks=()=>{marks++;};
  DAL.afterStoryRender(project);DAL.selectedChapterId='second';callback();assert.equal(marks,0);
  DAL.selectedChapterId='first';DAL.afterStoryRender(project);callback();assert.equal(marks,1);
  DAL.afterStoryRender(project);DAL.currentTool='characters';callback();assert.equal(marks,1);
});

test('living encyclopedia extracts recurring records and explicit facts',()=>{
  const DAL=api(),project=DAL.defaultProject('Book','novel');
  project.chapters=[{id:'one',title:'One',contentHTML:'<p>Mara crossed the city of Haven. Mara was born in Year 12. Haven guarded the river.</p>'}];
  const candidates=DAL.runEncyclopediaScan(project),mara=candidates.find(item=>item.name==='Mara'),haven=candidates.find(item=>item.name==='Haven');
  assert.ok(mara);
  assert.equal(mara.kind,'character');
  assert.equal(mara.facts[0].key,'birth year');
  assert.ok(haven);
  assert.equal(haven.kind,'place');
});

test('accepted encyclopedia suggestions create real project records once',()=>{
  const DAL=api(),project=DAL.defaultProject('Book','novel'),candidate={id:'candidate',name:'Haven',kind:'place',context:'The city of Haven.',facts:[],status:'active'};
  assert.equal(DAL.addEncyclopediaCandidate(project,candidate,false),true);
  assert.equal(DAL.addEncyclopediaCandidate(project,candidate,false),false);
  assert.equal(project.lore.entries.length,1);
  assert.equal(project.lore.entries[0].folder,'Locations');
  assert.equal(candidate.status,'added');
});
