/* Project assets, audio playback and narration.

   Asset bytes never enter DAL.state. The state object is serialised whole into
   localStorage on every save, and a single minute of audio as a base64 data URL
   would exhaust that quota and break saving for the whole project. Bytes live in
   IndexedDB as blobs; state keeps only the small metadata record. */

(function(){

  var DB_NAME = 'draftALoreAssets';
  var DB_VERSION = 1;
  var STORE = 'blobs';

  var Store = DAL.blobStore = {};
  var dbPromise = null;

  Store.available = function(){ return typeof indexedDB !== 'undefined' && !!indexedDB; };

  Store.open = function(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise(function(resolve, reject){
      if(!Store.available()){ reject(new Error('This browser has no IndexedDB, so assets cannot be stored.')); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(){
        var db = req.result;
        if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error || new Error('Could not open the asset store.')); };
    });
    /* A failed open must not be cached forever — a later attempt may succeed once
       the user grants storage or closes a conflicting tab. */
    dbPromise.catch(function(){ dbPromise = null; });
    return dbPromise;
  };

  function tx(mode, run){
    return Store.open().then(function(db){
      return new Promise(function(resolve, reject){
        var t = db.transaction(STORE, mode);
        var out = run(t.objectStore(STORE));
        t.oncomplete = function(){ resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function(){ reject(t.error); };
        t.onabort = function(){ reject(t.error || new Error('Asset write was aborted, usually because storage is full.')); };
      });
    });
  }

  Store.put = function(id, blob, meta){
    var record = { id: id, blob: blob, mime: blob.type || (meta && meta.mime) || '', size: blob.size };
    if(meta){ record.name = meta.name; record.projectId = meta.projectId; }
    return tx('readwrite', function(s){ return s.put(record); }).then(function(){ return record; });
  };

  Store.get = function(id){ return tx('readonly', function(s){ return s.get(id); }); };
  Store.remove = function(id){ return tx('readwrite', function(s){ return s.delete(id); }); };
  Store.clear = function(){ return tx('readwrite', function(s){ return s.clear(); }); };
  Store.keys = function(){ return tx('readonly', function(s){ return s.getAllKeys(); }); };

  Store.usage = function(){
    return tx('readonly', function(s){ return s.getAll(); }).then(function(rows){
      var total = 0;
      (rows || []).forEach(function(r){ total += (r && r.size) || 0; });
      return { count: (rows || []).length, bytes: total };
    });
  };
  /* Rendering is synchronous, so a view cannot await a blob. Every asset a
     project owns is turned into an object URL once when the project opens, and
     the views read this cache. */
  DAL._assetUrls = {};

  DAL.blobUrl = function(assetId){ return DAL._assetUrls[assetId] || null; };

  DAL.primeAssetUrls = function(proj){
    if(!proj) return Promise.resolve();
    var assets = DAL.allAssets(proj).filter(function(a){ return !a.inline && !DAL._assetUrls[a.id]; });
    if(!assets.length) return Promise.resolve();
    return Promise.all(assets.map(function(a){
      return Store.get(a.id).then(function(rec){
        if(rec && rec.blob) DAL._assetUrls[a.id] = URL.createObjectURL(rec.blob);
      }).catch(function(){ /* a missing blob renders as a broken asset, not a crash */ });
    }));
  };

  DAL.releaseAssetUrl = function(assetId){
    var url = DAL._assetUrls[assetId];
    if(url){ URL.revokeObjectURL(url); delete DAL._assetUrls[assetId]; }
  };
  /* Folder names double as the on-disk layout under a linked project folder. */
  DAL.ASSET_FOLDERS = [
    { key:'illustrations', dir:'Illustrations', label:'Illustrations',
      hint:'Scene artwork and chapter images (PNG, JPG, WEBP, GIF).',
      accept:'image/png,image/jpeg,image/webp,image/gif,image/avif' },
    { key:'sounds', dir:'Sounds', label:'Sounds',
      hint:'Ambient beds, effects and voiceover clips (MP3, WAV, OGG, M4A).',
      accept:'audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/webm,audio/flac' },
    { key:'svgs', dir:'SVGs', label:'SVGs',
      hint:'Transparent vector art and icons that never clash with a background.',
      accept:'image/svg+xml' }
  ];

  DAL.assetFolder = function(key){
    for(var i=0;i<DAL.ASSET_FOLDERS.length;i++){ if(DAL.ASSET_FOLDERS[i].key === key) return DAL.ASSET_FOLDERS[i]; }
    return null;
  };

  DAL.ensureAssets = function(proj){
    if(!proj) return null;
    if(!proj.assets || typeof proj.assets !== 'object') proj.assets = {};
    DAL.ASSET_FOLDERS.forEach(function(f){
      if(!Array.isArray(proj.assets[f.key])) proj.assets[f.key] = [];
    });
    if(!proj.audio || typeof proj.audio !== 'object') proj.audio = {};
    var a = proj.audio;
    if(typeof a.ambientVolume !== 'number') a.ambientVolume = 0.4;
    if(typeof a.effectVolume !== 'number') a.effectVolume = 0.8;
    if(typeof a.voiceVolume !== 'number') a.voiceVolume = 1;
    if(typeof a.ttsEnabled !== 'boolean') a.ttsEnabled = true;
    if(typeof a.ttsRate !== 'number') a.ttsRate = 1;
    if(typeof a.ttsPitch !== 'number') a.ttsPitch = 1;
    if(typeof a.ttsVoice !== 'string') a.ttsVoice = '';
    if(typeof a.muted !== 'boolean') a.muted = false;
    return proj.assets;
  };

  DAL.allAssets = function(proj){
    if(!proj || !proj.assets) return [];
    var out = [];
    DAL.ASSET_FOLDERS.forEach(function(f){
      (proj.assets[f.key] || []).forEach(function(a){ out.push(a); });
    });
    return out;
  };

  DAL.assetById = function(proj, id){
    if(!id) return null;
    var all = DAL.allAssets(proj);
    for(var i=0;i<all.length;i++){ if(all[i].id === id) return all[i]; }
    return null;
  };

  DAL.assetSrc = function(proj, id){
    var asset = DAL.assetById(proj, id);
    if(!asset) return null;
    if(asset.inline) return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(asset.inline);
    return DAL.blobUrl(id);
  };

  /* Which folder a file belongs in, by MIME first and extension second, because
     drag-and-drop from some file managers supplies an empty type. */
  DAL.assetFolderForFile = function(file){
    var type = (file.type || '').toLowerCase();
    var ext = (file.name || '').toLowerCase().split('.').pop();
    if(type === 'image/svg+xml' || ext === 'svg') return 'svgs';
    if(type.indexOf('audio/') === 0) return 'sounds';
    if(type.indexOf('image/') === 0) return 'illustrations';
    if(['mp3','wav','ogg','oga','m4a','aac','flac','opus','weba'].indexOf(ext) >= 0) return 'sounds';
    if(['png','jpg','jpeg','webp','gif','avif','bmp'].indexOf(ext) >= 0) return 'illustrations';
    return null;
  };

  /* An SVG small enough to inline is kept as text: it stays searchable, survives
     export in one piece, and needs no object URL. */
  var INLINE_SVG_MAX = 64 * 1024;

  DAL.importAssetFile = function(proj, file, folderKey){
    DAL.ensureAssets(proj);
    var key = folderKey || DAL.assetFolderForFile(file);
    if(!key) return Promise.reject(new Error('“'+file.name+'” is not an image, vector or audio file.'));
    var folder = DAL.assetFolder(key);
    if(!folder) return Promise.reject(new Error('Unknown asset folder.'));

    var id = DAL.uid('asset');
    var record = {
      id: id, name: file.name, mime: file.type || '', size: file.size,
      folder: key, addedAt: Date.now()
    };

    if(key === 'svgs' && file.size <= INLINE_SVG_MAX){
      return file.text().then(function(text){
        record.inline = text;
        proj.assets.svgs.push(record);
        DAL.saveState();
        return record;
      });
    }

    return DAL.blobStore.put(id, file, { name: file.name, projectId: proj.id }).then(function(){
      return DAL.blobStore.get(id);
    }).then(function(rec){
      if(rec && rec.blob) DAL._assetUrls[id] = URL.createObjectURL(rec.blob);
      if(key === 'sounds'){
        return DAL.probeAudioDuration(DAL._assetUrls[id]).then(function(seconds){
          if(seconds) record.duration = seconds;
          return record;
        });
      }
      return record;
    }).then(function(){
      proj.assets[key].push(record);
      DAL.saveState();
      return record;
    });
  };

  DAL.probeAudioDuration = function(url){
    return new Promise(function(resolve){
      if(!url){ resolve(0); return; }
      var probe = document.createElement('audio');
      var done = false, timer;
      function finish(v){
        if(done) return; done = true;
        clearTimeout(timer);
        probe.onloadedmetadata = null; probe.onerror = null;
        try{probe.pause();probe.removeAttribute('src');probe.load();}catch(error){}
        resolve(v);
      }
      probe.preload = 'metadata';
      probe.onloadedmetadata = function(){ finish(isFinite(probe.duration) ? probe.duration : 0); };
      probe.onerror = function(){ finish(0); };
      timer = setTimeout(function(){ finish(0); }, 4000);
      try{probe.src = url;}catch(error){finish(0);}
    });
  };

  DAL.importAssetFiles = function(proj, files, folderKey){
    var list = Array.prototype.slice.call(files || []);
    if(!list.length) return Promise.resolve({ added:0, failed:[] });
    var added = 0, failed = [];
    return list.reduce(function(chain, file){
      return chain.then(function(){
        return DAL.importAssetFile(proj, file, folderKey)
          .then(function(){ added++; })
          .catch(function(e){ failed.push(file.name + ': ' + e.message); });
      });
    }, Promise.resolve()).then(function(){ return { added: added, failed: failed }; });
  };

  DAL.deleteAsset = function(proj, id){
    DAL.ensureAssets(proj);
    var asset = DAL.assetById(proj, id);
    if(!asset) return Promise.resolve(false);
    DAL.pushHistory();
    DAL.ASSET_FOLDERS.forEach(function(f){
      proj.assets[f.key] = (proj.assets[f.key] || []).filter(function(a){ return a.id !== id; });
    });
    DAL.unbindAssetEverywhere(proj, id);
    DAL.releaseAssetUrl(id);
    DAL.saveState();
    if(asset.inline) return Promise.resolve(true);
    return DAL.blobStore.remove(id).then(function(){ return true; }).catch(function(){ return true; });
  };

  /* A deleted asset must not leave a scene or chapter pointing at nothing, which
     would play silence with no explanation. */
  DAL.unbindAssetEverywhere = function(proj, id){
    function scrub(holder){
      if(!holder || !holder.audio) return;
      ['voice','ambient','sfx'].forEach(function(slot){ if(holder.audio[slot] === id) holder.audio[slot] = ''; });
    }
    (proj.chapters || []).forEach(function(ch){
      scrub(ch);
      ch.images = (ch.images || []).filter(function(img){ return img.assetId !== id; });
      if(ch.imageAssetId === id) ch.imageAssetId = '';
    });
    var adv = proj.adventure;
    if(adv){
      (adv.nodes || []).forEach(function(node){
        scrub(node);
        node.images = (node.images || []).filter(function(img){ return img.assetId !== id; });
      });
    }
    (proj.illustrations || []).forEach(function(ill){ if(ill.assetId === id) ill.assetId = ''; });
  };
  /* Separate channels let ambience, an arrival effect and narration coexist. */
  var Bus = DAL.audioBus = {
    ambient: null, effect: null, voice: null, ambientId: null, projectId: null
  };

  function volumes(){
    var proj = DAL.state.projects[Bus.projectId] || DAL.activeProject();
    if(!proj) return { ambient:0.4, effect:0.8, voice:1, muted:false };
    DAL.ensureAssets(proj);
    return { ambient: proj.audio.ambientVolume, effect:proj.audio.effectVolume, voice: proj.audio.voiceVolume, muted: proj.audio.muted };
  }

  Bus.attach = function(projectId){ Bus.projectId = projectId; };

  Bus.playAmbient = function(proj, assetId){
    var vol = volumes();
    if(!assetId){ Bus.stopAmbient(); return; }
    if(Bus.ambientId === assetId && Bus.ambient && !Bus.ambient.paused){
      Bus.ambient.volume = vol.muted ? 0 : vol.ambient;
      return;
    }
    var src = DAL.assetSrc(proj, assetId);
    if(!src) return;
    Bus.stopAmbient();
    var el = new Audio(src);
    el.loop = true;
    el.volume = vol.muted ? 0 : vol.ambient;
    Bus.ambient = el;
    Bus.ambientId = assetId;
    /* A later user interaction can retry if autoplay is blocked. */
    el.play().catch(function(){});
  };

  Bus.stopAmbient = function(){
    if(Bus.ambient){ try{ Bus.ambient.pause(); }catch(e){} Bus.ambient.src = ''; }
    Bus.ambient = null; Bus.ambientId = null;
  };

  Bus.playEffect = function(proj, assetId){
    if(!assetId){ Bus.stopEffect(); return Promise.resolve(false); }
    var src = DAL.assetSrc(proj, assetId);
    if(!src) return Promise.resolve(false);
    Bus.stopEffect();
    var vol = volumes();
    var el = new Audio(src);
    el.volume = vol.muted ? 0 : vol.effect;
    Bus.effect = el;
    el.onended = function(){ if(Bus.effect===el) Bus.effect=null; };
    return el.play().then(function(){ return true; }).catch(function(){ if(Bus.effect===el) Bus.effect=null; return false; });
  };

  Bus.stopEffect = function(){
    if(Bus.effect){ try{ Bus.effect.pause(); }catch(e){} Bus.effect.src=''; }
    Bus.effect=null;
  };

  Bus.playVoice = function(proj, assetId, onEnd){
    var src = DAL.assetSrc(proj, assetId);
    if(!src) return Promise.resolve(false);
    Bus.stopVoice();
    var vol = volumes();
    var el = new Audio(src);
    el.volume = vol.muted ? 0 : vol.voice;
    Bus.voice = el;
    el.onended = function(){ if(Bus.voice!==el)return;Bus.voice=null;el.onended=null;el.onerror=null;el.src='';if(onEnd)onEnd(); };
    el.onerror = function(){if(Bus.voice!==el)return;Bus._voiceSession=(Bus._voiceSession||0)+1;Bus.voice=null;el.onended=null;el.onerror=null;el.src='';if(DAL.toast)DAL.toast((DAL.i18n?DAL.i18n.text("ui_The_voiceover_clip_could_not_be_played_You_8b1bd16","The voiceover clip could not be played. Your manuscript is unchanged."):"The voiceover clip could not be played. Your manuscript is unchanged."),'warning');if(onEnd)onEnd('Voiceover playback failed');};
    return el.play().then(function(){ return true; }).catch(function(){ if(Bus.voice===el){Bus.voice=null;el.onended=null;el.onerror=null;el.src='';}return false; });
  };

  Bus.stopVoice = function(){
    Bus._voiceSession=(Bus._voiceSession||0)+1;
    if(Bus.voice){Bus.voice.onended=null;Bus.voice.onerror=null;try{ Bus.voice.pause(); }catch(e){} Bus.voice.src = ''; }
    Bus.voice = null;
    DAL.tts.stop();
  };

  Bus.applyVolumes = function(){
    var vol = volumes();
    if(Bus.ambient) Bus.ambient.volume = vol.muted ? 0 : vol.ambient;
    if(Bus.effect) Bus.effect.volume = vol.muted ? 0 : vol.effect;
    if(Bus.voice) Bus.voice.volume = vol.muted ? 0 : vol.voice;
    if(vol.muted) DAL.tts.stop();
  };

  Bus.stopAll = function(){ Bus.stopAmbient(); Bus.stopEffect(); Bus.stopVoice(); };
  /* A bound voice clip takes priority over text-to-speech. */
  var TTS = DAL.tts = { speaking: false };

  TTS.available = function(){ return typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined'; };

  TTS.voices = function(){
    if(!TTS.available()) return [];
    try{return window.speechSynthesis.getVoices() || [];}catch(error){return [];}
  };
  TTS.voiceLabel = function(voice){
    return voice.name+' ('+voice.lang+') — '+(voice.localService===true?'Installed':voice.localService===false?'May require internet':'Availability depends on device');
  };

  /* Voices arrive asynchronously in Chromium: the first call after load returns
     an empty list, so a view that renders a voice picker has to be told when the
     real list lands. */
  TTS.warm = function(){
    if(!TTS.available() || TTS._warmed) return;
    TTS._warmed = true;
    if(TTS.voices().length) return;
    window.speechSynthesis.onvoiceschanged = function(){
      if(DAL.currentTool === 'assets') DAL.render();
    };
  };

  TTS.pickVoice = function(name,language){
    var list = TTS.voices();
    for(var i=0;i<list.length;i++){ if(list[i].name === name) return list[i]; }
    if(name)return null;
    list=list.filter(function(voice){return voice.localService===true;});
    if(language){
      var normalized=String(language).toLowerCase().replace(/_/g,'-'),base=normalized.split('-')[0];
      var matches=list.filter(function(voice){return String(voice.lang||'').toLowerCase().replace(/_/g,'-')===normalized;});
      if(!matches.length)matches=list.filter(function(voice){return String(voice.lang||'').toLowerCase().split(/[-_]/)[0]===base;});
      if(matches.length)return matches.find(function(voice){return voice.localService;})||matches[0];
      return null;
    }
    for(var j=0;j<list.length;j++){ if(list[j].default) return list[j]; }
    return list[0] || null;
  };

  TTS.speak = function(text, proj, onEnd){
    if(!text) { if(onEnd) onEnd(); return false; }
    if(!TTS.available()){
      TTS.lastError='Narration is unavailable on this device. Attach a voiceover clip, or use a supported speech engine. Your manuscript is unchanged.';
      if(DAL.toast)DAL.toast(TTS.lastError,'warning');
      if(onEnd)onEnd(TTS.lastError);
      return false;
    }
    DAL.ensureAssets(proj);
    if(proj.audio.muted || !proj.audio.ttsEnabled){ if(onEnd) onEnd(); return false; }
    TTS.stop();
    TTS.lastError = '';
    var remaining = String(text), chunks = [];
    while(remaining.length){
      var end = Math.min(remaining.length, 1200);
      if(end < remaining.length){
        var boundary = remaining.lastIndexOf(' ', end);
        if(boundary > 600) end = boundary + 1;
        var last=remaining.charCodeAt(end-1),nextCode=remaining.charCodeAt(end);
        if(last>=0xD800&&last<=0xDBFF&&nextCode>=0xDC00&&nextCode<=0xDFFF)end--;
      }
      chunks.push(remaining.slice(0, end));
      remaining = remaining.slice(end);
    }
    var session = TTS._session, index = 0, settled = false;
    var voice = TTS.pickVoice(proj.audio.ttsVoice,proj.language);
    if(!voice){
      TTS.lastError=proj.audio.ttsVoice?'The selected narration voice is unavailable. Choose an available voice in Audio & narration.':'No installed voice matches this language. Choose an installed voice, or explicitly select a provider voice in Audio & narration before playback.';
      if(DAL.toast)DAL.toast(TTS.lastError,'warning');
      if(onEnd)onEnd(TTS.lastError);
      return false;
    }
    function finish(error){
      if(settled || session !== TTS._session) return;
      settled = true;
      TTS.speaking = false;
      if(error){TTS.lastError=error;if(DAL.toast)DAL.toast(error,'warning');}
      if(onEnd) onEnd(error);
    }
    function next(){
      if(settled || session !== TTS._session) return;
      if(index >= chunks.length){ finish(); return; }
      var utter, ended = false;
      try{utter = new SpeechSynthesisUtterance(chunks[index++]);}catch(error){finish('Narration could not initialize. Your manuscript is unchanged.');return;}
      if(voice) utter.voice = voice;
      utter.lang = (voice && voice.lang) || proj.language || '';
      utter.rate = Math.min(2, Math.max(0.5, proj.audio.ttsRate || 1));
      utter.pitch = Math.min(2, Math.max(0, Number.isFinite(proj.audio.ttsPitch) ? proj.audio.ttsPitch : 1));
      utter.volume = Math.min(1, Math.max(0, proj.audio.voiceVolume));
      utter.onend = function(){ if(ended) return; ended = true; next(); };
      utter.onerror = function(event){
        if(ended) return;ended = true;
        var code=event && event.error;
        finish(code==='not-allowed'?'Narration was blocked. Start playback again, or check device audio permissions.':code==='voice-unavailable'||code==='language-unavailable'?'The selected narration voice or language is unavailable. Choose an installed voice in Audio & narration.':'Narration stopped unexpectedly. Your manuscript is unchanged.');
      };
      try{ window.speechSynthesis.speak(utter); }catch(e){ finish('Narration could not start. Check your installed voices and audio settings.'); }
    }
    TTS.speaking = true;
    next();
    return true;
  };

  TTS.stop = function(){
    TTS._session = (TTS._session || 0) + 1;
    TTS.speaking = false;
    if(TTS.available()){ try{ window.speechSynthesis.cancel(); }catch(e){} }
  };
  TTS.pause = function(){
    if(!TTS.available() || !TTS.speaking) return false;
    try{ window.speechSynthesis.pause(); return true; }catch(e){ return false; }
  };
  TTS.resume = function(){
    if(!TTS.available() || !TTS.speaking) return false;
    try{ window.speechSynthesis.resume(); return true; }catch(e){ return false; }
  };
  if(DAL.installNativeNarration) DAL.installNativeNarration(TTS);
  /* One entry point for "present this scene": art, bed and narration together,
     so the playtester and the library reader behave identically. */
  DAL.presentScene = function(proj, holder, text, onEnd){
    DAL.ensureAssets(proj);
    Bus.attach(proj.id);
    var audio = (holder && holder.audio) || {};
    Bus.playAmbient(proj, audio.ambient);
    if(proj.audio.muted) return;
    Bus.playEffect(proj, audio.sfx);
    if(audio.voice){
      var playback=Bus.playVoice(proj, audio.voice, onEnd),voiceSession=Bus._voiceSession;
      playback.then(function(ok){
        if(!ok && voiceSession===Bus._voiceSession) TTS.speak(text, proj, onEnd);
      });
    } else if(proj.audio.ttsEnabled){
      Bus.stopVoice();
      TTS.speak(text, proj, onEnd);
    }
  };

  DAL.sceneNarrationText = function(holder, fallback){
    if(holder && holder.narration) return holder.narration;
    return fallback || '';
  };
  /* A blob: URL is scoped to the origin and session that made it, so an exported
     file carrying one shows nothing at all. Bytes are read back out of IndexedDB
     and inlined as data URLs at export time instead. */
  DAL.assetDataUrl = function(proj, id){
    var asset = DAL.assetById(proj, id);
    if(!asset) return Promise.resolve(null);
    if(asset.inline) return Promise.resolve('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(asset.inline));
    return DAL.blobStore.get(id).then(function(rec){
      if(!rec || !rec.blob) return null;
      return new Promise(function(resolve){
        var reader = new FileReader();
        reader.onload = function(){ resolve(reader.result); };
        reader.onerror = function(){ resolve(null); };
        reader.readAsDataURL(rec.blob);
      });
    }).catch(function(){ return null; });
  };

  /* Every asset id an export has to carry: scene and chapter art bound from the
     library, plus both audio channels on either. */
  DAL.exportAssetIds = function(proj){
    var ids = {};
    function take(v){ if(v) ids[v] = true; }
    function holder(h){
      if(!h) return;
      if(h.audio){ take(h.audio.ambient); take(h.audio.sfx); take(h.audio.voice); }
      (h.images || []).forEach(function(img){ take(img.assetId); });
      take(h.imageAssetId);
    }
    var adv = proj && proj.adventure;
    if(adv) (adv.nodes || []).forEach(holder);
    ((proj && proj.chapters) || []).forEach(holder);
    return Object.keys(ids);
  };

  /* Reads sequentially rather than all at once: a project with a hundred assets
     opening a hundred concurrent reads is how a mobile browser runs out of
     memory mid-export. Unreadable ids are reported, never quietly skipped. */
  DAL.collectExportAssets = function(proj){
    var ids = DAL.exportAssetIds(proj);
    var map = {}, missing = [], bytes = 0;
    return ids.reduce(function(chain, id){
      return chain.then(function(){
        return DAL.assetDataUrl(proj, id).then(function(url){
          if(url){ map[id] = url; bytes += url.length; }
          else missing.push((DAL.assetById(proj, id) || {}).name || id);
        });
      });
    }, Promise.resolve()).then(function(){
      return { assets: map, missing: missing, bytes: bytes };
    });
  };

  /* Whether an exported game needs its sound control at all. */
  DAL.exportHasAudio = function(proj, adv){
    var found = false;
    ((adv && adv.nodes) || []).forEach(function(n){
      if(n && n.audio && (n.audio.ambient || n.audio.sfx || n.audio.voice)) found = true;
    });
    return found;
  };
  /* The reader speaks whatever page is on screen. A chapter that has a voiceover
     clip bound plays the clip instead of the synthesised voice, which is the same
     rule scenes follow, so an author only has to learn it once. */
  DAL.readAloud = { speaking:false, paused:false, page:null };

  DAL.refreshReadAloudControls = function(){
    var stop = document.querySelector('[data-action="read-aloud"]');
    var pause = document.querySelector('[data-action="read-aloud-pause"]');
    if(stop) stop.textContent = DAL.readAloud.speaking ? '\u25a0 Stop reading' : DAL.READ_ALOUD_LABEL;
    if(pause){
      pause.hidden = !DAL.readAloud.speaking;
      pause.textContent = DAL.readAloud.paused ? '\u25b6 Resume' : '\u23f8 Pause';
    }
  };

  DAL.toggleReadAloudPause = async function(){
    if(!DAL.readAloud.speaking || DAL.readAloud.controlling) return false;
    var request=DAL.readAloud.request,paused=DAL.readAloud.paused;
    DAL.readAloud.controlling=true;
    try{
    if(Bus.voice){
      if(paused){
        var voice = Bus.voice;
        await Promise.resolve(voice.play());
        if(Bus.voice!==voice)return false;
      }else Bus.voice.pause();
    }else if(!(await Promise.resolve(paused ? TTS.resume() : TTS.pause()))) return false;
    if(request!==DAL.readAloud.request || !DAL.readAloud.speaking)return false;
    DAL.readAloud.paused = !paused;
    DAL.refreshReadAloudControls();
    return true;
    }catch(error){if(request===DAL.readAloud.request){DAL.stopReadAloud();DAL.toast((DAL.i18n?DAL.i18n.text("ui_Audio_could_not_resume_or_pause_Start_read_e8eff76","Audio could not resume or pause. Start reading again."):"Audio could not resume or pause. Start reading again."),'error');}return false;}
    finally{if(request===DAL.readAloud.request)DAL.readAloud.controlling=false;}
  };

  DAL.stopReadAloud = function(){
    DAL.readAloud.request=(DAL.readAloud.request||0)+1;
    DAL.readAloud.controlling=false;
    TTS.stop();
    Bus.stopVoice();
    Bus.stopAmbient();
    Bus.stopEffect();
    DAL.readAloud.speaking = false;
    DAL.readAloud.paused = false;
    DAL.readAloud.page = null;
    DAL.refreshReadAloudControls();
  };

  /* Page furniture — folios, cover controls, captions and controls — is not part
     of the story and would be jarring read out loud. */
  DAL.pageReadText = function(){
    var el = document.getElementById('bookPage');
    if(!el) return '';
    var copy = el.cloneNode(true);
    Array.prototype.forEach.call(
      copy.querySelectorAll('.book-page-num, .book-cover-controls, .chapter-illustration-caption, button, select, input, figcaption'),
      function(n){ if(n.parentNode) n.parentNode.removeChild(n); }
    );
    return (copy.textContent || '').replace(/\s+/g, ' ').trim();
  };

  DAL.startReadAloud = function(proj, holder){
    if(!proj) return false;
    DAL.ensureAssets(proj);
    var clip = holder && holder.audio && holder.audio.voice;
    if(proj.audio.muted){
      DAL.toast((DAL.i18n?DAL.i18n.text("ui_Audio_is_muted_for_this_project_Unmute_it__31c83af","Audio is muted for this project. Unmute it in Audio & narration."):"Audio is muted for this project. Unmute it in Audio & narration."), 'error');
      return false;
    }
    if(!clip && !proj.audio.ttsEnabled){
      DAL.toast((DAL.i18n?DAL.i18n.text("ui_Turn_on_narration_in_Audio_narration_or_bi_0282717","Turn on narration in Audio & narration, or bind a voiceover clip to this chapter."):"Turn on narration in Audio & narration, or bind a voiceover clip to this chapter."), 'error');
      return false;
    }
    if(!clip && !TTS.available()){
      DAL.toast((DAL.i18n?DAL.i18n.text("ui_This_browser_has_no_speech_voices_availabl_ba3fcb4","This browser has no speech voices available."):"This browser has no speech voices available."), 'error');
      return false;
    }
    var text = DAL.sceneNarrationText(holder, DAL.pageReadText());
    if(!clip && !text){
      DAL.toast((DAL.i18n?DAL.i18n.text("ui_There_is_nothing_on_this_page_to_read__5983269","There is nothing on this page to read."):"There is nothing on this page to read."), 'error');
      return false;
    }
    DAL.readAloud.speaking = true;
    var request=DAL.readAloud.request=(DAL.readAloud.request||0)+1;
    DAL.readAloud.controlling=false;
    DAL.readAloud.paused = false;
    DAL.readAloud.page = DAL.readerPage;
    /* The button label is corrected in place when the voice finishes rather than
       re-rendering, because a re-render would scroll the page back to the top. */
    function settle(){
      if(request!==DAL.readAloud.request)return;
      DAL.readAloud.speaking = false;
      DAL.readAloud.paused = false;
      DAL.refreshReadAloudControls();
    }
    if(holder) DAL.presentScene(proj, holder, text, settle);
    else TTS.speak(text, proj, settle);
    DAL.refreshReadAloudControls();
    return true;
  };

  DAL.READ_ALOUD_LABEL = '\u25b6 Read aloud';

  /* One label helper so the two readers cannot disagree about the button. */
  DAL.readAloudButton = function(){
    return '<button class="btn sm" data-action="read-aloud" title="Read this page aloud">' +
      (DAL.readAloud.speaking ? '\u25a0 Stop reading' : DAL.READ_ALOUD_LABEL) + '</button>' +
      '<button class="btn sm" data-action="read-aloud-pause"'+(DAL.readAloud.speaking ? '' : ' hidden')+'>' +
      (DAL.readAloud.paused ? '\u25b6 Resume' : '\u23f8 Pause') + '</button>';
  };

})();
