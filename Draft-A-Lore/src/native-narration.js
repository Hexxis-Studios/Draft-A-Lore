(function(){
  DAL.installNativeNarration=function(tts){
    var capacitor=window.Capacitor;
    if(!capacitor||!capacitor.isNativePlatform()||capacitor.getPlatform()!=='android')return false;
    var plugin=capacitor.Plugins&&capacitor.Plugins.Narration;
    if(!plugin&&typeof capacitor.registerPlugin==='function')plugin=capacitor.registerPlugin('Narration');
    if(!plugin)return false;
    var native=DAL.createNativeNarrator(plugin,function(message){if(DAL.toast)DAL.toast(message,'warning');});
    tts.native=true;tts.loading=false;
    ['speaking','paused','lastError'].forEach(function(key){Object.defineProperty(tts,key,{configurable:true,get:function(){return native[key];}});});
    tts.available=function(){return (!native.ready&&!native.lastError)||native.available();};
    tts.voices=native.voices;
    tts.retry=function(){tts._warmed=false;tts.warm();};
    tts.warm=function(){
      if(tts.loading||tts._warmed)return;
      tts.loading=true;tts._warmed=true;
      native.refresh().finally(function(){tts.loading=false;if(DAL.currentTool==='assets')DAL.render();});
    };
    tts.speak=function(text,proj,onEnd){DAL.ensureAssets(proj);return native.speak(text,proj,onEnd);};
    tts.stop=native.stop;tts.pause=native.pause;tts.resume=native.resume;
    return true;
  };
  DAL.createNativeNarrator=function(plugin,warn){
    var generation=0,refreshing=null,stopping=Promise.resolve(true),voiceList=[];
    var narrator={speaking:false,paused:false,lastError:'',ready:false,canPause:false};
    var controlling=false;
    function failure(message){narrator.lastError=message;if(warn)warn(message);}
    narrator.available=function(){return narrator.ready&&voiceList.length>0;};
    narrator.voices=function(){return voiceList.slice();};
    narrator.refresh=function(){
      if(refreshing)return refreshing;
      refreshing=Promise.resolve().then(function(){return plugin.capabilities();}).then(function(result){
        if(!result || typeof result!=='object')throw new Error('Android returned invalid narration capabilities.');
        voiceList=(Array.isArray(result.voices)?result.voices:[]).filter(function(voice){return voice&&typeof voice.name==='string'&&typeof voice.lang==='string'&&typeof voice.localService==='boolean';}).map(function(voice){return {name:voice.name,lang:voice.lang,localService:voice.localService};});
        voiceList.sort(function(a,b){return (a.lang+' '+a.name).localeCompare(b.lang+' '+b.name);});
        narrator.ready=true;narrator.canPause=result.pause===true;
        narrator.lastError=voiceList.length?'':'No Android narration voices are installed. Install a voice in device speech settings.';
        return narrator.available();
      }).catch(function(error){narrator.ready=false;voiceList=[];narrator.lastError=error.message||'Android narration is unavailable.';return false;}).finally(function(){refreshing=null;});
      return refreshing;
    };
    narrator.stop=function(){
      generation++;narrator.speaking=false;narrator.paused=false;controlling=false;
      stopping=Promise.resolve().then(function(){return plugin.stop();}).then(function(){return true;},function(error){failure(error.message||'Android narration could not stop.');return false;});
      return stopping;
    };
    async function control(action){
      if(!narrator.speaking||!narrator.canPause||controlling)return false;
      if((action==='pause')===narrator.paused)return false;
      var token=generation;controlling=true;
      try{
        await plugin[action]();
        if(token!==generation||!narrator.speaking)return false;
        narrator.paused=action==='pause';return true;
      }catch(error){if(token===generation)failure(error.message||'Android narration could not '+action+'.');return false;}
      finally{if(token===generation)controlling=false;}
    }
    narrator.pause=function(){return control('pause');};
    narrator.resume=function(){return control('resume');};
    narrator.speak=function(text,proj,onEnd){
      if(!text){if(onEnd)onEnd();return false;}
      var audio=proj.audio||{};
      if(audio.muted||audio.ttsEnabled===false){if(onEnd)onEnd();return false;}
      narrator.stop();
      var token=generation,settings={voice:audio.ttsVoice||'',language:proj.language||'',rate:audio.ttsRate||1,pitch:Number.isFinite(audio.ttsPitch)?audio.ttsPitch:1,volume:Number.isFinite(audio.voiceVolume)?audio.voiceVolume:1};
      var remaining=String(text),chunks=[];
      while(remaining.length){
        var end=Math.min(1200,remaining.length);
        if(end<remaining.length){
          var boundary=remaining.lastIndexOf(' ',end);
          if(boundary>600)end=boundary+1;
          var last=remaining.charCodeAt(end-1),next=remaining.charCodeAt(end);
          if(last>=0xD800&&last<=0xDBFF&&next>=0xDC00&&next<=0xDFFF)end--;
        }
        chunks.push(remaining.slice(0,end));remaining=remaining.slice(end);
      }
      narrator.speaking=true;narrator.lastError='';
      (async function(){
        try{
          if(await stopping!==true)throw new Error(narrator.lastError||'Previous narration could not stop.');
          if(token!==generation)return;
          if(!narrator.ready)await narrator.refresh();
          if(token!==generation)return;
          if(!narrator.available())throw new Error(narrator.lastError||'Android narration is unavailable.');
          var selected=settings.voice?voiceList.find(function(voice){return voice.name===settings.voice;}):null;
          if(settings.voice&&!selected)throw new Error('The selected voice is not installed on this device. Choose an available narration voice.');
          settings.online=!!(selected&&selected.localService===false);
          for(var i=0;i<chunks.length;i++){
            if(token!==generation)return;
            await plugin.speak(Object.assign({text:chunks[i]},settings));
          }
          if(token!==generation)return;
          narrator.speaking=false;narrator.paused=false;if(onEnd)onEnd();
        }catch(error){
          if(token!==generation)return;
          narrator.speaking=false;narrator.paused=false;failure(error.message||'Android narration stopped unexpectedly.');if(onEnd)onEnd(narrator.lastError);
        }
      })();
      return true;
    };
    return narrator;
  };
})();
