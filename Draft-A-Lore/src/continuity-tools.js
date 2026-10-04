/* Draft A Lore — offline continuity analysis */
DAL = DAL || {};

DAL.continuityText = function(html){
  if(DAL.manuscriptTextModel&&document.createElement){var root=document.createElement('div');root.innerHTML=String(html||'');if(root.childNodes)return DAL.manuscriptTextModel(root,false).text.replace(/\s+/g,' ').trim();}
  return String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim();
};
DAL._worldChapterTexts=new WeakMap();
DAL.chapterWorldText=function(chapter){var cached=DAL._worldChapterTexts.get(chapter);if(cached&&cached.html===chapter.contentHTML)return cached.text;var text=DAL.continuityText(chapter.contentHTML);DAL._worldChapterTexts.set(chapter,{html:chapter.contentHTML,text:text});return text;};
DAL.continuityKey = function(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/[’']/g,'').replace(/[^\p{L}\p{M}\p{N}]+/gu,' ').trim();};
DAL.continuityYear = function(value){var match=String(value||'').match(/(?:^|[^\p{L}\p{N}_])(?:year\s*)?(-?\d{1,6})(?![\p{L}\p{N}_])/iu);return match?Number(match[1]):null;};
DAL.continuityFactKey=function(value){
  var key=DAL.continuityKey(value),aliases={'born':'birth year','birth':'birth year','year of birth':'birth year','died':'death year','death':'death year','year of death':'death year','fell':'destruction year','destroyed':'destruction year','fall year':'destruction year','destroyed year':'destruction year','founded':'foundation year','founded year':'foundation year','year founded':'foundation year'};
  return Object.prototype.hasOwnProperty.call(aliases,key)?aliases[key]:key;
};
DAL.continuityPattern = function(value){value=String(value||'');if(!value.trim())return /(?!)/g;return new RegExp('(^|[^\\p{L}\\p{M}\\p{N}_])('+value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')(?=$|[^\\p{L}\\p{M}\\p{N}_])','igu');};
DAL.continuityMentions = function(text,name){var found=[],pattern=DAL.continuityPattern(name),match;while((match=pattern.exec(text))){found.push(match.index+match[1].length);if(!match[0].length)pattern.lastIndex++;}return found;};
DAL.continuityContext=function(text,offset,length){
  var start=Math.max(0,offset-180),end=Math.min(text.length,offset+length+180),prefix=text.slice(start,offset),suffix=text.slice(offset+length,end);
  var boundary=prefix.search(/[^.!?。！？]*$/u);if(boundary>=0)start+=boundary;
  var stop=suffix.search(/[.!?。！？]/u);if(stop>=0)end=offset+length+stop+1;
  return text.slice(start,end);
};
DAL.continuitySceneYear=function(chapter,text){
  if(chapter.storyYear!==undefined&&chapter.storyYear!==null&&chapter.storyYear!==''&&Number.isFinite(Number(chapter.storyYear)))return Number(chapter.storyYear);
  var match=text.match(/(?:^|[^\p{L}\p{N}_])year\s*(-?\d{1,6})(?![\p{L}\p{N}_])/iu);return match?Number(match[1]):null;
};
DAL.worldNamePattern=function(){return /(?<![\p{L}\p{M}\p{N}_])[\p{Lu}][\p{L}\p{M}’'-]{2,}(?:[ \t]+[\p{Lu}][\p{L}\p{M}’'-]{2,}){0,2}(?![\p{L}\p{M}\p{N}_])/gu;};

DAL.continuityRecords = function(proj){
  var records=[],bible=DAL.projectBible&&DAL.projectBible(proj);
  function add(kind,id,name,aliases,status,facts,target,body){if(!String(name||'').trim())return;records.push({kind:kind,id:id,name:String(name),aliases:(aliases||[]).filter(Boolean),status:String(status||''),facts:(facts||[]).filter(Boolean),target:target,body:String(body||'')});}
  (proj.characters||[]).forEach(function(character){var facts=(character.customFields||[]).map(function(field){return{key:field.label||'',value:String(field.value==null?'':field.value)};});if(character.deathChapterId)facts.push({key:'death chapter',value:character.deathChapterId});add('Character',character.id,character.name,character.aliases,character.deceased?'dead':character.status,facts,{kind:'character',id:character.id},[character.backstory,character.arc].join(' '));});
  (((proj.lore||{}).entries)||[]).forEach(function(entry){add('Lore',entry.id,entry.title,entry.aliases,entry.status,entry.facts,{kind:'lore',id:entry.id},entry.content);});
  (((proj.adventure||{}).items)||[]).forEach(function(item){add('Item',item.id,item.name,item.aliases,item.status,item.facts,{kind:'item',id:item.id},item.description);});
  if(bible){
    (bible.characters||[]).forEach(function(character){add('Shared character',character.id,character.name,character.aliases,character.status,character.facts,{kind:'bible',section:'characters',id:character.id},character.details);});
    (((bible.lore||{}).entries)||[]).forEach(function(entry){add('Shared lore',entry.id,entry.title,entry.aliases,entry.status,entry.facts,{kind:'bible',section:'lore',id:entry.id},entry.content);});
    (bible.glossary||[]).forEach(function(entry){add('Glossary',entry.id,entry.term,entry.aliases,entry.status,entry.facts,{kind:'bible',section:'glossary',id:entry.id},entry.definition);});
  }
  return records;
};

DAL.runContinuity = function(proj){
  var issues=[],signatures=Object.create(null),chapters=(proj.chapters||[]).slice().sort(function(a,b){return Number(a.order||0)-Number(b.order||0);});
  var chapterIndex=Object.create(null);chapters.forEach(function(chapter,index){chapterIndex[chapter.id]=index;});
  var texts=chapters.map(function(chapter){return DAL.chapterWorldText(chapter);}),records=DAL.continuityRecords(proj),bible=DAL.projectBible&&DAL.projectBible(proj);
  function add(rule,severity,title,detail,target,key,needle){var signature=[rule,target&&target.kind,target&&target.id,key||''].join('|');if(signatures[signature])return;signatures[signature]=true;issues.push({signature:signature,rule:rule,severity:severity,title:title,detail:detail,target:target||null,needle:needle||''});}
  function validIds(list){var map=Object.create(null);(list||[]).forEach(function(item){map[item.id]=true;});return map;}
  var chars=validIds(proj.characters),plots=validIds(proj.plots),chapterIds=validIds(proj.chapters);
  var allCharacters=Object.assign(Object.create(null),chars,validIds(bible&&bible.characters));
  chapters.forEach(function(chapter){if(chapter.povCharacterId&&['first-person','ensemble'].indexOf(chapter.povCharacterId)<0&&!allCharacters[chapter.povCharacterId])add('stale-reference','warning','Chapter has a missing viewpoint character',chapter.title+' uses a deleted viewpoint character.',{kind:'chapter',id:chapter.id},'pov-'+chapter.povCharacterId);});
  (proj.characters||[]).forEach(function(character){if(character.deathChapterId&&!chapterIds[character.deathChapterId])add('stale-reference','error','Character has a missing death chapter',character.name+' points to a deleted death chapter.',{kind:'character',id:character.id},'death-'+character.deathChapterId);});
  (proj.relationships||[]).forEach(function(rel){if(!chars[rel.fromCharId]||!chars[rel.toCharId])add('stale-reference','error','Broken relationship','A relationship points to a character that no longer exists.',{kind:'relationships',id:rel.id},rel.id);});
  (proj.plots||[]).forEach(function(plot){
    (plot.linkedCharacterIds||[]).forEach(function(id){if(!chars[id])add('stale-reference','error','Plot has a missing character',plot.title+' links to a deleted character.',{kind:'plot',id:plot.id},'character-'+id);});
    (plot.linkedChapterIds||[]).forEach(function(id){if(!chapterIds[id])add('stale-reference','error','Plot has a missing chapter',plot.title+' links to a deleted chapter.',{kind:'plot',id:plot.id},'chapter-'+id);});
    if(plot.introducedChapterId&&!chapterIds[plot.introducedChapterId])add('stale-reference','error','Plot has a missing introduction chapter',plot.title+' points to a deleted introduction chapter.',{kind:'plot',id:plot.id},'introduced-'+plot.introducedChapterId);
    if(plot.resolvedChapterId&&!chapterIds[plot.resolvedChapterId])add('stale-reference','error','Plot has a missing resolution chapter',plot.title+' points to a deleted resolution chapter.',{kind:'plot',id:plot.id},'resolved-'+plot.resolvedChapterId);
    var introduced=chapterIndex[plot.introducedChapterId],resolved=chapterIndex[plot.resolvedChapterId];
    if(introduced!==undefined&&resolved!==undefined&&resolved<introduced)add('plot-order','error',plot.title+' resolves before it is introduced','The resolution is anchored to '+chapters[resolved].title+', before its introduction in '+chapters[introduced].title+'.',{kind:'plot',id:plot.id},'resolution-order');
    if(plot.status==='resolved'&&!plot.resolvedChapterId)add('plot-resolution','note',plot.title+' has no resolution anchor','This thread is marked resolved, but no resolution chapter is selected.',{kind:'plot',id:plot.id},'missing-resolution');
    if(['proofreading','completed','published'].indexOf(proj.status)>=0&&plot.status!=='resolved'&&plot.status!=='dormant')add('open-plot','warning',plot.title+' remains open','The project is '+proj.status+', but this plot thread is still '+plot.status+'. Resolve it, mark it dormant, or mark this warning intentional.',{kind:'plot',id:plot.id},'open-at-finish');
    if(!(plot.linkedChapterIds||[]).length&&!plot.introducedChapterId&&!texts.some(function(text){return DAL.continuityMentions(text,plot.title).length;}))add('orphaned-plot','warning',plot.title+' is disconnected','This plot thread has no linked or introduction chapter and its title does not appear in the manuscript.',{kind:'plot',id:plot.id},'orphaned');
  });
  (((proj.lore||{}).entries)||[]).forEach(function(entry){(entry.linkedCharIds||[]).forEach(function(id){if(!chars[id])add('stale-reference','error','Lore has a missing character',entry.title+' links to a deleted character.',{kind:'lore',id:entry.id},'character-'+id);});(entry.linkedPlotIds||[]).forEach(function(id){if(!plots[id])add('stale-reference','error','Lore has a missing plot',entry.title+' links to a deleted plot thread.',{kind:'lore',id:entry.id},'plot-'+id);});});
  (proj.timeline||[]).forEach(function(event){if(event.chapterId&&!chapterIds[event.chapterId])add('stale-reference','error','Timeline has a missing chapter',event.title+' points to a deleted chapter.',{kind:'timeline',id:event.id},'chapter-'+event.chapterId);(event.characterIds||[]).forEach(function(id){if(!chars[id])add('stale-reference','error','Timeline has a missing character',event.title+' points to a deleted character.',{kind:'timeline',id:event.id},'character-'+id);});});

  var factGroups=Object.create(null);
  function factsFor(record){var facts=(record.facts||[]).slice(),body=record.body||'',match,re=/(born|birth year|founded|fell|destroyed|died)\s*(?:in|during|:|was)?\s*(?:the\s+)?(?:year\s*)?(-?\d{1,6})/ig;while((match=re.exec(body)))facts.push({key:match[1],value:match[2]});return facts;}
  records.forEach(function(record){var entityKey=DAL.continuityKey(record.name);factsFor(record).forEach(function(fact){var key=DAL.continuityFactKey(fact.key),value=String(fact.value==null?'':fact.value).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();if(!key||!value)return;var groupKey=entityKey+'|'+key;if(!factGroups[groupKey])factGroups[groupKey]=[];factGroups[groupKey].push({value:value,raw:fact.value,record:record,key:fact.key});});});
  Object.keys(factGroups).forEach(function(key){var group=factGroups[key],values=[];group.forEach(function(fact){if(values.indexOf(fact.value)<0)values.push(fact.value);});if(values.length>1){var first=group[0];add('contradictory-fact','error','Conflicting fact for '+first.record.name,'“'+first.key+'” has different values: '+group.map(function(fact){return '“'+fact.raw+'”';}).join(', ')+'.',first.record.target,key);}});

  records.forEach(function(record){
    var canonicalHits=0,aliasHits=0;
    texts.forEach(function(text){canonicalHits+=DAL.continuityMentions(text,record.name).length;(record.aliases||[]).forEach(function(alias){aliasHits+=DAL.continuityMentions(text,alias).length;});});
    if(canonicalHits&&aliasHits)add('name-variation','note','Name usage varies for '+record.name,'The manuscript uses both the canonical name and an alias. Review the changes to make sure they are intentional.',record.target,'aliases',record.name);
    var status=DAL.continuityKey(record.status),deathFact=factsFor(record).find(function(fact){return /death chapter|dies chapter|died chapter/.test(DAL.continuityKey(fact.key));});
    if(/\b(dead|deceased|killed)\b/.test(status)){
      var deathAt=deathFact?(chapterIndex[deathFact.value]!==undefined?chapterIndex[deathFact.value]:chapters.findIndex(function(chapter){return DAL.continuityKey(chapter.title)===DAL.continuityKey(deathFact.value);})): -1;
      if(deathAt<0)add('unanchored-status','note',record.name+' is marked dead','Choose the death chapter (or add a “death chapter” fact in the Bible) so later appearances can be checked.',record.target,'death-anchor');
      else chapters.forEach(function(chapter,index){
        if(index<=deathAt)return;var text=texts[index],names=[record.name].concat(record.aliases||[]),suspect='';
        names.some(function(name){return DAL.continuityMentions(text,name).some(function(offset){if(!/(resurrect|reviv|raised from|returned from the dead|ghost|memor|flashback|mourn|grave|dead|died|remember|used to)/i.test(DAL.continuityContext(text,offset,name.length))){suspect=name;return true;}return false;});});
        if(suspect)add('post-death-appearance','warning',record.name+' is mentioned after death','The character is marked dead in '+chapters[deathAt].title+' but is named in '+chapter.title+' without a nearby explanation cue. Review the passage: a mention alone does not prove the character is alive.',{kind:'chapter',id:chapter.id},record.id,suspect);
      });
    }
    if(/\b(destroyed|fallen|lost)\b/.test(status)){
      var destroyed=factsFor(record).find(function(fact){return DAL.continuityFactKey(fact.key)==='destruction year';}),destroyedYear=destroyed&&DAL.continuityYear(destroyed.value);
      if(destroyedYear!==null&&destroyedYear!==undefined)chapters.forEach(function(chapter,index){var text=texts[index],year=DAL.continuitySceneYear(chapter,text),suspect=DAL.continuityMentions(text,record.name).some(function(offset){return !/(ruin|rebuild|restore|former|once stood|remember|flashback)/i.test(DAL.continuityContext(text,offset,record.name.length));});if(year!==null&&year>destroyedYear&&suspect)add('destroyed-place','warning',record.name+' is referenced after its destruction','This passage appears to be in Year '+year+', after the recorded destruction in Year '+destroyedYear+', without a nearby ruin or rebuilding cue. Review the reference; the scanner cannot infer the scene’s meaning.',{kind:'chapter',id:chapter.id},record.id,record.name);});
    }
  });

  var timeline=(proj.timeline||[]).concat(bible?(bible.timeline||[]):[]);
  timeline.forEach(function(event){
    if(event.chapterId&&chapterIndex[event.chapterId]!==undefined){var anchor=chapterIndex[event.chapterId];for(var i=0;i<anchor;i++){if(DAL.continuityMentions(texts[i],event.title).length&&!/(foreshadow|prophecy|plan|before|will happen)/i.test(texts[i])){add('event-before-anchor','warning',event.title+' appears before its timeline anchor','The event is anchored to '+chapters[anchor].title+' but already appears in '+chapters[i].title+'.', {kind:'chapter',id:chapters[i].id},event.id,event.title);break;}}}
  });
  var linkedByChapter=timeline.filter(function(event){return event.chapterId&&chapterIndex[event.chapterId]!==undefined&&DAL.continuityYear(event.date)!==null;}).sort(function(a,b){return chapterIndex[a.chapterId]-chapterIndex[b.chapterId];});
  for(var t=1;t<linkedByChapter.length;t++){var before=DAL.continuityYear(linkedByChapter[t-1].date),after=DAL.continuityYear(linkedByChapter[t].date),intentional=(linkedByChapter[t].tags||[]).some(function(tag){return /^(flashback|nonlinear|non-linear|time travel)$/i.test(String(tag).trim());});if(after<before&&!intentional)add('timeline-order','warning','Timeline years run backward',linkedByChapter[t].title+' is Year '+after+' after a chapter-linked event in Year '+before+'. Mark a flashback in its tags or correct the order.',{kind:'timeline',id:linkedByChapter[t].id},linkedByChapter[t-1].id);}

  var known=Object.create(null);records.forEach(function(record){known[DAL.continuityKey(record.name)]=true;(record.aliases||[]).forEach(function(alias){known[DAL.continuityKey(alias)]=true;});});
  var common={the:1,this:1,that:1,chapter:1,however:1,when:1,where:1,then:1,after:1,before:1,into:1,from:1,with:1,they:1,she:1,he:1,his:1,her:1,its:1,year:1,monday:1,tuesday:1,wednesday:1,thursday:1,friday:1,saturday:1,sunday:1};
  var unknown=Object.create(null);texts.forEach(function(text,chapterAt){var match,re=DAL.worldNamePattern();while((match=re.exec(text))){var value=match[0].trim(),key=DAL.continuityKey(value);if(!key||known[key]||common[key]||common[key.split(' ')[0]])continue;if(!unknown[key])unknown[key]={name:value,count:0,chapter:chapters[chapterAt]};unknown[key].count++;}});Object.keys(unknown).forEach(function(key){var candidate=unknown[key];if(candidate.count>=2)add('uncatalogued-name','note','Uncatalogued name: '+candidate.name,'This capitalized name appears '+candidate.count+' times but does not match a project or shared-Bible record. Add it to the Bible, correct the spelling, or mark it intentional.',{kind:'chapter',id:candidate.chapter.id},key,candidate.name);});
  issues.sort(function(a,b){var rank={error:0,warning:1,note:2};return rank[a.severity]-rank[b.severity]||a.title.localeCompare(b.title);});
  var report={ranAt:Date.now(),issues:issues,counts:{error:0,warning:0,note:0}};issues.forEach(function(issue){report.counts[issue.severity]++;});
  if(!DAL._continuityReports)DAL._continuityReports={};DAL._continuityReports[proj.id]=report;return report;
};

DAL.renderContinuity = function(proj){
  var report=DAL._continuityReports&&DAL._continuityReports[proj.id],filter=DAL._continuityFilter||'active',ignored=(proj.continuity&&proj.continuity.ignored)||{};
  var html="<div class=\"continuity-view\"><div class=\"section-header\"><div><div class=\"section-title\">"+DAL.uiLabel("ui_Continuity_Checker_95e3067","Continuity Checker")+"</div><p class=\"writer-muted\">"+DAL.uiLabel("ui_Checks_the_manuscript_project_records_RPG__f3237a1","Checks the manuscript, project records, RPG tables, and linked World Bible together. Everything runs on this device.")+"</p></div><button class=\"btn primary\" data-action=\"continuity-run\">"+DAL.uiLabel("ui_Run_Continuity_Check_e33a28e","Run Continuity Check")+"</button></div>";
  html+='<div class="card continuity-settings"><label><input type="checkbox" data-action="continuity-live"'+(proj.continuity&&proj.continuity.live?' checked':'')+">"+DAL.uiLabel("ui_Check_the_current_chapter_while_I_write_02dd136"," Check the current chapter while I write")+"</label><span class=\"writer-muted\">"+DAL.uiLabel("ui_Live_checking_is_debounced_and_only_annota_b4fbe6e","Live checking is debounced and only annotates; it never changes prose.")+"</span></div>";
  if(!report)return html+"<div class=\"empty-state\"><h3>"+DAL.uiLabel("ui_Ready_to_check_the_whole_world_5d2b28d","Ready to check the whole world")+"</h3><p>"+DAL.uiLabel("ui_Run_the_scanner_to_find_stale_links_contra_3eb839d","Run the scanner to find stale links, contradictory facts, naming drift, timeline order problems, and status conflicts.")+"</p></div></div>";
  html+='<div class="continuity-summary"><div class="card error"><strong>'+report.counts.error+"</strong>"+DAL.uiLabel("ui_errors_ffb2f0a"," errors")+"</div><div class=\"card warning\"><strong>"+report.counts.warning+"</strong>"+DAL.uiLabel("ui_warnings_ad2bfff"," warnings")+"</div><div class=\"card note\"><strong>"+report.counts.note+"</strong>"+DAL.uiLabel("ui_notes_1c55031"," notes")+"</div><div class=\"writer-muted\">Last run "+DAL.uiDate(report.ranAt)+'</div></div>';
  html+='<div class="continuity-filters"><button class="btn sm'+(filter==='active'?' primary':'')+"\" data-action=\"continuity-filter\" data-filter=\"active\">"+DAL.uiLabel("ui_Active_9234069","Active")+"</button><button class=\"btn sm"+(filter==='error'?' primary':'')+"\" data-action=\"continuity-filter\" data-filter=\"error\">"+DAL.uiLabel("ui_Errors_cb70237","Errors")+"</button><button class=\"btn sm"+(filter==='warning'?' primary':'')+"\" data-action=\"continuity-filter\" data-filter=\"warning\">"+DAL.uiLabel("ui_Warnings_0e04cd1","Warnings")+"</button><button class=\"btn sm"+(filter==='note'?' primary':'')+"\" data-action=\"continuity-filter\" data-filter=\"note\">"+DAL.uiLabel("ui_Notes_8a7525b","Notes")+"</button><button class=\"btn sm"+(filter==='ignored'?' primary':'')+"\" data-action=\"continuity-filter\" data-filter=\"ignored\">"+DAL.uiLabel("ui_Dismissed_intentional_dd2be36","Dismissed / intentional")+"</button><button class=\"btn sm\" data-action=\"continuity-export\">"+DAL.uiLabel("ui_Export_report_556d19d","Export report")+"</button></div>";
  var visible=report.issues.filter(function(issue){var hidden=!!ignored[issue.signature];return filter==='ignored'?hidden:(!hidden&&(filter==='active'||issue.severity===filter));});
  html+='<div class="continuity-list">'+(visible.length?visible.map(function(issue){var decision=ignored[issue.signature];return '<article class="continuity-issue '+issue.severity+'"><div class="continuity-severity">'+issue.severity+'</div><div><strong>'+DAL.escapeHtml(issue.title)+'</strong><p>'+DAL.escapeHtml(issue.detail)+'</p>'+(decision?'<span class="badge">'+DAL.escapeHtml(decision.mode)+'</span>':'')+'</div><div class="writer-tool-actions"><button class="btn sm" data-action="continuity-open" data-signature="'+DAL.escapeHtml(issue.signature)+"\">"+DAL.uiLabel("ui_Open_ed077f3","Open")+"</button>"+(decision?'<button class="btn sm" data-action="continuity-restore" data-signature="'+DAL.escapeHtml(issue.signature)+"\">"+DAL.uiLabel("ui_Restore_a76e13b","Restore")+"</button>":'<button class="btn sm" data-action="continuity-dismiss" data-signature="'+DAL.escapeHtml(issue.signature)+"\">"+DAL.uiLabel("ui_Dismiss_48845bf","Dismiss")+"</button><button class=\"btn sm\" data-action=\"continuity-intentional\" data-signature=\""+DAL.escapeHtml(issue.signature)+"\">"+DAL.uiLabel("ui_Intentional_af37462","Intentional")+"</button>")+'</div></article>';}).join(''):"<div class=\"empty-state compact\"><p>"+DAL.uiLabel("ui_No_issues_in_this_view__c317f57","No issues in this view.")+"</p></div>")+'</div></div>';
  return html;
};

DAL.openContinuityIssue = function(proj,issue){
  if(!proj||DAL.currentProjectId!==proj.id||DAL.state.projects[proj.id]!==proj||!issue||!issue.target)return;
  var target=issue.target;
  var records=target.kind==='chapter'?proj.chapters:target.kind==='character'?proj.characters:target.kind==='plot'?proj.plots:target.kind==='lore'?(proj.lore||{}).entries:target.kind==='timeline'?proj.timeline:target.kind==='item'?(proj.adventure||{}).items:null;
  if(target.kind==='bible'){var bible=DAL.projectBible&&DAL.projectBible(proj);records=bible&&DAL.bibleRecords(bible,target.section);}
  if(target.kind!=='relationships'&&(!records||!records.some(function(record){return record.id===target.id;}))){DAL.toast((DAL.i18n?DAL.i18n.text("ui_That_record_no_longer_exists_Run_Continuit_703e582","That record no longer exists. Run Continuity Check again."):"That record no longer exists. Run Continuity Check again."),'warning');return;}
  if(DAL.currentTool==='manuscript'&&DAL.saveChapterContent)DAL.saveChapterContent();
  var request=(DAL._continuityJumpGeneration||0)+1;DAL._continuityJumpGeneration=request;
  if(target.kind==='chapter'){DAL.currentTool='manuscript';DAL.selectedChapterId=target.id;}
  else if(target.kind==='character'){DAL.currentTool='characters';DAL.selectedCharId=target.id;}
  else if(target.kind==='plot'){DAL.currentTool='plots';DAL.selectedPlotId=target.id;}
  else if(target.kind==='lore'){DAL.currentTool='lore';DAL.selectedLoreEntry=target.id;var entry=((proj.lore||{}).entries||[]).find(function(item){return item.id===target.id;});if(entry)DAL.selectedLoreFolder=entry.folder;}
  else if(target.kind==='timeline'){DAL.currentTool='timeline';DAL.selectedTimelineId=target.id;}
  else if(target.kind==='relationships')DAL.currentTool='relationships';
  else if(target.kind==='item')DAL.currentTool='items';
  else if(target.kind==='bible'){DAL.currentTool='worldbible';DAL._bibleSection=target.section;DAL._bibleRecordId=target.id;}
  DAL.render();
  if(target.kind==='chapter'&&issue.needle){
    var editor=document.getElementById('editorContent'),html=editor&&editor.innerHTML;
    setTimeout(function(){
      if(request!==DAL._continuityJumpGeneration||DAL.currentProjectId!==proj.id||DAL.state.projects[proj.id]!==proj||DAL.currentTool!=='manuscript'||DAL.selectedChapterId!==target.id||!editor||document.getElementById('editorContent')!==editor||editor.innerHTML!==html)return;
      var model=DAL.manuscriptTextModel(editor),match=DAL.continuityPattern(issue.needle).exec(model.text);if(!match)return;
      var start=match.index+match[1].length,end=start+match[2].length,first=model.nodes.find(function(part){return part.start<=start&&start<part.end;}),last=model.nodes.find(function(part){return part.start<end&&end<=part.end;});if(!first||!last)return;
      var range=document.createRange();range.setStart(first.node,start-first.start);range.setEnd(last.node,end-last.start);editor.focus();var selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);first.node.parentElement&&first.node.parentElement.scrollIntoView({block:'center'});
    },80);
  }
};

DAL._continuityClickBase=DAL.handleStoryClick;
DAL.handleStoryClick=function(action,el,e){
  var proj=DAL.state.projects[DAL.currentProjectId],report=proj&&DAL._continuityReports&&DAL._continuityReports[proj.id],signature=el.getAttribute&&el.getAttribute('data-signature'),issue=report&&report.issues.find(function(item){return item.signature===signature;});
  if(action==='continuity-run'){DAL.runContinuity(proj);DAL.render();DAL.toast((DAL.i18n?DAL.i18n.text("ui_Continuity_check_complete_e1477a4","Continuity check complete"):"Continuity check complete"),'success');return;}
  if(action==='continuity-live'){proj.continuity.live=el.checked;DAL.saveState(true);DAL.toast('Live continuity checking '+(el.checked?'enabled':'disabled'),'info');return;}
  if(action==='continuity-filter'){DAL._continuityFilter=el.getAttribute('data-filter');DAL.render();return;}
  if(action==='continuity-open'){DAL.openContinuityIssue(proj,issue);return;}
  if(action==='continuity-dismiss'||action==='continuity-intentional'){if(issue){proj.continuity.ignored[issue.signature]={mode:action==='continuity-intentional'?'intentional':'dismissed',at:Date.now()};DAL.saveState();DAL.render();}return;}
  if(action==='continuity-restore'){if(signature){delete proj.continuity.ignored[signature];DAL.saveState();DAL.render();}return;}
  if(action==='continuity-export'&&report){var lines=['# Continuity report: '+proj.name,'','Run: '+DAL.uiDate(report.ranAt),''];report.issues.forEach(function(item){lines.push('- ['+item.severity.toUpperCase()+'] '+item.title+' — '+item.detail+(proj.continuity.ignored[item.signature]?' ('+proj.continuity.ignored[item.signature].mode+')':''));});DAL.download(DAL.sanitizeFilename(proj.name)+'-continuity-report.md',lines.join('\n'),'text/markdown');return;}
  return DAL._continuityClickBase(action,el,e);
};
