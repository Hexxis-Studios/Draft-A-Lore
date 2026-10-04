const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('a default-collapsed panel opens on its first click and closes accessibly',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/interaction.js'),'utf8');
  const DAL={state:{panels:{}},saveState(){}};
  const body={hidden:true,inert:false,style:{},scrollHeight:80,addEventListener(){},removeEventListener(){}};
  const head={expanded:'false',getAttribute(){return this.expanded;},setAttribute(key,value){this.expanded=value;}};
  const panel={querySelector:selector=>selector==='.panel-head'?head:body,classList:{toggle(){}}};
  const el={closest:()=>panel};
  vm.runInNewContext(source.slice(source.indexOf('DAL.togglePanel = function'),source.indexOf('DAL.setAllPanels = function')),{DAL,requestAnimationFrame:fn=>fn()});
  DAL.togglePanel('audio',el);
  assert.equal(head.expanded,'true');assert.equal(body.hidden,false);assert.equal(body.inert,false);assert.equal(DAL.state.panels.audio,true);
  DAL.togglePanel('audio',el);
  assert.equal(head.expanded,'false');assert.equal(body.hidden,true);assert.equal(body.inert,true);assert.equal(DAL.state.panels.audio,false);
});
