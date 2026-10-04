const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function app(){
  const actions=[],messages=[],calls=[];let consent=false,files=[];
  const project={id:'local',name:'Book',chapters:[{id:'chapter-five',order:5,contentHTML:'Original prose'}]};
  const DAL={state:{projects:{local:project}},currentProjectId:'local',currentTool:'sync',render(){},renderSyncCenter:()=>'<div class="sync-center"><p>Folder tools remain here</p></div>',
    registerActionHandler:handler=>actions.push(handler),escapeHtml:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),uiDate:()=> '2026-10-04',toast:(message,type)=>messages.push({message,type}),
    googleBackupPlatform:()=> 'web',prepareGoogleBackup:async()=>true,connectGoogleBackup:async client=>{client.authorize('ui-test-token',3600);},projectBundleBytes:async()=>new Uint8Array([80,75,1])};
  const sandbox={DAL,window:{fetch:async(url,options)=>{calls.push({url,options});if(url.includes('uploadType=resumable'))return new Response('',{headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=one'}});if(options.method==='PUT')return Response.json({id:'uploaded',size:'3'});return Response.json({files});}},URL,URLSearchParams,Blob,AbortController,Date,setTimeout,clearTimeout,document:{getElementById:()=>({checked:consent})}};
  for(const file of ['google-backup.js','google-backup-ui.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),sandbox);
  return {DAL,project,messages,calls,consent:value=>{consent=value;},files:value=>{files=value;},action:name=>actions[0](name,{getAttribute:()=> 'remote'}),idle:async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));}};
}
test('optional cloud UI retains folder tools and makes no startup network request',()=>{
  const fixture=app();const html=fixture.DAL.renderSyncCenter(fixture.project);
  assert.match(html,/Folder tools remain here/);assert.match(html,/Off by default/);assert.match(html,/data-action="google-prepare"/);assert.equal(fixture.calls.length,0);
});
test('connecting requires user disclosure acceptance and never uploads content',async()=>{
  const fixture=app();fixture.action('google-connect');await fixture.idle();assert.equal(fixture.calls.length,0);
  assert.match(fixture.messages[0].message,/accept/);
  fixture.consent(true);fixture.action('google-connect');await fixture.idle();
  assert.equal(fixture.calls.length,1);assert.match(fixture.calls[0].url,/spaces=appDataFolder/);assert.equal(fixture.calls[0].options.body,undefined);
  assert.equal(JSON.stringify(fixture.DAL.state).includes('ui-test-token'),false);
});
test('cloud backup is explicit, immutable, and does not modify local project metadata',async()=>{
  const fixture=app(),before=JSON.stringify(fixture.DAL.state);fixture.consent(true);fixture.action('google-connect');await fixture.idle();
  fixture.action('google-upload');await fixture.idle();
  const create=fixture.calls.find(call=>call.url.includes('uploadType=resumable'));
  assert.ok(create);assert.equal(create.options.method,'POST');assert.equal(JSON.parse(create.options.body).appProperties.projectId,'local');
  assert.equal(JSON.stringify(fixture.DAL.state),before);assert.equal(fixture.calls.filter(call=>call.options.method==='PUT').length,1);
});
test('cloud backup names are escaped and disconnection clears former-account metadata',async()=>{
  const fixture=app();fixture.files([{id:'remote',name:'<img src=x onerror=alert(1)>',size:'3',createdTime:'2026-10-04T00:00:00Z'}]);fixture.consent(true);fixture.action('google-connect');await fixture.idle();
  const html=fixture.DAL.renderSyncCenter(fixture.project);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x/);
  fixture.action('google-disconnect');await fixture.idle();
  assert.doesNotMatch(fixture.DAL.renderSyncCenter(fixture.project),/&lt;img/);assert.equal(JSON.stringify(fixture.DAL.state).includes('ui-test-token'),false);
});
