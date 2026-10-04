(function(){
  DAL.deviceLanguages=async function(){
    var fallback=navigator.languages&&navigator.languages.length?Array.from(navigator.languages):[navigator.language||'en'];
    var capacitor=window.Capacitor;
    if(!capacitor||!capacitor.getPlatform||capacitor.getPlatform()!=='android')return fallback;
    var timer;
    try{
      var result=await Promise.race([
        Promise.resolve().then(function(){
          var plugin=capacitor.Plugins&&capacitor.Plugins.DeviceLocale;
          if(!plugin&&typeof capacitor.registerPlugin==='function')plugin=capacitor.registerPlugin('DeviceLocale');
          if(!plugin)throw new Error('Android device language service is unavailable.');
          return plugin.languages();
        }),
        new Promise(function(resolve){timer=setTimeout(function(){resolve(null);},1500);})
      ]);
      var languages=result&&Array.isArray(result.languages)?result.languages.filter(function(value){return typeof value==='string'&&value.length>0;}):[];
      return languages.length?languages:fallback;
    }catch(error){return fallback;}finally{if(timer)clearTimeout(timer);}
  };
  var catalog=DAL_LOCALE_CATALOG,english=JSON.parse(DAL_LOCALE_BUNDLES.en);
  DAL.createLocalization=function(engine,ICU,environment){
    var api={locale:'en',targets:Object.keys(catalog).map(function(code){return {code:code,name:catalog[code].name,released:catalog[code].released===true};})};
    var released=api.targets.filter(function(item){return item.released;}).map(function(item){return item.code;}),changes=Promise.resolve(),formats=new Map(),loaded=new Set(['en']);
    function load(code){if(loaded.has(code))return;engine.addResourceBundle(code,'translation',JSON.parse(DAL_LOCALE_BUNDLES[code]),true,true);loaded.add(code);}
    function formatter(kind,options){
      var key=api.locale+'|'+kind+'|'+JSON.stringify(options||{});
      if(!formats.has(key)){if(formats.size>=32)formats.clear();formats.set(key,new Intl[kind](api.locale,options));}
      return formats.get(key);
    }
    function normalize(value){try{return Intl.getCanonicalLocales(String(value||'').replace(/_/g,'-'))[0]||'';}catch(error){return '';}}
    api.resolve=function(preferences,supported){
      var locales=supported||released;
      for(var value of preferences||[]){
        var code=normalize(value),exact=locales.find(function(item){return item.toLowerCase()===code.toLowerCase();});
        if(exact)return exact;
        var base=code.split('-')[0],match=locales.find(function(item){return item===base;});
        if(match)return match;
        if(code&&Intl.Locale){
          var requested=new Intl.Locale(code).maximize();
          var scriptMatch=locales.find(function(item){
            var candidate=new Intl.Locale(item);
            return candidate.language===requested.language&&candidate.script&&candidate.script===requested.script;
          });
          if(scriptMatch)return scriptMatch;
        }
      }
      return 'en';
    };
    api.initialize=async function(override){
      var preferences;
      try{preferences=override&&override!=='system'?[override]:await environment.languages();}catch(error){preferences=['en'];}
      api.locale=api.resolve(preferences);
      api.lastError=null;
      try{
        await engine.use(new ICU()).init({lng:'en',fallbackLng:'en',supportedLngs:released,initAsync:false,initImmediate:false,returnNull:false,returnEmptyString:false,saveMissing:false,resources:{en:{translation:english}}});
        load(api.locale);await engine.changeLanguage(api.locale);
      }catch(error){api.lastError=error;api.locale='en';}
      environment.apply(api.locale,api.lastError?'ltr':engine.dir(api.locale));return api.locale;
    };
    api.change=function(override){
      var pending=changes.catch(function(){}).then(async function(){
        if(api.lastError){await api.initialize(override);if(api.lastError)throw api.lastError;return api.locale;}
        var code=api.resolve(override&&override!=='system'?[override]:await environment.languages());
        load(code);await engine.changeLanguage(code);api.locale=code;environment.apply(code,engine.dir(code));return code;
      });
      changes=pending;return pending;
    };
    api.text=function(key,fallback,values){
      if(api.lastError)return fallback||english[key]||'Translation unavailable';
      var result=engine.t(key,Object.assign({},values,{defaultValue:fallback||english[key]||'Translation unavailable'}));
      return typeof result==='string'&&result.trim()&&result!==key?result:(fallback||english[key]||'Translation unavailable');
    };
    api.number=function(value,options){return formatter('NumberFormat',options).format(value);};
    api.date=function(value,options){return formatter('DateTimeFormat',options).format(new Date(value));};
    api.relative=function(value,unit){return formatter('RelativeTimeFormat',{numeric:'auto'}).format(value,unit);};
    return api;
  };
  DAL.i18n=DAL.createLocalization(i18next.createInstance(),i18nextICU,{
    languages:DAL.deviceLanguages,
    apply:function(locale,direction){document.documentElement.lang=locale;document.documentElement.dir=direction;}
  });
  DAL.registerAfterRender(function(){
    DAL.syncMainNavigation();
  });
  var preferenceGeneration=0;
  document.addEventListener('change',function(event){
    if(!event.target.hasAttribute('data-interface-language'))return;
    var override=event.target.value;
    if(override!=='system'&&!DAL.i18n.targets.some(function(item){return item.released&&item.code===override;}))return;
    var request=++preferenceGeneration;
    DAL.i18n.change(override).then(function(){
      if(request!==preferenceGeneration)return;
      DAL.state.interfaceLanguage=override;
      return Promise.resolve().then(function(){return DAL.saveState(true);}).catch(function(){return false;});
    }).then(function(saved){
      if(request!==preferenceGeneration)return;
      if(!saved&&DAL.toast)DAL.toast((DAL.i18n?DAL.i18n.text("ui_Language_changed_for_this_session_but_the__4a90d44","Language changed for this session, but the preference could not be saved."):"Language changed for this session, but the preference could not be saved."),'warning');
      DAL.render();
      var picker=document.getElementById('interfaceLanguage');if(picker)picker.focus();
    }).catch(function(){if(request===preferenceGeneration&&DAL.toast)DAL.toast((DAL.i18n?DAL.i18n.text("ui_The_interface_language_could_not_be_change_6b9de87","The interface language could not be changed. Your writing is unchanged."):"The interface language could not be changed. Your writing is unchanged."),'warning');});
  });
})();
