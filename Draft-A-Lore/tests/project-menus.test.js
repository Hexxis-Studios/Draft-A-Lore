const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
const interaction=fs.readFileSync(path.join(__dirname,'../src/interaction.js'),'utf8');
function setup(){
  const roots={},document={documentElement:{dir:'ltr'},getElementById:id=>roots[id],removeEventListener(){}};
  const DAL={THEMES:[{id:'aurora',name:'Aurora'}],state:{projects:{p:{id:'p',type:'dual'}}},currentProjectId:'p',clipboard:()=>[],escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')};
  const context={DAL,document,window:{innerWidth:360,innerHeight:800}};
  vm.runInNewContext(core.slice(core.indexOf('DAL.MENUS ='),core.indexOf('DAL.runAction =')),context);
  vm.runInNewContext(interaction.slice(interaction.indexOf('DAL.menuItemHtml ='),interaction.indexOf('DAL.openElementContextMenu =')),context);
  let focused;
  function row(label,disabled=false){return {label,disabled,attrs:{},isConnected:true,focus(){focused=this;},setAttribute(key,value){this.attrs[key]=value;},closest(){return this;},classList:{contains:()=>false}};}
  function menu(items){return {items,attrs:{},setAttribute(key,value){this.attrs[key]=value;},addEventListener(type,handler){this.handler=handler;},contains:item=>items.includes(item),querySelectorAll:()=>items.filter(item=>!item.disabled),querySelector(){return this.sub;},remove(){this.removed=true;}};}
  function key(menu,item,key){const event={target:item,key,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};menu.handler(event);return event;}
  return {DAL,document,roots,row,menu,key,focused:()=>focused};
}
test('every project menu label is translated at rendering time without changing actions, shortcuts or theme names',()=>{
  const api=setup(),original=JSON.stringify(api.DAL.MENUS),english=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/locales/en.json'),'utf8'));
  let count=0;
  function walk(items){for(const item of items){if(item.label&&item.action!=='set-theme'){assert.ok(item.labelKey,item.label);assert.equal(english[item.labelKey],item.label);count++;}if(item.submenu)walk(item.submenu);}}
  Object.values(api.DAL.MENUS).forEach(walk);assert.equal(count,50);
  let locale='first';api.DAL.i18n={text:(key,fallback)=>locale+' <'+fallback+'&>'};
  const first=api.DAL.menuHtml(api.DAL.menuItems('file'));locale='second';const second=api.DAL.menuHtml(api.DAL.menuItems('file'));
  assert.match(first,/first &lt;Save&amp;&gt;/);assert.match(second,/second &lt;Save&amp;&gt;/);assert.match(second,/data-do="manual-save"/);assert.match(second,/Ctrl\+S/);
  assert.equal(JSON.stringify(api.DAL.MENUS),original);assert.match(api.DAL.menuHtml(api.DAL.MENUS.view[0].submenu),/>Aurora<\/span>/);
});
test('project-type and unavailable-selection filtering survives menu label migration',()=>{
  const {DAL}=setup();DAL.state.projects.p.type='novel';assert.ok(!DAL.menuItems('tools').some(item=>item.action==='show-integrity'));
  DAL.state.projects.p.type='rpg';assert.ok(!DAL.menuItems('tools').some(item=>item.action==='writer-outline'));assert.ok(DAL.menuItems('tools').some(item=>item.action==='show-integrity'));
  const copy=DAL.menuItems('edit').find(item=>item.action==='edit-copy');assert.equal(copy.disabled,true);assert.equal(DAL.MENUS.edit.find(item=>item.action==='edit-copy').disabled,undefined);
});
test('menu navigation supports wraparound, Home/End, disabled skipping and focus restoration on Escape/Tab',()=>{
  const api=setup(),first=api.row('first'),disabled=api.row('disabled',true),last=api.row('last'),menu=api.menu([first,disabled,last]);api.DAL.bindMenuKeyboard(menu);
  api.key(menu,first,'ArrowUp');assert.equal(api.focused(),last);api.key(menu,last,'ArrowDown');assert.equal(api.focused(),first);
  api.key(menu,first,'End');assert.equal(api.focused(),last);api.key(menu,last,'Home');assert.equal(api.focused(),first);
  const trigger=api.row('File');api.DAL._menuTrigger=trigger;api.roots.dalMenuDropdown=menu;
  assert.equal(api.key(menu,first,'Escape').prevented,true);assert.equal(menu.removed,true);assert.equal(api.focused(),trigger);assert.equal(trigger.attrs['aria-expanded'],'false');
  api.DAL._menuTrigger=trigger;menu.removed=false;const tab=api.key(menu,first,'Tab');assert.notEqual(tab.prevented,true);assert.equal(menu.removed,true);assert.equal(api.focused(),trigger);
});
test('submenu backward arrow and Escape return only to their owner and reverse correctly in RTL',()=>{
  for(const rtl of [false,true])for(const key of [rtl?'ArrowRight':'ArrowLeft','Escape']){
    const api=setup(),owner=api.row('owner'),item=api.row('child'),submenu=api.menu([item]);api.document.documentElement.dir=rtl?'rtl':'ltr';submenu._menuParent=owner;api.DAL.bindMenuKeyboard(submenu);
    const event=api.key(submenu,item,key);assert.equal(event.prevented,true);assert.equal(submenu.removed,true);assert.equal(api.focused(),owner);assert.equal(owner.attrs['aria-expanded'],'false');
  }
});
test('forward submenu keyboard navigation focuses its first command for LTR and RTL',()=>{
  for(const rtl of [false,true]){
    const api=setup(),owner=api.row('owner'),child=api.row('child'),submenu=api.menu([child]),menu=api.menu([owner]);
    submenu.querySelector=()=>child;owner.classList.contains=()=>true;owner.click=()=>{menu.sub=submenu;};api.document.documentElement.dir=rtl?'rtl':'ltr';api.DAL.bindMenuKeyboard(menu);
    const event=api.key(menu,owner,rtl?'ArrowLeft':'ArrowRight');assert.equal(event.prevented,true);assert.equal(api.focused(),child);
  }
});
test('floating panels clamp negative left positions and overflowing right/bottom positions',()=>{
  const {DAL}=setup();
  function panel(rect){return {style:{},getBoundingClientRect:()=>rect};}
  const left=panel({left:-210,right:90,width:300,bottom:200,height:100});DAL.clampToViewport(left,-210,100,620);assert.equal(left.style.left,'52px');
  const right=panel({left:320,right:620,width:300,bottom:910,height:200});DAL.clampToViewport(right,320,710,320);assert.equal(right.style.left,'20px');assert.equal(right.style.top,'592px');
});

test('menu-opened dialogs return to their toolbar trigger, including after a layout rerender',()=>{
  for(const rerender of [false,true]){
    const api=setup(),trigger=api.row('Tools'),replacement=api.row('new Tools');trigger.getAttribute=()=> 'tools';api.DAL._menuTrigger=trigger;
    const menu=api.menu([]);api.roots.dalMenuDropdown=menu;
    const command={getAttribute:()=> 'show-readability'};
    const prefix=core.slice(core.indexOf('DAL.runAction ='),core.indexOf("  if(action === 'nav-dashboard')"));
    vm.runInNewContext(prefix+"if(action==='show-readability'){document.getElementById('testBackdrop').open();DAL._modalReturnFocus=el;}};",{DAL:api.DAL,document:api.document});
    api.roots.testBackdrop={open(){api.roots.modalBackdrop={remove(){delete api.roots.modalBackdrop;}};}};
    api.DAL.runAction('menu',command);assert.equal(api.DAL._modalReturnFocus,trigger);assert.equal(api.DAL._modalReturnMenuKey,'tools');
    if(rerender)trigger.isConnected=false;
    api.document.contains=node=>node.isConnected===true;api.document.querySelector=()=>replacement;
    vm.runInNewContext(core.slice(core.indexOf('DAL.closeModal ='),core.indexOf('DAL.infoIcon =')),{DAL:api.DAL,document:api.document});
    api.DAL.closeModal();assert.equal(api.focused(),rerender?replacement:trigger);assert.equal(api.DAL._modalReturnMenuKey,null);
  }
});
