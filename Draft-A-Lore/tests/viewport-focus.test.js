const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function fixture(field, selection){
  const source = fs.readFileSync(path.join(__dirname, '../src/core.js'), 'utf8');
  const start = source.indexOf('DAL.keepFocusedControlVisible =');
  const end = source.indexOf('\n};', start) + 3;
  const DAL = {}, window = {innerHeight:400,getSelection:()=>selection};
  vm.runInNewContext(source.slice(start,end), {DAL,window,document:{activeElement:field}});
  return {DAL,window};
}
test('keyboard-obscured form input scrolls into view without changing its value',()=>{
  let scrolled;
  const field={tagName:'INPUT',value:'Preserved author',getBoundingClientRect:()=>({top:600,bottom:650}),scrollIntoView:options=>{scrolled=options;}};
  fixture(field).DAL.keepFocusedControlVisible();
  assert.equal(scrolled.block,'nearest');
  assert.equal(field.value,'Preserved author');
});
test('visible fields and non-editable controls are left untouched',()=>{
  for(const tagName of ['INPUT','BUTTON']){
    const field={tagName,getBoundingClientRect:()=>({top:50,bottom:100}),scrollIntoView:()=>assert.fail('unexpected scroll')};
    fixture(field).DAL.keepFocusedControlVisible();
  }
});
test('long manuscript scrolls only its caret without replacing the selection or prose',()=>{
  let collapsed=false;
  const field={isContentEditable:true,innerHTML:'Unchanged prose',scrollTop:200,contains:()=>true,getBoundingClientRect:()=>({top:100,bottom:390})};
  const selection={rangeCount:1,focusNode:{},getRangeAt:()=>({cloneRange:()=>({collapse:()=>{collapsed=true;},getBoundingClientRect:()=>({top:420,bottom:440,height:20})})})};
  fixture(field,selection).DAL.keepFocusedControlVisible();
  assert.equal(collapsed,true);
  assert.equal(field.scrollTop,262);
  assert.equal(field.innerHTML,'Unchanged prose');
});
test('unrelated selection and unavailable caret geometry do not move manuscript',()=>{
  const field={isContentEditable:true,scrollTop:200,contains:()=>false,getBoundingClientRect:()=>({top:100,bottom:390})};
  fixture(field,{rangeCount:1,focusNode:{}}).DAL.keepFocusedControlVisible();
  assert.equal(field.scrollTop,200);
});
