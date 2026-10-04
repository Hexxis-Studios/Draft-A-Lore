(function(){
  var generation=0,active=null,keys=['id','name','status','language','bibleId','characters','plots','relationships','lore','timeline','continuity','encyclopedia'];
  function later(){return new Promise(function(resolve){setTimeout(resolve,0);});}
  function metadata(proj){
    var value={};keys.forEach(function(key){if(proj[key]!==undefined)value[key]=proj[key];});
    var adventure=proj.adventure||{};value.adventure={};
    ['nodes','items','stats','flags','traits','failureRules','startNodeId'].forEach(function(key){if(adventure[key]!==undefined)value.adventure[key]=adventure[key];});
    return JSON.parse(JSON.stringify(value,function(key,record){return ['image','imageDataUrl','inline','dataUrl'].indexOf(key)>=0?undefined:record;}));
  }
  function cancel(){if(active){active.cancel();active=null;}}
  function makeWorker(){
    var code='var DAL={state:{bibles:{}},_continuityReports:{}};';
    ['uid','clone','continuityKey','continuityFactKey','continuityYear','continuityPattern','continuityMentions','continuityContext','continuitySceneYear','worldNamePattern','continuityRecords','projectBible','bibleRecords','encyclopediaKind','encyclopediaFacts','runEncyclopediaScan','runContinuity'].forEach(function(key){code+='DAL.'+key+'='+DAL[key].toString()+';';});
    code+='DAL.continuityText=function(value){return String(value||"");};DAL.chapterWorldText=function(chapter){return chapter.contentHTML||"";};';
    code+='onmessage=function(event){try{var data=event.data,project=data.project;if(data.bible)DAL.state.bibles[data.bible.id]=data.bible;var report=data.continuity?DAL.runContinuity(project):null;if(data.encyclopedia)DAL.runEncyclopediaScan(project);postMessage({report:report,encyclopedia:data.encyclopedia?project.encyclopedia:null});}catch(error){postMessage({error:String(error&&error.message||error)});}};';
    var url=URL.createObjectURL(new Blob([code],{type:'application/javascript'})),worker;
    try{worker=new Worker(url);}catch(error){URL.revokeObjectURL(url);throw error;}
    return {worker:worker,url:url};
  }
  DAL.cancelWorldAnalysis=function(){generation++;cancel();DAL._worldAnalysisPending=null;};
  DAL.analyzeWorldAsync=async function(proj,options){
    options=options||{};DAL.cancelWorldAnalysis();var request=generation;
    if(!proj||DAL.state.projects[proj.id]!==proj)return null;
    function chapterMetadata(){return JSON.stringify((proj.chapters||[]).map(function(chapter){var data=Object.assign({},chapter);delete data.contentHTML;return data;}));}
    var chapterRefs=(proj.chapters||[]).slice(),chapterHTML=chapterRefs.map(function(chapter){return chapter.contentHTML;}),chapterJSON=chapterMetadata(),metadataJSON=JSON.stringify(metadata(proj)),bible=DAL.projectBible(proj),bibleJSON=JSON.stringify(bible),payload=JSON.parse(metadataJSON);
    function current(){
      return request===generation&&DAL.state.projects[proj.id]===proj&&JSON.stringify(metadata(proj))===metadataJSON&&JSON.stringify(DAL.projectBible(proj))===bibleJSON&&chapterMetadata()===chapterJSON&&(proj.chapters||[]).length===chapterRefs.length&&chapterRefs.every(function(chapter,index){return proj.chapters[index]===chapter&&chapter.contentHTML===chapterHTML[index];});
    }
    function foreground(){
      if(!options.manual)return null;
      if(!current())return null;
      var report=options.continuity?DAL.runContinuity(proj):null;if(options.encyclopedia)DAL.runEncyclopediaScan(proj);return {report:report,encyclopedia:options.encyclopedia?proj.encyclopedia:null,foreground:true};
    }
    if(typeof Worker==='undefined'||typeof URL==='undefined'||!URL.createObjectURL){
      DAL._worldAnalysisNotice='Background scanning is unavailable in this browser. Use Run Continuity Check or Scan project.';await later();return foreground();
    }
    payload.chapters=[];
    for(var i=0;i<chapterRefs.length;i++){
      if(request!==generation||DAL.state.projects[proj.id]!==proj)return null;
      var chapter=Object.assign({},chapterRefs[i]);delete chapter.contentHTML;delete chapter.image;delete chapter.imageDataUrl;chapter=DAL.clone(chapter);chapter.contentHTML=DAL.chapterWorldText(chapterRefs[i]);payload.chapters.push(chapter);
      if(i%4===3)await later();
    }
    (payload.adventure.nodes||[]).forEach(function(node){node.text=DAL.continuityText(node.text);});
    var bibleCopy=bible?JSON.parse(JSON.stringify(bible,function(key,value){return ['image','imageDataUrl','inline','dataUrl'].indexOf(key)>=0?undefined:value;})):null;
    [payload,bibleCopy].filter(Boolean).forEach(function(world){
      (world.characters||[]).forEach(function(record){['backstory','arc','details'].forEach(function(key){if(record[key])record[key]=DAL.continuityText(record[key]);});});
      ((world.lore||{}).entries||[]).forEach(function(record){if(record.content)record.content=DAL.continuityText(record.content);});
    });
    if(!current())return null;
    var instance;
    try{instance=makeWorker();}catch(error){DAL._worldAnalysisNotice='Background scanning could not start. Manual scanning remains available.';await later();return foreground();}
    var result=await new Promise(function(resolve,reject){
      var settled=false,timer;
      function finish(error,value){
        if(settled)return;settled=true;clearTimeout(timer);instance.worker.terminate();URL.revokeObjectURL(instance.url);if(active&&active.request===request)active=null;
        if(error)reject(error);else resolve(value);
      }
      active={request:request,cancel:function(){finish(null,null);}};
      timer=setTimeout(function(){finish(new Error('World analysis took too long. Your writing is unchanged; retry the manual scanner.'));},60000);
      instance.worker.onmessage=function(event){var data=event.data;if(data&&data.error)finish(new Error(data.error));else finish(null,data);};
      instance.worker.onerror=function(){finish(new Error('World analysis could not finish. Your writing is unchanged.'));};
      instance.worker.onmessageerror=function(){finish(new Error('The scan result could not be read. Your writing is unchanged.'));};
      try{instance.worker.postMessage({project:payload,bible:bibleCopy,continuity:!!options.continuity,encyclopedia:!!options.encyclopedia});}catch(error){finish(error);}
    });
    if(!result||!current())return null;
    if(result.report){DAL._continuityReports=DAL._continuityReports||{};DAL._continuityReports[proj.id]=result.report;}
    if(result.encyclopedia)proj.encyclopedia=result.encyclopedia;
    DAL._worldAnalysisNotice='';return result;
  };
  function refresh(proj,ch){
    if(DAL.currentProjectId!==proj.id||DAL.currentTool!=='manuscript'||DAL.selectedChapterId!==ch.id)return;
    var live=document.getElementById('liveContinuity');if(live){var holder=document.createElement('div');holder.innerHTML=DAL.renderLiveContinuityBar(proj,ch);live.replaceWith(holder.firstElementChild);}
    DAL.applyLiveContinuityMarks(proj,ch);
  }
  DAL.worldScanStatusHtml=function(proj){
    var pending=DAL._worldAnalysisPending&&DAL._worldAnalysisPending.project===proj;
    return '<div class="world-scan-status" role="status" aria-live="polite">'+(pending?DAL.uiLabel('worldScanRunning','Scanning this project on your device…')+' <button class="btn sm" data-action="world-scan-cancel">'+DAL.uiLabel('worldScanCancel','Cancel scan')+'</button>':DAL._worldAnalysisNotice?DAL.escapeHtml(DAL._worldAnalysisNotice):'')+'</div>';
  };
  ['renderContinuity','renderEncyclopedia'].forEach(function(name){var render=DAL[name];DAL[name]=function(proj){var html=render(proj);return html.replace(/(<div class="(?:continuity-view|encyclopedia-view)">)/,'$1'+DAL.worldScanStatusHtml(proj));};});
  DAL.scheduleWorldAnalysis=function(proj,ch){
    clearTimeout(DAL._worldAnalysisTimer);DAL.cancelWorldAnalysis();
    if(!(proj.encyclopedia&&proj.encyclopedia.auto)&&!(proj.continuity&&proj.continuity.live))return;
    DAL._worldAnalysisTimer=setTimeout(function(){
      if(DAL.state.projects[proj.id]!==proj)return;
      DAL.analyzeWorldAsync(proj,{continuity:!!(proj.continuity&&proj.continuity.live),encyclopedia:!!(proj.encyclopedia&&proj.encyclopedia.auto)}).then(function(result){
        if(!result)return;if(result.encyclopedia&&DAL.state.autosave!==false)DAL.saveState();refresh(proj,ch);
      }).catch(function(error){DAL._worldAnalysisNotice=error.message;refresh(proj,ch);});
    },900);
  };
  var click=DAL.handleStoryClick;
  DAL.handleStoryClick=function(action,el,event){
    if(action==='world-scan-cancel'){DAL.cancelWorldAnalysis();DAL._worldAnalysisNotice='Scan cancelled. Your writing is unchanged.';DAL.render();return;}
    if(action!=='continuity-run'&&action!=='encyclopedia-scan')return click(action,el,event);
    var proj=DAL.state.projects[DAL.currentProjectId];if(!proj)return;
    if(DAL.currentTool==='manuscript'&&DAL.saveChapterContent)DAL.saveChapterContent();
    clearTimeout(DAL._worldAnalysisTimer);DAL._worldAnalysisNotice='';
    var promise=DAL.analyzeWorldAsync(proj,{continuity:action==='continuity-run',encyclopedia:action==='encyclopedia-scan',manual:true}),pending={project:proj,request:generation};DAL._worldAnalysisPending=pending;DAL.render();
    promise.then(function(result){
      if(DAL._worldAnalysisPending!==pending)return;
      if(!result){DAL.toast((DAL.i18n?DAL.i18n.text("ui_Scan_cancelled_because_the_project_changed_65d6eb0","Scan cancelled because the project changed. Run it again when ready."):"Scan cancelled because the project changed. Run it again when ready."),'info');return;}
      if(result.encyclopedia)DAL.saveState();
      if(DAL.currentProjectId===proj.id&&DAL.state.projects[proj.id]===proj)DAL.render();
      DAL.toast(action==='continuity-run'?'Continuity check complete':'Encyclopedia suggestions refreshed','success');
    }).catch(function(error){if(DAL._worldAnalysisPending===pending){DAL._worldAnalysisNotice=error.message;DAL.toast(error.message,'warning');}}).finally(function(){if(DAL._worldAnalysisPending===pending){DAL._worldAnalysisPending=null;if(DAL.currentProjectId===proj.id&&DAL.state.projects[proj.id]===proj)DAL.render();}});
  };
})();
