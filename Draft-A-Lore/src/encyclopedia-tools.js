/* Draft A Lore — rule-based living encyclopedia and in-editor world lookup */
DAL = DAL || {};

DAL.encyclopediaKind = function(name,context){
  var text=String(context||'').toLowerCase();
  var named=String(name||'').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(new RegExp(named+'[^.!?]{0,55}\\b(born|died|said|asked|walked|spoke|he|she|they)\\b','i').test(text))return 'character';
  if(/\b(city|village|town|realm|kingdom|forest|mountain|river|temple|castle|station|planet|district|island)\b/.test(text))return 'place';
  if(/\b(spell|magic|ritual|curse|enchantment|mana|aether|power)\b/.test(text))return 'magic';
  if(/\b(sword|ring|amulet|key|weapon|artifact|relic|potion|shield|crown|book)\b/.test(text))return 'item';
  if(/\b(war|battle|coronation|festival|cataclysm|sundering|uprising|rebellion)\b/.test(text)&&/\b(?:year\s*)?-?\d+\b/i.test(text))return 'event';
  if(/^the\s/i.test(name))return 'term';
  return 'character';
};
DAL.encyclopediaFacts = function(name,context){
  var facts=[],safe=String(name||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),patterns=[
    ['birth year',new RegExp(safe+'[^.!?]{0,45}?(?:born|birth)\\s*(?:in|:)?\\s*(?:year\\s*)?(-?\\d+)','i')],
    ['death year',new RegExp(safe+'[^.!?]{0,45}?(?:died|killed)\\s*(?:in|:)?\\s*(?:year\\s*)?(-?\\d+)','i')],
    ['founded',new RegExp(safe+'[^.!?]{0,45}?founded\\s*(?:in|:)?\\s*(?:year\\s*)?(-?\\d+)','i')],
    ['destroyed',new RegExp(safe+'[^.!?]{0,45}?(?:fell|destroyed)\\s*(?:in|:)?\\s*(?:year\\s*)?(-?\\d+)','i')]
  ];
  patterns.forEach(function(pair){var match=String(context||'').match(pair[1]);if(match)facts.push({id:DAL.uid('fact'),key:pair[0],value:match[1]});});return facts;
};

DAL.runEncyclopediaScan = function(proj){
  var known=Object.create(null);(DAL.continuityRecords?DAL.continuityRecords(proj):[]).forEach(function(record){known[DAL.continuityKey(record.name)]=true;(record.aliases||[]).forEach(function(alias){known[DAL.continuityKey(alias)]=true;});});
  var previous=Object.create(null);((proj.encyclopedia&&proj.encyclopedia.candidates)||[]).forEach(function(candidate){previous[candidate.key]=candidate;});
  var found=Object.create(null),sources=[];
  (proj.chapters||[]).forEach(function(chapter){sources.push({kind:'chapter',id:chapter.id,title:chapter.title,text:DAL.chapterWorldText(chapter)});});
  (((proj.adventure||{}).nodes)||[]).forEach(function(node){sources.push({kind:'scene',id:node.id,title:node.title,text:DAL.continuityText(node.text)});});
  sources.forEach(function(source){var match,re=/(?<![\p{L}\p{M}\p{N}_])[\p{Lu}][\p{L}\p{M}’'-]{2,}(?:[ \t]+[\p{Lu}][\p{L}\p{M}’'-]{2,}){0,2}(?![\p{L}\p{M}\p{N}_])/gu;while((match=re.exec(source.text))){var name=match[0].trim(),key=DAL.continuityKey(name);if(!key||known[key]||/^(the|this|that|chapter|however|after|before|when|where|year)$/.test(key))continue;var start=Math.max(0,match.index-90),context=source.text.slice(start,match.index+name.length+130).trim();if(!found[key])found[key]={key:key,id:(previous[key]&&previous[key].id)||DAL.uid('candidate'),name:name,kind:DAL.encyclopediaKind(name,context),mentions:0,sourceIds:[],sourceKind:source.kind,sourceId:source.id,sourceTitle:source.title,context:context,facts:[],status:(previous[key]&&previous[key].status==='dismissed')?'dismissed':'active'};found[key].mentions++;if(found[key].sourceIds.indexOf(source.id)<0)found[key].sourceIds.push(source.id);var facts=DAL.encyclopediaFacts(name,context);facts.forEach(function(fact){if(!found[key].facts.some(function(existing){return DAL.continuityKey(existing.key)===DAL.continuityKey(fact.key)&&String(existing.value)===String(fact.value);}))found[key].facts.push(fact);});}});
  var candidates=Object.keys(found).map(function(key){return found[key];}).filter(function(candidate){return candidate.mentions>=2||candidate.facts.length;}).sort(function(a,b){return b.mentions-a.mentions||a.name.localeCompare(b.name);});
  Object.keys(previous).forEach(function(key){
    var candidate=previous[key];
    if(!found[key]&&(candidate.status==='added'||candidate.status==='dismissed')){
      var retained=DAL.clone(candidate);retained.mentions=0;retained.sourceIds=[];retained.sourceAvailable=false;candidates.push(retained);
    }
  });
  proj.encyclopedia=proj.encyclopedia||{auto:true,candidates:[]};proj.encyclopedia.candidates=candidates;proj.encyclopedia.lastScannedAt=Date.now();return candidates;
};

DAL.renderEncyclopedia = function(proj){
  var data=proj.encyclopedia||{auto:true,candidates:[],lastScannedAt:0},filter=DAL._encyclopediaFilter||'active',bible=DAL.projectBible&&DAL.projectBible(proj),list=(data.candidates||[]).filter(function(candidate){return filter==='all'||candidate.status===filter;});
  var html="<div class=\"encyclopedia-view\"><div class=\"section-header\"><div><div class=\"section-title\">"+DAL.uiLabel("tool_encyclopedia","Living Encyclopedia")+"</div><p class=\"writer-muted\">"+DAL.uiLabel("ui_Finds_recurring_people_places_objects_even_99f9c8a","Finds recurring people, places, objects, events, and concepts in prose. You review every suggestion before it becomes project data.")+"</p></div><button class=\"btn primary\" data-action=\"encyclopedia-scan\">"+DAL.uiLabel("ui_Scan_project_8d38631","Scan project")+"</button></div>";
  html+='<div class="card encyclopedia-settings"><label><input type="checkbox" data-action="encyclopedia-auto"'+(data.auto!==false?' checked':'')+">"+DAL.uiLabel("ui_Refresh_suggestions_while_I_write_f8465f4"," Refresh suggestions while I write")+"</label><span class=\"writer-muted\">"+DAL.uiLabel("ui_Rule_based_and_fully_offline_Nothing_is_se_f41114f","Rule-based and fully offline. Nothing is sent anywhere.")+"</span></div>";
  html+='<div class="continuity-filters"><button class="btn sm'+(filter==='active'?' primary':'')+"\" data-action=\"encyclopedia-filter\" data-filter=\"active\">"+DAL.uiLabel("ui_Suggestions_16c1d60","Suggestions")+"</button><button class=\"btn sm"+(filter==='added'?' primary':'')+"\" data-action=\"encyclopedia-filter\" data-filter=\"added\">"+DAL.uiLabel("ui_Added_6b02e0d","Added")+"</button><button class=\"btn sm"+(filter==='dismissed'?' primary':'')+"\" data-action=\"encyclopedia-filter\" data-filter=\"dismissed\">"+DAL.uiLabel("ui_Dismissed_9d74727","Dismissed")+"</button><button class=\"btn sm"+(filter==='all'?' primary':'')+"\" data-action=\"encyclopedia-filter\" data-filter=\"all\">"+DAL.uiLabel("ui_All_a52ace4","All")+"</button>"+(data.lastScannedAt?'<span class="writer-muted">Last scan '+DAL.uiDate(data.lastScannedAt)+'</span>':'')+'</div>';
  html+='<div class="encyclopedia-list">'+(list.length?list.map(function(candidate){return '<article class="encyclopedia-candidate"><div><span class="badge">'+DAL.escapeHtml(candidate.kind)+'</span> <strong>'+DAL.escapeHtml(candidate.name)+'</strong><p>'+DAL.escapeHtml(candidate.context)+'</p><span class="writer-muted">'+DAL.uiLabel('encyclopediaMentions',candidate.mentions+' mentions',{count:candidate.mentions})+' · '+DAL.escapeHtml(candidate.sourceTitle||'')+(candidate.facts.length?' · '+DAL.escapeHtml(candidate.facts.map(function(fact){return fact.key+': '+fact.value;}).join(', ')):'')+'</span></div><div class="writer-tool-actions"><button class="btn sm" data-action="encyclopedia-open" data-candidate="'+DAL.escapeHtml(candidate.id)+"\">"+DAL.uiLabel("ui_Open_source_67a0d2e","Open source")+"</button>"+(candidate.status==='active'?'<button class="btn sm primary" data-action="encyclopedia-add-project" data-candidate="'+DAL.escapeHtml(candidate.id)+"\">"+DAL.uiLabel("ui_Add_to_project_df0fbf9","Add to project")+"</button>"+(bible?'<button class="btn sm" data-action="encyclopedia-add-bible" data-candidate="'+DAL.escapeHtml(candidate.id)+"\">"+DAL.uiLabel("ui_Add_to_Bible_c33c06f","Add to Bible")+"</button>":'')+'<button class="btn sm" data-action="encyclopedia-dismiss" data-candidate="'+DAL.escapeHtml(candidate.id)+"\">"+DAL.uiLabel("ui_Dismiss_48845bf","Dismiss")+"</button>":'<button class="btn sm" data-action="encyclopedia-restore" data-candidate="'+DAL.escapeHtml(candidate.id)+"\">"+DAL.uiLabel("ui_Restore_suggestion_1db612b","Restore suggestion")+"</button>")+'</div></article>';}).join(''):'<div class="empty-state compact"><p>'+(data.lastScannedAt?'No suggestions in this view.':'Run the scanner after writing some prose.')+'</p></div>')+'</div></div>';return html;
};

DAL.addEncyclopediaCandidate = function(proj,candidate,toBible){
  var bible=toBible&&DAL.projectBible&&DAL.projectBible(proj),target=bible||proj,kind=candidate&&candidate.kind,exists=false;
  if(toBible&&!bible)throw new Error('Connect a World Bible first. Nothing was added to the project.');
  if(!proj||!candidate||typeof candidate.name!=='string'||!candidate.name.trim()||['character','event','place','magic','item','term'].indexOf(kind)<0)throw new Error('This suggestion is invalid. Nothing was added.');
  if(bible&&DAL.finishBibleEdit)DAL.finishBibleEdit(bible);
  var before=!bible&&DAL.snapshotProject?DAL.snapshotProject(proj):null;
  var section=kind==='character'?'characters':kind==='event'?'timeline':'lore',priorIds=new Set((section==='lore'?((target.lore||{}).entries||[]):target[section]||[]).map(function(record){return record.id;})),priorFolders=bible?DAL.clone(bible.lore.folders):null;
  function same(item,key){return DAL.continuityKey(item[key])===DAL.continuityKey(candidate.name);}
  if(kind==='character'){
    var characters=target.characters||(target.characters=[]);exists=characters.some(function(item){return same(item,'name');});if(!exists)characters.push(toBible?{id:DAL.uid('bchar'),name:candidate.name,aliases:[],status:'',role:'',details:candidate.context,tags:[],facts:DAL.clone(candidate.facts)}:{id:DAL.uid('char'),name:candidate.name,role:'',age:'',gender:'',appearance:'',personality:'',backstory:candidate.context,arc:'',customFields:candidate.facts.map(function(fact){return{label:fact.key,value:fact.value,type:'text'};}),tags:[],image:'',linkedPlotIds:[],deceased:false,deathChapterId:'',createdAt:Date.now()});
  }else if(kind==='event'){
    var timeline=target.timeline||(target.timeline=[]);exists=timeline.some(function(item){return same(item,'title');});if(!exists)timeline.push({id:DAL.uid(toBible?'bevent':'event'),title:candidate.name,date:(candidate.facts[0]&&candidate.facts[0].value)||'',order:timeline.length+1,location:'',summary:candidate.context,tags:[],characterIds:[],plotIds:[],chapterId:''});
  }else{
    var lore=target.lore||(target.lore={folders:[],entries:[]}),folder=kind==='place'?'Locations':(kind==='magic'?'Magic / Technology':(kind==='item'?'Relics & Artifacts':'Miscellaneous'));exists=lore.entries.some(function(item){return same(item,'title');});if(!exists)lore.entries.push({id:DAL.uid(toBible?'blore':'lore'),title:candidate.name,folder:folder,content:candidate.context,aliases:[],status:'',tags:[],facts:DAL.clone(candidate.facts),linkedCharIds:[],linkedPlotIds:[],createdAt:Date.now(),updatedAt:Date.now()});if(lore.folders.indexOf(folder)<0)lore.folders.push(folder);
  }
  if(!exists){
    if(before){proj.history=proj.history||[];proj.history.push(before);if(proj.history.length>DAL.HISTORY_MAX)proj.history.shift();proj.redoStack=[];proj.historyIndex=proj.history.length-1;}
    candidate.status='added';candidate.addedTo=toBible?'bible':'project';
    var addedRecords=section==='lore'?target.lore.entries:target[section];
    var added=addedRecords.find(function(record){return !priorIds.has(record.id);});candidate.addedRecordId=added&&added.id;candidate.addedBibleId=bible?bible.id:'';
    if(bible){
      bible.updatedAt=Date.now();
      if(DAL.pushBibleHistory&&added){var changes=[{section:section,id:added.id,index:addedRecords.indexOf(added),before:null,after:DAL.clone(added)}];if(JSON.stringify(priorFolders)!==JSON.stringify(bible.lore.folders))changes.push({section:'folders',before:priorFolders,after:DAL.clone(bible.lore.folders)});DAL.pushBibleHistory(bible,changes);}
    }
    proj.updatedAt=Date.now();
  }return !exists;
};

DAL.writerLookupText = function(){
  var editor=document.getElementById('editorContent');if(!editor)return '';
  var selected=DAL._writerRange&&editor.contains(DAL._writerRange.commonAncestorContainer)&&String(DAL._writerRange).trim();if(selected)return selected.slice(0,120);
  var selection=window.getSelection&&window.getSelection();if(!selection||!selection.rangeCount)return '';
  var node=selection.anchorNode,offset=selection.anchorOffset;if(!node||node.nodeType!==3||!editor.contains(node))return '';
  var text=node.nodeValue||'',left=text.slice(0,offset).match(/[\p{L}\p{M}\p{N}’'-]+$/u),right=text.slice(offset).match(/^[\p{L}\p{M}\p{N}’'-]+/u);return (((left&&left[0])||'')+((right&&right[0])||'')).slice(0,120);
};

DAL.renderLiveContinuityBar = function(proj,ch){
  if(!ch||!proj.continuity||!proj.continuity.live)return '';
  var report=DAL._continuityReports&&DAL._continuityReports[proj.id],ignored=proj.continuity.ignored||{},issues=report?report.issues.filter(function(issue){return issue.target&&issue.target.kind==='chapter'&&issue.target.id===ch.id&&!ignored[issue.signature];}):[];
  return '<div class="live-continuity" id="liveContinuity" role="status" aria-live="polite">'+(report?(issues.length?'<button class="btn sm" data-action="continuity-live-open">'+DAL.uiLabel('continuityChapterIssues',issues.length+' continuity issues in this chapter',{count:issues.length})+'</button><span>'+DAL.uiLabel('continuitySeverityCounts','Errors, warnings and notes',{errors:issues.filter(function(issue){return issue.severity==='error';}).length,warnings:issues.filter(function(issue){return issue.severity==='warning';}).length,notes:issues.filter(function(issue){return issue.severity==='note';}).length})+'</span>':("<span>"+DAL.uiLabel("ui_Continuity_no_active_issues_in_this_chapte_10e6792","Continuity: no active issues in this chapter")+"</span>")):("<span>"+DAL.uiLabel("ui_Continuity_checking_will_update_after_you__c6f9cfd","Continuity checking will update after you type.")+"</span>"))+(DAL._worldAnalysisNotice?'<span>'+DAL.escapeHtml(DAL._worldAnalysisNotice)+'</span>':'')+'</div>';
};
DAL.applyLiveContinuityMarks = function(proj,ch){
  if(typeof CSS==='undefined'||!CSS.highlights||typeof Highlight==='undefined')return;
  ['error','warning','note'].forEach(function(level){CSS.highlights.delete('dal-continuity-'+level);});
  if(!proj||!ch||!proj.continuity||!proj.continuity.live)return;
  var editor=document.getElementById('editorContent'),report=DAL._continuityReports&&DAL._continuityReports[proj.id];if(!editor||!report)return;
  var ranges={error:[],warning:[],note:[]},ignored=proj.continuity.ignored||{},model=DAL.manuscriptTextModel(editor),limited=false,issues=report.issues.filter(function(issue){return issue.target&&issue.target.kind==='chapter'&&issue.target.id===ch.id&&issue.needle&&!ignored[issue.signature]&&ranges[issue.severity];});
  issues.forEach(function(issue){
    var pattern=DAL.continuityPattern(issue.needle),match;
    while((match=pattern.exec(model.text))){
      if(ranges[issue.severity].length>=500){limited=true;break;}
      var start=match.index+match[1].length,end=start+match[2].length,first=model.nodes.find(function(part){return part.start<=start&&start<part.end;}),last=model.nodes.find(function(part){return part.start<end&&end<=part.end;});
      if(first&&last){var range=document.createRange();range.setStart(first.node,start-first.start);range.setEnd(last.node,end-last.start);ranges[issue.severity].push(range);}
      if(!match[0].length)pattern.lastIndex++;
    }
  });
  var live=document.getElementById('liveContinuity');if(live&&limited){var note=document.createElement('span');note.textContent=DAL.i18n?DAL.i18n.text('continuityHighlightLimit','Highlight display is limited for performance; the full report still includes every issue.'):'Highlight display is limited for performance; the full report still includes every issue.';live.appendChild(note);}
  Object.keys(ranges).forEach(function(level){if(ranges[level].length)CSS.highlights.set('dal-continuity-'+level,new Highlight(...ranges[level]));});
};
DAL.scheduleWorldAnalysis = function(proj,ch){
  clearTimeout(DAL._worldAnalysisTimer);
  if(!(proj.encyclopedia&&proj.encyclopedia.auto)&&!(proj.continuity&&proj.continuity.live))return;
  DAL._worldAnalysisTimer=setTimeout(function(){
    if(DAL.state.projects[proj.id]!==proj)return;
    if(proj.encyclopedia&&proj.encyclopedia.auto)DAL.runEncyclopediaScan(proj);
    if(proj.continuity&&proj.continuity.live)DAL.runContinuity(proj);
    if(DAL.state.autosave!==false)DAL.saveState();
    if(DAL.currentProjectId!==proj.id||DAL.selectedChapterId!==ch.id)return;
    var live=document.getElementById('liveContinuity');
    if(live){var holder=document.createElement('div');holder.innerHTML=DAL.renderLiveContinuityBar(proj,ch);live.replaceWith(holder.firstElementChild);}
    DAL.applyLiveContinuityMarks(proj,ch);
  },900);
};

DAL._encyclopediaClickBase=DAL.handleStoryClick;
DAL.handleStoryClick=function(action,el,e){
  var proj=DAL.state.projects[DAL.currentProjectId],candidate=proj&&proj.encyclopedia&&(proj.encyclopedia.candidates||[]).find(function(item){return item.id===el.getAttribute('data-candidate');});
  if(action==='encyclopedia-scan'){DAL.runEncyclopediaScan(proj);DAL.saveState();DAL.render();DAL.toast((DAL.i18n?DAL.i18n.text("ui_Encyclopedia_suggestions_refreshed_43a13cc","Encyclopedia suggestions refreshed"):"Encyclopedia suggestions refreshed"),'success');return;}
  if(action==='encyclopedia-auto'){proj.encyclopedia.auto=el.checked;DAL.saveState(true);return;}
  if(action==='encyclopedia-filter'){DAL._encyclopediaFilter=el.getAttribute('data-filter');DAL.render();return;}
  if(action==='encyclopedia-add-project'||action==='encyclopedia-add-bible'){
    if(candidate){try{var added=DAL.addEncyclopediaCandidate(proj,candidate,action==='encyclopedia-add-bible');DAL.render();if(added){if(DAL.saveBibleChanges)DAL.saveBibleChanges('Record added');else Promise.resolve(DAL.saveState(true)).then(function(saved){DAL.toast(saved===true?'Record added and saved':'Record added in memory only; save or export before closing.',saved===true?'success':'warning');}).catch(function(){DAL.toast((DAL.i18n?DAL.i18n.text("ui_Record_added_in_memory_only_save_or_export_0a0e94d","Record added in memory only; save or export before closing."):"Record added in memory only; save or export before closing."),'warning');});}else DAL.toast((DAL.i18n?DAL.i18n.text("ui_That_record_already_exists_1023ad2","That record already exists"):"That record already exists"),'info');}catch(error){DAL.toast(error.message,'error');}}
    return;
  }
  if(action==='encyclopedia-dismiss'||action==='encyclopedia-restore'){if(candidate){candidate.status=action==='encyclopedia-dismiss'?'dismissed':'active';DAL.saveState();DAL.render();}return;}
  if(action==='encyclopedia-open'&&candidate){if(candidate.sourceKind==='chapter'){DAL.currentTool='manuscript';DAL.selectedChapterId=candidate.sourceId;}else{DAL.currentTool='storygraph';DAL.selectedNodeId=candidate.sourceId;}DAL.render();return;}
  if(action==='world-lookup'){var term=DAL.writerLookupText();DAL.showProjectSearch(term);return;}
  if(action==='continuity-live-open'){DAL.currentTool='continuity';DAL._continuityFilter='active';DAL.render();return;}
  return DAL._encyclopediaClickBase(action,el,e);
};

DAL._encyclopediaAfterRender=DAL.afterStoryRender;
DAL.afterStoryRender=function(proj){
  DAL._encyclopediaAfterRender(proj);
  clearTimeout(DAL._continuityRenderTimer);
  if(DAL.currentTool!=='manuscript')return;
  var ch=(proj.chapters||[]).find(function(item){return item.id===DAL.selectedChapterId;});
  var editor=document.getElementById('editorContent');
  DAL._continuityRenderTimer=setTimeout(function(){
    if(DAL.currentTool!=='manuscript'||DAL.currentProjectId!==proj.id||DAL.state.projects[proj.id]!==proj||!ch||DAL.selectedChapterId!==ch.id||document.getElementById('editorContent')!==editor)return;
    DAL.applyLiveContinuityMarks(proj,ch);
  },0);
};
