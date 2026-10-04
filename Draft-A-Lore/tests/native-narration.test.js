const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const DAL={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/native-narration.js'),'utf8'),{DAL,Promise,Number,Object,Array,Error});
const voices=[{name:'Local',lang:'en-US',localService:true},{name:'Network',lang:'en-US',localService:false}];
const project={language:'en-US',audio:{ttsEnabled:true,voiceVolume:1}};

test('Android facade discovers voices once and delegates playback without browser speech',async()=>{
  let discovery=0,renders=0,spoken='';
  const plugin={capabilities:async()=>{discovery++;return {voices,pause:true};},stop:async()=>{},speak:async input=>{spoken+=input.text;}};
  const app={currentTool:'assets',ensureAssets:()=>{},render:()=>{renders++;tts.warm();}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/native-narration.js'),'utf8'),{DAL:app,window:{Capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'android',Plugins:{Narration:plugin}}},Promise,Number,Object,Array,Error});
  const tts={speaking:false};assert.equal(app.installNativeNarration(tts),true);
  tts.warm();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(discovery,1);assert.equal(renders,1);assert.equal(tts.loading,false);assert.equal(tts.voices().length,2);
  await new Promise(resolve=>tts.speak('Full prose',project,resolve));assert.equal(spoken,'Full prose');assert.equal(tts.speaking,false);
});

test('native installer leaves web speech unchanged',()=>{
  const app={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/native-narration.js'),'utf8'),{DAL:app,window:{},Promise,Number,Object,Array,Error});
  const tts={available:()=>true};const original=tts.available;
  assert.equal(app.installNativeNarration(tts),false);assert.equal(tts.available,original);
});

test('native narration reads all text sequentially without splitting surrogate pairs',async()=>{
  const parts=[],plugin={capabilities:async()=>({voices}),stop:async()=>{},speak:async input=>{parts.push(input);}};
  const narrator=DAL.createNativeNarrator(plugin),text='x'.repeat(1199)+'😀'+'y'.repeat(3000);
  await new Promise(resolve=>narrator.speak(text,project,resolve));
  assert.equal(parts.map(part=>part.text).join(''),text);assert.ok(parts.every(part=>part.text.length<=1200));
  assert.ok(parts.every(part=>!/[\uD800-\uDBFF]$/.test(part.text)));
  assert.ok(parts.every(part=>part.online===false));assert.equal(narrator.speaking,false);
});

test('stopping native narration invalidates late completion and prevents the next segment',async()=>{
  let finish,started;const start=new Promise(resolve=>{started=resolve;});let count=0,completed=0;
  const plugin={capabilities:async()=>({voices}),stop:async()=>{},speak:()=>{count++;started();return new Promise(resolve=>{finish=resolve;});}};
  const narrator=DAL.createNativeNarrator(plugin);
  narrator.speak('x'.repeat(2400),project,()=>completed++);await start;
  await narrator.stop();finish();await Promise.resolve();await Promise.resolve();
  assert.equal(count,1);assert.equal(completed,0);assert.equal(narrator.speaking,false);
});

test('native narration permits network voices only when explicitly selected',async()=>{
  let input;
  const narrator=DAL.createNativeNarrator({capabilities:async()=>({voices}),stop:async()=>{},speak:async value=>{input=value;}});
  await new Promise(resolve=>narrator.speak('Prose',{audio:{ttsVoice:'Network'}},resolve));
  assert.equal(input.online,true);assert.equal(input.voice,'Network');
});

test('native voice discovery and playback failures settle with useful errors',async()=>{
  const warnings=[],narrator=DAL.createNativeNarrator({capabilities:async()=>{throw new Error('No engine');},stop:async()=>{}},message=>warnings.push(message));
  const error=await new Promise(resolve=>narrator.speak('Prose',project,resolve));
  assert.equal(error,'No engine');assert.equal(narrator.available(),false);assert.equal(narrator.speaking,false);assert.equal(warnings.length,1);
});

test('native pause and resume await device acknowledgement without completing narration',async()=>{
  let started,finish;const start=new Promise(resolve=>{started=resolve;});const controls=[];
  const narrator=DAL.createNativeNarrator({capabilities:async()=>({voices,pause:true}),stop:async()=>{},speak:()=>{started();return new Promise(resolve=>{finish=resolve;});},pause:async()=>{controls.push('pause');},resume:async()=>{controls.push('resume');}});
  let completed=0;narrator.speak('Prose',project,()=>completed++);await start;
  assert.equal(await narrator.pause(),true);assert.equal(narrator.paused,true);assert.equal(narrator.speaking,true);assert.equal(completed,0);
  assert.equal(await narrator.resume(),true);assert.equal(narrator.paused,false);assert.deepEqual(controls,['pause','resume']);
  finish();await Promise.resolve();await Promise.resolve();assert.equal(completed,1);
});

test('native Stop invalidates a pause acknowledgement arriving later',async()=>{
  let started,pauseComplete;const start=new Promise(resolve=>{started=resolve;});
  const narrator=DAL.createNativeNarrator({capabilities:async()=>({voices,pause:true}),stop:async()=>{},speak:()=>{started();return new Promise(()=>{});},pause:()=>new Promise(resolve=>{pauseComplete=resolve;})});
  narrator.speak('Prose',project);await start;
  const pausing=narrator.pause();await narrator.stop();pauseComplete();
  assert.equal(await pausing,false);assert.equal(narrator.paused,false);assert.equal(narrator.speaking,false);
});

test('synchronous bridge failures and malformed capabilities remain recoverable',async()=>{
  let mode='throw';
  const narrator=DAL.createNativeNarrator({capabilities(){if(mode==='throw')throw new Error('Bridge unavailable');if(mode==='invalid')return null;return {voices,pause:true};},stop:async()=>{}});
  assert.equal(await narrator.refresh(),false);assert.equal(narrator.lastError,'Bridge unavailable');
  mode='invalid';assert.equal(await narrator.refresh(),false);assert.match(narrator.lastError,/invalid narration capabilities/);
  mode='valid';assert.equal(await narrator.refresh(),true);assert.equal(narrator.lastError,'');
});
