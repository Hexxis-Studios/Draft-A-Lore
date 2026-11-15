/* Library shelf, the adventure player, and project import with assets. */

(function(){

  /* Scene art predates the asset folder, so an image record may carry either an
     inline data URL or an asset id. Both have to keep rendering. */
  DAL.imageSrc = function(proj, img){
    if(!img) return '';
    if(img.assetId){
      var src = DAL.assetSrc(proj, img.assetId);
      if(src) return src;
    }
    return img.dataUrl || '';
  };
  /* The shelf now carries adventures as well as books: an RPG project is
     finished work too, and previously had nowhere to be read from end to end. */
  DAL.libraryEntries = function(){
    return DAL.state.projectOrder.map(function(id){ return DAL.state.projects[id]; })
      .filter(function(p){ return p && (p.status === 'completed' || p.status === 'published'); })
      .map(function(p){
        var hasChapters = (p.chapters || []).length > 0;
        var hasScenes = p.adventure && (p.adventure.nodes || []).length > 0;
        var modes = [];
        if(hasChapters && p.type !== 'rpg') modes.push('read');
        if(hasScenes && p.type !== 'novel') modes.push('play');
        return { project: p, modes: modes };
      })
      .filter(function(entry){ return entry.modes.length > 0; });
  };

  DAL.renderLibrary = function(){
    var entries = DAL.libraryEntries();
    var html = ("<div class=\"section-header\"><div class=\"section-title\">"+DAL.uiLabel("library","Library")+"</div>")+
      ("<button class=\"btn\" data-action=\"library-import\">"+DAL.uiLabel("ui_Import_Project__5f4f8ec","Import Project…")+"</button></div>");

    if(!entries.length){
      return html + '<div class="empty-state">'+
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'+
        ("<h3>"+DAL.uiLabel("ui_Library_Empty_ef874f5","Library Empty")+"</h3><p>"+DAL.uiLabel("ui_Mark_a_project_completed_or_published_and__08a66f9","Mark a project completed or published and it appears here, ready to read or play with its artwork and audio. You can also import a project shared with you.")+"</p></div>");
    }

    html += ("<p class=\"asset-intro\">"+DAL.uiLabel("ui_Read_finished_books_or_play_through_finish_c30ff40","Read finished books or play through finished adventures exactly as a reader would, with artwork, formatting and audio switched on.")+"</p>");
    var colors = ['var(--c-accent)','var(--c-info)','var(--c-success)','var(--c-warning)','var(--c-danger)'];
    html += '<div class="library-grid">';
    entries.forEach(function(entry, i){
      var p = entry.project;
      var color = colors[i % colors.length];
      var author = (p.cover && p.cover.author) || (DAL.state.autoFillAuthor ? DAL.state.authorName : '');
      var primary = entry.modes[0];
      var counts = [];
      if(p.chapters && p.chapters.length) counts.push(p.chapters.length + ' chapter' + (p.chapters.length === 1 ? '' : 's'));
      if(p.adventure && p.adventure.nodes && p.adventure.nodes.length) counts.push(p.adventure.nodes.length + ' scene' + (p.adventure.nodes.length === 1 ? '' : 's'));
      var sounds = ((p.assets && p.assets.sounds) || []).length;
      if(sounds) counts.push(sounds + ' sound' + (sounds === 1 ? '' : 's'));

      html += '<div class="book-spine" data-action="'+(primary === 'play' ? 'open-player' : 'open-reader')+'" data-pid="'+DAL.escapeHtml(p.id)+'" style="background:linear-gradient(135deg,'+color+','+color+'88);color:#fff">'+
        '<div class="book-spine-kind">'+(primary === 'play' ? 'Adventure' : 'Book')+'</div>'+
        '<div class="book-spine-title">'+DAL.escapeHtml((p.cover && p.cover.title) || p.name)+'</div>'+
        (author ? '<div class="book-spine-author">'+DAL.escapeHtml(author)+'</div>' : '')+
        (counts.length ? '<div class="book-spine-meta">'+DAL.escapeHtml(counts.join(' \u00b7 '))+'</div>' : '')+
        '<div class="book-spine-actions">'+
          (entry.modes.indexOf('read') >= 0 ? '<button class="btn sm" data-action="open-reader" data-pid="'+DAL.escapeHtml(p.id)+("\">"+DAL.uiLabel("ui_Read_9b9a8d0","Read")+"</button>") : '')+
          (entry.modes.indexOf('play') >= 0 ? '<button class="btn sm" data-action="open-player" data-pid="'+DAL.escapeHtml(p.id)+("\">"+DAL.uiLabel("ui_Play_436e610","Play")+"</button>") : '')+
        '</div>'+
      '</div>';
    });
    html += '</div>';
    return html;
  };
  /* A reader-facing run of a finished adventure: no author panels, no debug
     inspector, art and audio on by default. Kept apart from the playtester so
     neither has to compromise. */
  DAL.openPlayer = function(pid){
    var proj = DAL.state.projects[pid];
    if(!proj) return;
    var adv = proj.adventure;
    if(!adv || !(adv.nodes || []).length){ DAL.toast((DAL.i18n?DAL.i18n.text("ui_This_project_has_no_scenes_to_play__53ce810","This project has no scenes to play."):"This project has no scenes to play."), 'info'); return; }
    DAL.ensureAssets(proj);
    DAL.playerProjectId = pid;
    DAL.playerState = DAL.rpg.newState(adv);
    DAL.currentView = 'player';
    DAL.primeAssetUrls(proj).then(function(){
      DAL.render();
      DAL.playerPresent();
    });
  };

  DAL.closePlayer = function(){
    DAL.audioBus.stopAll();
    DAL.playerProjectId = null;
    DAL.playerState = null;
    DAL.navigate('library');
  };

  DAL.playerPresent = function(){
    var proj = DAL.state.projects[DAL.playerProjectId];
    if(!proj || !DAL.playerState) return;
    var node = DAL.rpg.currentNode(DAL.playerState, proj.adventure);
    if(!node) return;
    DAL.presentScene(proj, node, DAL.sceneNarrationText(node, node.text));
  };

  DAL.renderPlayer = function(){
    var proj = DAL.state.projects[DAL.playerProjectId];
    if(!proj) return ("<div class=\"empty-state\"><h3>"+DAL.uiLabel("ui_Project_not_found_758e841","Project not found")+"</h3></div>");
    var adv = proj.adventure;
    var state = DAL.playerState;
    var node = DAL.rpg.currentNode(state, adv);
    if(!node) return ("<div class=\"empty-state\"><h3>"+DAL.uiLabel("ui_This_adventure_has_no_opening_scene_bbbe098","This adventure has no opening scene")+"</h3></div>");

    /* The player inherits the reader's typeface, text size, spacing and tint, so
       a reader sets up how they like to read once and every kind of story in the
       library obeys it. */
    var html = '<div class="player-shell"'+DAL.readerStyleAttr()+'>';
    html += '<div class="player-bar">'+
      ("<button class=\"btn sm\" data-action=\"close-player\">"+DAL.uiLabel("ui__Library_b21babb","← Library")+"</button>")+
      '<div class="player-title">'+DAL.escapeHtml((proj.cover && proj.cover.title) || proj.name)+'</div>'+
      '<div class="player-bar-right">'+
        DAL.renderAudioBar(proj)+
        /* The same reading controls the book readers offer, minus the read-aloud
           button: the player's own audio bar already owns narration here. */
        DAL.readerControls({ readAloud:false })+
        ("<button class=\"btn sm\" data-action=\"player-restart\">"+DAL.uiLabel("ui_Restart_6b983a8","Restart")+"</button>")+
      '</div></div>';

    html += '<article class="player-scene">';
    html += '<h1 class="player-scene-title">'+DAL.escapeHtml(node.title || '')+'</h1>';
    (node.images || []).forEach(function(img){
      var src = DAL.imageSrc(proj, img);
      if(!src) return;
      html += '<figure class="player-art"><img src="'+src+'" alt="'+DAL.escapeHtml(img.caption || img.name || '')+'">'+
        (img.caption ? '<figcaption>'+DAL.escapeHtml(img.caption)+'</figcaption>' : '')+'</figure>';
    });
    html += '<div class="player-text">'+DAL.escapeHtml(node.text || '').replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')+'</div>';

    var ending = node.kind === 'ending';
    if(ending){
      html += '<div class="player-ending"><div class="player-ending-label">'+DAL.escapeHtml(node.endingLabel || 'The End')+'</div>'+
        (node.endingMessage ? '<p>'+DAL.escapeHtml(node.endingMessage)+'</p>' : '')+
        ("<button class=\"btn primary\" data-action=\"player-restart\">"+DAL.uiLabel("ui_Play_again_5ef30d2","Play again")+"</button></div>");
    } else {
      var states = DAL.rpg.choiceStates(node, state, adv);
      var shown = states.filter(function(s){ return !s.hidden; });
      if(!shown.length){
        html += ("<div class=\"player-ending\"><div class=\"player-ending-label\">"+DAL.uiLabel("ui_The_path_ends_here_0e1378b","The path ends here")+"</div>")+
          ("<p>"+DAL.uiLabel("ui_There_is_nothing_further_to_choose_from_th_bf2b48b","There is nothing further to choose from this scene.")+"</p>")+
          ("<button class=\"btn primary\" data-action=\"player-restart\">"+DAL.uiLabel("ui_Play_again_5ef30d2","Play again")+"</button></div>");
      } else {
        html += '<div class="player-choices">';
        shown.forEach(function(s){
          if(s.ok){
            html += '<button class="player-choice" data-action="player-choose" data-idx="'+s.index+'">'+DAL.escapeHtml(s.choice.label || 'Continue')+'</button>';
          } else {
            /* A locked choice still shows its requirement, so a reader learns what
               to go and do rather than staring at a dead button. */
            html += '<div class="player-choice locked" aria-disabled="true">'+DAL.escapeHtml(s.choice.label || 'Continue')+
              (s.unmet && s.unmet.length ? '<span class="player-choice-req">Requires: '+DAL.escapeHtml(s.unmet.join(', '))+'</span>' : '')+'</div>';
          }
        });
        html += '</div>';
      }
    }
    html += '</article>';

    html += DAL.renderPlayerStatus(proj, state, adv);
    html += '</div>';
    return html;
  };

  DAL.renderPlayerStatus = function(proj, state, adv){
    var stats = DAL.rpg.statRows(state, adv) || [];
    var items = DAL.rpg.inventoryRows(state, adv) || [];
    var traits = DAL.rpg.traitRows(state, adv) || [];
    if(!stats.length && !items.length && !traits.length) return '';
    var html = '<aside class="player-status">';
    if(stats.length){
      html += ("<div class=\"player-status-group\"><div class=\"player-status-title\">"+DAL.uiLabel("ui_Condition_39b36d3","Condition")+"</div><dl>");
      stats.forEach(function(r){ html += '<div><dt>'+DAL.escapeHtml(r.label)+'</dt><dd>'+DAL.escapeHtml(String(r.value))+'</dd></div>'; });
      html += '</dl></div>';
    }
    if(items.length){
      html += ("<div class=\"player-status-group\"><div class=\"player-status-title\">"+DAL.uiLabel("ui_Carrying_4102dc6","Carrying")+"</div><ul>");
      items.forEach(function(r){ html += '<li>'+DAL.escapeHtml(r.name)+(r.qty > 1 ? ' \u00d7'+r.qty : '')+'</li>'; });
      html += '</ul></div>';
    }
    if(traits.length){
      html += ("<div class=\"player-status-group\"><div class=\"player-status-title\">"+DAL.uiLabel("ui_Traits_e0ab4ad","Traits")+"</div><ul>");
      traits.forEach(function(r){ html += '<li>'+DAL.escapeHtml(r.label)+'</li>'; });
      html += '</ul></div>';
    }
    html += '</aside>';
    return html;
  };

  /* Shared transport controls, used by the player, the reader and the
     playtester so audio behaves the same in all three. */
  DAL.renderAudioBar = function(proj){
    DAL.ensureAssets(proj);
    var muted = proj.audio.muted;
    return '<div class="audio-bar">'+
      '<button class="btn sm icon" data-action="audio-mute-toggle" title="'+(muted ? 'Unmute audio' : 'Mute audio')+'" aria-pressed="'+(muted ? 'true' : 'false')+'">'+(muted ? '\u{1F507}' : '\u{1F50A}')+'</button>'+
      ("<button class=\"btn sm icon\" data-action=\"audio-replay\" title=\""+DAL.uiLabel("ui_Replay_narration_ddcbf6f","Replay narration")+"\">↻</button>")+
      '<input class="form-range slim" type="range" min="0" max="100" value="'+Math.round(proj.audio.voiceVolume*100)+("\" data-action=\"audio-vol\" data-channel=\"voice\" title=\""+DAL.uiLabel("ui_Voice_volume_e46b74e","Voice volume")+"\" aria-label=\""+DAL.uiLabel("ui_Voice_volume_e46b74e","Voice volume")+"\">")+
    '</div>';
  };
  /* The playtester keeps its author panels; this adds the transport bar and
     makes each scene change speak and play its bed. */
  var basePlaytest = DAL.renderPlaytest;
  DAL.renderPlaytest = function(proj){
    var html = basePlaytest.call(DAL, proj);
    DAL.ensureAssets(proj);
    var bar = '<div class="playtest-audio-bar">'+DAL.renderAudioBar(proj)+
      ("<span class=\"asset-note\">"+DAL.uiLabel("ui_Scene_audio_and_narration_play_here_exactl_97d85a6","Scene audio and narration play here exactly as a reader hears them.")+"</span></div>");
    html = html.replace('<div class="playtest-passage-title"', bar + '<div class="playtest-passage-title"');

    /* Present after the DOM settles, and only when the scene actually changed,
       so a re-render for an unrelated reason does not restart the narration. */
    var node = DAL.rpg.currentNode(DAL.playtestState, proj.adventure);
    if(node && DAL._ptSpokenNode !== node.id){
      DAL._ptSpokenNode = node.id;
      setTimeout(function(){
        if(DAL.currentTool === 'playtest') DAL.presentScene(proj, node, DAL.sceneNarrationText(node, node.text));
      }, 60);
    }
    return html;
  };
  DAL.registerActionHandler(function(action, el){
    var proj;

    if(action === 'open-player'){ DAL.openPlayer(el.getAttribute('data-pid')); return true; }
    if(action === 'close-player'){ DAL.closePlayer(); return true; }

    if(action === 'player-restart'){
      proj = DAL.state.projects[DAL.playerProjectId];
      if(proj){
        DAL.playerState = DAL.rpg.newState(proj.adventure);
        DAL.audioBus.stopAll();
        DAL.render();
        DAL.playerPresent();
      }
      return true;
    }

    if(action === 'player-choose'){
      proj = DAL.state.projects[DAL.playerProjectId];
      if(proj){
        var res = DAL.rpg.choose(DAL.playerState, proj.adventure, parseInt(el.getAttribute('data-idx'), 10));
        if(res && res.refusals && res.refusals.length) res.refusals.forEach(function(m){ DAL.toast(m, 'info'); });
        DAL.render();
        DAL.playerPresent();
      }
      return true;
    }

    if(action === 'audio-mute-toggle'){
      proj = DAL.audioContextProject();
      if(proj){
        proj.audio.muted = !proj.audio.muted;
        if(proj.audio.muted) DAL.audioBus.stopAll();
        DAL.saveState();
        DAL.render();
        if(!proj.audio.muted) DAL.replayNarration();
      }
      return true;
    }

    if(action === 'audio-replay'){ DAL.replayNarration(); return true; }

    if(action === 'library-import'){ DAL.openProjectImport(); return true; }

    return false;
  });

  /* Audio controls appear in three different views, each with its own idea of
     "the current project". */
  DAL.audioContextProject = function(){
    if(DAL.currentView === 'player' && DAL.playerProjectId) return DAL.state.projects[DAL.playerProjectId];
    if(DAL._inReader && DAL._readerPid) return DAL.state.projects[DAL._readerPid];
    return DAL.activeProject();
  };

  DAL.replayNarration = function(){
    if(DAL.currentView === 'player'){ DAL.playerPresent(); return; }
    var proj = DAL.audioContextProject();
    if(!proj) return;
    if(DAL.currentTool === 'playtest'){
      var node = DAL.rpg.currentNode(DAL.playtestState, proj.adventure);
      if(node) DAL.presentScene(proj, node, DAL.sceneNarrationText(node, node.text));
    }
  };
  /* Two shapes are accepted: a single project .json, or a folder chosen with the
     directory picker whose relative Assets/ tree is read in alongside it. A
     project shared between machines therefore arrives complete. */
  DAL.importText = function(key,fallback,values){return DAL.i18n?DAL.i18n.text(key,fallback,values):fallback;};
  DAL.openProjectImport = function(){
    function label(key,fallback){return DAL.escapeHtml(DAL.importText(key,fallback));}
    var canFolder = typeof window.showDirectoryPicker === 'function';
    var body = '<p>'+label('importProjectHelp','Bring in a project someone shared with you.')+'</p>'+
      '<div class="import-choice"><button class="btn block primary" data-action="import-project-bundle">'+label('chooseBundle','Choose a project ZIP (.zip)')+'</button>'+
      '<span class="asset-note">'+label('bundleImportHelp','A project ZIP includes your project and all artwork and audio files.')+'</span></div>'+
      '<div class="import-choice">'+
        '<button class="btn block" data-action="import-project-file">'+label('chooseProjectFile','Choose a project file (.json)')+'</button>'+
        '<span class="asset-note">'+label('jsonImportHelp','Artwork and audio come across only if they were embedded in the file.')+'</span>'+
      '</div>';
    if(canFolder){
      body += '<div class="import-choice">'+
        '<button class="btn block" data-action="import-project-folder">'+label('chooseProjectFolder','Choose a project folder')+'</button>'+
        '<span class="asset-note">'+label('folderImportHelp','Reads project.json plus the whole Assets/ folder beside it, so images and sound arrive too.')+'</span>'+
      '</div>';
    } else {
      body += '<p class="asset-note">'+label('folderImportUnavailable','Folder import needs a desktop Chromium browser. A project ZIP works in this browser.')+'</p>';
    }
    DAL.modal(DAL.importText('importProject','Import Project'), body);
  };

  DAL.importProjectFolder = function(){
    if(typeof window.showDirectoryPicker !== 'function'){
      DAL.toast(DAL.importText('folderReadUnavailable','This browser cannot read folders.'), 'error');
      return;
    }
    window.showDirectoryPicker().then(function(dir){
      DAL.closeModal();
      DAL.toast(DAL.importText('readingProjectFolder','Reading project folder…'), 'info');
      return dir.getFileHandle('project.json').then(function(h){ return h.getFile(); })
        .then(function(file){ return file.text(); })
        .then(function(text){
          var data = JSON.parse(text);
          var proj = DAL.adoptImportedProject(data, true);
          return DAL.readAssetsFolder(dir, proj).then(function(count){
            return DAL.finishImportedProject(proj,count);
          });
        })
        .catch(function(e){
          DAL.toast(e && e.name === 'NotFoundError'
            ? DAL.importText('folderProjectMissing','That folder has no project.json in it.')
            : DAL.importText('folderImportFailed','Could not import that folder: '+(e&&e.message||'unknown error'),{reason:e&&e.message||'unknown error'}), 'error');
        });
    }).catch(function(error){if(!error||error.name!=='AbortError')DAL.toast(DAL.importText('folderOpenFailed','Could not open that folder: '+(error&&error.message||'unknown error'),{reason:error&&error.message||'unknown error'}),'error');});
  };

  /* Walks Assets/<Folder> and stores every file it recognises, rewriting the
     imported project's asset ids so bindings survive the move. */
  DAL.readAssetsFolder = function(dir, proj){
    return dir.getDirectoryHandle('Assets').then(function(assetsDir){
      var importedCount = 0;
      return DAL.ASSET_FOLDERS.reduce(function(chain, folder){
        return chain.then(function(){
          return assetsDir.getDirectoryHandle(folder.dir).then(function(sub){
            var files = [];
            /* for await is unavailable in this ES5 codebase, so the async
               iterator is drained by hand. */
            function drain(iter){
              return iter.next().then(function(step){
                if(step.done) return files;
                files.push(step.value[1]);
                return drain(iter);
              });
            }
            return drain(sub.entries()).then(function(handles){
              return handles.reduce(function(inner, handle){
                return inner.then(function(){
                  if(handle.kind !== 'file') return null;
                  return handle.getFile().then(function(file){
                    return DAL.remapImportedAsset(proj, file, folder.key).then(function(record){
                      if(!record) throw new Error('Could not import asset “'+file.name+'”.');
                      importedCount++;
                    });
                  });
                });
              }, Promise.resolve());
            });
          }).catch(function(error){if(error && error.name === 'NotFoundError')return;throw error;});
        });
      }, Promise.resolve()).then(function(){
        return importedCount;
      });
    }).catch(function(error){if(error && error.name === 'NotFoundError')return 0;throw error;});
  };

  /* An imported project references assets by the ids of the machine it came
     from. Matching by filename and rewriting every binding is what makes a
     shared project playable rather than silently mute. */
  DAL.remapImportedAsset = function(proj, file, folderKey){
    DAL.ensureAssets(proj);
    var existing = (proj.assets[folderKey] || []).filter(function(a){ return a.name === file.name; })[0];
    return DAL.importAssetFile(proj, file, folderKey).then(function(record){
      if(existing) DAL.rebindAsset(proj, existing.id, record.id);
      return record;
    }).catch(function(){ return null; });
  };

  DAL.rebindAsset = function(proj, oldId, newId){
    if(!oldId || oldId === newId) return;
    function swap(holder){
      if(!holder || !holder.audio) return;
      ['voice','ambient','sfx'].forEach(function(slot){ if(holder.audio[slot] === oldId) holder.audio[slot] = newId; });
    }
    (proj.chapters || []).forEach(function(ch){
      swap(ch);
      if(ch.imageAssetId === oldId) ch.imageAssetId = newId;
      (ch.images || []).forEach(function(img){if(img && img.assetId === oldId)img.assetId = newId;});
    });
    if(proj.adventure){
      (proj.adventure.nodes || []).forEach(function(node){
        swap(node);
        (node.images || []).forEach(function(img){ if(img.assetId === oldId) img.assetId = newId; });
      });
    }
    (proj.illustrations || []).forEach(function(ill){ if(ill.assetId === oldId) ill.assetId = newId; });
    /* Drop the stale placeholder record now that everything points at the real
       imported file. */
    DAL.ASSET_FOLDERS.forEach(function(f){
      proj.assets[f.key] = (proj.assets[f.key] || []).filter(function(a){ return a.id !== oldId; });
    });
  };

  /* Gives the incoming project a fresh id so importing twice, or importing a
     project that started life on this machine, never overwrites local work. */
  DAL.adoptImportedProject = function(data, staged){
    var importedBible=data&&data.linkedBible;
    var proj = data && data.project ? data.project : data;
    if(!proj||typeof proj!=='object'||Array.isArray(proj)||(!Array.isArray(proj.chapters)&&!(proj.adventure&&typeof proj.adventure==='object')&&['novel','rpg','dual'].indexOf(proj.type)<0))throw new Error(DAL.importText('invalidProjectFile','Choose a Draft A Lore project, not a workspace backup or unrelated JSON file.'));
    if(Number(proj.schemaVersion)>DAL.SCHEMA_VERSION||Number(data.schemaVersion)>DAL.SCHEMA_VERSION)throw new Error(DAL.importText('newerProjectFormat','This project uses a newer file format. Update Draft A Lore before importing it; the source file is unchanged.'));
    if(importedBible&&Number(importedBible.schemaVersion)>DAL.SCHEMA_VERSION)throw new Error(DAL.importText('newerBibleFormat','The linked world Bible uses a newer file format. Update Draft A Lore before importing it; the source file is unchanged.'));
    proj = DAL.normalizeProject(DAL.clone(proj), true);
    if(importedBible){
      var bible=DAL.normalizeBible(DAL.clone(importedBible)), bibleId=DAL.uid('bible');
      bible.id=bibleId; bible.name=bible.name+' (imported)'; bible.updatedAt=Date.now();
      Object.defineProperty(proj, '_importBible', {value:bible,configurable:true});
      proj.bibleId=bibleId;
    } else if(!DAL.state.bibles[proj.bibleId]) proj.bibleId='';
    var id = DAL.uid('proj');
    proj.id = id;
    proj.history = [];
    proj.redoStack = [];
    proj.historyIndex = -1;
    proj.folderHandle = undefined;
    delete proj.folderHandle;
    proj.linkedFolderName=null;
    if(!proj.name) proj.name = 'Imported Project';
    DAL.ensureAssets(proj);
    if(!staged)DAL.publishImportedProject(proj);
    return proj;
  };

  DAL.publishImportedProject = function(proj){
    if(DAL.state.projects[proj.id]){
      if(DAL.state.projects[proj.id]!==proj)throw new Error('The incoming project conflicts with a local project. Local work was not replaced.');
      return proj;
    }
    DAL.updateWordHistory();
    var words=DAL.getProjectWordCount(proj);
    DAL.state.wordBaseline.manuscript+=words.manuscript;
    DAL.state.wordBaseline.supplementary+=words.supplementary;
    DAL.state.projects[proj.id]=proj;
    if(DAL.state.projectOrder.indexOf(proj.id)<0)DAL.state.projectOrder.push(proj.id);
    if(proj._importBible){
      DAL.state.bibles[proj._importBible.id]=proj._importBible;
      if(DAL.state.bibleOrder.indexOf(proj._importBible.id)<0)DAL.state.bibleOrder.push(proj._importBible.id);
      delete proj._importBible;
    }
    return proj;
  };
  DAL.finishImportedProject = async function(proj,assetCount){
    var dialog=document.getElementById('modalBackdrop');
    await DAL.primeAssetUrls(proj);
    DAL.publishImportedProject(proj);
    var saved=false;
    try{saved=!!(await DAL.saveState(true));}catch(error){saved=false;}
    if(dialog&&document.getElementById('modalBackdrop')===dialog)DAL.closeModal();
    if(['dashboard','projects','library'].indexOf(DAL.currentView)>=0)DAL.render();
    if(saved)DAL.toast(typeof assetCount==='number'?DAL.importText('projectImportedAssets','Imported “'+proj.name+'” with '+assetCount+' asset'+(assetCount===1?'':'s'),{name:proj.name,count:assetCount}):DAL.importText('projectImported','Imported “'+proj.name+'”',{name:proj.name}),'success');
    else DAL.toast(DAL.importText('projectImportedMemory','Imported “'+proj.name+'” in memory only. Keep your source file and download a backup before closing.',{name:proj.name}),'warning');
    return proj;
  };
  DAL.importProjectJSON = async function(file){
    try{
      if(file.size>512*1024*1024)throw new Error(DAL.importText('jsonImportTooLarge','That JSON file exceeds the 512 MB import safety limit.'));
      var data=JSON.parse(await file.text());
      var proj=DAL.adoptImportedProject(data,true);
      var result=await DAL.finishImportedProject(proj);
      var external=DAL.allAssets(proj).filter(function(asset){return !asset.inline;});
      if(external.length)DAL.toast(DAL.importText('jsonExternalMedia','This JSON refers to '+external.length+' separately stored media file'+(external.length===1?'':'s')+'. Use the original project ZIP or folder to transfer all artwork and audio.',{count:external.length}),'warning');
      return result;
    }catch(error){DAL.toast(DAL.importText('projectFileImportFailed','Could not import that file: '+(error&&error.message||'unknown error'),{reason:error&&error.message||'unknown error'}),'error');return false;}
  };

  DAL.importProjectFile = function(){
    var input = document.getElementById('projectImportInput');
    if(!input){
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'projectImportInput';
      input.accept = 'application/json,.json';
      input.hidden = true;
      document.body.appendChild(input);
      input.addEventListener('change', function(){
        var file = input.files && input.files[0];
        input.value = '';
        if(!file) return;
        DAL.importProjectJSON(file);
      });
    }
    input.click();
  };

  DAL.registerActionHandler(function(action){
    if(action === 'import-project-folder'){ DAL.importProjectFolder(); return true; }
    if(action === 'import-project-file'){ DAL.importProjectFile(); return true; }
    return false;
  });

})();
