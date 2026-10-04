const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function audioApi(speech, probe, fullApi, audioConstructor) {
  class RejectedAudio {
    play() { return Promise.reject(new Error('playback blocked')); }
    pause() {}
  }
  const project = { id: 'project', assets: [], audio: { ambientVolume: 0.4, effectVolume: 0.8, voiceVolume: 1, muted: false } };
  const DAL = {
    state: { projects: { project } }, activeProject() { return project; },
    ensureAssets() {}, assetSrc() { return 'blob:test'; }, pushHistory() {}, saveState() {}, uid() { return 'id'; }
  };
  const sandbox = {
    DAL, Audio: audioConstructor || RejectedAudio, Blob, Promise, Date, Uint8Array,
    window: speech ? { speechSynthesis: speech, SpeechSynthesisUtterance: class {} } : {},
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    document: { createElement() { return probe || {}; }, getElementById() { return null; }, querySelector() { return null; } },
    URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} }, setTimeout, clearTimeout
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'assets-audio.js'), 'utf8'), sandbox, { filename: 'assets-audio.js' });
  DAL.assetSrc=()=> 'blob:test';
  DAL.audioBus.attach(project.id);
  return fullApi ? DAL : speech ? DAL.tts : DAL.audioBus;
}

test('automatic narration voice follows project language and prefers an installed voice',()=>{
  const voices=[{name:'English',lang:'en-US',default:true},{name:'French online',lang:'fr-FR',localService:false},{name:'French installed',lang:'fr-FR',localService:true}];
  const tts=audioApi({getVoices:()=>voices,cancel(){}});
  assert.equal(tts.pickVoice('', 'fr-FR').name,'French installed');
  assert.equal(tts.pickVoice('', 'fr-CA').name,'French installed');
  assert.equal(tts.pickVoice('English','fr-FR').name,'English');
  assert.equal(tts.pickVoice('', 'ja-JP'),null);
});

test('narration labels disclose local, network and unknown voice capability',()=>{
  const tts=audioApi({getVoices:()=>[],cancel(){}});
  assert.match(tts.voiceLabel({name:'Local',lang:'en',localService:true}),/Installed/);
  assert.match(tts.voiceLabel({name:'Remote',lang:'en',localService:false}),/internet/);
  assert.match(tts.voiceLabel({name:'Unknown',lang:'en'}),/depends on device/);
});

test('automatic browser narration never silently selects a network or unknown provider',()=>{
  let spoken=0,reason='';
  const tts=audioApi({getVoices:()=>[{name:'Provider',lang:'en',localService:false},{name:'Unknown',lang:'en'}],cancel(){},speak(){spoken++;}});
  assert.equal(tts.speak('Private prose',{language:'en',audio:{ttsEnabled:true,voiceVolume:1}},error=>{reason=error;}),false);
  assert.equal(spoken,0);assert.match(reason,/explicitly select/);
  assert.equal(tts.speak('Authorized prose',{language:'en',audio:{ttsEnabled:true,voiceVolume:1,ttsVoice:'Provider'}}),true);
  assert.equal(spoken,1);
  assert.equal(tts.pickVoice('Missing','en'),null);
});

test('audio metadata probe releases media and clears callbacks after completion',async()=>{
  let paused=0,removed=0,loaded=0;
  const probe={duration:42,pause(){paused++;},removeAttribute(name){assert.equal(name,'src');removed++;},load(){loaded++;}};
  const DAL=audioApi(null,probe,true),pending=DAL.probeAudioDuration('blob:metadata');
  const complete=probe.onloadedmetadata;
  complete();complete();
  assert.equal(await pending,42);
  assert.equal(paused,1);assert.equal(removed,1);assert.equal(loaded,1);
  assert.equal(probe.onloadedmetadata,null);assert.equal(probe.onerror,null);
});

test('audio metadata errors settle gracefully and release the probe',async()=>{
  let released=false;
  const probe={pause(){},removeAttribute(){released=true;},load(){}};
  const DAL=audioApi(null,probe,true),pending=DAL.probeAudioDuration('blob:broken');
  probe.onerror();assert.equal(await pending,0);assert.equal(released,true);
});

test('failed effect and voice playback release their audio channels', async () => {
  const bus = audioApi();

  assert.equal(await bus.playEffect({}, 'effect'), false);
  assert.equal(bus.effect, null);
  assert.equal(await bus.playVoice({}, 'voice'), false);
  assert.equal(bus.voice, null);
});

test('stopping a failed scene clip prevents delayed fallback narration',async()=>{
  let spoken=0,completed=0;
  const DAL=audioApi({getVoices:()=>[],cancel(){},speak(){spoken++;}},null,true);
  DAL.presentScene({id:'project',audio:{ttsEnabled:true,voiceVolume:1}},{audio:{voice:'clip'}},'Do not restart',()=>completed++);
  DAL.audioBus.stopVoice();
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(spoken,0);assert.equal(completed,0);
});

test('unavailable narration reports a capability error rather than silent success',()=>{
  const DAL=audioApi(null,null,true),messages=[];
  DAL.toast=message=>messages.push(message);
  let result;
  assert.equal(DAL.tts.speak('Prose',{audio:{}},error=>{result=error;}),false);
  assert.match(result,/unavailable on this device/);assert.equal(messages.length,1);assert.equal(DAL.tts.lastError,result);
});

test('a clip decode error completes once and cannot restart fallback narration',async()=>{
  let rejectPlayback,spoken=0,completed=0;
  class Clip {play(){return new Promise((resolve,reject)=>{rejectPlayback=reject;});}pause(){}}
  const DAL=audioApi({getVoices:()=>[],cancel(){},speak(){spoken++;}},null,true,Clip);
  DAL.presentScene({id:'project',audio:{ttsEnabled:true,voiceVolume:1}},{audio:{voice:'clip'}},'Prose',()=>completed++);
  DAL.audioBus.voice.onerror();rejectPlayback(new Error('Decode failed'));
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(completed,1);assert.equal(spoken,0);assert.equal(DAL.audioBus.voice,null);
});

test('stopped voice clips cannot complete newer playback and release their callbacks',async()=>{
  class Clip {play(){return Promise.resolve();}pause(){}}
  const DAL=audioApi({getVoices:()=>[],cancel(){}},null,true,Clip),bus=DAL.audioBus;
  let completed=0;
  await bus.playVoice({},'first',()=>completed++);
  const old=bus.voice,lateEnd=old.onended;
  await bus.playVoice({},'second',()=>completed++);
  const current=bus.voice;
  lateEnd();
  assert.equal(completed,0);assert.equal(bus.voice,current);assert.equal(old.onended,null);assert.equal(old.onerror,null);assert.equal(old.src,'');
  current.onended();assert.equal(completed,1);assert.equal(bus.voice,null);assert.equal(current.src,'');
});

test('read aloud preserves a long manuscript and completes exactly once', () => {
  const utterances = [];
  const speech = { getVoices() { return [{name:'Local',lang:'en',localService:true}]; }, cancel() {}, speak(utterance) { utterances.push(utterance); } };
  const tts = audioApi(speech);
  const text = 'A complete manuscript sentence. '.repeat(1600);
  let completions = 0;
  tts.speak(text, { audio: { ttsEnabled: true, voiceVolume: 1 } }, () => completions++);
  for (let index = 0; index < utterances.length; index++) {
    assert.ok(utterances[index].text.length <= 1200);
    utterances[index].onend();
    utterances[index].onend();
  }
  assert.equal(utterances.map(utterance => utterance.text).join(''), text);
  assert.equal(completions, 1);
  assert.equal(tts.speaking, false);
});

test('narration errors stop chunk progression and expose a useful failure reason', () => {
  const utterances=[];
  const tts=audioApi({getVoices(){return [{name:'Local',lang:'es-ES',localService:true}];},cancel(){},speak(utter){utterances.push(utter);}});
  let completed=0,reason;
  tts.speak('Words. '.repeat(500),{language:'es-ES',audio:{ttsEnabled:true,voiceVolume:1}},error=>{completed++;reason=error;});
  assert.equal(utterances[0].lang,'es-ES');
  utterances[0].onerror({error:'voice-unavailable'});
  utterances[0].onend();
  assert.equal(tts.speaking,false);assert.equal(utterances.length,1);assert.equal(completed,1);
  assert.match(reason,/Choose an installed voice/);assert.equal(tts.lastError,reason);
});

test('stopping narration ignores late browser callbacks', () => {
  const utterances = [];
  const speech = { getVoices() { return [{name:'Local',lang:'en',localService:true}]; }, cancel() {}, speak(utterance) { utterances.push(utterance); } };
  const tts = audioApi(speech);
  let completions = 0;
  tts.speak('Sentence. '.repeat(300), { audio: { ttsEnabled: true, voiceVolume: 1 } }, () => completions++);
  tts.stop();
  utterances[0].onend();
  utterances[0].onerror();
  assert.equal(utterances.length, 1);
  assert.equal(completions, 0);
  assert.equal(tts.speaking, false);
});

test('narration pause and resume preserve the current speech request', () => {
  let pauses = 0, resumes = 0, requests = 0;
  const speech = {
    getVoices() { return [{name:'Local',lang:'en',localService:true}]; }, cancel() {},
    speak() { requests++; }, pause() { pauses++; }, resume() { resumes++; }
  };
  const tts = audioApi(speech);
  assert.equal(tts.pause(), false);
  tts.speak('A passage to listen to.', { audio: { ttsEnabled: true, voiceVolume: 1 } });
  assert.equal(tts.pause(), true);
  assert.equal(tts.resume(), true);
  assert.equal(pauses, 1);
  assert.equal(resumes, 1);
  assert.equal(requests, 1);
  tts.stop();
  assert.equal(tts.resume(), false);
});

test('read-aloud pause waits for native acknowledgement and ignores acknowledgement after Stop',async()=>{
  const DAL=audioApi({getVoices:()=>[],cancel(){}},null,true);
  let acknowledge;DAL.tts.pause=()=>new Promise(resolve=>{acknowledge=resolve;});
  DAL.readAloud.speaking=true;
  const pausing=DAL.toggleReadAloudPause();
  assert.equal(DAL.readAloud.paused,false);
  assert.equal(await DAL.toggleReadAloudPause(),false);
  DAL.stopReadAloud();acknowledge(true);
  assert.equal(await pausing,false);assert.equal(DAL.readAloud.paused,false);assert.equal(DAL.readAloud.controlling,false);
});

test('a failed old resume cannot stop a newer reading session',async()=>{
  const DAL=audioApi({getVoices:()=>[],cancel(){}},null,true);
  let rejectResume;DAL.readAloud.speaking=true;DAL.readAloud.paused=true;
  DAL.audioBus.voice={play:()=>new Promise((resolve,reject)=>{rejectResume=reject;}),pause(){}};
  const resuming=DAL.toggleReadAloudPause();
  DAL.stopReadAloud();DAL.readAloud.speaking=true;
  rejectResume(new Error('Old clip failed'));
  assert.equal(await resuming,false);assert.equal(DAL.readAloud.speaking,true);
});
