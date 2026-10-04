const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function api(){
  const project={id:'p',type:'novel',chapters:[{id:'first',updatedAt:1},{id:'recent',updatedAt:30}]},calls=[],DAL={state:{projects:{p:project}},BREAKPOINTS:{medium:768},render(){calls.push('render');},saveChapterContent(){calls.push('save');}};
  const context={DAL,window:{innerWidth:1280}};
  for(const [file,marker] of [['core.js','DAL.navigate ='],['views.js','DAL.continueWriting=']]){const source=fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),start=source.indexOf(marker),end=source.indexOf('\n};',start)+3;vm.runInNewContext(source.slice(start,end),context);}
  return{DAL,project,calls};
}
test('Continue Writing opens most recently edited chapter without an extra render',()=>{const q=api();assert.equal(q.DAL.continueWriting('p'),true);assert.equal(q.DAL.currentTool,'manuscript');assert.equal(q.DAL.selectedChapterId,'recent');assert.equal(q.DAL.currentProjectId,'p');assert.deepEqual(q.calls,['render']);});
test('ordinary project opening still opens overview and does not retain another chapter',()=>{const q=api();q.DAL.selectedChapterId='recent';q.DAL.navigate('workspace','p');assert.equal(q.DAL.currentTool,null);assert.equal(q.DAL.selectedChapterId,null);});
test('Continue Writing keeps RPG projects in their story graph',()=>{const q=api();q.project.type='rpg';q.DAL.continueWriting('p');assert.equal(q.DAL.currentTool,'storygraph');assert.equal(q.DAL.selectedChapterId,null);});
test('missing chapters and missing project IDs are safe and do not fabricate prose',()=>{const q=api();q.project.chapters=[];assert.equal(q.DAL.continueWriting('p'),true);assert.equal(q.DAL.currentTool,'manuscript');assert.equal(q.DAL.selectedChapterId,null);assert.deepEqual(q.project.chapters,[]);assert.equal(q.DAL.continueWriting('deleted'),false);assert.equal(q.calls.length,1);});
test('Continue Writing flushes existing editor changes before changing projects',()=>{const q=api();q.DAL.currentTool='manuscript';q.DAL.continueWriting('p');assert.deepEqual(q.calls,['save','render']);q.DAL.navigate('workspace','p','manuscript','deleted');assert.equal(q.DAL.selectedChapterId,null);});
