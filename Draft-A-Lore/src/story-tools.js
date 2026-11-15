/* Draft A Lore — story-tools.js
 * Copyright 2026 Daymien Vanhorn — https://github.com/Hexxis-Studios/Draft-A-Lore
 * Free for noncommercial use under PolyForm Noncommercial 1.0.0 + supplemental
 * terms (see LICENSE.md). Credit to the original author must remain visible.
 * Commercial use requires a license — see COMMERCIAL-LICENSE.md.
 */
DAL = DAL || {};
DAL.renderWorkspace = function(proj){
  var app = document.getElementById('app');
  var typeLabel = proj.type === 'novel' ? 'Novel' : (proj.type === 'rpg' ? 'RPG Adventure' : 'Dual');
  var wc = DAL.getProjectWordCount(proj);
  var daily = DAL.getDailyWordCount(proj.id);
  function menuText(key,fallback){return DAL.escapeHtml(DAL.i18n?DAL.i18n.text(key,fallback):fallback);}

  var html = '<div class="workspace'+(DAL.projectSidebarOpen?' project-nav-open':'')+'">';
  html += '<aside class="workspace-sidebar" id="wsSidebar">';

  html += ("<div class=\"workspace-nav-home\"><button class=\"btn sm\" data-action=\"nav-projects\">"+DAL.uiLabel("ui__All_projects_027351d","← All projects")+"</button></div>");
  html += ("<div class=\"workspace-nav-search\"><input type=\"search\" class=\"form-input\" id=\"projectToolSearch\" aria-label=\""+DAL.uiLabel("ui_Find_project_section_e038f8a","Find project section")+"\" placeholder=\""+DAL.uiLabel("ui_Find_a_section__cd32f43","Find a section…")+"\" autocomplete=\"off\"><p id=\"projectToolSearchStatus\" role=\"status\" aria-live=\"polite\"></p></div>");

  if(proj.type === 'novel' || proj.type === 'dual'){
    if(proj.type === 'dual') html += ("<div class=\"ws-nav-group-label\">"+DAL.uiLabel("ui_Story_Tools_d163aae","Story Tools")+"</div>");
    var storyTools = [
      ['overview','Overview','M3 13h18v8H3z M3 3h18v8H3z'],
      ['manuscript','Manuscript','M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
      ['characters','Characters','M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 7a4 4 0 1 0 0 .1z M20 8v6 M23 11h-6'],
      ['relationships','Relationship Map','M9 17H7A5 5 0 0 1 7 7h2 M14 7h2a5 5 0 0 1 0 10h-2 M8 12h8'],
      ['plots','Plot Threads','M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3'],
      ['timeline','Timeline','M3 5h18 M7 3v4 M17 3v4 M5 9h14v12H5z M8 13h3 M13 13h3 M8 17h3'],
      ['storyanalytics','POV & Pacing','M4 19V9 M10 19V5 M16 19v-7 M22 19V3'],
      ['lore','Lore Notebook','M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'],
      ['illustrations','Illustrations','M21 15l-5-5L5 21 M3 3h18v18H3z M8.5 8.5a1.5 1.5 0 1 0 0 .1z'],
      ['mindmap','Mind Map','M12 2a3 3 0 0 1 3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1 3-3z M9 12a3 3 0 0 1-3-3 M15 12a3 3 0 0 0 3-3 M12 7v5'],
      ['bookdesign','Book Design','M4 3h16v18H4z M8 7h8 M8 11h8 M8 15h5'],
      ['bookpreview','Book Preview','M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
      ['export','Export','M12 3v12 M7 8l5-5 5 5 M5 21h14']
    ];
    storyTools.forEach(function(t){
      var active = DAL.currentTool === t[0] ? ' active' : '';
      html += '<button type="button" class="ws-nav-item'+active+'" aria-current="'+(active?'page':'false')+'" data-action="ws-tool" data-tool="'+t[0]+'">'+(t[2]?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="'+t[2]+'"/></svg>':'')+'<span>'+DAL.escapeHtml(DAL.toolLabel(t[0],t[1]))+'</span></button>';
    });
  }

  if(proj.type === 'rpg' || proj.type === 'dual'){
    if(proj.type === 'dual') html += ("<div class=\"ws-nav-group-label\">"+DAL.uiLabel("ui_Adventure_Tools_efd749e","Adventure Tools")+"</div>");
    var advTools = [
      ['storygraph','Story Graph','M9 3H5a2 2 0 0 0-2 2v4 M15 3h4a2 2 0 0 1 2 2v4 M9 21H5a2 2 0 0 1-2-2v-4 M15 21h4a2 2 0 0 0 2-2v-4'],
      ['stats','Stats & Traits','M3 3v18h18 M7 16l4-8 4 4 4-6'],
      ['items','Items & Inventory','M20 7l-8-4-8 4 8 4 8-4z M4 7v10l8 4 8-4V7'],
      ['playtest','Playthrough','M6 12h12 M9 9l-3 3 3 3 M15 9l3 3-3 3'],
      ['export-rpg','Export','M12 3v12 M7 8l5-5 5 5 M5 21h14']
    ];
    advTools.forEach(function(t){
      var active = DAL.currentTool === t[0] ? ' active' : '';
      html += '<button type="button" class="ws-nav-item'+active+'" aria-current="'+(active?'page':'false')+'" data-action="ws-tool" data-tool="'+t[0]+'">'+(t[2]?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="'+t[2]+'"/></svg>':'')+'<span>'+DAL.escapeHtml(DAL.toolLabel(t[0],t[1]))+'</span></button>';
    });
  }

  /* Assets belong to the project rather than to one discipline, so the folder
     lives in its own section for every project type. */
  html += ("<div class=\"ws-nav-group-label\">"+DAL.uiLabel("ui_Project_9859597","Project")+"</div>");
  [['continuity','Continuity','M9 11l3 3L22 4 M21 12a9 9 0 1 1-5.3-8.2'],['encyclopedia','Living Encyclopedia','M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5'],['worldbible','World Bible','M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],['sync','Device Sync','M4 12a8 8 0 0 1 13-6 M17 3v3h-3 M20 12a8 8 0 0 1-13 6 M7 21v-3h3'],['assets','Assets','M3 7l9-4 9 4-9 4-9-4z M3 7v10l9 4 9-4V7 M12 11v10']].forEach(function(t){
    var active = DAL.currentTool === t[0] ? ' active' : '';
    html += '<button type="button" class="ws-nav-item'+active+'" aria-current="'+(active?'page':'false')+'" data-action="ws-tool" data-tool="'+t[0]+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="'+t[2]+'"/></svg><span>'+DAL.escapeHtml(DAL.toolLabel(t[0],t[1]))+'</span></button>';
  });

  html += '</aside>';
  html += ("<button class=\"workspace-nav-scrim\" data-action=\"close-project-sidebar\" aria-label=\""+DAL.uiLabel("closeProjectSections","Close project sections")+"\"></button>");

  html += '<div class="workspace-shell">';
  html += '<div class="workspace-topbar">'+
    '<div class="workspace-menu-row">'+
      '<button class="topbar-btn project-menu-button" data-action="toggle-project-sidebar" aria-label="'+(DAL.projectSidebarOpen?'Close':'Open')+' project sections" aria-controls="wsSidebar" aria-expanded="'+String(!!DAL.projectSidebarOpen)+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></button>'+
      '<div class="ws-menubar">'+
        '<button class="menu-trigger" data-action="open-menu" data-menu="file" aria-haspopup="menu" aria-expanded="false">'+menuText('menuFile','File')+'<span class="menu-caret">▾</span></button>'+
        '<button class="menu-trigger" data-action="open-menu" data-menu="edit" aria-haspopup="menu" aria-expanded="false">'+menuText('menuEdit','Edit')+'<span class="menu-caret">▾</span></button>'+
        '<button class="menu-trigger" data-action="open-menu" data-menu="view" aria-haspopup="menu" aria-expanded="false">'+menuText('menuView','View')+'<span class="menu-caret">▾</span></button>'+
        '<button class="menu-trigger" data-action="open-menu" data-menu="tools" aria-haspopup="menu" aria-expanded="false">'+menuText('menuTools','Tools')+'<span class="menu-caret">▾</span></button>'+
      '</div>'+
      ("<div class=\"save-status\" title=\""+DAL.uiLabel("ui_Saved_on_this_device_ade5400","Saved on this device")+"\"><div class=\"save-dot\"></div><span>"+DAL.uiLabel("ui_Saved_b5c120b","Saved")+"</span></div>")+
    '</div>'+
    '<div class="workspace-project-row">'+
      ("<input class=\"form-input project-name-input\" id=\"projNameInput\" aria-label=\""+DAL.uiLabel("ui_Project_name_2549819","Project name")+"\" value=\"")+DAL.escapeHtml(proj.name)+'">'+
      ("<select class=\"form-select project-status-select\" aria-label=\""+DAL.uiLabel("ui_Project_status_8526e22","Project status")+"\" data-action=\"change-status\" data-pid=\"")+DAL.escapeHtml(proj.id)+'">'+
        ['development','drafting','proofreading','completed','published'].map(function(s){ return '<option value="'+s+'"'+(proj.status===s?' selected':'')+'>'+s.charAt(0).toUpperCase()+s.slice(1)+'</option>'; }).join('')+
      '</select>'+
      '<div class="workspace-project-meta">'+
        '<span><strong>'+wc.manuscript+'</strong> / <strong>'+wc.supplementary+'</strong> / <strong>'+wc.total+("</strong>"+DAL.uiLabel("ui_words_8772742"," words")+"</span>")+
        ("<span>"+DAL.uiLabel("ui_Today__627ac69","Today: ")+"<strong class=\"accent-text\">")+(daily.manuscript+daily.supplementary)+'</strong></span>'+
        '<div class="sync-dot '+(DAL.folderHandles[proj.id]?'linked':'unlinked')+'" title="'+(DAL.folderHandles[proj.id]?'Folder linked':'No folder linked')+'"></div>'+
        '<button class="btn sm ws-folder-btn" data-action="link-folder" data-pid="'+DAL.escapeHtml(proj.id)+'">'+(DAL.folderHandles[proj.id]?'Change Folder':'Link Folder')+'</button>'+
      '</div>'+
    '</div></div>';

  html += '<div class="workspace-main" id="wsMain">';

  if(!DAL.currentTool) DAL.currentTool = proj.type === 'rpg' ? 'storygraph' : 'overview';
  html += DAL.renderStoryTool(proj, DAL.currentTool);

  html += '</div>'; // end workspace-main
  html += '</div>'; // end flex container
  html += '</div>'; // end workspace

  // Keep the global top bar honest: without this it still shows whichever view
  // the user came from ("Dashboard", "Settings") while a project is open.
  var topTitle = document.getElementById('topTitle');
  if(topTitle) topTitle.textContent = proj.name || 'Project';

  var content = document.getElementById('content');
  content.style.padding = '0';
  content.innerHTML = html;
  content.parentElement.style.flex = '1';
  content.parentElement.style.display = 'flex';
  content.parentElement.style.flexDirection = 'column';
  content.parentElement.style.overflow = 'hidden';

  DAL.afterStoryRender(proj);
  if(DAL.restoreNativeFolderLink) DAL.restoreNativeFolderLink(proj.id);
};

DAL.renderStoryTool = function(proj, tool){
  switch(tool){
    case 'overview': return DAL.renderOverview(proj);
    case 'manuscript': return DAL.renderManuscript(proj);
    case 'characters': return DAL.renderCharacters(proj);
    case 'relationships': return DAL.renderRelationshipMap(proj);
    case 'plots': return DAL.renderPlotThreads(proj);
    case 'timeline': return DAL.renderTimeline(proj);
    case 'storyanalytics': return DAL.renderStoryAnalytics(proj);
    case 'lore': return DAL.renderLoreNotebook(proj);
    case 'illustrations': return DAL.renderIllustrations(proj);
    case 'mindmap': return DAL.renderMindMap(proj);
    case 'bookdesign': return DAL.renderBookDesign(proj);
    case 'bookpreview': return DAL.renderBookPreview(proj);
    case 'export': return DAL.renderStoryExport(proj);
    case 'worldbible': return DAL.renderWorldBible(proj);
    case 'continuity': return DAL.renderContinuity(proj);
    case 'encyclopedia': return DAL.renderEncyclopedia(proj);
    case 'sync': return DAL.renderSyncCenter(proj);
    case 'storygraph': return DAL.renderStoryGraph(proj);
    case 'stats': return DAL.renderStatsTraits(proj);
    case 'items': return DAL.renderItems(proj);
    case 'assets': return DAL.renderAssets(proj);
    case 'playtest': return DAL.renderPlaytest(proj);
    case 'export-rpg': return DAL.renderRPGExport(proj);
    default: return DAL.renderOverview(proj);
  }
};
DAL.renderOverview = function(proj){
  var wc = DAL.getProjectWordCount(proj);
  var now = Date.now();
  var stalePlots = (proj.plots||[]).filter(function(p){ return (now - (p.lastTouched||p.createdAt||0)) > 30*86400000; });
  var recent = [];
  (proj.chapters||[]).forEach(function(c){ recent.push({name:'Chapter: '+c.title, ts:c.updatedAt}); });
  (proj.characters||[]).forEach(function(c){ recent.push({name:'Character: '+c.name, ts:c.createdAt}); });
  (proj.lore&&proj.lore.entries||[]).forEach(function(e){ recent.push({name:'Lore: '+e.title, ts:e.updatedAt}); });
  recent.sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
  recent = recent.slice(0,5);

  var html = '<div class="u-measure-mid">';
  html += '<div class="section-header"><div class="section-title">'+DAL.escapeHtml(proj.name)+'</div><span class="badge accent">'+proj.type+'</span></div>';

  html += '<div class="card-grid ws-stat-grid">'+
    '<div class="card" style="text-align:center"><div style="font-size:var(--ts-lg);font-weight:700;color:var(--c-accent)">'+(proj.chapters||[]).length+("</div><div style=\"font-size:var(--ts-xs);color:var(--c-text-muted)\">"+DAL.uiLabel("reportChapters","Chapters")+"</div></div>")+
    '<div class="card" style="text-align:center"><div style="font-size:var(--ts-lg);font-weight:700;color:var(--c-accent)">'+(proj.characters||[]).length+("</div><div style=\"font-size:var(--ts-xs);color:var(--c-text-muted)\">"+DAL.uiLabel("worldSection_characters","Characters")+"</div></div>")+
    '<div class="card" style="text-align:center"><div style="font-size:var(--ts-lg);font-weight:700;color:var(--c-accent)">'+(proj.plots||[]).length+("</div><div style=\"font-size:var(--ts-xs);color:var(--c-text-muted)\">"+DAL.uiLabel("tool_plots","Plot Threads")+"</div></div>")+
    '<div class="card" style="text-align:center"><div style="font-size:var(--ts-lg);font-weight:700;color:var(--c-accent)">'+(proj.lore&&proj.lore.entries||[]).length+("</div><div style=\"font-size:var(--ts-xs);color:var(--c-text-muted)\">"+DAL.uiLabel("ui_Lore_Entries_d3cc124","Lore Entries")+"</div></div>")+
  '</div>';

  html += '<div class="card" style="margin-bottom:16px;text-align:center">'+
    '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:10px;font-size:var(--ts-xs);color:var(--c-text-muted);text-transform:uppercase;letter-spacing:.4px">Word Counts '+DAL.infoIcon('Manuscript = words in your chapters and adventure nodes (the actual story). Supplementary = words in characters, lore and plot threads. Total = both combined. Daily goals and writing streaks track the manuscript count.')+'</div>'+
    '<div style="display:flex;gap:16px;justify-content:center">'+
    '<div><div style="font-size:var(--ts-lg);font-weight:700">'+wc.manuscript+("</div><div style=\"font-size:var(--ts-xs);color:var(--c-text-muted)\">"+DAL.uiLabel("tool_manuscript","Manuscript")+"</div></div>")+
    '<div><div style="font-size:var(--ts-lg);font-weight:700">'+wc.supplementary+("</div><div style=\"font-size:var(--ts-xs);color:var(--c-text-muted)\">"+DAL.uiLabel("ui_Supplementary_a07aa3b","Supplementary")+"</div></div>")+
    '<div><div style="font-size:var(--ts-lg);font-weight:700;color:var(--c-accent)">'+wc.total+("</div><div style=\"font-size:var(--ts-xs);color:var(--c-text-muted)\">"+DAL.uiLabel("ui_Total_c9b3c38","Total")+"</div></div>")+
    '</div></div>';

  if(stalePlots.length){
    html += '<div class="card" style="margin-bottom:16px;border-left:3px solid var(--c-warning)">'+
      '<div style="display:flex;align-items:center;gap:6px;font-weight:600;color:var(--c-warning);margin-bottom:8px">⚠ Stale Plot Threads '+DAL.infoIcon('A plot thread is marked stale when it hasn\'t been edited in 30+ days, so abandoned storylines don\'t quietly slip through the cracks. Open a thread and edit it to reset the timer.')+'</div>';
    stalePlots.forEach(function(p){
      html += '<div style="font-size:var(--ts-sm);padding:2px 0">'+DAL.escapeHtml(p.title)+' — untouched '+DAL.formatDate(p.lastTouched||p.createdAt)+'</div>';
    });
    html += '</div>';
  }

  html += ("<div class=\"card\" style=\"margin-bottom:16px\"><div style=\"font-weight:600;margin-bottom:8px\">"+DAL.uiLabel("ui_Quick_Links_62b3499","Quick Links")+"</div><div class=\"quick-links\">");
  var tools = proj.type === 'rpg' ? ['storygraph','stats','items','playtest','assets'] : ['manuscript','characters','illustrations','bookpreview','assets'];
  if(proj.type === 'dual') tools = ['manuscript','characters','storygraph','items','playtest','assets'];
  tools.forEach(function(t){
    var labels = {manuscript:'Manuscript',characters:'Characters',relationships:'Relationships',plots:'Plot Threads',lore:'Lore',illustrations:'Illustrations',mindmap:'Mind Map',bookpreview:'Book Preview',export:'Export',storygraph:'Story Graph',stats:'Stats & Traits',items:'Items',playtest:'Playthrough',assets:'Assets'};
    html += '<div class="quick-link" data-action="ws-tool" data-tool="'+t+'">'+labels[t]+'</div>';
  });
  html += '</div></div>';

  if(recent.length){
    html += ("<div class=\"card\"><div style=\"font-weight:600;margin-bottom:8px\">"+DAL.uiLabel("ui_Recent_Activity_9ef7d43","Recent Activity")+"</div>");
    recent.forEach(function(r){
      html += '<div class="activity-item">'+DAL.escapeHtml(r.name)+'<span class="activity-time">'+DAL.formatDate(r.ts)+'</span></div>';
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
};
DAL.focusChapterControl = function(chapterId,direction){
  var controls=Array.from(document.querySelectorAll(direction?'[data-action="chapter-move"]':'.chapter-open'));
  var target=controls.find(function(control){return control.getAttribute('data-cid')===chapterId&&!control.disabled&&(!direction||control.getAttribute('data-dir')===direction);});
  if(!target&&direction)target=Array.from(document.querySelectorAll('.chapter-open')).find(function(control){return control.getAttribute('data-cid')===chapterId;});
  if(target)target.focus();
};
DAL.renderManuscript = function(proj){
  function text(key,fallback,values){return DAL.escapeHtml(DAL.i18n?DAL.i18n.text(key,fallback,values):fallback);}
  if(!proj.chapters) proj.chapters = [];
  if(!proj.chapters.some(function(ch){return ch.id===DAL.selectedChapterId;}) && proj.chapters.length){
    DAL.selectedChapterId = proj.chapters[0].id;
  }
  var currentCh = proj.chapters.find(function(c){ return c.id === DAL.selectedChapterId; });

  var html = '<div class="manuscript-layout u-fill-body'+(DAL.chapterSidebarOpen?' chapters-open':'')+'">';
  var chapterPanelBody = '<div class="chapter-list-header"><span style="font-size:var(--ts-xs);font-weight:600;text-transform:uppercase;color:var(--c-text-muted)">'+text('chapters','Chapters')+'</span><button type="button" class="btn sm primary" data-action="add-chapter" aria-label="'+text('addChapter','Add chapter')+'">+</button></div>'+
    '<div class="chapter-list-items" id="chapterList" data-drop="chapter" data-sort-item="[data-drag=\"chapter\"]">';
  proj.chapters.forEach(function(ch, i){
    var active = ch.id === DAL.selectedChapterId ? ' active' : '';
    var chapterId=DAL.escapeHtml(ch.id),title=DAL.escapeHtml(ch.title);
    chapterPanelBody += '<div class="chapter-item'+active+'" data-action="select-chapter" data-cid="'+chapterId+'" data-sel="chapter:'+chapterId+'" data-ctx="chapter" data-ctx-id="'+chapterId+'" data-drag="chapter:'+chapterId+'" data-drag-label="'+title+'" data-drag-handle=".drag-handle">'+
      '<span class="drag-handle" data-cid="'+chapterId+'" title="'+text('dragToReorder','Drag to reorder')+'" aria-hidden="true">⋮⋮</span>'+
      '<button type="button" class="chapter-open" data-action="select-chapter" data-cid="'+chapterId+'" aria-label="'+text('openChapterNamed','Open '+ch.title,{name:ch.title})+'"'+(active?' aria-current="true"':'')+'>'+(DAL.formatNumber?DAL.formatNumber(i+1):i+1)+'. '+title+'</button>'+
      '<span class="chapter-reorder"><button type="button" class="btn sm" data-action="chapter-move" data-cid="'+chapterId+'" data-dir="-1" aria-label="'+text('moveChapterUp','Move '+ch.title+' up',{name:ch.title})+'"'+(i===0?' disabled':'')+'>↑</button><button type="button" class="btn sm" data-action="chapter-move" data-cid="'+chapterId+'" data-dir="1" aria-label="'+text('moveChapterDown','Move '+ch.title+' down',{name:ch.title})+'"'+(i===proj.chapters.length-1?' disabled':'')+'>↓</button></span>'+
    '</div>';
  });
  if(!proj.chapters.length){
    chapterPanelBody += '<div style="padding:12px;font-size:var(--ts-xs);color:var(--c-text-faint);text-align:center">'+text('noChapters','No chapters yet')+'</div>';
  }
  chapterPanelBody += '</div>';
  html += '<div class="chapter-list" id="chapterSidebar"><button class="topbar-btn chapter-drawer-close" data-action="close-chapters" aria-label="'+text('closeChapters','Close chapters')+'">×</button>'+DAL.panel('manuscript-chapters',DAL.i18n?DAL.i18n.text('chapters','Chapters'):'Chapters',chapterPanelBody,{defaultOpen:true,badge:proj.chapters.length})+'</div>';
  html += '<button class="chapter-nav-scrim" data-action="close-chapters" aria-label="'+text('closeChapters','Close chapters')+'"></button>';

  html += '<div class="editor-area" role="region" aria-label="'+text('manuscriptWorkspace','Manuscript workspace')+'" tabindex="0">';
  html += '<button type="button" class="btn focus-exit-button" data-action="fullscreen">'+text('exitFocusMode','Exit Focus Mode')+'</button>';
  html += '<p class="editor-scroll-hint">'+text('formattingSwipeHelp','Swipe the formatting bar for more tools →')+'</p>';
  html += '<div class="editor-toolbar" id="editorToolbar" role="group" aria-label="'+text('manuscriptFormattingTools','Manuscript formatting tools')+'">';
  html += '<button class="tb-btn chapter-menu-button" data-action="toggle-chapters" aria-label="'+text(DAL.chapterSidebarOpen?'closeChapters':'openChapters',DAL.chapterSidebarOpen?'Close chapters':'Open chapters')+'" aria-controls="chapterSidebar" aria-expanded="'+String(!!DAL.chapterSidebarOpen)+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><path d="M4 5h16M4 12h16M4 19h16"/></svg></button>';
  html += '<select aria-label="'+text('paragraphStyle','Paragraph style')+'" title="'+text('paragraphStyle','Paragraph style')+'" data-action="format-block"><option value="p">'+text('bodyText','Body Text')+'</option><option value="h1">'+text('heading1','Heading 1')+'</option><option value="h2">'+text('heading2','Heading 2')+'</option><option value="h3">'+text('subheading','Subheading')+'</option></select>';
  var fonts = DAL.getFontList();
  html += '<select class="tb-select" aria-label="'+text('fontFamily','Font family')+'" title="'+text('fontFamily','Font family')+'" data-action="font-family">';
  fonts.forEach(function(f){ html += '<option value="'+DAL.escapeHtml(f)+'">'+DAL.escapeHtml(f)+'</option>'; });
  html += '</select>';
  html += '<select aria-label="'+text('fontSize','Font size')+'" title="'+text('fontSize','Font size')+'" data-action="font-size" style="width:50px">';
  [12,14,16,18,20,24,28,32].forEach(function(s){ html += '<option value="'+s+'">'+s+'</option>'; });
  html += '</select>';
  html += '<span class="tb-sep"></span>';
  var fmtBtns = [
    ['bold',("<b>"+DAL.uiLabel("ui_B_df7e70e","B")+"</b>"),'Bold'],
    ['italic',("<i>"+DAL.uiLabel("ui_I_a83dd0c","I")+"</i>"),'Italic'],
    ['underline',("<u>"+DAL.uiLabel("ui_U_a25513c","U")+"</u>"),'Underline'],
    ['strikeThrough',("<s>"+DAL.uiLabel("ui_S_8de0b3c","S")+"</s>"),'Strikethrough']
  ];
  fmtBtns.forEach(function(b){ html += '<button class="tb-btn" title="'+text('format_'+b[0],b[2])+'" aria-label="'+text('format_'+b[0],b[2])+'" data-action="format-cmd" data-cmd="'+b[0]+'">'+b[1]+'</button>'; });
  html += '<span class="tb-sep"></span>';
  html += '<input type="color" aria-label="'+text('textColor','Text color')+'" title="'+text('textColor','Text color')+'" data-action="text-color" style="width:24px;height:24px;border:none;cursor:pointer">';
  html += '<span class="tb-sep"></span>';
  var aligns = [['justifyLeft','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>','Align Left'],['justifyCenter','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>','Center'],['justifyRight','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>','Right'],['justifyFull','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>','Justify']];
  aligns.forEach(function(a){ html += '<button class="tb-btn" title="'+text('format_'+a[0],a[2])+'" aria-label="'+text('format_'+a[0],a[2])+'" data-action="format-cmd" data-cmd="'+a[0]+'">'+a[1]+'</button>'; });
  html += '<span class="tb-sep"></span>';
  html += '<button class="tb-btn" aria-label="'+text('bulletedList','Bulleted list')+'" title="'+text('bulletedList','Bulleted list')+'" data-action="format-cmd" data-cmd="insertUnorderedList"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg></button>';
  html += '<button class="tb-btn" aria-label="'+text('numberedList','Numbered list')+'" title="'+text('numberedList','Numbered list')+'" data-action="format-cmd" data-cmd="insertOrderedList"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4 M4 10h2 M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg></button>';
  html += '<button class="tb-btn" aria-label="'+text('insertImage','Insert image')+'" title="'+text('insertImage','Insert image')+'" data-action="insert-image"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></button>';
  html += '<button class="tb-btn" aria-label="'+text('insertDivider','Insert divider')+'" title="'+text('insertDivider','Insert divider')+'" data-action="insert-hr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><line x1="4" y1="12" x2="20" y2="12"/></svg></button>';
  html += '<span class="tb-sep"></span>';
  html += '<button class="tb-btn" aria-label="'+text('copyChapter','Copy chapter')+'" title="'+text('copyChapter','Copy chapter')+'" data-action="copy-chapter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>';
  html += '<button class="tb-btn" aria-label="'+text('exportChapter','Export chapter')+'" title="'+text('exportChapter','Export chapter')+'" data-action="export-chapter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><path d="M12 3v12 M7 8l5-5 5 5 M5 21h14"/></svg></button>';
  html += '<button class="tb-btn" aria-label="'+text('toggleFullscreen','Toggle fullscreen')+'" title="'+text('toggleFullscreen','Toggle fullscreen')+'" data-action="fullscreen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><path d="M8 3H5a2 2 0 0 0-2 2v3 M21 8V5a2 2 0 0 0-2-2h-3 M3 16v3a2 2 0 0 0 2 2h3 M16 21h3a2 2 0 0 0 2-2v-3"/></svg></button>';
  if(DAL.renderAdvancedWriterToolbar) html += DAL.renderAdvancedWriterToolbar();
  html += '</div>'; // end toolbar
  if(DAL.renderLiveContinuityBar) html += DAL.renderLiveContinuityBar(proj,currentCh);

  if(currentCh){
    html += '<div class="chapter-illustrations-strip asset-dropzone" data-drop="asset" data-asset-bind="chapter:'+DAL.escapeHtml(currentCh.id)+'">';
    html += '<div class="chapter-illustrations-heading" style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:var(--ts-xs);font-weight:600;text-transform:uppercase;color:var(--c-text-muted)">'+text('chapterIllustrations','Chapter Illustrations')+'</span>'+
      '<span style="font-size:var(--ts-xs);color:var(--c-text-faint)">'+((currentCh.images||[]).length)+'/2</span>'+
      ((currentCh.images||[]).length < 2 ? '<button class="btn sm" data-action="upload-chapter-image" data-cid="'+DAL.escapeHtml(currentCh.id)+'">'+text('addImage','+ Add Image')+'</button>' : '')+
    '</div>';
    if(currentCh.images && currentCh.images.length){
      html += '<div style="display:flex;gap:8px">';
      currentCh.images.forEach(function(img, ii){
        html += '<div class="chapter-ill-thumb">'+
          '<img src="'+DAL.escapeHtml(DAL.imageSrc(proj,img))+'" alt="'+text('chapterIllustrationNumber','Chapter illustration '+(ii+1),{number:ii+1})+'">'+
          '<button class="chapter-ill-remove" aria-label="'+text('removeChapterIllustration','Remove chapter illustration '+(ii+1),{number:ii+1})+'" data-action="remove-chapter-image" data-cid="'+DAL.escapeHtml(currentCh.id)+'" data-img-idx="'+ii+'">&times;</button>'+
          '</div>';
      });
      html += '</div>';
    }
    html += '<input type="file" id="chapterImageInput" accept="image/*" style="display:none">';
    html += '</div>';
    html += DAL.renderAudioBinding(proj, currentCh, 'chapter', currentCh.id);
  }

  html += '<div class="editor-surface"><div class="content-editable'+(currentCh?'':' is-disabled')+'" id="editorContent" contenteditable="'+(currentCh?'true':'false')+'" spellcheck="true" lang="'+DAL.escapeHtml(proj.language||'en')+'" role="textbox" aria-multiline="true" aria-label="'+(currentCh?text('chapterManuscriptEditor','Chapter manuscript editor'):text('emptyManuscriptEditor','Manuscript editor — add a chapter to begin'))+'"'+(currentCh?'':' aria-disabled="true"')+' data-placeholder="'+(currentCh?text('startWriting','Start writing...'):text('addChapterToWrite','Add a chapter to start writing'))+'" data-cid="'+(currentCh?DAL.escapeHtml(currentCh.id):'')+'">'+(currentCh?currentCh.contentHTML:'')+'</div></div>';

  var editorWC = currentCh ? DAL.chapterWordCount(currentCh) : 0;
  html += '<div class="editor-footer"><span>'+DAL.escapeHtml(DAL.formatWordCount(editorWC))+'</span><span id="selectionStats"></span><span>'+(currentCh?text('editedAt','Edited '+DAL.formatDate(currentCh.updatedAt),{date:DAL.formatDate(currentCh.updatedAt)}):'')+'</span></div>';

  html += '</div>'; // end editor area
  html += '</div>'; // end manuscript layout
  return html;
};

DAL.afterStoryRender = function(proj){
  var editor = document.getElementById('editorContent');
  if(editor){
    DAL.applyWritingDirection(editor);
    var saveTimer = null;
    editor.addEventListener('input', function(){
      var ch = proj.chapters.find(function(c){ return c.id === DAL.selectedChapterId; });
      if(ch){
        ch.contentHTML = editor.innerHTML;
        ch.updatedAt = Date.now();
        proj.updatedAt = Date.now();
        if(saveTimer) clearTimeout(saveTimer);
        // Manuscript typing is the one place autosave-off actually matters: with
        // it off we don't want every keystroke hitting storage, so just mark the
        // status dot dirty and wait for an explicit Save. Everywhere else in the
        // app (adding a character, deleting a plot, etc.) still saves right away
        // regardless of this toggle, since those are already deliberate clicks.
        if(DAL.state.autosave === false){
          DAL.setSaveStatus('unsaved');
        } else {
          saveTimer = setTimeout(function(){
            saveTimer=null;
            if(DAL.state.autosave===false){DAL.setSaveStatus('unsaved');return;}
            DAL.saveState();
          }, 450);
        }
        var wc = DAL.countManuscriptWords(editor);DAL.cacheChapterWordCount(ch,wc);
        var footer = editor.parentElement.parentElement.querySelector('.editor-footer span');
        if(footer) footer.textContent = DAL.formatWordCount(wc);
      }
    });
    editor.addEventListener('focusin', function(){ DAL._activeEditor = editor; });
    if(document.activeElement === editor) DAL._activeEditor = editor;
  }

  // Bind canvas interactions if present
  DAL.initCanvasInteractions(proj);

  // Bind relationship map if present
  DAL.initRelMap(proj);

  var nameInput = document.getElementById('projNameInput');
  if(nameInput){
    nameInput.addEventListener('change', function(){
      proj.name = nameInput.value.trim() || proj.name;
      proj.cover.title = proj.name;
      proj.updatedAt = Date.now();
      DAL.saveState();
    });
  }

  var statusSel = document.querySelector('[data-action="change-status"]');
  if(statusSel){
    statusSel.addEventListener('change', function(){
      proj.status = statusSel.value;
      proj.updatedAt = Date.now();
      DAL.saveState();
    });
  }
};
DAL.renderCharacters = function(proj){
  if(!proj.characters) proj.characters = [];
  if(DAL.selectedCharId){
    var ch = proj.characters.find(function(c){ return c.id === DAL.selectedCharId; });
    if(ch) return DAL.renderCharacterDetail(proj, ch);
  }

  var html = ("<div class=\"section-header\"><div class=\"section-title\">"+DAL.uiLabel("worldSection_characters","Characters")+"</div><button class=\"btn primary\" data-action=\"add-character\">"+DAL.uiLabel("ui__Add_Character_55297d2","+ Add Character")+"</button></div>");
  if(!proj.characters.length){
    return html + ("<div class=\"empty-state\"><h3>"+DAL.uiLabel("ui_No_Characters_Yet_a2a1912","No Characters Yet")+"</h3><p>"+DAL.uiLabel("ui_Add_your_first_character_to_get_started__531cc99","Add your first character to get started.")+"</p><button class=\"btn primary\" data-action=\"add-character\">"+DAL.uiLabel("ui_Add_Character_ee8026b","Add Character")+"</button></div>");
  }
  html += '<div class="char-grid">';
  proj.characters.forEach(function(c){
    var initials = (c.name||'?').split(' ').map(function(w){ return w[0]; }).join('').substring(0,2).toUpperCase();
    html += '<div class="char-card" data-action="select-character" data-cid="'+DAL.escapeHtml(c.id)+'" data-sel="character:'+DAL.escapeHtml(c.id)+'" data-ctx="character" data-ctx-id="'+DAL.escapeHtml(c.id)+'">'+
      '<div class="char-portrait">'+(c.image?'<img src="'+c.image+'">':DAL.escapeHtml(initials))+'</div>'+
      '<div class="char-name">'+DAL.escapeHtml(c.name)+'</div>'+
      '<div class="char-role">'+DAL.escapeHtml(c.role||'')+'</div>'+(c.deceased?("<span class=\"badge deceased-badge\">"+DAL.uiLabel("ui_Killed_b3ce8f0","Killed")+"</span>"):'')+
    '</div>';
  });
  html += '</div>';
  return html;
};

DAL.renderCharacterDetail = function(proj, ch){
  var charWC = DAL.countWordsText(ch.appearance)+DAL.countWordsText(ch.personality)+DAL.countWordsText(ch.backstory)+DAL.countWordsText(ch.arc);
  var html = '<div class="u-measure">';
  html += ("<div style=\"margin-bottom:16px\"><button class=\"btn sm\" data-action=\"back-to-characters\">"+DAL.uiLabel("ui__Back_aceb696","← Back")+"</button></div>");
  html += '<div style="display:flex;gap:16px;margin-bottom:16px;align-items:flex-start">';
  html += '<div class="char-portrait" style="width:96px;height:96px;flex-shrink:0;font-size:32px;border-radius:var(--radius-lg)">'+(ch.image?'<img src="'+ch.image+'">':DAL.escapeHtml((ch.name||'?').charAt(0).toUpperCase()))+'</div>';
  html += '<div style="flex:1"><input class="form-input" id="charName" data-char-field="name" value="'+DAL.escapeHtml(ch.name||'')+("\" placeholder=\""+DAL.uiLabel("ui_Character_name_faf3e90","Character name")+"\" aria-label=\""+DAL.uiLabel("ui_Character_name_faf3e90","Character name")+"\" style=\"font-size:var(--ts-lg);font-weight:700;margin-bottom:4px\"><label class=\"u-hint\" style=\"display:inline-flex;align-items:center;gap:6px;margin-top:6px\"><input type=\"checkbox\" data-action=\"toggle-character-deceased\" data-cid=\"")+DAL.escapeHtml(ch.id)+'"'+(ch.deceased?' checked':'')+(">"+DAL.uiLabel("ui_Killed_deceased_7ac0aa7"," Killed / deceased")+"</label>")+(ch.deceased?("<label class=\"form-label\" style=\"margin-top:8px\">"+DAL.uiLabel("ui_Death_occurs_in_3af3820","Death occurs in")+"</label><select class=\"form-select\" data-char-field=\"deathChapterId\"><option value=\"\">"+DAL.uiLabel("ui_Not_anchored_to_a_chapter_c5a2cb9","Not anchored to a chapter")+"</option>")+(proj.chapters||[]).map(function(chapter){return '<option value="'+DAL.escapeHtml(chapter.id)+'"'+(ch.deathChapterId===chapter.id?' selected':'')+'>'+DAL.escapeHtml(chapter.title)+'</option>';}).join('')+'</select>':'')+'</div></div>';

  html += '<div style="margin-bottom:12px"><input type="file" id="charPortrait" accept="image/*" style="display:none"><button class="btn sm" data-action="upload-portrait" data-cid="'+DAL.escapeHtml(ch.id)+("\">"+DAL.uiLabel("ui_Upload_Portrait_e4998c8","Upload Portrait")+"</button> ")+(ch.image?'<button class="btn sm danger" data-action="remove-portrait" data-cid="'+DAL.escapeHtml(ch.id)+("\">"+DAL.uiLabel("remove","Remove")+"</button>"):'')+'</div>';

  html += '<div class="form-row" style="margin-bottom:12px">'+
    ("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("worldField_role","Role")+"</label><input class=\"form-input\" data-char-field=\"role\" value=\"")+DAL.escapeHtml(ch.role||'')+("\" placeholder=\""+DAL.uiLabel("ui_Protagonist_af8b33e","Protagonist")+"\"></div>")+
    ("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Age_39b7370","Age")+"</label><input class=\"form-input\" data-char-field=\"age\" value=\"")+DAL.escapeHtml(ch.age||'')+'" placeholder="25"></div>'+
    ("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Gender_a04630e","Gender")+"</label><input class=\"form-input\" data-char-field=\"gender\" value=\"")+DAL.escapeHtml(ch.gender||'')+("\" placeholder=\""+DAL.uiLabel("ui_Female_e8cca80","Female")+"\"></div></div>");

  var fields = [['appearance','Physical Appearance'],['personality','Personality'],['backstory','Backstory'],['arc','Character Arc / Goals']];
  fields.forEach(function(f){
    html += '<div class="form-group"><label class="form-label">'+f[1]+'</label><textarea class="form-textarea" data-char-field="'+f[0]+'" placeholder="Write '+f[1].toLowerCase()+'...">'+DAL.escapeHtml(ch[f[0]]||'')+'</textarea></div>';
  });

  if(!ch.customFields) ch.customFields = [];
  html += ("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Custom_Fields_c58d1a2","Custom Fields")+"</label><div class=\"custom-fields\">");
  ch.customFields.forEach(function(cf, i){
    cf.type = cf.type || 'text';
    var value = cf.type === 'boolean' ? '<label class="u-hint"><input type="checkbox" data-cf-value="'+i+'"'+(cf.value===true||cf.value==='true'?' checked':'')+(">"+DAL.uiLabel("ui_Yes_043e8d9"," Yes")+"</label>") : '<input class="form-input" type="'+(cf.type==='number'?'number':'text')+'" value="'+DAL.escapeHtml(cf.value===undefined?'':String(cf.value))+'" data-cf-value="'+i+("\" placeholder=\""+DAL.uiLabel("ui_Value_8e37953","Value")+"\">");
    html += '<div class="custom-field-row"><input class="form-input" value="'+DAL.escapeHtml(cf.label||'')+'" data-cf-label="'+i+("\" placeholder=\""+DAL.uiLabel("ui_Field_name_2f5574b","Field name")+"\"><select class=\"form-select\" data-cf-type=\"")+i+'"><option value="text"'+(cf.type==='text'?' selected':'')+(">"+DAL.uiLabel("ui_Text_71988c4","Text")+"</option><option value=\"number\"")+(cf.type==='number'?' selected':'')+(">"+DAL.uiLabel("ui_Number_bd82cf1","Number")+"</option><option value=\"boolean\"")+(cf.type==='boolean'?' selected':'')+(">"+DAL.uiLabel("ui_Yes_No_c00e655","Yes / No")+"</option></select>")+value+'<div class="custom-field-actions"><button class="btn sm" data-action="move-custom-field" data-cid="'+DAL.escapeHtml(ch.id)+'" data-cf-index="'+i+("\" data-dir=\"-1\" aria-label=\""+DAL.uiLabel("ui_Move_field_up_8e4d5e3","Move field up")+"\">↑</button><button class=\"btn sm\" data-action=\"move-custom-field\" data-cid=\"")+DAL.escapeHtml(ch.id)+'" data-cf-index="'+i+("\" data-dir=\"1\" aria-label=\""+DAL.uiLabel("ui_Move_field_down_9f04291","Move field down")+"\">↓</button><button class=\"btn sm danger\" data-action=\"delete-custom-field\" data-cid=\"")+DAL.escapeHtml(ch.id)+'" data-cf-index="'+i+("\" aria-label=\""+DAL.uiLabel("ui_Delete_field_0a73a60","Delete field")+"\">×</button></div></div>");
  });
  html += '</div><button class="btn sm" data-action="add-custom-field" data-cid="'+DAL.escapeHtml(ch.id)+("\">"+DAL.uiLabel("ui__Add_Custom_Field_5d91221","+ Add Custom Field")+"</button></div>");

  html += ("<div class=\"form-group\" style=\"margin-top:12px\"><label class=\"form-label\">"+DAL.uiLabel("worldField_tags","Tags")+"</label><input class=\"form-input\" data-char-field=\"tags\" value=\"")+DAL.escapeHtml((ch.tags||[]).join(', '))+("\" placeholder=\""+DAL.uiLabel("ui_comma_separated_tags_a4bb43c","comma, separated, tags")+"\"></div>");

  html += ("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Linked_Plot_Threads_a4592dc","Linked Plot Threads")+"</label><div style=\"display:flex;flex-wrap:wrap;gap:4px\">");
  (proj.plots||[]).forEach(function(p){
    var sel = (ch.linkedPlotIds||[]).indexOf(p.id) >= 0;
    html += '<span class="chip'+(sel?' selected':'')+'" data-action="toggle-char-plot" data-cid="'+DAL.escapeHtml(ch.id)+'" data-pid="'+DAL.escapeHtml(p.id)+'">'+DAL.escapeHtml(p.title)+'</span>';
  });
  if(!proj.plots||!proj.plots.length) html += ("<span style=\"font-size:var(--ts-xs);color:var(--c-text-faint)\">"+DAL.uiLabel("ui_No_plot_threads_yet_1b51720","No plot threads yet")+"</span>");
  html += '</div></div>';

  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px"><span style="font-size:var(--ts-xs);color:var(--c-text-faint)">'+charWC+' words in this character sheet</span><button class="btn sm danger" data-action="delete-character" data-cid="'+DAL.escapeHtml(ch.id)+("\">"+DAL.uiLabel("ui_Delete_Character_ee2425c","Delete Character")+"</button></div>");
  html += '</div>';
  return html;
};
DAL.renderRelationshipMap = function(proj){
  if(!proj.characters || !proj.characters.length){
    return ("<div class=\"empty-state\"><h3>"+DAL.uiLabel("ui_No_Characters_b496cd6","No Characters")+"</h3><p>"+DAL.uiLabel("ui_Add_characters_first_to_build_relationship_836396c","Add characters first to build relationship maps.")+"</p></div>");
  }
  if(!DAL._relCenter) DAL._relCenter = proj.characters[0].id;
  var center = proj.characters.find(function(c){ return c.id === DAL._relCenter; });
  if(!center){ DAL._relCenter = proj.characters[0].id; center = proj.characters[0]; }

  var connected = (proj.relationships||[]).filter(function(r){ return r.fromCharId === center.id || r.toCharId === center.id; });
  var connectedChars = connected.map(function(r){
    var otherId = r.fromCharId === center.id ? r.toCharId : r.fromCharId;
    var c = proj.characters.find(function(ch){ return ch.id === otherId; });
    return c ? { char: c, rel: r } : null;
  }).filter(Boolean);

  var html = ("<div class=\"section-header\"><div class=\"section-title\">"+DAL.uiLabel("tool_relationships","Relationship Map")+"</div><button class=\"btn primary\" data-action=\"add-relationship\">"+DAL.uiLabel("ui__Add_Relationship_f92b6f9","+ Add Relationship")+"</button></div>");
  html += ("<div style=\"margin-bottom:12px\"><label class=\"form-label\">"+DAL.uiLabel("ui_Center_on_character_6494b29","Center on character")+"</label><select class=\"form-select\" id=\"relCenterSelect\" style=\"width:auto;display:inline-block\">");
  proj.characters.forEach(function(c){
    html += '<option value="'+DAL.escapeHtml(c.id)+'"'+(c.id===center.id?' selected':'')+'>'+DAL.escapeHtml(c.name)+'</option>';
  });
  html += '</select></div>';

  html += '<div class="rel-map-container" id="relMapContainer">';
  html += '<svg class="rel-svg" id="relSvg"></svg>';

  html += '<div class="rel-node center" id="relCenterNode" data-center-id="'+DAL.escapeHtml(center.id)+'">'+
    '<div style="font-weight:700">'+DAL.escapeHtml(center.name)+'</div>'+
    '<div style="font-size:var(--ts-xs);color:var(--c-text-muted)">'+DAL.escapeHtml(center.role||'')+'</div></div>';

  // Connected nodes in a circle
  var radius = 180;
  connectedChars.forEach(function(item, i){
    var angle = (i / connectedChars.length) * Math.PI * 2 - Math.PI/2;
    var x = 50 + Math.cos(angle) * 35;
    var y = 50 + Math.sin(angle) * 35;
    var colorMap = { family:'var(--c-warning)', enemy:'var(--c-danger)', ally:'var(--c-info)', friend:'var(--c-success)', rival:'var(--c-warning)' };
    var color = colorMap[item.rel.category] || 'var(--c-border)';
    html += '<div class="rel-node connected" data-rel-id="'+DAL.escapeHtml(item.rel.id)+'" data-action="rel-center-on" data-cid="'+DAL.escapeHtml(item.char.id)+'" style="position:absolute;left:'+x+'%;top:'+y+'%;transform:translate(-50%,-50%);border-color:'+color+'">'+
      '<div style="font-weight:600;font-size:var(--ts-sm)">'+DAL.escapeHtml(item.char.name)+'</div>'+
      '<div style="font-size:var(--ts-xs);color:var(--c-text-muted)">'+DAL.escapeHtml(item.rel.type||'')+'</div></div>';
  });

  if(!connectedChars.length){
    html += ("<div class=\"canvas-empty rel-map-empty\">"+DAL.uiLabel("ui_No_relationships_yet_Click_Add_Relationshi_12e9b96","No relationships yet. Click \"Add Relationship\" to connect characters.")+"</div>");
  }

  html += '</div>';
  if((proj.relationships||[]).length){
    html += ("<div class=\"card\" style=\"margin-top:14px\"><div class=\"section-title\" style=\"margin-bottom:8px\">"+DAL.uiLabel("ui_All_Relationships_d76d599","All Relationships")+"</div>");
    proj.relationships.forEach(function(rel){
      var from=proj.characters.find(function(ch){return ch.id===rel.fromCharId;});
      var to=proj.characters.find(function(ch){return ch.id===rel.toCharId;});
      html += '<div class="relationship-row"><div><strong>'+DAL.escapeHtml((from&&from.name)||'Missing character')+' → '+DAL.escapeHtml((to&&to.name)||'Missing character')+'</strong><span>'+DAL.escapeHtml(rel.type||'Relationship')+(rel.description?' · '+DAL.escapeHtml(rel.description):'')+'</span></div><button class="btn sm" data-action="relationship-edit" data-rid="'+DAL.escapeHtml(rel.id)+("\">"+DAL.uiLabel("menuEdit","Edit")+"</button><button class=\"btn sm danger\" data-action=\"delete-relationship\" data-rid=\"")+DAL.escapeHtml(rel.id)+("\">"+DAL.uiLabel("menu_edit_delete","Delete")+"</button></div>");
    });
    html += '</div>';
  }
  return html;
};

DAL.drawRelationshipLines=function(proj){
  var container=document.getElementById('relMapContainer'),svg=document.getElementById('relSvg'),center=document.getElementById('relCenterNode');
  if(!container||!svg||!center||!proj)return;
  while(svg.firstChild)svg.removeChild(svg.firstChild);
  var bounds=container.getBoundingClientRect(),cr=center.getBoundingClientRect();
  svg.setAttribute('viewBox','0 0 '+Math.max(1,Math.round(bounds.width))+' '+Math.max(1,Math.round(bounds.height)));
  var x1=cr.left-bounds.left+cr.width/2,y1=cr.top-bounds.top+cr.height/2;
  var colors={family:'var(--c-warning)',enemy:'var(--c-danger)',ally:'var(--c-info)',friend:'var(--c-success)',rival:'var(--c-warning)'};
  Array.prototype.forEach.call(container.querySelectorAll('.rel-node.connected[data-rel-id]'),function(node){
    var rel=(proj.relationships||[]).find(function(item){return item.id===node.getAttribute('data-rel-id');});if(!rel)return;
    var r=node.getBoundingClientRect(),path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d','M'+x1+','+y1+' L'+(r.left-bounds.left+r.width/2)+','+(r.top-bounds.top+r.height/2));
    path.setAttribute('fill','none');path.setAttribute('stroke',colors[rel.category]||'var(--c-border)');path.setAttribute('stroke-width','2.5');path.setAttribute('stroke-linecap','round');svg.appendChild(path);
  });
};
DAL.initRelMap = function(proj){
  var sel=document.getElementById('relCenterSelect');
  if(sel)sel.onchange=function(){DAL._relCenter=sel.value;DAL.render();};
  DAL.drawRelationshipLines(proj);
  if(!DAL._relResizeHandler&&window.addEventListener){DAL._relResizeHandler=function(){if(DAL.currentTool==='relationships')DAL.drawRelationshipLines(DAL.state.projects[DAL.currentProjectId]);};window.addEventListener('resize',DAL._relResizeHandler);}
};

DAL.openRelationshipEditor = function(proj, rel){
  var fromId=(rel&&rel.fromCharId)||DAL._relCenter||proj.characters[0].id;
  if(!proj.characters.some(function(c){return c.id===fromId;})) fromId=proj.characters[0].id;
  var toId=(rel&&rel.toCharId)||(proj.characters.find(function(c){return c.id!==fromId;})||{}).id||fromId;
  var relTypes=['Parent','Child','Sibling','Spouse/Partner','Extended Family','Friend','Rival','Enemy','Acquaintance','Mentor','Protégé','Ally','Colleague','Unknown/Mystery','Complicated'];
  function charOptions(selected){return proj.characters.map(function(c){return '<option value="'+DAL.escapeHtml(c.id)+'"'+(c.id===selected?' selected':'')+'>'+DAL.escapeHtml(c.name)+'</option>';}).join('');}
  var html='<div class="form-group"><label class="form-label" for="relFrom">From Character</label><select class="form-select" id="relFrom">'+charOptions(fromId)+'</select></div><div class="form-group"><label class="form-label" for="relTo">To Character</label><select class="form-select" id="relTo">'+charOptions(toId)+'</select></div><div class="form-group"><label class="form-label" for="relType">Relationship Type</label><select class="form-select" id="relType">';
  relTypes.forEach(function(t){html+='<option value="'+t+'"'+(rel&&rel.type===t?' selected':'')+'>'+t+'</option>';});
  html+='</select></div><div class="form-group"><label class="form-label" for="relDesc">Description (optional)</label><input class="form-input" id="relDesc" value="'+DAL.escapeHtml((rel&&rel.description)||'')+'" placeholder="Why are they connected?"></div>';
  DAL._editingRelationshipId=rel?rel.id:null;
  DAL.modal(rel?'Edit Relationship':'Add Relationship',html,{footer:'<button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="save-relationship">Save</button>'});
};
DAL.renderPlotThreads = function(proj){
  if(!proj.plots) proj.plots = [];
  if(DAL.selectedPlotId){
    var p = proj.plots.find(function(pl){ return pl.id === DAL.selectedPlotId; });
    if(p) return DAL.renderPlotDetail(proj, p);
  }

  var main = proj.plots.filter(function(p){ return p.type === 'main'; });
  var sub = proj.plots.filter(function(p){ return p.type !== 'main'; });
  var now = Date.now();

  var html = ("<div class=\"section-header\"><div class=\"section-title\">"+DAL.uiLabel("tool_plots","Plot Threads")+"</div></div>");

  html += ("<div class=\"plot-section\"><div class=\"plot-section-title\">"+DAL.uiLabel("ui_Main_Plot_38716f0","Main Plot")+"</div>");
  if(main.length){
    main.forEach(function(p){
      var stale = (now - (p.lastTouched||p.createdAt||0)) > 30*86400000;
      html += '<div class="plot-card" data-action="select-plot" data-pid="'+DAL.escapeHtml(p.id)+'">'+
        '<div class="plot-status-dot '+p.status+'"></div>'+
        '<div style="flex:1"><div style="font-weight:600">'+DAL.escapeHtml(p.title)+'</div></div>'+
        (stale?("<span class=\"stale-warning\">"+DAL.uiLabel("ui__stale_dc137cd","⚠ stale")+"</span>"):'')+
        '<span class="badge">'+DAL.escapeHtml(p.status)+'</span></div>';
    });
  } else {
    html += ("<div style=\"font-size:var(--ts-xs);color:var(--c-text-faint);padding:8px\">"+DAL.uiLabel("ui_No_main_plot_threads_10bea52","No main plot threads")+"</div>");
  }
  html += ("<button class=\"btn sm\" data-action=\"add-plot\" data-type=\"main\" style=\"margin-top:4px\">"+DAL.uiLabel("ui__Add_Main_Plot_510413b","+ Add Main Plot")+"</button></div>");

  html += ("<div class=\"plot-section\"><div class=\"plot-section-title\">"+DAL.uiLabel("ui_Subplots_4cc0df5","Subplots")+"</div>");
  if(sub.length){
    sub.forEach(function(p){
      var stale = (now - (p.lastTouched||p.createdAt||0)) > 30*86400000;
      html += '<div class="plot-card" data-action="select-plot" data-pid="'+DAL.escapeHtml(p.id)+'">'+
        '<div class="plot-status-dot '+p.status+'"></div>'+
        '<div style="flex:1"><div style="font-weight:600">'+DAL.escapeHtml(p.title)+'</div></div>'+
        (stale?("<span class=\"stale-warning\">"+DAL.uiLabel("ui__stale_dc137cd","⚠ stale")+"</span>"):'')+
        '<span class="badge">'+DAL.escapeHtml(p.status)+'</span></div>';
    });
  } else {
    html += ("<div style=\"font-size:var(--ts-xs);color:var(--c-text-faint);padding:8px\">"+DAL.uiLabel("ui_No_subplots_10bba6f","No subplots")+"</div>");
  }
  html += ("<button class=\"btn sm\" data-action=\"add-plot\" data-type=\"subplot\" style=\"margin-top:4px\">"+DAL.uiLabel("ui__Add_Subplot_c4eb5f3","+ Add Subplot")+"</button></div>");

  return html;
};

DAL.renderPlotDetail = function(proj, p){
  var now = Date.now();
  var stale = (now - (p.lastTouched||p.createdAt||0)) > 30*86400000;
  var html = '<div class="u-measure">';
  html += ("<div style=\"margin-bottom:16px\"><button class=\"btn sm\" data-action=\"back-to-plots\">"+DAL.uiLabel("ui__Back_aceb696","← Back")+"</button></div>");
  html += '<input class="form-input" style="font-size:var(--ts-lg);font-weight:700;margin-bottom:12px" id="plotTitle" value="'+DAL.escapeHtml(p.title)+("\" placeholder=\""+DAL.uiLabel("ui_Plot_title_f6a53f9","Plot title")+"\">");
  html += '<div class="form-row" style="margin-bottom:12px">'+
    ("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Type_baaddf7","Type")+"</label><select class=\"form-select\" id=\"plotType\"><option value=\"main\"")+(p.type==='main'?' selected':'')+(">"+DAL.uiLabel("ui_Main_Plot_38716f0","Main Plot")+"</option><option value=\"subplot\"")+(p.type!=='main'?' selected':'')+(">"+DAL.uiLabel("ui_Subplot_14131ff","Subplot")+"</option></select></div>")+
    ("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("worldField_status","Status")+"</label><select class=\"form-select\" id=\"plotStatus\">")+
      ['planted','developing','climax','resolved','dormant'].map(function(s){ return '<option value="'+s+'"'+(p.status===s?' selected':'')+'>'+s.charAt(0).toUpperCase()+s.slice(1)+'</option>'; }).join('')+
    '</select></div></div>';
  html += ("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Description_526e008","Description")+"</label><textarea class=\"form-textarea\" id=\"plotDesc\" placeholder=\""+DAL.uiLabel("ui_Describe_this_plot_thread__196963d","Describe this plot thread...")+"\">")+DAL.escapeHtml(p.description||'')+'</textarea></div>';
  var plotChapterOptions=("<option value=\"\">"+DAL.uiLabel("ui_Not_anchored_e9aca7e","Not anchored")+"</option>")+(proj.chapters||[]).map(function(chapter){return '<option value="'+DAL.escapeHtml(chapter.id)+'"'+(p.introducedChapterId===chapter.id?' selected':'')+'>'+DAL.escapeHtml(chapter.title)+'</option>';}).join('');
  var resolutionOptions=("<option value=\"\">"+DAL.uiLabel("ui_Not_anchored_e9aca7e","Not anchored")+"</option>")+(proj.chapters||[]).map(function(chapter){return '<option value="'+DAL.escapeHtml(chapter.id)+'"'+(p.resolvedChapterId===chapter.id?' selected':'')+'>'+DAL.escapeHtml(chapter.title)+'</option>';}).join('');
  html += ("<div class=\"writer-form-grid\"><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Introduced_in_5c7ae80","Introduced in")+"</label><select class=\"form-select\" id=\"plotIntroducedChapter\">")+plotChapterOptions+("</select></div><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Resolved_in_f5fdff4","Resolved in")+"</label><select class=\"form-select\" id=\"plotResolvedChapter\">")+resolutionOptions+'</select></div></div>';

  html += ("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Linked_Chapters_4fbc716","Linked Chapters")+"</label><div style=\"display:flex;flex-wrap:wrap;gap:4px\">");
  (proj.chapters||[]).forEach(function(ch){
    var sel = (p.linkedChapterIds||[]).indexOf(ch.id) >= 0;
    html += '<span class="chip'+(sel?' selected':'')+'" data-action="toggle-plot-chapter" data-pid="'+DAL.escapeHtml(p.id)+'" data-chid="'+DAL.escapeHtml(ch.id)+'">'+DAL.escapeHtml(ch.title)+'</span>';
  });
  if(!proj.chapters||!proj.chapters.length) html += ("<span style=\"font-size:var(--ts-xs);color:var(--c-text-faint)\">"+DAL.uiLabel("noChapters","No chapters yet")+"</span>");
  html += '</div></div>';

  html += ("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Linked_Characters_632d3a5","Linked Characters")+"</label><div style=\"display:flex;flex-wrap:wrap;gap:4px\">");
  (proj.characters||[]).forEach(function(c){
    var sel = (p.linkedCharacterIds||[]).indexOf(c.id) >= 0;
    html += '<span class="chip'+(sel?' selected':'')+'" data-action="toggle-plot-char" data-pid="'+DAL.escapeHtml(p.id)+'" data-cid="'+DAL.escapeHtml(c.id)+'">'+DAL.escapeHtml(c.name)+'</span>';
  });
  if(!proj.characters||!proj.characters.length) html += ("<span style=\"font-size:var(--ts-xs);color:var(--c-text-faint)\">"+DAL.uiLabel("ui_No_characters_yet_cc52c8c","No characters yet")+"</span>");
  html += '</div></div>';

  if(stale) html += ("<div class=\"stale-warning\" style=\"margin-bottom:12px\">"+DAL.uiLabel("ui__This_plot_thread_hasn_t_been_touched_in_3_a9f283f","⚠ This plot thread hasn't been touched in 30+ days")+"</div>");
  html += '<div style="font-size:var(--ts-xs);color:var(--c-text-faint);margin-bottom:12px">Last touched: '+DAL.formatDate(p.lastTouched||p.createdAt)+'</div>';

  html += '<div style="display:flex;gap:8px"><button class="btn sm" data-action="mark-reviewed" data-pid="'+DAL.escapeHtml(p.id)+("\">"+DAL.uiLabel("ui_Mark_Reviewed_58f088c","Mark Reviewed")+"</button><button class=\"btn sm danger\" data-action=\"delete-plot\" data-pid=\"")+DAL.escapeHtml(p.id)+("\">"+DAL.uiLabel("menu_edit_delete","Delete")+"</button></div>");
  html += '</div>';
  return html;
};
DAL.renderTimeline = function(proj){
  if(!Array.isArray(proj.timeline)) proj.timeline = [];
  var events = proj.timeline.slice().sort(function(a,b){
    var ao = isFinite(parseFloat(a.order)) ? parseFloat(a.order) : 0, bo = isFinite(parseFloat(b.order)) ? parseFloat(b.order) : 0;
    return ao-bo || String(a.date||'').localeCompare(String(b.date||'')) || String(a.title||'').localeCompare(String(b.title||''));
  });
  var selected = events.find(function(event){ return event.id === DAL.selectedTimelineId; }) || null;
  var html = ("<div class=\"section-header\"><div class=\"section-title\">"+DAL.uiLabel("ui_Story_Timeline_22a825a","Story Timeline")+"</div><button class=\"btn primary\" data-action=\"timeline-add\">"+DAL.uiLabel("ui__Add_Event_6ae41ed","+ Add Event")+"</button></div>")+
    ("<p class=\"writer-muted\">"+DAL.uiLabel("ui_Use_real_dates_fictional_dates_ages_or_era_fc372f6","Use real dates, fictional dates, ages, or eras. Sort order keeps non-calendar events in the sequence you intend.")+"</p><div class=\"split-view\"><div class=\"list-pane\">");
  if(!events.length) html += ("<div class=\"empty-state\"><h3>"+DAL.uiLabel("ui_No_Timeline_Events_d362909","No Timeline Events")+"</h3><p>"+DAL.uiLabel("ui_Add_the_first_event_in_your_story_or_world_32f31e1","Add the first event in your story or world history.")+"</p></div>");
  events.forEach(function(event){
    html += '<button class="card hoverable'+(selected&&selected.id===event.id?' is-selected':'')+'" style="display:block;width:100%;text-align:left;margin-bottom:8px" data-action="timeline-select" data-event-id="'+DAL.escapeHtml(event.id)+'"><div class="comment-meta">'+DAL.escapeHtml(event.date||'Undated')+' · order '+DAL.escapeHtml(String(event.order||0))+'</div><strong>'+DAL.escapeHtml(event.title||'Untitled event')+'</strong>'+(event.location?'<div class="writer-muted">'+DAL.escapeHtml(event.location)+'</div>':'')+'</button>';
  });
  html += '</div><div class="detail-pane">';
  if(!selected){
    if(events.length) html += ("<div class=\"empty-state\"><h3>"+DAL.uiLabel("ui_Select_an_Event_604bd99","Select an Event")+"</h3><p>"+DAL.uiLabel("ui_Choose_an_event_to_edit_its_date_links_and_1124d42","Choose an event to edit its date, links, and notes.")+"</p></div>");
  } else {
    var charOptions = (proj.characters||[]).map(function(ch){return '<option value="'+DAL.escapeHtml(ch.id)+'"'+((selected.characterIds||[]).indexOf(ch.id)>=0?' selected':'')+'>'+DAL.escapeHtml(ch.name)+'</option>';}).join('');
    var plotOptions = (proj.plots||[]).map(function(plot){return '<option value="'+DAL.escapeHtml(plot.id)+'"'+((selected.plotIds||[]).indexOf(plot.id)>=0?' selected':'')+'>'+DAL.escapeHtml(plot.title)+'</option>';}).join('');
    var chapterOptions = ("<option value=\"\">"+DAL.uiLabel("ui_None_dc937b5","None")+"</option>")+(proj.chapters||[]).map(function(ch){return '<option value="'+DAL.escapeHtml(ch.id)+'"'+(selected.chapterId===ch.id?' selected':'')+'>'+DAL.escapeHtml(ch.title)+'</option>';}).join('');
    html += ("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Event_title_8ec4602","Event title")+"</label><input class=\"form-input\" data-timeline-field=\"title\" value=\"")+DAL.escapeHtml(selected.title||'')+("\"></div><div class=\"writer-form-grid\"><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("worldField_date","Date / era")+"</label><input class=\"form-input\" data-timeline-field=\"date\" value=\"")+DAL.escapeHtml(selected.date||'')+("\" placeholder=\""+DAL.uiLabel("ui_14_Frostfall_Year_302_c06419c","14 Frostfall, Year 302")+"\"></div><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("worldField_order","Sort order")+"</label><input class=\"form-input\" type=\"number\" step=\"1\" data-timeline-field=\"order\" value=\"")+DAL.escapeHtml(String(selected.order||0))+("\"></div></div><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("worldField_location","Location")+"</label><input class=\"form-input\" data-timeline-field=\"location\" value=\"")+DAL.escapeHtml(selected.location||'')+("\"></div><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("worldField_summary","Summary")+"</label><textarea class=\"form-textarea\" data-timeline-field=\"summary\">")+DAL.escapeHtml(selected.summary||'')+("</textarea></div><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("worldField_tags","Tags")+"</label><input class=\"form-input\" data-timeline-field=\"tags\" value=\"")+DAL.escapeHtml((selected.tags||[]).join(', '))+("\"></div><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("linkChapter","Chapter")+"</label><select class=\"form-select\" data-timeline-field=\"chapterId\">")+chapterOptions+("</select></div><div class=\"writer-form-grid\"><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("worldSection_characters","Characters")+"</label><select class=\"form-select\" multiple size=\"")+Math.min(6,Math.max(2,(proj.characters||[]).length))+'" data-timeline-field="characterIds">'+charOptions+("</select></div><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Plot_threads_fb443ac","Plot threads")+"</label><select class=\"form-select\" multiple size=\"")+Math.min(6,Math.max(2,(proj.plots||[]).length))+'" data-timeline-field="plotIds">'+plotOptions+'</select></div></div><button class="btn danger" data-action="timeline-delete" data-event-id="'+DAL.escapeHtml(selected.id)+("\">"+DAL.uiLabel("ui_Delete_Event_bea8ce4","Delete Event")+"</button>");
  }
  return html+'</div></div>';
};
DAL.renderLoreNotebook = function(proj){
  if(!proj.lore) proj.lore = { folders: ['Locations','Factions','Magic / Technology','Relics & Artifacts','Cosmology & History','Miscellaneous'], entries: [] };
  if(!DAL.selectedLoreFolder) DAL.selectedLoreFolder = proj.lore.folders[0] || 'Miscellaneous';

  if(DAL.selectedLoreEntry){
    var entry = proj.lore.entries.find(function(e){ return e.id === DAL.selectedLoreEntry; });
    if(entry) return DAL.renderLoreDetail(proj, entry);
  }

  var html = '<div class="lore-layout u-fill-body">';
  html += ("<div class=\"lore-sidebar\"><div style=\"padding:8px 12px;border-bottom:1px solid var(--c-border)\"><span style=\"font-size:var(--ts-xs);font-weight:600;text-transform:uppercase;color:var(--c-text-muted)\">"+DAL.uiLabel("worldSection_lore","Lore")+"</span></div>");
  proj.lore.folders.forEach(function(f){
    var active = f === DAL.selectedLoreFolder ? ' active' : '';
    var count = proj.lore.entries.filter(function(e){ return e.folder === f; }).length;
    html += '<div class="lore-folder'+active+'" data-action="select-lore-folder" data-folder="'+DAL.escapeHtml(f)+'">'+DAL.escapeHtml(f)+' ('+count+')</div>';
    // Show entries in this folder
    proj.lore.entries.filter(function(e){ return e.folder === f; }).forEach(function(e){
      html += '<div class="lore-entry-item" data-action="select-lore-entry" data-eid="'+DAL.escapeHtml(e.id)+'">'+DAL.escapeHtml(e.title)+'</div>';
    });
  });
  html += ("<div style=\"padding:8px 12px\"><button class=\"btn sm\" data-action=\"add-lore-folder\">"+DAL.uiLabel("ui__Folder_ac9c97a","+ Folder")+"</button></div>");
  html += '</div>';

  var entries = proj.lore.entries.filter(function(e){ return e.folder === DAL.selectedLoreFolder; });
  html += '<div class="lore-main">';
  html += '<div class="section-header"><div class="section-title">'+DAL.escapeHtml(DAL.selectedLoreFolder)+("</div><button class=\"btn primary\" data-action=\"add-lore-entry\">"+DAL.uiLabel("ui__Add_Entry_ce6fc7f","+ Add Entry")+"</button></div>");
  if(!entries.length){
    html += ("<div class=\"empty-state\"><h3>"+DAL.uiLabel("ui_No_Entries_ebb426d","No Entries")+"</h3><p>"+DAL.uiLabel("ui_Add_lore_entries_to_this_category__e4add37","Add lore entries to this category.")+"</p><button class=\"btn primary\" data-action=\"add-lore-entry\">"+DAL.uiLabel("ui_Add_Entry_b65440d","Add Entry")+"</button></div>");
  } else {
    entries.forEach(function(e){
      html += '<div class="card hoverable" style="margin-bottom:8px;cursor:pointer" data-action="select-lore-entry" data-eid="'+DAL.escapeHtml(e.id)+'"><div style="font-weight:600">'+DAL.escapeHtml(e.title)+'</div><div style="font-size:var(--ts-xs);color:var(--c-text-muted);margin-top:2px">'+DAL.escapeHtml((e.tags||[]).join(', '))+'</div><div style="font-size:var(--ts-xs);color:var(--c-text-faint);margin-top:2px">'+DAL.formatDate(e.updatedAt)+'</div></div>';
    });
  }
  html += '</div></div>';
  return html;
};

DAL.renderLoreDetail = function(proj, entry){
  var html = '<div class="u-measure">';
  html += ("<div style=\"margin-bottom:16px\"><button class=\"btn sm\" data-action=\"back-to-lore\">"+DAL.uiLabel("ui__Back_aceb696","← Back")+"</button></div>");
  html += '<input class="form-input" style="font-size:var(--ts-lg);font-weight:700;margin-bottom:12px" id="loreTitle" value="'+DAL.escapeHtml(entry.title)+("\" placeholder=\""+DAL.uiLabel("ui_Entry_title_e54c593","Entry title")+"\">");
  html += ("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("worldField_folder","Category")+"</label><select class=\"form-select\" id=\"loreFolder\">");
  proj.lore.folders.forEach(function(f){
    html += '<option value="'+DAL.escapeHtml(f)+'"'+(entry.folder===f?' selected':'')+'>'+DAL.escapeHtml(f)+'</option>';
  });
  html += '</select></div>';
  html += ("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Content_47bd290","Content")+"</label><textarea class=\"form-textarea\" id=\"loreContent\" style=\"min-height:200px\" placeholder=\""+DAL.uiLabel("ui_Write_lore_content__ea89964","Write lore content...")+"\">")+DAL.escapeHtml(entry.content||'')+'</textarea></div>';
  html += ("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("worldField_tags","Tags")+"</label><input class=\"form-input\" id=\"loreTags\" value=\"")+DAL.escapeHtml((entry.tags||[]).join(', '))+("\" placeholder=\""+DAL.uiLabel("ui_comma_separated_tags_a4bb43c","comma, separated, tags")+"\"></div>");

  html += ("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Linked_Characters_632d3a5","Linked Characters")+"</label><div style=\"display:flex;flex-wrap:wrap;gap:4px\">");
  (proj.characters||[]).forEach(function(c){
    var sel = (entry.linkedCharIds||[]).indexOf(c.id) >= 0;
    html += '<span class="chip'+(sel?' selected':'')+'" data-action="toggle-lore-char" data-eid="'+DAL.escapeHtml(entry.id)+'" data-cid="'+DAL.escapeHtml(c.id)+'">'+DAL.escapeHtml(c.name)+'</span>';
  });
  html += '</div></div>';

  html += ("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Linked_Plot_Threads_a4592dc","Linked Plot Threads")+"</label><div style=\"display:flex;flex-wrap:wrap;gap:4px\">");
  (proj.plots||[]).forEach(function(p){
    var sel = (entry.linkedPlotIds||[]).indexOf(p.id) >= 0;
    html += '<span class="chip'+(sel?' selected':'')+'" data-action="toggle-lore-plot" data-eid="'+DAL.escapeHtml(entry.id)+'" data-pid="'+DAL.escapeHtml(p.id)+'">'+DAL.escapeHtml(p.title)+'</span>';
  });
  html += '</div></div>';

  html += '<div style="font-size:var(--ts-xs);color:var(--c-text-faint);margin-top:12px">Last edited: '+DAL.formatDate(entry.updatedAt)+'</div>';
  html += '<button class="btn sm danger" style="margin-top:12px" data-action="delete-lore-entry" data-eid="'+DAL.escapeHtml(entry.id)+("\">"+DAL.uiLabel("ui_Delete_Entry_41bb004","Delete Entry")+"</button>");
  html += '</div>';
  return html;
};
DAL.bookPageLabel = function(proj, page){
  page = parseInt(page, 10) || 0;
  if(page < 1) return 'Not assigned to the book';
  if(page === 1) return 'Page 1 — Cover';
  if(page === 2) return 'Page 2 — Table of Contents';
  var chapter = (proj.chapters || [])[page - 3];
  return chapter ? 'Page '+page+' — '+chapter.title : 'Page '+page+' — Full-art page';
};

DAL.bookPageImages = function(proj, page){
  return (proj.images || []).filter(function(image){ return (parseInt(image.bookPage, 10) || 0) === page; });
};

DAL.bookPageArt = function(proj, page, fullPage){
  var images = DAL.bookPageImages(proj, page);
  if(!images.length) return '';
  return '<div class="book-page-art'+(fullPage?' full':'')+'">'+images.map(function(image){
    return '<figure class="book-art-fit '+(image.pageFit === 'cover' ? 'cover' : 'contain')+'"><img src="'+DAL.imageSrc(proj,image)+'" alt="'+DAL.escapeHtml(image.name||'Illustration')+'">'+(fullPage&&image.name?'<figcaption>'+DAL.escapeHtml(image.name)+'</figcaption>':'')+'</figure>';
  }).join('')+'</div>';
};

DAL.renderIllustrations = function(proj){
  if(!proj.images) proj.images = [];
  var html = '<div class="u-measure-wide">';
  function label(key,fallback,name){return DAL.escapeHtml(DAL.i18n?DAL.i18n.text(key,fallback,{name:name||'illustration'}):fallback);}
  html += ("<div class=\"section-header\"><div class=\"section-title\">"+DAL.uiLabel("tool_illustrations","Illustrations")+"</div>")+
    '<div style="display:flex;gap:8px">'+
    '<input type="file" id="illustrationUpload" accept="image/*" multiple style="display:none">'+
    ("<button class=\"btn primary\" data-action=\"upload-illustration\">"+DAL.uiLabel("ui__Upload_Images_7c9ef02","+ Upload Images")+"</button>")+
    '</div></div>';
  html += ("<p style=\"color:var(--c-text-muted);font-size:var(--ts-sm);margin-bottom:16px;line-height:1.6\">"+DAL.uiLabel("ui_Upload_artwork_once_then_assign_it_to_a_bo_4913be3","Upload artwork once, then assign it to a book page. Page 1 is always the cover, page 2 is the table of contents, pages after that follow the chapter order, and higher page numbers create full-art pages for comics or manga.")+"</p>");

  if(proj.images.length === 0){
    html += '<div class="card" style="text-align:center;padding:40px">';
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--c-text-faint);margin:0 auto 12px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
    html += ("<div style=\"font-weight:600;margin-bottom:4px\">"+DAL.uiLabel("ui_No_illustrations_yet_ab5c9c3","No illustrations yet")+"</div>");
    html += ("<div style=\"font-size:var(--ts-sm);color:var(--c-text-muted)\">"+DAL.uiLabel("ui_Upload_images_to_build_your_asset_library__044ad48","Upload images to build your asset library. You can then assign them as covers, chapter art, item icons, and scene illustrations.")+"</div>");
    html += '</div>';
  } else {
    html += '<div class="illustration-grid">';
    proj.images.forEach(function(img, i){
      html += '<div class="illustration-card">';
      html += '<div class="illustration-thumb">'+(DAL.imageSrc(proj,img)?'<img src="'+DAL.escapeHtml(DAL.imageSrc(proj,img))+'" alt="'+DAL.escapeHtml(img.name||'Illustration')+'">':("<div class=\"illustration-placeholder\">"+DAL.uiLabel("ui_No_image_0a82166","No image")+"</div>"))+'</div>';
      html += '<div class="illustration-info">';
      html += '<input class="form-input illustration-name-input" maxlength="200" aria-label="'+label('illustrationNameFor','Image name for '+(img.name||'illustration'),img.name)+'" value="'+DAL.escapeHtml(img.name||'')+'" data-illustration-name="'+i+("\" placeholder=\""+DAL.uiLabel("ui_Image_name_52493ec","Image name")+"\">");
      html += '<div style="display:flex;align-items:center;gap:4px;margin-top:4px">';
      html += '<select class="form-select illustration-category" aria-label="'+label('illustrationCategoryFor','Category for '+(img.name||'illustration'),img.name)+'" data-illustration-category="'+i+'" style="font-size:var(--ts-xs);flex:1">';
      var cats = ['Cover','Chapter Art','Character','Item Icon','Scene','Other'];
      cats.forEach(function(c){ html += '<option value="'+c.toLowerCase().replace(/\s/g,'-')+'"'+(img.category===c.toLowerCase().replace(/\s/g,'-')?' selected':'')+'>'+c+'</option>'; });
      html += '</select>';
      html += '<button class="btn sm danger" aria-label="'+label('illustrationDeleteNamed','Delete '+(img.name||'illustration'),img.name)+'" data-action="delete-illustration" data-idx="'+i+'">&times;</button>';
      html += '</div>';
      html += ("<div class=\"illustration-page-controls\"><label>"+DAL.uiLabel("ui_Book_page_8b0206f","Book page")+"<input class=\"form-input\" type=\"number\" min=\"0\" step=\"1\" value=\"")+(parseInt(img.bookPage,10)||0)+'" data-illustration-page="'+i+'" aria-label="Book page for '+DAL.escapeHtml(img.name||'illustration')+("\"></label><label>"+DAL.uiLabel("ui_Page_fit_bc8dfab","Page fit")+"<select class=\"form-select\" data-illustration-fit=\"")+i+'"><option value="contain"'+(img.pageFit==='cover'?'':' selected')+(">"+DAL.uiLabel("ui_Fit_whole_image_0ef6f00","Fit whole image")+"</option><option value=\"cover\"")+(img.pageFit==='cover'?' selected':'')+(">"+DAL.uiLabel("ui_Fill_page_fb314a7","Fill page")+"</option></select></label></div>");
      html += '<div class="illustration-page-label">'+DAL.escapeHtml(DAL.bookPageLabel(proj,img.bookPage))+'</div>';
      if(img.usedIn && img.usedIn.length){
        html += '<div style="font-size:var(--ts-xs);color:var(--c-text-faint);margin-top:4px">Used in: '+DAL.escapeHtml(img.usedIn.join(', '))+'</div>';
      }
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
};
DAL.renderMindMap = function(proj){
  if(!proj.mindmap) proj.mindmap = { nodes: [], edges: [] };
  var mm = proj.mindmap;
  if(DAL.selectedNodeId&&!mm.nodes.some(function(node){return node.id===DAL.selectedNodeId;}))DAL.selectedNodeId=null;

  var html = '<div class="canvas-toolbar">'+
    '<button class="tb-btn" data-action="mm-add-node" title="Add idea" aria-label="Add idea"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>'+
    '<button class="tb-btn" data-action="mm-edit-sel" title="Edit selected idea" aria-label="Edit selected idea"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></svg></button>'+
    ("<button class=\"tb-btn\" data-action=\"mm-connect\" title=\""+DAL.uiLabel("ui_Connect_ideas_e9bdda9","Connect ideas")+"\" aria-label=\""+DAL.uiLabel("ui_Connect_ideas_e9bdda9","Connect ideas")+"\" aria-pressed=\"")+(DAL.connectMode?'true':'false')+'" '+(DAL.connectMode?'style="background:var(--c-accent-soft);color:var(--c-accent)"':'')+'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>'+
    '<button class="tb-btn" data-action="mm-delete-sel" title="Delete selected idea" aria-label="Delete selected idea"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg></button>'+
    ("<button class=\"tb-btn mobile-context-action\" data-action=\"selection-menu\" title=\""+DAL.uiLabel("ui_More_actions_for_selected_idea_2dd0087","More actions for selected idea")+"\" aria-label=\""+DAL.uiLabel("ui_More_actions_for_selected_idea_2dd0087","More actions for selected idea")+"\">&#8942;</button>")+
    '<span class="tb-sep"></span>'+
    DAL.canvasViewControls()+
    '<span style="flex:1"></span>'+DAL.infoIcon('Mind Map: add or double-tap to create an idea. Select an idea to edit or delete it. Right-click, touch and hold, or use More for child, connection, clipboard, and delete tools. Drag ideas to rearrange them.')+
  '</div>';
  html += '<div class="canvas-container u-fill-canvas'+(mm.nodes.length?'':' empty-canvas')+'" id="canvasContainer"><div class="canvas-inner" id="canvasInner"><div class="canvas-stage" id="canvasStage">';
  html += '<svg class="canvas-svg" id="canvasSvg"></svg>';
  mm.nodes.forEach(function(n){
    var sel = n.id === DAL.selectedNodeId ? ' selected' : '';
    var source = DAL.connectMode&&n.id===DAL.selectedNodeId ? ' connect-source' : '';
    var label = n.label || 'Idea';
    var color = /^#[0-9a-f]{6}$/i.test(n.color||'') ? n.color : '#a855f7';
    var x = Number(n.x), y = Number(n.y);
    if(!Number.isFinite(x)) x = 0;
    if(!Number.isFinite(y)) y = 0;
    html += '<div class="canvas-node mind-node'+sel+source+'" data-action="mm-select" data-nid="'+DAL.escapeHtml(n.id)+'" data-sel="mind-node:'+DAL.escapeHtml(n.id)+'" data-ctx="mind-node" data-ctx-id="'+DAL.escapeHtml(n.id)+'" tabindex="0" role="button" aria-label="Mind map idea '+DAL.escapeHtml(label)+'. Use arrow keys to move." style="left:'+x+'px;top:'+y+'px;--mind-color:'+color+'">'+
      '<div class="canvas-node-title">'+DAL.escapeHtml(label)+'</div>'+
      (n.description?'<div class="canvas-node-preview">'+DAL.escapeHtml(n.description)+'</div>':'')+
      (n.type?'<div class="canvas-node-badge">'+DAL.escapeHtml(n.type)+'</div>':'')+
    '</div>';
  });
  if(!mm.nodes.length){
    html += '<div class="canvas-empty">'+
      ("<div style=\"margin-bottom:8px;font-size:var(--ts-lg);color:var(--c-text-muted)\">"+DAL.uiLabel("ui_What_is_a_Mind_Map__0735570","What is a Mind Map?")+"</div>")+
      ("<p style=\"line-height:1.6\">"+DAL.uiLabel("ui_A_mind_map_is_a_free_form_visual_brainstor_b1d0509","A mind map is a free-form visual brainstorming space. Use it to jot down ideas, connect them with lines, and see how different parts of your story relate to each other.")+"</p>")+
      ("<p style=\"margin-top:8px\">"+DAL.uiLabel("ui_Double_click_or_double_tap_the_canvas_to_a_50bf7dd","Double-click or double-tap the canvas to add an idea. Select an idea to edit it, then right-click, touch and hold, or use More for every action. Tap a connection line to remove it.")+"</p>")+
    '</div>';
  }
  html += '</div></div></div>';
  return html;
};

DAL.mindMapNode = function(proj,id){return proj&&proj.mindmap&&(proj.mindmap.nodes||[]).find(function(node){return node.id===id;});};
DAL.removeMindMapNode = function(id){var proj=DAL.state.projects[DAL.currentProjectId],mm=proj&&proj.mindmap;if(!mm||!DAL.mindMapNode(proj,id))return false;DAL.pushHistory();mm.nodes=mm.nodes.filter(function(node){return node.id!==id;});mm.edges=mm.edges.filter(function(edge){return edge.from!==id&&edge.to!==id;});if(DAL.selectedNodeId===id)DAL.selectedNodeId=null;proj.updatedAt=Date.now();DAL.saveState();DAL.render();DAL.toast((DAL.i18n?DAL.i18n.text("ui_Idea_deleted_f7c299d","Idea deleted"):"Idea deleted"),'warning');return true;};
DAL.connectMindMapNodes = function(proj,fromId,toId){var mm=proj&&proj.mindmap;if(!mm||fromId===toId||!DAL.mindMapNode(proj,fromId)||!DAL.mindMapNode(proj,toId))return false;if(mm.edges.some(function(edge){return edge.from===fromId&&edge.to===toId||edge.from===toId&&edge.to===fromId;}))return false;mm.edges.push({id:DAL.uid('edge'),from:fromId,to:toId});return true;};
DAL.showMindMapNodeEditor = function(id){var proj=DAL.state.projects[DAL.currentProjectId],node=DAL.mindMapNode(proj,id);if(!node)return;DAL._editingMindNode=id;DAL.modal((DAL.i18n?DAL.i18n.text("ui_Edit_Idea_3b35cdb","Edit Idea"):"Edit Idea"),("<div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("worldField_title","Title")+"</label><input class=\"form-input\" id=\"mmNodeLabel\" value=\"")+DAL.escapeHtml(node.label||'')+("\" placeholder=\""+DAL.uiLabel("ui_Idea_title_9f21db5","Idea title")+"\"></div><div class=\"writer-form-grid\"><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("worldField_folder","Category")+"</label><input class=\"form-input\" id=\"mmNodeType\" value=\"")+DAL.escapeHtml(node.type||'idea')+("\" placeholder=\""+DAL.uiLabel("ui_idea_character_location__3029cf3","idea, character, location…")+"\"></div><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("color","Color")+"</label><input class=\"form-input\" id=\"mmNodeColor\" type=\"color\" value=\"")+(/^#[0-9a-f]{6}$/i.test(node.color||'')?node.color:'#a855f7')+("\"></div></div><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Notes_8a7525b","Notes")+"</label><textarea class=\"form-textarea\" id=\"mmNodeDescription\" placeholder=\""+DAL.uiLabel("ui_Develop_the_idea_questions_reminders_or_co_5ecc1ef","Develop the idea, questions, reminders, or context…")+"\">")+DAL.escapeHtml(node.description||'')+("</textarea></div><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("worldField_tags","Tags")+"</label><input class=\"form-input\" id=\"mmNodeTags\" value=\"")+DAL.escapeHtml((node.tags||[]).join(', '))+("\" placeholder=\""+DAL.uiLabel("ui_theme_session_research_4d59053","theme, session, research")+"\"></div>"),{footer:("<button class=\"btn\" data-action=\"close-modal\">"+DAL.uiLabel("cancel","Cancel")+"</button><button class=\"btn primary\" data-action=\"mm-save-node\">"+DAL.uiLabel("ui_Save_idea_a95a3ba","Save idea")+"</button>")});};

DAL.CTX['mind-node']=function(id){return [{heading:'Mind map idea'},{label:'Edit idea',action:'mm-edit-node',data:{nid:id}},{label:'Connect from this idea…',action:'mm-start-connect',data:{nid:id}},{label:'Add child idea',action:'mm-add-child',data:{nid:id}},{label:'Remove all connections',action:'mm-clear-connections',data:{nid:id}},{divider:true},{label:'Cut',action:'edit-cut'},{label:'Copy',action:'edit-copy'},{label:'Duplicate',action:'edit-duplicate'},{divider:true},{label:'Delete',action:'edit-delete',danger:true}];};
DAL.SELECT['mind-node']={label:function(id){var node=DAL.mindMapNode(DAL.state.projects[DAL.currentProjectId],id);return node?node.label:'Idea';},copy:function(id){return DAL.clone(DAL.mindMapNode(DAL.state.projects[DAL.currentProjectId],id));},remove:DAL.removeMindMapNode};
DAL.PASTE['mind-node']=function(payload){var proj=DAL.state.projects[DAL.currentProjectId],mm=proj&&proj.mindmap;if(!mm)return false;DAL.pushHistory();var node=DAL.clone(payload||{});node.id=DAL.uid('mm');node.label=(node.label||'Idea')+' copy';node.x=Math.max(0,Math.min(2480,(parseFloat(node.x)||0)+30));node.y=Math.max(0,Math.min(1620,(parseFloat(node.y)||0)+30));mm.nodes.push(node);DAL.selectedNodeId=node.id;proj.updatedAt=Date.now();DAL.saveState();DAL.render();return true;};

/* Canvas: view controls, panning, zooming and node dragging
   One implementation serves both boards. Which board is on screen is decided by
   the current tool, and the shape of the data differs (a story graph connects
   scenes through choices, a mind map through its own edge list), but the
   gestures, the zoom and the saved view behave identically in both.

   Zoom works by scaling an inner stage. The scrollable box around it grows with
   the scale, because a transform changes what gets drawn without changing the
   size of anything that scrolls — without that, zooming in would put the far
   side of the board out of reach. */

// Movement below this many pixels is treated as a tap, not a drag, so a click
// on a node is never swallowed by an accidental one-pixel wobble.
DAL.CANVAS_DRAG_SLOP = 4;

// Shared zoom + grab controls for both canvas toolbars.
DAL.canvasViewControls = function(){
  var proj = DAL.state && DAL.currentProjectId ? DAL.state.projects[DAL.currentProjectId] : null;
  var zoom = proj ? DAL.canvasView(proj).zoom : 1;
  var grab = DAL.grabMode ? ' active' : '';
  return '<button class="tb-btn'+grab+'" data-action="sg-grab" aria-pressed="'+(DAL.grabMode?'true':'false')+'"'+
      ' title="Grab tool — drag the board around instead of moving scenes" aria-label="Grab tool">'+
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm">'+
      '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v7"/>'+
      '<path d="M10 10.5V6a2 2 0 0 0-4 0v8"/>'+
      '<path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8v-1a2 2 0 0 1 4 0"/></svg></button>'+
    '<button class="tb-btn" data-action="sg-zoom-out" title="Zoom out" aria-label="Zoom out"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>'+
    '<span class="tb-zoom" data-canvas-zoom aria-live="polite">'+Math.round(zoom*100)+'%</span>'+
    '<button class="tb-btn" data-action="sg-zoom-in" title="Zoom in" aria-label="Zoom in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>'+
    '<button class="tb-btn" data-action="sg-reset" title="Fit all scenes on screen" aria-label="Fit all scenes"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>'+
    '<span class="tb-sep"></span>';
};

DAL.canvasEls = function(){
  var container = document.getElementById('canvasContainer');
  var inner = document.getElementById('canvasInner');
  var stage = document.getElementById('canvasStage');
  if(!container || !inner || !stage) return null;
  return { container: container, inner: inner, stage: stage, svg: document.getElementById('canvasSvg') };
};

// The nodes and connections of whichever board is on screen.
DAL.canvasData = function(proj){
  if(DAL.canvasBoard() === 'storygraph') return DAL.ensureAdventure(proj);
  if(!proj.mindmap) proj.mindmap = { nodes: [], edges: [] };
  return proj.mindmap;
};
DAL.mindMapNodePosition=function(proj,container){
  var view=DAL.canvasView(proj),zoom=Math.max(0.1,Number(view.zoom)||1);
  if(!container&&DAL.canvasEls){var elements=DAL.canvasEls();container=elements&&elements.container;}
  var width=container&&container.clientWidth||800,height=container&&container.clientHeight||600;
  var left=container&&container.scrollLeft||0,top=container&&container.scrollTop||0;
  var visibleLeft=left/zoom,visibleTop=top/zoom,visibleRight=(left+width)/zoom,visibleBottom=(top+height)/zoom;
  var centerX=(left+width/2)/zoom,centerY=(top+height/2)/zoom,cardWidth=Math.min(220,(visibleRight-visibleLeft)-16),cardHeight=Math.min(120,(visibleBottom-visibleTop)-16);
  var offsets=[[0,0],[112,0],[-112,0],[0,150],[0,-150],[112,150],[-112,150],[112,-150],[-112,-150],[224,0],[-224,0],[0,300],[0,-300]];
  var nodes=(proj.mindmap&&proj.mindmap.nodes)||[];
  for(var i=0;i<offsets.length;i++){
    var x=Math.max(8,Math.min(2420,Math.round(centerX-cardWidth/2+offsets[i][0]))),y=Math.max(8,Math.min(1540,Math.round(centerY-cardHeight/2+offsets[i][1])));
    var visible=x>=visibleLeft&&y>=visibleTop&&x+cardWidth<=visibleRight&&y+cardHeight<=visibleBottom;
    var occupied=nodes.some(function(node){return Math.abs((Number(node.x)||0)-x)<240&&Math.abs((Number(node.y)||0)-y)<135;});
    if(visible&&!occupied)return{x:x,y:y};
  }
  return{x:Math.max(8,Math.min(2420,Math.round(centerX-cardWidth/2))),y:Math.max(8,Math.min(1540,Math.round(centerY-cardHeight/2)))};
};
DAL.revealMindMapNode=function(id){
  var proj=DAL.state.projects[DAL.currentProjectId],node=DAL.mindMapNode(proj,id),elements=DAL.canvasEls&&DAL.canvasEls();
  if(!proj||!node||!elements)return false;
  var c=elements.container,v=DAL.canvasView(proj),z=Math.max(0.1,Number(v.zoom)||1);
  c.scrollLeft=Math.max(0,Math.min(c.scrollWidth-c.clientWidth,(Number(node.x)||0)*z+110*z-c.clientWidth/2));
  c.scrollTop=Math.max(0,Math.min(c.scrollHeight-c.clientHeight,(Number(node.y)||0)*z+60*z-c.clientHeight/2));
  v.scrollX=c.scrollLeft;v.scrollY=c.scrollTop;DAL.saveState();return true;
};

DAL.applyCanvasView = function(proj){
  var els = DAL.canvasEls();
  if(!els) return;
  var view = DAL.canvasView(proj);
  els.stage.style.transform = view.zoom === 1 ? '' : 'scale('+view.zoom+')';
  els.inner.style.width = Math.round(els.stage.offsetWidth * view.zoom) + 'px';
  els.inner.style.height = Math.round(els.stage.offsetHeight * view.zoom) + 'px';
  var label = document.querySelector('[data-canvas-zoom]');
  if(label) label.textContent = Math.round(view.zoom * 100) + '%';
};

// Scrolling is how the canvas is panned, so the saved position is a scroll
// offset. Writing it back is guarded because restoring it fires scroll events of
// its own, which would otherwise overwrite what we are in the middle of applying.
DAL._canvasRestoring = false;

DAL.restoreCanvasScroll = function(proj){
  var els = DAL.canvasEls();
  if(!els) return;
  var view = DAL.canvasView(proj);
  DAL._canvasRestoring = true;
  els.container.scrollLeft = view.scrollX;
  els.container.scrollTop = view.scrollY;
  setTimeout(function(){ DAL._canvasRestoring = false; }, 0);
};

DAL.rememberCanvasScroll = function(proj){
  var els = DAL.canvasEls();
  if(!els || DAL._canvasRestoring) return;
  var view = DAL.canvasView(proj);
  view.scrollX = els.container.scrollLeft;
  view.scrollY = els.container.scrollTop;
  DAL.saveState();
};

/* Steps to another zoom level while holding whatever is in the middle of the
   viewport still, which is what makes repeated zooming feel like it is aimed at
   the work rather than at the corner of the board. */
DAL.stepCanvasZoom = function(proj, delta){
  var els = DAL.canvasEls();
  if(!els) return;
  var view = DAL.canvasView(proj);
  var i = DAL.zoomIndex(view.zoom) + delta;
  if(i < 0 || i >= DAL.ZOOM_LEVELS.length){
    DAL.toast(delta > 0 ? 'Already at the closest zoom' : 'Already at the widest zoom', 'info');
    return;
  }
  var c = els.container;
  var midX = (c.scrollLeft + c.clientWidth / 2) / view.zoom;
  var midY = (c.scrollTop + c.clientHeight / 2) / view.zoom;
  view.zoom = DAL.ZOOM_LEVELS[i];
  DAL.applyCanvasView(proj);
  DAL._canvasRestoring = true;
  c.scrollLeft = Math.max(0, midX * view.zoom - c.clientWidth / 2);
  c.scrollTop = Math.max(0, midY * view.zoom - c.clientHeight / 2);
  setTimeout(function(){ DAL._canvasRestoring = false; }, 0);
  view.scrollX = c.scrollLeft;
  view.scrollY = c.scrollTop;
  DAL.saveState();
};

DAL.resetCanvasView = function(proj){
  var els = DAL.canvasEls();
  if(!els) return;
  var view = DAL.canvasView(proj);
  var nodes = (DAL.canvasData(proj).nodes || []);
  var x = 0, y = 0, zoom = 1;
  if(nodes.length){
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(function(n){
      var nx = n.x || 0, ny = n.y || 0;
      var nodeEl = Array.from(els.stage.querySelectorAll('[data-nid]')).find(function(element){ return element.getAttribute('data-nid') === String(n.id); });
      var nw = nodeEl ? nodeEl.offsetWidth : 160, nh = nodeEl ? nodeEl.offsetHeight : 90;
      if(nx < minX) minX = nx;
      if(ny < minY) minY = ny;
      if(nx + nw > maxX) maxX = nx + nw;
      if(ny + nh > maxY) maxY = ny + nh;
    });
    var availableW = Math.max(1, els.container.clientWidth - 16);
    var availableH = Math.max(1, els.container.clientHeight - 16);
    var fit = Math.min(1, availableW / Math.max(1, maxX - minX), availableH / Math.max(1, maxY - minY));
    zoom = DAL.ZOOM_LEVELS[0];
    DAL.ZOOM_LEVELS.forEach(function(level){ if(level <= fit && level <= 1) zoom = level; });
    x = ((minX + maxX) / 2) * zoom - els.container.clientWidth / 2;
    y = ((minY + maxY) / 2) * zoom - els.container.clientHeight / 2;
  }
  view.zoom = zoom;
  DAL.applyCanvasView(proj);
  view.scrollX = Math.max(0, Math.round(x));
  view.scrollY = Math.max(0, Math.round(y));
  DAL.restoreCanvasScroll(proj);
  DAL.saveState();
};

/* Grab mode is sticky: press once to pick the hand up, press again (or Escape)
   to put it down. It is toggled in place rather than through a re-render so the
   board does not flicker or lose its place mid-gesture. */
DAL.setGrabMode = function(on){
  DAL.grabMode = !!on;
  var els = DAL.canvasEls();
  if(els) els.container.classList.toggle('grab-mode', DAL.grabMode);
  var btn = document.querySelector('[data-action="sg-grab"]');
  if(btn){
    btn.classList.toggle('active', DAL.grabMode);
    btn.setAttribute('aria-pressed', DAL.grabMode ? 'true' : 'false');
  }
};

DAL.handleCanvasClick = function(action, el, e){
  if(!DAL.currentProjectId) return;
  var proj = DAL.state.projects[DAL.currentProjectId];
  if(!proj || !DAL.canvasEls()) return;
  if(action === 'sg-grab'){ DAL.setGrabMode(!DAL.grabMode); return; }
  if(action === 'sg-zoom-in'){ DAL.stepCanvasZoom(proj, 1); return; }
  if(action === 'sg-zoom-out'){ DAL.stepCanvasZoom(proj, -1); return; }
  if(action === 'sg-reset'){ DAL.resetCanvasView(proj); return; }
};

/* Redraws the connection lines from the current node positions. Called on every
   frame of a node drag as well as after one, so lines stay attached to their
   nodes instead of snapping into place at the end. */
DAL.drawCanvasEdges = function(proj, data){
  var els = DAL.canvasEls();
  if(!els || !els.svg) return;
  var isStoryGraph = DAL.canvasBoard() === 'storygraph';
  var parts = [];
  // The arrow marker has to be redefined each time because the whole svg body is
  // rewritten; a story graph reads as a direction of travel without it.
  if(isStoryGraph){
    parts.push('<defs><marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">'+
      '<path d="M0,0 L10,5 L0,10 z" fill="var(--c-border)"/></marker></defs>');
  }
  var curve = function(from, to, extra, trim){
    var x1 = (from.x||0)+70, y1 = (from.y||0)+20;
    var x2 = (to.x||0)+70, y2 = (to.y||0)+20;
    var mx = (x1+x2)/2, my = (y1+y2)/2-20;
    if(trim){
      // Lines run centre to centre, so an arrowhead at the exact end point would
      // sit underneath the scene box where nobody can see it. Pull the end back
      // to just outside the box along the direction the line arrives from.
      var dx = x2-mx, dy = y2-my;
      var hw = 78, hh = 32;
      var t = Math.min(Math.abs(dx) > 0.01 ? hw/Math.abs(dx) : Infinity,
                       Math.abs(dy) > 0.01 ? hh/Math.abs(dy) : Infinity);
      if(isFinite(t) && t < 1){ x2 -= dx*t; y2 -= dy*t; }
    }
    return '<path d="M'+x1+','+y1+' Q'+mx+','+my+' '+Math.round(x2)+','+Math.round(y2)+'" fill="none" stroke="var(--c-border)" stroke-width="2" '+extra+'/>';
  };
  var nodes = data.nodes || [];
  var find = function(id){ return nodes.find(function(n){ return n.id === id; }); };
  if(isStoryGraph){
    nodes.forEach(function(n){
      (n.choices||[]).forEach(function(ch){
        if(!ch.targetNodeId) return;
        var to = find(ch.targetNodeId);
        if(to) parts.push(curve(n, to, 'marker-end="url(#arrowhead)" style="pointer-events:none"', true));
      });
    });
  } else {
    (data.edges||[]).forEach(function(edge){
      var from = find(edge.from), to = find(edge.to);
      if(from && to) parts.push(curve(from, to, 'data-action="mm-delete-edge" data-eid="'+DAL.escapeHtml(edge.id)+'" style="pointer-events:stroke;cursor:pointer"'));
    });
  }
  els.svg.innerHTML = parts.join('');
};

DAL.initCanvasInteractions = function(proj){
  var els = DAL.canvasEls();
  if(!els) return;
  var container = els.container, stage = els.stage;
  var data = DAL.canvasData(proj);

  DAL.applyCanvasView(proj);
  DAL.restoreCanvasScroll(proj);
  DAL.drawCanvasEdges(proj, data);
  container.classList.toggle('grab-mode', DAL.grabMode);

  // Assigned rather than added: the canvas markup is rebuilt on every render, but
  // this runs again on plain redraws too, and addEventListener would stack up a
  // second and third copy of the same gesture on the same element.
  var gesture = null;

  container.onpointerdown = function(e){
    if(e.button > 0) return;
    var nodeEl = e.target.closest('.canvas-node');
    var view = DAL.canvasView(proj);
    if(nodeEl && !DAL.grabMode && !DAL.connectMode){
      var node = (data.nodes||[]).find(function(n){ return n.id === nodeEl.getAttribute('data-nid'); });
      if(!node) return;
      gesture = { kind: 'node', node: node, el: nodeEl, fromX: node.x||0, fromY: node.y||0 };
    } else if(DAL.grabMode){
      gesture = { kind: 'pan', scrollX: container.scrollLeft, scrollY: container.scrollTop };
    } else {
      return;
    }
    gesture.id = e.pointerId;
    gesture.startX = e.clientX;
    gesture.startY = e.clientY;
    gesture.moved = false;
    // Capturing keeps the gesture alive when the pointer runs off the node or
    // past the edge of the canvas mid-drag.
    try { container.setPointerCapture(e.pointerId); } catch(err) {}
  };

  container.onpointermove = function(e){
    if(!gesture || e.pointerId !== gesture.id) return;
    var dx = e.clientX - gesture.startX, dy = e.clientY - gesture.startY;
    if(!gesture.moved && Math.abs(dx) + Math.abs(dy) < DAL.CANVAS_DRAG_SLOP) return;
    gesture.moved = true;
    if(gesture.kind === 'node') DAL.pushHistory();
    if(gesture.kind === 'pan'){
      // Panning moves the scroll box, which is measured in screen pixels, so the
      // pointer movement is used as it comes.
      DAL._canvasRestoring = true;
      container.scrollLeft = gesture.scrollX - dx;
      container.scrollTop = gesture.scrollY - dy;
    } else {
      // Node coordinates are unscaled board units, so the movement is divided by
      // the zoom or the node slides away from the pointer at any other scale.
      var z = DAL.canvasView(proj).zoom;
      gesture.node.x = Math.max(0, Math.round(gesture.fromX + dx / z));
      gesture.node.y = Math.max(0, Math.round(gesture.fromY + dy / z));
      gesture.el.style.left = gesture.node.x + 'px';
      gesture.el.style.top = gesture.node.y + 'px';
      DAL.drawCanvasEdges(proj, data);
    }
  };

  var finish = function(e){
    if(!gesture || (e && e.pointerId !== gesture.id)) return;
    try { container.releasePointerCapture(gesture.id); } catch(err) {}
    if(gesture.moved){
      // A real drag must not also count as a click, or letting go of a node
      // would open its editor every time.
      DAL._canvasClickGuard = true;
      if(gesture.kind === 'node'){
        proj.updatedAt = Date.now();
        DAL.drawCanvasEdges(proj, data);
        DAL.saveState();
      } else {
        DAL._canvasRestoring = false;
        DAL.rememberCanvasScroll(proj);
      }
    }
    gesture = null;
  };
  container.onpointerup = finish;
  container.onpointercancel = finish;

  container.onclick = function(e){
    if(DAL._canvasClickGuard){
      DAL._canvasClickGuard = false;
      e.stopPropagation();
      e.preventDefault();
    }
  };

  container.onscroll = function(){
    if(DAL._canvasRestoring) return;
    if(DAL._canvasScrollTimer) clearTimeout(DAL._canvasScrollTimer);
    DAL._canvasScrollTimer = setTimeout(function(){ DAL.rememberCanvasScroll(proj); }, 250);
  };

  // Double-click adds an idea to a mind map. A story graph's scenes are created
  // from the toolbar instead, because a scene needs a title and text to mean
  // anything.
  container.ondblclick = function(e){
    if(DAL.canvasBoard() === 'storygraph') return;
    if(e.target !== container && e.target !== els.inner && e.target !== stage && e.target !== els.svg) return;
    var rect = stage.getBoundingClientRect();
    var z = DAL.canvasView(proj).zoom;
    DAL.pushHistory();
    var idea={
      id: DAL.uid('mm'), label: 'New Idea', type: 'idea', description:'', tags:[], color:'#a855f7',
      x: Math.max(0, Math.round((e.clientX - rect.left) / z)),
      y: Math.max(0, Math.round((e.clientY - rect.top) / z))
    };
    data.nodes.push(idea);DAL.selectedNodeId=idea.id;proj.updatedAt=Date.now();DAL.saveState();DAL.render();setTimeout(function(){DAL.showMindMapNodeEditor(idea.id);},0);
  };
};
DAL.renderBookPreview = function(proj){
  if(!proj.chapters) proj.chapters = [];
  if(DAL.readerPage === undefined || DAL.readerPage === null) DAL.readerPage = 0;
  if(DAL._readerPid !== proj.id){ DAL.readerPage = 0; DAL._readerPid = proj.id; }

  var pages = [];
  var author = proj.cover.author || (DAL.state.autoFillAuthor ? DAL.state.authorName : '');
  var coverImage = DAL.bookPageImages(proj, 1)[0];
  var coverHtml = '<div class="book-cover">'+(coverImage?'<div class="book-cover-image '+(coverImage.pageFit==='contain'?'contain':'cover')+'"><img src="'+DAL.imageSrc(proj,coverImage)+'" alt="'+DAL.escapeHtml(coverImage.name||'Book cover')+'"></div>':'')+'<div class="book-cover-copy"><div class="book-cover-title">'+DAL.escapeHtml(proj.cover.title||proj.name)+'</div>'+(proj.cover.subtitle?'<div class="book-cover-subtitle">'+DAL.escapeHtml(proj.cover.subtitle)+'</div>':'')+(author?'<div class="book-cover-author">'+DAL.escapeHtml(author)+'</div>':'')+'</div></div>';
  pages.push({ html: coverHtml, className:'book-page-cover' });
  var tocHtml = ("<h1>"+DAL.uiLabel("ui_Table_of_Contents_a9360e0","Table of Contents")+"</h1>");
  proj.chapters.forEach(function(ch, i){ tocHtml += '<p style="cursor:pointer;color:var(--c-accent)" data-action="bp-goto" data-page="'+(i+2)+'">'+(i+1)+'. '+DAL.escapeHtml(ch.title)+'</p>'; });
  if(!proj.chapters.length) tocHtml += ("<p>"+DAL.uiLabel("ui_No_chapters_have_been_added_yet__36572a7","No chapters have been added yet.")+"</p>");
  pages.push({ html:DAL.bookPageArt(proj,2,false)+tocHtml });
  proj.chapters.forEach(function(ch, index){
    var pageNumber = index + 3;
    var chHtml = DAL.bookPageArt(proj,pageNumber,false)+'<h2>'+DAL.escapeHtml(ch.title)+'</h2>';
    if(ch.images && ch.images.length){
      ch.images.forEach(function(img){
        chHtml += '<div class="chapter-illustration"><img src="'+DAL.imageSrc(proj,img)+'">'+(img.name?'<div class="chapter-illustration-caption">'+DAL.escapeHtml(img.name)+'</div>':'')+'</div>';
      });
    }
    /* Wrapping the prose keeps the drop capital on the chapter's own opening
       paragraph rather than on the first line of the table of contents. */
    chHtml += '<div class="chapter-prose">'+(DAL.writerPublishHTML?DAL.writerPublishHTML(proj,ch):ch.contentHTML)+'</div>';
    pages.push({ html:chHtml, chapter:ch });
  });
  var highestAssigned = (proj.images||[]).reduce(function(max,image){ return Math.max(max,parseInt(image.bookPage,10)||0); },0);
  var totalPages=Math.max(pages.length,Number.isSafeInteger(highestAssigned)?highestAssigned:pages.length);
  if(!Number.isSafeInteger(DAL.readerPage)||DAL.readerPage<0||DAL.readerPage>=totalPages)DAL.readerPage=0;
  var selectedPage=pages[DAL.readerPage]||{html:DAL.bookPageArt(proj,DAL.readerPage+1,true)||("<div class=\"book-art-empty\">"+DAL.uiLabel("ui_No_illustration_is_assigned_to_this_page__3c62274","No illustration is assigned to this page.")+"</div>"),className:'book-page-art-only'};

  /* The narrator needs to know which chapter is on screen so a bound voiceover
     clip is used in place of the synthesised voice. */
  var pageCh = selectedPage.chapter || null;
  DAL._readAloudCid = pageCh ? pageCh.id : '';

  var design=DAL.ensureBookDesign?DAL.ensureBookDesign(proj):{dropCaps:true,pageNumbers:true};
  var html = '<div class="book-reader preview-'+proj.previewProfile+'" data-design-drop-caps="'+(design.dropCaps?'on':'off')+'"'+DAL.readerStyleAttr(DAL.bookDesignVars?DAL.bookDesignVars(proj):'')+'>';
  html += ("<div class=\"book-reader-toolbar\"><div class=\"reader-title\">"+DAL.uiLabel("tool_bookpreview","Book Preview")+"</div>")+(DAL.previewProfileControl?DAL.previewProfileControl(proj):'')+("<button class=\"btn sm\" data-action=\"ws-tool\" data-tool=\"bookdesign\">"+DAL.uiLabel("ui_Design_0072e6b","Design")+"</button>")+DAL.readerControls()+'</div>';
  html += '<div class="book-page-container"><div class="book-page '+(selectedPage.className||'')+'" id="bookPage">'+selectedPage.html+(design.pageNumbers?'<div class="book-page-num">'+(DAL.readerPage+1)+' / '+totalPages+'</div>':'')+'</div></div>';
  html += '<div class="book-nav"><button class="btn sm" data-action="bp-prev" '+(DAL.readerPage<=0?'disabled':'')+(">"+DAL.uiLabel("ui__Previous_435567b","← Previous")+"</button><span style=\"font-size:var(--ts-xs);color:var(--c-text-faint)\">")+(DAL.readerPage+1)+' / '+totalPages+'</span><button class="btn sm" data-action="bp-next" '+(DAL.readerPage>=totalPages-1?'disabled':'')+(">"+DAL.uiLabel("ui_Next__bcf0489","Next →")+"</button></div></div>");
  return html;
};

/* Export registry
   Every export button in the app is generated from this one list so the Export
   tool tab, the RPG export tab and the Export Project dialog cannot drift apart
   in wording or in which formats they offer. Groups appear only when the
   project actually has that kind of content. */
DAL.exportGroups = function(proj){
  var groups = [];
  var chapters = proj.chapters || [];
  var nodes = (proj.adventure && proj.adventure.nodes) ? proj.adventure.nodes : [];
  var hasProse = proj.type === 'novel' || proj.type === 'dual' || chapters.length > 0;
  var hasAdventure = proj.type === 'rpg' || proj.type === 'dual' || nodes.length > 0;

  groups.push({
    title: 'Whole project',
    note: 'A ZIP is the portable backup: it includes project data and every project asset. JSON contains project data only.',
    items: [{ action: 'export-json', label: 'Project data (.json)' }, { action: 'export-project-bundle', label: 'Export project ZIP' }]
  });
  if(hasProse){
    groups.push({
      title: 'Manuscript',
      note: 'The prose on its own. This is not a project backup \u2014 characters, lore and settings are not included.',
      items: [
        { action: 'export-manuscript-txt',  label: 'Manuscript (.txt)' },
        { action: 'export-manuscript-md',   label: 'Manuscript (.md)' },
        { action: 'export-manuscript-html', label: 'Manuscript (.html)' },
        { action: 'export-manuscript-docx', label: 'Word manuscript (.docx)' },
        { action: 'export-epub', label: 'Publication EPUB (.epub)' },
        { action: 'writer-print', label: 'Print-ready PDF' }
      ]
    });
  }
  if(chapters.length){
    groups.push({
      title: 'Single chapter',
      select: { id: 'exportChapterSelect', options: chapters.map(function(ch, i){ return { value: ch.id, label: (i + 1) + '. ' + ch.title }; }) },
      items: [
        { action: 'export-chapter-txt', label: 'Chapter (.txt)', small: true },
        { action: 'export-chapter-md',  label: 'Chapter (.md)',  small: true }
      ]
    });
  }
  if(hasAdventure){
    groups.push({
      title: 'Adventure',
      note: 'Playable formats for the branching story. The playable file runs the same rules the Playthrough tool runs, on its own, in any browser. Twine source opens in Twine and carries stats, traits, items and gated choices; anything SugarCube cannot express is listed in a "Not Carried Over" passage.',
      items: [
        { action: 'export-twee',          label: 'Twine source (.twee)' },
        { action: 'export-playable-html', label: 'Playable adventure (.html)' }
      ]
    });
  }
  if(nodes.length){
    groups.push({
      title: 'Single scene',
      select: { id: 'exportNodeSelect', options: nodes.map(function(n){ return { value: n.id, label: n.title || 'Untitled' }; }) },
      items: [{ action: 'export-node-text', label: 'Scene (.txt)', small: true }]
    });
  }
  return groups;
};

DAL.renderExportGroups = function(proj){
  return DAL.exportGroups(proj).map(function(g){
    var h = '<div class="card export-group"><div class="export-group-title">' + DAL.escapeHtml(g.title) + '</div>';
    if(g.note) h += '<p class="export-group-note">' + DAL.escapeHtml(g.note) + '</p>';
    if(g.title === 'Manuscript' && DAL.writerExportControls) h += DAL.writerExportControls(proj);
    if(g.select){
      h += '<select class="form-select export-group-select" id="' +DAL.escapeHtml(g.select.id)+ '">';
      g.select.options.forEach(function(o){ h += '<option value="' + o.value + '">' + DAL.escapeHtml(o.label) + '</option>'; });
      h += '</select>';
    }
    h += '<div class="export-group-actions">';
    g.items.forEach(function(it){
      h += '<button class="btn' + (it.small ? ' sm' : '') + '" data-action="' + it.action + '" data-pid="' +DAL.escapeHtml(proj.id)+ '">' + DAL.escapeHtml(it.label) + '</button>';
    });
    return h + '</div></div>';
  }).join('');
};

/* Export actions also fire from the File menu, where no button carries a
   project id, so fall back to the open project. */
DAL.exportTarget = function(el){
  var pid = (el && el.getAttribute) ? el.getAttribute('data-pid') : null;
  return DAL.state.projects[pid || DAL.currentProjectId] || null;
};

/* The same select ids exist in a tool panel and in the Export Project dialog
   layered over it, so prefer the dialog's copy while one is open. */
DAL.exportSelectValue = function(id){
  var el = document.querySelector('.modal-backdrop #' + id) || document.getElementById(id);
  return el ? el.value : '';
};
DAL.renderStoryExport = function(proj){
  var html = ("<div class=\"u-measure\"><div class=\"section-header\"><div class=\"section-title\">"+DAL.uiLabel("tool_export-rpg","Export")+"</div></div>");
  html += DAL.renderExportGroups(proj);

  html += ("<div class=\"card\" style=\"margin-bottom:12px\"><div style=\"font-weight:600;margin-bottom:8px\">"+DAL.uiLabel("ui_Cross_Project_Transfer_5e7b986","Cross-Project Transfer")+"</div><p style=\"font-size:var(--ts-sm);color:var(--c-text-muted);margin-bottom:8px\">"+DAL.uiLabel("ui_Copy_a_character_lore_entry_or_plot_thread_e0afd5d","Copy a character, lore entry, or plot thread into another project.")+"</p>")+
    ("<div class=\"form-row\"><select class=\"form-select\" id=\"transferType\"><option value=\"character\">"+DAL.uiLabel("linkCharacter","Character")+"</option><option value=\"lore\">"+DAL.uiLabel("ui_Lore_Entry_e977faf","Lore Entry")+"</option><option value=\"plot\">"+DAL.uiLabel("ui_Plot_Thread_c5f1496","Plot Thread")+"</option></select>")+
    '<select class="form-select" id="transferItem"></select><select class="form-select" id="transferDest">';
  DAL.state.projectOrder.forEach(function(pid){
    if(pid !== proj.id){ var p = DAL.state.projects[pid]; if(p) html += '<option value="'+DAL.escapeHtml(pid)+'">'+DAL.escapeHtml(p.name)+'</option>'; }
  });
  html += '</select></div><button class="btn primary" style="margin-top:8px" data-action="transfer-item" data-pid="'+DAL.escapeHtml(proj.id)+("\">"+DAL.uiLabel("ui_Transfer_dde8bef","Transfer")+"</button></div>");

  html += ("<div class=\"card\"><div style=\"font-weight:600;margin-bottom:8px\">"+DAL.uiLabel("ui_Version_Snapshots_5e0e682","Version Snapshots")+"</div>");
  html += '<button class="btn sm" data-action="save-version" data-pid="'+DAL.escapeHtml(proj.id)+("\">"+DAL.uiLabel("ui_Save_Version_Now_374a742","Save Version Now")+"</button>");
  if(proj.versions && proj.versions.length){
    html += '<div style="margin-top:8px;max-height:200px;overflow-y:auto">';
    proj.versions.forEach(function(v, i){
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--c-divider)"><span style="font-size:var(--ts-xs)">'+DAL.formatTimestamp(v.ts)+(v.auto?' (auto)':'')+' — '+v.snapWords+' words</span><button class="btn sm" data-action="restore-version" data-pid="'+DAL.escapeHtml(proj.id)+'" data-idx="'+i+("\">"+DAL.uiLabel("ui_Restore_a76e13b","Restore")+"</button></div>");
    });
    html += '</div>';
  } else {
    html += ("<div style=\"font-size:var(--ts-xs);color:var(--c-text-faint);margin-top:8px\">"+DAL.uiLabel("ui_No_versions_saved_yet_1135e55","No versions saved yet")+"</div>");
  }
  html += '</div></div>';
  return html;
};

DAL.showExportModal = function(pid){
  var proj = DAL.state.projects[pid || DAL.currentProjectId];
  if(!proj){ DAL.toast((DAL.i18n?DAL.i18n.text("dictationOpenProject","Open a project first."):"Open a project first."),'error'); return; }
  DAL.modal('Export \u201c' + DAL.escapeHtml(proj.name) + '\u201d', '<div class="export-groups">' + DAL.renderExportGroups(proj) + '</div>', { footer: ("<button class=\"btn\" data-action=\"close-modal\">"+DAL.uiLabel("close","Close")+"</button>") });
};

DAL.removeProjectReferences = function(proj, kind, id){
  var remove = function(list){ return (list||[]).filter(function(value){ return value !== id; }); };
  if(kind === 'character'){
    proj.relationships = (proj.relationships||[]).filter(function(rel){ return rel.fromCharId !== id && rel.toCharId !== id; });
    (proj.plots||[]).forEach(function(plot){ plot.linkedCharacterIds = remove(plot.linkedCharacterIds); });
    ((proj.lore||{}).entries||[]).forEach(function(entry){ entry.linkedCharIds = remove(entry.linkedCharIds); });
    (proj.timeline||[]).forEach(function(event){ event.characterIds = remove(event.characterIds); });
    if(DAL._relCenter === id) DAL._relCenter = null;
  } else if(kind === 'plot'){
    (proj.characters||[]).forEach(function(character){ character.linkedPlotIds = remove(character.linkedPlotIds); });
    ((proj.lore||{}).entries||[]).forEach(function(entry){ entry.linkedPlotIds = remove(entry.linkedPlotIds); });
    (proj.timeline||[]).forEach(function(event){ event.plotIds = remove(event.plotIds); });
  } else if(kind === 'chapter'){
    (proj.plots||[]).forEach(function(plot){ plot.linkedChapterIds = remove(plot.linkedChapterIds); });
    (proj.timeline||[]).forEach(function(event){ if(event.chapterId === id) event.chapterId = ''; });
    var structure = DAL.writerProject(proj).structure;
    ((structure||{}).beats||[]).forEach(function(beat){ if(beat.chapterId === id) beat.chapterId = ''; });
  }
};
DAL.handleStoryClick = function(action, el, e){
  if(action === 'toggle-project-sidebar'){
    if(DAL.setWorkspaceDrawer){DAL.setWorkspaceDrawer('project',!DAL.projectSidebarOpen);return;}
    DAL.projectSidebarOpen = !DAL.projectSidebarOpen;
    var workspace = document.querySelector('.workspace');
    if(workspace) workspace.classList.toggle('project-nav-open', DAL.projectSidebarOpen);
    el.setAttribute('aria-expanded', String(DAL.projectSidebarOpen));
    el.setAttribute('aria-label', (DAL.projectSidebarOpen ? 'Close' : 'Open')+' project sections');
    return;
  }
  if(action === 'close-project-sidebar'){
    if(DAL.setWorkspaceDrawer){DAL.setWorkspaceDrawer('project',false);return;}
    DAL.projectSidebarOpen = false;
    document.querySelector('.workspace')?.classList.remove('project-nav-open');
    var projectMenu = document.querySelector('[data-action="toggle-project-sidebar"]');
    if(projectMenu){
      projectMenu.setAttribute('aria-expanded', 'false');
      projectMenu.setAttribute('aria-label', 'Open project sections');
    }
    return;
  }
  if(action === 'toggle-chapters' || action === 'close-chapters'){
    DAL.chapterSidebarOpen = action === 'toggle-chapters' ? !DAL.chapterSidebarOpen : false;
    var manuscript = document.querySelector('.manuscript-layout');
    if(manuscript) manuscript.classList.toggle('chapters-open', DAL.chapterSidebarOpen);
    if(DAL.chapterSidebarOpen){
      var chapterPanelHead = document.querySelector('[data-panel="manuscript-chapters"]');
      if(chapterPanelHead && !chapterPanelHead.closest('.panel').classList.contains('open')) DAL.togglePanel('manuscript-chapters', chapterPanelHead);
    }
    var chapterMenu = document.querySelector('[data-action="toggle-chapters"]');
    if(chapterMenu){
      chapterMenu.setAttribute('aria-expanded', String(!!DAL.chapterSidebarOpen));
      chapterMenu.setAttribute('aria-label', DAL.i18n?DAL.i18n.text(DAL.chapterSidebarOpen?'closeChapters':'openChapters',DAL.chapterSidebarOpen?'Close chapters':'Open chapters'):(DAL.chapterSidebarOpen ? 'Close' : 'Open')+' chapters');
    }
    if(DAL.setWorkspaceDrawer)DAL.setWorkspaceDrawer('chapters',DAL.chapterSidebarOpen);
    return;
  }
  if(action === 'ws-tool'){
    DAL.currentTool = el.getAttribute('data-tool');
    DAL.projectSidebarOpen = false;
    DAL.render();
    return;
  }

  if(action === 'upload-illustration'){ document.getElementById('illustrationUpload').click(); return; }

  if(action === 'delete-illustration'){
    var projIll = DAL.state.projects[DAL.currentProjectId];
    var idxIll = parseInt(el.getAttribute('data-idx'));
    if(projIll.images && projIll.images[idxIll]){
      DAL.pushHistory();projIll.updatedAt=Date.now();
      projIll.images.splice(idxIll, 1);
      DAL.saveState(); DAL.render();
    }
    return;
  }

  if(action === 'upload-chapter-image'){
    var chIdx = el.getAttribute('data-cid');
    DAL._uploadChapterCid = chIdx;
    document.getElementById('chapterImageInput').click();
    return;
  }

  if(action === 'remove-chapter-image'){
    var projCh = DAL.state.projects[DAL.currentProjectId];
    var cidRm = el.getAttribute('data-cid');
    var imgIdx = parseInt(el.getAttribute('data-img-idx'));
    var chRm = projCh.chapters.find(function(c){ return c.id === cidRm; });
    if(chRm && chRm.images){
      if(!Number.isInteger(imgIdx)||imgIdx<0||imgIdx>=chRm.images.length)return;
      DAL.pushHistory();projCh.updatedAt=Date.now();
      chRm.images.splice(imgIdx, 1);
      DAL.saveState(); DAL.render();
    }
    return;
  }

  if(action === 'change-status'){
    var pid = el.getAttribute('data-pid');
    var p = DAL.state.projects[pid];
    if(p){ p.status = el.value; p.updatedAt = Date.now(); DAL.saveState(); }
    return;
  }

  if(action === 'add-chapter'){
    DAL.pushHistory();
    var proj = DAL.state.projects[DAL.currentProjectId];
    var ch = DAL.defaultChapter('Chapter '+(proj.chapters.length+1), proj.chapters.length);
    proj.chapters.push(ch);
    DAL.selectedChapterId = ch.id;
    proj.updatedAt = Date.now();
    DAL.saveState(); DAL.render();
    return;
  }

  if(action === 'select-chapter'){
    var selectProj=DAL.state.projects[DAL.currentProjectId],selectId=el.getAttribute('data-cid');
    if(!selectProj||!selectProj.chapters.some(function(ch){return ch.id===selectId;}))return;
    DAL.selectedChapterId = selectId;
    DAL.chapterSidebarOpen = false;
    DAL.render();
    if(window.matchMedia('(max-width:759px), (max-width:959px) and (max-height:520px)').matches){
      var chapterTrigger=document.querySelector('[data-action="toggle-chapters"]');
      if(chapterTrigger)chapterTrigger.focus();
    }else DAL.focusChapterControl(selectId);
    return;
  }
  if(action === 'chapter-move'){
    var moveProj=DAL.state.projects[DAL.currentProjectId];if(!moveProj)return;
    var moveId=el.getAttribute('data-cid'),direction=el.getAttribute('data-dir'),moveFrom=moveProj.chapters.findIndex(function(chapter){return chapter.id===moveId;}),moveTo=moveFrom+parseInt(direction,10);
    if((direction==='-1'||direction==='1')&&moveFrom>=0&&moveTo>=0&&moveTo<moveProj.chapters.length){DAL.pushHistory();var moved=moveProj.chapters.splice(moveFrom,1)[0];moveProj.chapters.splice(moveTo,0,moved);moveProj.chapters.forEach(function(chapter,index){chapter.order=index;});moveProj.updatedAt=Date.now();DAL.saveState();DAL.render();DAL.focusChapterControl(moveId,direction);}
    return;
  }

  if(action === 'format-block' || action === 'font-family' || action === 'font-size'){
    // These are handled by change event
    return;
  }

  if(action === 'format-cmd'){
    document.execCommand(el.getAttribute('data-cmd'), false, null);
    DAL.saveChapterContent();
    return;
  }

  if(action === 'text-color'){
    document.execCommand('foreColor', false, el.value);
    DAL.saveChapterContent();
    return;
  }

  if(action === 'insert-image'){
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = function(){
      if(inp.files[0]) DAL.readImageAsDataURL(inp.files[0], function(dataUrl){
        document.execCommand('insertHTML', false, '<img src="'+dataUrl+'" style="max-width:100%;border-radius:4px"/>');
        DAL.saveChapterContent();
      });
    };
    inp.click();
    return;
  }

  if(action === 'insert-hr'){
    document.execCommand('insertHorizontalRule');
    DAL.saveChapterContent();
    return;
  }

  if(action === 'fullscreen'){
    DAL.distractionFree = !DAL.distractionFree;
    document.body.classList.toggle('distraction-free', DAL.distractionFree);
    var focusTarget=document.querySelector(DAL.distractionFree?'.focus-exit-button':'[data-menu="view"]');
    if(focusTarget)focusTarget.focus();
    return;
  }

  if(action === 'copy-chapter'){
    var proj2 = DAL.state.projects[DAL.currentProjectId];
    var ch2 = proj2.chapters.find(function(c){ return c.id === DAL.selectedChapterId; });
    if(ch2){
      var tmp = document.createElement('div'); tmp.innerHTML = ch2.contentHTML;
      navigator.clipboard.writeText(tmp.textContent).then(function(){ DAL.toast((DAL.i18n?DAL.i18n.text("ui_Chapter_copied_9aedbdf","Chapter copied"):"Chapter copied"),'success'); });
    }
    return;
  }

  if(action === 'export-chapter'){
    var proj3 = DAL.state.projects[DAL.currentProjectId];
    var ch3 = proj3.chapters.find(function(c){ return c.id === DAL.selectedChapterId; });
    if(ch3){
      var tmp3 = document.createElement('div'); tmp3.innerHTML = ch3.contentHTML;
      DAL.download(DAL.sanitizeFilename(ch3.title)+'.txt', tmp3.textContent);
      DAL.toast((DAL.i18n?DAL.i18n.text("ui_Chapter_exported_684ad51","Chapter exported"):"Chapter exported"),'success');
    }
    return;
  }

  if(action === 'add-character'){
    DAL.pushHistory();
    var proj4 = DAL.state.projects[DAL.currentProjectId];
    var char = { id: DAL.uid('char'), name: 'New Character', role: '', age: '', gender: '', appearance: '', personality: '', backstory: '', arc: '', customFields: [], tags: [], image: '', linkedPlotIds: [], deceased:false, deathChapterId:'', createdAt: Date.now() };
    proj4.characters.push(char);
    DAL.selectedCharId = char.id;
    proj4.updatedAt = Date.now();
    DAL.saveState(); DAL.render();
    return;
  }

  if(action === 'select-character'){
    DAL.selectedCharId = el.getAttribute('data-cid');
    DAL.render();
    return;
  }

  if(action === 'back-to-characters'){
    DAL.selectedCharId = null;
    DAL.render();
    return;
  }

  if(action === 'upload-portrait'){
    var cid = el.getAttribute('data-cid');
    var inp2 = document.createElement('input');
    inp2.type = 'file'; inp2.accept = 'image/*';
    inp2.onchange = function(){
      if(inp2.files[0]) DAL.readImageAsDataURL(inp2.files[0], function(dataUrl){
        var proj5 = DAL.state.projects[DAL.currentProjectId];
        var ch4 = proj5.characters.find(function(c){ return c.id === cid; });
        if(ch4){ ch4.image = dataUrl; DAL.saveState(); DAL.render(); }
      });
    };
    inp2.click();
    return;
  }

  if(action === 'remove-portrait'){
    var cid2 = el.getAttribute('data-cid');
    var proj6 = DAL.state.projects[DAL.currentProjectId];
    var ch5 = proj6.characters.find(function(c){ return c.id === cid2; });
    if(ch5){ ch5.image = ''; DAL.saveState(); DAL.render(); }
    return;
  }

  if(action === 'add-custom-field'){
    var cid3 = el.getAttribute('data-cid');
    var proj7 = DAL.state.projects[DAL.currentProjectId];
    var ch6 = proj7.characters.find(function(c){ return c.id === cid3; });
    if(ch6){ if(!ch6.customFields) ch6.customFields = []; ch6.customFields.push({label:'', value:''}); DAL.saveState(); DAL.render(); }
    return;
  }

  if(action === 'toggle-char-plot'){
    var cid4 = el.getAttribute('data-cid');
    var plotId = el.getAttribute('data-pid');
    var proj8 = DAL.state.projects[DAL.currentProjectId];
    var ch7 = proj8.characters.find(function(c){ return c.id === cid4; });
    if(ch7){
      if(!ch7.linkedPlotIds) ch7.linkedPlotIds = [];
      var idx = ch7.linkedPlotIds.indexOf(plotId);
      if(idx >= 0) ch7.linkedPlotIds.splice(idx, 1); else ch7.linkedPlotIds.push(plotId);
      DAL.saveState(); DAL.render();
    }
    return;
  }

  if(action === 'delete-character'){
    DAL.pushHistory();
    var cid5 = el.getAttribute('data-cid');
    var proj9 = DAL.state.projects[DAL.currentProjectId];
    proj9.characters = proj9.characters.filter(function(c){ return c.id !== cid5; });
    DAL.removeProjectReferences(proj9, 'character', cid5);
    DAL.selectedCharId = null;
    proj9.updatedAt = Date.now();
    DAL.saveState(); DAL.render(); DAL.toast((DAL.i18n?DAL.i18n.text("ui_Character_deleted_05ac524","Character deleted"):"Character deleted"),'warning');
    return;
  }

  if(action === 'rel-center-on'){
    DAL._relCenter = el.getAttribute('data-cid');
    DAL.render();
    return;
  }

  if(action === 'add-relationship'){
    var proj10 = DAL.state.projects[DAL.currentProjectId];
    if(!proj10.characters || proj10.characters.length < 2){ DAL.toast((DAL.i18n?DAL.i18n.text("ui_Need_at_least_2_characters_e8433c8","Need at least 2 characters"):"Need at least 2 characters"),'warning'); return; }
    DAL.openRelationshipEditor(proj10,null);
    return;
  }

  if(action === 'relationship-edit'){
    var projRelEdit=DAL.state.projects[DAL.currentProjectId];
    var relEdit=(projRelEdit.relationships||[]).find(function(rel){return rel.id===el.getAttribute('data-rid');});
    if(relEdit) DAL.openRelationshipEditor(projRelEdit,relEdit);
    return;
  }

  if(action === 'delete-relationship'){
    var projRelDelete=DAL.state.projects[DAL.currentProjectId];
    var deleteId=el.getAttribute('data-rid');
    if(!confirm('Delete this relationship?')) return;
    DAL.pushHistory();
    projRelDelete.relationships=(projRelDelete.relationships||[]).filter(function(rel){return rel.id!==deleteId;});
    projRelDelete.updatedAt=Date.now();
    DAL.saveState(); DAL.render(); DAL.toast((DAL.i18n?DAL.i18n.text("ui_Relationship_deleted_0c84695","Relationship deleted"):"Relationship deleted"),'success');
    return;
  }

  if(action === 'save-relationship'){
    var proj11 = DAL.state.projects[DAL.currentProjectId];
    var fromId = document.getElementById('relFrom').value;
    var toId = document.getElementById('relTo').value;
    var type = document.getElementById('relType').value;
    var desc = document.getElementById('relDesc').value;
    if(fromId===toId){ DAL.toast((DAL.i18n?DAL.i18n.text("ui_Choose_two_different_characters_5425548","Choose two different characters"):"Choose two different characters"),'warning'); return; }
    var categories = { 'Parent':'family','Child':'family','Sibling':'family','Spouse/Partner':'family','Extended Family':'family','Friend':'social','Rival':'social','Enemy':'social','Acquaintance':'social','Mentor':'social','Protégé':'social','Ally':'professional','Colleague':'professional','Unknown/Mystery':'other','Complicated':'other' };
    proj11.relationships = proj11.relationships || [];
    var existingRel=DAL._editingRelationshipId&&proj11.relationships.find(function(rel){return rel.id===DAL._editingRelationshipId;});
    var duplicateRel=proj11.relationships.find(function(rel){return rel!==existingRel&&rel.fromCharId===fromId&&rel.toCharId===toId&&rel.type===type;});
    if(duplicateRel){ DAL.toast((DAL.i18n?DAL.i18n.text("ui_That_relationship_already_exists_bd53292","That relationship already exists"):"That relationship already exists"),'warning'); return; }
    DAL.pushHistory();
    var savedRel=existingRel||{id:DAL.uid('rel')};
    Object.assign(savedRel,{fromCharId:fromId,toCharId:toId,type:type,category:categories[type]||'other',description:desc,directional:(type==='Mentor'||type==='Protégé'||type==='Parent'||type==='Child')});
    if(!existingRel) proj11.relationships.push(savedRel);
    proj11.updatedAt=Date.now();
    DAL._editingRelationshipId=null;
    DAL.saveState(); DAL.closeModal(); DAL.render(); DAL.toast(existingRel?'Relationship updated':'Relationship added','success');
    return;
  }

  if(action === 'add-plot'){
    DAL.pushHistory();
    var proj12 = DAL.state.projects[DAL.currentProjectId];
    var plotType = el.getAttribute('data-type') || 'subplot';
    var plot = { id: DAL.uid('plot'), title: 'New Plot Thread', type: plotType, status: 'planted', description: '', linkedChapterIds: [], linkedCharacterIds: [], introducedChapterId:'', resolvedChapterId:'', lastTouched: Date.now(), createdAt: Date.now() };
    proj12.plots.push(plot);
    DAL.selectedPlotId = plot.id;
    proj12.updatedAt = Date.now();
    DAL.saveState(); DAL.render();
    return;
  }

  if(action === 'select-plot'){
    DAL.selectedPlotId = el.getAttribute('data-pid');
    DAL.render();
    return;
  }

  if(action === 'back-to-plots'){
    DAL.selectedPlotId = null;
    DAL.render();
    return;
  }

  if(action === 'mark-reviewed'){
    var proj13 = DAL.state.projects[DAL.currentProjectId];
    var p2 = proj13.plots.find(function(pl){ return pl.id === el.getAttribute('data-pid'); });
    if(p2){ p2.lastTouched = Date.now(); DAL.saveState(); DAL.render(); DAL.toast((DAL.i18n?DAL.i18n.text("ui_Marked_as_reviewed_7e80ef3","Marked as reviewed"):"Marked as reviewed"),'success'); }
    return;
  }

  if(action === 'delete-plot'){
    DAL.pushHistory();
    var proj14 = DAL.state.projects[DAL.currentProjectId];
    var deletedPlotId = el.getAttribute('data-pid');
    proj14.plots = proj14.plots.filter(function(pl){ return pl.id !== deletedPlotId; });
    DAL.removeProjectReferences(proj14, 'plot', deletedPlotId);
    DAL.selectedPlotId = null;
    proj14.updatedAt = Date.now();
    DAL.saveState(); DAL.render(); DAL.toast((DAL.i18n?DAL.i18n.text("ui_Plot_deleted_76680b7","Plot deleted"):"Plot deleted"),'warning');
    return;
  }

  if(action === 'toggle-plot-chapter' || action === 'toggle-plot-char'){
    var proj15 = DAL.state.projects[DAL.currentProjectId];
    var p3 = proj15.plots.find(function(pl){ return pl.id === el.getAttribute('data-pid'); });
    if(p3){
      var arr = action === 'toggle-plot-chapter' ? (p3.linkedChapterIds||(p3.linkedChapterIds=[])) : (p3.linkedCharacterIds||(p3.linkedCharacterIds=[]));
      var tid = el.getAttribute(action==='toggle-plot-chapter'?'data-chid':'data-cid');
      var idx2 = arr.indexOf(tid);
      if(idx2 >= 0) arr.splice(idx2, 1); else arr.push(tid);
      DAL.saveState(); DAL.render();
    }
    return;
  }

  if(action === 'select-lore-folder'){
    DAL.selectedLoreFolder = el.getAttribute('data-folder');
    DAL.selectedLoreEntry = null;
    DAL.render();
    return;
  }

  if(action === 'select-lore-entry'){
    DAL.selectedLoreEntry = el.getAttribute('data-eid');
    DAL.render();
    return;
  }

  if(action === 'back-to-lore'){
    DAL.selectedLoreEntry = null;
    DAL.render();
    return;
  }

  if(action === 'add-lore-entry'){
    DAL.pushHistory();
    var proj16 = DAL.state.projects[DAL.currentProjectId];
    var entry2 = { id: DAL.uid('lore'), title: 'New Entry', folder: DAL.selectedLoreFolder, content: '', tags: [], linkedCharIds: [], linkedPlotIds: [], updatedAt: Date.now(), createdAt: Date.now() };
    proj16.lore.entries.push(entry2);
    DAL.selectedLoreEntry = entry2.id;
    proj16.updatedAt = Date.now();
    DAL.saveState(); DAL.render();
    return;
  }

  if(action === 'add-lore-folder'){
    var name2 = prompt('Folder name:');
    if(name2){
      var proj17 = DAL.state.projects[DAL.currentProjectId];
      proj17.lore.folders.push(name2);
      DAL.selectedLoreFolder = name2;
      DAL.saveState(); DAL.render();
    }
    return;
  }

  if(action === 'delete-lore-entry'){
    DAL.pushHistory();
    var proj18 = DAL.state.projects[DAL.currentProjectId];
    proj18.lore.entries = proj18.lore.entries.filter(function(en){ return en.id !== el.getAttribute('data-eid'); });
    DAL.selectedLoreEntry = null;
    proj18.updatedAt = Date.now();
    DAL.saveState(); DAL.render(); DAL.toast((DAL.i18n?DAL.i18n.text("ui_Entry_deleted_5c4e132","Entry deleted"):"Entry deleted"),'warning');
    return;
  }

  if(action === 'toggle-lore-char' || action === 'toggle-lore-plot'){
    var proj19 = DAL.state.projects[DAL.currentProjectId];
    var en3 = proj19.lore.entries.find(function(en){ return en.id === el.getAttribute('data-eid'); });
    if(en3){
      var arr2 = action === 'toggle-lore-char' ? (en3.linkedCharIds||(en3.linkedCharIds=[])) : (en3.linkedPlotIds||(en3.linkedPlotIds=[]));
      var tid2 = el.getAttribute(action==='toggle-lore-char'?'data-cid':'data-pid');
      var idx3 = arr2.indexOf(tid2);
      if(idx3 >= 0) arr2.splice(idx3, 1); else arr2.push(tid2);
      DAL.saveState(); DAL.render();
    }
    return;
  }

  if(action === 'timeline-add'){
    var projTimeline = DAL.state.projects[DAL.currentProjectId];
    DAL.pushHistory();
    var maxOrder = (projTimeline.timeline||[]).reduce(function(max,event){return Math.max(max,parseFloat(event.order)||0);},0);
    var timelineEvent = {id:DAL.uid('event'),title:'New Event',date:'',order:maxOrder+1,location:'',summary:'',tags:[],characterIds:[],plotIds:[],chapterId:'',createdAt:Date.now(),updatedAt:Date.now()};
    projTimeline.timeline.push(timelineEvent); DAL.selectedTimelineId=timelineEvent.id; projTimeline.updatedAt=Date.now(); DAL.saveState(); DAL.render(); return;
  }
  if(action === 'timeline-select'){ DAL.selectedTimelineId=el.getAttribute('data-event-id'); DAL.render(); return; }
  if(action === 'timeline-delete'){
    var projTimelineDelete = DAL.state.projects[DAL.currentProjectId]; DAL.pushHistory();
    projTimelineDelete.timeline=(projTimelineDelete.timeline||[]).filter(function(event){return event.id!==el.getAttribute('data-event-id');});
    DAL.selectedTimelineId=null; projTimelineDelete.updatedAt=Date.now(); DAL.saveState(); DAL.render(); DAL.toast((DAL.i18n?DAL.i18n.text("ui_Timeline_event_deleted_13c6442","Timeline event deleted"):"Timeline event deleted"),'warning'); return;
  }

  if(action === 'mm-add-node'){
    var proj20 = DAL.state.projects[DAL.currentProjectId];
    DAL.pushHistory();
    var position=DAL.mindMapNodePosition(proj20),node = { id: DAL.uid('mm'), label: 'New Idea', type: 'idea', description:'', tags:[], color:'#a855f7', x: position.x, y: position.y };
    proj20.mindmap.nodes.push(node);
    DAL.selectedNodeId=node.id;if(DAL.select)DAL.select('mind-node',node.id);proj20.updatedAt=Date.now();DAL.saveState();DAL.render();setTimeout(function(){DAL.revealMindMapNode(node.id);DAL.showMindMapNodeEditor(node.id);},0);
    return;
  }

  if(action === 'mm-edit-sel'){if(DAL.selectedNodeId)DAL.showMindMapNodeEditor(DAL.selectedNodeId);else DAL.toast((DAL.i18n?DAL.i18n.text("ui_Select_an_idea_first_6512377","Select an idea first"):"Select an idea first"),'info');return;}
  if(action === 'mm-edit-node'){DAL.selectedNodeId=el.getAttribute('data-nid');DAL.showMindMapNodeEditor(DAL.selectedNodeId);return;}
  if(action === 'mm-save-node'){var projEdit=DAL.state.projects[DAL.currentProjectId],editNode=DAL.mindMapNode(projEdit,DAL._editingMindNode);if(editNode){var nextLabel=(document.getElementById('mmNodeLabel')||{}).value||'';if(!nextLabel.trim()){DAL.toast((DAL.i18n?DAL.i18n.text("ui_Give_the_idea_a_title_fb8b0ab","Give the idea a title"):"Give the idea a title"),'warning');return;}DAL.pushHistory();editNode.label=nextLabel.trim();editNode.type=((document.getElementById('mmNodeType')||{}).value||'idea').trim()||'idea';editNode.description=((document.getElementById('mmNodeDescription')||{}).value||'').trim();editNode.color=(document.getElementById('mmNodeColor')||{}).value||'#a855f7';editNode.tags=((document.getElementById('mmNodeTags')||{}).value||'').split(',').map(function(tag){return tag.trim();}).filter(Boolean);editNode.updatedAt=Date.now();projEdit.updatedAt=Date.now();DAL.selectedNodeId=editNode.id;DAL.closeModal();DAL.saveState();DAL.render();}return;}
  if(action === 'mm-start-connect'){DAL.connectMode=true;DAL.selectedNodeId=el.getAttribute('data-nid');DAL.render();DAL.toast((DAL.i18n?DAL.i18n.text("ui_Select_another_idea_to_connect_2048d66","Select another idea to connect"):"Select another idea to connect"),'info');return;}
  if(action === 'mm-add-child'){var projChild=DAL.state.projects[DAL.currentProjectId],parent=DAL.mindMapNode(projChild,el.getAttribute('data-nid'));if(parent){DAL.pushHistory();var child={id:DAL.uid('mm'),label:'New Idea',type:'idea',description:'',tags:[],color:parent.color||'#a855f7',x:Math.min(2480,(parseFloat(parent.x)||0)+220),y:Math.min(1620,(parseFloat(parent.y)||0)+80)};projChild.mindmap.nodes.push(child);DAL.connectMindMapNodes(projChild,parent.id,child.id);DAL.selectedNodeId=child.id;if(DAL.select)DAL.select('mind-node',child.id);projChild.updatedAt=Date.now();DAL.saveState();DAL.render();setTimeout(function(){DAL.revealMindMapNode(child.id);DAL.showMindMapNodeEditor(child.id);},0);}return;}
  if(action === 'mm-clear-connections'){var projClear=DAL.state.projects[DAL.currentProjectId],clearId=el.getAttribute('data-nid'),before=projClear.mindmap.edges.length;if(projClear.mindmap.edges.some(function(edge){return edge.from===clearId||edge.to===clearId;})){DAL.pushHistory();projClear.mindmap.edges=projClear.mindmap.edges.filter(function(edge){return edge.from!==clearId&&edge.to!==clearId;});projClear.updatedAt=Date.now();DAL.saveState();DAL.render();DAL.toast((DAL.i18n?DAL.i18n.text("ui_Idea_connections_removed_58bbac0","Idea connections removed"):"Idea connections removed"),'success');}else DAL.toast((DAL.i18n?DAL.i18n.text("ui_This_idea_has_no_connections_4b23b99","This idea has no connections"):"This idea has no connections"),'info');return;}

  if(action === 'mm-connect'){
    DAL.connectMode = !DAL.connectMode;
    DAL.selectedNodeId = null;
    DAL.render();
    return;
  }

  if(action === 'mm-select'){
    if(DAL.connectMode){
      if(!DAL.selectedNodeId){
        DAL.selectedNodeId = el.getAttribute('data-nid');
        DAL.toast((DAL.i18n?DAL.i18n.text("ui_Select_another_node_to_connect_2231327","Select another node to connect"):"Select another node to connect"),'info');
        document.querySelectorAll('.mind-node.selected,.mind-node.connect-source').forEach(function(node){node.classList.remove('selected','connect-source');});el.classList.add('selected','connect-source');
      } else {
        var proj21 = DAL.state.projects[DAL.currentProjectId];
        var fromId = DAL.selectedNodeId;
        var toId = el.getAttribute('data-nid');
        if(fromId!==toId){var alreadyConnected=proj21.mindmap.edges.some(function(edge){return edge.from===fromId&&edge.to===toId||edge.from===toId&&edge.to===fromId;});if(alreadyConnected)DAL.toast((DAL.i18n?DAL.i18n.text("ui_Those_ideas_are_already_connected_4b51dae","Those ideas are already connected"):"Those ideas are already connected"),'info');else{DAL.pushHistory();DAL.connectMindMapNodes(proj21,fromId,toId);proj21.updatedAt=Date.now();DAL.saveState();}}
        DAL.connectMode = false;
        DAL.selectedNodeId = null;
        DAL.render();
      }
    } else {
      DAL.selectedNodeId = el.getAttribute('data-nid');
      document.querySelectorAll('.mind-node.selected').forEach(function(node){node.classList.remove('selected');});el.classList.add('selected');
    }
    return;
  }

  if(action === 'mm-delete-sel'){
    if(DAL.selectedNodeId)DAL.removeMindMapNode(DAL.selectedNodeId);else DAL.toast((DAL.i18n?DAL.i18n.text("ui_Select_an_idea_first_6512377","Select an idea first"):"Select an idea first"),'info');
    return;
  }

  if(action === 'mm-delete-edge'){
    var proj24 = DAL.state.projects[DAL.currentProjectId];
    var edgeId=el.getAttribute('data-eid');if(proj24.mindmap.edges.some(function(edge){return edge.id===edgeId;})){DAL.pushHistory();proj24.mindmap.edges = proj24.mindmap.edges.filter(function(ed){ return ed.id !== edgeId; });proj24.updatedAt=Date.now();DAL.saveState();DAL.render();DAL.toast((DAL.i18n?DAL.i18n.text("ui_Connection_removed_2d806d0","Connection removed"):"Connection removed"),'success');}
    return;
  }

  if(action === 'bp-prev'){
    if(DAL.readerPage > 0){ DAL.readerPage--; DAL.render(); }
    return;
  }
  if(action === 'bp-next'){
    DAL.readerPage++; DAL.render();
    return;
  }
  if(action === 'bp-goto'){
    DAL.readerPage = parseInt(el.getAttribute('data-page')) || 0;
    DAL.render();
    return;
  }

  if(action === 'export-json'){
    var proj25 = DAL.exportTarget(el);
    if(!proj25){ DAL.toast((DAL.i18n?DAL.i18n.text("dictationOpenProject","Open a project first."):"Open a project first."),'error'); return; }
    var projectData = DAL.clone(proj25);
    delete projectData.history; delete projectData.versions; delete projectData.folderHandle;
    var data = {project:projectData};
    if(proj25.bibleId&&DAL.state.bibles[proj25.bibleId]) data.linkedBible=DAL.clone(DAL.state.bibles[proj25.bibleId]);
    DAL.downloadJSON(DAL.sanitizeFilename(proj25.name)+'.json', data).then(function(saved){if(saved)DAL.toast((DAL.i18n?DAL.i18n.text("ui_Project_data_export_completed_Check_the_sa_c6b2d2f","Project data export completed. Check the saved file."):"Project data export completed. Check the saved file."),'success');});
    DAL.closeModal();
    return;
  }

  if(action === 'export-manuscript-txt' || action === 'export-manuscript-md' || action === 'export-manuscript-html'){
    var proj26 = DAL.exportTarget(el);
    if(!proj26){ DAL.toast((DAL.i18n?DAL.i18n.text("dictationOpenProject","Open a project first."):"Open a project first."),'error'); return; }
    if(!(proj26.chapters||[]).length){ DAL.toast((DAL.i18n?DAL.i18n.text("ui_This_project_has_no_chapters_to_export__d4bc861","This project has no chapters to export."):"This project has no chapters to export."),'error'); return; }
    var txt = '',manuscriptDownload;
    if(action === 'export-manuscript-html'){
      txt += '<!DOCTYPE html><html><head><title>'+DAL.escapeHtml(proj26.name)+'</title><style>body{max-width:760px;margin:40px auto;font:12pt/1.6 Georgia,serif}.writer-callout{border:1px solid #777;padding:12px;margin:12px 0}.writer-table{border-collapse:collapse;width:100%}.writer-table th,.writer-table td{border:1px solid #777;padding:6px}.writer-page-break{page-break-after:always;border:0}.writer-highlight{color:#111}</style></head><body>';
      txt += '<h1>'+DAL.escapeHtml(proj26.cover.title||proj26.name)+'</h1>';
      (proj26.chapters||[]).forEach(function(ch){ txt += '<h2>'+DAL.escapeHtml(ch.title)+'</h2>'+(DAL.writerPublishHTML?DAL.writerPublishHTML(proj26,ch):ch.contentHTML); });
      txt += '</body></html>';
      manuscriptDownload=DAL.download(DAL.sanitizeFilename(proj26.name)+'.html', txt, 'text/html');
    } else if(action === 'export-manuscript-md'){
      txt += '# '+(proj26.cover.title||proj26.name)+'\n\n';
      (proj26.chapters||[]).forEach(function(ch){
        var tmp = document.createElement('div'); tmp.innerHTML = DAL.writerPublishHTML?DAL.writerPublishHTML(proj26,ch):ch.contentHTML;
        txt += '## '+ch.title+'\n\n'+tmp.textContent+'\n\n';
      });
      manuscriptDownload=DAL.download(DAL.sanitizeFilename(proj26.name)+'.md', txt, 'text/markdown');
    } else {
      txt += (proj26.cover.title||proj26.name)+'\n\n';
      (proj26.chapters||[]).forEach(function(ch){
        var tmp2 = document.createElement('div'); tmp2.innerHTML = DAL.writerPublishHTML?DAL.writerPublishHTML(proj26,ch):ch.contentHTML;
        txt += ch.title+'\n\n'+tmp2.textContent+'\n\n';
      });
      manuscriptDownload=DAL.download(DAL.sanitizeFilename(proj26.name)+'.txt', txt);
    }
    DAL.closeModal();manuscriptDownload.then(function(saved){if(saved)DAL.toast((DAL.i18n?DAL.i18n.text("ui_Manuscript_export_completed_Check_the_save_0cdb7f6","Manuscript export completed. Check the saved file."):"Manuscript export completed. Check the saved file."),'success');});
    return;
  }

  if(action === 'export-chapter-txt' || action === 'export-chapter-md'){
    var proj27 = DAL.exportTarget(el);
    if(!proj27) return;
    var chId = DAL.exportSelectValue('exportChapterSelect');
    var ch7 = (proj27.chapters||[]).find(function(c){ return c.id === chId; });
    if(ch7){
      var tmp3 = document.createElement('div'); tmp3.innerHTML = DAL.writerPublishHTML?DAL.writerPublishHTML(proj27,ch7):ch7.contentHTML;
      var chapterDownload=action==='export-chapter-md'?DAL.download(DAL.sanitizeFilename(ch7.title)+'.md', '## '+ch7.title+'\n\n'+tmp3.textContent, 'text/markdown'):DAL.download(DAL.sanitizeFilename(ch7.title)+'.txt', ch7.title+'\n\n'+tmp3.textContent);
      chapterDownload.then(function(saved){if(saved)DAL.toast((DAL.i18n?DAL.i18n.text("ui_Chapter_export_completed_Check_the_saved_f_0061927","Chapter export completed. Check the saved file."):"Chapter export completed. Check the saved file."),'success');});
    }
    return;
  }

  if(action === 'transfer-item'){
    var proj28 = DAL.state.projects[el.getAttribute('data-pid')];
    var type = document.getElementById('transferType').value;
    var itemId = document.getElementById('transferItem').value;
    var destId = document.getElementById('transferDest').value;
    var dest = DAL.state.projects[destId];
    if(!dest){ DAL.toast((DAL.i18n?DAL.i18n.text("ui_Select_a_destination_ba615e8","Select a destination"):"Select a destination"),'warning'); return; }
    var item;
    if(type === 'character') item = proj28.characters.find(function(c){ return c.id === itemId; });
    else if(type === 'lore') item = proj28.lore.entries.find(function(en){ return en.id === itemId; });
    else if(type === 'plot') item = proj28.plots.find(function(p){ return p.id === itemId; });
    if(!item){ DAL.toast((DAL.i18n?DAL.i18n.text("ui_Select_an_item_c261ae1","Select an item"):"Select an item"),'warning'); return; }
    var copy = DAL.clone(item);
    copy.id = DAL.uid(type);
    if(type === 'character') dest.characters.push(copy);
    else if(type === 'lore'){ dest.lore = dest.lore || {folders:[],entries:[]}; dest.lore.entries.push(copy); }
    else if(type === 'plot') dest.plots.push(copy);
    dest.updatedAt = Date.now();
    DAL.saveState(); DAL.toast('Transferred to '+dest.name,'success');
    return;
  }

  if(action === 'save-version'){
    var proj29 = DAL.state.projects[el.getAttribute('data-pid')];
    var wc2 = DAL.getProjectWordCount(proj29);
    var snap = DAL.snapshotProject(proj29);
    proj29.versions.push({ ts: Date.now(), auto: false, snapWords: wc2.total, data: snap });
    if(proj29.versions.length > 25) proj29.versions.shift();
    DAL.saveState(); DAL.render(); DAL.toast((DAL.i18n?DAL.i18n.text("ui_Version_saved_17efe3c","Version saved"):"Version saved"),'success');
    return;
  }

  if(action === 'restore-version'){
    var proj30 = DAL.state.projects[el.getAttribute('data-pid')];
    var vIdx = parseInt(el.getAttribute('data-idx'));
    var ver = proj30.versions[vIdx];
    if(!ver) return;
    var restoredData=DAL.clone(ver.data);
    DAL.restoreWithRecovery(proj30,function(){DAL.applySnapshot(proj30,restoredData);}).then(function(ok){DAL.render();if(ok)DAL.toast((DAL.i18n?DAL.i18n.text("ui_Version_restored_6912718","Version restored"):"Version restored"),'success');});
    return;
  }
};

DAL.saveChapterContent = function(){
  var editor = document.getElementById('editorContent');
  if(!editor) return;
  var proj = DAL.state.projects[DAL.currentProjectId];
  if(!proj) return;
  var ch = proj.chapters.find(function(c){ return c.id === DAL.selectedChapterId; });
  if(ch){
    ch.contentHTML = editor.innerHTML;
    ch.updatedAt = Date.now();
    proj.updatedAt = Date.now();
    DAL.saveState();
    if(DAL.scheduleWorldAnalysis) DAL.scheduleWorldAnalysis(proj,ch);
  }
};
document.addEventListener('input', function(e){
  var el = e.target;
  if(el.hasAttribute('data-timeline-field')){ DAL.updateTimelineField(el); return; }
  if(el.hasAttribute('data-char-field')){
    var field = el.getAttribute('data-char-field');
    var proj = DAL.state.projects[DAL.currentProjectId];
    if(!proj || !DAL.selectedCharId) return;
    var ch = proj.characters.find(function(c){ return c.id === DAL.selectedCharId; });
    if(!ch) return;
    if(field === 'tags') ch.tags = el.value.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    else ch[field] = el.value;
    ch.updatedAt = Date.now();
    proj.updatedAt = Date.now();
    DAL.saveState();
    return;
  }
  if(el.hasAttribute('data-cf-label') || el.hasAttribute('data-cf-value')){
    var proj2 = DAL.state.projects[DAL.currentProjectId];
    var ch2 = proj2.characters.find(function(c){ return c.id === DAL.selectedCharId; });
    if(ch2 && ch2.customFields){
      var idx = parseInt(el.getAttribute('data-cf-label')||el.getAttribute('data-cf-value'));
      if(el.hasAttribute('data-cf-label')) ch2.customFields[idx].label = el.value;
      else ch2.customFields[idx].value = el.value;
      DAL.saveState();
    }
    return;
  }
  if(el.id === 'plotTitle' || el.id === 'plotDesc' || el.id === 'plotType' || el.id === 'plotStatus' || el.id === 'plotIntroducedChapter' || el.id === 'plotResolvedChapter'){
    var proj3 = DAL.state.projects[DAL.currentProjectId];
    var p = proj3.plots.find(function(pl){ return pl.id === DAL.selectedPlotId; });
    if(p){
      if(el.id === 'plotTitle') p.title = el.value;
      else if(el.id === 'plotDesc') p.description = el.value;
      else if(el.id === 'plotType') p.type = el.value;
      else if(el.id === 'plotStatus') p.status = el.value;
      else if(el.id === 'plotIntroducedChapter') p.introducedChapterId = el.value;
      else if(el.id === 'plotResolvedChapter') p.resolvedChapterId = el.value;
      p.lastTouched = Date.now();
      proj3.updatedAt = Date.now();
      DAL.saveState();
    }
    return;
  }
  if(el.id === 'loreTitle' || el.id === 'loreContent' || el.id === 'loreTags' || el.id === 'loreFolder'){
    var proj4 = DAL.state.projects[DAL.currentProjectId];
    var entry = proj4.lore.entries.find(function(en){ return en.id === DAL.selectedLoreEntry; });
    if(entry){
      if(el.id === 'loreTitle') entry.title = el.value;
      else if(el.id === 'loreContent') entry.content = el.value;
      else if(el.id === 'loreTags') entry.tags = el.value.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
      else if(el.id === 'loreFolder') entry.folder = el.value;
      entry.updatedAt = Date.now();
      proj4.updatedAt = Date.now();
      DAL.saveState();
    }
    return;
  }
});

/* Keep formatting from trusted editors while preventing pasted HTML from
   introducing executable attributes or embedded documents. */
document.addEventListener('paste', function(e){
  var editor = e.target && e.target.closest ? e.target.closest('#editorContent') : null;
  if(!editor || !e.clipboardData) return;
  var rich = e.clipboardData.getData('text/html');
  if(!rich) return;
  e.preventDefault();
  document.execCommand('insertHTML', false, DAL.sanitizeRichHTML(rich));
});

document.addEventListener('keydown', function(e){
  if(e.key==='Enter'&&!e.isComposing&&e.target&&(e.target.id==='findQuery'||e.target.id==='findReplace')){e.preventDefault();DAL.fireAction('find-run');return;}
  if(e.key==='Enter'&&e.target&&e.target.id==='projectSearchQuery'){e.preventDefault();DAL.showProjectSearch(e.target.value);return;}
  var node=e.target&&e.target.closest?e.target.closest('.canvas-node[data-nid]'):null;if(!node)return;
  if(e.key==='F2'&&DAL.currentTool==='mindmap'){e.preventDefault();DAL.selectedNodeId=node.getAttribute('data-nid');DAL.showMindMapNodeEditor(DAL.selectedNodeId);return;}
  if(e.key==='Enter'||e.key===' '){e.preventDefault();node.click();return;}
  var moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},move=moves[e.key];if(!move)return;
  e.preventDefault();var proj=DAL.state.projects[DAL.currentProjectId],id=node.getAttribute('data-nid'),list=DAL.currentTool==='storygraph'?(((proj||{}).adventure||{}).nodes||[]):(((proj||{}).mindmap||{}).nodes||[]),item=list.find(function(entry){return entry.id===id;});if(!item)return;DAL.pushHistory();
  var step=e.shiftKey?1:10;item.x=Math.max(0,Math.min(2480,(parseFloat(item.x)||0)+move[0]*step));item.y=Math.max(0,Math.min(1620,(parseFloat(item.y)||0)+move[1]*step));node.style.left=item.x+'px';node.style.top=item.y+'px';DAL.selectedNodeId=id;node.classList.add('selected');if(DAL.drawCanvasEdges)DAL.drawCanvasEdges(proj,DAL.canvasData(proj));DAL.saveState();
});
document.addEventListener('dblclick',function(e){var node=e.target&&e.target.closest?e.target.closest('.mind-node[data-nid]'):null;if(!node||DAL.currentTool!=='mindmap')return;e.preventDefault();e.stopPropagation();DAL.selectedNodeId=node.getAttribute('data-nid');DAL.showMindMapNodeEditor(DAL.selectedNodeId);});
document.addEventListener('change', function(e){
  var el = e.target;
  if(el.hasAttribute('data-timeline-field')){ DAL.updateTimelineField(el); return; }
  if(el.hasAttribute('data-action')){
    var action = el.getAttribute('data-action');
    if(action === 'format-block'){
      document.execCommand('formatBlock', false, el.value);
      DAL.saveChapterContent();
    } else if(action === 'font-family'){
      document.execCommand('fontName', false, el.value);
      DAL.saveChapterContent();
    } else if(action === 'font-size'){
      document.execCommand('fontSize', false, '7');
      var fonts = document.querySelectorAll('font[size="7"]');
      fonts.forEach(function(f){ f.removeAttribute('size'); f.style.fontSize = el.value+'px'; });
      DAL.saveChapterContent();
    } else if(DAL.applyReaderPref(action, el)){
      /* Handled by the shared reading-preference handler, which repaints the
         open reader in place instead of re-rendering it. */
    }
  }
  if(el.id === 'transferType'){
    var proj = DAL.state.projects[DAL.currentProjectId];
    var type = el.value;
    var items = [];
    if(type === 'character') items = proj.characters || [];
    else if(type === 'lore') items = (proj.lore&&proj.lore.entries) || [];
    else if(type === 'plot') items = proj.plots || [];
    var sel = document.getElementById('transferItem');
    if(sel){
      sel.innerHTML = items.map(function(it){ return '<option value="'+DAL.escapeHtml(it.id)+'">'+DAL.escapeHtml(it.title||it.name)+'</option>'; }).join('');
    }
  }
});

DAL.updateTimelineField = function(el){
  var proj = DAL.state.projects[DAL.currentProjectId]; if(!proj) return;
  var event = (proj.timeline||[]).find(function(item){return item.id===DAL.selectedTimelineId;}); if(!event) return;
  var field=el.getAttribute('data-timeline-field');
  if(field==='tags') event.tags=el.value.split(',').map(function(value){return value.trim();}).filter(Boolean);
  else if(field==='characterIds'||field==='plotIds') event[field]=Array.from(el.selectedOptions||[]).map(function(option){return option.value;});
  else if(field==='order') event.order=isFinite(parseFloat(el.value))?parseFloat(el.value):0;
  else event[field]=el.value;
  event.updatedAt=Date.now(); proj.updatedAt=Date.now(); DAL.saveState();
};

DAL.writerState = function(){
  if(!DAL.state.writerTools) DAL.state.writerTools = { projects:{}, typewriter:false, find:{query:'',replace:'',scope:'chapter',caseSensitive:false,wholeWord:false} };
  if(!DAL.state.writerTools.projects) DAL.state.writerTools.projects = {};
  return DAL.state.writerTools;
};
DAL.writerProject = function(proj){
  var store = DAL.writerState(), id = proj.id;
  var legacy = store.projects[id];
  var embedded = proj.writerTools;
  var hasEmbedded = embedded && (embedded.structure || ['comments','highlights','bookmarks','footnotes','sources'].some(function(key){ return Array.isArray(embedded[key]) && embedded[key].length; }));
  if(!embedded || typeof embedded !== 'object' || (legacy && !hasEmbedded)){
    proj.writerTools = legacy || { comments:[], structure:null };
  }
  if(legacy) delete store.projects[id];
  var data = proj.writerTools;
  if(!data.comments) data.comments = [];
  return data;
};
DAL.currentWriterProject = function(){ return DAL.state.projects[DAL.currentProjectId]; };
DAL.chapterById = function(proj, id){ return (proj.chapters||[]).find(function(c){ return c.id === id; }); };
DAL.plainChapter = function(ch){var root=document.createElement('div');root.innerHTML=ch.contentHTML||'';return DAL.manuscriptTextModel(root,false).text;};
DAL.commentBadge = function(proj){ return (DAL.writerProject(proj).comments||[]).filter(function(c){ return !c.resolved; }).length ? '<span class="badge">'+(DAL.writerProject(proj).comments||[]).filter(function(c){ return !c.resolved; }).length+'</span>' : ''; };
DAL.writerSave = function(proj){ if(proj) proj.updatedAt=Date.now(); DAL.saveState(); };

DAL.findOptions = function(){
  var f=DAL.writerState().find;
  return {query:f.query||'',replace:f.replace||'',scope:f.scope||'chapter',caseSensitive:!!f.caseSensitive,wholeWord:!!f.wholeWord};
};

DAL.projectSearch = function(proj, query){
  var q = String(query || '').trim().toLowerCase(), results = [];
  if(!proj || q.length < 2) return results;
  function add(kind, id, title, body, extra){
    var hay = (String(title || '')+'\n'+String(body || '')+'\n'+String(extra || '')).toLowerCase(), at = hay.indexOf(q);
    if(at < 0) return;
    var plain = String(body || '').replace(/\s+/g, ' ').trim(), bodyAt = plain.toLowerCase().indexOf(q);
    var start = Math.max(0, (bodyAt < 0 ? 0 : bodyAt) - 55);
    results.push({ kind:kind, id:id, title:title || 'Untitled', context:(start ? '…' : '')+plain.slice(start, start+170)+(plain.length > start+170 ? '…' : '') });
  }
  (proj.chapters || []).forEach(function(ch){ add('Chapter', ch.id, ch.title, DAL.plainChapter(ch)); });
  (proj.characters || []).forEach(function(ch){ add('Character', ch.id, ch.name, [ch.role,ch.personality,ch.backstory,(ch.tags||[]).join(' ')].join(' ')); });
  (proj.plots || []).forEach(function(plot){ add('Plot thread', plot.id, plot.title, [plot.description,plot.notes,plot.status].join(' ')); });
  ((proj.lore && proj.lore.entries) || []).forEach(function(entry){ add('Lore', entry.id, entry.title, [entry.content,(entry.tags||[]).join(' ')].join(' '), entry.folder); });
  (proj.timeline || []).forEach(function(event){ add('Timeline', event.id, event.title, [event.summary,event.location,(event.tags||[]).join(' ')].join(' '), event.date); });
  (((proj.adventure||{}).items)||[]).forEach(function(item){ add('Item', item.id, item.name, [item.description,(item.tags||[]).join(' ')].join(' ')); });
  var bible=DAL.projectBible&&DAL.projectBible(proj);
  if(bible){
    (bible.characters||[]).forEach(function(ch){add('Shared character',ch.id,ch.name,[ch.role,ch.details,(ch.aliases||[]).join(' '),DAL.bibleFactsText?DAL.bibleFactsText(ch):''].join(' '));});
    (((bible.lore||{}).entries)||[]).forEach(function(entry){add('Shared lore',entry.id,entry.title,[entry.content,(entry.aliases||[]).join(' '),DAL.bibleFactsText?DAL.bibleFactsText(entry):''].join(' '),entry.folder);});
    (bible.timeline||[]).forEach(function(event){add('Shared timeline',event.id,event.title,[event.summary,event.location].join(' '),event.date);});
    (bible.glossary||[]).forEach(function(entry){add('Glossary',entry.id,entry.term,[entry.definition,(entry.aliases||[]).join(' ')].join(' '));});
  }
  (((proj.adventure || {}).nodes) || []).forEach(function(node){
    add('Scene', node.id, node.title, [node.text,(node.choices||[]).map(function(choice){return choice.label;}).join(' ')].join(' '));
  });
  return results.slice(0, 100);
};

DAL.showProjectSearch = function(query){
  var proj = DAL.currentWriterProject();
  if(!proj){ DAL.toast((DAL.i18n?DAL.i18n.text("ui_Open_a_project_to_search_it__517c551","Open a project to search it."):"Open a project to search it."), 'info'); return; }
  query = query === undefined ? (DAL._projectSearchQuery || '') : query;
  DAL._projectSearchQuery = query;
  var results = DAL.projectSearch(proj, query), html = ("<div class=\"writer-toolbar\"><input class=\"form-input\" id=\"projectSearchQuery\" autocomplete=\"off\" placeholder=\""+DAL.uiLabel("ui_Search_chapters_characters_lore_plots_time_d8cad92","Search chapters, characters, lore, plots, timeline, and scenes")+"\" value=\"")+DAL.escapeHtml(query)+("\" autofocus><button class=\"btn primary\" data-action=\"project-search-run\">"+DAL.uiLabel("ui_Search_49c266b","Search")+"</button></div>");
  if(String(query).trim().length < 2) html += ("<p class=\"writer-muted\">"+DAL.uiLabel("ui_Enter_at_least_two_characters__bf64a91","Enter at least two characters.")+"</p>");
  else if(!results.length) html += ("<p class=\"writer-muted\">"+DAL.uiLabel("ui_No_matches_found__eb82569","No matches found.")+"</p>");
  else html += '<div class="writer-results">'+results.map(function(result, index){ return '<button class="writer-result" data-action="project-search-open" data-search-index="'+index+'"><span class="comment-meta">'+DAL.escapeHtml(result.kind)+'</span><strong>'+DAL.escapeHtml(result.title)+'</strong><span>'+DAL.escapeHtml(result.context || 'Title match')+'</span></button>'; }).join('')+'</div>';
  DAL._projectSearchResults = results;
  DAL.modal((DAL.i18n?DAL.i18n.text("ui_Search_Entire_Project_d7a61fd","Search Entire Project"):"Search Entire Project"), html, {wide:true, footer:("<button class=\"btn\" data-action=\"close-modal\">"+DAL.uiLabel("close","Close")+"</button>")});
};

DAL.openProjectSearchResult = function(result){
  var proj = DAL.currentWriterProject(); if(!proj || !result) return;
  DAL.closeModal();
  if(result.kind === 'Chapter'){ DAL.currentTool='manuscript'; DAL.selectedChapterId=result.id; }
  else if(result.kind === 'Character'){ DAL.currentTool='characters'; DAL.selectedCharId=result.id; }
  else if(result.kind === 'Plot thread'){ DAL.currentTool='plots'; DAL.selectedPlotId=result.id; }
  else if(result.kind === 'Lore'){
    DAL.currentTool='lore'; DAL.selectedLoreEntry=result.id;
    var entry=((proj.lore||{}).entries||[]).find(function(item){return item.id===result.id;}); if(entry) DAL.selectedLoreFolder=entry.folder;
  }
  else if(result.kind === 'Scene'){ DAL.currentTool='storygraph'; DAL.selectedNodeId=result.id; }
  else if(result.kind === 'Timeline'){ DAL.currentTool='timeline'; DAL.selectedTimelineId=result.id; }
  else if(result.kind === 'Item'){ DAL.currentTool='items'; }
  else if(result.kind.indexOf('Shared ')===0 || result.kind==='Glossary'){
    DAL.currentTool='worldbible'; DAL._bibleRecordId=result.id;
    DAL._bibleSection=result.kind==='Shared character'?'characters':(result.kind==='Shared timeline'?'timeline':(result.kind==='Glossary'?'glossary':'lore'));
  }
  DAL.render();
};
DAL.chapterSearchModel = function(ch){var holder=document.createElement('div');holder.innerHTML=ch.contentHTML||'';return DAL.manuscriptTextModel(holder);};
DAL.findTextMatches = function(text, opts){
  var query=String(opts.query||''),out=[];if(!query)return out;
  var re=new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),opts.caseSensitive?'gu':'giu'),m;
  var word=/[\p{L}\p{M}\p{N}\p{Pc}]/u;
  while((m=re.exec(text))){
    if(opts.wholeWord){var before=Array.from(text.slice(Math.max(0,m.index-2),m.index)).pop()||'',after=Array.from(text.slice(m.index+m[0].length,m.index+m[0].length+2))[0]||'';if(word.test(before)||word.test(after))continue;}
    out.push({index:m.index,length:m[0].length});
  }
  return out;
};
DAL.findMatches = function(proj, opts){
  var out=[];if(!proj||!opts.query)return out;
  (proj.chapters||[]).forEach(function(ch){
    if(opts.scope==='chapter' && ch.id!==DAL.selectedChapterId) return;
    var text=DAL.chapterSearchModel(ch).text;
    DAL.findTextMatches(text,opts).forEach(function(m){out.push({projectId:proj.id,cid:ch.id,title:ch.title,index:m.index,length:m.length,text:text,query:opts.query,caseSensitive:!!opts.caseSensitive,wholeWord:!!opts.wholeWord});});
  });
  return out;
};
DAL.findContext = function(m){
  var a=Math.max(0,m.index-55), b=Math.min(m.text.length,m.index+m.length+55);
  return (a?'…':'')+DAL.escapeHtml(m.text.slice(a,m.index))+'<mark>'+DAL.escapeHtml(m.text.slice(m.index,m.index+m.length))+'</mark>'+DAL.escapeHtml(m.text.slice(m.index+m.length,b))+(b<m.text.length?'…':'');
};
DAL.showFindModal = function(){
  var proj=DAL.currentWriterProject(); if(!proj) return;
  var o=DAL.findOptions(), matches=DAL.findMatches(proj,o), h='';
  var signature=JSON.stringify([proj.id,o.query,o.scope,o.scope==='chapter'?DAL.selectedChapterId:null,o.caseSensitive,o.wholeWord]);
  if(DAL._findPageSignature!==signature){DAL._findPageSignature=signature;DAL._findPage=0;}
  var pages=Math.max(1,Math.ceil(matches.length/50)),page=Math.max(0,Math.min(pages-1,Math.floor(DAL._findPage||0))),first=page*50;DAL._findPage=page;
  function text(key,fallback,values){return DAL.escapeHtml(DAL.findMessage(key,fallback,values));}
  h += '<div class="writer-toolbar"><input class="form-input" id="findQuery" value="'+DAL.escapeHtml(o.query)+'" aria-label="'+text('findInManuscript','Find in manuscript')+'" placeholder="'+text('findInManuscript','Find in manuscript')+'"><input class="form-input" id="findReplace" value="'+DAL.escapeHtml(o.replace)+'" aria-label="'+text('replaceWith','Replace with')+'" placeholder="'+text('replaceWith','Replace with')+'"><button class="btn primary" data-action="find-run">'+text('find','Find')+'</button></div>';
  h += '<div class="writer-toolbar writer-find-options"><select class="form-select" id="findScope" aria-label="'+text('searchScope','Search scope')+'"><option value="chapter"'+(o.scope==='chapter'?' selected':'')+'>'+text('currentChapter','Current chapter')+'</option><option value="manuscript"'+(o.scope==='manuscript'?' selected':'')+'>'+text('wholeManuscript','Whole manuscript')+'</option></select><label class="u-hint"><input type="checkbox" id="findCase"'+(o.caseSensitive?' checked':'')+'> '+text('caseSensitive','Case-sensitive')+'</label><label class="u-hint"><input type="checkbox" id="findWhole"'+(o.wholeWord?' checked':'')+'> '+text('wholeWord','Whole word')+'</label><span class="writer-status" role="status">'+text('matchCount',matches.length+' match'+(matches.length===1?'':'es'),{count:matches.length})+'</span></div>';
  h += '<div class="writer-results">'+(matches.length?matches.slice(first,first+50).map(function(m,offset){var i=first+offset,values={count:i+1,chapter:m.title};return '<div class="writer-result"><button type="button" class="writer-result-jump" data-action="find-open" data-find-index="'+i+'" aria-label="'+text('openFindResult','Open match '+(i+1)+' in '+m.title,values)+'"><strong>'+DAL.escapeHtml(m.title)+'</strong><span>'+DAL.findContext(m)+'</span></button><div><button class="btn sm" data-action="find-replace-one" data-find-index="'+i+'" aria-label="'+text('replaceFindResult','Replace match '+(i+1)+' in '+m.title,values)+'">'+text('replace','Replace')+'</button></div></div>';}).join(''):'<p class="writer-muted">'+text(o.query?'noMatchesFound':(o.scope==='chapter'?'enterChapterQuery':'enterManuscriptQuery'),o.query?'No matches found':('Enter a phrase to search this '+(o.scope==='chapter'?'chapter.':'manuscript.')))+'</p>')+'</div>';
  if(pages>1)h+='<div class="writer-toolbar"><button class="btn" data-action="find-page-prev"'+(!page?' disabled':'')+'>'+text('previousResults','Previous results')+'</button><span class="writer-status">'+text('resultRange','Matches '+(first+1)+'–'+Math.min(first+50,matches.length)+' of '+matches.length,{first:first+1,last:Math.min(first+50,matches.length),count:matches.length})+'</span><button class="btn" data-action="find-page-next"'+(page===pages-1?' disabled':'')+'>'+text('nextResults','Next results')+'</button></div>';
  DAL._findMatches=matches;
  DAL.modal(DAL.findMessage('findReplace','Find & Replace'),h,{wide:true,initialFocus:'#findQuery',footer:'<button class="btn" data-action="close-modal">'+text('close','Close')+'</button><button class="btn" data-action="find-next-modal"'+(!matches.length?' disabled':'')+'>'+text('findNext','Find Next')+'</button><button class="btn primary" data-action="find-replace-all"'+(!matches.length?' disabled':'')+'>'+text('replaceAll','Replace All')+'</button>'});
};
DAL.findMessage = function(key,fallback,values){return DAL.i18n?DAL.i18n.text(key,fallback,values):fallback;};
DAL.readFindForm = function(){
  var f=DAL.writerState().find;
  var query=document.getElementById('findQuery'),replace=document.getElementById('findReplace'),scope=document.getElementById('findScope'),caseField=document.getElementById('findCase'),whole=document.getElementById('findWhole');
  if(query)f.query=query.value;if(replace)f.replace=replace.value;if(scope)f.scope=scope.value;
  if(caseField)f.caseSensitive=caseField.checked;if(whole)f.wholeWord=whole.checked;
  return DAL.findOptions();
};
DAL.replaceTextNodes = function(ch, opts, onlyIndex){
  if(!opts.query)return 0;
  var holder=document.createElement('div');holder.innerHTML=ch.contentHTML||'';
  var model=DAL.manuscriptTextModel(holder),matches=DAL.findTextMatches(model.text,opts),count=0,cursor=model.nodes.length-1;
  matches.slice().reverse().forEach(function(m){
    if(onlyIndex!==undefined&&m.index!==onlyIndex)return;
    var end=m.index+m.length,parts=[];
    while(cursor>=0&&model.nodes[cursor].start>=end)cursor--;
    for(var at=cursor;at>=0&&model.nodes[at].end>m.index;at--)parts.push(model.nodes[at]);
    if(!parts.length)return;
    parts.forEach(function(part){var node=part.node,from=Math.max(0,m.index-part.start),to=Math.min(part.end-part.start,end-part.start);node.nodeValue=node.nodeValue.slice(0,from)+(part===parts[parts.length-1]?String(opts.replace||''):'')+node.nodeValue.slice(to);});count++;
  });
  if(count){ ch.contentHTML=holder.innerHTML; ch.updatedAt=Date.now(); }
  return count;
};
DAL.openFindMatch = function(m){
  var proj=DAL.currentWriterProject(),ch=proj&&m&&DAL.chapterById(proj,m.cid);if(!ch||(m.projectId&&m.projectId!==proj.id))return;
  if(typeof m.text!=='string'||!Number.isInteger(m.index)||m.index<0||!Number.isInteger(m.length)||m.length<=0||m.index+m.length>m.text.length||DAL.chapterSearchModel(ch).text!==m.text){DAL.toast(DAL.findMessage('staleFindMatch','This match changed. Run Find again to refresh the results.'),'info');return;}
  DAL.selectedChapterId=m.cid; DAL.currentTool='manuscript'; DAL.closeModal(); DAL.render();
  setTimeout(function(){
    if(DAL.currentWriterProject()!==proj||DAL.currentTool!=='manuscript'||DAL.selectedChapterId!==ch.id)return;
    var ed=document.getElementById('editorContent');if(!ed)return;var model=DAL.manuscriptTextModel(ed);if(model.text!==m.text)return;
    var end=m.index+m.length,startNode=model.nodes.find(function(n){return n.start<=m.index&&m.index<n.end;}),endNode=model.nodes.find(function(n){return n.start<end&&end<=n.end;});
    if(!startNode||!endNode)return;
    ed.focus();var range=document.createRange();range.setStart(startNode.node,m.index-startNode.start);range.setEnd(endNode.node,end-endNode.start);var sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
    if(DAL.captureWriterSelection)DAL.captureWriterSelection();var target=startNode.node.parentElement;if(target&&target.scrollIntoView)target.scrollIntoView({block:'center'});
  },80);
};

DAL.showComments = function(){
  var proj=DAL.currentWriterProject(); if(!proj) return; var data=DAL.writerProject(proj), current=DAL.chapterById(proj,DAL.selectedChapterId), h='';
  h+='<div class="writer-toolbar"><select class="form-select" id="commentChapter">'+(proj.chapters||[]).map(function(c){return '<option value="'+DAL.escapeHtml(c.id)+'"'+(c.id===DAL.selectedChapterId?' selected':'')+'>'+DAL.escapeHtml(c.title)+'</option>';}).join('')+("</select><button class=\"btn primary\" data-action=\"new-comment\">"+DAL.uiLabel("addComment","Add comment")+"</button><span class=\"writer-status\">")+data.comments.filter(function(c){return !c.resolved;}).length+' unresolved</span></div>';
  h+='<div class="comment-list">'+(data.comments.length?data.comments.slice().reverse().map(function(c){var ch=DAL.chapterById(proj,c.chapterId);return '<div class="comment-item'+(c.resolved?' comment-resolved':'')+'"><strong>'+DAL.escapeHtml(ch?ch.title:'Deleted chapter')+(c.label?' · '+DAL.escapeHtml(c.label):'')+'</strong><div>'+DAL.escapeHtml(c.body||'')+'</div>'+(c.anchor?'<div class="comment-meta">“'+DAL.escapeHtml(c.anchor)+'”</div>':'')+'<div class="comment-meta">'+DAL.formatTimestamp(c.createdAt)+'</div><div class="writer-tool-actions">'+(c.anchor?'<button class="btn sm" data-action="comment-jump" data-comment-id="'+DAL.escapeHtml(c.id)+("\">"+DAL.uiLabel("ui_Jump_to_text_af2b85e","Jump to text")+"</button>"):'')+'<button class="btn sm" data-action="comment-edit" data-comment-id="'+DAL.escapeHtml(c.id)+("\">"+DAL.uiLabel("menuEdit","Edit")+"</button><button class=\"btn sm\" data-action=\"resolve-comment\" data-comment-id=\"")+DAL.escapeHtml(c.id)+'">'+(c.resolved?'Reopen':'Resolve')+'</button><button class="btn sm danger" data-action="delete-comment" data-comment-id="'+DAL.escapeHtml(c.id)+("\">"+DAL.uiLabel("menu_edit_delete","Delete")+"</button></div></div>");}).join(''):("<p class=\"writer-muted\">"+DAL.uiLabel("ui_No_annotations_yet_Add_notes_to_keep_revis_5b184f9","No annotations yet. Add notes to keep revision thoughts beside the manuscript.")+"</p>"))+'</div>';
  DAL.modal((DAL.i18n?DAL.i18n.text("ui_Comments_Annotations_5a90bde","Comments & Annotations"):"Comments & Annotations"),h,{wide:true,footer:("<button class=\"btn\" data-action=\"close-modal\">"+DAL.uiLabel("close","Close")+"</button>")});
};
DAL.commentEditor = function(existing){
  var proj=DAL.currentWriterProject(), selection=DAL._writerRange?String(DAL._writerRange):(window.getSelection?String(window.getSelection()):''), labels=['To Revise','Question','Research','Important','D&D / Session','Study Note'], h='<div class="form-group"><label class="form-label">Chapter</label><select class="form-select" id="commentEditChapter">'+(proj.chapters||[]).map(function(c){return '<option value="'+DAL.escapeHtml(c.id)+'"'+((existing?existing.chapterId:DAL.selectedChapterId)===c.id?' selected':'')+'>'+DAL.escapeHtml(c.title)+'</option>';}).join('')+'</select></div><div class="form-group"><label class="form-label">Label</label><select class="form-select" id="commentLabel"><option value="">General</option>'+labels.map(function(label){return '<option value="'+label+'"'+(existing&&existing.label===label?' selected':'')+'>'+label+'</option>';}).join('')+'</select></div><div class="form-group"><label class="form-label">Anchored text (optional)</label><input class="form-input" id="commentAnchor" value="'+DAL.escapeHtml(existing?existing.anchor:(selection||''))+'" placeholder="Selected manuscript text"></div><div class="form-group"><label class="form-label">Note</label><textarea class="form-textarea" id="commentBody" placeholder="Revision note…">'+DAL.escapeHtml(existing?existing.body:'')+'</textarea></div>';
  DAL._editingComment=existing?existing.id:null; DAL.modal(existing?'Edit Comment':'Add Comment',h,{footer:'<button class="btn" data-action="show-comments">Cancel</button><button class="btn primary" data-action="save-comment">Save</button>'});
};

DAL.sprintWords = function(proj){ return DAL.getProjectWordCount(proj).manuscript; };
DAL.sprintClock = function(){
  var s=DAL.writerState().sprint, proj=s&&DAL.state.projects[s.projectId]; if(!s||!proj) return null;
  var remain=Math.max(0,s.endsAt-Date.now()), written=Math.max(0,DAL.sprintWords(proj)-s.startWords); return {remain:remain,written:written,ended:remain<=0};
};
DAL.stopSprintTimer = function(){ if(DAL._sprintTimer){clearInterval(DAL._sprintTimer); DAL._sprintTimer=null;} };
DAL.renderSprintLive = function(){ var c=DAL.sprintClock(), clock=document.getElementById('sprintClock'), words=document.getElementById('sprintWords'); if(!c)return; if(clock){var sec=Math.ceil(c.remain/1000);clock.textContent=Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');} if(words)words.textContent=c.written; if(c.ended){DAL.stopSprintTimer(); DAL.writerState().sprint.finishedAt=Date.now(); DAL.saveState(true); DAL.showSprint(true);} };
DAL.showSprint = function(finished){
  var proj=DAL.currentWriterProject(); if(!proj)return; var s=DAL.writerState().sprint, c=DAL.sprintClock();
  /* A sprint that is still running belongs in the floating timer, not a modal the
     writer has to dismiss before typing another word. Only the closing summary
     still takes the screen. */
  if(s&&c&&!(c.ended||finished)){
    var ws=DAL.sprintWidgetState(); ws.visible=true; ws.collapsed=false; DAL.saveState(true);
    DAL.closeModal(); DAL.renderSprintWidget();
    return;
  }
  if(s&&c){ var summary=c.ended||finished, h='<div class="sprint-clock" id="sprintClock">'+Math.floor(Math.ceil(c.remain/1000)/60)+':'+String(Math.ceil(c.remain/1000)%60).padStart(2,'0')+'</div><div class="sprint-progress"><div><strong id="sprintWords">'+c.written+("</strong>"+DAL.uiLabel("ui_words_written_4befce6","words written")+"</div><div><strong>")+((s.target||0)?s.target:'—')+("</strong>"+DAL.uiLabel("ui_word_target_eda5a35","word target")+"</div></div>")+(summary?'<p class="writer-muted" style="text-align:center">Sprint complete. '+c.written+' manuscript words recorded.</p>':'');
    DAL.modal(summary?'Sprint Complete':'Writing Sprint',h,{footer:'<button class="btn" data-action="stop-sprint">'+(summary?'Done':'End Sprint')+'</button>'}); if(!summary){DAL.stopSprintTimer();DAL._sprintTimer=setInterval(DAL.renderSprintLive,1000);} return; }
  var h2=("<div class=\"writer-form-grid\"><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Minutes_4f846a8","Minutes")+"</label><input class=\"form-input\" id=\"sprintMinutes\" type=\"number\" min=\"1\" value=\"25\"></div><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Word_target_optional__9be0207","Word target (optional)")+"</label><input class=\"form-input\" id=\"sprintTarget\" type=\"number\" min=\"0\" placeholder=\"500\"></div></div><p class=\"writer-muted\">"+DAL.uiLabel("ui_The_sprint_follows_your_manuscript_words_e_2f9ca17","The sprint follows your manuscript words even if you change chapters or navigate elsewhere.")+"</p>");
  DAL.modal((DAL.i18n?DAL.i18n.text("ui_Start_Writing_Sprint_7dc7f21","Start Writing Sprint"):"Start Writing Sprint"),h2,{footer:("<button class=\"btn\" data-action=\"close-modal\">"+DAL.uiLabel("cancel","Cancel")+"</button><button class=\"btn primary\" data-action=\"start-sprint\">"+DAL.uiLabel("ui_Start_e4bb9f1","Start")+"</button>")});
};

/* Floating sprint timer
   A modal timer means the writer cannot write while it is open, which defeats
   the point of a sprint. The timer therefore lives in a small panel that floats
   over the workspace, can be dragged anywhere, collapsed to a strip, or hidden
   altogether — and it remembers where it was left. */

DAL.sprintWidgetState = function(){
  var w = DAL.writerState();
  if(!w.sprintWidget) w.sprintWidget = { visible:false, collapsed:false, x:null, y:null };
  var s = w.sprintWidget;
  /* Fields added after the first release default rather than crash on old saves. */
  if(typeof s.visible !== 'boolean') s.visible = false;
  if(typeof s.collapsed !== 'boolean') s.collapsed = false;
  return s;
};

/* Keeps the panel on screen after a window resize or a save made on a larger
   display, so it can never be dragged somewhere it cannot be dragged back from. */
DAL.clampSprintWidget = function(el){
  var s = DAL.sprintWidgetState();
  var w = el.offsetWidth || 210, h = el.offsetHeight || 120;
  var maxX = Math.max(8, window.innerWidth - w - 8);
  var maxY = Math.max(8, window.innerHeight - h - 8);
  var x = s.x == null ? maxX : Math.min(maxX, Math.max(8, s.x));
  var y = s.y == null ? Math.max(8, window.innerHeight - h - 88) : Math.min(maxY, Math.max(8, s.y));
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  return { x:x, y:y };
};

DAL.sprintWidgetBody = function(){
  var s = DAL.sprintWidgetState();
  var clock = DAL.sprintClock();
  var sprint = DAL.writerState().sprint;
  var head = '<div class="sprint-widget-head" data-sprint-grip="1" title="Drag to move">'+
    '<span class="sprint-widget-grip">\u22ee\u22ee</span>'+
    '<span class="sprint-widget-title">Sprint</span>'+
    '<button class="sprint-widget-btn" data-action="collapse-sprint-widget" title="'+(s.collapsed?'Expand':'Collapse')+'">'+(s.collapsed?'\u25b8':'\u25be')+'</button>'+
    '<button class="sprint-widget-btn" data-action="toggle-sprint-widget" title="Hide timer">\u00d7</button>'+
  '</div>';
  if(s.collapsed) return head;
  if(!clock){
    return head + '<div class="sprint-widget-body">'+
      '<p class="sprint-widget-idle">No sprint running.</p>'+
      '<button class="btn sm primary" data-action="show-sprint">Start a sprint</button>'+
    '</div>';
  }
  var sec = Math.ceil(clock.remain / 1000);
  var target = sprint && sprint.target ? sprint.target : 0;
  var pct = target ? Math.min(100, Math.round(clock.written / target * 100)) : 0;
  return head + '<div class="sprint-widget-body">'+
    '<div class="sprint-widget-clock" id="sprintWidgetClock">'+Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')+'</div>'+
    '<div class="sprint-widget-stats"><span><strong id="sprintWidgetWords">'+clock.written+'</strong> words</span>'+
      (target ? '<span><strong>'+target+'</strong> target</span>' : '')+'</div>'+
    (target ? '<div class="sprint-widget-bar"><i id="sprintWidgetBar" style="width:'+pct+'%"></i></div>' : '')+
    '<button class="btn sm" data-action="stop-sprint">End sprint</button>'+
  '</div>';
};

DAL.renderSprintWidget = function(){
  var s = DAL.sprintWidgetState();
  var el = document.getElementById('sprintWidget');
  if(!s.visible){
    if(el) el.remove();
    DAL.stopSprintWidgetTimer();
    return;
  }
  if(!el){
    el = document.createElement('div');
    el.id = 'sprintWidget';
    el.className = 'sprint-widget';
    /* Appended to the body rather than the view, so re-rendering the workspace
       never destroys a running timer or loses where it was placed. */
    document.body.appendChild(el);
  }
  el.classList.toggle('collapsed', !!s.collapsed);
  el.innerHTML = DAL.sprintWidgetBody();
  DAL.clampSprintWidget(el);
  if(DAL.sprintClock()) DAL.startSprintWidgetTimer(); else DAL.stopSprintWidgetTimer();
};

DAL.stopSprintWidgetTimer = function(){
  if(DAL._sprintWidgetTimer){ clearInterval(DAL._sprintWidgetTimer); DAL._sprintWidgetTimer = null; }
};

DAL.startSprintWidgetTimer = function(){
  if(DAL._sprintWidgetTimer) return;
  DAL._sprintWidgetTimer = setInterval(DAL.tickSprintWidget, 1000);
};

/* Only the numbers are rewritten each second. Replacing the whole panel would
   fight the pointer while it is being dragged. */
DAL.tickSprintWidget = function(){
  var clock = DAL.sprintClock();
  if(!clock){ DAL.stopSprintWidgetTimer(); DAL.renderSprintWidget(); return; }
  var sec = Math.ceil(clock.remain / 1000);
  var c = document.getElementById('sprintWidgetClock');
  var w = document.getElementById('sprintWidgetWords');
  var bar = document.getElementById('sprintWidgetBar');
  var sprint = DAL.writerState().sprint;
  if(c) c.textContent = Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');
  if(w) w.textContent = clock.written;
  if(bar && sprint && sprint.target) bar.style.width = Math.min(100, Math.round(clock.written / sprint.target * 100)) + '%';
  if(clock.ended){
    DAL.stopSprintWidgetTimer();
    if(DAL.writerState().sprint && !DAL.writerState().sprint.finishedAt){
      DAL.writerState().sprint.finishedAt = Date.now();
      DAL.saveState(true);
      DAL.showSprint(true);
    }
    DAL.renderSprintWidget();
  }
};

/* Dragging uses its own pointer handler rather than the list drag system, which
   exists to reorder items inside a container. A named attribute keeps the two
   apart so grabbing the timer never looks like reordering a chapter. */
(function(){
  var drag = null;

  document.addEventListener('pointerdown', function(e){
    var grip = e.target.closest ? e.target.closest('[data-sprint-grip]') : null;
    if(!grip || e.target.closest('button')) return;
    var el = document.getElementById('sprintWidget');
    if(!el) return;
    var box = el.getBoundingClientRect();
    drag = { el:el, dx:e.clientX - box.left, dy:e.clientY - box.top, pointerId:e.pointerId, moved:false };
    el.classList.add('dragging');
  });

  document.addEventListener('pointermove', function(e){
    if(!drag || (drag.pointerId !== undefined && e.pointerId !== drag.pointerId)) return;
    e.preventDefault();
    drag.moved = true;
    var w = drag.el.offsetWidth, h = drag.el.offsetHeight;
    var x = Math.min(Math.max(8, e.clientX - drag.dx), Math.max(8, window.innerWidth - w - 8));
    var y = Math.min(Math.max(8, e.clientY - drag.dy), Math.max(8, window.innerHeight - h - 8));
    drag.el.style.left = x + 'px';
    drag.el.style.top = y + 'px';
  }, { passive:false });

  function release(){
    if(!drag) return;
    drag.el.classList.remove('dragging');
    if(drag.moved){
      var s = DAL.sprintWidgetState();
      s.x = parseInt(drag.el.style.left, 10);
      s.y = parseInt(drag.el.style.top, 10);
      DAL.saveState(true);
    }
    drag = null;
  }

  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);

  window.addEventListener('resize', function(){
    var el = document.getElementById('sprintWidget');
    if(el) DAL.clampSprintWidget(el);
  });
})();

/* The widget survives view changes, so it is refreshed after every render. */
(function(){
  DAL.registerAfterRender(function(){ if(DAL.renderSprintWidget) DAL.renderSprintWidget(); });
})();

DAL.syllables = function(word){ word=(word||'').toLowerCase().replace(/[^a-z]/g,''); if(word.length<3)return word?1:0; var n=(word.replace(/e$/,'').match(/[aeiouy]+/g)||[]).length; return Math.max(1,n); };
DAL.report = function(proj){
  var stop={the:1,and:1,that:1,have:1,with:1,this:1,from:1,were:1,been:1,they:1,will:1,into:1,about:1,which:1,when:1,then:1,than:1,them:1,there:1,their:1,what:1,your:1,said:1,just:1,like:1,over:1,also:1,only:1,very:1}, filler=['just','very','really','quite','rather','somewhat','maybe','actually','basically','suddenly'], total={words:0,sentences:0,paragraphs:0,analysisWords:0,syllables:0,adverbs:0,passive:0,counts:Object.create(null),longest:[],fillers:Object.create(null),englishAnalysis:/^en(?:-|$)/i.test(proj.language||'en')};
  var one=function(ch){
    var text=DAL.plainChapter(ch),words=text.match(/\p{L}[\p{L}\p{M}'’\-]*/gu)||[],paras=text.split(/\n+/).filter(function(p){return p.trim();}),sentences=[];
    paras.forEach(function(p){(p.match(/[^.!?。！？؟]+[.!?。！？؟]*|[.!?。！？؟]+/g)||[]).forEach(function(s){if(/[\p{L}\p{N}]/u.test(s))sentences.push(s.trim());});});
    if(/\p{L}/u.test(text.replace(/[A-Za-z]/g,'')))total.englishAnalysis=false;
    var r={title:ch.title,words:DAL.countWordsText(text),sentences:sentences.length,paragraphs:paras.length};
    total.analysisWords+=words.length;words.forEach(function(w){var x=w.toLowerCase();total.syllables+=DAL.syllables(x);total.counts[x]=(total.counts[x]||0)+1;if(/ly$/.test(x))total.adverbs++;if(filler.indexOf(x)>=0)total.fillers[x]=(total.fillers[x]||0)+1;});
    sentences.forEach(function(s){total.longest.push({title:ch.title,text:s,words:DAL.countWordsText(s)});if(/\b(?:was|were|is|are|be|been|being)\s+\w+(?:ed|en)\b/i.test(s))total.passive++;});
    total.words+=r.words;total.sentences+=r.sentences;total.paragraphs+=r.paragraphs;return r;
  };
  var chapters=(proj.chapters||[]).map(one);total.longest.sort(function(a,b){return b.words-a.words;});
  var repeated=Object.keys(total.counts).filter(function(w){return !Object.prototype.hasOwnProperty.call(stop,w)&&w.length>2&&total.counts[w]>1;}).sort(function(a,b){return total.counts[b]-total.counts[a];}).slice(0,10);
  total.grade=total.englishAnalysis?(total.analysisWords?Math.max(0,.39*(total.analysisWords/Math.max(1,total.sentences))+11.8*(total.syllables/total.analysisWords)-15.59):0):null;
  total.repeatedEntries=repeated.map(function(w){return {word:w,count:total.counts[w]};});
  total.repeated=total.repeatedEntries.map(function(entry){return entry.word+' ('+entry.count+')';});return {chapters:chapters,total:total};
};
DAL.showReadability = function(){
  var proj=DAL.currentWriterProject();if(!proj)return;
  if(DAL.currentTool==='manuscript'&&DAL.saveChapterContent)DAL.saveChapterContent();
  var r=DAL.report(proj),t=r.total;
  function text(key,fallback,values){return DAL.i18n?DAL.i18n.text(key,fallback,values):fallback;}
  function html(key,fallback,values){return DAL.escapeHtml(text(key,fallback,values));}
  function number(value,options){return DAL.formatNumber?DAL.formatNumber(value,options):new Intl.NumberFormat('en',options).format(value);}
  function metric(value,key,fallback){return '<div class="report-metric"><strong>'+DAL.escapeHtml(value)+'</strong>'+html(key,fallback)+'</div>';}
  function wordCount(value){return html('words',number(value)+' words',{count:value});}
  var decimal={minimumFractionDigits:1,maximumFractionDigits:1};
  var h='<div class="report-grid">'+metric(number(t.words),'reportWords','words')+metric(number(t.sentences),'reportSentences','sentences')+metric(number(t.paragraphs),'reportParagraphs','paragraphs')+
    metric(t.sentences?number(t.words/t.sentences,decimal):'—','reportAverageSentence','avg sentence length')+
    metric(t.grade===null||!t.analysisWords?'—':number(t.grade,decimal),'reportReadabilityGrade','Flesch–Kincaid grade')+
    metric(t.englishAnalysis?number(t.adverbs)+' / '+number(t.passive):'—','reportAdverbsPassive','adverbs / passive candidates')+'</div>'+
    '<p class="writer-muted">'+html('reportMethodHelp','Word totals count whitespace-separated manuscript text, excluding reference markers. Paragraphs include nonempty text blocks and lines. Readability grade, adverb and passive candidates are English-only heuristics; they are unavailable for non-English or mixed-script manuscripts.')+'</p>'+
    '<h3>'+html('reportChapters','Chapters')+'</h3><div class="writer-report-list">'+r.chapters.map(function(c){
      var fallback=number(c.words)+' words · '+number(c.sentences)+' sentences · '+number(c.paragraphs)+' paragraphs';
      return '<div class="writer-result"><strong>'+DAL.escapeHtml(c.title)+'</strong><span>'+html('reportChapterCounts',fallback,{words:c.words,sentences:c.sentences,paragraphs:c.paragraphs})+'</span></div>';
    }).join('')+'</div>'+(r.chapters.length?'':'<p class="writer-muted">'+html('reportNoChapters','Add chapters and prose to see manuscript statistics.')+'</p>')+
    '<h3>'+html('reportRepeatedWords','Most repeated words')+'</h3><p>'+DAL.escapeHtml(t.repeatedEntries.map(function(entry){return entry.word+' ('+number(entry.count)+')';}).join(', ')||text('reportNoRepetitions','No non-stopword repetitions yet.'))+'</p>'+
    '<h3>'+html('reportFillerWords','Filler / crutch words')+'</h3><p>'+DAL.escapeHtml(t.englishAnalysis?(Object.keys(t.fillers).map(function(w){return w+' ('+number(t.fillers[w])+')';}).join(', ')||text('reportNoneDetected','None detected.')):text('reportEnglishUnavailable','English-only analysis is unavailable for this manuscript.'))+'</p>'+
    '<h3>'+html('reportLongestSentences','Longest sentences')+'</h3><div class="writer-report-list">'+t.longest.slice(0,5).map(function(x){return '<div class="writer-result"><strong>'+DAL.escapeHtml(x.title)+' · '+wordCount(x.words)+'</strong><span>'+DAL.escapeHtml(x.text)+'</span></div>';}).join('')+'</div>';
  DAL.modal(text('reportTitle','Manuscript Report'),h,{wide:true,footer:'<button class="btn primary" data-action="close-modal">'+html('done','Done')+'</button>'});
};

DAL.BEAT_TEMPLATES={three:[['Setup','Introduce the ordinary world and story promise.'],['Inciting incident','Disrupt the status quo.'],['First turning point','Commit to the central conflict.'],['Midpoint','Raise stakes with a reversal or revelation.'],['Second turning point','Force the final choice.'],['Climax','Confront the central conflict.'],['Resolution','Show the changed world.']],cat:[['Opening Image','A snapshot of the protagonist before change.'],['Theme Stated','A question or lesson is voiced.'],['Setup','Introduce stakes, wants, and flaws.'],['Catalyst','A life-changing event lands.'],['Debate','Hesitation before commitment.'],['Break into Two','Enter the new world.'],['B Story','Introduce the relationship thread.'],['Midpoint','A false victory or defeat.'],['All Is Lost','The lowest point.'],['Finale','Prove the theme through action.'],['Final Image','Mirror the opening image after change.']],hero:[['Ordinary World','Establish the familiar life.'],['Call to Adventure','Present the disruptive invitation.'],['Refusal of the Call','Show resistance or fear.'],['Meeting the Mentor','Gain guidance or a tool.'],['Crossing the Threshold','Enter the unfamiliar world.'],['Tests, Allies, Enemies','Learn the new rules.'],['Ordeal','Face the central fear.'],['Reward','Claim insight or treasure.'],['Road Back','Turn toward home.'],['Resurrection','Pass a final, transforming test.'],['Return with the Elixir','Bring change back to the world.']]};
DAL.showBeats = function(){var proj=DAL.currentWriterProject();if(!proj)return;var d=DAL.writerProject(proj), cur=d.structure,h=("<p class=\"writer-muted\">"+DAL.uiLabel("ui_Choose_a_story_structure_It_creates_a_sepa_fc3a962","Choose a story structure. It creates a separate checklist and never changes your chapters.")+"</p><div class=\"writer-tool-actions\"><button class=\"btn\" data-action=\"apply-beats\" data-template=\"three\">"+DAL.uiLabel("ui_Three_Act_c370107","Three-Act")+"</button><button class=\"btn\" data-action=\"apply-beats\" data-template=\"cat\">"+DAL.uiLabel("ui_Save_the_Cat_4fd7735","Save the Cat")+"</button><button class=\"btn\" data-action=\"apply-beats\" data-template=\"hero\">"+DAL.uiLabel("ui_Hero_s_Journey_ad39fea","Hero’s Journey")+"</button></div>");
 if(cur){h+='<div class="beat-list">'+cur.beats.map(function(b,i){return '<div class="beat-row"><input type="checkbox" data-action="toggle-beat" data-beat-index="'+i+'"'+(b.done?' checked':'')+'><label><strong>'+DAL.escapeHtml(b.title)+'</strong><span class="writer-muted"> '+DAL.escapeHtml(b.note)+'</span></label><select class="form-select" data-action="attach-beat" data-beat-index="'+i+("\"><option value=\"\">"+DAL.uiLabel("ui_Attach_to_chapter__997f604","Attach to chapter…")+"</option>")+(proj.chapters||[]).map(function(c){return '<option value="'+DAL.escapeHtml(c.id)+'"'+(b.chapterId===c.id?' selected':'')+'>'+DAL.escapeHtml(c.title)+'</option>';}).join('')+'</select></div>';}).join('')+'</div>';}
 DAL.modal((DAL.i18n?DAL.i18n.text("ui_Story_Structure_Templates_26ddd97","Story Structure Templates"):"Story Structure Templates"),h,{wide:true,footer:("<button class=\"btn\" data-action=\"close-modal\">"+DAL.uiLabel("ui_Done_11a6767","Done")+"</button>")});};
DAL.showCorkboard=function(){var proj=DAL.currentWriterProject();if(!proj)return;var h=("<p class=\"writer-muted\">"+DAL.uiLabel("ui_Drag_cards_to_reorder_Titles_synopsis_and__68b2f73","Drag cards to reorder. Titles, synopsis, and status save as you edit.")+"</p><div class=\"corkboard\" data-drop=\"chapter\" data-sort-item=\"[data-drag=\"chapter\"]\">")+(proj.chapters||[]).map(function(c){var syn=c.synopsis||'';return '<article class="cork-card" data-drag="chapter:'+DAL.escapeHtml(c.id)+'" data-drag-label="'+DAL.escapeHtml(c.title)+'"><span class="cork-grip" data-drag-handle=".cork-grip">⋮⋮</span><input class="form-input" data-cork-field="title" data-cork-id="'+DAL.escapeHtml(c.id)+'" value="'+DAL.escapeHtml(c.title)+("\" aria-label=\""+DAL.uiLabel("ui_Chapter_title_2c8cec3","Chapter title")+"\"><textarea class=\"form-textarea\" data-cork-field=\"synopsis\" data-cork-id=\"")+DAL.escapeHtml(c.id)+("\" placeholder=\""+DAL.uiLabel("ui_Synopsis_8eb3755","Synopsis")+"\">")+DAL.escapeHtml(syn)+'</textarea><select class="form-select" data-cork-field="status" data-cork-id="'+DAL.escapeHtml(c.id)+'"><option value="draft"'+((c.status||'draft')==='draft'?' selected':'')+(">"+DAL.uiLabel("ui_Draft_ebf12ef","Draft")+"</option><option value=\"revising\"")+(c.status==='revising'?' selected':'')+(">"+DAL.uiLabel("ui_Revising_c8f3fff","Revising")+"</option><option value=\"complete\"")+(c.status==='complete'?' selected':'')+(">"+DAL.uiLabel("ui_Complete_143b270","Complete")+"</option></select><div class=\"cork-meta\"><span>")+DAL.countWords(c.contentHTML)+' words</span><span>'+DAL.escapeHtml(c.status||'draft')+'</span></div></article>';}).join('')+'</div>';DAL.modal((DAL.i18n?DAL.i18n.text("menu_show_corkboard","Corkboard"):"Corkboard"),h,{wide:true,footer:("<button class=\"btn primary\" data-action=\"close-modal\">"+DAL.uiLabel("ui_Done_11a6767","Done")+"</button>")});};

DAL.makeSnapshot=function(proj,name){var wc=DAL.getProjectWordCount(proj),snap=DAL.snapshotProject(proj);proj.versions=proj.versions||[];proj.versions.push({ts:Date.now(),auto:false,name:name||'',snapWords:wc.total,data:snap});DAL.trimVersions(proj);DAL.saveState();};
DAL.showVersions=function(){var proj=DAL.currentWriterProject();if(!proj)return;var h=("<div class=\"writer-toolbar\"><input class=\"form-input\" id=\"snapshotName\" placeholder=\""+DAL.uiLabel("ui_Optional_snapshot_name_280810e","Optional snapshot name")+"\"><button class=\"btn primary\" data-action=\"take-snapshot\">"+DAL.uiLabel("ui_Take_snapshot_2c86d50","Take snapshot")+"</button></div><div class=\"version-list\">")+((proj.versions||[]).slice().reverse().map(function(v,ri){var i=proj.versions.length-1-ri;return '<div class="version-item"><strong>'+DAL.escapeHtml(v.name||((v.auto?'Auto snapshot':'Untitled snapshot')))+'</strong><div class="comment-meta">'+DAL.formatTimestamp(v.ts)+' · '+v.snapWords+' words</div><div class="writer-tool-actions"><button class="btn sm" data-action="preview-version" data-version-index="'+i+("\">"+DAL.uiLabel("ui_Preview_324b134","Preview")+"</button><button class=\"btn sm\" data-action=\"compare-version\" data-version-index=\"")+i+("\">"+DAL.uiLabel("ui_Compare_e888155","Compare")+"</button><button class=\"btn sm danger\" data-action=\"confirm-restore-version\" data-version-index=\"")+i+("\">"+DAL.uiLabel("ui_Restore_project_d162a6c","Restore project")+"</button></div></div>");}).join('')||("<p class=\"writer-muted\">"+DAL.uiLabel("ui_No_snapshots_yet__dce32a8","No snapshots yet.")+"</p>"))+'</div>';DAL.modal((DAL.i18n?DAL.i18n.text("ui_Version_History_2eba52c","Version History"):"Version History"),h,{wide:true,footer:("<button class=\"btn\" data-action=\"close-modal\">"+DAL.uiLabel("close","Close")+"</button>")});};
DAL.previewVersion=function(i){var p=DAL.currentWriterProject(),v=p&&p.versions&&p.versions[i];if(!v)return;var snap=v.data||{},h='<div class="writer-status">'+DAL.formatTimestamp(v.ts)+' · '+v.snapWords+' words</div><div class="writer-report-list">'+(snap.chapters||[]).map(function(c){return '<div class="writer-result"><strong>'+DAL.escapeHtml(c.title)+'</strong><span>'+DAL.escapeHtml(DAL.plainChapter(c)).slice(0,350)+'</span></div>';}).join('')+'</div>';DAL.modal((DAL.i18n?DAL.i18n.text("ui_Snapshot_Preview_d2762eb","Snapshot Preview"):"Snapshot Preview"),h,{wide:true,footer:'<button class="btn" data-action="show-versions">Back</button><button class="btn danger" data-action="confirm-restore-version" data-version-index="'+i+'">Restore this snapshot</button>'});};
DAL.restoreVersionConfirm=function(i){var p=DAL.currentWriterProject();DAL.modal((DAL.i18n?DAL.i18n.text("ui_Restore_Snapshot_c77a799","Restore Snapshot"):"Restore Snapshot"),'<p>This will replace the current project with the selected snapshot. A recovery snapshot of your current work is saved first and remains available in Version History after closing the app.</p>',{footer:'<button class="btn" data-action="show-versions">Cancel</button><button class="btn danger" data-action="restore-version-now" data-version-index="'+i+'">Restore snapshot</button>'});};
DAL.compareVersion=function(i){
  var p=DAL.currentWriterProject(),v=p&&p.versions&&p.versions[i];if(!v)return;
  var old=(v.data&&v.data.chapters)||[], current=p.chapters||[], ids={}; old.forEach(function(ch){ids[ch.id]=true;}); current.forEach(function(ch){ids[ch.id]=true;});
  var rows=Object.keys(ids).map(function(id){var before=old.find(function(ch){return ch.id===id;}),now=current.find(function(ch){return ch.id===id;}),beforeWords=before?DAL.countWords(before.contentHTML):0,nowWords=now?DAL.countWords(now.contentHTML):0,status=!before?'Added since snapshot':!now?'Removed since snapshot':(before.title===now.title&&before.contentHTML===now.contentHTML?'Unchanged':'Changed'),title=(now||before).title;return '<div class="version-item"><strong>'+DAL.escapeHtml(title)+'</strong><div class="comment-meta">'+status+' · '+beforeWords+' → '+nowWords+' words'+(beforeWords===nowWords?'':' ('+(nowWords-beforeWords>0?'+':'')+(nowWords-beforeWords)+')')+'</div>'+(before?'<button class="btn sm" data-action="restore-version-chapter-confirm" data-version-index="'+i+'" data-chapter-id="'+DAL.escapeHtml(before.id)+'">Restore this chapter</button>':'')+'</div>';}).join('');
  DAL.modal((DAL.i18n?DAL.i18n.text("ui_Compare_Snapshot_ff03366","Compare Snapshot"):"Compare Snapshot"),'<p class="writer-muted">'+DAL.formatTimestamp(v.ts)+' compared with the current project. Exact content and title changes are detected.</p><div class="version-list">'+(rows||'<p>No chapters in either version.</p>')+'</div>',{wide:true,footer:'<button class="btn" data-action="show-versions">Back</button>'});
};
DAL.restoreVersionChapter=function(versionIndex,chapterId){
  var p=DAL.currentWriterProject(),v=p&&p.versions&&p.versions[versionIndex],source=v&&v.data&&v.data.chapters&&v.data.chapters.find(function(ch){return ch.id===chapterId;});if(!source)return;
  var restoredChapter=DAL.clone(source);
  DAL.restoreWithRecovery(p,function(){var at=(p.chapters||[]).findIndex(function(ch){return ch.id===chapterId;});if(at>=0)p.chapters[at]=restoredChapter;else p.chapters.push(restoredChapter);}).then(function(ok){if(ok){DAL.closeModal();DAL.currentTool='manuscript';DAL.selectedChapterId=chapterId;DAL.render();DAL.toast((DAL.i18n?DAL.i18n.text("ui_Chapter_restored_from_snapshot_543ae51","Chapter restored from snapshot"):"Chapter restored from snapshot"),'success');}});
};
DAL.toggleTypewriter=function(){var s=DAL.writerState();s.typewriter=!s.typewriter;DAL.saveState(true);var ed=document.getElementById('editorContent');if(ed)ed.closest('.editor-area').classList.toggle('typewriter-on',s.typewriter);DAL.toast('Typewriter scrolling '+(s.typewriter?'on':'off'),'info');};
DAL.typewriterScroll=function(editor){var s=DAL.writerState();if(!s.typewriter)return;var range=window.getSelection&&window.getSelection().rangeCount?window.getSelection().getRangeAt(0):null, surface=editor.closest('.editor-surface');if(!range||!surface)return;var rect=range.getBoundingClientRect(),sr=surface.getBoundingClientRect();if(rect.top)surface.scrollTop+=rect.top-(sr.top+sr.height/2);};

DAL.DROP.chapter=function(payload,zone,index){if(payload.kind!=='chapter')return;var p=DAL.currentWriterProject(),from=(p.chapters||[]).findIndex(function(c){return c.id===payload.id;});if(from<0)return;DAL.pushHistory();DAL.moveInArray(p.chapters,from,index===null?p.chapters.length:index);p.chapters.forEach(function(c,i){c.order=i;});DAL.writerSave(p);if(document.getElementById('modalBackdrop'))DAL.showCorkboard();else DAL.render();};
DAL.SELECT.chapter={label:function(id){var p=DAL.currentWriterProject(),c=p&&DAL.chapterById(p,id);return c?c.title:'Chapter';},copy:function(id){var p=DAL.currentWriterProject();return DAL.clone(DAL.chapterById(p,id));},remove:function(id){var p=DAL.currentWriterProject();DAL.pushHistory();p.chapters=p.chapters.filter(function(c){return c.id!==id;});DAL.removeProjectReferences(p,'chapter',id);if(DAL.selectedChapterId===id)DAL.selectedChapterId=p.chapters[0]&&p.chapters[0].id;DAL.writerSave(p);DAL.render();},duplicate:function(id){DAL.PASTE.chapter(DAL.SELECT.chapter.copy(id));}};
DAL.PASTE.chapter=function(payload){var p=DAL.currentWriterProject();if(!p||!payload)return;DAL.pushHistory();payload.id=DAL.uid('ch');payload.title=(payload.title||'Chapter')+' Copy';payload.createdAt=Date.now();payload.updatedAt=Date.now();p.chapters.push(payload);p.chapters.forEach(function(c,i){c.order=i;});DAL.selectedChapterId=payload.id;DAL.writerSave(p);DAL.render();};
DAL.CTX.chapter=function(id){var p=DAL.currentWriterProject(),i=(p.chapters||[]).findIndex(function(c){return c.id===id;});return [{heading:'Chapter'},{label:'Move up',action:'move-chapter',data:{cid:id,dir:-1},disabled:i<=0},{label:'Move down',action:'move-chapter',data:{cid:id,dir:1},disabled:i<0||i>=p.chapters.length-1},{divider:true},{label:'Duplicate',action:'edit-duplicate'},{label:'Delete',action:'edit-delete',danger:true}];};
DAL.SELECT.character={label:function(id){var p=DAL.currentWriterProject(),c=p&&(p.characters||[]).find(function(x){return x.id===id;});return c?c.name:'Character';},copy:function(id){var p=DAL.currentWriterProject();return DAL.clone((p.characters||[]).find(function(c){return c.id===id;}));},remove:function(id){var p=DAL.currentWriterProject();DAL.pushHistory();p.characters=p.characters.filter(function(c){return c.id!==id;});DAL.removeProjectReferences(p,'character',id);if(DAL.selectedCharId===id)DAL.selectedCharId=null;DAL.writerSave(p);DAL.render();},duplicate:function(id){DAL.PASTE.character(DAL.SELECT.character.copy(id));}};
DAL.PASTE.character=function(payload){var p=DAL.currentWriterProject();if(!p||!payload)return;DAL.pushHistory();payload.id=DAL.uid('char');payload.name=(payload.name||'Character')+' Copy';payload.createdAt=Date.now();p.characters.push(payload);DAL.selectedCharId=payload.id;DAL.writerSave(p);DAL.render();};
DAL.CTX.character=function(id){return [{heading:'Character'},{label:'Open',action:'select-character',data:{cid:id}},{label:'Duplicate',action:'edit-duplicate'},{divider:true},{label:'Delete',action:'edit-delete',danger:true}];};

DAL.handleWriterAction=function(action,el){
  var p=DAL.currentWriterProject(), i, m, o, d, c;
  if(action==='project-search'){DAL.showProjectSearch();return true;}
  if(action==='project-search-run'){DAL.showProjectSearch((document.getElementById('projectSearchQuery')||{}).value||'');return true;}
  if(action==='project-search-open'){DAL.openProjectSearchResult((DAL._projectSearchResults||[])[parseInt(el.getAttribute('data-search-index'),10)]);return true;}
  if(action==='show-find'){DAL.showFindModal();return true;}
  if(action==='find-run'){DAL.readFindForm();DAL._findPage=0;DAL._findNextSignature=null;DAL.showFindModal();return true;}
  if(action==='find-page-prev'||action==='find-page-next'){DAL.readFindForm();DAL._findPage=(DAL._findPage||0)+(action==='find-page-next'?1:-1);DAL.showFindModal();return true;}
  if(action==='find-next' || action==='find-next-modal'){o=document.getElementById('findQuery')?DAL.readFindForm():DAL.findOptions();var list=DAL.findMatches(p,o);if(!list.length){DAL.toast(DAL.findMessage('noMatchesFound','No matches found'),'info');return true;}var signature=JSON.stringify([p.id,o.query,o.scope,o.scope==='chapter'?DAL.selectedChapterId:null,o.caseSensitive,o.wholeWord]);if(DAL._findNextSignature!==signature){DAL._findNextSignature=signature;DAL._findNext=0;}DAL._findNext=(DAL._findNext||0)%list.length;DAL.openFindMatch(list[DAL._findNext++]);return true;}
  if(action==='find-open'){m=(DAL._findMatches||[])[parseInt(el.getAttribute('data-find-index'),10)];DAL.openFindMatch(m);return true;}
  if(action==='find-replace-one'){o=DAL.readFindForm();m=(DAL._findMatches||[])[parseInt(el.getAttribute('data-find-index'),10)];c=p&&m&&DAL.chapterById(p,m.cid);if(!c||!o.query)return true;if(m.projectId!==p.id||m.query!==o.query||m.caseSensitive!==o.caseSensitive||m.wholeWord!==o.wholeWord){DAL.toast(DAL.findMessage('refreshFindQuery','The search options changed. Run Find again before replacing a result.'),'info');return true;}if(DAL.chapterSearchModel(c).text!==m.text){DAL.toast(DAL.findMessage('staleFindMatch','This match changed. Run Find again to refresh the results.'),'info');DAL.showFindModal();return true;}DAL.pushHistory();var n=DAL.replaceTextNodes(c,o,m.index);if(n){DAL.writerSave(p);DAL.render();}DAL.toast(DAL.findMessage(n?'replacedOneMatch':'staleFindMatch',n?'Replaced one match':'This match changed. Run Find again to refresh the results.'),n?'success':'info');DAL.showFindModal();return true;}
  if(action==='find-replace-all'){o=DAL.readFindForm();if(!p||!o.query)return true;if(!DAL.findMatches(p,o).length){DAL.toast(DAL.findMessage('noMatchesFound','No matches found'),'info');DAL.showFindModal();return true;}var total=0;DAL.pushHistory();(p.chapters||[]).forEach(function(ch){if(o.scope==='manuscript'||ch.id===DAL.selectedChapterId)total+=DAL.replaceTextNodes(ch,o);});if(total){DAL.writerSave(p);DAL.render();}DAL.toast(DAL.findMessage('replacementCount',total+' replacement'+(total===1?'':'s')+' made',{count:total}),total?'success':'info');DAL.showFindModal();return true;}
  if(action==='show-comments'){DAL.showComments();return true;}
  if(action==='new-comment'){DAL.commentEditor(null);return true;}
  if(action==='comment-edit'){d=DAL.writerProject(p);c=d.comments.find(function(x){return x.id===el.getAttribute('data-comment-id');});if(c)DAL.commentEditor(c);return true;}
  if(action==='save-comment'){d=DAL.writerProject(p);var id=DAL._editingComment, body=(document.getElementById('commentBody')||{}).value||'', chapter=(document.getElementById('commentEditChapter')||{}).value||DAL.selectedChapterId, anchor=(document.getElementById('commentAnchor')||{}).value||'',label=(document.getElementById('commentLabel')||{}).value||'';c=id&&d.comments.find(function(x){return x.id===id;});if(c){c.body=body;c.chapterId=chapter;c.anchor=anchor;c.label=label;c.updatedAt=Date.now();}else d.comments.push({id:DAL.uid('comment'),chapterId:chapter,anchor:anchor,label:label,body:body,resolved:false,createdAt:Date.now()});DAL.writerSave(p);DAL.showComments();return true;}
  if(action==='resolve-comment'){d=DAL.writerProject(p);c=d.comments.find(function(x){return x.id===el.getAttribute('data-comment-id');});if(c){c.resolved=!c.resolved;DAL.writerSave(p);DAL.showComments();}return true;}
  if(action==='delete-comment'){d=DAL.writerProject(p);d.comments=d.comments.filter(function(x){return x.id!==el.getAttribute('data-comment-id');});DAL.writerSave(p);DAL.showComments();return true;}
  if(action==='show-sprint'){DAL.showSprint(false);return true;}
  if(action==='start-sprint'){var min=Math.max(1,parseInt((document.getElementById('sprintMinutes')||{}).value,10)||25),target=Math.max(0,parseInt((document.getElementById('sprintTarget')||{}).value,10)||0);DAL.writerState().sprint={projectId:p.id,startedAt:Date.now(),endsAt:Date.now()+min*60000,startWords:DAL.sprintWords(p),target:target};DAL.saveState(true);DAL.showSprint(false);return true;}
  if(action==='stop-sprint'){DAL.stopSprintTimer();DAL.stopSprintWidgetTimer();if(DAL.writerState().sprint)DAL.writerState().sprint=null;DAL.saveState(true);DAL.closeModal();DAL.renderSprintWidget();return true;}
  if(action==='toggle-sprint-widget'){var sw=DAL.sprintWidgetState();sw.visible=!sw.visible;if(sw.visible)sw.collapsed=false;DAL.saveState(true);DAL.renderSprintWidget();DAL.toast(sw.visible?'Sprint timer shown \u2014 drag it anywhere':'Sprint timer hidden');return true;}
  if(action==='collapse-sprint-widget'){var sc=DAL.sprintWidgetState();sc.collapsed=!sc.collapsed;DAL.saveState(true);DAL.renderSprintWidget();return true;}
  if(action==='show-readability'){DAL.showReadability();return true;}
  if(action==='show-beats'){DAL.showBeats();return true;}
  if(action==='apply-beats'){var tmpl=DAL.BEAT_TEMPLATES[el.getAttribute('data-template')],wd=DAL.writerProject(p);if(tmpl){wd.structure={template:el.getAttribute('data-template'),beats:tmpl.map(function(b){return {title:b[0],note:b[1],done:false,chapterId:''};})};DAL.writerSave(p);DAL.showBeats();}return true;}
  if(action==='toggle-beat'){wd=DAL.writerProject(p);i=parseInt(el.getAttribute('data-beat-index'),10);if(wd.structure&&wd.structure.beats[i]){wd.structure.beats[i].done=!wd.structure.beats[i].done;DAL.writerSave(p);}return true;}
  if(action==='attach-beat'){wd=DAL.writerProject(p);i=parseInt(el.getAttribute('data-beat-index'),10);if(wd.structure&&wd.structure.beats[i]){wd.structure.beats[i].chapterId=el.value;DAL.writerSave(p);}return true;}
  if(action==='show-corkboard'){DAL.showCorkboard();return true;}
  if(action==='show-versions'){DAL.showVersions();return true;}
  if(action==='take-snapshot'){var named=(document.getElementById('snapshotName')||{}).value||'';DAL.makeSnapshot(p,named.trim());DAL.toast((DAL.i18n?DAL.i18n.text("ui_Snapshot_saved_7ee9e19","Snapshot saved"):"Snapshot saved"),'success');DAL.showVersions();return true;}
  if(action==='preview-version'){DAL.previewVersion(parseInt(el.getAttribute('data-version-index'),10));return true;}
  if(action==='compare-version'){DAL.compareVersion(parseInt(el.getAttribute('data-version-index'),10));return true;}
  if(action==='restore-version-chapter-confirm'){var vi=parseInt(el.getAttribute('data-version-index'),10),ci=el.getAttribute('data-chapter-id');DAL.modal((DAL.i18n?DAL.i18n.text("ui_Restore_Chapter_d7a36ae","Restore Chapter"):"Restore Chapter"),'<p>This replaces only this chapter with its snapshot copy. The rest of the project stays unchanged. A recovery snapshot of the current project is saved first and remains available in Version History after closing the app.</p>',{footer:'<button class="btn" data-action="compare-version" data-version-index="'+vi+'">Cancel</button><button class="btn danger" data-action="restore-version-chapter-now" data-version-index="'+vi+'" data-chapter-id="'+ci+'">Restore chapter</button>'});return true;}
  if(action==='restore-version-chapter-now'){DAL.restoreVersionChapter(parseInt(el.getAttribute('data-version-index'),10),el.getAttribute('data-chapter-id'));return true;}
  if(action==='confirm-restore-version'){DAL.restoreVersionConfirm(parseInt(el.getAttribute('data-version-index'),10));return true;}
  if(action==='restore-version-now'){i=parseInt(el.getAttribute('data-version-index'),10);var v=p.versions&&p.versions[i];if(v){var restoredSnapshot=DAL.clone(v.data);DAL.restoreWithRecovery(p,function(){DAL.applySnapshot(p,restoredSnapshot);}).then(function(ok){if(ok){DAL.closeModal();DAL.render();DAL.toast((DAL.i18n?DAL.i18n.text("ui_Snapshot_restored_4fb24ea","Snapshot restored"):"Snapshot restored"),'success');}});}return true;}
  if(action==='toggle-typewriter'){DAL.toggleTypewriter();return true;}
  if(action==='move-chapter'){i=(p.chapters||[]).findIndex(function(x){return x.id===el.getAttribute('data-cid');});var to=i+parseInt(el.getAttribute('data-dir'),10);if(i>=0&&to>=0&&to<p.chapters.length){DAL.pushHistory();var item=p.chapters.splice(i,1)[0];p.chapters.splice(to,0,item);p.chapters.forEach(function(x,n){x.order=n;});DAL.writerSave(p);DAL.render();}return true;}
  if(action==='toggle-character-deceased'){c=(p.characters||[]).find(function(x){return x.id===el.getAttribute('data-cid');});if(c){c.deceased=!c.deceased;DAL.writerSave(p);DAL.render();}return true;}
  if(action==='add-custom-field'){c=(p.characters||[]).find(function(x){return x.id===el.getAttribute('data-cid');});if(c){c.customFields=c.customFields||[];c.customFields.push({label:'New field',type:'text',value:''});DAL.writerSave(p);DAL.render();}return true;}
  if(action==='delete-custom-field'||action==='move-custom-field'){c=(p.characters||[]).find(function(x){return x.id===el.getAttribute('data-cid');});i=parseInt(el.getAttribute('data-cf-index'),10);if(c&&c.customFields&&c.customFields[i]){if(action==='delete-custom-field')c.customFields.splice(i,1);else {var next=i+parseInt(el.getAttribute('data-dir'),10);if(next>=0&&next<c.customFields.length){var field=c.customFields.splice(i,1)[0];c.customFields.splice(next,0,field);}}DAL.writerSave(p);DAL.render();}return true;}
  return false;
};
DAL._storyClickBase=DAL.handleStoryClick;
DAL.handleStoryClick=function(action,el,e){if(DAL.handleWriterAction(action,el,e))return;return DAL._storyClickBase(action,el,e);};

/* These fields are deliberately updated on input, matching the rest of the sheet
   and corkboard, while boolean/type controls settle on change. */
document.addEventListener('input',function(e){
  var el=e.target,p=DAL.currentWriterProject(),c;
  if(!p)return;
  if(el.hasAttribute('data-cork-field')){c=DAL.chapterById(p,el.getAttribute('data-cork-id'));if(c){c[el.getAttribute('data-cork-field')]=el.value;c.updatedAt=Date.now();DAL.writerSave(p);}return;}
  if(el.hasAttribute('data-cf-value')&&el.type==='checkbox'){c=(p.characters||[]).find(function(x){return x.id===DAL.selectedCharId;});if(c&&c.customFields){c.customFields[parseInt(el.getAttribute('data-cf-value'),10)].value=el.checked;DAL.writerSave(p);}return;}
  if(el.id==='editorContent') DAL.typewriterScroll(el);
});
document.addEventListener('change',function(e){
  var el=e.target,p=DAL.currentWriterProject(),c;
  if(!p)return;
  if(el.hasAttribute('data-cork-field')){c=DAL.chapterById(p,el.getAttribute('data-cork-id'));if(c){c[el.getAttribute('data-cork-field')]=el.value;c.updatedAt=Date.now();DAL.writerSave(p);if(el.getAttribute('data-cork-field')==='status')DAL.showCorkboard();}return;}
  if(el.hasAttribute('data-cf-type')||el.hasAttribute('data-cf-value')){c=(p.characters||[]).find(function(x){return x.id===DAL.selectedCharId;});if(c&&c.customFields){var n=parseInt(el.getAttribute('data-cf-type')||el.getAttribute('data-cf-value'),10),f=c.customFields[n];if(el.hasAttribute('data-cf-type')){f.type=el.value;if(f.type==='boolean')f.value=false;else if(f.type==='number')f.value=Number(f.value)||0;}else if(el.type==='checkbox')f.value=el.checked;else f.value=el.value;DAL.writerSave(p);if(el.hasAttribute('data-cf-type'))DAL.render();}return;}
  /* A <select data-action> commits on change, never on click, so its handler is
     unreachable without this. Checkboxes are deliberately excluded — they already
     fire through the click dispatcher, and routing both would toggle twice. */
  if(el.tagName === 'SELECT' && el.hasAttribute('data-action')) DAL.handleWriterAction(el.getAttribute('data-action'), el);
});


DAL._afterStoryRenderBase=DAL.afterStoryRender;
DAL.afterStoryRender=function(proj){DAL._afterStoryRenderBase(proj);var ed=document.getElementById('editorContent');if(ed){var tools=DAL.writerState();ed.closest('.editor-area').classList.toggle('typewriter-on',!!tools.typewriter);}};
