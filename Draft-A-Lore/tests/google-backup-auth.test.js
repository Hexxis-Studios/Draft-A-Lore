const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function auth(window){
  const sandbox={DAL:{},window,AbortController,setTimeout,clearTimeout,document:{createElement:()=>({remove(){}}),head:{appendChild(){throw new Error('Unrequested Google network load');}}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/google-backup-auth.js'),'utf8'),sandbox);
  return sandbox.DAL;
}
test('Google auth makes no request at startup and rejects unsupported origins',async()=>{
  for(const location of [{protocol:'file:',hash:'',origin:'null'},{protocol:'https:',origin:'https://unregistered.example'}]){
    const DAL=auth({location});
    assert.equal(DAL.googleBackupPlatform(),'unsupported');
    await assert.rejects(DAL.connectGoogleBackup({}),/standalone HTML/);
  }
});
test('Google web authorization is restricted to the registered public and development origins',()=>{
  for(const origin of ['https://hexxis-studios.github.io','http://127.0.0.1:8766','http://localhost:8766']){
    const DAL=auth({location:{protocol:origin.split(':')[0]+':',origin}});
    const calls=[];
    DAL.connectGoogleBackup({connect:id=>{calls.push(id);return true;}});
    assert.equal(calls.length,1);assert.match(calls[0],/^886807251567-.+\.apps\.googleusercontent\.com$/);
  }
});
test('Android uses the actual injected Capacitor plugin rather than web OAuth',()=>{
  const plugin={connect(){},disconnect(){}};
  const DAL=auth({Capacitor:{Plugins:{GoogleBackup:plugin},isNativePlatform:()=>true,getPlatform:()=> 'android'},location:{origin:'https://localhost'}});
  let received;
  DAL.connectGoogleBackup({connectNative:value=>{received=value;}});
  assert.equal(DAL.googleBackupPlatform(),'android');assert.equal(received,plugin);
});
test('desktop pairing stays local, is removed from the URL, and is never a Google bearer token',()=>{
  let clean='';const capability='a'.repeat(43);
  const DAL=auth({location:{protocol:'file:',hash:'#dal-desktop=12345.'+capability,href:'file:///C:/DraftALore.html#dal-desktop=12345.'+capability},history:{replaceState:(state,title,url)=>{clean=url;}}});
  assert.equal(DAL.googleBackupPlatform(),'desktop');assert.equal(clean,'file:///C:/DraftALore.html');
});
test('malformed desktop pairing and failed URL cleanup fail closed',()=>{
  for(const hash of ['#dal-desktop=0.'+'a'.repeat(43),'#dal-desktop=65536.'+'a'.repeat(43),'#dal-desktop=12345.short','#dal-desktop=12345.'+'a'.repeat(43)]){
    const DAL=auth({location:{protocol:'file:',hash,href:'file:///C:/DraftALore.html'+hash},history:{replaceState(){throw new Error('Denied');}}});
    assert.equal(DAL.googleBackupPlatform(),'unsupported');
  }
});
