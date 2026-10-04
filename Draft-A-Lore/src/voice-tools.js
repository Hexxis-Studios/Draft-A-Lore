(function(){
  var recognition = null, session = 0, target = null, stopTimer = null;
  function voiceText(key,fallback,values){
    var translated=DAL.i18n&&DAL.i18n.text(key,fallback,values);
    if(translated&&translated!==fallback)return translated;
    return fallback.replace(/\{(\w+)\}/g,function(match,name){return values&&values[name]!==undefined?String(values[name]):match;});
  }
  function voiceHtml(key,fallback){return DAL.escapeHtml(voiceText(key,fallback));}
  function clearStopTimer(){ if(stopTimer !== null){ clearTimeout(stopTimer); stopTimer = null; } }
  function nativePlugin(){
    var capacitor = window.Capacitor;
    if(!capacitor || !capacitor.getPlatform || capacitor.getPlatform() !== 'android') return null;
    if(!DAL._nativeVoicePlugin) DAL._nativeVoicePlugin = capacitor.Plugins&&capacitor.Plugins.Voice;
    if(!DAL._nativeVoicePlugin&&typeof capacitor.registerPlugin==='function')DAL._nativeVoicePlugin=capacitor.registerPlugin('Voice');
    if(!DAL._nativeVoicePlugin)throw new Error('Android dictation is unavailable in this build.');
    return DAL._nativeVoicePlugin;
  }
  function NativeRecognition(){
    this.processLocally = true;
    this.listener = null;
    this.cancelled = false;
    this.sessionId = String(Date.now()) + '-' + String(Math.random());
  }
  NativeRecognition.prototype.start = async function(){
    var self = this, plugin = nativePlugin();
    this.listener = await plugin.addListener('recognition', function(event){
      if(self.cancelled || (event.type !== 'interrupted' && event.sessionId !== self.sessionId)) return;
      if(event.type === 'ready' && self.onstart) self.onstart();
      if(event.type === 'partial' || event.type === 'final'){
        var result = [{transcript:event.text || ''}]; result.isFinal = event.type === 'final';
        if(self.onresult) self.onresult({resultIndex:0,results:[result]});
      }
      if(event.type === 'error' || event.type === 'interrupted'){
        if(self.onerror) self.onerror({error:'native',message:event.text || voiceText('dictationInterrupted','Dictation stopped when the app left the foreground. Your draft is preserved.')});
        self.release();
      }
      if(event.type === 'end'){ if(self.onend) self.onend(); self.release(); }
    });
    if(this.cancelled){ this.release(); return; }
    await plugin.start({language:this.lang, online:!this.processLocally, sessionId:this.sessionId});
  };
  NativeRecognition.prototype.release = function(){
    this.cancelled = true;
    var listener=this.listener;this.listener=null;
    if(listener&&listener.remove){try{Promise.resolve(listener.remove()).catch(function(){});}catch(error){}}
  };
  NativeRecognition.prototype.abort = function(){ this.release(); nativePlugin().stop({abort:true}).catch(function(){}); };
  NativeRecognition.prototype.stop = function(){
    var self=this;
    nativePlugin().stop({abort:false}).catch(function(error){
      if(self.cancelled)return;
      if(self.onerror)self.onerror({error:'native',message:error.message||voiceText('dictationStopFailure','Dictation could not stop normally. Your completed draft is preserved.')});
      self.release();
    });
  };
  function recognitionConstructor(){ return nativePlugin() ? NativeRecognition : (window.SpeechRecognition || window.webkitSpeechRecognition); }
  function element(id){ return document.getElementById(id); }
  function project(){ return target && DAL.state.projects[target.projectId]; }
  function remember(immediate){
    var p = project(), field = element('dictationDraft');
    if(p && p===target.project && field){ p.dictationDraft = field.value; DAL.saveState(immediate===true); }
  }
  function status(message){ var node = element('dictationStatus'); if(node) node.textContent = message; }
  function controls(listening){
    var start = element('dictationStart'), stop = element('dictationStop'), draft = element('dictationDraft');
    if(start) start.disabled = listening;
    if(stop) stop.disabled = !listening;
    if(draft) draft.readOnly = listening;
    ['dictationLanguage','dictationNetwork'].forEach(function(id){ var node = element(id); if(node) node.disabled = listening; });
  }
  DAL.stopDictation = function(immediate){
    clearStopTimer();
    session++;
    var current = recognition; recognition = null;
    if(current){ try{ current.abort(); }catch(e){} }
    controls(false); remember(immediate);
  };
  DAL.showDictation = function(){
    var p = DAL.activeProject();
    if(!p){ DAL.toast(voiceText('dictationOpenProject','Open a project first.'), 'warning'); return; }
    DAL.closeModal();
    if(DAL.captureWriterSelection) DAL.captureWriterSelection();
    var ed=element('editorContent'),chapter=(p.chapters||[]).find(function(ch){return ch.id===DAL.selectedChapterId;}),range=DAL._writerRange;
    if(!ed||!range||!ed.contains(range.commonAncestorContainer))range=null;
    target = {projectId:p.id,project:p,chapterId:DAL.selectedChapterId,chapter:chapter,editor:ed,html:ed&&ed.innerHTML,range:range&&range.cloneRange(),rangePoints:range&&DAL.dictationRangePoints(ed,range)};
    var supported = !!recognitionConstructor();
    DAL.modal(voiceText('dictationTitle','Dictation & Voice Notes'),
      '<p>'+voiceHtml('dictationReviewHelp','Speak into a draft, review it, then insert it into your chapter. Nothing is inserted automatically.')+'</p>'+
      '<p class="u-hint" id="dictationDestination">'+(chapter&&ed?DAL.escapeHtml(DAL.dictationDestination(chapter.title,range,false)):voiceHtml('dictationNotesOnly','Open a manuscript chapter to insert a draft. You can still record or type notes here.'))+'</p>'+
      (range&&!range.collapsed?'<label><input type="checkbox" id="dictationReplaceSelection"> '+voiceHtml('dictationReplaceSelected','Replace the selected passage instead (removes its current text)')+'</label>':'')+
      '<label class="form-label" for="dictationLanguage">'+voiceHtml('dictationSpokenLanguage','Spoken language')+'</label><input class="form-input" id="dictationLanguage" value="'+DAL.escapeHtml(p.language || navigator.language || 'en-US')+("\" placeholder=\""+DAL.uiLabel("ui_en_US_es_ES__5a7765d","en-US, es-ES…")+"\">")+
      '<label><input type="checkbox" id="dictationNetwork"> '+voiceHtml('dictationAllowOnline','Allow my device’s speech service to process microphone audio online')+'</label>'+
      '<p class="u-hint">'+voiceHtml('dictationPrivacyHelp','Offline recognition is used by default and requires an installed language pack. Online recognition depends on your device’s speech provider. Draft A Lore’s developer does not receive your audio.')+'</p>'+
      '<div class="writer-toolbar"><button class="btn primary" id="dictationStart" data-action="dictation-start"'+(supported?'':' disabled')+'>'+voiceHtml('dictationStart','Start listening')+'</button><button class="btn" id="dictationStop" data-action="dictation-stop" disabled>'+voiceHtml('dictationStop','Stop')+'</button></div>'+
      '<p id="dictationStatus" role="status" aria-live="polite">'+(supported?voiceHtml('dictationReady','Ready.'):voiceHtml('dictationUnavailable','Speech recognition is unavailable here. You can use your device keyboard’s microphone or type a note below.'))+'</p>'+
      '<p id="dictationInterim" aria-live="off"></p><label class="form-label" for="dictationDraft">'+voiceHtml('dictationReviewDraft','Draft to review')+'</label><textarea class="form-textarea" id="dictationDraft" rows="8">'+DAL.escapeHtml(p.dictationDraft || '')+'</textarea>',
      {wide:true,initialFocus:'#dictationDraft',footer:'<button class="btn" data-action="close-modal">'+voiceHtml('dictationKeepDraft','Keep draft & close')+'</button><button class="btn primary" data-action="dictation-insert"'+(chapter&&ed?'':' disabled')+'>'+voiceHtml('dictationInsert','Insert into chapter')+'</button>'});
    element('dictationDraft').addEventListener('input', remember);
    var replacement=element('dictationReplaceSelection');
    if(replacement)replacement.addEventListener('change',function(){
      var hint=element('dictationDestination');
      if(hint)hint.textContent=DAL.dictationDestination(chapter.title,range,replacement.checked);
    });
    var plugin=nativePlugin(),statusNode=element('dictationStatus');
    if(plugin&&plugin.capabilities){
      status(voiceText('dictationChecking','Checking installed speech services…'));
      plugin.capabilities().then(function(capability){
        if(element('dictationStatus')!==statusNode||recognition)return;
        if(!capability.recognition&&!capability.offline){
          element('dictationStart').disabled=true;
          status(voiceText('dictationNoService','No speech recognition service is installed. Use your keyboard microphone or type your note below.'));
        }else status(capability.offline?voiceText('dictationOnDevice','Ready for on-device dictation. Language support depends on installed packs.'):voiceText('dictationNoOffline','No on-device recognizer is installed. Use keyboard dictation, or explicitly allow online recognition.'));
      }).catch(function(){
        if(element('dictationStatus')===statusNode&&!recognition)status(voiceText('dictationCheckFailure','Could not check installed speech services. Starting dictation will report whether a service is available; your draft stays safe.'));
      });
    }
  };
  DAL.dictationDestination=function(title,range,replace){
    var values={title:title||voiceText('dictationUntitledChapter','Untitled chapter')};
    if(!range)return voiceText('dictationDestinationEnd','Destination: {title} — at the end of the chapter.',values);
    if(range.collapsed)return voiceText('dictationDestinationCursor','Destination: {title} — at your cursor.',values);
    return replace?voiceText('dictationDestinationReplace','Destination: {title} — replacing the selected passage.',values):voiceText('dictationDestinationAfter','Destination: {title} — after the selected passage, keeping its text.',values);
  };
  DAL.startDictation = async function(){
    if(recognition) return;
    var Constructor = recognitionConstructor();
    if(!Constructor){ status(voiceText('dictationNoBrowser','This device does not provide browser speech recognition.')); return; }
    var draftNode=element('dictationDraft'),languageNode=element('dictationLanguage'),networkNode=element('dictationNetwork'),p=project();
    if(!draftNode||!languageNode||!networkNode||!p||p!==target.project||DAL.currentProjectId!==target.projectId)return;
    var language = languageNode.value.trim(), online = networkNode.checked;
    if(!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(language)){ status(voiceText('dictationLanguageCode','Enter a language code such as en-US or es-ES.')); return; }
    var current;
    try{ current = new Constructor(); }catch(e){ status(voiceText('dictationInitFailure','Speech recognition could not be initialized.')); return; }
    if(!online && !('processLocally' in current)){
      status(voiceText('dictationOfflineUnsupported','Offline recognition is not supported by this browser. Use your keyboard’s offline dictation, or explicitly allow the browser’s online speech service.')); return;
    }
    var token = ++session;
    recognition = current; controls(true); status(voiceText('dictationPreparing','Preparing microphone…'));
    current.lang = language; current.continuous = true; current.interimResults = true;
    if('processLocally' in current) current.processLocally = !online;
    var base = draftNode.value, finalResults=Object.create(null);
    function active(){
      if(recognition!==current||session!==token)return false;
      if(element('dictationDraft')!==draftNode||project()!==p||DAL.currentProjectId!==target.projectId){DAL.stopDictation();return false;}
      return true;
    }
    current.onstart = function(){ if(active()) status(voiceText('dictationListening','Listening. Speak naturally, then press Stop to review.')); };
    current.onresult = function(event){
      if(!active()) return;
      if(!event||!event.results)return;
      var interim = [];
      for(var i=0;i<event.results.length;i++){
        var result=event.results[i];if(!result||!result[0]||typeof result[0].transcript!=='string')continue;
        var text = result[0].transcript.trim();
        if(result.isFinal)finalResults[i]=text;else if(!Object.prototype.hasOwnProperty.call(finalResults,i))interim.push(text);
      }
      var finalText=Object.keys(finalResults).sort(function(a,b){return Number(a)-Number(b);}).map(function(index){return finalResults[index];}).filter(Boolean).join(' ');
      draftNode.value = DAL.dictationDraftText(base,finalText);
      element('dictationInterim').textContent = interim.join(' ');
      remember();
    };
    current.onerror = function(event){
      if(!active()) return;
      clearStopTimer();
      var errors = {'not-allowed':voiceText('dictationDenied','Microphone access was denied. Allow access in your browser to dictate.'), 'audio-capture':voiceText('dictationNoMicrophone','No usable microphone was found.'), 'network':voiceText('dictationNetworkFailure','The speech service could not connect. Your completed draft is preserved.'), 'no-speech':voiceText('dictationNoSpeech','No speech was detected. Try again when ready.'), 'language-not-supported':voiceText('dictationLanguageUnavailable','This language is unavailable. Offline dictation requires an installed language pack.'), 'service-not-allowed':voiceText('dictationServiceBlocked','This browser blocked the speech service.')};
      status(event.message || errors[event.error] || voiceText('dictationUnknownError','Recognition stopped ({error}). Your completed draft is preserved.',{error:event.error||'unknown'}));
      recognition = null; controls(false); remember();
      element('dictationInterim').textContent = '';
      try{ current.abort(); }catch(e){}
    };
    current.onend = function(){
      if(!active()) return;
      clearStopTimer();
      recognition = null; controls(false); remember();
      element('dictationInterim').textContent = '';
      status(voiceText('dictationStopped','Stopped. Review your draft before inserting it.'));
    };
    try{ await current.start(); }catch(e){ if(current.release) current.release(); if(active()){ recognition = null; controls(false); status(voiceText('dictationStartError','{message} Your draft is preserved.',{message:e.message || voiceText('dictationStartFailure','Recognition could not start.')})); } }
  };
  DAL.insertDictation = function(){
    if(recognition){ status(voiceText('dictationStopFirst','Stop listening before inserting your draft.')); return; }
    var p = project(), draft = element('dictationDraft'), text = draft && draft.value.trim();
    var chapter = p && (p.chapters || []).find(function(ch){ return ch.id === target.chapterId; });
    var editor = element('editorContent');
    if(!chapter || !editor || p!==target.project || chapter!==target.chapter || DAL.currentProjectId !== target.projectId || DAL.selectedChapterId !== target.chapterId){ status(voiceText('dictationOpenChapter','Open a manuscript chapter before inserting. Your draft is preserved.')); return; }
    if(editor.innerHTML!==target.html){status(voiceText('dictationChangedChapter','The chapter changed while this draft was open. Keep your draft, close this window, and reopen Voice Notes at the intended insertion point. Nothing was inserted.'));return;}
    if(!text){ status(voiceText('dictationEmpty','Your draft is empty.')); return; }
    var range = target.range&&(editor===target.editor?target.range.cloneRange():DAL.restoreDictationRange(editor,target.rangePoints)),replace=element('dictationReplaceSelection');
    if(target.range&&!range){status(voiceText('dictationLostPoint','The original insertion point is no longer available. Your draft is preserved; reopen Voice Notes at the intended point.'));return;}
    if(range&&!editor.contains(range.commonAncestorContainer)){status(voiceText('dictationLostPoint','The original insertion point is no longer available. Your draft is preserved; reopen Voice Notes at the intended point.'));return;}
    if(!range){ range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); }
    else if(!range.collapsed&&!(replace&&replace.checked))range.collapse(false);
    var before = range.cloneRange(), after = range.cloneRange();
    before.selectNodeContents(editor); before.setEnd(range.startContainer, range.startOffset);
    after.selectNodeContents(editor); after.setStart(range.endContainer, range.endOffset);
    text = DAL.dictationInsertionText(text, before.toString(), after.toString());
    var selection = window.getSelection(),inserted=false;
    if(!selection){status(voiceText('dictationNoSelection','This browser cannot select an insertion point. Copy your draft manually; it is still preserved.'));return;}
    chapter.contentHTML=editor.innerHTML;
    var previousHistory=(p.history||[]).slice(),previousRedo=p.redoStack,previousIndex=p.historyIndex;
    DAL.pushHistory(p.id);var insertionHistory=p.history,snapshot=insertionHistory&&insertionHistory[insertionHistory.length-1];
    editor.focus();selection.removeAllRanges();selection.addRange(range);
    try{inserted=document.execCommand('insertText', false, text);}catch(error){}
    if(!inserted){
      if(editor.innerHTML===target.html&&p.history===insertionHistory&&insertionHistory[insertionHistory.length-1]===snapshot){insertionHistory.length=0;Array.prototype.push.apply(insertionHistory,previousHistory);p.redoStack=previousRedo;p.historyIndex=previousIndex;}
      status(editor.innerHTML===target.html?voiceText('dictationInsertFailure','Insertion was unavailable. Your draft is preserved here; you can copy it manually or try again.'):voiceText('dictationPartialInsert','Insertion did not complete normally. Review your chapter before trying again; your draft is preserved and Undo can restore the previous chapter.'));
      if(draft.focus)draft.focus();return;
    }
    DAL.saveChapterContent(); p.dictationDraft = ''; draft.value = '';
    DAL.closeModal();
    DAL.toast(voiceText('dictationInserted','Dictation inserted. Use Undo to restore the previous chapter.'), 'success');
  };
  DAL.dictationRangePoints = function(root,range){
    function point(node,offset){
      var path=[];
      while(node&&node!==root){var parent=node.parentNode;if(!parent||!parent.childNodes)return null;var index=Array.prototype.indexOf.call(parent.childNodes,node);if(index<0)return null;path.unshift(index);node=parent;}
      return node===root?{path:path,offset:offset}:null;
    }
    var start=point(range.startContainer,range.startOffset),end=point(range.endContainer,range.endOffset);return start&&end?{start:start,end:end}:null;
  };
  DAL.restoreDictationRange = function(root,points){
    if(!points)return null;
    function nodeAt(point){var node=root;for(var i=0;i<point.path.length;i++){node=node.childNodes&&node.childNodes[point.path[i]];if(!node)return null;}var length=node.nodeType===3?(node.nodeValue||'').length:(node.childNodes||[]).length;return Number.isInteger(point.offset)&&point.offset>=0&&point.offset<=length?node:null;}
    var start=nodeAt(points.start),end=nodeAt(points.end);if(!start||!end)return null;
    try{var range=document.createRange();range.setStart(start,points.start.offset);range.setEnd(end,points.end.offset);return range;}catch(error){return null;}
  };
  DAL.dictationDraftText = function(base,finalText){return !finalText?base:base+(/\S$/.test(base)?' ':'')+finalText;};
  DAL.dictationInsertionText = function(text, before, after){
    if(/\S$/.test(before) && !/^[\s.,!?;:)}\]]/.test(text)) text = ' ' + text;
    if(/\S$/.test(text) && /^[^\s.,!?;:)}\]]/.test(after)) text += ' ';
    return text;
  };
  var close = DAL.closeModal;
  DAL.closeModal = function(){ if(element('dictationDraft')) DAL.stopDictation(true); return close.apply(this, arguments); };
  DAL.registerActionHandler(function(action){
    if(action === 'show-dictation'){ DAL.showDictation(); return true; }
    if(action === 'dictation-start'){ DAL.startDictation(); return true; }
    if(action === 'dictation-stop'){
      if(recognition){
        try{
          status(voiceText('dictationFinishing','Finishing recognition…')); recognition.stop();
          clearStopTimer();
          if(recognition) stopTimer = setTimeout(function(){
            DAL.stopDictation();
            var interim = element('dictationInterim'); if(interim) interim.textContent = '';
            status(voiceText('dictationTimeout','The speech service did not finish. Your completed draft is preserved; you can review it or try again.'));
          }, 10000);
        }catch(e){ DAL.stopDictation(); status(voiceText('dictationAborted','Recognition stopped. Your completed draft is preserved.')); }
      }
      return true;
    }
    if(action === 'dictation-insert'){ DAL.insertDictation(); return true; }
    return false;
  });
})();
