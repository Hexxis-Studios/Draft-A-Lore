/* Draft A Lore — views.js
 * Copyright 2026 Daymien Vanhorn — https://github.com/Hexxis-Studios/Draft-A-Lore
 * Free for noncommercial use under PolyForm Noncommercial 1.0.0 + supplemental
 * terms (see LICENSE.md). Credit to the original author must remain visible.
 * Commercial use requires a license — see COMMERCIAL-LICENSE.md.
 */
DAL = DAL || {};

/* Dashboard
   The Dashboard is composed from DAL.DASHBOARD_CARDS: each entry has a body
   renderer here, and the page is assembled in the reader's saved order at their
   saved widths. A body renderer returning an empty string means "nothing worth
   showing" and the card is dropped from the page entirely rather than left as an
   empty box — except while organizing, where every card must stay reachable so
   it can be moved or hidden. */
DAL.dashboardCardBody = {};

DAL.renderDashboard = function(){
  var layout = DAL.dashboardLayout();
  var organizing = DAL.organizeDashboard;

  var html = '<div class="dashboard' + (organizing ? ' organizing' : '') + '">';
  html += DAL.renderDashboardBar(layout, organizing);
  html += '<div class="dash-grid">';

  var visible = layout.order.filter(function(id){ return layout.hidden.indexOf(id) === -1; });
  var rendered = 0;
  visible.forEach(function(id, i){
    var card = DAL.dashboardCard(id);
    var body = DAL.dashboardCardBody[id] ? DAL.dashboardCardBody[id]() : '';
    if(!body && !organizing) return;
    rendered++;
    html += DAL.renderDashboardCard(card, layout.size[id], body, {
      organizing: organizing,
      first: i === 0,
      last: i === visible.length - 1,
      empty: !body
    });
  });
  if(!rendered){
    html += '<div class="dash-cell full"><div class="empty-state" style="padding:32px 16px">' +
      ("<h3>"+DAL.uiLabel("ui_Every_card_is_hidden_ba1a95c","Every card is hidden")+"</h3><p>"+DAL.uiLabel("ui_Turn_on_Organize_Dashboard_to_bring_cards__008f8ea","Turn on Organize Dashboard to bring cards back.")+"</p></div></div>");
  }
  html += '</div>';

  if(organizing) html += DAL.renderHiddenCardTray(layout);
  html += '</div>';
  return html;
};

/* The bar above the grid. Outside organize mode it carries a single button and
   no per-card affordances anywhere on the page. */
DAL.renderDashboardBar = function(layout, organizing){
  var html = '<div class="dash-bar">';
  if(organizing){
    html += '<div class="dash-bar-text">' +
      ("<strong>"+DAL.uiLabel("ui_Organizing_your_dashboard_e43514f","Organizing your dashboard")+"</strong>") +
      ("<span>"+DAL.uiLabel("ui_Move_resize_and_hide_cards_Changes_save_as_fbece94","Move, resize, and hide cards. Changes save as you make them.")+"</span>") +
      '</div>' +
      '<div class="dash-bar-actions">' +
        ("<button class=\"btn sm\" data-action=\"dash-reset\">"+DAL.uiLabel("ui_Reset_to_default_bc5b45a","Reset to default")+"</button>") +
        ("<button class=\"btn sm primary\" data-action=\"dash-organize-off\">"+DAL.uiLabel("ui_Done_11a6767","Done")+"</button>") +
      '</div>';
  } else {
    html += ("<div class=\"dash-bar-text\"><strong>"+DAL.uiLabel("dashboard","Dashboard")+"</strong></div>") +
      '<div class="dash-bar-actions">' +
        '<button class="btn sm" data-action="dash-organize-on">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>' +
          'Organize Dashboard</button>' +
      '</div>';
  }
  html += '</div>';
  return html;
};

DAL.renderDashboardCard = function(card, size, body, opts){
  var cls = 'dash-cell ' + size.w + (size.h === 'tall' ? ' tall' : '');
  var html = '<section class="' + cls + '" data-card="' +DAL.escapeHtml(card.id)+ '" aria-label="' + DAL.escapeHtml(card.label) + '">';
  if(opts.organizing){
    html += DAL.renderCardOrganizeControls(card, size, opts);
  }
  html += '<div class="dash-card-body">';
  html += opts.empty
    ? ("<div class=\"dash-card-placeholder\">"+DAL.uiLabel("ui_Nothing_to_show_here_yet__99a81df","Nothing to show here yet.")+"</div>")
    : body;
  html += '</div></section>';
  return html;
};

/* Buttons are the baseline for reordering: they work with a mouse, a keyboard,
   a screen reader and a thumb, which drag-and-drop alone does not. */
DAL.renderCardOrganizeControls = function(card, size, opts){
  var html = '<header class="dash-card-organize">';
  html += '<span class="dash-card-name">' + DAL.escapeHtml(card.label) + '</span>';
  html += '<div class="dash-card-tools">';
  html += '<button class="dash-tool" data-action="dash-move" data-card="' +DAL.escapeHtml(card.id)+ '" data-dir="-1"' +
    (opts.first ? ' disabled' : '') + ' aria-label="Move ' + DAL.escapeHtml(card.label) + (" up\" title=\""+DAL.uiLabel("ui_Move_up_c66feb5","Move up")+"\">") +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg></button>';
  html += '<button class="dash-tool" data-action="dash-move" data-card="' +DAL.escapeHtml(card.id)+ '" data-dir="1"' +
    (opts.last ? ' disabled' : '') + ' aria-label="Move ' + DAL.escapeHtml(card.label) + (" down\" title=\""+DAL.uiLabel("ui_Move_down_40bb50d","Move down")+"\">") +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg></button>';

  if(!card.alwaysFull){
    html += '<span class="dash-tool-sep"></span>';
    html += '<button class="dash-tool text' + (size.w === 'half' ? ' active' : '') + '" data-action="dash-width" data-card="' +DAL.escapeHtml(card.id)+ '" data-w="half"' +
      ' aria-pressed="' + (size.w === 'half') + ("\" title=\""+DAL.uiLabel("ui_Half_width_9a031c6","Half width")+"\">"+DAL.uiLabel("ui_Half_8082c15","Half")+"</button>");
    html += '<button class="dash-tool text' + (size.w === 'full' ? ' active' : '') + '" data-action="dash-width" data-card="' +DAL.escapeHtml(card.id)+ '" data-w="full"' +
      ' aria-pressed="' + (size.w === 'full') + ("\" title=\""+DAL.uiLabel("ui_Full_width_d34008d","Full width")+"\">"+DAL.uiLabel("ui_Full_008dacb","Full")+"</button>");
  }
  if(card.tall){
    html += '<span class="dash-tool-sep"></span>';
    html += '<button class="dash-tool text' + (size.h === 'tall' ? ' active' : '') + '" data-action="dash-height" data-card="' +DAL.escapeHtml(card.id)+ '"' +
      ' aria-pressed="' + (size.h === 'tall') + ("\" title=\""+DAL.uiLabel("ui_Toggle_taller_card_a0e37df","Toggle taller card")+"\">"+DAL.uiLabel("ui_Tall_0eeb780","Tall")+"</button>");
  }
  html += '<span class="dash-tool-sep"></span>';
  html += '<button class="dash-tool" data-action="dash-hide" data-card="' +DAL.escapeHtml(card.id)+ '" aria-label="Hide ' + DAL.escapeHtml(card.label) + ("\" title=\""+DAL.uiLabel("ui_Hide_this_card_a1119dc","Hide this card")+"\">") +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="2" y1="2" x2="22" y2="22"/></svg></button>';
  html += '</div></header>';
  return html;
};

DAL.renderHiddenCardTray = function(layout){
  var html = '<div class="dash-hidden-tray">';
  html += ("<div class=\"dash-hidden-title\">"+DAL.uiLabel("ui_Hidden_cards_070a2b4","Hidden cards")+"</div>");
  if(!layout.hidden.length){
    html += ("<p class=\"dash-hidden-empty\">"+DAL.uiLabel("ui_No_hidden_cards_Anything_you_hide_lands_he_5c0bd61","No hidden cards. Anything you hide lands here so you can bring it back.")+"</p>");
  } else {
    html += '<div class="dash-hidden-list">';
    // Listed in registry order rather than the order they were hidden, so the
    // tray reads the same every time instead of shuffling as you work.
    DAL.DASHBOARD_CARDS.forEach(function(card){
      if(layout.hidden.indexOf(card.id) === -1) return;
      html += '<button class="dash-hidden-chip" data-action="dash-show" data-card="' +DAL.escapeHtml(card.id)+ '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
        DAL.escapeHtml(card.label) + '</button>';
    });
    html += '</div>';
  }
  html += '</div>';
  return html;
};
DAL.dashboardCardBody.continue = function(){
  var projects = DAL.state.projectOrder.map(function(id){ return DAL.state.projects[id]; }).filter(Boolean);
  if(!projects.length) return '';
  var last = projects.reduce(function(a, b){ return (a.updatedAt||0) > (b.updatedAt||0) ? a : b; });
  var wc = DAL.getProjectWordCount(last);
  return '<div class="dash-continue">' +
    '<div class="dash-continue-info">' +
      '<div class="dash-eyebrow">Continue writing</div>' +
      '<div class="dash-continue-name">' + DAL.escapeHtml(last.name) + '</div>' +
      '<div class="dash-badges">' +
        '<span class="badge accent">' + DAL.escapeHtml(last.type) + '</span>' +
        '<span class="badge">' + DAL.escapeHtml(last.status) + '</span>' +
        '<span class="badge">' + DAL.escapeHtml(DAL.formatWordCount(wc.total)) + '</span>' +
        '<span class="badge">' + DAL.escapeHtml(DAL.formatDate(last.updatedAt)) + '</span>' +
      '</div>' +
    '</div>' +
    '<button class="btn primary" data-action="continue-writing" data-pid="' + DAL.escapeHtml(last.id) + '">'+DAL.uiLabel('continueWriting','Continue Writing')+'</button>' +
  '</div>';
};

DAL.dashboardCardBody.profile = function(){
  var projects = DAL.state.projectOrder.map(function(id){ return DAL.state.projects[id]; }).filter(Boolean);
  var gwc = DAL.getGlobalWordCount();
  var streak = DAL.getWritingStreak();
  var hasProfile = DAL.state.authorName || DAL.state.authorBio || DAL.state.authorAvatar;
  var initials = (DAL.state.authorName||'?').split(' ').map(function(w){ return w[0]; }).join('').substring(0,2).toUpperCase();

  var html = '<div class="dashboard-profile-card">';
  html += '<div class="profile-card-header">';
  html += '<div class="profile-avatar">' + (DAL.state.authorAvatar ? '<img src="' + DAL.state.authorAvatar + '" alt="">' : DAL.escapeHtml(initials)) + '</div>';
  html += '<div style="flex:1;min-width:0">';
  html += DAL.state.authorName
    ? '<div class="profile-name brand-text">' + DAL.escapeHtml(DAL.state.authorName) + '</div>'
    : '<div class="profile-name brand-text muted">Your Author Name</div>';
  if(DAL.state.authorBio){
    html += '<div class="profile-bio">' + DAL.escapeHtml(DAL.state.authorBio) + '</div>';
  } else if(!hasProfile){
    html += '<div class="profile-bio faint">Set up your author profile in Settings to add your name, bio, and photo. This appears on your book covers, title pages, and exports when auto-fill is enabled.</div>';
  } else {
    html += '<div class="profile-bio faint">No bio written yet. Add one in Settings.</div>';
  }
  html += '</div>';
  html += '<button class="btn sm" data-action="nav-settings">Edit Profile</button>';
  html += '</div>';
  if(hasProfile){
    html += '<div class="profile-card-stats">' +
      '<div class="profile-stat"><span class="profile-stat-num">' + projects.length + '</span><span class="profile-stat-label">Projects</span></div>' +
      '<div class="profile-stat"><span class="profile-stat-num">' + DAL.formatNumber(gwc.total) + '</span><span class="profile-stat-label">Words Written</span></div>' +
      '<div class="profile-stat"><span class="profile-stat-num">' + streak + '</span><span class="profile-stat-label">Day' + (streak !== 1 ? 's' : '') + ' Streak</span></div>' +
    '</div>';
  }
  html += '</div>';
  return html;
};

DAL.dashboardCardBody.totals = function(){
  var gwc = DAL.getGlobalWordCount();
  var rows = [
    { label: 'Manuscript', value: gwc.manuscript },
    { label: 'Supplementary', value: gwc.supplementary },
    { label: 'Total', value: gwc.total, strong: true }
  ];
  var html = '<div class="dash-card-head"><h3 class="dash-card-title">Word Count</h3>' +
    DAL.infoIcon('Manuscript words are your chapters and scene text. Supplementary words are character sheets, lore entries and plot notes.') + '</div>';
  html += '<div class="stat-rows">';
  rows.forEach(function(r){
    html += '<div class="stat-row' + (r.strong ? ' strong' : '') + '">' +
      '<span class="stat-row-label">' + r.label + '</span>' +
      '<span class="stat-row-value">' + DAL.formatNumber(r.value) + '</span>' +
    '</div>';
  });
  html += '</div>';

  // A single bar showing the manuscript share reads faster than the two numbers
  // alone when what you want to know is how much of the total is actual prose.
  if(gwc.total > 0){
    var share = Math.round((gwc.manuscript / gwc.total) * 100);
    html += '<div class="split-bar" role="img" aria-label="' + share + ' percent of your words are manuscript prose">' +
      '<span class="split-fill" style="width:' + share + '%"></span>' +
    '</div>';
    html += '<p class="split-note">' + share + '% of your words are manuscript prose.</p>';
  }
  return html;
};

DAL.dashboardCardBody.streak = function(){
  var streak = DAL.getWritingStreak();
  var flame = streak > 0
    ? '<path d="M12 2C10 5 8 7 8 11a4 4 0 0 0 8 0c0-2-1-4-2-5"/><path d="M12 22c4 0 7-2 7-6 0-3-2-5-3-6"/><path d="M5 16c0 4 3 6 7 6"/><path d="M9 11c0 1 .5 2 1.5 2.5"/>'
    : '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h6"/><path d="M9 11h4"/>';
  var html = '<div class="dash-card-head"><h3 class="dash-card-title">Writing Streak</h3></div>';
  html += '<div class="streak-block' + (streak > 0 ? ' lit' : '') + '">' +
    '<svg class="streak-flame" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' + flame + '</svg>' +
    '<div class="streak-text">' +
      '<div class="streak-num">' + streak + '<span class="streak-unit">day' + (streak !== 1 ? 's' : '') + '</span></div>' +
      '<div class="streak-note">' + (streak > 0 ? 'Consecutive days with words written' : 'Write anything today to start a streak') + '</div>' +
    '</div>' +
  '</div>';

  var best = DAL.getLongestStreak();
  if(best > 0){
    var record = streak > 0 && streak >= best;
    html += '<div class="streak-best">' +
      (record ? 'Your best run yet' : 'Best run: ' + best + ' day' + (best === 1 ? '' : 's')) +
    '</div>';
  }
  return html;
};

/* Project goals
   A target word count and optional deadline per project. Finished goals move to
   their own list so the working list stays about what is still ahead. */
DAL.dashboardCardBody.projectGoals = function(){
  var projects = DAL.state.projectOrder.map(function(id){ return DAL.state.projects[id]; }).filter(Boolean);

  var html = '<div class="dash-card-head"><h3 class="dash-card-title">Project Goals</h3>' +
    DAL.infoIcon('Set a target word count for a project, and a deadline if you want one. The pace shown is how many words a day would finish it on time.') +
    '</div>';

  if(!projects.length){
    html += '<p class="pg-empty">Create a project and you can set a target word count for it here.</p>';
    return html;
  }

  var active = [], done = [];
  projects.forEach(function(p){
    var st = DAL.projectGoalStats(p);
    (st.done ? done : active).push({ proj: p, st: st });
  });

  html += '<div class="pg-list">';
  active.forEach(function(row){ html += DAL.renderProjectGoalRow(row.proj, row.st); });
  html += '</div>';

  if(done.length){
    html += '<div class="pg-done-group">' +
      '<div class="pg-group-title">Reached <span class="pg-count">' + done.length + '</span></div>' +
      '<div class="pg-list">';
    done.forEach(function(row){ html += DAL.renderProjectGoalRow(row.proj, row.st); });
    html += '</div></div>';
  }
  return html;
};

DAL.renderProjectGoalRow = function(proj, st){
  function goalText(key,fallback,values){return DAL.escapeHtml(DAL.i18n?DAL.i18n.text(key,fallback,values):fallback);}
  var html = '<div class="pg-row' + (st.done ? ' done' : '') + (st.overdue ? ' overdue' : '') + '">';

  html += '<div class="pg-head">' +
    '<button class="pg-name" data-action="open-project" data-pid="' +DAL.escapeHtml(proj.id)+ '">' + DAL.escapeHtml(proj.name) + '</button>' +
    (st.done ? '<span class="badge success">'+goalText('goalReached','Reached')+'</span>' : '') +
    (st.overdue ? '<span class="badge warning">'+goalText('goalOverdue','Past deadline')+'</span>' : '') +
  '</div>';

  html += '<div class="pg-fields">' +
    '<label class="pg-field"><span class="pg-field-label">'+goalText('goalTargetWords','Target words')+'</span>' +
      '<input type="number" class="pg-input" min="0" step="1000" value="' + (st.target || '') + '" placeholder="0" ' +
        'data-project-goal="target" data-pid="' +DAL.escapeHtml(proj.id)+ '" aria-label="' + goalText('goalTargetLabel','Target word count for '+proj.name,{name:proj.name}) + '">' +
    '</label>' +
    '<label class="pg-field"><span class="pg-field-label">'+goalText('goalDeadline','Deadline')+'</span>' +
      '<input type="date" class="pg-input" value="' + DAL.escapeHtml(st.deadline) + '" ' +
        'data-project-goal="deadline" data-pid="' +DAL.escapeHtml(proj.id)+ '" aria-label="' + goalText('goalDeadlineLabel','Deadline for '+proj.name,{name:proj.name}) + '">' +
    '</label>' +
  '</div>';

  if(!st.set){
    html += '<p class="pg-hint">' + goalText('goalUnset',DAL.formatWordCount(st.words)+' written. Set a target to track progress.',{count:st.words}) + '</p>';
    return html + '</div>';
  }

  html += '<div class="progress-bar"><div class="progress-fill" style="width:' + st.percent + '%"></div></div>';

  var facts = [];
  facts.push('<span class="pg-fact">' + goalText('goalProgress',DAL.formatNumber(st.words)+' of '+DAL.formatWordCount(st.target),{count:st.words,target:st.target}) + '</span>');
  facts.push('<span class="pg-fact"><strong>' + st.percent + '%</strong></span>');
  if(st.done){
    facts.push('<span class="pg-fact">'+goalText('goalCompleted','Target reached')+'</span>');
  } else {
    facts.push('<span class="pg-fact">' + goalText('goalRemaining',DAL.formatNumber(st.remaining)+' to go',{count:st.remaining}) + '</span>');
    if(st.daysLeft !== null){
      if(st.daysLeft >= 1){
        facts.push('<span class="pg-fact">' + goalText('goalDaysLeft',DAL.formatNumber(st.daysLeft)+(st.daysLeft===1?' day left':' days left'),{count:st.daysLeft}) + '</span>');
        facts.push('<span class="pg-fact">' + goalText('goalDailyPace',DAL.formatWordCount(st.perDay)+' a day to finish',{count:st.perDay}) + '</span>');
      } else {
        var overdueDays=Math.abs(st.daysLeft-1);
        facts.push('<span class="pg-fact">' + goalText('goalDeadlinePassed','Deadline passed '+DAL.formatNumber(overdueDays)+(overdueDays===1?' day ago':' days ago'),{count:overdueDays}) + '</span>');
      }
    }
  }
  html += '<div class="pg-facts">' + facts.join('') + '</div>';

  return html + '</div>';
};

/* Word output bar graph
   Hand-built inline SVG. Colour comes from CSS custom properties rather than
   literal hex, so the chart follows the active theme without a redraw, and the
   geometry is plain arithmetic so there is nothing to load. */
/* Two geometries rather than one stretched drawing: an SVG scales uniformly, so
   a wide viewBox squeezed into a phone-width card would shrink its own labels
   into illegibility. The viewport bucket already re-renders when it changes. */
DAL.CHART_SIZES = {
  wide:    { W: 760, H: 240, padL: 52, padR: 12, padT: 12, padB: 30, maxLabels: 12 },
  compact: { W: 420, H: 300, padL: 44, padR: 8,  padT: 14, padB: 34, maxLabels: 7 }
};

DAL.chartSize = function(){
  var bucket = document.documentElement.getAttribute('data-viewport');
  return bucket === 'compact' ? DAL.CHART_SIZES.compact : DAL.CHART_SIZES.wide;
};

/* Rounds a maximum up to a readable axis top: 1, 2 or 5 times a power of ten. */
DAL.niceCeil = function(v){
  if(v <= 0) return 100;
  var mag = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
  var n = v / mag;
  var step = n <= 1 ? 1 : (n <= 2 ? 2 : (n <= 5 ? 5 : 10));
  return step * mag;
};

DAL.dashboardCardBody.wordGraph = function(){
  var data = DAL.wordBuckets(DAL.state.analyticsRange);

  var html = '<div class="dash-card-head"><h3 class="dash-card-title">Word Output</h3>' +
    DAL.infoIcon('Words written in each period, taken from your daily writing history. Days before you started using Draft A Lore show as empty.') +
    '</div>';

  html += '<div class="chart-controls" role="group" aria-label="Chart range">';
  DAL.ANALYTICS_RANGES.forEach(function(r){
    var on = r.id === data.range.id;
    html += '<button class="chart-range' + (on ? ' active' : '') + '" data-action="analytics-range" data-range="' +DAL.escapeHtml(r.id)+ '" aria-pressed="' + on + '">' + r.label + '</button>';
  });
  html += '</div>';

  html += '<div class="chart-summary">' +
    '<div class="chart-stat"><span class="chart-stat-num">' + DAL.formatNumber(data.total) + '</span><span class="chart-stat-label">words in range</span></div>' +
    '<div class="chart-stat"><span class="chart-stat-num">' + DAL.formatNumber(data.average) + '</span><span class="chart-stat-label">per day average</span></div>' +
  '</div>';

  if(data.total === 0){
    html += '<div class="chart-empty">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 20h18"/><rect x="5" y="13" width="3" height="5" rx="1"/><rect x="11" y="9" width="3" height="9" rx="1"/><rect x="17" y="15" width="3" height="3" rx="1"/></svg>' +
      '<p>No words recorded in this range yet. Anything you write from here on shows up the same day.</p>' +
    '</div>';
    return html;
  }

  html += '<div class="chart-readout" data-readout="wordGraph" aria-live="polite">Hover or tap a bar for its exact count.</div>';
  html += DAL.renderWordGraphSvg(data);
  return html;
};

DAL.renderWordGraphSvg = function(data){
  var m = DAL.chartSize();
  var W = m.W, H = m.H;
  var padL = m.padL, padR = m.padR, padT = m.padT, padB = m.padB;
  var plotW = W - padL - padR, plotH = H - padT - padB;
  // Deriving the step first and the top from it keeps every gridline on a round
  // number. Rounding the top first instead produces labels like 1.3k and 3.8k.
  var peak = Math.max.apply(null, data.buckets.map(function(b){ return b.words; }));
  var step = DAL.niceCeil(peak / 4);
  var bands = Math.max(1, Math.ceil(peak / step));
  var top = step * bands;
  var n = data.buckets.length;
  var slot = plotW / n;
  var barW = Math.max(3, Math.min(38, slot * 0.68));
  var unitWord = data.range.unit === 'day' ? 'day' : (data.range.unit === 'week' ? 'week' : 'month');

  var svg = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
    'aria-label="Words written per ' + unitWord + ' over the last ' + data.range.label + ', ' + DAL.formatNumber(data.total) + ' words total">';

  // Horizontal gridlines with value labels, one per step.
  for(var g = 0; g <= bands; g++){
    var val = step * g;
    var y = padT + plotH - (plotH * (g / bands));
    svg += '<line class="chart-grid" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '"/>';
    svg += '<text class="chart-axis-label" x="' + (padL - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + DAL.compactNumber(val) + '</text>';
  }
  // The baseline is drawn last of the axis furniture so it sits above the grid.
  svg += '<line class="chart-baseline" x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + (W - padR) + '" y2="' + (padT + plotH) + '"/>';

  data.buckets.forEach(function(b, i){
    var x = padL + slot * i + (slot - barW) / 2;
    var h = top > 0 ? (b.words / top) * plotH : 0;
    // Bars with a real value keep a sliver of height so a small day is still
    // visible rather than collapsing into the baseline.
    if(b.words > 0) h = Math.max(2, h);
    var y = padT + plotH - h;
    var label = b.full + ': ' + DAL.formatWordCount(b.words);

    svg += '<g class="chart-bar-group" data-bar="' + i + '" data-label="' + DAL.escapeHtml(label) + '" tabindex="0" role="listitem" aria-label="' + DAL.escapeHtml(label) + '">';
    // A full-height transparent target makes short bars just as easy to hit.
    svg += '<rect class="chart-hit" x="' + (padL + slot * i).toFixed(1) + '" y="' + padT + '" width="' + slot.toFixed(1) + '" height="' + plotH + '"/>';
    svg += '<title>' + DAL.escapeHtml(label) + '</title>';
    if(b.words > 0){
      svg += '<rect class="chart-bar" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + Math.min(3, barW / 3).toFixed(1) + '"/>';
    }
    // Value labels are printed only when there is room for them; past about a
    // dozen bars they overlap into noise, and the readout covers the rest.
    if(n <= m.maxLabels && b.words > 0){
      svg += '<text class="chart-value" x="' + (x + barW / 2).toFixed(1) + '" y="' + Math.max(padT + 9, y - 5).toFixed(1) + '" text-anchor="middle">' + DAL.compactNumber(b.words) + '</text>';
    }
    if(b.axis){
      svg += '<text class="chart-axis-label" x="' + (x + barW / 2).toFixed(1) + '" y="' + (padT + plotH + 18) + '" text-anchor="middle">' + DAL.escapeHtml(b.axis) + '</text>';
    }
    svg += '</g>';
  });

  svg += '</svg>';
  return svg;
};

/* Axis and value labels need to stay short, so thousands collapse to 1.2k. */
DAL.compactNumber = function(v){
  v = Math.round(v);
  if(v >= 10000) return Math.round(v / 1000) + 'k';
  if(v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
};
DAL.HEATMAP_WEEKS = 12;

DAL.dashboardCardBody.heatmap = function(){
  var weekStart = DAL.goalPeriodStart('weekly');
  var first = new Date(weekStart); first.setDate(first.getDate() - (DAL.HEATMAP_WEEKS - 1) * 7);
  var today = new Date(); today.setHours(0,0,0,0);

  var weeks = [], peak = 0, activeDays = 0, total = 0;
  for(var w = 0; w < DAL.HEATMAP_WEEKS; w++){
    var days = [];
    for(var d = 0; d < 7; d++){
      var date = new Date(first);
      date.setDate(date.getDate() + w * 7 + d);
      var future = date > today;
      var words = future ? 0 : DAL.dayWords(DAL.dateKey(date)).total;
      if(words > peak) peak = words;
      if(words > 0){ activeDays++; total += words; }
      days.push({ date: date, words: words, future: future });
    }
    weeks.push(days);
  }

  var html = '<div class="dash-card-head"><h3 class="dash-card-title">Writing Activity</h3>' +
    DAL.infoIcon('One square per day over the last 12 weeks. Darker squares are days you wrote more.') +
    '</div>';

  html += '<div class="chart-summary">' +
    '<div class="chart-stat"><span class="chart-stat-num">' + activeDays + '</span><span class="chart-stat-label">day' + (activeDays === 1 ? '' : 's') + ' written in</span></div>' +
    '<div class="chart-stat"><span class="chart-stat-num">' + DAL.formatNumber(peak) + '</span><span class="chart-stat-label">best day</span></div>' +
  '</div>';

  if(total === 0){
    html += '<div class="chart-empty">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/><path d="M8 2v4M16 2v4"/></svg>' +
      '<p>Nothing to map yet. Each day you write fills in a square here.</p>' +
    '</div>';
    return html;
  }

  html += '<div class="chart-readout" data-readout="heatmap" aria-live="polite">Hover or tap a square for that day.</div>';
  html += DAL.renderHeatmapSvg(weeks, peak);
  html += DAL.renderHeatmapLegend();
  return html;
};

/* Five steps rather than a continuous ramp: distinguishable at a glance, and
   the lightest step still reads as "wrote something" against an empty day. */
DAL.heatLevel = function(words, peak){
  if(words <= 0) return 0;
  if(peak <= 0) return 1;
  var r = words / peak;
  if(r <= 0.25) return 1;
  if(r <= 0.5) return 2;
  if(r <= 0.75) return 3;
  return 4;
};

DAL.renderHeatmapSvg = function(weeks, peak){
  // Geometry is sized so the SVG renders close to 1:1 at its capped width; a
  // smaller viewBox would scale the label text up with it.
  var cell = 26, gap = 6, labelW = 40, monthH = 26;
  var W = labelW + weeks.length * (cell + gap);
  var H = monthH + 7 * (cell + gap);
  var dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  var svg = '<svg class="heatmap-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
    'aria-label="Daily writing activity for the last ' + weeks.length + ' weeks">';

  // Month markers sit above the first column that begins a new month.
  var lastMonth = -1;
  weeks.forEach(function(days, w){
    var m = days[0].date.getMonth();
    if(m !== lastMonth){
      lastMonth = m;
      svg += '<text class="chart-axis-label" x="' + (labelW + w * (cell + gap)) + '" y="' + (monthH - 9) + '">' + DAL.MONTHS_SHORT[m] + '</text>';
    }
  });

  // Only alternate weekday labels are printed; all seven at this cell size
  // would collide.
  [0, 2, 4, 6].forEach(function(d){
    svg += '<text class="chart-axis-label" x="' + (labelW - 9) + '" y="' + (monthH + d * (cell + gap) + cell / 2 + 4) + '" text-anchor="end">' + dayNames[d][0] + '</text>';
  });

  weeks.forEach(function(days, w){
    days.forEach(function(day, d){
      if(day.future) return;
      var lvl = DAL.heatLevel(day.words, peak);
      var label = DAL.longDate(day.date) + ': ' + DAL.formatWordCount(day.words);
      svg += '<g class="heat-group" data-label="' + DAL.escapeHtml(label) + '" tabindex="0" role="listitem" aria-label="' + DAL.escapeHtml(label) + '">' +
        '<title>' + DAL.escapeHtml(label) + '</title>' +
        '<rect class="heat-cell heat-' + lvl + '" x="' + (labelW + w * (cell + gap)) + '" y="' + (monthH + d * (cell + gap)) + '" width="' + cell + '" height="' + cell + '" rx="5"/>' +
      '</g>';
    });
  });

  svg += '</svg>';
  return svg;
};

DAL.renderHeatmapLegend = function(){
  var html = ("<div class=\"heat-legend\"><span class=\"heat-legend-label\">"+DAL.uiLabel("ui_Less_ae5239e","Less")+"</span>");
  for(var i = 0; i <= 4; i++){
    html += '<span class="heat-swatch heat-' + i + '" aria-hidden="true"></span>';
  }
  html += ("<span class=\"heat-legend-label\">"+DAL.uiLabel("ui_More_d47d7cb","More")+"</span></div>");
  return html;
};

/* Goal progress. Each row counts only the words written inside its own calendar
   period, so a goal empties again when that period rolls over. */
DAL.dashboardCardBody.goals = function(){
  var goals = [
    { label: 'Daily',   period: 'daily',   target: DAL.state.goalDaily,   key: 'goalDaily' },
    { label: 'Weekly',  period: 'weekly',  target: DAL.state.goalWeekly,  key: 'goalWeekly' },
    { label: 'Monthly', period: 'monthly', target: DAL.state.goalMonthly, key: 'goalMonthly' },
    { label: '6-Month', period: 'half',    target: DAL.state.goal6Month,  key: 'goal6Month' },
    { label: 'Yearly',  period: 'yearly',  target: DAL.state.goalYearly,  key: 'goalYearly' }
  ];
  var html = '<div class="dash-card-head"><h3 class="dash-card-title">Writing Goals</h3>' +
    DAL.infoIcon('Each goal counts the words you write inside that period only, and starts again when the period does.') +
    '</div>';
  html += '<div class="goal-list">';
  goals.forEach(function(g){
    var val = DAL.goalProgress(g.period).total;
    var target = g.target > 0 ? g.target : 0;
    var pct = target > 0 ? Math.min(100, Math.round((val / target) * 100)) : 0;
    var met = target > 0 && val >= target;
    html += '<div class="goal-row' + (met ? ' met' : '') + '">' +
      '<div class="goal-row-head">' +
        '<span class="goal-label">' + g.label +
          '<span class="goal-period">' + DAL.escapeHtml(DAL.goalPeriodLabel(g.period)) + '</span>' +
        '</span>' +
        '<span class="goal-numbers">' +
          '<span class="goal-current">' + DAL.formatNumber(val) + '</span>' +
          '<span class="goal-sep">/</span>' +
          '<input type="number" class="goal-target" min="0" step="100" value="' + g.target + '" data-goal="' + g.key + '" aria-label="' + g.label + ' word goal">' +
          '<span class="goal-pct">' + (met ? 'Met' : pct + '%') + '</span>' +
        '</span>' +
      '</div>' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
    '</div>';
  });
  html += '</div>';
  return html;
};
DAL.renderProjects = function(){
  function text(key,fallback,values){return DAL.escapeHtml(DAL.i18n?DAL.i18n.text(key,fallback,values):fallback);}
  var projects = DAL.state.projectOrder.map(function(id){ return DAL.state.projects[id]; }).filter(Boolean);
  if(projects.length === 0){
    return '<div class="empty-state">'+
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'+
      '<h3>'+text('noProjects','No Projects Yet')+'</h3><p>'+text('firstProjectHelp','Create your first project to start writing.')+'</p>'+
      '<button class="btn primary" data-action="new-project">'+text('createFirstProject','Create Your First Project')+'</button>'+
      '<div style="margin-top:8px"><button class="btn sm" data-action="import-project">'+text('importProject','Import Project')+'</button></div>'+
    '</div>';
  }

  var html = '<div class="section-header"><div class="section-title">'+text('projects','Projects')+'</div>'+
    '<div style="display:flex;gap:8px">'+
      '<button class="btn sm" data-action="import-project">'+text('importProject','Import Project')+'</button>'+
      '<button class="btn primary" data-action="new-project">'+text('newProject','New Project')+'</button>'+
    '</div></div>';
  html += '<div class="card-grid">';
  projects.forEach(function(p){
    var wc = DAL.getProjectWordCount(p);
    var pid=DAL.escapeHtml(p.id),name=DAL.escapeHtml(p.name);
    var typeLabel = p.type === 'novel' ? text('typeNovel','Novel') : (p.type === 'rpg' ? text('typeRpg','RPG Adventure') : text('typeDual','Dual'));
    html += '<div class="card hoverable" style="cursor:pointer" data-action="open-project" data-pid="'+pid+'">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'+
        '<button type="button" class="project-open" data-action="open-project" data-pid="'+pid+'" aria-label="'+text('openProjectNamed','Open '+p.name,{name:p.name})+'">'+name+'</button>'+
        '<div style="display:flex;gap:4px">'+
          '<button class="btn icon sm" data-action="project-settings" data-pid="'+pid+'" aria-label="'+text('projectSettingsNamed','Settings for '+p.name,{name:p.name})+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm" aria-hidden="true"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg></button>'+
        '</div>'+
      '</div>'+
      '<div style="display:flex;gap:4px;margin-bottom:8px">'+
        '<span class="badge accent">'+typeLabel+'</span>'+
        '<span class="badge">'+text('status_'+p.status,p.status)+'</span>'+
      '</div>'+
      '<div style="font-size:var(--ts-xs);color:var(--c-text-muted)">'+(p.type==='rpg'?text('words',DAL.formatNumber(wc.manuscript)+' '+(wc.manuscript===1?'word':'words'),{count:wc.manuscript}):text('manuscriptWords',DAL.formatNumber(wc.manuscript)+' manuscript '+(wc.manuscript===1?'word':'words'),{count:wc.manuscript}))+'</div>'+
      '<div style="font-size:var(--ts-xs);color:var(--c-text-faint);margin-top:4px">'+text('editedAt','Edited '+DAL.formatDate(p.updatedAt),{date:DAL.formatDate(p.updatedAt)})+'</div>'+
      '<div style="display:flex;gap:4px;margin-top:8px">'+
        '<button class="btn sm" data-action="export-project" data-pid="'+pid+'" aria-label="'+text('exportProjectNamed','Export '+p.name,{name:p.name})+'">'+text('exportProject','Export project')+'</button>'+
        '<button class="btn sm danger" data-action="delete-project" data-pid="'+pid+'" aria-label="'+text('deleteProjectNamed','Delete '+p.name,{name:p.name})+'">'+text('delete','Delete')+'</button>'+
      '</div>'+
    '</div>';
  });
  html += '</div>';
  return html;
};

DAL.showSaveAsModal = function(){
  function text(key,fallback,values){return DAL.escapeHtml(DAL.i18n?DAL.i18n.text(key,fallback,values):fallback);}
  if(!DAL.currentProjectId) return;
  var p = DAL.state.projects[DAL.currentProjectId];
  if(!p) return;
  DAL._saveAsRetryId=null;
  // Suggest "Name - copy-1", bumping the number if that name is already taken.
  var base = p.name.replace(/ - copy-\d+$/, '');
  var n = 1;
  var taken = DAL.state.projectOrder.map(function(id){ return DAL.state.projects[id] && DAL.state.projects[id].name; });
  var suggested = base + ' - copy-' + n;
  while(taken.indexOf(suggested) !== -1){ n++; suggested = base + ' - copy-' + n; }
  var html = '<p style="font-size:var(--ts-xs);color:var(--c-text-faint);margin-bottom:10px">'+text('saveAsHelp','Creates a new, independent copy of "'+p.name+'" so you can branch off without touching the original.',{name:p.name})+'</p>'+
    '<div class="form-group"><label class="form-label" for="saNewName">'+text('newProjectName','New Project Name')+'</label><input class="form-input" id="saNewName" value="'+DAL.escapeHtml(suggested)+'"></div>';
  DAL.modal(DAL.i18n?DAL.i18n.text('saveAs','Save As'):'Save As', html, { initialFocus:'#saNewName', footer: '<div data-project-save-status role="status" aria-atomic="true"></div><button class="btn" data-action="close-modal">'+text('cancel','Cancel')+'</button><button class="btn primary" data-action="save-as-confirm">'+text('saveAs','Save As')+'</button>' });
};

DAL.GENRES = ['Fantasy','Science Fiction','Romance','Mystery','Thriller','Horror','Historical','Adventure','Literary Fiction','Young Adult','Children’s','Poetry','Memoir','Biography','Nonfiction','Dungeons & Dragons','Tabletop RPG','Interactive Fiction'];
DAL.genreChoices = function(selected, prefix){
  selected=selected||[];
  function text(key,fallback){return DAL.escapeHtml(DAL.i18n?DAL.i18n.text(key,fallback):fallback);}
  return '<fieldset class="form-group genre-choices"><legend class="form-label">'+text('genres','Genres')+' <span class="u-hint">'+text('genreLimit','choose up to 5')+'</span></legend>'+DAL.GENRES.map(function(genre,index){return '<label class="genre-choice"><input type="checkbox" data-genre-choice="'+prefix+'" value="'+DAL.escapeHtml(genre)+'"'+(selected.indexOf(genre)>=0?' checked':'')+'> '+text('genre_'+index,genre)+'</label>';}).join('')+'</fieldset>';
};
DAL.readGenreChoices = function(prefix){return Array.from(document.querySelectorAll('[data-genre-choice="'+prefix+'"]:checked')).map(function(input){return input.value;}).slice(0,5);};

DAL.showNewProjectModal = function(){
  function text(key,fallback){return DAL.escapeHtml(DAL.i18n?DAL.i18n.text(key,fallback):fallback);}
  if(!DAL._newProjectDraftId||DAL.state.projects[DAL._newProjectDraftId])DAL._newProjectDraftId=DAL.uid('proj');
  var html = '<div class="form-group"><label class="form-label" for="npName">'+text('projectName','Project Name')+'</label><input class="form-input" id="npName" placeholder="'+text('projectNamePlaceholder','My Great Novel')+'"></div>'+
    '<div class="form-group"><label class="form-label" for="npType">'+text('projectType','Project Type')+'</label><select class="form-select" id="npType">'+
      '<option value="novel">'+text('typeStandardNovel','Standard Novel')+'</option>'+
      '<option value="rpg">'+text('typeRpg','RPG Adventure')+'</option>'+
      '<option value="dual">'+text('typeDualDetail','Dual (Novel + RPG)')+'</option>'+
    '</select></div>'+DAL.genreChoices([], 'np')+'<div class="form-group"><label class="form-label" for="npLanguage">'+text('writingLanguage','Writing language')+("</label><input class=\"form-input\" id=\"npLanguage\" value=\"en\" placeholder=\""+DAL.uiLabel("ui_en_en_US_fr_es__17bb244","en, en-US, fr, es…")+"\" aria-describedby=\"npLanguageHelp\"><div class=\"u-hint\" id=\"npLanguageHelp\">")+text('writingLanguageHelp','Used by your browser’s built-in spellchecker.')+'</div><div id="npError" role="alert"></div></div>'+
    '<div class="form-group"><label class="form-label">'+text('folderConnection','Folder Connection')+'</label>'+
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+
      '<button class="btn sm" data-action="link-folder-new">'+text('linkToFolder','Link to folder')+'</button>'+
      '<span style="font-size:var(--ts-xs);color:var(--c-text-faint)" id="npFolderName" role="status">'+text('noFolderLinked','No folder linked')+'</span>'+
    '</div></div>';
  DAL.modal(DAL.i18n?DAL.i18n.text('createNewProject','Create New Project'):'Create New Project', html, { initialFocus:'#npName', footer: '<div data-project-save-status role="status" aria-atomic="true"></div><button class="btn" data-action="close-modal">'+text('cancel','Cancel')+'</button><button class="btn primary" data-action="create-project">'+text('createProject','Create Project')+'</button>' });
};

DAL.showProjectSettingsModal = function(pid){
  function text(key,fallback){return DAL.escapeHtml(DAL.i18n?DAL.i18n.text(key,fallback):fallback);}
  var p = DAL.state.projects[pid];
  if(!p) return;
  var html = '<div class="form-group"><label class="form-label" for="psName">'+text('projectName','Project Name')+'</label><input class="form-input" id="psName" value="'+DAL.escapeHtml(p.name)+'"></div>'+
    '<div class="form-group"><label class="form-label" for="psStatus">'+text('projectStatus','Status')+'</label><select class="form-select" id="psStatus">'+
      ['development','drafting','proofreading','completed','published'].map(function(s){ return '<option value="'+s+'"'+(p.status===s?' selected':'')+'>'+text('statusOption_'+s,s.charAt(0).toUpperCase()+s.slice(1))+'</option>'; }).join('')+
    '</select></div>'+DAL.genreChoices(p.genres||[], 'ps')+'<div class="form-group"><label class="form-label" for="psLanguage">'+text('writingLanguage','Writing language')+'</label><input class="form-input" id="psLanguage" value="'+DAL.escapeHtml(p.language||'en')+("\" placeholder=\""+DAL.uiLabel("ui_en_en_US_fr_es__17bb244","en, en-US, fr, es…")+"\" aria-describedby=\"psLanguageHelp\"><div class=\"u-hint\" id=\"psLanguageHelp\">")+text('writingLanguageHelp','Used by your browser’s built-in spellchecker.')+'</div><div id="psError" role="alert"></div></div>'+
    '<div class="form-group"><label class="form-label">'+text('folderConnection','Folder Connection')+'</label>'+
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+
      '<button class="btn sm" data-action="link-folder" data-pid="'+DAL.escapeHtml(pid)+'">'+text('linkFolder','Link Folder')+'</button>'+
      '<button class="btn sm" data-action="save-project-bundle" data-pid="'+DAL.escapeHtml(pid)+'">'+text('saveBundle','Export project ZIP')+'</button>'+
      '<span style="font-size:var(--ts-xs);color:var(--c-text-faint)" role="status">'+(p.linkedFolderName?DAL.escapeHtml(p.linkedFolderName):text('notLinked','Not linked'))+'</span>'+
    '</div></div>'+
    '<div class="form-group"><label class="form-label">'+text('cover','Cover')+'</label>'+
    '<div style="display:flex;gap:8px;align-items:center">'+
      '<input type="text" class="form-input" id="psCoverTitle" value="'+DAL.escapeHtml(p.cover.title||'')+'" placeholder="'+text('coverTitle','Cover title')+'" aria-label="'+text('coverTitle','Cover title')+'" style="flex:1">'+
    '</div>'+
    '<div class="project-cover-fields">'+
      '<label class="u-grow-label"><span class="form-label">'+text('subtitle','Subtitle')+'</span><input type="text" class="form-input" id="psCoverSubtitle" value="'+DAL.escapeHtml(p.cover.subtitle||'')+'" placeholder="'+text('subtitle','Subtitle')+'"></label>'+
      '<label class="u-grow-label"><span class="form-label">'+text('author','Author')+'</span><input type="text" class="form-input" id="psCoverAuthor" value="'+DAL.escapeHtml(p.cover.author||'')+'" placeholder="'+text('author','Author')+'"></label>'+
    '</div></div>';
  DAL.modal(DAL.i18n?DAL.i18n.text('projectSettings','Project Settings'):'Project Settings', html, { initialFocus:'#psName', footer: '<div data-project-save-status role="status" aria-atomic="true"></div><button class="btn" data-action="close-modal">'+text('cancel','Cancel')+'</button><button class="btn primary" data-action="save-project-settings" data-pid="'+DAL.escapeHtml(pid)+'">'+text('save','Save')+'</button>' });
};

DAL.readProjectLanguage = function(prefix){
  var input=document.getElementById(prefix+'Language'),error=document.getElementById(prefix+'Error');
  var value=input.value.trim()||'en';
  try{
    value=Intl.getCanonicalLocales(value)[0];
    input.removeAttribute('aria-invalid');if(error)error.textContent='';return value;
  }catch(invalid){
    input.setAttribute('aria-invalid','true');
    if(error)error.textContent=DAL.i18n?DAL.i18n.text('writingLanguageInvalid','Enter one language code, such as en, en-US, fr or es.'):'Enter one language code, such as en, en-US, fr or es.';
    input.focus();return null;
  }
};
DAL.persistProjectDialog = async function(button,message,afterSave){
  DAL._projectDialogSaving=true;
  var modal=document.getElementById('modalBackdrop');
  var status=modal&&modal.querySelector('[data-project-save-status]');
  if(status)status.textContent=DAL.i18n?DAL.i18n.text('savingOnDevice','Saving on this device…'):'Saving on this device…';
  button.disabled=true;button.setAttribute('aria-busy','true');
  var saved=false;
  try{saved=!!(await DAL.saveState(true));}catch(error){saved=false;}
  finally{DAL._projectDialogSaving=false;button.disabled=false;button.removeAttribute('aria-busy');}
  if(saved){
    if(document.getElementById('modalBackdrop')===modal){DAL.closeModal();afterSave();}
    DAL.toast(message,'success');
  }else{
    var warning=DAL.i18n?DAL.i18n.text('projectSaveFailed','Changes are only in this session. Saving failed; retry or download a backup before closing the app.'):'Changes are only in this session. Saving failed; retry or download a backup before closing the app.';
    if(status)status.textContent=warning;
    DAL.toast(warning,'warning');
  }
  return saved;
};

DAL.showDeleteConfirm = function(pid, step){
  function text(key,fallback,values){return DAL.escapeHtml(DAL.i18n?DAL.i18n.text(key,fallback,values):fallback);}
  var p = DAL.state.projects[pid];
  if(!p) return;
  if(step === 1){
    DAL.modal(DAL.i18n?DAL.i18n.text('deleteProject','Delete Project'):'Delete Project', '<p>'+text('deleteProjectWarning','Are you sure you want to delete "'+p.name+'"? This cannot be undone.',{name:p.name})+'</p><p style="margin-top:8px;color:var(--c-danger);font-weight:600">'+text('deleteProjectConfirmHelp','Click Delete again to confirm.')+'</p>', { footer: '<button class="btn" data-action="close-modal">'+text('cancel','Cancel')+'</button><button class="btn danger" data-action="delete-project-confirm" data-pid="'+DAL.escapeHtml(pid)+'">'+text('delete','Delete')+'</button>' });
  }
};

DAL.recoveryKeys = function(){
  var keys=[];
  try{ for(var i=0;i<localStorage.length;i++){var key=localStorage.key(i);if(key&&key.indexOf('draftALoreRecovery-')===0)keys.push(key);} }catch(e){}
  return keys.sort().reverse();
};
DAL.restoreWorkspaceSafely=async function(data){
  if(DAL._workspaceRestoreBusy)throw new Error('A workspace restore is already in progress.');
  if(DAL._folderRestoreBusy)throw new Error('Wait for the current folder operation to finish before restoring the workspace.');
  DAL._workspaceRestoreBusy=true;
  var previous=DAL.state,handles=DAL.folderHandles,suppressed=DAL._suppressFolderSync,staged,applied='',installed=false,initialized=false;DAL._suppressFolderSync=true;
  function contentSignature(workspace){
    return JSON.stringify(workspace);
  }
  try{
    if(DAL.currentTool==='manuscript'&&DAL.saveChapterContent)DAL.saveChapterContent();
    staged=DAL.normalizeWorkspace(DAL.clone(data),true);
    for(var projectId of staged.projectOrder){
      var project=staged.projects[projectId];
      if(DAL.validateFolderAssets)await DAL.validateFolderAssets(project);
    }
    if(DAL.state!==previous)throw new Error('The workspace changed while checking the backup. Nothing was replaced.');
    if(await DAL.saveState(true)!==true)throw new Error('The current workspace could not be saved. Export it before restoring.');
    var backup=JSON.stringify(previous),key='draftALore-recovery-'+Date.now();
    while(localStorage.getItem(key)!=null)key='draftALore-recovery-'+(Number(key.split('-').pop())+1);
    localStorage.setItem(key,backup);if(localStorage.getItem(key)!==backup)throw new Error('The recovery copy could not be verified. Nothing was replaced.');
    if(DAL.state!==previous||JSON.stringify(previous)!==backup)throw new Error('The workspace changed during recovery preparation. Nothing was replaced.');
    if(DAL.cancelWorldAnalysis)DAL.cancelWorldAnalysis();
    DAL.state=staged;DAL.folderHandles={};installed=true;DAL.finishStateLoad();initialized=true;applied=contentSignature(staged);
    if(await DAL.saveState(true)!==true)throw new Error('The restored workspace could not be saved.');
    DAL._pendingRestore=null;DAL.closeModal();DAL.navigate('dashboard');DAL.toast((DAL.i18n?DAL.i18n.text("ui_Workspace_restored_The_previous_workspace__a7aaf97","Workspace restored. The previous workspace remains in Storage & Recovery. Reconnect folders deliberately."):"Workspace restored. The previous workspace remains in Storage & Recovery. Reconnect folders deliberately."),'success');return true;
  }catch(error){
    if(installed&&DAL.state===staged&&(!initialized||contentSignature(staged)===applied)){
      DAL.state=previous;DAL.folderHandles=handles;
      try{DAL.finishStateLoad();if(await DAL.saveState(true)!==true)throw new Error('Persistence failed');}
      catch(rollbackError){throw new Error('Restore failed. The previous workspace is back in memory but could not be saved; export it before closing. A recovery copy remains in Storage & Recovery.');}
    }
    else if(installed&&DAL.state===staged)throw new Error('Restore saving failed. Newer edits remain in memory; export them before closing. The previous workspace is in Storage & Recovery.');
    throw error;
  }finally{DAL._suppressFolderSync=suppressed;DAL._workspaceRestoreBusy=false;}
};

DAL.importIllustrations=async function(project,files,kind,target){
  function text(key,fallback,values){return DAL.i18n?DAL.i18n.text(key,fallback,values):fallback;}
  if(DAL._illustrationImportBusy){DAL.toast(text('imageUploadBusy','Wait for the current image upload to finish.'),'info');return false;}
  DAL._illustrationImportBusy=true;
  var workspace=DAL.state,staged=[],total=0;
  function available(){
    if(DAL.state!==workspace||!project||workspace.projects[project.id]!==project||DAL.currentProjectId!==project.id||DAL._workspaceRestoreBusy||DAL._folderRestoreBusy)return false;
    if(kind==='library')return true;
    if(kind==='chapter')return project.chapters.indexOf(target)>=0;
    var adventure=project.adventure;
    return !!(adventure&&target&&(kind==='item'?adventure.items:kind==='scene'?adventure.nodes:[]).indexOf(target)>=0);
  }
  try{
    if(!available())throw new Error('The image destination is no longer open. Nothing was added.');
    files=Array.from(files||[]);
    if(!files.length||files.length>100||files.reduce(function(sum,file){return sum+(Number(file.size)||0);},0)>32*1024*1024)throw new Error('Choose up to 100 images totalling no more than 32 MB per upload.');
    if(kind==='chapter'&&(target.images||[]).length+files.length>2)throw new Error('Max 2 images per chapter');
    for(var file of files){
      if(!available())throw new Error('The image destination changed. Nothing was added.');
      var name=String(file.name||'Illustration').replace(/\.[^.]+$/,'').slice(0,200);
      var dataUrl=await new Promise(function(resolve,reject){DAL.compressImage(file,kind==='library'?1800:kind==='chapter'?1000:kind==='item'?400:800,0.88,function(result,error){if(error||!result)reject(error||new Error('The image could not be prepared.'));else resolve(result);});});
      total+=dataUrl.length;if(total>32*1024*1024)throw new Error('The prepared images exceed the 32 MB upload limit. Upload fewer images at a time.');
      staged.push({id:DAL.uid('img'),name:name,dataUrl:dataUrl});
    }
    if(!available())throw new Error('The image destination changed. Nothing was added.');
    if(kind==='chapter'&&(target.images||[]).length+staged.length>2)throw new Error('Max 2 images per chapter');
    if(DAL.pushHistory)DAL.pushHistory();
    if(kind==='item')target.imageDataUrl=staged[0].dataUrl;
    else{
      var destination=kind==='library'?project:target;destination.images=destination.images||[];
      if(kind==='library')staged.forEach(function(image){image.category='other';image.usedIn=[];image.bookPage=0;image.pageFit='contain';});
      Array.prototype.push.apply(destination.images,staged);
    }
    var saved=false;try{saved=await DAL.saveState(true)===true;}catch(error){}
    if(DAL.state===workspace&&DAL.currentProjectId===project.id&&workspace.projects[project.id]===project)DAL.render();
    DAL.toast(saved?text('imagesAdded','Images added.'):text('imagesAddedMemory','Images added in memory only. Save or export a backup before closing.'),saved?'success':'warning');return true;
  }catch(error){DAL.toast(text('imagesNotAddedReason','Images were not added: '+error.message,{reason:error.message}),'error');return false;}
  finally{DAL._illustrationImportBusy=false;}
};

DAL.setIllustrationProperty=function(project,index,field,value){
  var image=project&&project.images&&project.images[index];
  if(!image||DAL.state.projects[project.id]!==project||DAL.currentProjectId!==project.id)return false;
  if(field==='bookPage'){
    value=String(value).trim()===''?0:Number(value);
    if(!Number.isSafeInteger(value)||value<0){DAL.toast('Book page must be a whole number of zero or greater.','warning');return false;}
  }else if(field==='category'){if(['cover','chapter-art','character','item-icon','scene','other'].indexOf(value)<0)return false;}
  else if(field==='pageFit'){if(value!=='contain'&&value!=='cover')return false;}
  else if(field==='name')value=String(value).slice(0,200);
  else return false;
  if(image[field]===value)return false;
  if(field!=='name'||!DAL._illustrationNameEdit||DAL._illustrationNameEdit.project!==project||DAL._illustrationNameEdit.image!==image){DAL.pushHistory();}
  if(field==='name')DAL._illustrationNameEdit={project:project,image:image};else DAL._illustrationNameEdit=null;
  if(field==='bookPage'&&value){project.images.forEach(function(other){if(other!==image&&Number(other.bookPage)===value)other.bookPage=0;});}
  image[field]=value;
  if(field==='bookPage'&&value===1){image.category='cover';image.pageFit='cover';}
  project.updatedAt=Date.now();DAL.saveState();return true;
};

DAL.continueWriting=function(projectId){
  var project=DAL.state.projects[projectId];if(!project)return false;
  if(DAL.currentTool==='manuscript'&&DAL.saveChapterContent)DAL.saveChapterContent();
  var chapters=project.chapters||[],chapter=chapters.reduce(function(latest,current){return !latest||Number(current.updatedAt)>Number(latest.updatedAt||0)?current:latest;},null);
  DAL.navigate('workspace',projectId,project.type==='rpg'?'storygraph':'manuscript',chapter&&chapter.id);return true;
};

DAL.showStorageCenter = function(){
  DAL.modal((DAL.i18n?DAL.i18n.text("ui_Storage_Recovery_2e5eb37","Storage & Recovery"):"Storage & Recovery"),("<div id=\"storageCenterBody\"><p class=\"writer-muted\">"+DAL.uiLabel("ui_Checking_browser_storage_and_project_asset_b8721b2","Checking browser storage and project assets…")+"</p></div>"),{wide:true,footer:("<button class=\"btn\" data-action=\"backup-workspace\">"+DAL.uiLabel("ui_Emergency_workspace_export_362015e","Emergency workspace export")+"</button><button class=\"btn primary\" data-action=\"manual-save\">"+DAL.uiLabel("saveNow","Save Now")+"</button><button class=\"btn\" data-action=\"close-modal\">"+DAL.uiLabel("close","Close")+"</button>")});
  var estimate = navigator.storage&&navigator.storage.estimate?navigator.storage.estimate():Promise.resolve({});
  var assets = DAL.blobStore&&DAL.blobStore.usage?DAL.blobStore.usage().catch(function(){return {count:0,bytes:0};}):Promise.resolve({count:0,bytes:0});
  Promise.all([estimate,assets]).then(function(values){
    var holder=document.getElementById('storageCenterBody');if(!holder)return;
    var est=values[0]||{}, asset=values[1]||{}, recoveries=DAL.recoveryKeys();
    var h='<div class="report-grid"><div class="report-metric"><strong>'+DAL.escapeHtml(DAL.storageHealth.mode)+("</strong>"+DAL.uiLabel("ui_workspace_store_1d0cb9e","workspace store")+"</div><div class=\"report-metric\"><strong>")+DAL.formatBytes(DAL.storageHealth.bytes||0)+("</strong>"+DAL.uiLabel("ui_workspace_data_b8385b3","workspace data")+"</div><div class=\"report-metric\"><strong>")+DAL.formatBytes(est.usage||0)+("</strong>"+DAL.uiLabel("ui_browser_usage_6172e9a","browser usage")+"</div><div class=\"report-metric\"><strong>")+DAL.formatBytes(est.quota||0)+("</strong>"+DAL.uiLabel("ui_browser_quota_cd32472","browser quota")+"</div><div class=\"report-metric\"><strong>")+asset.count+("</strong>"+DAL.uiLabel("ui_stored_assets_e42f0c4","stored assets")+"</div><div class=\"report-metric\"><strong>")+DAL.formatBytes(asset.bytes||0)+("</strong>"+DAL.uiLabel("ui_asset_bytes_84293ed","asset bytes")+"</div></div>")+
      ("<div class=\"card\" style=\"margin-top:12px\"><strong>"+DAL.uiLabel("ui_Persistence_d8e68f6","Persistence")+"</strong><p class=\"writer-muted\">")+(DAL.storageHealth.persistent?'The latest save is in persistent browser storage.':'The current workspace is only in memory. Export it before closing.')+(DAL.storageHealth.durable?' The browser granted protection from automatic eviction.':' The browser has not guaranteed protection from storage eviction; regular backups remain important.')+'</p><p class="writer-muted">Last successful save: '+(DAL.storageHealth.lastSavedAt?DAL.formatTimestamp(DAL.storageHealth.lastSavedAt):'Not recorded')+'</p>'+(DAL.storageHealth.lastError?'<p style="color:var(--c-danger)">'+DAL.escapeHtml(DAL.storageHealth.lastError)+'</p>':'')+'</div>'+
      ("<div class=\"card\" style=\"margin-top:12px\"><strong>"+DAL.uiLabel("ui_Linked_folder_copy_82b7e9b","Linked-folder copy")+"</strong><p class=\"writer-muted\">Status: ")+DAL.escapeHtml(DAL.folderSyncHealth.status)+(DAL.folderSyncHealth.lastSyncedAt?' · '+DAL.formatTimestamp(DAL.folderSyncHealth.lastSyncedAt):'')+'</p>'+(DAL.folderSyncHealth.lastError?'<p style="color:var(--c-danger)">'+DAL.escapeHtml(DAL.folderSyncHealth.lastError)+'</p>':'')+("</div><h3 style=\"margin-top:16px\">"+DAL.uiLabel("ui_Preserved_recovery_copies_4f70414","Preserved recovery copies")+"</h3>");
    h += recoveries.length?recoveries.map(function(key){var stamp=parseInt(key.split('-').pop(),10);return '<div class="version-item"><strong>'+(isFinite(stamp)?DAL.formatTimestamp(stamp):DAL.escapeHtml(key))+'</strong><div class="writer-tool-actions"><button class="btn sm" data-action="download-recovery" data-recovery-key="'+DAL.escapeHtml(key)+("\">"+DAL.uiLabel("ui_Download_d6eafe8","Download")+"</button><button class=\"btn sm\" data-action=\"restore-recovery-confirm\" data-recovery-key=\"")+DAL.escapeHtml(key)+("\">"+DAL.uiLabel("ui_Restore_a76e13b","Restore")+"</button><button class=\"btn sm danger\" data-action=\"delete-recovery\" data-recovery-key=\"")+DAL.escapeHtml(key)+("\">"+DAL.uiLabel("menu_edit_delete","Delete")+"</button></div></div>");}).join(''):("<p class=\"writer-muted\">"+DAL.uiLabel("ui_No_damaged_workspace_recovery_copies_are_s_eb9df42","No damaged-workspace recovery copies are stored.")+"</p>");
    holder.innerHTML=h;
  });
};

DAL.privacyPolicyContent = function(){
  return '<div class="privacy-policy">'+(window.DAL_PRIVACY_CONTENT||'<p>The offline policy was not included in this development copy. Read the <a href="https://hexxis-studios.github.io/Draft-A-Lore/privacy-policy.html" target="_blank" rel="noopener noreferrer">public privacy policy</a>.</p>')+'</div>';
};

DAL.showPrivacyPolicy = function(){
  DAL.modal((DAL.i18n?DAL.i18n.text("ui_Privacy_Policy_506ff39","Privacy Policy"):"Privacy Policy"), DAL.privacyPolicyContent(), {wide:true, footer:("<button class=\"btn primary\" data-action=\"close-modal\">"+DAL.uiLabel("ui_Done_11a6767","Done")+"</button>")});
};
DAL.renderSettings = function(){
  function text(key,fallback){return DAL.escapeHtml(DAL.i18n?DAL.i18n.text(key,fallback):fallback);}
  var html = '<div class="u-measure u-auto">';
  if(DAL.i18n){
    var locale=DAL.i18n;
    html += '<div class="section-header"><div class="section-title">'+DAL.escapeHtml(locale.text('languageTitle'))+'</div></div><div class="card"><label class="form-label" for="interfaceLanguage">'+DAL.escapeHtml(locale.text('languageTitle'))+'</label><select id="interfaceLanguage" class="form-select" data-interface-language><option value="system"'+(!DAL.state.interfaceLanguage||DAL.state.interfaceLanguage==='system'?' selected':'')+'>'+DAL.escapeHtml(locale.text('systemLanguage'))+'</option>'+locale.targets.filter(function(item){return item.released;}).map(function(item){return '<option value="'+item.code+'"'+(DAL.state.interfaceLanguage===item.code?' selected':'')+'>'+DAL.escapeHtml(item.name)+'</option>';}).join('')+'</select><p class="u-hint">'+DAL.escapeHtml(locale.text('languageHelp'))+'</p></div>';
  }

  html += '<div class="section-header"><div class="section-title">'+DAL.escapeHtml(DAL.i18n?DAL.i18n.text('theme'):'Theme')+'</div></div>';
  html += '<div class="theme-grid">';
  DAL.THEMES.forEach(function(t){
    var active = DAL.state.appTheme === t.id;
    // Swatch colours come from the theme's own palette tokens in styles.css.
    html += '<div class="card theme-option'+(active?' active':' hoverable')+'" data-action="set-theme" data-theme="'+DAL.escapeHtml(t.id)+'" data-swatch="'+DAL.escapeHtml(t.id)+'" role="button" tabindex="0" aria-pressed="'+(active?'true':'false')+'">'+
      '<div class="theme-option-head">'+
        '<span class="theme-chip theme-chip-bg" aria-hidden="true"></span>'+
        '<span class="theme-chip theme-chip-grad" aria-hidden="true"></span>'+
        '<span class="theme-option-name">'+DAL.escapeHtml(t.name)+'</span>'+
      '</div>'+
    '</div>';
  });
  html += '</div>';

  html += '<div class="section-header"><div class="section-title">'+DAL.escapeHtml(DAL.i18n?DAL.i18n.text('authorInformation'):'Author Information')+'</div></div>';
  html += '<div class="card" style="margin-bottom:20px">';
  html += '<div class="form-group"><label class="form-label">'+text('authorPhoto','Author Photo')+'</label>'+
    '<div style="display:flex;align-items:center;gap:12px">'+
    '<div class="author-avatar-preview">'+(DAL.state.authorAvatar?'<img src="'+DAL.state.authorAvatar+'">':DAL.escapeHtml((DAL.state.authorName||'?').charAt(0).toUpperCase()))+'</div>'+
    '<div>'+
      '<input type="file" id="authorAvatarInput" accept="image/*" style="display:none">'+
      '<button class="btn sm" data-action="upload-author-avatar">'+text('uploadPhoto','Upload Photo')+'</button>'+
      (DAL.state.authorAvatar?' <button class="btn sm danger" data-action="remove-author-avatar">'+text('remove','Remove')+'</button>':'')+
    '</div></div></div>';
  html += '<div class="form-group"><label class="form-label" for="setAuthorName">'+text('authorName','Author Name (or Pen Name)')+'</label><input class="form-input" id="setAuthorName" value="'+DAL.escapeHtml(DAL.state.authorName||'')+'" placeholder="'+text('authorNamePlaceholder','Your name or alias')+'"></div>'+
    '<div class="form-group"><label class="form-label" for="setAuthorBio">'+text('authorBio','Meet the Author')+'</label><textarea class="form-textarea" id="setAuthorBio" placeholder="'+text('authorBioPlaceholder','Write a short bio that readers will see...')+'">'+DAL.escapeHtml(DAL.state.authorBio||'')+'</textarea></div>'+
    '<div style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="setAutoFill" '+(DAL.state.autoFillAuthor?'checked':'')+'><label for="setAutoFill" style="font-size:var(--ts-sm);cursor:pointer">'+text('autoFillAuthor','Auto-fill author info into covers, title pages, and exports')+'</label></div>'+
    '<button class="btn primary" style="margin-top:12px" data-action="save-author-info">'+text('saveAuthor','Save Author Info')+'</button></div>';

  html += '<div class="section-header"><div class="section-title">'+DAL.escapeHtml(DAL.i18n?DAL.i18n.text('customFonts'):'Custom Fonts')+'</div></div>';
  html += '<div class="card" style="margin-bottom:20px">'+
    '<p style="font-size:var(--ts-sm);color:var(--c-text-muted);margin-bottom:12px">'+text('fontImportHelp','Import .ttf, .otf, .woff, or .woff2 fonts. Available in all editors.')+'</p>'+
    '<input type="file" id="fontImport" accept=".ttf,.otf,.woff,.woff2" style="display:none">'+
    '<button class="btn" data-action="import-font">'+text('importFont','Import Font')+'</button>'+
    '<div style="margin-top:12px">';
  if(DAL.state.customFonts.length){
    DAL.state.customFonts.forEach(function(f,i){
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--c-divider)">'+
        '<span style="font-size:var(--ts-sm)">'+DAL.escapeHtml(f.name)+'</span>'+
        '<button class="btn sm danger" data-action="remove-font" data-idx="'+i+'">'+text('remove','Remove')+'</button></div>';
    });
  } else {
    html += '<div style="font-size:var(--ts-xs);color:var(--c-text-faint)">'+text('noCustomFonts','No custom fonts imported.')+'</div>';
  }
  html += '</div></div>';

  var online = DAL.isOnline();
  var onlineFonts = !!DAL.state.onlineFontsEnabled;
  html += '<div class="card" style="margin-bottom:20px">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px">'+
      '<div><strong>'+text('onlineFonts','Optional Online Fonts')+'</strong><div style="font-size:var(--ts-xs);color:var(--c-text-faint);margin-top:3px">'+(onlineFonts?(online?text('onlineFontsConnected','Enabled and connected'):text('onlineFontsOffline','Enabled, currently offline')):text('onlineFontsOff','Off — no font network requests'))+'</div></div>'+
      '<button class="switch" data-action="toggle-online-fonts" aria-pressed="'+onlineFonts+'" aria-label="'+text('toggleOnlineFonts','Toggle optional Google Fonts')+'"><span class="track"></span></button>'+
    '</div>'+
    '<p style="font-size:var(--ts-sm);color:var(--c-text-muted);margin-bottom:10px;line-height:1.55">'+text('onlineFontsPrivacy','System and imported fonts work fully offline. If you enable this option, the app contacts Google Fonts while online; Google receives standard connection information. Read the Privacy Policy below for details.')+'</p>'+
    '<div style="display:flex;flex-wrap:wrap;gap:6px">';
  DAL.ONLINE_FONTS.forEach(function(f){
    html += '<span style="font-family:'+(onlineFonts&&online?'\''+f.family+'\', ':'')+'Georgia, serif;font-size:var(--ts-sm);padding:5px 10px;border:1px solid var(--c-border);border-radius:999px;'+(onlineFonts&&online?'':'opacity:.45')+'">'+DAL.escapeHtml(f.name)+'</span>';
  });
  html += '</div>';
  html += '</div>';

  html += '<div class="section-header"><div class="section-title">'+DAL.escapeHtml(DAL.i18n?DAL.i18n.text('saving'):'Saving')+'</div></div>';
  html += '<div class="card" style="margin-bottom:20px">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">'+
      '<div class="u-grow-label">'+
        '<div style="font-weight:600;margin-bottom:2px">'+text('automaticSaving','Automatic saving')+'</div>'+
        '<div style="font-size:var(--ts-xs);color:var(--c-text-faint);line-height:1.5">'+text('automaticSavingHelp','Automatic saving covers manuscript typing. Project actions save immediately. Pending work saves when the app closes.')+'</div>'+
      '</div>'+
      '<button class="switch" data-action="toggle-autosave" aria-pressed="'+DAL.state.autosave+'" aria-label="'+text('toggleAutomaticSaving','Toggle automatic saving of manuscript typing')+'"><span class="track"></span></button>'+
    '</div>'+
    '<div style="border-top:1px solid var(--c-divider);padding-top:12px;margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
      '<button class="btn" data-action="manual-save">'+text('saveNow','Save Now')+'</button>'+
      '<button class="btn" data-action="storage-center">'+text('storageRecovery','Storage & Recovery…')+'</button>'+
      '<span style="font-size:var(--ts-xs);color:var(--c-text-faint)">'+text('saveNowHelp','Writes all projects and settings to this device immediately.')+'</span>'+
    '</div>'+
  '</div>';

  html += '<div class="section-header"><div class="section-title">'+DAL.escapeHtml(DAL.i18n?DAL.i18n.text('backupData'):'Backup & Data')+'</div></div>';
  html += '<div class="card" style="margin-bottom:20px">'+
    '<p class="export-group-note">'+text('workspaceBackupHelp','A workspace backup holds every project plus your settings. Restoring one replaces everything currently on this device. To move a single project instead, use its Export tool and then Import project.')+'</p>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'+
      '<button class="btn" data-action="backup-workspace">'+text('downloadWorkspace','Download backup of all projects (.json)')+'</button>'+
      '<button class="btn" data-action="restore-workspace">'+text('restoreWorkspace','Restore backup of all projects…')+'</button>'+
      '<input type="file" id="restoreInput" accept=".json" style="display:none">'+
    '</div>'+
    '<div style="border-top:1px solid var(--c-divider);padding-top:12px">'+
      '<button class="btn danger" data-action="clear-data">'+text('clearData','Clear All Data')+'</button>'+
    '</div></div>';

  html += '<div class="section-header"><div class="section-title">'+DAL.escapeHtml(DAL.i18n?DAL.i18n.text('privacy'):'Privacy')+'</div></div>'+
    '<div class="card" style="margin-bottom:20px">'+
      '<p style="font-size:var(--ts-sm);color:var(--c-text-muted);line-height:1.55;margin-bottom:12px">'+text('localPrivacySummary','No account, ads, analytics, or telemetry. Your creative work is stored on this device and leaves only through actions you choose.')+'</p>'+
      '<button class="btn" data-action="show-privacy-policy">'+text('readPrivacy','Read Privacy Policy')+'</button>'+
    '</div>';

  // Version + credit. This attribution is required by the project license
  // (see LICENSE.md, Supplemental Term S3) and must stay visible in forks.
  html += '<div style="text-align:center;font-size:var(--ts-xs);color:var(--c-text-faint);padding:16px;line-height:1.7">'+
    'Draft A Lore v1.0.0<br>'+
    'Drafted By Hexxis Studios (Daymien Vanhorn)<br>'+
    '<a href="mailto:contact.draft-a-lore@proton.me" style="color:var(--c-text-faint)">'+DAL.uiLabel('supportEmail','Contact support')+'</a><br>'+
    ("<a href=\"https://github.com/Hexxis-Studios/Draft-A-Lore\" target=\"_blank\" rel=\"noopener\" style=\"color:var(--c-text-faint)\">"+DAL.uiLabel("ui_Draft_A_Lore_on_GitHub_a4b111b","Draft A Lore on GitHub")+"</a><br>")+
    'Free for noncommercial use \u2014 commercial use of the app itself requires a license<br>'+
    'Whatever you write here is yours: selling your own work needs no permission'+
  '</div>';
  html += '</div>';
  return html;
};
DAL.renderLibrary = function(){
  var projects = DAL.state.projectOrder.map(function(id){ return DAL.state.projects[id]; }).filter(function(p){ return p && (p.status === 'completed' || p.status === 'published'); });
  if(projects.length === 0){
    return '<div class="empty-state">'+
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'+
      ("<h3>"+DAL.uiLabel("ui_Library_Empty_ef874f5","Library Empty")+"</h3><p>"+DAL.uiLabel("ui_Completed_and_published_projects_will_appe_3c6de1c","Completed and published projects will appear here.")+"</p></div>");
  }
  var colors = ['var(--c-accent)','var(--c-info)','var(--c-success)','var(--c-warning)','var(--c-danger)'];
  var html = ("<div class=\"section-header\"><div class=\"section-title\">"+DAL.uiLabel("ui_Completed_Books_Library_4c9423a","Completed Books Library")+"</div></div>");
  html += '<div class="library-grid">';
  projects.forEach(function(p, i){
    var color = colors[i % colors.length];
    var author = p.cover.author || (DAL.state.autoFillAuthor ? DAL.state.authorName : '');
    html += '<div class="book-spine" data-action="open-reader" data-pid="'+DAL.escapeHtml(p.id)+'" style="background:linear-gradient(135deg,'+color+','+color+'88);color:#fff">'+
      '<div class="book-spine-title">'+DAL.escapeHtml(p.cover.title||p.name)+'</div>'+
      (author ? '<div class="book-spine-author">'+DAL.escapeHtml(author)+'</div>' : '')+
    '</div>';
  });
  html += '</div>';
  return html;
};

DAL.renderBookReader = function(pid){
  var p = DAL.state.projects[pid];
  if(!p) return ("<div class=\"empty-state\"><h3>"+DAL.uiLabel("ui_Project_not_found_758e841","Project not found")+"</h3></div>");
  var pages = [];
  var author = p.cover.author || (DAL.state.autoFillAuthor ? DAL.state.authorName : '');
  pages.push({ type:'cover', html: '<div class="book-cover"><div class="book-cover-title">'+DAL.escapeHtml(p.cover.title||p.name)+'</div>'+(p.cover.subtitle?'<div style="font-size:var(--ts-sm);opacity:.7;margin-bottom:12px">'+DAL.escapeHtml(p.cover.subtitle)+'</div>':'')+(author?'<div class="book-cover-author">'+DAL.escapeHtml(author)+'</div>':'')+'</div>' });
  var tocHtml = ("<h1>"+DAL.uiLabel("ui_Table_of_Contents_a9360e0","Table of Contents")+"</h1>");
  if(p.chapters && p.chapters.length){
    p.chapters.forEach(function(ch, i){
      tocHtml += '<p style="cursor:pointer;color:var(--c-accent)" data-action="reader-goto" data-page="'+(i+2)+'">'+(i+1)+'. '+DAL.escapeHtml(ch.title)+'</p>';
    });
  }
  pages.push({ type:'toc', html: tocHtml });
  if(p.chapters){
    p.chapters.forEach(function(ch){
      /* Chapter prose is wrapped so a drop capital can be attached to the first
         paragraph of the chapter itself and nowhere else. Without the wrapper the
         rule also hit the first line of the table of contents. */
      pages.push({ type:'chapter', html: '<h2>'+DAL.escapeHtml(ch.title)+'</h2><div class="chapter-prose">'+ch.contentHTML+'</div>' });
    });
  }
  if(DAL.readerPage >= pages.length) DAL.readerPage = 0;

  /* Chapters follow the cover and the table of contents, so the narrator can work
     out which chapter is showing and use its bound voiceover if it has one. */
  var readCh = (p.chapters || [])[DAL.readerPage - 2] || null;
  DAL._readAloudCid = readCh ? readCh.id : '';

  var html = '<div class="book-reader"'+DAL.readerStyleAttr()+'>';
  html += '<div class="book-reader-toolbar">'+
    ("<button class=\"btn sm\" data-action=\"close-reader\">"+DAL.uiLabel("ui__Back_to_Library_61b88df","← Back to Library")+"</button>")+
    DAL.readerControls()+
    '</div>';
  html += '<div class="book-page-container"><div class="book-page" id="bookPage">'+pages[DAL.readerPage].html+'<div class="book-page-num">'+(DAL.readerPage+1)+' / '+pages.length+'</div></div></div>';
  html += '<div class="book-nav">'+
    '<button class="btn sm" data-action="reader-prev" '+(DAL.readerPage<=0?'disabled':'')+(">"+DAL.uiLabel("ui__Previous_435567b","← Previous")+"</button>")+
    '<span style="font-size:var(--ts-xs);color:var(--c-text-faint)">'+(DAL.readerPage+1)+' / '+pages.length+'</span>'+
    '<button class="btn sm" data-action="reader-next" '+(DAL.readerPage>=pages.length-1?'disabled':'')+(">"+DAL.uiLabel("ui_Next__bcf0489","Next →")+"</button>")+
  '</div></div>';
  return html;
};
DAL.handleClick = function(action, el, e){
  if(action === 'set-theme'){ DAL.setTheme(el.getAttribute('data-theme')); DAL.render(); return; }
  if(action === 'dash-organize-on'){ DAL.organizeDashboard = true; DAL.render(); return; }
  if(action === 'dash-organize-off'){ DAL.organizeDashboard = false; DAL.render(); return; }

  if(action === 'dash-move'){
    var moveId = el.getAttribute('data-card');
    var dir = parseInt(el.getAttribute('data-dir'), 10);
    if(DAL.moveDashboardCard(moveId, dir)){
      DAL.render();
      // Keep the keyboard on the button that was just pressed, so a card can be
      // moved several positions without hunting for focus after each re-render.
      var again = document.querySelector('[data-action="dash-move"][data-card="' + moveId + '"][data-dir="' + dir + '"]');
      if(again && !again.disabled) again.focus();
      else {
        var opposite = document.querySelector('[data-action="dash-move"][data-card="' + moveId + '"][data-dir="' + (-dir) + '"]');
        if(opposite) opposite.focus();
      }
    }
    return;
  }

  if(action === 'dash-width'){
    DAL.setDashboardCardSize(el.getAttribute('data-card'), 'w', el.getAttribute('data-w'));
    DAL.render();
    return;
  }

  if(action === 'dash-height'){
    var hId = el.getAttribute('data-card');
    var cur = DAL.dashboardLayout().size[hId];
    DAL.setDashboardCardSize(hId, 'h', (cur && cur.h === 'tall') ? 'normal' : 'tall');
    DAL.render();
    return;
  }

  if(action === 'dash-hide'){
    // No toast here: the Hidden cards tray is already on screen and names the
    // card, so a toast per hide would just stack up over the page.
    DAL.setDashboardCardHidden(el.getAttribute('data-card'), true);
    DAL.render();
    return;
  }

  if(action === 'dash-show'){
    DAL.setDashboardCardHidden(el.getAttribute('data-card'), false);
    DAL.render();
    return;
  }

  if(action === 'analytics-range'){
    DAL.state.analyticsRange = el.getAttribute('data-range');
    DAL.saveState(true);
    DAL.render();
    return;
  }

  if(action === 'dash-reset'){
    DAL.resetDashboardLayout();
    DAL.render();
    DAL.toast((DAL.i18n?DAL.i18n.text("ui_Dashboard_layout_reset_to_default__70874c2","Dashboard layout reset to default."):"Dashboard layout reset to default."), 'info');
    return;
  }

  if(action === 'save-author-info'){
    DAL.state.authorName = document.getElementById('setAuthorName').value;
    DAL.state.authorBio = document.getElementById('setAuthorBio').value;
    DAL.state.autoFillAuthor = document.getElementById('setAutoFill').checked;
    DAL.saveState(); DAL.render(); DAL.toast((DAL.i18n?DAL.i18n.text("ui_Author_info_saved_bfc76ed","Author info saved"):"Author info saved"),'success');
    return;
  }

  if(action === 'import-font'){ document.getElementById('fontImport').click(); return; }

  if(action === 'upload-author-avatar'){ document.getElementById('authorAvatarInput').click(); return; }

  if(action === 'remove-author-avatar'){
    DAL.state.authorAvatar = '';
    DAL.saveState(); DAL.render(); DAL.toast((DAL.i18n?DAL.i18n.text("ui_Photo_removed_93c823c","Photo removed"):"Photo removed"),'info');
    return;
  }

  if(action === 'remove-font'){
    var idx = parseInt(el.getAttribute('data-idx'));
    DAL.state.customFonts.splice(idx, 1);
    DAL.saveState(); DAL.render(); DAL.toast((DAL.i18n?DAL.i18n.text("ui_Font_removed_dab770c","Font removed"):"Font removed"),'info');
    return;
  }

  if(action === 'backup-workspace'){ if(DAL.currentTool==='manuscript'&&DAL.saveChapterContent)DAL.saveChapterContent();DAL.downloadJSON('draft-a-lore-workspace-backup-'+DAL.todayKey()+'.json', DAL.state).then(function(saved){if(saved)DAL.toast((DAL.i18n?DAL.i18n.text("ui_Workspace_data_export_completed_Keep_a_pro_1fe6974","Workspace data export completed. Keep a project ZIP file for portable media."):"Workspace data export completed. Keep a project ZIP file for portable media."),'success');}); return; }

  if(action === 'storage-center'){ DAL.showStorageCenter(); return; }
  if(action === 'download-recovery'){
    try{ var recoveryKey=el.getAttribute('data-recovery-key'), recovery=localStorage.getItem(recoveryKey); if(!recovery)throw new Error('Recovery copy is no longer available.'); DAL.download(recoveryKey+'.json',recovery,'application/json'); }
    catch(recoveryError){DAL.toast(recoveryError.message,'error');} return;
  }
  if(action === 'delete-recovery'){
    try{localStorage.removeItem(el.getAttribute('data-recovery-key'));DAL.showStorageCenter();}catch(deleteRecoveryError){DAL.toast(deleteRecoveryError.message,'error');} return;
  }
  if(action === 'restore-recovery-confirm'){var restoreKey=el.getAttribute('data-recovery-key');DAL.modal((DAL.i18n?DAL.i18n.text("ui_Restore_Recovery_Copy_51c1ee4","Restore Recovery Copy"):"Restore Recovery Copy"),'<p>This replaces the current workspace with the preserved copy. Download an emergency workspace export first if you need the current state.</p>',{footer:'<button class="btn" data-action="storage-center">Cancel</button><button class="btn danger" data-action="restore-recovery-now" data-recovery-key="'+DAL.escapeHtml(restoreKey)+'">Restore copy</button>'});return;}
  if(action === 'restore-recovery-now'){
    try{var restoreRaw=localStorage.getItem(el.getAttribute('data-recovery-key'));DAL.restoreWorkspaceSafely(JSON.parse(restoreRaw)).catch(function(error){DAL.toast('Could not restore that copy: '+error.message,'error');});}catch(restoreCopyError){DAL.toast('Could not restore that copy: '+restoreCopyError.message,'error');}return;
  }

  if(action === 'restore-workspace'){ document.getElementById('restoreInput').click(); return; }

  if(action === 'clear-data'){
    DAL.modal((DAL.i18n?DAL.i18n.text("clearData","Clear All Data"):"Clear All Data"), '<p style="color:var(--c-danger)">This will permanently delete ALL projects, settings, and data.</p><p style="margin-top:8px;font-weight:600">Click Clear again to confirm.</p>', { footer: '<button class="btn" data-action="close-modal">Cancel</button><button class="btn danger" data-action="clear-data-confirm">Clear Everything</button>' });
    return;
  }

  if(action === 'clear-data-confirm'){
    DAL._storage.removeItem('draftALore');
    DAL._storage.removeItem('draftALoreSavedAt');
    if(DAL.stateDB) DAL.stateDB.remove().catch(function(){});
    if(DAL.blobStore && DAL.blobStore.clear) DAL.blobStore.clear().catch(function(){});
    DAL.state = DAL.defaultState();
    DAL.closeModal(); DAL.render(); DAL.toast((DAL.i18n?DAL.i18n.text("ui_All_data_cleared_3bcf9e0","All data cleared"):"All data cleared"),'warning');
    return;
  }

  if(action === 'open-project'){
    var pid = el.getAttribute('data-pid');
    DAL.navigate('workspace', pid);
    return;
  }
  if(action === 'continue-writing'){DAL.continueWriting(el.getAttribute('data-pid'));return;}

  if(action === 'new-project'){ DAL.showNewProjectModal(); return; }

  if(action === 'create-project'){
    if(DAL._projectDialogSaving)return;
    var language=DAL.readProjectLanguage('np');if(!language)return;
    var name = document.getElementById('npName').value.trim() || 'Untitled Project';
    var type = document.getElementById('npType').value;
    var proj = DAL.state.projects[DAL._newProjectDraftId] || DAL.defaultProject(name, type);
    if(DAL._newProjectDraftId) proj.id = DAL._newProjectDraftId;
    if(proj.cover.title===proj.name)proj.cover.title=name;
    proj.name=name;proj.type=type;proj.language=language;
    proj.genres = DAL.readGenreChoices('np');
    var pendingFolder = DAL.folderHandles[proj.id];
    if(pendingFolder) proj.linkedFolderName = pendingFolder.name || 'Linked folder';
    DAL.state.projects[proj.id] = proj;
    if(DAL.state.projectOrder.indexOf(proj.id)<0)DAL.state.projectOrder.push(proj.id);
    return DAL.persistProjectDialog(el,DAL.i18n?DAL.i18n.text('projectCreated','Project created'):'Project created',function(){
      DAL.navigate('workspace',proj.id);DAL._newProjectDraftId=null;
      if(pendingFolder)DAL.queueFolderSync();
    });
  }

  if(action === 'save-as-confirm'){
    if(DAL._projectDialogSaving)return;
    var srcId = DAL.currentProjectId;
    var src = srcId && DAL.state.projects[srcId];
    if(!src) return;
    var newName = document.getElementById('saNewName').value.trim() || (src.name + ' - copy-1');
    var copy = DAL._saveAsRetryId&&DAL.state.projects[DAL._saveAsRetryId] || DAL.clone(src);
    // A Save As copy is a brand-new file: fresh id/timestamps, no shared undo
    // history/version snapshots/folder link with the original.
    if(!DAL._saveAsRetryId)copy.id=DAL.uid('proj');
    DAL._saveAsRetryId=copy.id;
    copy.name = newName;
    copy.cover = copy.cover || {};
    copy.cover.title = newName;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    copy.history = []; copy.historyIndex = -1;
    copy.versions = [];
    copy.folderHandle = null;
    copy.linkedFolderName = null;
    delete DAL.folderHandles[copy.id];
    if(!DAL.state.projects[copy.id]){
      DAL.updateWordHistory();
      var copiedWords=DAL.getProjectWordCount(copy);
      DAL.state.wordBaseline.manuscript+=copiedWords.manuscript;
      DAL.state.wordBaseline.supplementary+=copiedWords.supplementary;
    }
    DAL.state.projects[copy.id] = copy;
    if(DAL.state.projectOrder.indexOf(copy.id)<0)DAL.state.projectOrder.push(copy.id);
    return DAL.persistProjectDialog(el,DAL.i18n?DAL.i18n.text('projectSavedAs','Saved as "'+newName+'"',{name:newName}):'Saved as "'+newName+'"',function(){DAL._saveAsRetryId=null;DAL.navigate('workspace',copy.id);});
  }

  if(action === 'import-project'){
    DAL.openProjectImport();
    return;
  }

  if(action === 'project-settings'){ e.stopPropagation(); DAL.showProjectSettingsModal(el.getAttribute('data-pid')); return; }

  if(action === 'save-project-settings'){
    if(DAL._projectDialogSaving)return;
    var settingsLanguage=DAL.readProjectLanguage('ps');if(!settingsLanguage)return;
    var spid = el.getAttribute('data-pid');
    var sp = DAL.state.projects[spid];
    if(sp){
      sp.name = document.getElementById('psName').value.trim() || sp.name;
      sp.status = document.getElementById('psStatus').value;
      sp.language = settingsLanguage;
      sp.genres = DAL.readGenreChoices('ps');
      sp.cover.title = document.getElementById('psCoverTitle').value;
      sp.cover.subtitle = document.getElementById('psCoverSubtitle').value;
      sp.cover.author = document.getElementById('psCoverAuthor').value;
      sp.updatedAt = Date.now();
      return DAL.persistProjectDialog(el,DAL.i18n?DAL.i18n.text('projectSettingsSaved','Settings saved'):'Settings saved',function(){DAL.render();});
    }
    return;
  }

  if(action === 'export-project'){
    e.stopPropagation();
    var epid = el.getAttribute('data-pid');
    DAL.showExportModal(epid);
    return;
  }

  if(action === 'delete-project'){
    e.stopPropagation();
    DAL.showDeleteConfirm(el.getAttribute('data-pid'), 1);
    return;
  }

  if(action === 'delete-project-confirm'){
    var dpid = el.getAttribute('data-pid');
    delete DAL.state.projects[dpid];
    DAL.state.projectOrder = DAL.state.projectOrder.filter(function(id){ return id !== dpid; });
    DAL.saveState(); DAL.closeModal(); DAL.render(); DAL.toast((DAL.i18n?DAL.i18n.text("ui_Project_deleted_afadfc5","Project deleted"):"Project deleted"),'warning');
    return;
  }

  if(action === 'link-folder' || action === 'link-folder-new'){
    var lpid = el.getAttribute('data-pid') || (action === 'link-folder-new' ? DAL._newProjectDraftId : DAL.currentProjectId);
    DAL.linkFolder(lpid);
    return;
  }

  if(action === 'open-reader'){
    DAL._readerPid = el.getAttribute('data-pid');
    DAL.readerPage = 0;
    DAL._inReader = true;
    document.getElementById('content').innerHTML = DAL.renderBookReader(DAL._readerPid);
    return;
  }

  if(action === 'close-reader'){
    DAL._inReader = false;
    DAL.navigate('library');
    return;
  }

  if(action === 'reader-prev'){
    if(DAL.readerPage > 0){ DAL.readerPage--; DAL.flipPage(); }
    return;
  }
  if(action === 'reader-next'){
    DAL.readerPage++; DAL.flipPage();
    return;
  }
  if(action === 'reader-goto'){
    DAL.readerPage = parseInt(el.getAttribute('data-page')) || 0;
    DAL.flipPage();
    return;
  }
  /* Typeface, size, spacing, tint and drop caps all land here. The shared
     handler repaints whichever reader is open in place, so the page being read
     and any narration under way both survive the change. */
  if(DAL.applyReaderPref(action, el)) return;

  // The canvas view controls come first because both boards share them.
  if(DAL.handleCanvasClick) DAL.handleCanvasClick(action, el, e);
  if(DAL.handleWorkspaceClick) DAL.handleWorkspaceClick(action, el, e);
  if(DAL.handleStoryClick) DAL.handleStoryClick(action, el, e);
  if(DAL.handleAdventureClick) DAL.handleAdventureClick(action, el, e);
};

DAL.flipPage = function(){
  var page = document.getElementById('bookPage');
  if(page){
    page.classList.add('flipping');
    setTimeout(function(){
      document.getElementById('content').innerHTML = DAL.renderBookReader(DAL._readerPid);
    }, 250);
  } else {
    document.getElementById('content').innerHTML = DAL.renderBookReader(DAL._readerPid);
  }
};
document.addEventListener('input', function(e){
  var el = e.target;
  if(el.hasAttribute('data-field')){
    var field = el.getAttribute('data-field');
    if(field === 'authorName') DAL.state.authorName = el.value;
    else if(field === 'authorBio') DAL.state.authorBio = el.value;
    else if(field === 'autoFillAuthor') DAL.state.autoFillAuthor = el.checked;
    DAL.saveState();
  }
  if(el.hasAttribute('data-goal')){
    var key = el.getAttribute('data-goal');
    DAL.state[key] = parseInt(el.value) || 0;
    DAL.saveState();
  }
  if(el.hasAttribute('data-project-goal')){
    var gProj = DAL.state.projects[el.getAttribute('data-pid')];
    if(gProj){
      var gField = el.getAttribute('data-project-goal');
      var gGoal = DAL.projectGoal(gProj);
      if(gField === 'target') gGoal.target = Math.max(0, parseInt(el.value, 10) || 0);
      else gGoal.deadline = el.value || '';
      DAL.saveState();
    }
  }
  if(el.hasAttribute('data-illustration-name')){
    var projIllName = DAL.state.projects[DAL.currentProjectId];
    var illIdx = parseInt(el.getAttribute('data-illustration-name'));
    DAL.setIllustrationProperty(projIllName,illIdx,'name',el.value);
  }
  if(el.hasAttribute('data-illustration-page')){
    var projIllPageInput = DAL.state.projects[DAL.currentProjectId];
    var pageInputIdx = parseInt(el.getAttribute('data-illustration-page'),10);
    var pageInputImage = projIllPageInput.images && projIllPageInput.images[pageInputIdx];
    if(pageInputImage){
      var inputPage = Number(el.value);
      var pageLabel = el.closest('.illustration-info');
      pageLabel = pageLabel && pageLabel.querySelector('.illustration-page-label');
      if(pageLabel) pageLabel.textContent = DAL.bookPageLabel(projIllPageInput,Number.isSafeInteger(inputPage)&&inputPage>=0?inputPage:pageInputImage.bookPage);
    }
  }
});

document.addEventListener('change', function(e){
  var el = e.target;
  if(el.hasAttribute&&el.hasAttribute('data-illustration-name')){DAL._illustrationNameEdit=null;return;}
  if(el.hasAttribute && el.hasAttribute('data-genre-choice')){
    var prefix=el.getAttribute('data-genre-choice');
    if(DAL.readGenreChoices(prefix).length>=5 && el.checked && document.querySelectorAll('[data-genre-choice="'+prefix+'"]:checked').length>5){el.checked=false;DAL.toast(DAL.i18n?DAL.i18n.text('genreLimitWarning','Choose up to five genres.'):'Choose up to five genres.','warning');}
    return;
  }
  // Project goal fields save on every keystroke but only redraw once the value is
  // committed; re-rendering mid-number would pull focus out of the input.
  if(el.hasAttribute && el.hasAttribute('data-project-goal')){
    DAL.render();
    return;
  }
  if(el.id === 'authorAvatarInput' && el.files[0]){
    DAL.readImageAsDataURL(el.files[0], function(dataUrl){
      DAL.state.authorAvatar = dataUrl;
      DAL.saveState(); DAL.render(); DAL.toast((DAL.i18n?DAL.i18n.text("ui_Author_photo_updated_305b99a","Author photo updated"):"Author photo updated"),'success');
    });
    return;
  }
  if(el.id === 'fontImport' && el.files[0]){
    var file = el.files[0];
    var reader = new FileReader();
    reader.onload = function(ev){
      var name = file.name.replace(/\.[^.]+$/,'');
      DAL.state.customFonts.push({ name: name, dataUrl: ev.target.result });
      DAL.loadCustomFonts();
      DAL.saveState(); DAL.render();
      DAL.toast('Font imported: '+name,'success');
    };
    reader.readAsDataURL(file);
    return;
  }
  if(el.id === 'restoreInput' && el.files[0]){
    var restoreGeneration=(DAL._restoreReadGeneration||0)+1;DAL._restoreReadGeneration=restoreGeneration;DAL._pendingRestore=null;
    DAL.readJSON(el.files[0], function(data, err){
      if(restoreGeneration!==DAL._restoreReadGeneration)return;
      if(err || !data || Array.isArray(data) || !data.projects){ DAL.toast(err?err.message:(DAL.i18n?DAL.i18n.text("ui_Invalid_backup_file_45061e4","Invalid backup file"):"Invalid backup file"),'error'); return; }
      try{ data = DAL.normalizeWorkspace(data, true); }catch(restoreError){ DAL.toast(restoreError.message,'error'); return; }
      DAL.modal((DAL.i18n?DAL.i18n.text("ui_Restore_Backup_3f59399","Restore Backup"):"Restore Backup"), '<p>This will replace ALL current data with the backup. Continue?</p>', { footer: '<button class="btn" data-action="close-modal">Cancel</button><button class="btn danger" data-action="restore-confirm">Restore</button>' });
      DAL._pendingRestore = data;
    });
    el.value='';
    return;
  }
  if(el.id === 'illustrationUpload' && el.files.length){
    DAL.importIllustrations(DAL.state.projects[DAL.currentProjectId],Array.from(el.files),'library');el.value='';
    return;
  }
  if(el.id === 'chapterImageInput' && el.files[0]){
    var projChImg = DAL.state.projects[DAL.currentProjectId];
    var chImg = projChImg.chapters.find(function(c){ return c.id === DAL._uploadChapterCid; });
    if(chImg)DAL.importIllustrations(projChImg,[el.files[0]],'chapter',chImg);el.value='';
    DAL._uploadChapterCid = null;
    return;
  }
  if(el.hasAttribute('data-illustration-category')){
    var projIllCat = DAL.state.projects[DAL.currentProjectId];
    var catIdx = parseInt(el.getAttribute('data-illustration-category'));
    DAL.setIllustrationProperty(projIllCat,catIdx,'category',el.value);
    return;
  }
  if(el.hasAttribute('data-illustration-page')){
    var projIllPage = DAL.state.projects[DAL.currentProjectId];
    var pageIdx = parseInt(el.getAttribute('data-illustration-page'),10);
    var pageImage = projIllPage.images && projIllPage.images[pageIdx];
    if(pageImage){
      var changed=DAL.setIllustrationProperty(projIllPage,pageIdx,'bookPage',el.value);el.value=pageImage.bookPage||0;
      DAL.render();
      if(changed)DAL.toast(pageImage.bookPage?DAL.bookPageLabel(projIllPage,pageImage.bookPage):'Illustration removed from the book','success');
    }
    return;
  }
  if(el.hasAttribute('data-illustration-fit')){
    var projIllFit = DAL.state.projects[DAL.currentProjectId];
    var fitImage = projIllFit.images && projIllFit.images[parseInt(el.getAttribute('data-illustration-fit'),10)];
    if(fitImage&&DAL.setIllustrationProperty(projIllFit,parseInt(el.getAttribute('data-illustration-fit'),10),'pageFit',el.value))DAL.render();
    return;
  }
  if(el.id === 'itemImageInput' && el.files[0]){
    var projItem = DAL.state.projects[DAL.currentProjectId];
    var advItem = DAL.ensureAdventure(projItem);
    var itemIdx2 = parseInt(DAL._uploadItemIdx);
    if(advItem.items && advItem.items[itemIdx2])DAL.importIllustrations(projItem,[el.files[0]],'item',advItem.items[itemIdx2]);el.value='';
    DAL._uploadItemIdx = null;
    return;
  }
  if(el.id === 'sceneImageInput' && el.files[0]){
    var projScene = DAL.state.projects[DAL.currentProjectId];
    var advScene = DAL.ensureAdventure(projScene);
    var nodeScene = advScene.nodes.find(function(n){ return n.id === DAL._uploadSceneNodeId; });
    if(nodeScene)DAL.importIllustrations(projScene,[el.files[0]],'scene',nodeScene);el.value='';
    DAL._uploadSceneNodeId = null;
    return;
  }
});

document.addEventListener('click', function(e){
  var el = e.target.closest('[data-action="restore-confirm"]');
  if(!el) return;
  if(DAL._pendingRestore){
    DAL.restoreWorkspaceSafely(DAL._pendingRestore).catch(function(error){DAL.toast('Backup was not restored: '+error.message,'error');});
  }
});
