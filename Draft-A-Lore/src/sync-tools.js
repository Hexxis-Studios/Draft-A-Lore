/* Draft A Lore — private folder-based cross-device synchronization */
DAL = DAL || {};
DAL._syncConflicts={};
DAL.validateFolderAssets=async function(proj){
  var ids=new Set();
  for(var folder of DAL.ASSET_FOLDERS||[]){
    for(var asset of (proj.assets||{})[folder.key]||[]){
      if(!asset||!asset.id||ids.has(asset.id))throw new Error('The folder contains duplicate or invalid asset records. The project was not replaced.');ids.add(asset.id);
      if(asset.inline)continue;
      var stored=DAL.blobStore&&await DAL.blobStore.get(asset.id);
      if(!stored||!stored.blob)throw new Error('Missing asset “'+(asset.name||asset.id)+'”. The project was not replaced.');
    }
  }
};

DAL.readLinkedProject=async function(proj,handle){
  var text='';
  if(handle.native){var plugin=DAL.nativeFolderPlugin(),result=await plugin.readTextFile({projectId:proj.id,path:'project.json'});if(!result||!result.exists)return null;text=result.text||'';}
  else{try{var fileHandle=await handle.getFileHandle('project.json'),file=await fileHandle.getFile();if(file.size>32*1024*1024)throw new Error('The linked project.json exceeds the 32 MB safety limit.');text=await file.text();}catch(error){if(error&&error.name==='NotFoundError')return null;throw error;}}
  if(text.length>32*1024*1024)throw new Error('The linked project.json exceeds the 32 MB safety limit.');
  if(!text.trim())return null;
  var data=JSON.parse(text,function(key,value){if(key==='__proto__'||key==='constructor'||key==='prototype')throw new Error('The linked project contains an unsafe property.');return value;}),remote=data&&data.project?data.project:data;
  if(!remote||Array.isArray(remote)||typeof remote!=='object'||typeof remote.id!=='string'||!remote.id||!Array.isArray(remote.chapters))throw new Error('The linked project.json is not a Draft A Lore project.');
  return{data:data,project:remote,updatedAt:Number(remote.updatedAt)||0};
};
DAL.folderRevision=function(remote){return JSON.stringify({project:remote.project,linkedBible:remote.data&&remote.data.linkedBible});};
DAL.prepareFolderSync=async function(proj,handle){
  if(handle.checkedInitial&&proj.sync.mode!=='shared')return true;
  var remote=await DAL.readLinkedProject(proj,handle);
  if(!remote){handle.checkedInitial=true;return true;}
  var sameId=remote.project.id===proj.id,known=Number(proj.sync.lastRemoteUpdatedAt)||0;
  var revision=DAL.folderRevision(remote);
  if(sameId&&(handle.remoteRevision?handle.remoteRevision===revision:(remote.updatedAt===known||remote.updatedAt===Number(proj.updatedAt)))){handle.checkedInitial=true;handle.remoteRevision=revision;proj.sync.lastRemoteUpdatedAt=remote.updatedAt;return true;}
  DAL._syncConflicts[proj.id]=remote;DAL.folderSyncHealth.status='conflict';DAL.folderSyncHealth.lastError=sameId?'The linked copy changed on another device.':'That folder contains a different project.';handle.checkedInitial=false;if(DAL.currentTool==='sync')DAL.render();else DAL.toast((DAL.i18n?DAL.i18n.text("ui_Device_Sync_needs_your_choice_before_it_wr_49fb7d3","Device Sync needs your choice before it writes to the linked folder."):"Device Sync needs your choice before it writes to the linked folder."),'warning');return false;
};
DAL.finishFolderSync=function(proj,handle,written){written=written||proj;handle.checkedInitial=true;proj.sync.lastRemoteUpdatedAt=Number(written.updatedAt)||Date.now();proj.sync.lastLocalUpdatedAt=Number(written.updatedAt)||Date.now();delete DAL._syncConflicts[proj.id];};
DAL.keepLocalFolderVersion=async function(proj,conflict,handle){
  if(DAL._folderRestoreBusy||DAL._workspaceRestoreBusy)throw new Error('Wait for the current restore operation to finish.');
  if(!handle||DAL.folderHandles[proj.id]!==handle||DAL.state.projects[proj.id]!==proj)throw new Error('The folder is no longer linked.');
  DAL._folderRestoreBusy=true;
  var queued=false;
  try{
  var fresh=await DAL.readLinkedProject(proj,handle);
  if(!fresh||DAL.folderRevision(fresh)!==DAL.folderRevision(conflict)){
    if(fresh)DAL._syncConflicts[proj.id]=fresh;
    handle.checkedInitial=false;throw new Error('The folder changed since you reviewed it. Check the new copy before overwriting.');
  }
  var name='project-before-overwrite-'+Date.now()+'-'+DAL.uid('recovery')+'.json',text=JSON.stringify(fresh.data,null,2);
  if(handle.native){var plugin=DAL.nativeFolderPlugin();if(!plugin)throw new Error('Android folder access is unavailable.');await plugin.syncTextFiles({projectId:proj.id,files:[{path:name,text:text,mime:'application/json'}]});}
  else await DAL.writeFile(handle,name,text);
  if(DAL.state.projects[proj.id]!==proj||DAL.folderHandles[proj.id]!==handle)throw new Error('The project or linked folder changed. Nothing was overwritten.');
  handle.remoteRevision=DAL.folderRevision(fresh);handle.checkedInitial=false;proj.sync.lastRemoteUpdatedAt=fresh.updatedAt;
  if(await DAL.saveState(true)!==true)throw new Error('The overwrite choice could not be saved. Nothing was overwritten.');
  delete DAL._syncConflicts[proj.id];queued=true;if(DAL.currentProjectId===proj.id)DAL.render();
  DAL.toast('Folder write queued. The previous project metadata was saved as '+name+'. Existing asset files are retained.','info');
  }finally{DAL._folderRestoreBusy=false;if(queued)DAL.queueFolderSync();}
};

DAL.nativePullAssets=async function(proj){
  var plugin=DAL.nativeFolderPlugin();if(!plugin||!DAL.importAssetFile)throw new Error('Android folder access is unavailable. Your local project was not replaced.');var count=0;
  for(var f=0;f<DAL.ASSET_FOLDERS.length;f++){
    var folder=DAL.ASSET_FOLDERS[f],records=((proj.assets||{})[folder.key]||[]).slice();
    for(var i=0;i<records.length;i++){
      var old=records[i];
      if(old.inline)continue;
      if(!old.name||/[\\/]/.test(old.name)||old.name==='.'||old.name==='..')throw new Error('An asset has an unsafe filename.');
      var result=await plugin.readFile({projectId:proj.id,path:'Assets/'+folder.dir+'/'+old.name});
      if(!result||!result.exists)throw new Error('The linked folder is missing asset “'+old.name+'”. Your local project was not replaced.');
      var raw=atob(result.base64||''),bytes=new Uint8Array(raw.length);
      for(var b=0;b<raw.length;b++)bytes[b]=raw.charCodeAt(b);
      var file=new File([bytes],old.name,{type:old.mime||'application/octet-stream'}),record=await DAL.importAssetFile(proj,file,folder.key);
      if(!record||!record.id)throw new Error('Could not store asset “'+old.name+'”.');
      DAL.rebindAsset(proj,old.id,record.id);count++;
    }
  }
  return count;
};
DAL.applyRemoteProject=async function(local,remote,handle){
  if(!local||DAL.state.projects[local.id]!==local||!handle||!remote||!remote.project)throw new Error('The selected folder conflict is no longer available. Check the folder again.');
  if(DAL._folderRestoreBusy)throw new Error('A folder restore is already in progress.');
  if(DAL._workspaceRestoreBusy)throw new Error('Wait for the workspace restore to finish before opening a folder version.');
  DAL._folderRestoreBusy=true;
  var previouslySuppressed=DAL._suppressFolderSync;DAL._suppressFolderSync=true;
  var incoming,addedBible=null,appliedSignature='',localId=local.id,before,signature,assets=0;
  try{
    if(DAL.currentProjectId===local.id&&DAL.currentTool==='manuscript'&&DAL.saveChapterContent)DAL.saveChapterContent();
    before=DAL.snapshotProject(local);signature=JSON.stringify(before);
    incoming=DAL.adoptImportedProject?DAL.adoptImportedProject(remote.data&&remote.data.project?remote.data:{project:remote.project,linkedBible:remote.data&&remote.data.linkedBible},true):DAL.normalizeProject(DAL.clone(remote.project),true);
    incoming.id=localId;incoming.linkedFolderName=local.linkedFolderName;incoming.history=(local.history||[]).slice();incoming.redoStack=[];
    incoming.sync={mode:local.sync.mode,lastRemoteUpdatedAt:remote.updatedAt,lastLocalUpdatedAt:remote.updatedAt};
    if(incoming._importBible){addedBible=incoming._importBible;delete incoming._importBible;}
    local.versions=local.versions||[];local.versions.push({ts:Date.now(),auto:false,name:'Before opening folder version',snapWords:DAL.getProjectWordCount(local).total,data:before});DAL.trimVersions(local);
    if(await DAL.saveState(true)!==true)throw new Error('Your recovery copy could not be saved. The local project was not replaced.');
    function unchanged(){return DAL.state.projects[localId]===local&&JSON.stringify(DAL.snapshotProject(local))===signature;}
    if(!unchanged())throw new Error('The local project changed while saving recovery. Nothing was replaced.');
    if(handle.native){
      incoming.id=localId;assets=await DAL.nativePullAssets(incoming);
    }else if(DAL.readAssetsFolder)assets=await DAL.readAssetsFolder(handle,incoming);
    await DAL.validateFolderAssets(incoming);
    if(!unchanged())throw new Error('The local project changed while loading folder assets. Nothing was replaced.');
    var fresh=await DAL.readLinkedProject(local,handle);
    if(!fresh||JSON.stringify(fresh.project)!==JSON.stringify(remote.project)||JSON.stringify(fresh.data&&fresh.data.linkedBible)!==JSON.stringify(remote.data&&remote.data.linkedBible))throw new Error('The folder changed while its files were loading. Check it again before restoring.');
    if(!unchanged())throw new Error('The local project changed while checking the folder. Nothing was replaced.');
    incoming.versions=local.versions.slice();incoming.history.push(before);if(incoming.history.length>DAL.HISTORY_MAX)incoming.history.shift();incoming.historyIndex=incoming.history.length-1;
    if(addedBible){DAL.state.bibles[addedBible.id]=addedBible;DAL.state.bibleOrder.push(addedBible.id);}
    DAL.state.projects[localId]=incoming;appliedSignature=JSON.stringify(DAL.snapshotProject(incoming));
    if(await DAL.saveState(true)!==true)throw new Error('The folder version could not be saved on this device.');
    handle.checkedInitial=true;delete DAL._syncConflicts[localId];
    if(DAL.currentProjectId===localId)DAL.render();
    DAL.toast('Folder version opened'+(assets?' with '+assets+' assets':'')+(addedBible?'. Its world was imported separately; other connected books are unchanged.':''),'success');return incoming;
  }catch(error){
    if(appliedSignature&&DAL.state.projects[localId]===incoming){
      if(JSON.stringify(DAL.snapshotProject(incoming))===appliedSignature){
        DAL.state.projects[localId]=local;
        if(addedBible&&DAL.state.bibles[addedBible.id]===addedBible&&!DAL.state.projectOrder.some(function(id){return id!==localId&&DAL.state.projects[id]&&DAL.state.projects[id].bibleId===addedBible.id;})){delete DAL.state.bibles[addedBible.id];DAL.state.bibleOrder=DAL.state.bibleOrder.filter(function(id){return id!==addedBible.id;});}
      }else error=new Error('Folder restore could not be saved. Newer edits are kept in memory; export a backup before closing. Your prior project is in Version History.');
    }
    throw error;
  }finally{DAL._suppressFolderSync=previouslySuppressed;DAL._folderRestoreBusy=false;}
};

DAL.importRemoteFolderCopy=async function(local,remote,handle){
  if(!local||!remote||!handle||DAL.state.projects[local.id]!==local)throw new Error('Check the linked folder again before importing.');
  if(DAL._folderRestoreBusy||DAL._workspaceRestoreBusy)throw new Error('Wait for the current restore operation to finish.');
  DAL._folderRestoreBusy=true;
  var workspace=DAL.state;
  try{
  var copy=DAL.adoptImportedProject(remote.data&&remote.data.project?remote.data:{project:remote.project,linkedBible:remote.data&&remote.data.linkedBible},true),assets=0;
  if(handle.native){var newId=copy.id;copy.id=local.id;try{assets=await DAL.nativePullAssets(copy);}finally{copy.id=newId;}}
  else if(DAL.readAssetsFolder)assets=await DAL.readAssetsFolder(handle,copy);
  await DAL.validateFolderAssets(copy);
  if(DAL.state!==workspace||DAL.state.projects[local.id]!==local||DAL.folderHandles[local.id]!==handle)throw new Error('The workspace, project or linked folder changed while importing. No copy was added.');
  return await DAL.finishImportedProject(copy,assets);
  }finally{DAL._folderRestoreBusy=false;}
};

DAL.renderSyncCenter=function(proj){
  var handle=DAL.folderHandles[proj.id],conflict=DAL._syncConflicts[proj.id],health=DAL.folderSyncHealth,html="<div class=\"sync-center\"><div class=\"section-header\"><div><div class=\"section-title\">"+DAL.uiLabel("tool_sync","Device Sync")+"</div><p class=\"writer-muted\">"+DAL.uiLabel("ui_Keep_the_same_project_structure_across_pho_f76bb94","Keep the same project structure across phone, tablet, web, and desktop through a folder you choose. Draft A Lore has no account and never receives your files.")+"</p></div></div>";
  html+='<div class="card sync-status"><div class="sync-status-dot '+(handle?'linked':'')+'"></div><div><strong>'+(handle?'Linked to '+DAL.escapeHtml(handle.name||proj.linkedFolderName||'folder'):'No folder linked')+'</strong><p class="writer-muted">'+(handle?(health.status==='conflict'?'A choice is required before syncing.':health.lastSyncedAt?'Last synced '+DAL.uiDate(health.lastSyncedAt):'Ready to check the folder.'):'Choose a local folder or a folder from a provider already available in your device picker.')+'</p></div><div class="writer-tool-actions">'+(handle?"<button class=\"btn\" data-action=\"sync-check\">"+DAL.uiLabel("ui_Check_folder_6179513","Check folder")+"</button><button class=\"btn primary\" data-action=\"sync-push\">"+DAL.uiLabel("ui_Save_to_folder_fb96ba3","Save to folder")+"</button><button class=\"btn danger\" data-action=\"sync-unlink\">"+DAL.uiLabel("ui_Disconnect_acfc5be","Disconnect")+"</button>":'<button class="btn primary" data-action="link-folder" data-pid="'+DAL.escapeHtml(proj.id)+"\">"+DAL.uiLabel("ui_Choose_folder_3db7410","Choose folder")+"</button>")+'</div></div>';
  html+="<div class=\"card sync-mode\"><h3>"+DAL.uiLabel("ui_Sync_behavior_0f9fac8","Sync behavior")+"</h3><label><input type=\"radio\" name=\"syncMode\" data-sync-mode value=\"backup\""+(proj.sync.mode==='backup'?' checked':'')+"> <strong>"+DAL.uiLabel("ui_Device_backup_a6fed16","Device backup")+"</strong><span>"+DAL.uiLabel("ui_Writes_this_project_to_the_chosen_folder_A_e35e3ac","Writes this project to the chosen folder. After the first safety check, this device remains the source.")+"</span></label><label><input type=\"radio\" name=\"syncMode\" data-sync-mode value=\"shared\""+(proj.sync.mode==='shared'?' checked':'')+"> <strong>"+DAL.uiLabel("ui_Shared_across_devices_65d752a","Shared across devices")+"</strong><span>"+DAL.uiLabel("ui_Checks_the_folder_before_every_write_and_s_65925b2","Checks the folder before every write and stops on conflicts. Use the same provider folder on each device.")+"</span></label></div>";
  if(conflict){var remoteName=conflict.project.name||'Untitled',different=conflict.project.id!==proj.id;html+='<div class="card sync-conflict"><h3>'+(different?'Another project is already in this folder':'Both copies changed')+"</h3><p>"+DAL.uiLabel("ui_The_folder_contains_f886095","The folder contains ")+"<strong>"+DAL.escapeHtml(remoteName)+'</strong>, updated '+DAL.uiDate(conflict.updatedAt||0)+". Nothing was overwritten.</p><div class=\"writer-tool-actions\"><button class=\"btn primary\" data-action=\"sync-use-folder\">"+DAL.uiLabel("ui_Use_folder_version_58b6c46","Use folder version")+"</button><button class=\"btn\" data-action=\"sync-keep-local\">"+DAL.uiLabel("ui_Keep_this_device_and_overwrite_folder_7fc301b","Keep this device and overwrite folder")+"</button><button class=\"btn\" data-action=\"sync-import-copy\">"+DAL.uiLabel("ui_Import_folder_version_as_a_separate_projec_cf03e4d","Import folder version as a separate project")+"</button></div></div>";}
  html+="<div class=\"card\"><h3>"+DAL.uiLabel("ui_Portable_alternative_3c2b9ca","ZIP backup")+"</h3><p class=\"writer-muted\">"+DAL.uiLabel("ui_A_dalz_bundle_carries_the_project_shared_B_5e25ab3","Save one ZIP file with this project, its shared Bible, artwork, and audio.")+"</p><button class=\"btn\" data-action=\"save-project-bundle\" data-pid=\""+DAL.escapeHtml(proj.id)+"\">"+DAL.uiLabel("ui_Save_project_bundle_dalz__16c380f","Export project ZIP")+"</button><button class=\"btn\" data-action=\"import-project-bundle\">"+DAL.uiLabel("ui_Import_project_bundle_277ed75","Import project ZIP")+"</button></div></div>";return html;
};

DAL._syncClickBase=DAL.handleStoryClick;
DAL.handleStoryClick=function(action,el,e){
  var proj=DAL.state.projects[DAL.currentProjectId],handle=proj&&DAL.folderHandles[proj.id],conflict=proj&&DAL._syncConflicts[proj.id];
  if(action==='sync-check'&&handle){handle.checkedInitial=false;DAL.prepareFolderSync(proj,handle).then(function(ok){if(ok)DAL.toast((DAL.i18n?DAL.i18n.text("ui_The_linked_folder_is_current__fad4db8","The linked folder is current."):"The linked folder is current."),'success');DAL.render();}).catch(function(error){DAL.folderSyncHealth.status='error';DAL.folderSyncHealth.lastError=error.message;DAL.render();DAL.toast('Could not check folder: '+error.message,'error');});return;}
  if(action==='sync-push'&&handle){DAL.queueFolderSync();DAL.toast((DAL.i18n?DAL.i18n.text("ui_Folder_sync_queued_2843a71","Folder sync queued"):"Folder sync queued"),'info');return;}
  if(action==='sync-unlink'&&proj){
    if(DAL._folderRestoreBusy){DAL.toast((DAL.i18n?DAL.i18n.text("ui_Wait_for_the_folder_restore_to_finish_befo_d8cf218","Wait for the folder restore to finish before disconnecting."):"Wait for the folder restore to finish before disconnecting."),'info');return;}
    var plugin=handle&&handle.native&&DAL.nativeFolderPlugin();
    Promise.resolve().then(function(){return plugin?plugin.unlinkFolder({projectId:proj.id}):null;}).then(function(){
      if(DAL.folderHandles[proj.id]!==handle)return;
      delete DAL.folderHandles[proj.id];delete DAL._syncConflicts[proj.id];proj.linkedFolderName='';
      DAL.saveState(true);if(DAL.currentProjectId===proj.id)DAL.render();DAL.toast((DAL.i18n?DAL.i18n.text("ui_Folder_disconnected_no_files_were_deleted__6ad7415","Folder disconnected; no files were deleted."):"Folder disconnected; no files were deleted."),'info');
    }).catch(function(error){DAL.toast('The folder could not be disconnected: '+error.message,'warning');});return;
  }
  if(action==='sync-use-folder'&&conflict){DAL.applyRemoteProject(proj,conflict,handle).catch(function(error){DAL.toast('Could not open the folder copy: '+error.message,'error');});return;}
  if(action==='sync-keep-local'&&conflict){if(el)el.disabled=true;DAL.keepLocalFolderVersion(proj,conflict,handle).catch(function(error){DAL.toast(error.message,'error');if(DAL.currentProjectId===proj.id)DAL.render();}).finally(function(){if(el)el.disabled=false;});return;}
  if(action==='sync-import-copy'&&conflict){if(el)el.disabled=true;DAL.importRemoteFolderCopy(proj,conflict,handle).catch(function(error){DAL.toast('Could not import the folder copy: '+error.message,'error');}).finally(function(){if(el)el.disabled=false;});return;}
  return DAL._syncClickBase(action,el,e);
};
document.addEventListener('change',function(event){var el=event.target;if(!el.hasAttribute||!el.hasAttribute('data-sync-mode'))return;var proj=DAL.state.projects[DAL.currentProjectId];if(proj){proj.sync.mode=el.value==='shared'?'shared':'backup';DAL.saveState(true);DAL.render();}});
