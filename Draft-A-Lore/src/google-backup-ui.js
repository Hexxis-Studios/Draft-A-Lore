DAL = DAL || {};
(function(){
  var cloud={client:null,files:[],busy:'',ready:false,message:'',generation:0};
  function label(key,fallback){return DAL.uiLabel?DAL.uiLabel(key,fallback):DAL.escapeHtml(fallback);}
  function redraw(){if(DAL.currentTool==='sync'&&DAL.currentProjectId)DAL.render();}
  function connected(){return cloud.client&&cloud.client.token&&Date.now()<cloud.client.expiresAt-15000;}
  function client(){return cloud.client||(cloud.client=new DAL.GoogleBackupClient());}
  function validFiles(files){
    var seen=Object.create(null);
    return files.filter(function(file){
      if(!file||typeof file.id!=='string'||!/^[-\w]{1,200}$/.test(file.id)||seen[file.id]||!Number.isSafeInteger(Number(file.size))||Number(file.size)<1||Number(file.size)>512*1024*1024)return false;
      seen[file.id]=true;return true;
    });
  }
  async function run(name,job){
    if(cloud.busy){DAL.toast('Wait for the current Google backup operation to finish.','info');return;}
    cloud.busy=name;cloud.message='';var generation=cloud.generation;redraw();
    try{await job(generation);}catch(error){if(generation===cloud.generation)cloud.message=error&&error.message||'Google backup could not finish. Local projects are unchanged.';}
    finally{if(generation===cloud.generation){cloud.busy='';redraw();}}
  }
  var renderBase=DAL.renderSyncCenter;
  DAL.renderSyncCenter=function(proj){
    var html=renderBase(proj),platform=DAL.googleBackupPlatform(),active=connected(),disabled=cloud.busy?' disabled':'';
    var panel='<section class="card google-backup-panel" aria-labelledby="googleBackupTitle"><h3 id="googleBackupTitle">'+label('googleBackupTitle','Optional Google backup')+'</h3>';
    panel+='<p class="writer-muted">'+label('googleBackupDisclosure','Off by default. Connect only if you want to store project snapshots, their linked World Bible, and attachments in your own Google account. Only this app’s private backup area is accessible—not your ordinary Drive files. Your writing is not sent to the developer. Backups use your Google storage; local writing always works without Google.')+'</p>';
    panel+='<p class="writer-muted">'+label('googleBackupTesting','Preview: Google authorization is currently limited to approved test accounts. This is an explicit backup/restore feature, not live cloud editing or automatic synchronization.')+'</p>';
    if(platform==='unsupported'){
      panel+='<p>'+label('googleBackupUnsupported','Google sign-in cannot run directly from a downloaded HTML file or an unregistered website. Use the Windows launcher, Android app, or official hosted web app. You can still move complete projects with local .dalz bundles.')+'</p>';
    }else if(!active){
      if(!cloud.ready)panel+='<button class="btn" data-action="google-prepare"'+disabled+'>'+label('googleBackupPrepare','Enable Google sign-in for this session')+'</button>';
      else{
        panel+='<label class="google-backup-consent"><input type="checkbox" id="googleBackupConsent"'+disabled+'> <span>'+label('googleBackupConsent','I understand the optional Google connection and want access to my private app backups. No writing uploads until I choose Back up this project.')+'</span></label>';
        panel+='<button class="btn primary" data-action="google-connect"'+disabled+'>'+label('googleBackupConnect','Connect to Google')+'</button>';
      }
    }else{
      panel+='<div class="writer-tool-actions"><button class="btn primary" data-action="google-upload"'+disabled+'>'+label('googleBackupUpload','Back up this project')+'</button><button class="btn" data-action="google-refresh"'+disabled+'>'+label('googleBackupRefresh','Refresh backups')+'</button></div>';
      if(!cloud.files.length)panel+='<p>'+label('googleBackupEmpty','No completed backups are listed. Refresh to check your account.')+'</p>';
      else panel+='<ul class="google-backup-list">'+cloud.files.map(function(file){
        var date=Date.parse(file.createdTime),name=String(file.name||'Project backup').slice(0,200),size=(Number(file.size)/1048576).toFixed(2)+' MB';
        return '<li><div><strong>'+DAL.escapeHtml(name)+'</strong><span class="writer-muted">'+DAL.escapeHtml((Number.isFinite(date)?DAL.uiDate(date):'Unknown date')+' · '+size)+'</span></div><button class="btn" data-action="google-restore-copy" data-cloud-id="'+file.id+'"'+disabled+'>'+label('googleBackupRestore','Restore as a separate project')+'</button></li>';
      }).join('')+'</ul>';
    }
    if(cloud.busy)panel+='<p role="status" aria-live="polite">'+DAL.escapeHtml(cloud.busy)+'</p>';
    if(cloud.message)panel+='<p role="status" aria-live="polite">'+DAL.escapeHtml(cloud.message)+'</p>';
    if(active||cloud.busy)panel+='<button class="btn" data-action="google-disconnect"'+(cloud.busy==='Restoring backup…'?' disabled':'')+'>'+label('googleBackupDisconnect','Disconnect / cancel')+'</button>';
    panel+='<p class="writer-muted">'+label('googleBackupRetention','Every upload creates a new snapshot; interrupted uploads do not replace an older backup. Restoring always adds a separate project and never overwrites your current work. Disconnect clears this session; to revoke access or remove hidden backups, use Google Account permissions or Drive → Settings → Manage apps. Removing hidden data permanently deletes those backups.')+'</p></section>';
    return html.replace(/<\/div>$/,panel+'</div>');
  };
  DAL.registerActionHandler(function(action,el){
    if(action==='google-disconnect'){
      if(cloud.busy==='Restoring backup…')return true;
      cloud.generation++;client().disconnect();cloud.files=[];cloud.busy='';cloud.ready=false;cloud.message='Disconnected. No local projects or completed cloud backups were deleted.';redraw();return true;
    }
    if(action==='google-prepare'){
      run('Preparing Google sign-in…',async function(generation){await DAL.prepareGoogleBackup();if(generation===cloud.generation)cloud.ready=true;});return true;
    }
    if(action==='google-connect'){
      var consent=document.getElementById('googleBackupConsent');
      if(!consent||!consent.checked){DAL.toast('Read and accept the optional backup disclosure before connecting.','info');return true;}
      cloud.files=[];
      run('Connecting to Google…',async function(generation){await DAL.connectGoogleBackup(client());if(generation!==cloud.generation)return;cloud.files=validFiles(await client().list());});return true;
    }
    if(action==='google-refresh'){
      run('Reading backup list…',async function(generation){var files=await client().list();if(generation===cloud.generation)cloud.files=validFiles(files);});return true;
    }
    if(action==='google-upload'){
      var proj=DAL.state.projects[DAL.currentProjectId];if(!proj)return true;
      run('Uploading project snapshot…',async function(generation){
        var bytes=await DAL.projectBundleBytes(proj);
        if(generation!==cloud.generation)return;
        await client().upload(proj.name,new Blob([bytes],{type:'application/zip'}),proj.id);
        if(generation!==cloud.generation)return;
        cloud.message='Project snapshot uploaded. Local work is unchanged.';
        try{cloud.files=validFiles(await client().list());}catch(error){cloud.message='Project snapshot uploaded, but the backup list could not refresh. Refresh before uploading again. Local work is unchanged.';}
      });return true;
    }
    if(action==='google-restore-copy'){
      var id=el&&el.getAttribute('data-cloud-id');if(!cloud.files.some(function(file){return file.id===id;}))return true;
      run('Restoring backup…',async function(generation){
        var blob=await client().download(id);if(generation!==cloud.generation)return;
        var restored=await DAL.importProjectBundle(blob);
        if(!restored)throw new Error('The downloaded backup could not be imported. No existing project was replaced.');
        cloud.message='Backup imported as a separate project. Your existing projects are unchanged.';
      });return true;
    }
    return false;
  });
})();
