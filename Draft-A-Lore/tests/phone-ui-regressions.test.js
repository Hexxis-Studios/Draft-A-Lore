const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function storyApi(){
  let paths=[];
  const DAL={CTX:{},SELECT:{},PASTE:{},DROP:{},CLIP_LABELS:{},state:{projects:{}},escapeHtml:value=>String(value),uiLabel:(_key,fallback)=>fallback,toolLabel:(_key,fallback)=>fallback,registerAfterRender(){},registerActionHandler(){},pushHistory(){},saveState(){},render(){},toast(){}};
  const svg={firstChild:null,children:[],attributes:{},setAttribute(key,value){this.attributes[key]=value;},appendChild(node){this.children.push(node);}};
  const center={getBoundingClientRect:()=>({left:180,top:180,width:120,height:64})};
  const connected={getAttribute:key=>key==='data-rel-id'?'rel-1':'',getBoundingClientRect:()=>({left:320,top:90,width:120,height:64})};
  const container={getBoundingClientRect:()=>({left:0,top:0,width:640,height:420}),querySelectorAll:()=>[connected]};
  const document={addEventListener(){},getElementById(id){return{id:'relMapContainer',relMapContainer:container,relSvg:svg,relCenterNode:center}[id]||null;},querySelector(){return null;},querySelectorAll(){return[];},createElementNS(_ns,name){const attrs={};const path={name,attrs,setAttribute(key,value){attrs[key]=value;}};paths.push(path);return path;}};
  const sandbox={DAL,document,window:{addEventListener(){}},Date,setTimeout,clearTimeout,console};
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/story-tools.js'),'utf8'),sandbox);
  return{DAL,svg,paths};
}

test('Relationship Map renders one visible, correctly linked SVG line per connection',()=>{
  const {DAL,svg,paths}=storyApi(),project={characters:[{id:'a',name:'A'},{id:'b',name:'B'}],relationships:[{id:'rel-1',fromCharId:'a',toCharId:'b',category:'ally',type:'Ally'}]};
  DAL._relCenter='a';
  const html=DAL.renderRelationshipMap(project);
  assert.match(html,/data-center-id="a"/);assert.match(html,/data-rel-id="rel-1"/);
  DAL.drawRelationshipLines(project);
  assert.equal(paths.length,1);assert.equal(svg.children.length,1);assert.equal(paths[0].attrs.stroke,'var(--c-info)');assert.match(paths[0].attrs.d,/^M[0-9.]+,[0-9.]+ L[0-9.]+,[0-9.]+$/);
});

test('phone CSS keeps long cover titles and Playthrough controls inside the viewport',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../src/styles.css'),'utf8'),adventure=fs.readFileSync(path.join(__dirname,'../src/adventure-tools.js'),'utf8');
  assert.match(css,/\.book-cover-title[^}]*overflow-wrap:anywhere/);
  assert.match(adventure,/class="playtest-toolbar"><div class="playtest-toolbar-actions"/);
  assert.match(css,/\.playtest-toolbar-settings \.form-select\{flex:1 1 180px;width:auto;min-width:0\}/);
  assert.match(css,/\.rel-map-container\{touch-action:pan-y\}/);
});

test('small phone typing gets the available space without removing editor tools',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../src/styles.css'),'utf8');
  assert.match(css,/\.editor-area:focus-within \.editor-scroll-hint[^}]*display:none/);
  assert.ok(css.includes('.editor-area:focus-within .panel:has([data-panel="audio-bind-chapter"]){display:none}'));
  assert.match(css,/\.editor-surface\{flex:1 1 0;min-height:0/);
  assert.match(css,/\.editor-area \.editor-surface \.content-editable\{min-height:160px/);
});
