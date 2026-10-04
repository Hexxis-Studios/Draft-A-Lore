DAL.saveExportBlob=async function(filename,blob){
  var capacitor=window.Capacitor,native=capacitor&&capacitor.getPlatform&&capacitor.getPlatform()==='android';
  if(!native){
    var url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;
    var container=document.getElementById&&document.getElementById('toastContainer');
    if(container&&DAL.offerDownload)DAL.offerDownload(filename,url,container);
    try{document.body.appendChild(link);link.click();}catch(error){DAL.toast(DAL.i18n?DAL.i18n.text('exportDownloadFailedReason','Could not start the download: {reason}',{reason:error.message}):'Could not start the download: '+error.message,'error');return false;}finally{link.remove();if(!container)setTimeout(function(){URL.revokeObjectURL(url);},1000);}
    return true;
  }
  if(DAL._nativeExportBusy){DAL.toast((DAL.i18n?DAL.i18n.text("ui_Finish_or_cancel_the_current_Save_File_pic_e7a6195","Finish or cancel the current Save File picker first."):"Finish or cancel the current Save File picker first."),'warning');return false;}
  if(blob.size>256*1024*1024){DAL.toast((DAL.i18n?DAL.i18n.text("ui_The_Android_export_limit_is_256_MB_Reduce__d1c4b96","The Android export limit is 256 MB. Reduce large media files before exporting."):"The Android export limit is 256 MB. Reduce large media files before exporting."),'error');return false;}
  DAL._nativeExportBusy=true;var plugin,token;
  try{
    plugin=capacitor.Plugins&&capacitor.Plugins.FileExport;
    if(!plugin&&typeof capacitor.registerPlugin==='function')plugin=capacitor.registerPlugin('FileExport');
    if(!plugin)throw new Error('Android file export is unavailable in this build.');
    var started=await plugin.begin({filename:filename,mime:blob.type||'application/octet-stream',size:blob.size});
    if(!started||!started.token)throw new Error('Android could not prepare the export.');token=started.token;
    for(var offset=0;offset<blob.size;offset+=256*1024){
      var chunk=blob.slice(offset,Math.min(blob.size,offset+256*1024));
      var encoded=await new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(String(reader.result).split(',')[1]||'');};reader.onerror=function(){reject(new Error('Could not read the export data.'));};reader.onabort=function(){reject(new Error('Export preparation was interrupted.'));};reader.readAsDataURL(chunk);});
      var appended=await plugin.append({token:token,offset:offset,data:encoded});if(!appended||appended.written!==offset+chunk.size)throw new Error('Android did not receive the complete export data.');
    }
    var result=await plugin.save({token:token});token=null;
    if(result&&result.cancelled){DAL.toast((DAL.i18n?DAL.i18n.text("ui_File_save_cancelled_Your_project_is_unchan_ac324ee","File save cancelled. Your project is unchanged."):"File save cancelled. Your project is unchanged."),'info');return false;}
    if(!result||result.saved!==true)throw new Error('Android did not confirm the file was saved.');
    DAL.toast(DAL.i18n?DAL.i18n.text('exportSavedFilename','Saved “{filename}” to your chosen location.',{filename:filename}):'Saved “'+filename+'” to your chosen location.','success');return true;
  }catch(error){if(plugin&&token)try{await plugin.abort({token:token});}catch(cleanupError){}DAL.toast(DAL.i18n?DAL.i18n.text('exportFailedReason','Could not export file: {reason}',{reason:error.message}):'Could not export file: '+error.message,'error');return false;}
  finally{DAL._nativeExportBusy=false;}
};
DAL.offerDownload=function(filename,url,container){
  if(DAL._downloadFallback)DAL._downloadFallback.close();
  var notice=document.createElement('div'),label=document.createElement('div'),link=document.createElement('a'),close=document.createElement('button');
  notice.className='toast export-download-notice';notice.setAttribute('role','status');label.textContent=DAL.i18n?DAL.i18n.text('exportReadyFilename','Export ready: {filename}',{filename:filename}):'Export ready: '+filename;
  link.className='btn sm';link.href=url;link.download=filename;link.textContent=DAL.i18n?DAL.i18n.text('exportSaveFile','Save file'):'Save file';
  close.className='btn sm';close.type='button';close.textContent=DAL.i18n?DAL.i18n.text('dismiss','Dismiss'):'Dismiss';close.setAttribute('aria-label',DAL.i18n?DAL.i18n.text('exportDismissDownload','Dismiss export download'):'Dismiss export download');
  notice.appendChild(label);notice.appendChild(link);notice.appendChild(close);container.appendChild(notice);
  var fallback={notice:notice,closed:false,close:function(){if(fallback.closed)return;fallback.closed=true;clearTimeout(fallback.timer);notice.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);if(DAL._downloadFallback===fallback)DAL._downloadFallback=null;}};
  close.addEventListener('click',fallback.close);fallback.timer=setTimeout(fallback.close,120000);DAL._downloadFallback=fallback;
};
if(DAL.registerAfterRender)DAL.registerAfterRender(function(){var fallback=DAL._downloadFallback,container=document.getElementById('toastContainer');if(fallback&&!fallback.closed&&container&&!fallback.notice.isConnected)container.appendChild(fallback.notice);});
