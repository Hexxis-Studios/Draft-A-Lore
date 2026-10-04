/* Draft A Lore — shared world bibles */
DAL = DAL || {};

DAL.projectBible = function(proj){ return proj && proj.bibleId && DAL.state.bibles ? DAL.state.bibles[proj.bibleId] || null : null; };
DAL.bibleProjects = function(bible){
  return DAL.state.projectOrder.map(function(id){return DAL.state.projects[id];}).filter(function(project){return project&&project.bibleId===bible.id;});
};
DAL.bibleRecords = function(bible, section){
  if(!bible)return [];
  if(section==='lore')return bible.lore.entries;
  return bible[section]||[];
};
DAL.bibleTitle = function(record, section){ return section==='characters'?record.name:(section==='glossary'?record.term:record.title); };
DAL._bibleHistories=new WeakMap();
DAL.bibleHistory=function(bible){
  var history=DAL._bibleHistories.get(bible);
  if(!history){history={undo:[],redo:[],pending:null,bytes:0};DAL._bibleHistories.set(bible,history);}
  return history;
};
DAL.finishBibleEdit=function(bible){
  var history=DAL.bibleHistory(bible),pending=history.pending;if(!pending)return;
  history.pending=null;
  var record=DAL.bibleRecords(bible,pending.section).find(function(item){return item.id===pending.id;});
  if(!record)return;
  pending.after=DAL.clone(record);
  if(JSON.stringify(pending.before)!==JSON.stringify(pending.after))DAL.pushBibleHistory(bible,[pending]);
};
DAL.pushBibleHistory=function(bible,changes){
  var history=DAL.bibleHistory(bible),bytes=JSON.stringify(changes).length*2;
  history.redo=[];
  if(bytes>4*1024*1024){history.undo=[];history.bytes=0;DAL.toast((DAL.i18n?DAL.i18n.text("ui_This_world_edit_is_too_large_for_session_U_320c02b","This world edit is too large for session Undo. Export the Bible before further changes."):"This world edit is too large for session Undo. Export the Bible before further changes."),'warning');return;}
  history.undo.push({changes:changes,bytes:bytes});history.bytes+=bytes;
  while(history.undo.length>40||history.bytes>4*1024*1024){history.bytes-=history.undo.shift().bytes;}
};
DAL.saveBibleChanges=async function(message){
  var saved=false;try{saved=await DAL.saveState(true)===true;}catch(error){}
  DAL.toast(saved?message:'World changes are in memory only. Use File → Save Now to retry, or export a backup before closing.',saved?'success':'warning');
  return saved;
};
DAL.stepBibleHistory=function(bible,redo){
  DAL.finishBibleEdit(bible);
  var history=DAL.bibleHistory(bible),from=redo?history.redo:history.undo,to=redo?history.undo:history.redo,entry=from[from.length-1];
  if(!entry){DAL.toast(redo?'No world edit to redo.':'No world edit to undo.','info');return false;}
  var valid=entry.changes.every(function(change){
    var actual=change.section==='folders'?bible.lore.folders:DAL.bibleRecords(bible,change.section).find(function(item){return item.id===change.id;})||null;
    return JSON.stringify(actual)===JSON.stringify(redo?change.before:change.after);
  });
  if(!valid){DAL.toast((DAL.i18n?DAL.i18n.text("ui_The_shared_record_changed_since_this_edit__6c64339","The shared record changed since this edit. Nothing was overwritten."):"The shared record changed since this edit. Nothing was overwritten."),'warning');return false;}
  entry.changes.slice().reverse().forEach(function(change){
    var desired=redo?change.after:change.before;
    if(change.section==='folders'){bible.lore.folders=DAL.clone(desired);return;}
    var records=DAL.bibleRecords(bible,change.section),index=records.findIndex(function(item){return item.id===change.id;});
    if(index>=0)records.splice(index,1);
    if(desired)records.splice(Math.min(change.index,records.length),0,DAL.clone(desired));
  });
  from.pop();to.push(entry);history.bytes+=redo?entry.bytes:-entry.bytes;bible.updatedAt=Date.now();
  DAL.render();DAL.saveBibleChanges(redo?'World edit redone':'World edit undone');return true;
};
DAL._projectUndoBeforeBible=DAL.undo;
DAL._projectRedoBeforeBible=DAL.redo;
DAL.undo=function(){var bible=DAL.projectBible(DAL.state.projects[DAL.currentProjectId]);if(DAL.currentTool==='worldbible'&&bible)return DAL.stepBibleHistory(bible,false);return DAL._projectUndoBeforeBible();};
DAL.redo=function(){var bible=DAL.projectBible(DAL.state.projects[DAL.currentProjectId]);if(DAL.currentTool==='worldbible'&&bible)return DAL.stepBibleHistory(bible,true);return DAL._projectRedoBeforeBible();};
DAL.bibleFactsText = function(record){ return (record.facts||[]).map(function(fact){return fact.key+': '+fact.value;}).join('\n'); };
DAL.parseBibleFacts = function(text){
  return String(text||'').split(/\r?\n/).map(function(line){
    line=line.trim(); if(!line)return null;
    var at=line.indexOf(':');
    return {id:DAL.uid('fact'),key:(at<0?line:line.slice(0,at)).trim(),value:(at<0?'':line.slice(at+1)).trim()};
  }).filter(Boolean);
};

DAL.stageBibleImport = function(text){
  if(typeof text!=='string'||text.length>32*1024*1024)throw new Error('World Bible files must be no larger than 32 MB.');
  var data=JSON.parse(text,function(key,value){
    if(key==='__proto__'||key==='constructor'||key==='prototype')throw new Error('This file contains an unsafe property.');
    return value;
  });
  function object(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
  if(!object(data))throw new Error('Choose a World Bible JSON export, not a project or workspace export.');
  if(data.kind&&data.kind!=='draft-a-lore-bible')throw new Error('This is not a World Bible export.');
  if(data.schemaVersion!=null&&(!Number.isInteger(data.schemaVersion)||data.schemaVersion<1||data.schemaVersion>DAL.SCHEMA_VERSION))throw new Error('This World Bible uses an unsupported format version.');
  var incoming=Object.prototype.hasOwnProperty.call(data,'bible')?data.bible:data;
  if(object(incoming)&&['chapters','adventure','projects','projectOrder'].some(function(key){return Object.prototype.hasOwnProperty.call(incoming,key);}))throw new Error('Choose a World Bible export, not a project or workspace export.');
  if(!object(incoming)||typeof incoming.name!=='string'||!incoming.name.trim()||!Array.isArray(incoming.characters)||!object(incoming.lore)||!Array.isArray(incoming.lore.entries)||!Array.isArray(incoming.timeline)||(incoming.glossary!=null&&!Array.isArray(incoming.glossary)))throw new Error('The file is missing the required World Bible structure.');
  function string(value,limit,label,required){
    if(value==null&&!required)return;
    if(typeof value!=='string'||value.length>limit||(required&&!value.trim()))throw new Error(label+' is invalid or exceeds the supported length. No records were imported.');
  }
  function strings(values,limit,label){
    if(values==null)return;
    if(!Array.isArray(values))throw new Error(label+' must be a list.');
    values.forEach(function(value){string(value,limit,label,true);});
  }
  string(incoming.name,200,'World name',true);
  strings(incoming.lore.folders,100,'Lore folders');
  var total=0;
  ['characters','lore','timeline','glossary'].forEach(function(section){
    var records=section==='lore'?incoming.lore.entries:(incoming[section]||[]),ids=new Set();
    total+=records.length;if(total>50000)throw new Error('This file exceeds the 50,000-record World Bible import limit.');
    records.forEach(function(record){
      if(!object(record))throw new Error('The World Bible contains an invalid record.');
      if(record.id!=null){
        string(record.id,200,'Record ID',true);
        if(!/^[A-Za-z0-9._:-]+$/.test(record.id))throw new Error('A record ID contains unsupported characters. No records were imported.');
        if(ids.has(record.id)||/^(?:__proto__|constructor|prototype)$/.test(record.id))throw new Error('The World Bible contains duplicate or unsafe record IDs.');
        ids.add(record.id);
      }
      string(record[section==='characters'?'name':section==='glossary'?'term':'title'],300,'Record title',true);
      string(record.status,80,'Status');strings(record.aliases,120,'Aliases');strings(record.tags,80,'Tags');
      if(record.facts!=null){
        if(!Array.isArray(record.facts))throw new Error('Facts must be a list.');
        record.facts.forEach(function(fact){
          if(!object(fact))throw new Error('The World Bible contains an invalid fact.');
          string(fact.key,120,'Fact label');
          if(fact.value!=null&&typeof fact.value!=='string'&&typeof fact.value!=='number'&&typeof fact.value!=='boolean')throw new Error('Fact values must be text, numbers or true/false.');
          if(String(fact.value==null?'':fact.value).length>500)throw new Error('A fact exceeds the supported length.');
        });
      }
      if(section==='lore'){string(record.folder,100,'Lore category');string(record.content,1000000,'Lore content');}
      if(section==='glossary')string(record.definition,10000,'Definition');
      if(section==='timeline'){
        string(record.date,120,'Event date');string(record.summary,100000,'Event summary');string(record.location,300,'Event location');
        if(record.order!=null&&(typeof record.order!=='number'||!Number.isFinite(record.order)))throw new Error('Event sort order must be a finite number.');
      }
    });
  });
  return DAL.normalizeBible(incoming);
};

DAL.importBibleFile = async function(file,project,generation){
  if(!file)return false;
  if(!Number.isFinite(file.size)||file.size<=0||file.size>32*1024*1024)throw new Error('Choose a nonempty World Bible JSON file no larger than 32 MB.');
  var incoming=DAL.stageBibleImport(await file.text());
  if(generation!==DAL._bibleImportGeneration||!project||DAL.currentProjectId!==project.id||DAL.state.projects[project.id]!==project)throw new Error('Import cancelled because the selected project changed. Your projects are unchanged.');
  incoming.id=DAL.uid('bible');
  var base=incoming.name,suffix=1;
  while((DAL.state.bibleOrder||[]).some(function(id){return DAL.state.bibles[id]&&DAL.state.bibles[id].name===incoming.name;})){
    var ending=' (imported'+(suffix===1?'':' '+suffix)+')';incoming.name=base.slice(0,200-ending.length)+ending;suffix++;
  }
  DAL.state.bibles[incoming.id]=incoming;DAL.state.bibleOrder.push(incoming.id);project.bibleId=incoming.id;
  DAL._bibleRecordId=null;
  DAL.render();
  var saved=false;try{saved=await DAL.saveState(true)===true;}catch(error){}
  DAL.toast(saved?'World Bible imported and saved':'World Bible imported in memory only. Use File → Save Now to retry, or export a backup before closing the app.',saved?'success':'warning');
  return saved;
};

DAL.renderWorldBible = function(proj){
  var bible=DAL.projectBible(proj), html='<div class="world-bible">';
  html+="<div class=\"section-header\"><div><div class=\"section-title\">"+DAL.uiLabel("tool_worldbible","World Bible")+"</div><p class=\"writer-muted\">"+DAL.uiLabel("ui_A_shared_offline_source_of_truth_for_conne_be7850b","A shared, offline source of truth for connected books and campaigns.")+"</p></div></div>";
  if(!bible){
    var options=(DAL.state.bibleOrder||[]).map(function(id){var item=DAL.state.bibles[id];return item?'<option value="'+DAL.escapeHtml(item.id)+'">'+DAL.escapeHtml(item.name)+'</option>':'';}).join('');
    html+="<div class=\"card bible-welcome\"><h3>"+DAL.uiLabel("ui_Connect_this_project_to_a_world_8680210","Connect this project to a world")+"</h3><p>"+DAL.uiLabel("ui_Use_one_pool_of_characters_lore_timeline_e_2fd748e","Use one pool of characters, lore, timeline events, and glossary terms across several projects. A project can be detached later without deleting either its manuscript or the Bible.")+"</p>"+
      "<div class=\"writer-form-grid\"><div class=\"form-group\"><label class=\"form-label\" for=\"newBibleName\">"+DAL.uiLabel("ui_Create_a_new_Bible_439d794","Create a new Bible")+"</label><input class=\"form-input\" id=\"newBibleName\" maxlength=\"200\" value=\""+DAL.escapeHtml(proj.name+' World')+"\"><button class=\"btn primary\" data-action=\"bible-create\">"+DAL.uiLabel("ui_Create_and_connect_2d267b9","Create and connect")+"</button></div>"+
      "<div class=\"form-group\"><label class=\"form-label\" for=\"existingBible\">"+DAL.uiLabel("ui_Connect_an_existing_Bible_2162bd5","Connect an existing Bible")+"</label><select class=\"form-select\" id=\"existingBible\">"+(options||"<option value=\"\">"+DAL.uiLabel("ui_No_Bibles_on_this_device_ef7e7a8","No Bibles on this device")+"</option>")+'</select><button class="btn" data-action="bible-link"'+(options?'':' disabled')+">"+DAL.uiLabel("ui_Connect_1a2303e","Connect")+"</button></div></div>"+
      "<button class=\"btn\" data-action=\"bible-import\">"+DAL.uiLabel("ui_Import_Bible_json__f9ca0cb","Import Bible (.json)")+"</button></div></div>";
    return html;
  }
  var section=DAL._bibleSection||'characters';
  if(['characters','lore','timeline','glossary'].indexOf(section)<0)section='characters';
  var linked=DAL.bibleProjects(bible);
  DAL.finishBibleEdit(bible);var history=DAL.bibleHistory(bible);
  html+='<div class="writer-tool-actions"><button class="btn" data-action="bible-undo"'+(history.undo.length?'':' disabled')+">"+DAL.uiLabel("ui_Undo_world_edit_ba963dc","Undo world edit")+"</button><button class=\"btn\" data-action=\"bible-redo\""+(history.redo.length?'':' disabled')+">"+DAL.uiLabel("ui_Redo_world_edit_208f823","Redo world edit")+"</button><span class=\"writer-muted\">"+DAL.uiLabel("ui_World_undo_is_shared_across_connected_proj_4ca854f","World undo is shared across connected projects for this session.")+"</span></div>";
  html+='<div class="bible-head card"><div><strong>'+DAL.escapeHtml(bible.name)+'</strong><div class="writer-muted">'+DAL.uiLabel('worldSharedProjects','Shared by '+linked.length+' projects',{count:linked.length})+': '+DAL.escapeHtml(linked.map(function(item){return item.name;}).join(', '))+"</div></div><div class=\"writer-tool-actions\"><button class=\"btn\" data-action=\"bible-import-project\">"+DAL.uiLabel("ui_Add_this_project_s_world_records_cf05827","Add this project’s world records")+"</button><button class=\"btn\" data-action=\"bible-export\">"+DAL.uiLabel("ui_Export_Bible_c9c91a3","Export Bible")+"</button><button class=\"btn\" data-action=\"bible-import\">"+DAL.uiLabel("ui_Import_another_ea4fe81","Import another")+"</button><button class=\"btn danger\" data-action=\"bible-unlink\">"+DAL.uiLabel("ui_Detach_project_555f743","Detach project")+"</button></div></div>";
  html+='<div class="bible-tabs">'+[['characters','Characters'],['lore','Lore'],['timeline','Timeline'],['glossary','Glossary']].map(function(tab){return '<button class="btn'+(tab[0]===section?' primary':'')+'" data-action="bible-section" data-section="'+tab[0]+'">'+DAL.uiLabel('worldSection_'+tab[0],tab[1])+' <span class="badge">'+DAL.uiNumber(DAL.bibleRecords(bible,tab[0]).length)+'</span></button>';}).join('')+'</div>';
  var records=DAL.bibleRecords(bible,section), selected=records.find(function(item){return item.id===DAL._bibleRecordId;});
  html+='<div class="bible-layout"><div class="bible-list"><div class="bible-list-head"><strong>'+DAL.uiLabel('worldSection_'+section,section.charAt(0).toUpperCase()+section.slice(1))+"</strong><button class=\"btn sm primary\" data-action=\"bible-add\">"+DAL.uiLabel("ui__Add_c007258","+ Add")+"</button></div>";
  if(!records.length)html+='<div class="empty-state compact"><p>'+DAL.uiLabel('worldNoRecords','No shared records yet.')+"</p><button class=\"btn primary\" data-action=\"bible-add\">"+DAL.uiLabel("ui_Add_the_first_record_f4f2766","Add the first record")+"</button></div>";
  records.slice().sort(function(a,b){return String(DAL.bibleTitle(a,section)).localeCompare(String(DAL.bibleTitle(b,section)));}).forEach(function(record){html+='<button class="bible-record'+(selected&&selected.id===record.id?' is-selected':'')+'" data-action="bible-select" data-record-id="'+DAL.escapeHtml(record.id)+'"><strong>'+DAL.escapeHtml(DAL.bibleTitle(record,section))+'</strong><span>'+DAL.escapeHtml(section==='timeline'?(record.date||'Undated'):(record.status||record.folder||''))+'</span></button>';});
  html+='</div><div class="bible-editor">'+(selected?DAL.renderBibleEditor(selected,section):"<div class=\"empty-state compact\"><p>"+DAL.uiLabel("ui_Select_a_record_to_view_and_edit_it__4a7e50c","Select a record to view and edit it.")+"</p></div>")+'</div></div></div>';
  return html;
};

DAL.renderBibleEditor = function(record, section){
  var titleKey=section==='characters'?'name':(section==='glossary'?'term':'title');
  function label(key,fallback){return DAL.escapeHtml(DAL.i18n?DAL.i18n.text(key,fallback):fallback);}
  function field(key,caption,options){
    options=options||{};var id='bibleField-'+key,value=key==='facts'?DAL.bibleFactsText(record):(key==='aliases'||key==='tags'?(record[key]||[]).join(', '):record[key]==null?'':record[key]);
    var attrs=' id="'+id+'" data-bible-field="'+key+'"'+(options.limit?' maxlength="'+options.limit+'"':'');
    var html='<div class="form-group"><label class="form-label" for="'+id+'">'+label('worldField_'+key,caption)+'</label>';
    if(options.area)html+='<textarea class="form-textarea'+(options.tall?' tall':'')+'"'+attrs+'>'+DAL.escapeHtml(String(value))+'</textarea>';
    else html+='<input class="form-input"'+attrs+(options.number?' type="number" step="any"':'')+' value="'+DAL.escapeHtml(String(value))+'">';
    if(options.help)html+='<span class="u-hint">'+label(options.help[0],options.help[1])+'</span>';
    return html+'</div>';
  }
  var html=field(titleKey,section==='glossary'?'Term':section==='characters'?'Name':'Title',{limit:300});
  if(section!=='timeline')html+=field('aliases','Aliases / alternate names',{help:['worldCommaHelp','Separate entries with commas.']});
  if(section==='characters')html+='<div class="writer-form-grid">'+field('status','Status',{limit:80,help:['worldCharacterStatusHelp','For example: alive, dead, missing.']})+field('role','Role')+'</div>'+field('details','Details',{area:true,tall:true});
  if(section==='lore')html+='<div class="writer-form-grid">'+field('folder','Category',{limit:100})+field('status','Status',{limit:80,help:['worldLoreStatusHelp','For example: active, destroyed, lost.']})+'</div>'+field('content','Entry',{area:true,tall:true,limit:1000000});
  if(section==='glossary')html+=field('definition','Definition',{area:true,tall:true,limit:10000});
  if(section==='timeline')html+='<div class="writer-form-grid">'+field('date','Date / era',{limit:120})+field('order','Sort order',{number:true})+'</div>'+field('location','Location',{limit:300})+field('summary','Summary',{area:true,tall:true,limit:100000});
  if(section!=='timeline')html+=field('facts','Facts',{area:true,help:['worldFactsHelp','One fact per line: label: value.']});
  html+=field('tags','Tags',{help:['worldCommaHelp','Separate entries with commas.']})+'<button class="btn danger" data-action="bible-delete" data-record-id="'+DAL.escapeHtml(record.id)+'">'+label('worldDeleteRecord','Delete record')+'</button>';
  return html;
};

DAL.importProjectIntoBible = function(proj,bible){
  var added=0;
  function has(list,key,value,extra){value=String(value||'').trim().toLowerCase();return list.some(function(item){return String(item[key]||'').trim().toLowerCase()===value&&(!extra||extra(item));});}
  (proj.characters||[]).forEach(function(character){if(has(bible.characters,'name',character.name))return;bible.characters.push({id:DAL.uid('bchar'),name:character.name||'Untitled',aliases:(character.aliases||[]).slice(),status:character.deceased?'dead':(character.status||''),role:character.role||'',details:[character.personality,character.backstory].filter(Boolean).join('\n\n'),tags:(character.tags||[]).slice(),facts:(character.customFields||[]).map(function(field){return{id:DAL.uid('fact'),key:field.label||'',value:String(field.value==null?'':field.value)};})});added++;});
  (((proj.lore||{}).entries)||[]).forEach(function(entry){if(has(bible.lore.entries,'title',entry.title))return;bible.lore.entries.push({id:DAL.uid('blore'),title:entry.title||'Untitled',folder:entry.folder||'Miscellaneous',content:entry.content||'',aliases:(entry.aliases||[]).slice(),status:entry.status||'',tags:(entry.tags||[]).slice(),facts:(entry.facts||[]).slice()});if(bible.lore.folders.indexOf(entry.folder)<0)bible.lore.folders.push(entry.folder);added++;});
  (proj.timeline||[]).forEach(function(event){if(has(bible.timeline,'title',event.title,function(item){return String(item.date||'')===String(event.date||'');}))return;bible.timeline.push({id:DAL.uid('bevent'),title:event.title||'Untitled',date:event.date||'',order:Number(event.order)||0,location:event.location||'',summary:event.summary||'',tags:(event.tags||[]).slice(),facts:[]});added++;});
  bible.updatedAt=Date.now(); return added;
};

DAL._worldClickBase=DAL.handleStoryClick;
DAL.handleStoryClick=function(action,el,e){
  var proj=DAL.state.projects[DAL.currentProjectId],bible=DAL.projectBible(proj),section=DAL._bibleSection||'characters',records,record,id;
  if(action==='bible-undo'||action==='bible-redo'){if(bible)DAL.stepBibleHistory(bible,action==='bible-redo');return;}
  if(action==='bible-create'){
    if(!proj)return;var field=document.getElementById('newBibleName'),name=String(field&&field.value||'').trim();
    if(!name||name.length>200){if(field){field.setAttribute('aria-invalid','true');field.focus();}DAL.toast((DAL.i18n?DAL.i18n.text("ui_Enter_a_world_name_between_1_and_200_chara_1ec9bed","Enter a world name between 1 and 200 characters."):"Enter a world name between 1 and 200 characters."),'warning');return;}
    bible=DAL.defaultBible(name);DAL.state.bibles[bible.id]=bible;DAL.state.bibleOrder.push(bible.id);proj.bibleId=bible.id;DAL._bibleRecordId=null;DAL.render();DAL.saveBibleChanges('World Bible created');return;
  }
  if(action==='bible-link'){id=(document.getElementById('existingBible')||{}).value;if(proj&&id&&DAL.state.bibles[id]){proj.bibleId=id;DAL._bibleRecordId=null;DAL.render();DAL.saveBibleChanges('Project connected to '+DAL.state.bibles[id].name);}return;}
  if(action==='bible-unlink'){if(!proj)return;if(bible)DAL.finishBibleEdit(bible);proj.bibleId='';DAL._bibleRecordId=null;DAL.render();DAL.saveBibleChanges('Project detached; the shared Bible was kept.');return;}
  if(action==='bible-section'){DAL._bibleSection=el.getAttribute('data-section');DAL._bibleRecordId=null;DAL.render();return;}
  if(action==='bible-select'){DAL._bibleRecordId=el.getAttribute('data-record-id');DAL.render();return;}
  if(action==='bible-add'&&bible){DAL.finishBibleEdit(bible);records=DAL.bibleRecords(bible,section);record={id:DAL.uid('bible'),aliases:[],tags:[],facts:[]};if(section==='characters'){record.name='New Character';record.status='alive';record.role='';record.details='';}else if(section==='lore'){record.title='New Lore Entry';record.folder='Miscellaneous';record.content='';record.status='';}else if(section==='timeline'){record.title='New Event';record.date='';record.order=records.reduce(function(max,item){return Math.max(max,Number(item.order)||0);},0)+1;record.location='';record.summary='';}else{record.term='New Term';record.definition='';}records.push(record);DAL.pushBibleHistory(bible,[{section:section,id:record.id,index:records.length-1,before:null,after:DAL.clone(record)}]);DAL._bibleRecordId=record.id;bible.updatedAt=Date.now();DAL.render();DAL.saveBibleChanges('World record added');return;}
  if(action==='bible-delete'&&bible){id=el.getAttribute('data-record-id');records=DAL.bibleRecords(bible,section);record=records.find(function(item){return item.id===id;});if(record&&confirm('Delete “'+DAL.bibleTitle(record,section)+'” from the shared Bible? This affects every connected project. You can Undo during this session.')){DAL.finishBibleEdit(bible);DAL.pushBibleHistory(bible,[{section:section,id:id,index:records.indexOf(record),before:DAL.clone(record),after:null}]);records.splice(records.indexOf(record),1);DAL._bibleRecordId=null;bible.updatedAt=Date.now();DAL.render();DAL.saveBibleChanges('Shared world record deleted');}return;}
  if(action==='bible-import-project'&&bible){
    DAL.finishBibleEdit(bible);var sections=['characters','lore','timeline'],known={},folders=DAL.clone(bible.lore.folders);
    sections.forEach(function(key){known[key]=new Set(DAL.bibleRecords(bible,key).map(function(item){return item.id;}));});
    var count=DAL.importProjectIntoBible(proj,bible),changes=[];
    sections.forEach(function(key){DAL.bibleRecords(bible,key).forEach(function(item,index){if(!known[key].has(item.id))changes.push({section:key,id:item.id,index:index,before:null,after:DAL.clone(item)});});});
    if(JSON.stringify(folders)!==JSON.stringify(bible.lore.folders))changes.push({section:'folders',before:folders,after:DAL.clone(bible.lore.folders)});
    if(changes.length)DAL.pushBibleHistory(bible,changes);DAL.render();if(count)DAL.saveBibleChanges(count+' project records added');else DAL.toast((DAL.i18n?DAL.i18n.text("ui_The_shared_Bible_already_has_those_records_6b85f03","The shared Bible already has those records"):"The shared Bible already has those records"),'info');return;
  }
  if(action==='bible-export'&&bible){DAL.downloadJSON(DAL.sanitizeFilename(bible.name)+'-bible.json',{kind:'draft-a-lore-bible',schemaVersion:DAL.SCHEMA_VERSION,bible:bible}).then(function(saved){if(saved)DAL.toast((DAL.i18n?DAL.i18n.text("ui_World_Bible_export_completed_Check_the_sav_6210f19","World Bible export completed. Check the saved file."):"World Bible export completed. Check the saved file."),'success');});return;}
  if(action==='bible-import'){
    if(DAL._bibleImportBusy){DAL.toast((DAL.i18n?DAL.i18n.text("ui_A_World_Bible_import_is_already_in_progres_f6f0a3a","A World Bible import is already in progress."):"A World Bible import is already in progress."),'info');return;}
    var input=document.createElement('input'),generation=(DAL._bibleImportGeneration||0)+1;DAL._bibleImportGeneration=generation;
    input.type='file';input.accept='.json,application/json';
    input.onchange=function(){
      var file=input.files&&input.files[0];if(!file||generation!==DAL._bibleImportGeneration)return;
      DAL._bibleImportBusy=true;
      DAL.importBibleFile(file,proj,generation).catch(function(error){DAL.toast('Could not import that Bible: '+error.message,'error');}).finally(function(){DAL._bibleImportBusy=false;});
    };
    input.click();return;
  }
  return DAL._worldClickBase(action,el,e);
};

document.addEventListener('input',function(event){
  var el=event.target;if(!el.hasAttribute||!el.hasAttribute('data-bible-field'))return;
  var proj=DAL.state.projects[DAL.currentProjectId],bible=DAL.projectBible(proj),section=DAL._bibleSection||'characters';if(!bible)return;
  var record=DAL.bibleRecords(bible,section).find(function(item){return item.id===DAL._bibleRecordId;});if(!record)return;
  var field=el.getAttribute('data-bible-field');
  var allowed=['name','term','title','aliases','tags','facts','status','role','details','folder','content','definition','date','order','location','summary'];if(allowed.indexOf(field)<0)return;
  if(['name','term','title'].indexOf(field)>=0&&!el.value.trim()){el.setAttribute('aria-invalid','true');return;}
  if(field==='order'&&!Number.isFinite(Number(el.value))){el.setAttribute('aria-invalid','true');return;}el.removeAttribute('aria-invalid');
  var history=DAL.bibleHistory(bible);
  if(!history.pending||history.pending.id!==record.id||history.pending.section!==section||history.pending.field!==field){
    DAL.finishBibleEdit(bible);history.pending={section:section,id:record.id,index:DAL.bibleRecords(bible,section).indexOf(record),field:field,before:DAL.clone(record)};history.redo=[];
    var undoButton=document.querySelector('[data-action="bible-undo"]'),redoButton=document.querySelector('[data-action="bible-redo"]');if(undoButton)undoButton.disabled=false;if(redoButton)redoButton.disabled=true;
  }
  if(field==='aliases'||field==='tags')record[field]=el.value.split(',').map(function(value){return value.trim();}).filter(Boolean);
  else if(field==='facts')record.facts=DAL.parseBibleFacts(el.value);
  else if(field==='order')record.order=Number(el.value)||0;
  else record[field]=el.value;
  record.updatedAt=Date.now();bible.updatedAt=Date.now();DAL.saveState();
});

document.addEventListener('focusout',function(event){
  if(!event.target.hasAttribute||!event.target.hasAttribute('data-bible-field'))return;
  var bible=DAL.projectBible(DAL.state.projects[DAL.currentProjectId]);if(!bible)return;DAL.finishBibleEdit(bible);
  var el=event.target,field=el.getAttribute('data-bible-field');
  if(el.getAttribute('aria-invalid')==='true'){
    var record=DAL.bibleRecords(bible,DAL._bibleSection||'characters').find(function(item){return item.id===DAL._bibleRecordId;});
    if(record&&record[field]!=null)el.value=record[field];el.removeAttribute('aria-invalid');DAL.toast((DAL.i18n?DAL.i18n.text("ui_The_invalid_value_was_not_saved_Record_tit_665f384","The invalid value was not saved. Record titles cannot be blank and sort order must be a finite number."):"The invalid value was not saved. Record titles cannot be blank and sort order must be a finite number."),'warning');
  }
});
