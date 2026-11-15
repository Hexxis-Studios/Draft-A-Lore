DAL = DAL || {};
(function(){
  var WEB_CLIENT='886807251567-mpugqlj0god0asguvq69kicf0pbm0u53.apps.googleusercontent.com';
  var desktop=null,loading=null;
  if(window.location&&window.location.protocol==='file:'){
    var match=/^#dal-desktop=(\d{1,5})\.([A-Za-z0-9_-]{43})$/.exec(window.location.hash||'');
    if(match&&Number(match[1])>0&&Number(match[1])<=65535){
      try{window.history.replaceState(null,'',window.location.href.split('#')[0]);desktop={port:Number(match[1]),capability:match[2]};}catch(error){}
    }
  }
  function nativePlugin(){
    var capacitor=window.Capacitor;
    if(!capacitor||typeof capacitor.isNativePlatform!=='function'||!capacitor.isNativePlatform()||capacitor.getPlatform()!=='android')return null;
    return capacitor.Plugins&&capacitor.Plugins.GoogleBackup||(typeof capacitor.registerPlugin==='function'?capacitor.registerPlugin('GoogleBackup'):null);
  }
  DAL.googleBackupPlatform=function(){
    if(nativePlugin())return 'android';
    if(desktop)return 'desktop';
    var origin=window.location&&window.location.origin;
    return ['https://hexxis-studios.github.io','http://127.0.0.1:8766','http://localhost:8766'].indexOf(origin)>=0?'web':'unsupported';
  };
  DAL.prepareGoogleBackup=function(){
    if(DAL.googleBackupPlatform()!=='web')return Promise.resolve(true);
    if(window.google&&window.google.accounts&&window.google.accounts.oauth2)return Promise.resolve(true);
    if(loading)return loading;
    loading=new Promise(function(resolve,reject){
      var script=document.createElement('script'),settled=false;
      var timer=setTimeout(function(){finish(new Error('Google sign-in did not load. Check your connection; local backups still work.'));},20000);
      function finish(error){
        if(settled)return;settled=true;clearTimeout(timer);script.onload=null;script.onerror=null;
        if(error){script.remove();reject(error);}else resolve(true);
      }
      script.src='https://accounts.google.com/gsi/client';script.async=true;script.referrerPolicy='no-referrer';
      script.onload=function(){finish(window.google&&window.google.accounts&&window.google.accounts.oauth2?null:new Error('Google sign-in is unavailable.'));};
      script.onerror=function(){finish(new Error('Google sign-in could not load. Local backups still work.'));};
      document.head.appendChild(script);
    }).finally(function(){loading=null;});
    return loading;
  };
  function desktopPlugin(){
    var controller=null,random=new Uint8Array(16);window.crypto.getRandomValues(random);
    var attemptId=Array.from(random).map(function(byte){return byte.toString(16).padStart(2,'0');}).join('');
    function request(path,method,signal){
      return window.fetch('http://127.0.0.1:'+desktop.port+path,{method:method||'GET',headers:{Authorization:'Bearer '+desktop.capability,'X-DraftALore-Attempt':attemptId},credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:signal})
        .then(function(response){if(!response.ok)throw new Error('The desktop backup helper is unavailable. Reopen the app through DraftALore.exe; your projects are unchanged.');return response.json();});
    }
    return {
      connect:async function(){
        controller=new AbortController();var signal=controller.signal;
        var started=await request('/connect','POST',signal);
        if(started.error)throw new Error(started.error);
        if(!started.pending)throw new Error('The desktop backup helper did not start Google sign-in.');
        for(var attempt=0;attempt<180;attempt++){
          await new Promise(function(resolve,reject){
            if(signal.aborted){reject(new Error('Google connection was cancelled.'));return;}
            var timer=setTimeout(function(){signal.removeEventListener('abort',cancel);resolve();},1000);
            function cancel(){clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(new Error('Google connection was cancelled.'));}
            signal.addEventListener('abort',cancel,{once:true});
          });
          var result=await request('/result','GET',signal);
          if(result.error)throw new Error(result.error);
          if(result.accessToken)return result;
          if(!result.pending)throw new Error('Google authorization did not complete. Your local projects are unchanged.');
        }
        throw new Error('Google sign-in timed out. No files were uploaded.');
      },
      disconnect:async function(){
        if(controller)controller.abort();controller=null;
        var cancelled=new AbortController(),timer=setTimeout(function(){cancelled.abort();},3000);
        try{await request('/disconnect','POST',cancelled.signal);}finally{clearTimeout(timer);}
      }
    };
  }
  DAL.connectGoogleBackup=function(client){
    var platform=DAL.googleBackupPlatform();
    if(platform==='android')return client.connectNative(nativePlugin());
    if(platform==='desktop')return client.connectNative(desktopPlugin());
    if(platform==='web')return client.connect(WEB_CLIENT);
    return Promise.reject(new Error('Google sign-in cannot run from a standalone HTML file or an unregistered website. Use the Windows launcher, Android app, or official hosted web app. Local project ZIP files work here without an account.'));
  };
})();
