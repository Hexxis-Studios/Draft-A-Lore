/* Asset manager view, audio binding controls and their actions. */

(function(){

  DAL.formatBytes = function(bytes){
    var n = Number(bytes) || 0;
    if(n < 1024) return n + ' B';
    if(n < 1024*1024) return (n/1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
    return (n/(1024*1024)).toFixed(n < 10*1024*1024 ? 1 : 0) + ' MB';
  };

  DAL.formatDuration = function(seconds){
    var s = Math.round(Number(seconds) || 0);
    if(!s) return '';
    var m = Math.floor(s/60);
    return m + ':' + String(s % 60).padStart(2, '0');
  };

  DAL.assetFolderKey = function(){
    if(!DAL._assetFolderKey) DAL._assetFolderKey = 'illustrations';
    return DAL._assetFolderKey;
  };
  DAL.renderAssets = function(proj){
    DAL.ensureAssets(proj);
    DAL.tts.warm();
    var activeKey = DAL.assetFolderKey();
    var folder = DAL.assetFolder(activeKey);
    var list = proj.assets[activeKey] || [];

    var html = ("<div class=\"section-header\"><div class=\"section-title\">"+DAL.uiLabel("ui_Project_Assets_01ee2a9","Project Assets")+"</div>")+
      ("<button class=\"btn primary\" data-action=\"asset-pick\">"+DAL.uiLabel("ui__Add_Files_85b1456","+ Add Files")+"</button></div>");

    html += ("<p class=\"asset-intro\">"+DAL.uiLabel("ui_Everything_here_is_stored_with_the_project_acb328d","Everything here is stored with the project. Drop files straight onto a scene, chapter or character to attach them — no file paths to type. When a folder is linked, these appear on disk under ")+"<code>Assets/")+DAL.escapeHtml(folder ? folder.dir : '')+'</code>.</p>';

    html += '<div class="asset-tabs" role="tablist">';
    DAL.ASSET_FOLDERS.forEach(function(f){
      var count = (proj.assets[f.key] || []).length;
      html += '<button class="asset-tab'+(f.key === activeKey ? ' active' : '')+'" role="tab" aria-selected="'+(f.key === activeKey)+'" data-action="asset-folder" data-folder="'+f.key+'">'+
        '<span>'+DAL.escapeHtml(f.label)+'</span>'+
        '<span class="asset-tab-count">'+count+'</span></button>';
    });
    html += '</div>';

    html += '<div class="asset-dropzone" data-asset-drop="'+activeKey+'" data-action="asset-pick">'+
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M5 21h14"/></svg>'+
      ("<div class=\"asset-dropzone-title\">"+DAL.uiLabel("ui_Drop_files_here_or_click_to_choose_ed56039","Drop files here, or click to choose")+"</div>")+
      '<div class="asset-dropzone-hint">'+DAL.escapeHtml(folder ? folder.hint : '')+'</div></div>';

    html += ("<div class=\"asset-usage\" id=\"assetUsage\">"+DAL.uiLabel("ui_Measuring_stored_assets__f273700","Measuring stored assets…")+"</div>");

    if(!list.length){
      html += '<div class="empty-state"><h3>No '+DAL.escapeHtml((folder ? folder.label : '').toLowerCase())+' yet</h3>'+
        '<p>'+DAL.escapeHtml(folder ? folder.hint : '')+'</p></div>';
    } else if(activeKey === 'sounds'){
      html += '<div class="asset-sound-list">';
      list.forEach(function(a){
        var src = DAL.assetSrc(proj, a.id);
        html += '<div class="asset-sound" data-drag="asset:'+a.id+'" data-ctx="asset" data-ctx-id="'+a.id+'">'+
          '<div class="asset-sound-head">'+
            '<span class="asset-sound-name" title="'+DAL.escapeHtml(a.name)+'">'+DAL.escapeHtml(a.name)+'</span>'+
            '<span class="asset-meta">'+DAL.formatBytes(a.size)+(a.duration ? ' \u00b7 '+DAL.formatDuration(a.duration) : '')+'</span>'+
            '<button class="btn sm danger" data-action="asset-delete" data-aid="'+a.id+("\">"+DAL.uiLabel("menu_edit_delete","Delete")+"</button>")+
          '</div>'+
          (src ? '<audio class="asset-audio" controls preload="none" src="'+src+'"></audio>'
               : ("<div class=\"asset-missing\">"+DAL.uiLabel("ui_Stored_bytes_could_not_be_read_Re_import_t_f73dcea","Stored bytes could not be read. Re-import this file.")+"</div>"))+
        '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="asset-grid">';
      list.forEach(function(a){
        var src = DAL.assetSrc(proj, a.id);
        html += '<figure class="asset-card'+(activeKey === 'svgs' ? ' svg' : '')+'" data-drag="asset:'+a.id+'" data-ctx="asset" data-ctx-id="'+a.id+'">'+
          '<div class="asset-thumb">'+(src ? '<img src="'+src+'" alt="'+DAL.escapeHtml(a.name)+'" loading="lazy">' : ("<span class=\"asset-missing\">"+DAL.uiLabel("ui_Missing_bytes_b5531a8","Missing bytes")+"</span>"))+'</div>'+
          '<figcaption>'+
            '<span class="asset-name" title="'+DAL.escapeHtml(a.name)+'">'+DAL.escapeHtml(a.name)+'</span>'+
            '<span class="asset-meta">'+DAL.formatBytes(a.size)+'</span>'+
          '</figcaption>'+
          '<button class="btn sm danger asset-card-del" data-action="asset-delete" data-aid="'+a.id+("\" title=\""+DAL.uiLabel("ui_Delete_asset_49c2e3f","Delete asset")+"\">×</button>")+
        '</figure>';
      });
      html += '</div>';
    }

    html += DAL.renderAudioSettings(proj);
    return html;
  };

  /* Usage is asynchronous, so the figure is filled in after the view is on
     screen rather than blocking the render. */
  DAL.refreshAssetUsage = function(){
    var el = document.getElementById('assetUsage');
    if(!el) return;
    if(!DAL.blobStore.available()){
      el.textContent = 'This browser cannot store asset files, so images and audio will not persist.';
      return;
    }
    DAL.blobStore.usage().then(function(u){
      var quota = navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve(null);
      return quota.then(function(est){
        var text = u.count + ' stored file' + (u.count === 1 ? '' : 's') + ' \u00b7 ' + DAL.formatBytes(u.bytes);
        if(est && est.quota) text += ' of about ' + DAL.formatBytes(est.quota) + ' available';
        el.textContent = text;
      });
    }).catch(function(){ el.textContent = 'Stored asset size is unavailable.'; });
  };
  DAL.renderAudioSettings = function(proj){
    DAL.ensureAssets(proj);
    var a = proj.audio;
    var body = '';

    body += '<label class="form-check"><input type="checkbox" data-action="audio-mute"'+(a.muted ? ' checked' : '')+("> <span>"+DAL.uiLabel("ui_Mute_all_project_audio_7848f25","Mute all project audio")+"</span></label>");

    body += ("<div class=\"form-row\"><label class=\"form-label\">"+DAL.uiLabel("ui_Ambient_volume_3585fd1","Ambient volume ")+"<output>")+Math.round(a.ambientVolume*100)+'%</output></label>'+
      ("<input class=\"form-range\" aria-label=\""+DAL.uiLabel("ui_Ambient_volume_d1ded6d","Ambient volume")+"\" type=\"range\" min=\"0\" max=\"100\" value=\"")+Math.round(a.ambientVolume*100)+'" data-action="audio-vol" data-channel="ambient"></div>';
    body += ("<div class=\"form-row\"><label class=\"form-label\">"+DAL.uiLabel("ui_Sound_effect_volume_d4a74db","Sound effect volume ")+"<output>")+Math.round(a.effectVolume*100)+'%</output></label>'+
      ("<input class=\"form-range\" aria-label=\""+DAL.uiLabel("ui_Sound_effect_volume_8382849","Sound effect volume")+"\" type=\"range\" min=\"0\" max=\"100\" value=\"")+Math.round(a.effectVolume*100)+'" data-action="audio-vol" data-channel="effect"></div>';
    body += ("<div class=\"form-row\"><label class=\"form-label\">"+DAL.uiLabel("ui_Voice_volume_99bcda8","Voice volume ")+"<output>")+Math.round(a.voiceVolume*100)+'%</output></label>'+
      ("<input class=\"form-range\" aria-label=\""+DAL.uiLabel("ui_Voice_volume_e46b74e","Voice volume")+"\" type=\"range\" min=\"0\" max=\"100\" value=\"")+Math.round(a.voiceVolume*100)+'" data-action="audio-vol" data-channel="voice"></div>';

    if(!DAL.tts.available()){
      body += '<p class="asset-note">'+DAL.escapeHtml(DAL.tts.native?(DAL.tts.lastError||'Android narration is unavailable. Install a voice in device speech settings.'):'This browser has no speech engine, so narration falls back to any voice clip you attach.')+'</p>';
      if(DAL.tts.native)body += ("<button class=\"btn sm\" data-action=\"tts-retry\">"+DAL.uiLabel("ui_Check_installed_voices_again_0d9fdec","Check installed voices again")+"</button>");
    } else {
      var voices = DAL.tts.voices();
      if(DAL.tts.native)body += '<p class="asset-note" role="status">'+(DAL.tts.loading?'Checking Android speech voices…':'Android pause resumes at the last reported word. Some engines may repeat the current segment.')+'</p>';
      body += '<label class="form-check"><input type="checkbox" data-action="tts-enabled"'+(a.ttsEnabled ? ' checked' : '')+("> <span>"+DAL.uiLabel("ui_Read_scenes_aloud_when_no_voice_clip_is_at_ae8e661","Read scenes aloud when no voice clip is attached")+"</span></label>");
      body += ("<div class=\"form-row\"><label class=\"form-label\">"+DAL.uiLabel("ui_Narration_voice_e53e728","Narration voice")+"</label>")+
        ("<select class=\"form-select\" aria-label=\""+DAL.uiLabel("ui_Narration_voice_e53e728","Narration voice")+"\" data-action=\"tts-voice\">")+
          ("<option value=\"\">"+DAL.uiLabel("ui_Automatic_project_language_91b9893","Automatic — project language")+"</option>")+
          voices.map(function(v){
            return '<option value="'+DAL.escapeHtml(v.name)+'"'+(a.ttsVoice === v.name ? ' selected' : '')+'>'+DAL.escapeHtml(DAL.tts.voiceLabel(v))+'</option>';
          }).join('')+
        '</select>'+
        (voices.length ? '' : ("<span class=\"asset-note\">"+DAL.uiLabel("ui_No_voices_reported_yet_Your_device_may_sti_f49a36c","No voices reported yet. Your device may still be loading them or may need a speech voice installed.")+"</span>"))+
        ("<span class=\"asset-note\">"+DAL.uiLabel("ui_For_offline_narration_choose_an_installed__4b8f68c","For offline narration, choose an installed voice. Network voices may send text to your device’s speech provider when you start playback.")+"</span>")+
      '</div>';
      body += ("<div class=\"form-row\"><label class=\"form-label\">"+DAL.uiLabel("ui_Speed_3d89682","Speed ")+"<output>")+a.ttsRate.toFixed(2)+'\u00d7</output></label>'+
        ("<input class=\"form-range\" aria-label=\""+DAL.uiLabel("ui_Narration_speed_a399d4c","Narration speed")+"\" type=\"range\" min=\"50\" max=\"200\" value=\"")+Math.round(a.ttsRate*100)+'" data-action="tts-rate"></div>';
      body += ("<div class=\"form-row\"><label class=\"form-label\">"+DAL.uiLabel("ui_Pitch_a0066ad","Pitch ")+"<output>")+a.ttsPitch.toFixed(2)+'</output></label>'+
        ("<input class=\"form-range\" aria-label=\""+DAL.uiLabel("ui_Narration_pitch_04bd59e","Narration pitch")+"\" type=\"range\" min=\"0\" max=\"200\" value=\"")+Math.round(a.ttsPitch*100)+'" data-action="tts-pitch"></div>';
      body += ("<div class=\"asset-preview-row\"><button class=\"btn sm\" data-action=\"tts-preview\">"+DAL.uiLabel("ui_Preview_narration_3bd11d1","Preview narration")+"</button>")+
        ("<button class=\"btn sm\" data-action=\"audio-stop\">"+DAL.uiLabel("ui_Stop_audio_d69657b","Stop audio")+"</button></div>");
    }

    return DAL.panel('project-audio', 'Audio & narration', body, { defaultOpen:false });
  };
  /* Rendered inside a scene or chapter editor. `kind` and `id` identify what the
     picked asset should attach to, so one control serves both sides of the app. */
  DAL.renderAudioBinding = function(proj, holder, kind, id){
    function text(key,fallback){return DAL.i18n?DAL.i18n.text(key,fallback):fallback;}
    function label(key,fallback){return DAL.escapeHtml(text(key,fallback));}
    DAL.ensureAssets(proj);
    if(!holder.audio) holder.audio = { voice:'', ambient:'', sfx:'' };
    var sounds = proj.assets.sounds || [];
    /* Each row is its own drop zone and names the slot it fills, so dragging a
       sound onto "Ambient track" binds ambient rather than guessing from whatever
       happens to be empty. */
    function picker(slot, slotLabel, hint){
      var current = holder.audio[slot] || '';
      var html = '<div class="form-row audio-slot" data-drop="asset" data-asset-slot="'+slot+'">'+
        '<label class="form-label">'+DAL.escapeHtml(slotLabel)+'</label>';
      if(!sounds.length){
        html += '<p class="asset-note">'+label('noSoundsForBinding','No sounds imported yet. Add them in the Assets tool, then drop one here.')+'</p>';
      } else {
        html += '<select class="form-select" aria-label="'+DAL.escapeHtml(slotLabel)+'" data-action="bind-audio" data-slot="'+slot+'" data-holder="'+kind+'" data-hid="'+DAL.escapeHtml(id)+'">'+
          '<option value="">'+DAL.escapeHtml(text('noAudioClip','— none —'))+'</option>'+
          sounds.map(function(s){
            return '<option value="'+DAL.escapeHtml(s.id)+'"'+(current === s.id ? ' selected' : '')+'>'+DAL.escapeHtml(s.name)+'</option>';
          }).join('')+
        '</select>';
      }
      html += '<span class="asset-note">'+DAL.escapeHtml(hint)+'</span></div>';
      return html;
    }
    var body = '<div class="audio-bind" data-drop="asset" data-asset-bind="'+kind+':'+DAL.escapeHtml(id)+'">'+
      picker('ambient', text('ambientTrack','Ambient track'), text('ambientTrackHelp','Loops quietly while this part is on screen.'))+
      picker('sfx', text('arrivalSound','Arrival sound effect'), text('arrivalSoundHelp','Plays once when this scene or chapter appears.'))+
      picker('voice', text('voiceoverClip','Voiceover clip'), text('voiceoverClipHelp','Plays once instead of the built-in narrator.'))+
      '<label class="form-label">'+label('narrationScript','Narration script')+' <span class="asset-note">'+label('narrationScriptHelp','Optional — leave empty to read the scene text itself.')+'</span></label>'+
      '<textarea class="form-input" rows="2" aria-label="'+label('narrationScript','Narration script')+'" data-action="bind-narration" data-holder="'+kind+'" data-hid="'+DAL.escapeHtml(id)+'" placeholder="'+label('narrationScriptPlaceholder','Words for the narrator to speak')+'">'+DAL.escapeHtml(holder.narration || '')+'</textarea>'+
      '<div class="asset-preview-row"><button class="btn sm" data-action="audio-test" data-holder="'+kind+'" data-hid="'+DAL.escapeHtml(id)+'">'+label('testAudio','Test audio')+'</button>'+
      '<button class="btn sm" data-action="audio-stop">'+label('stop','Stop')+'</button></div>'+
    '</div>';
    return DAL.panel('audio-bind-'+kind, text('audioNarration','Audio & narration'), body, { defaultOpen:false });
  };

  DAL.audioHolder = function(proj, kind, id){
    if(kind === 'chapter') return (proj.chapters || []).filter(function(c){ return c.id === id; })[0] || null;
    if(kind === 'node'){
      var adv = proj.adventure;
      return adv ? DAL.rpg.nodeById(adv, id) : null;
    }
    return null;
  };

  DAL.holderText = function(proj, kind, holder){
    if(!holder) return '';
    if(kind === 'chapter') return DAL.plainChapter(holder);
    return holder.text || '';
  };
  /* One hidden input reused for every import, because a fresh input per folder
     leaves stale nodes in the DOM after each render. */
  DAL.openAssetPicker = function(folderKey){
    var proj = DAL.activeProject();
    if(!proj) return;
    var key = folderKey || DAL.assetFolderKey();
    var folder = DAL.assetFolder(key);
    var input = document.getElementById('assetFileInput');
    if(!input){
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'assetFileInput';
      input.multiple = true;
      input.hidden = true;
      document.body.appendChild(input);
      input.addEventListener('change', function(){
        var files = input.files;
        var target = input.getAttribute('data-folder') || null;
        if(files && files.length) DAL.receiveAssetFiles(files, target === 'auto' ? null : target);
        input.value = '';
      });
    }
    input.setAttribute('data-folder', key || 'auto');
    input.accept = folder ? folder.accept : '';
    input.click();
  };

  DAL.receiveAssetFiles = function(files, folderKey){
    var proj = DAL.activeProject();
    if(!proj) return Promise.resolve();
    if(!DAL.blobStore.available()){
      DAL.toast((DAL.i18n?DAL.i18n.text("ui_This_browser_cannot_store_asset_files__c7110c4","This browser cannot store asset files."):"This browser cannot store asset files."), 'error');
      return Promise.resolve();
    }
    DAL.toast('Importing ' + files.length + ' file' + (files.length === 1 ? '' : 's') + '\u2026', 'info');
    return DAL.importAssetFiles(proj, files, folderKey).then(function(res){
      if(res.added) DAL.toast('Added ' + res.added + ' asset' + (res.added === 1 ? '' : 's'), 'success');
      res.failed.forEach(function(msg){ DAL.toast(msg, 'error'); });
      DAL.render();
      DAL.refreshAssetUsage();
      DAL.syncAssetFolder();
    });
  };
  /* The in-app pointer drag system moves records between panels; files arriving
     from the desktop are a separate HTML5 dataTransfer flow. */
  function fileDropTarget(el){
    while(el && el !== document.body){
      if(el.getAttribute && (el.getAttribute('data-asset-drop') || el.getAttribute('data-asset-bind'))) return el;
      el = el.parentElement;
    }
    return null;
  }

  function hasFiles(e){
    var dt = e.dataTransfer;
    if(!dt) return false;
    if(dt.types) for(var i=0;i<dt.types.length;i++){ if(dt.types[i] === 'Files') return true; }
    return false;
  }

  document.addEventListener('dragover', function(e){
    if(!hasFiles(e)) return;
    var zone = fileDropTarget(e.target);
    if(!zone) return;
    e.preventDefault();
    zone.classList.add('file-drag-over');
  });

  document.addEventListener('dragleave', function(e){
    var zone = fileDropTarget(e.target);
    if(zone && !zone.contains(e.relatedTarget)) zone.classList.remove('file-drag-over');
  });

  document.addEventListener('drop', function(e){
    if(!hasFiles(e)) return;
    var zone = fileDropTarget(e.target);
    if(!zone) return;
    e.preventDefault();
    zone.classList.remove('file-drag-over');
    var files = e.dataTransfer.files;
    if(!files || !files.length) return;

    var bind = zone.getAttribute('data-asset-bind');
    if(bind){
      /* Dropped straight onto a scene or chapter: import, then attach in the slot
         the file's own type implies. */
      var parts = bind.split(':');
      DAL.attachDroppedFiles(files, parts[0], parts.slice(1).join(':'));
      return;
    }
    DAL.receiveAssetFiles(files, zone.getAttribute('data-asset-drop'));
  });

  DAL.attachDroppedFiles = function(files, kind, id){
    var proj = DAL.activeProject();
    if(!proj) return;
    var list = Array.prototype.slice.call(files);
    DAL.importAssetFiles(proj, list).then(function(res){
      res.failed.forEach(function(msg){ DAL.toast(msg, 'error'); });
      var holder = DAL.audioHolder(proj, kind, id);
      if(!holder){ DAL.render(); return; }
      if(!holder.audio) holder.audio = { voice:'', ambient:'', sfx:'' };
      var attached = [];
      list.forEach(function(file){
        var folderKey = DAL.assetFolderForFile(file);
        var asset = (proj.assets[folderKey] || []).filter(function(a){ return a.name === file.name; }).pop();
        if(!asset) return;
        if(folderKey === 'sounds'){
          var slot = !holder.audio.ambient ? 'ambient' : (!holder.audio.sfx ? 'sfx' : 'voice');
          holder.audio[slot] = asset.id;
          attached.push(file.name + ' \u2192 ' + slot);
        } else if(kind === 'node'){
          holder.images = holder.images || [];
          holder.images.push({ assetId: asset.id, name: asset.name });
          attached.push(file.name + ' \u2192 scene art');
        } else if(kind === 'chapter'){
          holder.imageAssetId = asset.id;
          attached.push(file.name + ' \u2192 chapter art');
        }
      });
      DAL.saveState();
      DAL.render();
      DAL.syncAssetFolder();
      if(attached.length) DAL.toast('Attached ' + attached.join(', '), 'success');
    });
  };
  DAL.handleAssetAction = function(action, el){
    /* The audio controls also appear in the library player, which has no
       "active project" in the workspace sense. */
    var proj = DAL.audioContextProject ? DAL.audioContextProject() : DAL.activeProject();
    if(!proj) return false;
    DAL.ensureAssets(proj);

    /* Read-aloud lives here because it needs the same project resolution as the
       rest of the audio controls: the reader is not the workspace project. */
    if(action === 'read-aloud-pause'){
      DAL.toggleReadAloudPause();
      return true;
    }
    if(action === 'read-aloud'){
      if(DAL.readAloud.speaking){
        DAL.stopReadAloud();
        el.textContent = DAL.READ_ALOUD_LABEL;
        return true;
      }
      var cid = DAL._readAloudCid || '';
      var chapter = cid ? DAL.audioHolder(proj, 'chapter', cid) : null;
      if(DAL.startReadAloud(proj, chapter)) el.textContent = '\u25a0 Stop reading';
      return true;
    }

    if(action === 'asset-folder'){
      DAL._assetFolderKey = el.getAttribute('data-folder');
      DAL.render();
      DAL.refreshAssetUsage();
      return true;
    }

    if(action === 'asset-pick'){
      var zone = el.closest ? el.closest('[data-asset-drop]') : null;
      DAL.openAssetPicker(zone ? zone.getAttribute('data-asset-drop') : DAL.assetFolderKey());
      return true;
    }

    if(action === 'asset-delete'){
      var aid = el.getAttribute('data-aid');
      var asset = DAL.assetById(proj, aid);
      if(!asset) return true;
      if(!confirm('Delete “' + asset.name + '”? Any scene or chapter using it loses that attachment.')) return true;
      DAL.deleteAsset(proj, aid).then(function(){
        DAL.toast((DAL.i18n?DAL.i18n.text("ui_Asset_deleted_6e35e2b","Asset deleted"):"Asset deleted"), 'success');
        DAL.render();
        DAL.refreshAssetUsage();
      });
      return true;
    }

    if(action === 'audio-mute'){
      proj.audio.muted = !!el.checked;
      if(proj.audio.muted) DAL.audioBus.stopAll();
      DAL.audioBus.applyVolumes();
      DAL.saveState();
      DAL.render();
      return true;
    }

    if(action === 'audio-vol'){
      var channel = el.getAttribute('data-channel');
      var value = Math.min(1, Math.max(0, (parseInt(el.value, 10) || 0) / 100));
      if(channel === 'ambient') proj.audio.ambientVolume = value;
      else if(channel === 'effect') proj.audio.effectVolume = value;
      else proj.audio.voiceVolume = value;
      DAL.audioBus.applyVolumes();
      var out = el.parentElement && el.parentElement.querySelector('output');
      if(out) out.textContent = Math.round(value*100) + '%';
      DAL.saveState();
      return true;
    }

    if(action === 'tts-enabled'){ proj.audio.ttsEnabled = !!el.checked; DAL.saveState(); return true; }
    if(action === 'tts-voice'){ proj.audio.ttsVoice = el.value || ''; DAL.saveState(); return true; }

    if(action === 'tts-rate' || action === 'tts-pitch'){
      var v = (parseInt(el.value, 10) || 0) / 100;
      if(action === 'tts-rate') proj.audio.ttsRate = Math.min(2, Math.max(0.5, v));
      else proj.audio.ttsPitch = Math.min(2, Math.max(0, v));
      var o = el.parentElement && el.parentElement.querySelector('output');
      if(o) o.textContent = action === 'tts-rate' ? proj.audio.ttsRate.toFixed(2) + '\u00d7' : proj.audio.ttsPitch.toFixed(2);
      DAL.saveState();
      return true;
    }

    if(action === 'tts-retry'){if(DAL.tts.retry)DAL.tts.retry();return true;}
    if(action === 'tts-preview'){
      DAL.tts.speak('The lantern gutters, and the door ahead is already open.', proj);
      return true;
    }

    if(action === 'audio-stop'){ DAL.audioBus.stopAll(); return true; }

    if(action === 'bind-audio'){
      var holder = DAL.audioHolder(proj, el.getAttribute('data-holder'), el.getAttribute('data-hid'));
      if(holder){
        if(!holder.audio) holder.audio = { voice:'', ambient:'', sfx:'' };
        holder.audio[el.getAttribute('data-slot')] = el.value || '';
        DAL.saveState();
        DAL.toast(el.value ? 'Audio attached' : 'Audio removed', 'success');
      }
      return true;
    }

    if(action === 'bind-narration'){
      var h2 = DAL.audioHolder(proj, el.getAttribute('data-holder'), el.getAttribute('data-hid'));
      if(h2){ h2.narration = el.value; DAL.saveState(); }
      return true;
    }

    if(action === 'audio-test'){
      var kind = el.getAttribute('data-holder');
      var h3 = DAL.audioHolder(proj, kind, el.getAttribute('data-hid'));
      if(h3) DAL.presentScene(proj, h3, DAL.sceneNarrationText(h3, DAL.holderText(proj, kind, h3)));
      return true;
    }

    return false;
  };

  /* Dropping an asset from the Assets tool onto a scene, chapter or audio slot
     binds it there. The zone says what it is (data-asset-bind or a scene's
     data-nid) and may name a slot; the asset's folder decides sound versus art. */
  DAL.DROP = DAL.DROP || {};
  DAL.DROP['asset'] = function(payload, zone){
    var proj = DAL.activeProject();
    if(!proj) return;
    var scope = zone.closest('[data-asset-bind]');
    var bind = scope ? scope.getAttribute('data-asset-bind') : '';
    var nid = zone.getAttribute('data-nid') || (zone.closest('[data-nid]') ? zone.closest('[data-nid]').getAttribute('data-nid') : '');
    var kind, id;
    if(bind){ var p = bind.split(':'); kind = p[0]; id = p.slice(1).join(':'); }
    else if(nid){ kind = 'node'; id = nid; }
    else return;

    var holder = DAL.audioHolder(proj, kind, id);
    var asset = DAL.assetById(proj, payload.id);
    if(!holder || !asset) return;
    if(!holder.audio) holder.audio = { voice:'', ambient:'', sfx:'' };

    var wanted = zone.getAttribute('data-asset-slot') || '';
    if(wanted === 'ambient' || wanted === 'sfx' || wanted === 'voice'){
      if(asset.folder !== 'sounds'){
        DAL.toast(asset.name + ' is artwork, not a sound. Drop it on the scene or chapter itself.', 'error');
        return;
      }
      holder.audio[wanted] = asset.id;
      DAL.toast(asset.name + ' set as the ' + (wanted === 'ambient' ? 'ambient track' : wanted === 'sfx' ? 'sound effect' : 'voiceover clip'), 'success');
    } else if(asset.folder === 'sounds'){
      var slot = !holder.audio.ambient ? 'ambient' : (!holder.audio.sfx ? 'sfx' : 'voice');
      holder.audio[slot] = asset.id;
      DAL.toast(asset.name + ' set as the ' + (slot === 'ambient' ? 'ambient track' : slot === 'sfx' ? 'sound effect' : 'voiceover clip'), 'success');
    } else {
      /* Scenes and chapters both keep artwork in `images`; the chapter strip shows
         at most two, so a third drop is refused rather than silently hidden. */
      holder.images = holder.images || [];
      if(kind === 'chapter' && holder.images.length >= 2){
        DAL.toast((DAL.i18n?DAL.i18n.text("ui_This_chapter_already_has_two_illustrations_c311af4","This chapter already has two illustrations. Remove one first."):"This chapter already has two illustrations. Remove one first."), 'error');
        return;
      }
      holder.images.push({ assetId: asset.id, name: asset.name });
      DAL.toast(asset.name + ' added to the ' + (kind === 'chapter' ? 'chapter' : 'scene'), 'success');
    }
    DAL.saveState();
    DAL.render();
  };
  /* Clicks reach view handlers through DAL.handleClick; wrapping it keeps asset
     actions out of the core dispatch chain. */

  /* Turning the page or leaving the reader has to silence the narrator, otherwise
     it carries on reading a page nobody is looking at. */
  var STOPS_READING = ['bp-next','bp-prev','bp-goto','reader-next','reader-prev','reader-goto','close-reader','switch-tool','nav'];

  DAL.registerActionHandler(function(action, el){
    if(DAL.readAloud && DAL.readAloud.speaking && STOPS_READING.indexOf(action) !== -1) DAL.stopReadAloud();
    return DAL.handleAssetAction(action, el) === true;
  });

  /* Dropdowns commit on change. Restricted to SELECT so checkbox actions are not
     handled twice — those already arrive as clicks. */
  document.addEventListener('change', function(e){
    var el = e.target;
    if(el.tagName !== 'SELECT' || !el.hasAttribute('data-action')) return;
    var action = el.getAttribute('data-action');
    if(action === 'bind-audio' || action === 'tts-voice') DAL.handleAssetAction(action, el);
  });

  /* Sliders and the narration script update live, without a re-render that would
     drop the drag or steal focus mid-sentence. */
  document.addEventListener('input', function(e){
    var el = e.target;
    if(!el.hasAttribute || !el.hasAttribute('data-action')) return;
    var action = el.getAttribute('data-action');
    if(action === 'audio-vol' || action === 'tts-rate' || action === 'tts-pitch' || action === 'bind-narration'){
      DAL.handleAssetAction(action, el);
    }
  });

  /* Object URLs have to exist before a view can reference them. Priming after a
     render and re-rendering only when something new resolved avoids a loop. */
  DAL.registerAfterRender(function(){
    if(DAL.currentTool === 'assets') DAL.refreshAssetUsage();
    var proj = DAL.audioContextProject ? DAL.audioContextProject() : DAL.activeProject();
    if(!proj) return;
    DAL.ensureAssets(proj);
    var pending = DAL.allAssets(proj).filter(function(a){ return !a.inline && !DAL._assetUrls[a.id]; });
    if(!pending.length) return;
    DAL.primeAssetUrls(proj).then(function(){
      var resolved = pending.some(function(a){ return !!DAL._assetUrls[a.id]; });
      if(resolved) DAL.render();
    });
  });
  /* Mirrors the asset registry into Assets/<Folder>/ inside a linked project
     folder, so a project handed to someone else carries its media with it. */
  DAL.syncAssetFolder = function(root, proj){
    proj = proj || DAL.activeProject();
    root = root || (proj && DAL.folderHandles && DAL.folderHandles[proj.id]);
    if(!proj || !root || !DAL.getDir) return Promise.resolve();
    if(root.native){
      root.assetsSynced = false;
      return DAL.syncNativeAssets ? DAL.syncNativeAssets(proj, root) : Promise.resolve();
    }
    DAL.ensureAssets(proj);
    return DAL.getDir(root, 'Assets').then(function(assetsDir){
      return DAL.ASSET_FOLDERS.reduce(function(chain, folder){
        return chain.then(function(){
          var list = proj.assets[folder.key] || [];
          if(!list.length) return null;
          return DAL.getDir(assetsDir, folder.dir).then(function(dir){
            return list.reduce(function(inner, asset){
              return inner.then(function(){
                if(asset.inline) return DAL.writeFile(dir, asset.name, asset.inline);
                return DAL.blobStore.get(asset.id).then(function(rec){
                  if(!rec || !rec.blob) throw new Error('Asset “'+asset.name+'” is missing from this device.');
                  return DAL.writeFile(dir, asset.name, rec.blob);
                });
              });
            }, Promise.resolve());
          });
        });
      }, Promise.resolve());
    });
  };

})();
