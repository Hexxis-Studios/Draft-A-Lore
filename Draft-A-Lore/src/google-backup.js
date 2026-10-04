DAL = DAL || {};
(function(){
  var API='https://www.googleapis.com/drive/v3/files',MAX_BYTES=512*1024*1024;
  DAL.GoogleBackupClient=function(fetcher){
    this.fetcher=fetcher||window.fetch.bind(window);
    this.token='';this.expiresAt=0;this.controllers=[];this.generation=0;this.cancelConnection=null;
  };
  DAL.GoogleBackupClient.prototype.authorize=function(token,lifetime){
    this.disconnect();
    if(typeof token!=='string'||!token||token.length>16384||/\s/.test(token))throw new Error('Google authorization did not return a valid token.');
    if(!Number.isFinite(Number(lifetime))||Number(lifetime)<=15)throw new Error('Google returned an expired authorization. Try connecting again.');
    this.token=token;this.expiresAt=Date.now()+Math.min(3600,Number(lifetime))*1000;
  };
  DAL.GoogleBackupClient.prototype.disconnect=function(){
    this.generation++;
    if(this.cancelConnection){var cancel=this.cancelConnection;this.cancelConnection=null;cancel();}
    this.token='';this.expiresAt=0;
    this.controllers.forEach(function(controller){controller.abort();});this.controllers=[];
  };
  DAL.GoogleBackupClient.prototype.connectNative=function(plugin){
    this.disconnect();
    if(!plugin||typeof plugin.connect!=='function'||typeof plugin.disconnect!=='function')return Promise.reject(new Error('Google backup is unavailable in this Android installation. Local backups still work.'));
    var self=this,generation=this.generation,scope='https://www.googleapis.com/auth/drive.appdata';
    return new Promise(function(resolve,reject){
      var settled=false,timer=setTimeout(function(){cancel('Google sign-in timed out. No files were uploaded.');},180000);
      function finish(error,response){
        if(settled)return;settled=true;clearTimeout(timer);self.cancelConnection=null;
        if(error){reject(error);return;}
        if(generation!==self.generation){reject(new Error('Google connection was cancelled.'));return;}
        try{
          if(!response||response.scope!==scope)throw new Error('Google did not grant private backup access. Your local projects are unchanged.');
          self.authorize(response.accessToken,response.expiresIn);
          self.cancelConnection=function(){Promise.resolve().then(function(){return plugin.disconnect();}).catch(function(){});};
          resolve(true);
        }catch(error){Promise.resolve().then(function(){return plugin.disconnect();}).catch(function(){});reject(error);}
      }
      function cancel(message){
        if(settled)return;
        Promise.resolve().then(function(){return plugin.disconnect();}).catch(function(){});
        finish(new Error(message||'Google connection was cancelled.'));
      }
      self.cancelConnection=cancel;
      Promise.resolve().then(function(){
        if(settled)return null;
        return plugin.connect();
      }).then(function(response){finish(null,response);},function(){
        if(settled||generation!==self.generation)return;
        Promise.resolve().then(function(){return plugin.disconnect();}).catch(function(){});
        finish(new Error('Google backup access was cancelled or could not connect. Your local projects are unchanged.'));
      });
    });
  };
  DAL.GoogleBackupClient.prototype.connect=function(clientId,provider){
    this.disconnect();
    provider=provider||(window.google&&window.google.accounts&&window.google.accounts.oauth2);
    if(typeof clientId!=='string'||!/^[-\w]+\.apps\.googleusercontent\.com$/.test(clientId))return Promise.reject(new Error('Google backup has not been configured for this app.'));
    if(!provider||!provider.initTokenClient||!provider.hasGrantedAllScopes)return Promise.reject(new Error('Google sign-in is unavailable. Check your connection and try again.'));
    var self=this,token=this.generation,scope='https://www.googleapis.com/auth/drive.appdata';
    return new Promise(function(resolve,reject){
      var settled=false;
      function finish(error,response){
        if(settled)return;settled=true;clearTimeout(timer);self.cancelConnection=null;
        if(error){reject(error);return;}
        if(token!==self.generation){reject(new Error('Google connection was cancelled.'));return;}
        if(!response||response.error||!response.access_token||!provider.hasGrantedAllScopes(response,scope)){
          reject(new Error('Google backup access was not granted. Your local projects are unchanged.'));return;
        }
        if(!Number.isFinite(Number(response.expires_in))||Number(response.expires_in)<=15){reject(new Error('Google returned an expired authorization. Try connecting again.'));return;}
        self.authorize(response.access_token,Number(response.expires_in));resolve(true);
      }
      var timer=setTimeout(function(){finish(new Error('Google sign-in timed out. You can try again; no files were uploaded.'));},90000);
      self.cancelConnection=function(){finish(new Error('Google connection was cancelled.'));};
      try{
        var client=provider.initTokenClient({client_id:clientId,scope:scope,include_granted_scopes:false,
          callback:function(response){finish(null,response);},
          error_callback:function(){finish(new Error('Google sign-in was closed or could not open. Try connecting again.'));}
        });
        client.requestAccessToken({prompt:'select_account'});
      }catch(error){finish(new Error('Google sign-in could not start. Your local projects are unchanged.'));}
    });
  };
  DAL.GoogleBackupClient.prototype.request=async function(url,options,allowIncomplete,consume){
    if(!this.token||Date.now()>=this.expiresAt-15000)throw new Error('Reconnect to Google before continuing.');
    var parsed=new URL(url);
    if(parsed.origin!=='https://www.googleapis.com'||parsed.username||parsed.password||parsed.hash||!/^\/(?:upload\/)?drive\/v3\/files(?:\/|$)/.test(parsed.pathname))throw new Error('Google returned an unsafe backup address.');
    var controller=new AbortController(),self=this,generation=this.generation;
    this.controllers.push(controller);
    var timer=setTimeout(function(){controller.abort();},120000);
    options=Object.assign({},options||{});
    options.headers=Object.assign({},options.headers||{},{Authorization:'Bearer '+this.token});
    options.signal=controller.signal;options.redirect='error';
    try{
      var response=await this.fetcher(url,options);
      if(controller.signal.aborted||generation!==this.generation)throw new Error('Google backup was cancelled. Your local project is unchanged.');
      if(response.status===401){this.disconnect();throw new Error('Google authorization expired. Reconnect and try again.');}
      if(response.status===403)throw new Error('Google denied this backup request. Check granted access and available Drive storage.');
      if(response.status===429||response.status>=500)throw new Error('Google is temporarily unavailable. Your local project is unchanged; try again later.');
      if(!response.ok&&!(allowIncomplete&&response.status===308))throw new Error('Google backup request failed ('+response.status+'). Your local project is unchanged.');
      var result=consume?await consume(response):response;
      if(controller.signal.aborted||generation!==this.generation)throw new Error('Google backup was cancelled. Your local project is unchanged.');
      return result;
    }catch(error){
      if(error.name==='AbortError')throw new Error('Google backup was cancelled or timed out. Your local project is unchanged.');
      throw error;
    }finally{
      clearTimeout(timer);self.controllers=self.controllers.filter(function(item){return item!==controller;});
    }
  };
  DAL.GoogleBackupClient.prototype.list=async function(){
    var files=[],page='',seen=Object.create(null),pages=0;
    do{
      if(++pages>50)throw new Error('The backup list exceeds the 5,000-file safety limit. Your local projects are unchanged.');
      var query=new URLSearchParams({spaces:'appDataFolder',pageSize:'100',orderBy:'createdTime desc',q:"trashed = false and appProperties has { key='draftalore' and value='bundle-v1' }",fields:'nextPageToken,files(id,name,size,createdTime,appProperties)'});
      if(page)query.set('pageToken',page);
      var data=await this.request(API+'?'+query,null,false,function(response){return response.json();});
      if(!data||!Array.isArray(data.files)||data.files.length>100||(data.nextPageToken!=null&&(typeof data.nextPageToken!=='string'||data.nextPageToken.length>4096)))throw new Error('Google returned an invalid backup list.');
      files=files.concat(data.files);page=data.nextPageToken||'';
      if(page&&seen[page])throw new Error('Google returned a repeated backup page.');
      if(page)seen[page]=true;
    }while(page);
    return files;
  };
  DAL.GoogleBackupClient.prototype.upload=async function(name,blob,projectId){
    if(!(blob instanceof Blob)||!blob.size||blob.size>MAX_BYTES)throw new Error('Backup must be between 1 byte and 512 MB.');
    var metadata={name:String(name||'Project').slice(0,150)+'.dalz',mimeType:'application/zip',parents:['appDataFolder'],appProperties:{draftalore:'bundle-v1',projectId:String(projectId||'').slice(0,120)}};
    var opened=await this.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,createdTime,appProperties',{
      method:'POST',headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'application/zip','X-Upload-Content-Length':String(blob.size)},body:JSON.stringify(metadata)
    });
    var location=opened.headers.get('Location');
    if(!location)throw new Error('Google did not start the backup upload.');
    var offset=0,chunkSize=4*1024*1024;
    while(offset<blob.size){
      var end=Math.min(offset+chunkSize,blob.size);
      var uploaded=await this.request(location,{method:'PUT',headers:{'Content-Type':'application/zip','Content-Range':'bytes '+offset+'-'+(end-1)+'/'+blob.size},body:blob.slice(offset,end)},true,async function(response){
        return {status:response.status,range:response.headers.get('Range'),result:response.status===308?null:await response.json()};
      });
      if(uploaded.status===308){
        var match=/^bytes=0-(\d+)$/.exec(uploaded.range||'');
        var next=match?Number(match[1])+1:0;
        if(next<=offset||next>end)throw new Error('Google did not acknowledge the backup bytes correctly. No completed backup was confirmed.');
        offset=next;
      }else{
        if(end!==blob.size)throw new Error('Google ended the upload before all backup bytes were sent.');
        var result=uploaded.result;
        if(!result||typeof result.id!=='string'||!/^[-\w]{1,200}$/.test(result.id))throw new Error('Google did not confirm the backup. Refresh the backup list before trying again.');
        if(result.size!=null&&Number(result.size)!==blob.size)throw new Error('Google reported a different backup size. No complete backup was confirmed.');
        return result;
      }
    }
    throw new Error('Google has not confirmed the completed backup. Refresh the backup list before trying again.');
  };
  DAL.GoogleBackupClient.prototype.download=async function(id){
    if(typeof id!=='string'||!/^[-\w]+$/.test(id))throw new Error('Invalid backup identifier.');
    var metadata=await this.request(API+'/'+id+'?fields=id,name,size,mimeType,appProperties',null,false,function(response){return response.json();});
    if(!metadata||!metadata.appProperties||metadata.appProperties.draftalore!=='bundle-v1'||metadata.mimeType!=='application/zip')throw new Error('This file is not a Draft A Lore backup.');
    var expected=Number(metadata.size);
    if(!Number.isSafeInteger(expected)||expected<=0||expected>MAX_BYTES)throw new Error('This backup exceeds the supported size or is empty.');
    var blob=await this.request(API+'/'+id+'?alt=media',null,false,async function(response){
      if(!response.body||!response.body.getReader)throw new Error('This browser cannot safely download cloud backups. Use a local project bundle instead.');
      var reader=response.body.getReader(),parts=[],total=0,complete=false;
      try{
        while(true){
          var chunk=await reader.read();
          if(chunk.done){complete=true;break;}
          total+=chunk.value.byteLength;
          if(total>expected||total>MAX_BYTES)throw new Error('The backup download is larger than its declared size. Nothing was imported.');
          parts.push(chunk.value);
        }
        return new Blob(parts,{type:'application/zip'});
      }finally{
        if(!complete){try{await reader.cancel();}catch(error){}}
        reader.releaseLock();
      }
    });
    if(blob.size!==Number(metadata.size))throw new Error('The backup download is incomplete. Nothing was imported.');
    return blob;
  };
})();
