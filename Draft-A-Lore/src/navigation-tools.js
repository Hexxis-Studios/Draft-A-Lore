DAL = DAL || {};
(function(){
  DAL.setWorkspaceDrawer=function(kind,open){
    var chapters=kind==='chapters',property=chapters?'chapterSidebarOpen':'projectSidebarOpen';
    DAL[property]=!!open;
    var shell=document.querySelector(chapters?'.manuscript-layout':'.workspace');
    if(shell)shell.classList.toggle(chapters?'chapters-open':'project-nav-open',!!open);
    var trigger=document.querySelector('[data-action="'+(chapters?'toggle-chapters':'toggle-project-sidebar')+'"]');
    if(trigger){
      var key=chapters?(open?'closeChapters':'openChapters'):(open?'closeProjectSections':'openProjectSections');
      var fallback=(open?'Close':'Open')+(chapters?' chapters':' project sections');
      trigger.setAttribute('aria-expanded',String(!!open));trigger.setAttribute('aria-label',DAL.i18n?DAL.i18n.text(key,fallback):fallback);
    }
    var drawer=document.getElementById(chapters?'chapterSidebar':'wsSidebar');
    var touchLayout=typeof window!=='undefined'&&window.innerWidth<((DAL.BREAKPOINTS&&DAL.BREAKPOINTS.medium)||1050);
    var selector=chapters?'[data-action="close-chapters"]':(touchLayout?'[data-action="ws-tool"]':'#projectToolSearch');
    var target=open&&drawer?drawer.querySelector(selector):trigger;
    if(target)target.focus();
  };
  var aliases={manuscript:'write writing chapters editor notes',characters:'people cast profiles',relationships:'connections family',plots:'story arcs threads',timeline:'events dates chronology',storyanalytics:'point of view heatmap pacing analysis',lore:'world places locations magic rules',illustrations:'pictures images artwork manga',mindmap:'brainstorm ideas map',bookdesign:'typography margins publishing epub pdf',bookpreview:'reader kindle paperback',storygraph:'scenes nodes choices branching',stats:'attributes traits abilities',items:'inventory equipment possessions',playtest:'playthrough test adventure',continuity:'consistency contradictions story checker',encyclopedia:'extract catalog glossary lookup',worldbible:'shared world series projects',sync:'backup restore devices folder',assets:'audio sounds voice images files'};
  DAL.matchesToolQuery=function(label,tool,query){
    var haystack=(String(label)+' '+String(tool)+' '+(aliases[tool]||'')).toLocaleLowerCase();
    return String(query||'').trim().toLocaleLowerCase().split(/\s+/).every(function(word){return haystack.indexOf(word)>=0;});
  };
  function filter(input){
    var sidebar=document.getElementById('wsSidebar');if(!sidebar)return;
    var buttons=sidebar.querySelectorAll('.ws-nav-item'),count=0;
    buttons.forEach(function(button){
      var match=DAL.matchesToolQuery(button.textContent,button.getAttribute('data-tool'),input.value);
      button.hidden=!match;if(match)count++;
    });
    sidebar.querySelectorAll('.ws-nav-group-label').forEach(function(group){
      var node=group.nextElementSibling,visible=false;
      while(node&&!node.classList.contains('ws-nav-group-label')){if(node.classList.contains('ws-nav-item')&&!node.hidden)visible=true;node=node.nextElementSibling;}
      group.hidden=!visible;
    });
    var status=document.getElementById('projectToolSearchStatus');
    if(status)status.textContent=input.value.trim()?(count?count+' matching section'+(count===1?'':'s'):'No matching sections. Clear the search to see all tools.') : '';
  }
  document.addEventListener('input',function(event){if(event.target.id==='projectToolSearch')filter(event.target);});
  document.addEventListener('keydown',function(event){
    if(typeof window!=='undefined'&&(window.innerWidth||1024)<DAL.BREAKPOINTS.medium&&!DAL.state.sidebarCollapsed&&!document.querySelector('.modal-backdrop,#dalCtxMenu,#dalMenuDropdown')){
      if(event.key==='Escape'){
        event.preventDefault();event.stopImmediatePropagation();DAL.fireAction('toggle-sidebar');return;
      }
      if(event.key==='Tab'){
        var main=document.getElementById('sidebar');
        var mainControls=main?Array.from(main.querySelectorAll('button,a[href],[tabindex]')).filter(function(item){return !item.disabled&&item.tabIndex>=0&&item.getClientRects().length&&getComputedStyle(item).visibility!=='hidden';}):[];
        if(mainControls.length){
          var mainIndex=mainControls.indexOf(document.activeElement);
          if(mainIndex<0||(event.shiftKey&&mainIndex===0)||(!event.shiftKey&&mainIndex===mainControls.length-1)){
            event.preventDefault();mainControls[event.shiftKey?mainControls.length-1:0].focus();return;
          }
        }
      }
    }
    var kind=DAL.projectSidebarOpen?'project':(DAL.chapterSidebarOpen?'chapters':'');
    if(kind&&!document.querySelector('.modal-backdrop,#dalCtxMenu,#dalMenuDropdown')&&typeof window!=='undefined'&&window.matchMedia('(max-width:759px), (max-width:959px) and (max-height:520px)').matches){
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();DAL.setWorkspaceDrawer(kind,false);return;}
      if(event.key==='Tab'){
        var drawer=document.getElementById(kind==='chapters'?'chapterSidebar':'wsSidebar');
        var controls=drawer?Array.from(drawer.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')).filter(function(item){return !item.disabled&&item.tabIndex>=0&&item.getClientRects().length&&getComputedStyle(item).visibility!=='hidden';}):[];
        if(controls.length){
          var index=controls.indexOf(document.activeElement);
          if(index<0||(event.shiftKey&&index===0)||(!event.shiftKey&&index===controls.length-1)){
            event.preventDefault();controls[event.shiftKey?controls.length-1:0].focus();
          }
        }
      }
    }
    if(event.target.id!=='projectToolSearch'||event.key!=='Enter')return;
    var sidebar=document.getElementById('wsSidebar');if(!sidebar)return;
    var matches=Array.from(sidebar.querySelectorAll('.ws-nav-item')).filter(function(button){return !button.hidden;});
    if(matches.length===1){event.preventDefault();matches[0].click();}
  },true);
})();
