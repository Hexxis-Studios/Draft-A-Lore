/* Manuscript review, reference and structured-writing tools. */
(function(){
  var COLORS = [['#fff59d','Yellow'],['#b9f6ca','Green'],['#b3e5fc','Blue'],['#f8bbd0','Pink'],['#d1c4e9','Purple'],['#ffcc80','Orange']];

  function project(){ return DAL.currentWriterProject && DAL.currentWriterProject(); }
  function data(proj){
    var d = DAL.writerProject(proj);
    ['highlights','bookmarks','footnotes','sources'].forEach(function(key){ if(!Array.isArray(d[key])) d[key]=[]; });
    if(!d.exportOptions) d.exportOptions={highlights:false,comments:false,footnotes:true,callouts:true};
    return d;
  }
  function editor(){ return document.getElementById('editorContent'); }
  function save(){ DAL.saveChapterContent(); DAL.captureWriterSelection(); }
  function restore(){ var sel=window.getSelection&&window.getSelection(),ed=editor(); if(!sel||!ed||!DAL._writerRange||!ed.contains(DAL._writerRange.commonAncestorContainer))return false; try{sel.removeAllRanges();sel.addRange(DAL._writerRange);return true;}catch(e){return false;} }
  function unwrap(node){ var p=node.parentNode; if(!p)return; while(node.firstChild)p.insertBefore(node.firstChild,node);p.removeChild(node); }
  function insert(html){
    var ed=editor();if(!ed)return;ed.focus();restore();
    if(/^<(aside|table|blockquote|pre|ul|ol|hr|div)\b/i.test(html)&&DAL._writerRange){
      var range=DAL._writerRange.cloneRange(),top=range.commonAncestorContainer;if(top.nodeType===3)top=top.parentNode;
      while(top&&top.parentNode&&top.parentNode!==ed)top=top.parentNode;
      if(!range.collapsed)range.deleteContents();
      if(top&&top.parentNode===ed)range.setStartAfter(top);else{range.selectNodeContents(ed);range.collapse(false);}
      range.collapse(true);var fragment=range.createContextualFragment(html),last=fragment.lastChild;range.insertNode(fragment);
      if(last){range.setStartAfter(last);range.collapse(true);var sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);DAL._writerRange=range.cloneRange();}
    }else document.execCommand('insertHTML',false,html);
    save();
  }
  function selectedText(){ return DAL._writerRange ? String(DAL._writerRange) : ''; }
  function writerText(key,fallback,values){return DAL.i18n?DAL.i18n.text(key,fallback,values):fallback;}
  function fieldValue(id){return ((document.getElementById(id)||{}).value||'').trim();}
  function fieldError(id,key,fallback){var field=document.getElementById(id);if(field){field.setAttribute('aria-invalid','true');field.focus();}DAL.toast(writerText(key,fallback),'warning');}
  function writerContext(){var proj=project(),ed=editor(),range=DAL._writerRange;return {project:proj,chapterId:DAL.selectedChapterId,editor:ed,html:ed&&ed.innerHTML,range:range&&ed&&ed.contains(range.commonAncestorContainer)?range.cloneRange():null};}
  function validWriterContext(context){return !!(context&&context.project===project());}
  function validInsertionContext(context){return !!(validWriterContext(context)&&DAL.currentTool==='manuscript'&&context.chapterId===DAL.selectedChapterId&&context.editor===editor()&&context.html===context.editor.innerHTML&&context.range&&context.editor.contains(context.range.commonAncestorContainer)&&DAL.chapterById(context.project,context.chapterId));}
  function internalTarget(proj,value){
    var split=value.indexOf(':'),kind=value.slice(0,split),id=value.slice(split+1),records;
    if(split<1||!id||!proj)return null;
    if(kind==='chapter')records=proj.chapters;else if(kind==='character')records=proj.characters;else if(kind==='lore')records=(proj.lore||{}).entries;else if(kind==='plot')records=proj.plots;else if(kind==='scene')records=(proj.adventure||{}).nodes;else return null;
    var record=(records||[]).find(function(x){return x.id===id;});return record?{kind:kind,id:id,record:record}:null;
  }
  function validAddress(value){
    if(!value||/[\u0000-\u0020\u007f]/.test(value))return false;
    try{var parsed=new URL(value);if(/^https?:\/\//i.test(value))return !!parsed.hostname&&!parsed.username&&!parsed.password;if(/^mailto:/i.test(value))return /^[^?]+@[^?]+$/.test(parsed.pathname); }catch(e){}
    return false;
  }
  function selectedLink(){
    var ed=editor(),range=DAL._writerRange;if(!ed||!range||!ed.contains(range.commonAncestorContainer))return null;
    var node=range.startContainer||range.commonAncestorContainer;
    if(node.nodeType===1&&node.childNodes&&node.childNodes[range.startOffset])node=node.childNodes[range.startOffset];
    while(node&&node!==ed){if(node.nodeType===1&&String(node.tagName).toLowerCase()==='a'&&node.getAttribute('href'))return node;node=node.parentNode;}return null;
  }
  function openWriterDestination(href){
    var proj=project();if(!proj)return;
    if(href.indexOf('#dal:')!==0){
      if(!validAddress(href)){DAL.toast(writerText('invalidLinkAddress','Enter a complete http://, https:// or mailto: address, or choose a project record.'),'warning');return;}
      if(/^https?:\/\//i.test(href))window.open(href,'_blank','noopener');else window.location.href=href;return;
    }
    var target=internalTarget(proj,href.slice(5));if(!target){DAL.toast(writerText('missingLinkedRecord','This project record no longer exists. Choose another record.'),'warning');return;}
    if(DAL.saveChapterContent&&DAL.currentTool==='manuscript')DAL.saveChapterContent();
    if(target.kind==='chapter'){DAL.selectedChapterId=target.id;DAL.currentTool='manuscript';}else if(target.kind==='character'){DAL.selectedCharId=target.id;DAL.currentTool='characters';}else if(target.kind==='lore'){DAL.selectedLoreEntry=target.id;DAL.currentTool='lore';}else if(target.kind==='plot'){DAL.selectedPlotId=target.id;DAL.currentTool='plots';}else if(target.kind==='scene'){DAL.selectedNodeId=target.id;DAL.currentTool='storygraph';}DAL.render();
  }
  function finishReferenceSave(context,button){
    if(context.pending)return;
    renumberFootnotes(context.project,data(context.project));reviewBarrier(context.project);
    context.pending=true;var fields=Array.from(document.querySelectorAll('#sourceTitle,#sourceAuthor,#sourceEdition,#sourceDate,#sourceReference,#sourceUrl,#sourceNote,#writerFootnoteText'));
    fields.forEach(function(field){field.disabled=true;});if(button)button.disabled=true;
    var result;try{result=DAL.saveState(true);}catch(e){result=false;}
    Promise.resolve(result).then(function(ok){
      context.pending=false;fields.forEach(function(field){field.disabled=false;});if(button)button.disabled=false;
      if(ok!==true){DAL.toast(writerText('referenceMemoryOnly','Reference changes are still in memory. Retry saving or download a workspace backup before closing the app.'),'warning');return;}
      if(DAL._writerReferenceContext===context&&validWriterContext(context)&&fields.length&&document.getElementById(fields[0].id)===fields[0])DAL.showWriterReferences();
    },function(){context.pending=false;fields.forEach(function(field){field.disabled=false;});if(button)button.disabled=false;DAL.toast(writerText('referenceMemoryOnly','Reference changes are still in memory. Retry saving or download a workspace backup before closing the app.'),'warning');});
  }
  function reviewText(key,fallback,values){return DAL.escapeHtml(writerText(key,fallback,values));}
  function highlightColor(value){
    value=String(value||'').trim();
    if(/^#[0-9a-f]{6}$/i.test(value))return value.toLowerCase();
    var match=/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.exec(value);
    if(match&&match.slice(1).every(function(n){return +n<=255;}))return '#'+match.slice(1).map(function(n){return (+n).toString(16).padStart(2,'0');}).join('');
    return '#fff59d';
  }

  DAL.captureWriterSelection=function(){
    var sel=window.getSelection&&window.getSelection(); if(!sel||!sel.rangeCount)return;
    var range=sel.getRangeAt(0), ed=editor();
    if(ed&&ed.contains(range.commonAncestorContainer)) DAL._writerRange=range.cloneRange();
  };

  DAL.renderAdvancedWriterToolbar=function(){
    function text(key,fallback){return DAL.escapeHtml(DAL.i18n?DAL.i18n.text(key,fallback):fallback);}
    var colors='<option value="">'+text('highlight','Highlight')+'</option>'+COLORS.map(function(c){return '<option value="'+c[0]+'">'+text('highlightColor_'+c[0].slice(1),c[1])+'</option>';}).join('')+'<option value="clear">'+text('removeHighlight','Remove highlight')+'</option>';
    return '<span class="tb-sep"></span><select class="writer-highlight-select" data-writer-control="highlight" aria-label="'+text('highlightSelectedText','Highlight selected text')+'">'+colors+'</select><input class="writer-highlight-custom" type="color" value="#fff59d" data-writer-control="highlight-custom" aria-label="'+text('customHighlightColor','Custom highlight color')+'" title="'+text('customHighlightColor','Custom highlight color')+'">'+
      '<button class="tb-btn" data-action="format-cmd" data-cmd="removeFormat" title="'+text('format_removeFormat','Clear formatting')+'" aria-label="'+text('format_removeFormat','Clear formatting')+("\">"+DAL.uiLabel("ui_Tx_5b9e8d7","Tx")+"</button><button class=\"tb-btn\" data-action=\"format-cmd\" data-cmd=\"superscript\" title=\"")+text('format_superscript','Superscript')+'" aria-label="'+text('format_superscript','Superscript')+("\">"+DAL.uiLabel("ui_x__f3b5ff1","x²")+"</button><button class=\"tb-btn\" data-action=\"format-cmd\" data-cmd=\"subscript\" title=\"")+text('format_subscript','Subscript')+'" aria-label="'+text('format_subscript','Subscript')+("\">"+DAL.uiLabel("ui_x__ad3080e","x₂")+"</button><button class=\"tb-btn\" data-action=\"format-cmd\" data-cmd=\"outdent\" title=\"")+text('format_outdent','Outdent')+'" aria-label="'+text('format_outdent','Outdent')+'">⇤</button><button class="tb-btn" data-action="format-cmd" data-cmd="indent" title="'+text('format_indent','Indent')+'" aria-label="'+text('format_indent','Indent')+'">⇥</button>'+
      '<button class="tb-btn" data-action="new-comment" title="'+text('commentSelection','Comment on selected text')+'" aria-label="'+text('addComment','Add comment')+'">💬</button><button class="tb-btn" data-action="world-lookup" title="'+text('worldLookupHelp','Look up selected words in this world')+'" aria-label="'+text('worldLookup','World lookup')+'">🔍</button><button class="tb-btn" data-action="writer-link" title="'+text('addLinkHelp','Add external or internal link')+'" aria-label="'+text('addLink','Add link')+'">🔗</button><button class="tb-btn" data-action="writer-link-open" title="'+text('openSelectedLinkHelp','Open the web, email or project link at the manuscript cursor')+'" aria-label="'+text('openSelectedLink','Open link at cursor')+'">↗</button><button class="tb-btn" data-action="format-cmd" data-cmd="unlink" title="'+text('format_unlink','Remove link')+'" aria-label="'+text('format_unlink','Remove link')+'">⛓</button>'+
      '<select class="writer-insert-select" data-writer-control="insert" aria-label="'+text('insertStructuredContent','Insert structured content')+'"><option value="">'+text('insertContent','Insert…')+'</option><option value="quote">'+text('insert_quote','Block quote')+'</option><option value="note">'+text('insert_note','Note callout')+'</option><option value="important">'+text('insert_important','Important callout')+'</option><option value="warning">'+text('insert_warning','Warning callout')+'</option><option value="rule">'+text('insert_rule','Rule / boxed text')+'</option><option value="verse">'+text('insert_verse','Verse block')+'</option><option value="number-lines">'+text('insert_number-lines','Number selected lines')+'</option><option value="code">'+text('insert_code','Code block')+'</option><option value="checklist">'+text('insert_checklist','Checklist')+'</option><option value="table">'+text('insert_table','Table…')+'</option><option value="table-row-add">'+text('insert_table-row-add','Table: add row')+'</option><option value="table-row-remove">'+text('insert_table-row-remove','Table: remove row')+'</option><option value="table-col-add">'+text('insert_table-col-add','Table: add column')+'</option><option value="table-col-remove">'+text('insert_table-col-remove','Table: remove column')+'</option><option value="bookmark">'+text('insert_bookmark','Bookmark')+'</option><option value="footnote">'+text('insert_footnote','Footnote')+'</option><option value="pagebreak">'+text('insert_pagebreak','Page break')+'</option></select>';
  };

  DAL.writerPublishHTML=function(proj,ch){var d=data(proj),opts=d.exportOptions,holder=document.createElement('div');holder.innerHTML=DAL.sanitizeRichHTML(ch.contentHTML||'');Array.from(holder.querySelectorAll('.writer-bookmark')).forEach(function(n){n.remove();});if(!opts.highlights)Array.from(holder.querySelectorAll('.writer-highlight')).forEach(unwrap);if(!opts.footnotes)Array.from(holder.querySelectorAll('.writer-footnote-ref')).forEach(function(n){n.remove();});if(!opts.callouts)Array.from(holder.querySelectorAll('.writer-callout')).forEach(unwrap);Array.from(holder.querySelectorAll('.writer-check')).forEach(function(n){n.removeAttribute('contenteditable');});if(opts.footnotes){var ids=Array.from(holder.querySelectorAll('[data-footnote-id]')).map(function(n){return n.getAttribute('data-footnote-id');}),notes=d.footnotes.filter(function(f){return ids.indexOf(f.id)>=0;});if(notes.length)holder.insertAdjacentHTML('beforeend','<hr><section class="writer-footnotes"><h3>Notes</h3><ol>'+notes.map(function(f){return '<li value="'+Math.max(1,parseInt(f.number,10)||1)+'">'+DAL.escapeHtml(f.text)+'</li>';}).join('')+'</ol></section>');}if(opts.comments){var comments=d.comments.filter(function(c){return c.chapterId===ch.id;});if(comments.length)holder.insertAdjacentHTML('beforeend','<hr><section class="writer-comments"><h3>Annotations</h3><ol>'+comments.map(function(c){return '<li><strong>'+DAL.escapeHtml(c.label||'Note')+':</strong> '+DAL.escapeHtml(c.body||'')+(c.anchor?' <em>“'+DAL.escapeHtml(c.anchor)+'”</em>':'')+'</li>';}).join('')+'</ol></section>');}return holder.innerHTML;};
  DAL.writerExportControls=function(proj){var o=data(proj).exportOptions;return '<fieldset class="writer-export-options"><legend>Review marks in publishing exports</legend><label><input type="checkbox" data-writer-export="highlights"'+(o.highlights?' checked':'')+'> Include highlights</label><label><input type="checkbox" data-writer-export="comments"'+(o.comments?' checked':'')+'> Include comments</label><label><input type="checkbox" data-writer-export="footnotes"'+(o.footnotes?' checked':'')+'> Include footnotes</label><label><input type="checkbox" data-writer-export="callouts"'+(o.callouts?' checked':'')+'> Include callouts</label></fieldset>';};

  DAL.applyWriterHighlight=function(color){
    var ed=editor(); if(!ed||!restore()){DAL.toast((DAL.i18n?DAL.i18n.text("ui_Select_manuscript_text_first_780bdd7","Select manuscript text first"):"Select manuscript text first"),'info');return;}
    var proj=project();if(!proj)return;reviewHistory(proj);
    ed.focus(); document.execCommand('hiliteColor',false,color==='clear'?'transparent':color);
    var d=data(proj);
    Array.from(ed.querySelectorAll('span[style],mark[style],.writer-highlight')).forEach(function(node){
      var bg=node.style.backgroundColor;
      if(!bg||bg==='transparent'||bg==='rgba(0, 0, 0, 0)'){ if(node.classList.contains('writer-highlight'))unwrap(node); return; }
      var id=node.getAttribute('data-highlight-id')||DAL.uid('highlight'); node.classList.add('writer-highlight');node.setAttribute('data-highlight-id',id);node.setAttribute('data-color',bg);
      var record=d.highlights.find(function(h){return h.id===id;});
      if(record)record.color=bg;else d.highlights.push({id:id,chapterId:DAL.selectedChapterId,color:bg,label:'',note:'',createdAt:Date.now()});
    });
    save();reviewBarrier(proj); DAL.toast(color==='clear'?'Highlight removed':'Text highlighted','success');
  };

  function editTable(kind){var range=DAL._writerRange,node=range&&range.commonAncestorContainer;if(node&&node.nodeType===3)node=node.parentElement;var cell=node&&node.closest&&node.closest('td,th');if(!cell){DAL.toast((DAL.i18n?DAL.i18n.text("ui_Place_the_cursor_inside_a_table_first_0798193","Place the cursor inside a table first"):"Place the cursor inside a table first"),'info');return;}var row=cell.parentElement,table=row.closest('table'),index=Array.from(row.cells).indexOf(cell);if(kind==='table-row-add'){var added=table.insertRow(row.rowIndex+1);for(var i=0;i<row.cells.length;i++)added.insertCell().textContent='Cell';}else if(kind==='table-row-remove'){if(table.rows.length>1)row.remove();else DAL.toast((DAL.i18n?DAL.i18n.text("ui_A_table_needs_at_least_one_row_eab56bf","A table needs at least one row"):"A table needs at least one row"),'info');}else if(kind==='table-col-add'){Array.from(table.rows).forEach(function(r){var n=r.insertCell(index+1);n.textContent=r.rowIndex===0?'Heading':'Cell';});}else if(kind==='table-col-remove'){if(row.cells.length>1)Array.from(table.rows).forEach(function(r){if(r.cells[index])r.deleteCell(index);});else DAL.toast((DAL.i18n?DAL.i18n.text("ui_A_table_needs_at_least_one_column_8085bf4","A table needs at least one column"):"A table needs at least one column"),'info');}save();}

  function chapterMarkup(ch, fn){
    var proj=project(),ed=editor();
    var live=ed&&proj&&DAL.currentTool==='manuscript'&&DAL.selectedChapterId===ch.id&&(proj.chapters||[]).indexOf(ch)>=0;
    var holder=live?ed:document.createElement('div');
    if(!live)holder.innerHTML=ch.contentHTML||'';
    var before=holder.innerHTML;fn(holder);
    if(holder.innerHTML!==before||ch.contentHTML!==holder.innerHTML){
      ch.contentHTML=holder.innerHTML;ch.updatedAt=Date.now();
      if(proj&&(proj.chapters||[]).indexOf(ch)>=0)proj.updatedAt=ch.updatedAt;
    }
  }
  function reviewHistory(proj){
    var ch=DAL.chapterById(proj,DAL.selectedChapterId),ed=editor();
    if(ch&&ed&&DAL.currentTool==='manuscript')ch.contentHTML=ed.innerHTML;
    if(DAL.pushHistory)DAL.pushHistory();
  }
  function reviewBarrier(proj){
    var ed=editor(),history=proj.history||[];
    if(ed&&DAL.currentTool==='manuscript'&&history.length)DAL._writerReviewBarrier={editor:ed,html:ed.innerHTML,projectId:proj.id,chapterId:DAL.selectedChapterId,snapshot:history[history.length-1]};
  }
  function syncWriterRecords(proj,d){
    var liveHighlights=Object.create(null),liveBookmarks=Object.create(null),liveFootnotes=Object.create(null);
    (proj.chapters||[]).forEach(function(ch){var holder=document.createElement('div');holder.innerHTML=ch.contentHTML||'';
      Array.from(holder.querySelectorAll('[data-highlight-id]')).forEach(function(n){liveHighlights[n.getAttribute('data-highlight-id')]=ch.id;});
      Array.from(holder.querySelectorAll('[data-bookmark-id]')).forEach(function(n){liveBookmarks[n.getAttribute('data-bookmark-id')]=ch.id;});
      Array.from(holder.querySelectorAll('[data-footnote-id]')).forEach(function(n){liveFootnotes[n.getAttribute('data-footnote-id')]=ch.id;});
    });
    // Undo may restore a removed mark. Keep its notes until explicitly deleted.
    d.highlights.forEach(function(x){if(liveHighlights[x.id])x.chapterId=liveHighlights[x.id];});
    d.bookmarks.forEach(function(x){if(liveBookmarks[x.id])x.chapterId=liveBookmarks[x.id];});
    d.footnotes.forEach(function(x){if(liveFootnotes[x.id])x.chapterId=liveFootnotes[x.id];});
    renumberFootnotes(proj,d);
  }
  function highlightRows(proj,d){
    return d.highlights.map(function(h){
      var ch=DAL.chapterById(proj,h.chapterId),excerpt='',found=false,id=DAL.escapeHtml(h.id);
      if(ch)chapterMarkup({contentHTML:ch.contentHTML},function(holder){Array.from(holder.querySelectorAll('[data-highlight-id="'+CSS.escape(h.id)+'"]')).forEach(function(n){found=true;excerpt+=(n.textContent||'');});});
      return '<div class="writer-review-row"><button class="writer-review-jump" data-action="writer-highlight-jump" data-id="'+id+'"><span class="writer-swatch" style="background:'+highlightColor(h.color)+'"></span><strong>'+(found?DAL.escapeHtml(excerpt.trim().slice(0,100))||reviewText('emptyHighlight','Empty highlight'):reviewText('detachedHighlight','Detached highlight'))+'</strong><small>'+DAL.escapeHtml((ch&&ch.title)||'Deleted chapter')+(h.label?' · '+DAL.escapeHtml(h.label):'')+'</small>'+(h.note?'<small>'+DAL.escapeHtml(h.note)+'</small>':'')+'</button><button class="btn sm" data-action="writer-highlight-edit" data-id="'+id+'">'+reviewText('edit','Edit')+'</button><button class="btn sm danger" data-action="writer-highlight-delete" data-id="'+id+'" aria-label="'+reviewText('deleteHighlight','Delete highlight')+'">×</button></div>';
    }).join('');
  }
  DAL.showWriterReview=function(){
    var proj=project();if(!proj)return;var d=data(proj);syncWriterRecords(proj,d);
    var h='<div class="writer-review-summary"><strong>'+d.highlights.length+'</strong> '+reviewText('highlights','highlights')+' <strong>'+d.comments.filter(function(c){return !c.resolved;}).length+'</strong> '+reviewText('unresolvedComments','unresolved comments')+' <strong>'+d.bookmarks.length+'</strong> '+reviewText('bookmarks','bookmarks')+'</div>';
    h+='<p class="writer-muted">'+reviewText('detachedMarksHelp','Notes for removed text marks stay here until you delete them. Undo can restore their text marks.')+'</p><h3>'+reviewText('highlightsHeading','Highlights')+'</h3><div class="writer-review-list">'+(highlightRows(proj,d)||'<p class="writer-muted">'+reviewText('noHighlights','No highlights yet.')+'</p>')+'</div><h3>'+reviewText('bookmarksHeading','Bookmarks')+'</h3><div class="writer-review-list">';
    h+=(d.bookmarks.map(function(b){var ch=DAL.chapterById(proj,b.chapterId),id=DAL.escapeHtml(b.id);return '<div class="writer-review-row"><button class="writer-review-jump" data-action="writer-bookmark-jump" data-id="'+id+'"><strong>'+DAL.escapeHtml(b.name||'Bookmark')+'</strong><small>'+DAL.escapeHtml((ch&&ch.title)||'Deleted chapter')+'</small></button><button class="btn sm danger" data-action="writer-bookmark-delete" data-id="'+id+'" aria-label="'+reviewText('deleteBookmark','Delete bookmark')+'">×</button></div>';}).join('')||'<p class="writer-muted">'+reviewText('noBookmarks','No bookmarks yet.')+'</p>')+'</div>';
    DAL.modal(DAL.i18n?DAL.i18n.text('reviewAnnotations','Review & Annotations'):'Review & Annotations',h,{wide:true,footer:'<button class="btn" data-action="show-comments">'+reviewText('comments','Comments')+'</button><button class="btn primary" data-action="close-modal">'+reviewText('done','Done')+'</button>'});
  };

  DAL.showWriterOutline=function(){
    var proj=project();if(!proj)return;var rows=[],context={project:proj,chapters:Object.create(null)};
    DAL._writerOutlineContext=context;DAL._writerOutlineJumpId=(DAL._writerOutlineJumpId||0)+1;
    (proj.chapters||[]).forEach(function(ch){
      var root=document.createElement('div'),ed=editor();root.innerHTML=DAL.currentTool==='manuscript'&&DAL.selectedChapterId===ch.id&&ed?ed.innerHTML:ch.contentHTML||'';
      var heads=Array.from(root.querySelectorAll('h1,h2,h3,h4'));context.chapters[ch.id]={html:root.innerHTML,headings:heads.map(function(n){return n.textContent||'';})};
      rows.push('<button type="button" class="writer-outline-row chapter" data-action="writer-outline-jump" data-cid="'+DAL.escapeHtml(ch.id)+'" aria-label="'+reviewText('openOutlineChapter','Open '+ch.title,{chapter:ch.title})+'"><strong>'+DAL.escapeHtml(ch.title)+'</strong></button>');
      heads.forEach(function(n,i){var heading=n.textContent||writerText('untitledHeading','Untitled heading');rows.push('<button type="button" class="writer-outline-row '+n.tagName.toLowerCase()+'" data-action="writer-outline-jump" data-cid="'+DAL.escapeHtml(ch.id)+'" data-heading="'+i+'" aria-label="'+reviewText('openOutlineHeading','Open heading '+(i+1)+': '+heading+' in '+ch.title,{count:i+1,heading:heading,chapter:ch.title})+'">'+DAL.escapeHtml(heading)+'</button>');});
    });
    DAL.modal(writerText('documentOutline','Document Outline'),rows.join('')||'<p class="writer-muted">'+reviewText('emptyOutline','Add chapters or headings to build an outline.')+'</p>',{wide:true,footer:'<button class="btn primary" data-action="close-modal">'+reviewText('done','Done')+'</button>'});
  };

  DAL.showWriterLink=function(){
    var proj=project();if(!proj)return;DAL._writerLinkContext=writerContext();var targets=[];
    [['chapter',proj.chapters,'linkChapter','Chapter','title'],['character',proj.characters,'linkCharacter','Character','name'],['lore',(proj.lore||{}).entries,'linkLore','Lore','title'],['plot',proj.plots,'linkPlot','Plot','title'],['scene',(proj.adventure||{}).nodes,'linkScene','Scene','title']].forEach(function(group){(group[1]||[]).forEach(function(x){targets.push([group[0],x.id,writerText(group[2],group[3])+': '+(x[group[4]]||'')]);});});
    var opts=targets.map(function(x){return '<option value="'+DAL.escapeHtml(x[0]+':'+x[1])+'">'+DAL.escapeHtml(x[2])+'</option>';}).join('');
    DAL.modal(writerText('addLink','Add Link'),'<div class="form-group"><label class="form-label" for="writerLinkUrl">'+reviewText('linkAddress','Web or email address')+("</label><input class=\"form-input\" id=\"writerLinkUrl\" type=\"text\" inputmode=\"url\" autocomplete=\"off\" spellcheck=\"false\" placeholder=\""+DAL.uiLabel("ui_https_example_com_100680a","https://example.com")+"\" aria-describedby=\"writerLinkHelp\"></div><div class=\"writer-or\">")+reviewText('or','or')+'</div><div class="form-group"><label class="form-label" for="writerInternalLink">'+reviewText('linkRecord','Draft A Lore record')+'</label><select class="form-select" id="writerInternalLink"><option value="">'+reviewText('chooseProjectRecord','Choose a project record…')+'</option>'+opts+'</select></div><p id="writerLinkHelp" class="writer-muted">'+reviewText('linkHelp','Select a record, or enter a complete http://, https:// or mailto: address. Ctrl-click or Command-click a manuscript link to open it.')+'</p>',{initialFocus:'#writerLinkUrl',footer:'<button class="btn" data-action="close-modal">'+reviewText('cancel','Cancel')+'</button><button class="btn primary" data-action="writer-link-save">'+reviewText('addLink','Add link')+'</button>'});
  };

  function renumberFootnotes(proj,d){
    var records=Object.create(null),seen=Object.create(null),ordered=[],included=new Set();
    d.footnotes.forEach(function(f){if(!records[f.id])records[f.id]=f;});
    (proj.chapters||[]).forEach(function(ch){chapterMarkup(ch,function(root){Array.from(root.querySelectorAll('[data-footnote-id]')).forEach(function(node){var id=node.getAttribute('data-footnote-id');if(records[id]&&!seen[id]){seen[id]=true;ordered.push(records[id]);included.add(records[id]);}});});});
    d.footnotes.forEach(function(f){if(!included.has(f))ordered.push(f);});
    d.footnotes=ordered;ordered.forEach(function(f,i){f.number=i+1;});
    (proj.chapters||[]).forEach(function(ch){chapterMarkup(ch,function(root){Array.from(root.querySelectorAll('[data-footnote-id]')).forEach(function(node){var f=records[node.getAttribute('data-footnote-id')];if(f)node.textContent='['+f.number+']';});});});
  }
  DAL.showWriterReferences=function(){
    var proj=project();if(!proj)return;DAL._writerReferenceContext=null;var d=data(proj);syncWriterRecords(proj,d);
    var foot=d.footnotes.map(function(f){return '<div class="writer-reference-row"><div class="writer-reference-content"><strong>['+DAL.escapeHtml(f.number)+']</strong> '+DAL.escapeHtml(f.text)+'</div><div class="writer-reference-actions"><button class="btn sm" data-action="writer-footnote-edit" data-id="'+DAL.escapeHtml(f.id)+'" aria-label="'+reviewText('editFootnote','Edit footnote')+' ['+DAL.escapeHtml(f.number)+']">'+reviewText('edit','Edit')+'</button><button class="btn sm danger" data-action="writer-footnote-delete" data-id="'+DAL.escapeHtml(f.id)+'" aria-label="'+reviewText('deleteFootnote','Delete footnote')+' ['+DAL.escapeHtml(f.number)+']">'+reviewText('delete','Delete')+'</button></div></div>';}).join('');
    var src=d.sources.map(function(s){var title=DAL.escapeHtml(s.title||writerText('untitledSource','Untitled source'));return '<div class="writer-reference-row"><div class="writer-reference-content"><strong>'+title+'</strong><small>'+DAL.escapeHtml([s.author,s.edition,s.date,s.reference,s.url].filter(Boolean).join(' · '))+'</small><p>'+DAL.escapeHtml(s.note||'')+'</p></div><div class="writer-reference-actions"><button class="btn sm" data-action="writer-source-edit" data-id="'+DAL.escapeHtml(s.id)+'" aria-label="'+reviewText('editSource','Edit source')+': '+title+'">'+reviewText('edit','Edit')+'</button><button class="btn sm danger" data-action="writer-source-delete" data-id="'+DAL.escapeHtml(s.id)+'" aria-label="'+reviewText('deleteSource','Delete source')+': '+title+'">'+reviewText('delete','Delete')+'</button></div></div>';}).join('');
    DAL.modal(writerText('references','References'),'<div class="writer-toolbar"><button class="btn primary" data-action="writer-source-add">'+reviewText('addSource','Add source')+'</button></div><h3>'+reviewText('footnotesHeading','Footnotes')+'</h3>'+(foot||'<p class="writer-muted">'+reviewText('noFootnotes','No footnotes yet.')+'</p>')+'<h3>'+reviewText('sourcesHeading','Sources')+'</h3>'+(src||'<p class="writer-muted">'+reviewText('noSources','No source notes yet.')+'</p>'),{wide:true,footer:'<button class="btn primary" data-action="close-modal">'+reviewText('done','Done')+'</button>'});
  };
  DAL.writerFootnoteEditor=function(note){
    note=note||{};var proj=project();if(!proj)return;DAL._writerFootnoteId=note.id||null;DAL._writerReferenceContext=writerContext();DAL._writerReferenceContext.id=note.id||null;
    DAL.modal(writerText(note.id?'editFootnoteTitle':'addFootnoteTitle',note.id?'Edit Footnote':'Add Footnote'),'<label class="form-label" for="writerFootnoteText">'+reviewText('footnoteText','Footnote text')+'</label><textarea class="form-textarea" id="writerFootnoteText">'+DAL.escapeHtml(note.text||'')+'</textarea>',{initialFocus:'#writerFootnoteText',footer:'<button class="btn" data-action="writer-references">'+reviewText('cancel','Cancel')+'</button><button class="btn primary" data-action="writer-footnote-save">'+reviewText(note.id?'saveFootnote':'addFootnote',note.id?'Save footnote':'Add footnote')+'</button>'});
  };
  DAL.writerSourceEditor=function(source){
    source=source||{};var proj=project();if(!proj)return;DAL._writerSourceId=source.id||null;DAL._writerReferenceContext={project:proj,id:source.id||null};
    function input(id,key,label,value,textarea){return '<div class="form-group"><label class="form-label" for="'+id+'">'+reviewText(key,label)+'</label>'+(textarea?'<textarea class="form-textarea" id="'+id+'">'+DAL.escapeHtml(value||'')+'</textarea>':'<input class="form-input" id="'+id+'" value="'+DAL.escapeHtml(value||'')+'">')+'</div>';}
    DAL.modal(writerText(source.id?'editSourceTitle':'addSourceTitle',source.id?'Edit Source':'Add Source'),input('sourceTitle','sourceTitle','Title',source.title)+input('sourceAuthor','sourceAuthor','Author / creator',source.author)+'<div class="writer-form-grid">'+input('sourceEdition','sourceEdition','Edition / publication',source.edition)+input('sourceDate','sourceDate','Date',source.date)+'</div>'+input('sourceReference','sourceReference','Page, verse, or reference',source.reference)+input('sourceUrl','sourceUrl','URL',source.url)+input('sourceNote','sourceNote','Research note',source.note,true),{initialFocus:'#sourceTitle',footer:'<button class="btn" data-action="writer-references">'+reviewText('cancel','Cancel')+'</button><button class="btn primary" data-action="writer-source-save">'+reviewText('saveSource','Save source')+'</button>'});
  };

  DAL.registerActionHandler(function(action,el){var proj=project(),d=proj&&data(proj),id;
    if(action==='writer-review'){DAL.showWriterReview();return true;} if(action==='writer-outline'){DAL.showWriterOutline();return true;} if(action==='writer-references'){DAL.showWriterReferences();return true;}
    if(action==='writer-highlight'){if(el.value)DAL.applyWriterHighlight(el.value);el.value='';return true;} if(action==='writer-highlight-custom'){DAL.applyWriterHighlight(el.value);return true;}
    if(action==='writer-link'){DAL.showWriterLink();return true;}
    if(action==='writer-link-open'){var currentLink=selectedLink();if(currentLink)openWriterDestination(currentLink.getAttribute('href'));else DAL.toast(writerText('selectLinkToOpen','Place the manuscript cursor inside a link first.'),'info');return true;}
    if(action==='writer-link-save'){
      var context=DAL._writerLinkContext,internal=fieldValue('writerInternalLink'),href=fieldValue('writerLinkUrl');
      if(!validInsertionContext(context)){DAL.toast(writerText('staleWriterSelection','The manuscript selection changed. Close this dialog and select the text again.'),'warning');return true;}
      if(internal){if(!internalTarget(proj,internal)){fieldError('writerInternalLink','missingLinkedRecord','This project record no longer exists. Choose another record.');return true;}href='#dal:'+internal;}
      else if(!validAddress(href)){fieldError('writerLinkUrl','invalidLinkAddress','Enter a complete http://, https:// or mailto: address, or choose a project record.');return true;}
      context.editor.focus();DAL._writerRange=context.range;restore();var linked=false;
      try{linked=document.execCommand(context.range.collapsed?'insertHTML':'createLink',false,context.range.collapsed?'<a href="'+DAL.escapeHtml(href)+'">'+DAL.escapeHtml(href)+'</a>':href);}catch(e){}
      if(!linked){DAL.toast(writerText('linkInsertFailed','The link could not be inserted. Your text has not been replaced.'),'warning');return true;}
      DAL._writerLinkContext=null;DAL.closeModal();save();return true;
    }
    if(action==='writer-insert'){var kind=el.value;el.value='';if(!kind)return true;if(kind.indexOf('table-')===0){editTable(kind);return true;}if(kind==='table'){DAL.modal((DAL.i18n?DAL.i18n.text("ui_Insert_Table_7660cc9","Insert Table"):"Insert Table"),'<div class="writer-form-grid"><label>Rows<input class="form-input" id="writerTableRows" type="number" min="1" max="20" value="3"></label><label>Columns<input class="form-input" id="writerTableCols" type="number" min="1" max="10" value="3"></label></div>',{footer:'<button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="writer-table-save">Insert table</button>'});return true;}if(kind==='bookmark'){DAL.modal((DAL.i18n?DAL.i18n.text("ui_Add_Bookmark_7d02d99","Add Bookmark"):"Add Bookmark"),'<label class="form-label">Bookmark name</label><input class="form-input" id="writerBookmarkName" value="'+DAL.escapeHtml(selectedText().slice(0,80))+'">',{footer:'<button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="writer-bookmark-save">Add bookmark</button>'});return true;}if(kind==='footnote'){DAL.writerFootnoteEditor();return true;}if(kind==='number-lines'){var lines=selectedText().split(/\r?\n/).filter(function(line){return line.trim();});if(!lines.length)lines=['First line','Second line'];insert('<div class="writer-numbered-lines">'+lines.map(function(line,i){return '<div><span contenteditable="false">'+(i+1)+'</span>'+DAL.escapeHtml(line)+'</div>';}).join('')+'</div><p><br></p>');return true;}var blocks={quote:'<blockquote>Quote…</blockquote>',note:'<aside class="writer-callout writer-note"><strong>Note</strong><p>Write your note…</p></aside>',important:'<aside class="writer-callout writer-important"><strong>Important</strong><p>Write here…</p></aside>',warning:'<aside class="writer-callout writer-warning"><strong>Warning</strong><p>Write here…</p></aside>',rule:'<aside class="writer-callout writer-rule"><strong>Rule / Boxed Text</strong><p>Write here…</p></aside>',verse:'<blockquote class="writer-verse">1. First line<br>2. Second line</blockquote>',code:'<pre><code>Code or monospaced text</code></pre>',checklist:'<ul class="writer-checklist"><li><span class="writer-check" data-checked="false" contenteditable="false">☐</span> Task</li></ul>',pagebreak:'<hr class="writer-page-break">'};insert(blocks[kind]||'');return true;}
    if(action==='writer-table-save'){var rows=Math.max(1,Math.min(20,parseInt((document.getElementById('writerTableRows')||{}).value)||3)),cols=Math.max(1,Math.min(10,parseInt((document.getElementById('writerTableCols')||{}).value)||3)),html='<table class="writer-table"><tbody>';for(var r=0;r<rows;r++){html+='<tr>';for(var c=0;c<cols;c++)html+=(r===0?'<th>Heading</th>':'<td>Cell</td>');html+='</tr>';}DAL.closeModal();insert(html+'</tbody></table><p><br></p>');return true;}
    if(action==='writer-bookmark-save'){id=DAL.uid('bookmark');var name=(document.getElementById('writerBookmarkName')||{}).value||'Bookmark';d.bookmarks.push({id:id,chapterId:DAL.selectedChapterId,name:name,createdAt:Date.now()});DAL.closeModal();insert('<span class="writer-bookmark" id="dal-bookmark-'+id+'" data-bookmark-id="'+id+'" contenteditable="false" title="'+DAL.escapeHtml(name)+'">🔖</span>');return true;}
    if(action==='writer-footnote-save'){
      var footContext=DAL._writerReferenceContext;if(!validWriterContext(footContext)){DAL.toast(writerText('staleReference','The project changed. Reopen References before editing this record.'),'warning');return true;}if(footContext.pending)return true;
      var text=fieldValue('writerFootnoteText');if(!text){fieldError('writerFootnoteText','emptyFootnote','Enter footnote text.');return true;}
      id=footContext.id;var note=id&&d.footnotes.find(function(x){return x.id===id;});
      if(id&&!note){DAL.toast(writerText('missingReference','This reference no longer exists. Reopen References.'),'warning');return true;}
      if(!note){
        if(!validInsertionContext(footContext)){DAL.toast(writerText('staleWriterSelection','The manuscript selection changed. Close this dialog and select the text again.'),'warning');return true;}
        reviewHistory(proj);id=DAL.uid('footnote');note={id:id,chapterId:footContext.chapterId,text:text,number:d.footnotes.length+1,createdAt:Date.now()};
        footContext.editor.focus();DAL._writerRange=footContext.range.cloneRange();DAL._writerRange.collapse(false);restore();var inserted=false;
        try{inserted=document.execCommand('insertHTML',false,'<sup class="writer-footnote-ref" data-footnote-id="'+DAL.escapeHtml(id)+'" contenteditable="false">['+note.number+']</sup>');}catch(e){}
        if(!inserted){DAL.toast(writerText('footnoteInsertFailed','The footnote could not be inserted. Your reference text is still in this dialog.'),'warning');return true;}
        d.footnotes.push(note);footContext.id=id;DAL._writerFootnoteId=id;save();reviewBarrier(proj);
      }else if(note.text!==text){reviewHistory(proj);note.text=text;note.updatedAt=Date.now();proj.updatedAt=note.updatedAt;reviewBarrier(proj);}
      finishReferenceSave(footContext,el);return true;
    }
    if(action==='writer-highlight-jump'||action==='writer-bookmark-jump'){id=el.getAttribute('data-id');var rec=(action==='writer-highlight-jump'?d.highlights:d.bookmarks).find(function(x){return x.id===id;}),jumpChapter=rec&&DAL.chapterById(proj,rec.chapterId),selector=action==='writer-highlight-jump'?'[data-highlight-id="'+CSS.escape(id)+'"]':'[data-bookmark-id="'+CSS.escape(id)+'"]',found=false;if(jumpChapter)chapterMarkup({contentHTML:jumpChapter.contentHTML},function(holder){found=!!holder.querySelector(selector);});if(!found){DAL.toast(DAL.i18n?DAL.i18n.text('detachedMarkWarning','The text mark was removed. Its saved notes are still here.'):'The text mark was removed. Its saved notes are still here.','info');return true;}DAL.selectedChapterId=rec.chapterId;DAL.currentTool='manuscript';DAL.closeModal();DAL.render();var jumpProject=proj,jumpSelector=selector;setTimeout(function(){if(project()!==jumpProject||DAL.selectedChapterId!==jumpChapter.id||DAL.currentTool!=='manuscript')return;var ed=editor(),target=ed&&ed.querySelector(jumpSelector);if(target){target.scrollIntoView({block:'center'});target.classList.add('writer-flash');setTimeout(function(){target.classList.remove('writer-flash');},1200);}},80);return true;}
    if(action==='writer-outline-jump'){
      var outline=DAL._writerOutlineContext,cid=el.getAttribute('data-cid'),rawHeading=el.getAttribute('data-heading'),heading=rawHeading===null?-1:Number(rawHeading),ch=proj&&DAL.chapterById(proj,cid),expected=outline&&outline.chapters[cid];
      if(!outline||outline.project!==proj||!ch||!expected||!Number.isInteger(heading)||heading< -1||(heading>=0&&!/^\d+$/.test(rawHeading))){DAL.toast(writerText('staleOutline','This outline changed. Reopen Document Outline to refresh it.'),'warning');return true;}
      if(heading>=0){
        var latest=document.createElement('div'),live=editor();latest.innerHTML=DAL.currentTool==='manuscript'&&DAL.selectedChapterId===cid&&live?live.innerHTML:ch.contentHTML||'';
        if(heading>=expected.headings.length||latest.innerHTML!==expected.html){DAL.toast(writerText('staleOutline','This outline changed. Reopen Document Outline to refresh it.'),'warning');return true;}
      }
      if(DAL.currentTool==='manuscript'&&editor()&&DAL.saveChapterContent)DAL.saveChapterContent();
      DAL.selectedChapterId=cid;DAL.currentTool='manuscript';DAL.closeModal();DAL.render();
      var trigger=document.querySelector('[data-action="toggle-chapters"]');if(trigger)trigger.focus({preventScroll:true});
      var request=DAL._writerOutlineJumpId;
      if(heading>=0)setTimeout(function(){
        if(project()!==proj||DAL.currentTool!=='manuscript'||DAL.selectedChapterId!==cid||DAL._writerOutlineJumpId!==request)return;
        var ed=editor();if(!ed)return;var heads=ed.querySelectorAll('h1,h2,h3,h4'),target=heads[heading];
        if(ed.innerHTML===expected.html&&target&&(target.textContent||'')===expected.headings[heading])target.scrollIntoView({block:'center'});
      },80);
      return true;
    }
    if(action==='comment-jump'){id=el.getAttribute('data-comment-id');var comment=d.comments.find(function(x){return x.id===id;});if(comment&&comment.anchor){var commentChapter=DAL.chapterById(proj,comment.chapterId),plain=commentChapter&&(DAL.chapterSearchModel?DAL.chapterSearchModel(commentChapter).text:DAL.plainChapter(commentChapter))||'',at=plain.indexOf(comment.anchor);if(at>=0)DAL.openFindMatch({cid:comment.chapterId,text:plain,index:at,length:comment.anchor.length});else DAL.toast((DAL.i18n?DAL.i18n.text("ui_The_original_text_was_changed_or_removed_t_eca400d","The original text was changed or removed; the annotation is still saved."):"The original text was changed or removed; the annotation is still saved."),'info');}return true;}
    if(action==='writer-highlight-edit'){id=el.getAttribute('data-id');var h=d.highlights.find(function(x){return x.id===id;});if(h){DAL._writerHighlightId=id;DAL.modal(DAL.i18n?DAL.i18n.text('editHighlight','Edit Highlight'):'Edit Highlight','<label class="form-label" for="highlightEditColor">'+reviewText('color','Color')+'</label><input type="color" class="form-input" id="highlightEditColor" value="'+highlightColor(h.color)+'"><label class="form-label" for="highlightEditLabel">'+reviewText('label','Label')+'</label><input class="form-input" id="highlightEditLabel" value="'+DAL.escapeHtml(h.label||'')+'" placeholder="'+reviewText('highlightLabelHint','To revise, research, important…')+'"><label class="form-label" for="highlightEditNote">'+reviewText('note','Note')+'</label><textarea class="form-textarea" id="highlightEditNote">'+DAL.escapeHtml(h.note||'')+'</textarea>',{initialFocus:'#highlightEditLabel',footer:'<button class="btn" data-action="writer-review">'+reviewText('cancel','Cancel')+'</button><button class="btn primary" data-action="writer-highlight-save">'+reviewText('save','Save')+'</button>'});}return true;}
    if(action==='writer-highlight-save'){id=DAL._writerHighlightId;var hh=d.highlights.find(function(x){return x.id===id;});if(hh){reviewHistory(proj);hh.color=highlightColor(document.getElementById('highlightEditColor').value);hh.label=document.getElementById('highlightEditLabel').value;hh.note=document.getElementById('highlightEditNote').value;var ch=DAL.chapterById(proj,hh.chapterId);if(ch)chapterMarkup(ch,function(holder){Array.from(holder.querySelectorAll('[data-highlight-id="'+CSS.escape(id)+'"]')).forEach(function(n){n.style.backgroundColor=hh.color;n.setAttribute('data-color',hh.color);});});DAL._writerHighlightId=null;DAL.showWriterReview();reviewBarrier(proj);DAL.saveState();}return true;}
    if(action==='writer-highlight-delete'){id=el.getAttribute('data-id');var gone=d.highlights.find(function(x){return x.id===id;});if(gone){reviewHistory(proj);var ch=DAL.chapterById(proj,gone.chapterId);if(ch)chapterMarkup(ch,function(holder){Array.from(holder.querySelectorAll('[data-highlight-id="'+CSS.escape(id)+'"]')).forEach(unwrap);});d.highlights=d.highlights.filter(function(x){return x.id!==id;});DAL.showWriterReview();reviewBarrier(proj);DAL.saveState();}return true;}
    if(action==='writer-bookmark-delete'){id=el.getAttribute('data-id');var b=d.bookmarks.find(function(x){return x.id===id;});if(b){reviewHistory(proj);var bch=DAL.chapterById(proj,b.chapterId);if(bch)chapterMarkup(bch,function(holder){Array.from(holder.querySelectorAll('[data-bookmark-id="'+CSS.escape(id)+'"]')).forEach(function(n){n.remove();});});d.bookmarks=d.bookmarks.filter(function(x){return x.id!==id;});DAL.showWriterReview();reviewBarrier(proj);DAL.saveState();}return true;}
    if(action==='writer-footnote-delete'){id=el.getAttribute('data-id');reviewHistory(proj);(proj.chapters||[]).forEach(function(ch){chapterMarkup(ch,function(holder){Array.from(holder.querySelectorAll('[data-footnote-id="'+CSS.escape(id)+'"]')).forEach(function(n){n.remove();});});});d.footnotes=d.footnotes.filter(function(x){return x.id!==id;});renumberFootnotes(proj,d);DAL.showWriterReferences();reviewBarrier(proj);DAL.saveState();return true;}
    if(action==='writer-footnote-edit'){id=el.getAttribute('data-id');var footnoteRecord=d.footnotes.find(function(x){return x.id===id;});if(footnoteRecord)DAL.writerFootnoteEditor(footnoteRecord);else DAL.toast(writerText('missingReference','This reference no longer exists. Reopen References.'),'warning');return true;}
    if(action==='writer-source-add'){DAL.writerSourceEditor();return true;}if(action==='writer-source-edit'){id=el.getAttribute('data-id');var sourceRecord=d.sources.find(function(x){return x.id===id;});if(sourceRecord)DAL.writerSourceEditor(sourceRecord);else DAL.toast(writerText('missingReference','This reference no longer exists. Reopen References.'),'warning');return true;}
    if(action==='writer-source-save'){
      var sourceContext=DAL._writerReferenceContext;if(!validWriterContext(sourceContext)){DAL.toast(writerText('staleReference','The project changed. Reopen References before editing this record.'),'warning');return true;}if(sourceContext.pending)return true;
      var values={};['title','author','edition','date','reference','url','note'].forEach(function(key){values[key]=((document.getElementById('source'+key.charAt(0).toUpperCase()+key.slice(1))||{}).value||'');});
      if(!Object.keys(values).some(function(key){return values[key].trim();})){fieldError('sourceTitle','emptySource','Enter a title, citation, or research note for this source.');return true;}
      if(values.url.trim()&&!validAddress(values.url.trim())){fieldError('sourceUrl','invalidSourceUrl','Enter a complete http://, https:// or mailto: address, or leave the URL blank.');return true;}
      id=sourceContext.id;var src=id&&d.sources.find(function(x){return x.id===id;});
      if(id&&!src){DAL.toast(writerText('missingReference','This reference no longer exists. Reopen References.'),'warning');return true;}
      if(!src||Object.keys(values).some(function(key){return (src[key]||'')!==values[key];})){reviewHistory(proj);if(!src){src={id:DAL.uid('source'),createdAt:Date.now()};d.sources.push(src);sourceContext.id=src.id;DAL._writerSourceId=src.id;}Object.keys(values).forEach(function(key){src[key]=values[key];});src.updatedAt=Date.now();proj.updatedAt=src.updatedAt;reviewBarrier(proj);}
      finishReferenceSave(sourceContext,el);return true;
    }
    if(action==='writer-source-delete'){id=el.getAttribute('data-id');if(!d.sources.some(function(x){return x.id===id;}))return true;reviewHistory(proj);d.sources=d.sources.filter(function(x){return x.id!==id;});proj.updatedAt=Date.now();DAL.showWriterReferences();reviewBarrier(proj);DAL.saveState();return true;}
    if(action==='writer-print'){DAL.printBook(proj);return true;}
    return false;
  });

  document.addEventListener('selectionchange',function(){DAL.captureWriterSelection();var sel=window.getSelection&&window.getSelection(),out=document.getElementById('selectionStats');if(out){var text=sel&&editor()&&editor().contains(sel.anchorNode)?String(sel).trim():'';out.textContent=text?(text.split(/\s+/).length+' selected words · '+text.length+' characters'):'';}});
  document.addEventListener('change',function(e){var control=e.target.getAttribute&&e.target.getAttribute('data-writer-control');if(control==='highlight'){if(e.target.value)DAL.applyWriterHighlight(e.target.value);e.target.value='';}else if(control==='highlight-custom')DAL.applyWriterHighlight(e.target.value);else if(control==='insert')DAL.runAction('writer-insert',e.target,e);});
  document.addEventListener('change',function(e){var key=e.target.getAttribute&&e.target.getAttribute('data-writer-export'),proj=project();if(key&&proj){data(proj).exportOptions[key]=e.target.checked;DAL.saveState(true);}});
  document.addEventListener('click',function(e){var box=e.target.closest&&e.target.closest('.writer-check');if(!box)return;box.setAttribute('data-checked',box.getAttribute('data-checked')==='true'?'false':'true');box.textContent=box.getAttribute('data-checked')==='true'?'☑':'☐';save();});
  document.addEventListener('click',function(e){
    var link=e.target.closest&&e.target.closest('#editorContent a[href]');if(!link||!(e.ctrlKey||e.metaKey))return;var href=link.getAttribute('href')||'';e.preventDefault();
    openWriterDestination(href);
  });
})();
