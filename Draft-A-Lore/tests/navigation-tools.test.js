const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const sandbox={DAL:{},document:{addEventListener(){}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/navigation-tools.js'),'utf8'),sandbox);

test('main navigation remains named when collapsed and tracks nested pages and translated labels',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
  const nodes=['dashboard','projects','library','settings'].map(key=>({
    key,attributes:{},span:{textContent:''},active:false,
    getAttribute(){return key;},querySelector(){return this.span;},
    setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];},
    classList:{toggle(name,value){nodes.find(node=>node.key===key).active=value;}}
  }));
  const trigger={attributes:{},setAttribute(name,value){this.attributes[name]=value;}};
  const DAL={state:{sidebarCollapsed:true},currentView:'dashboard'};
  const document={querySelectorAll:selector=>selector.includes('toggle-sidebar')?[trigger]:nodes,querySelector:()=>trigger};
  vm.runInNewContext(source.slice(source.indexOf('DAL.syncMainNavigation ='),source.indexOf('DAL.render = function')),{DAL,document});
  DAL.syncMainNavigation();
  for(const node of nodes){assert.ok(node.attributes['aria-label']);assert.equal(node.attributes.title,node.span.textContent);}
  assert.equal(nodes[0].attributes['aria-current'],'page');assert.equal(trigger.attributes['aria-expanded'],'false');
  assert.equal(trigger.attributes['aria-label'],'Open main menu');
  DAL.currentView='workspace';DAL.state.sidebarCollapsed=false;DAL.syncMainNavigation();
  assert.equal(nodes[1].active,true);assert.equal(nodes[1].attributes['aria-current'],'page');
  assert.equal(nodes[0].attributes['aria-current'],undefined);assert.equal(trigger.attributes['aria-label'],'Close main menu');
  DAL.currentView='player';DAL.i18n={text:(key,fallback)=>'Translated '+fallback};DAL.syncMainNavigation();
  assert.equal(nodes[2].attributes['aria-current'],'page');assert.equal(nodes[1].attributes['aria-current'],undefined);
  assert.equal(nodes[2].attributes['aria-label'],'Translated Library');assert.equal(trigger.attributes['aria-label'],'Translated Close main menu');
});
test('phone project drawer focuses navigation without automatically opening keyboard',()=>{
  const selectors=[],context={DAL:{},window:{innerWidth:360},document:{addEventListener(){},querySelector:()=>null,getElementById:()=>({querySelector:selector=>{selectors.push(selector);return{focus(){}};}})}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/navigation-tools.js'),'utf8'),context);
  context.DAL.setWorkspaceDrawer('project',true);
  assert.deepEqual(selectors,['[data-action="ws-tool"]']);
  context.window.innerWidth=1280;context.DAL.setWorkspaceDrawer('project',true);
  assert.equal(selectors.at(-1),'#projectToolSearch');
});

test('project-section search matches names and writer-friendly synonyms',()=>{
  const match=sandbox.DAL.matchesToolQuery;
  assert.equal(match('Manuscript','manuscript','writing'),true);
  assert.equal(match('POV & Pacing','storyanalytics','point view'),true);
  assert.equal(match('Device Sync','sync','backup'),true);
  assert.equal(match('Items & Inventory','items','equipment'),true);
  assert.equal(match('Manuscript','manuscript','  CHAPTERS '),true);
  assert.equal(match('Manuscript','manuscript','unrelated'),false);
  assert.equal(match('Manuscript','manuscript',''),true);
});

test('project cards provide a native keyboard entry and named escaped controls without mutating data',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/views.js'),'utf8');
  const p={id:'qa" autofocus="x',name:'<World & Bible>',type:'rpg',status:'development',updatedAt:123};
  const original=JSON.stringify(p);
  const DAL={state:{projectOrder:[p.id],projects:{[p.id]:p}},getProjectWordCount:()=>({manuscript:1}),formatDate:()=> 'just now',escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')};
  DAL.formatNumber=String;
  vm.runInNewContext(source.slice(source.indexOf('DAL.renderProjects ='),source.indexOf('DAL.showSaveAsModal =')),{DAL});
  const html=DAL.renderProjects();
  assert.match(html,/<button type="button" class="project-open"/);
  assert.match(html,/aria-label="Open &lt;World &amp; Bible&gt;"/);
  assert.match(html,/aria-label="Settings for &lt;World &amp; Bible&gt;"/);
  assert.match(html,/aria-label="Export &lt;World &amp; Bible&gt;"/);
  assert.match(html,/aria-label="Delete &lt;World &amp; Bible&gt;"/);
  assert.ok(!html.includes('data-pid="qa" autofocus="x"'));assert.match(html,/RPG Adventure/);
  assert.equal(JSON.stringify(p),original);
  DAL.i18n={text:(key,fallback)=>key==='openProjectNamed'?'<Localized name>':fallback};
  assert.match(DAL.renderProjects(),/aria-label="&lt;Localized name&gt;"/);
});

test('workspace drawer keeps visual state, accessibility state and focus together',()=>{
  const attributes={},toggles=[];let focused='';
  const trigger={setAttribute:(key,value)=>{attributes[key]=value;},focus:()=>{focused='trigger';}};
  sandbox.document.querySelector=selector=>selector.includes('data-action')?trigger:{classList:{toggle:(name,value)=>toggles.push([name,value])}};
  sandbox.document.getElementById=()=>({querySelector:()=>({focus:()=>{focused='drawer';}})});
  sandbox.DAL.setWorkspaceDrawer('project',true);
  assert.equal(sandbox.DAL.projectSidebarOpen,true);
  assert.equal(attributes['aria-expanded'],'true');assert.equal(focused,'drawer');
  sandbox.DAL.setWorkspaceDrawer('project',false);
  assert.equal(attributes['aria-label'],'Open project sections');assert.equal(focused,'trigger');
  assert.deepEqual(toggles,[['project-nav-open',true],['project-nav-open',false]]);
  sandbox.DAL.setWorkspaceDrawer('chapters',false);
  assert.equal(attributes['aria-label'],'Open chapters');assert.equal(sandbox.DAL.chapterSidebarOpen,false);
  sandbox.DAL.i18n={text:(key,fallback)=>'Translated '+fallback};
  sandbox.DAL.setWorkspaceDrawer('chapters',true);assert.equal(attributes['aria-label'],'Translated Close chapters');
  sandbox.DAL.setWorkspaceDrawer('chapters',false);assert.equal(attributes['aria-label'],'Translated Open chapters');
  delete sandbox.DAL.i18n;
});

test('phone main menu traps keyboard focus and Escape defers to any open dialog',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/navigation-tools.js'),'utf8');
  const listeners={},calls=[];let focused='',modal=false;
  const controls=['close','dashboard','projects','library','settings'].map(id=>({id,tabIndex:0,getClientRects:()=>[{}],focus:()=>{focused=id;}}));
  const document={addEventListener:(name,handler)=>{listeners[name]=handler;},querySelector:()=>modal?{}:null,getElementById:()=>({querySelectorAll:()=>controls}),activeElement:controls[4]};
  const DAL={state:{sidebarCollapsed:false},BREAKPOINTS:{medium:960},fireAction:action=>calls.push(action)};
  vm.runInNewContext(source,{DAL,document,window:{innerWidth:360},getComputedStyle:()=>({visibility:'visible'})});
  function event(key,shiftKey=false){return {key,shiftKey,target:{id:''},preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};}
  let e=event('Tab');listeners.keydown(e);assert.equal(focused,'close');assert.equal(e.prevented,true);
  document.activeElement=controls[0];e=event('Tab',true);listeners.keydown(e);assert.equal(focused,'settings');
  e=event('Escape');listeners.keydown(e);assert.deepEqual(calls,['toggle-sidebar']);assert.equal(e.stopped,true);
  modal=true;e=event('Escape');listeners.keydown(e);assert.equal(calls.length,1);assert.equal(e.prevented,undefined);
});
