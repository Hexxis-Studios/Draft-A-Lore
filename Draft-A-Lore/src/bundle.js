/* Portable ZIP archives.

   A project ZIP is an ordinary archive containing the same readable project
   layout a linked folder uses. Keeping the ZIP code here lets the offline app
   move a complete project in browsers that cannot offer a directory picker. */

(function(){
  var MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
  var MAX_UNPACKED_BYTES = 1024 * 1024 * 1024;
  var MAX_ENTRY_BYTES = 512 * 1024 * 1024;
  var MAX_ENTRIES = 10000;
  var UTF8 = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  var UTF8_DECODER = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
  var CRC_TABLE = (function(){
    var table = [], i, j, c;
    for(i=0; i<256; i++){
      c = i;
      for(j=0; j<8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c >>> 0;
    }
    return table;
  })();

  function bytes(text){
    if(UTF8) return UTF8.encode(String(text));
    var encoded = unescape(encodeURIComponent(String(text))), out = new Uint8Array(encoded.length), i;
    for(i=0; i<encoded.length; i++) out[i] = encoded.charCodeAt(i);
    return out;
  }

  function text(data){
    if(UTF8_DECODER) return UTF8_DECODER.decode(data);
    var out = '', i;
    for(i=0; i<data.length; i++) out += String.fromCharCode(data[i]);
    return decodeURIComponent(escape(out));
  }

  function crc32(data){
    var crc = 0xffffffff, i;
    for(i=0; i<data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function put16(out, at, value){ out[at] = value & 255; out[at+1] = (value >>> 8) & 255; }
  function put32(out, at, value){
    out[at] = value & 255; out[at+1] = (value >>> 8) & 255;
    out[at+2] = (value >>> 16) & 255; out[at+3] = (value >>> 24) & 255;
  }
  function get16(data, at){ return data[at] | (data[at+1] << 8); }
  function get32(data, at){ return (data[at] | (data[at+1] << 8) | (data[at+2] << 16) | (data[at+3] << 24)) >>> 0; }
  function copy(out, at, data){ out.set(data, at); return at + data.length; }
  function unsafePath(name){
    return !name||name.charAt(0)==='/'||/^[a-z]:\//i.test(name)||name.indexOf('\0')>=0||/(^|\/)\.\.(\/|$)/.test(name);
  }

  function dosTime(now){
    return ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) & 0xffff;
  }
  function dosDate(now){
    return (((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
  }

  /* STORE-only ZIPs are deliberately simple and work with the archive tools
     already present on Windows, macOS and common Unix installations. */
  DAL.makeZip = function(files){
    if(!Array.isArray(files)||files.length>MAX_ENTRIES) throw new Error('This project has too many files for a ZIP archive.');
    var now = new Date(), time = dosTime(now), date = dosDate(now), localSize = 0, centralSize = 0, offset = 0;
    var names=Object.create(null);
    var entries = (files || []).map(function(file){
      var name = bytes(file.name), data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
      var normalized=String(file.name).replace(/\\/g,'/');
      if(unsafePath(normalized)) throw new Error('Cannot export an unsafe file path.');
      if(names[normalized]) throw new Error('Cannot export duplicate file paths. Rename the conflicting assets before saving the ZIP file.');
      names[normalized]=true;
      if(!name.length||name.length>65535) throw new Error('A ZIP entry name is empty or too long.');
      if(data.length>MAX_ENTRY_BYTES) throw new Error('A file in the ZIP exceeds the 512 MB safety limit.');
      if(localSize+centralSize+76+name.length*2+data.length+22>MAX_ARCHIVE_BYTES) throw new Error('The ZIP file exceeds the 512 MB safety limit.');
      var entry = { name: name, data: data, crc: crc32(data), time: time, date: date, offset: offset };
      offset += 30 + name.length + data.length;
      localSize += 30 + name.length + data.length;
      centralSize += 46 + name.length;
      return entry;
    });
    if(entries.length > 65535) throw new Error('This project has too many files for a ZIP archive.');
    var out = new Uint8Array(localSize + centralSize + 22), at = 0, centralAt, i, e;
    for(i=0; i<entries.length; i++){
      e = entries[i];
      put32(out, at, 0x04034b50); put16(out, at+4, 20); put16(out, at+6, 0x0800); put16(out, at+8, 0);
      put16(out, at+10, e.time); put16(out, at+12, e.date); put32(out, at+14, e.crc);
      put32(out, at+18, e.data.length); put32(out, at+22, e.data.length); put16(out, at+26, e.name.length); put16(out, at+28, 0);
      at = copy(out, at+30, e.name); at = copy(out, at, e.data);
    }
    centralAt = at;
    for(i=0; i<entries.length; i++){
      e = entries[i];
      put32(out, at, 0x02014b50); put16(out, at+4, 20); put16(out, at+6, 20); put16(out, at+8, 0x0800); put16(out, at+10, 0);
      put16(out, at+12, e.time); put16(out, at+14, e.date); put32(out, at+16, e.crc);
      put32(out, at+20, e.data.length); put32(out, at+24, e.data.length); put16(out, at+28, e.name.length); put16(out, at+30, 0); put16(out, at+32, 0);
      put16(out, at+34, 0); put16(out, at+36, 0); put32(out, at+38, 0); put32(out, at+42, e.offset);
      at = copy(out, at+46, e.name);
    }
    put32(out, at, 0x06054b50); put16(out, at+4, 0); put16(out, at+6, 0); put16(out, at+8, entries.length); put16(out, at+10, entries.length);
    put32(out, at+12, at-centralAt); put32(out, at+16, centralAt); put16(out, at+20, 0);
    return out;
  };

  function findEndRecord(data){
    var start = Math.max(0, data.length - 65557), i;
    for(i=data.length-22; i>=start; i--){ if(get32(data, i) === 0x06054b50) return i; }
    throw new Error('That file is not a valid ZIP archive.');
  }

  /* The central directory carries the actual sizes, so this also handles ZIPs
     that use data descriptors. DEFLATE is read through the platform stream when
     available; our own output stays STORE-only to keep bundle creation small. */
  DAL.readZip = function(input){
    var data = input instanceof Uint8Array ? input : new Uint8Array(input);
    if(data.length > MAX_ARCHIVE_BYTES) throw new Error('That ZIP file is larger than the 512 MB safety limit.');
    var end = findEndRecord(data), count = get16(data, end+10), at = get32(data, end+16), entries = [], i;
    if(get16(data, end+4) || get16(data, end+6) || count === 0xffff || get32(data, end+12) === 0xffffffff || at === 0xffffffff){
      throw new Error('ZIP64 archives are not supported.');
    }
    if(count > MAX_ENTRIES) throw new Error('That ZIP file contains too many files.');
    var unpackedTotal = 0, seenNames = Object.create(null);
    for(i=0; i<count; i++){
      if(get32(data, at) !== 0x02014b50) throw new Error('The ZIP directory is damaged.');
      var flags = get16(data, at+8), method = get16(data, at+10), compressed = get32(data, at+20), size = get32(data, at+24);
      var nameLength = get16(data, at+28), extraLength = get16(data, at+30), commentLength = get16(data, at+32), localOffset = get32(data, at+42);
      if(at + 46 + nameLength + extraLength + commentLength > data.length) throw new Error('The ZIP directory is truncated.');
      var entryName = text(data.slice(at+46, at+46+nameLength)).replace(/\\/g, '/');
      if(unsafePath(entryName)) throw new Error('The ZIP file contains an unsafe file path.');
      if(seenNames[entryName]) throw new Error('The ZIP file contains duplicate file paths.');
      seenNames[entryName] = true;
      if(flags & 1) throw new Error('Encrypted ZIP files are not supported.');
      if(size > MAX_ENTRY_BYTES) throw new Error('The ZIP entry “'+entryName+'” is larger than the safety limit.');
      unpackedTotal += size;
      if(unpackedTotal > MAX_UNPACKED_BYTES) throw new Error('The expanded ZIP is larger than the 1 GB safety limit.');
      if(method === 8 && compressed && size / compressed > 200) throw new Error('The ZIP entry “'+entryName+'” has an unsafe compression ratio.');
      entries.push({ name: entryName, flags: flags, method: method, compressed: compressed, size: size, crc:get32(data, at+16), offset: localOffset });
      at += 46 + nameLength + extraLength + commentLength;
    }
    function entryData(entry){
      if(entry.offset + 30 > data.length || get32(data, entry.offset) !== 0x04034b50) return Promise.reject(new Error('The ZIP entry “'+entry.name+'” is damaged.'));
      var localName = get16(data, entry.offset+26), localExtra = get16(data, entry.offset+28), from = entry.offset + 30 + localName + localExtra;
      if(from + entry.compressed > data.length) return Promise.reject(new Error('The ZIP entry “'+entry.name+'” is truncated.'));
      var packed = data.slice(from, from + entry.compressed);
      if(entry.method === 0){
        if(packed.length !== entry.size || crc32(packed) !== entry.crc) return Promise.reject(new Error('The ZIP entry “'+entry.name+'” failed its integrity check.'));
        return Promise.resolve(packed);
      }
      if(entry.method !== 8) return Promise.reject(new Error('The ZIP entry “'+entry.name+'” uses unsupported compression method '+entry.method+'.'));
      if(typeof DecompressionStream === 'undefined') return Promise.reject(new Error('The ZIP entry “'+entry.name+'” is deflated, but this browser cannot decompress deflated ZIP files.'));
      try{
        return (async function(){
          var reader=new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
          var chunks=[],length=0,finished=false;
          try{
            while(true){
              var chunk=await reader.read();
              if(chunk.done){finished=true;break;}
              length+=chunk.value.byteLength;
              if(length>entry.size||length>MAX_ENTRY_BYTES) throw new Error('The ZIP entry “'+entry.name+'” expands beyond its declared size.');
              chunks.push(chunk.value);
            }
          }finally{
            if(!finished){try{await reader.cancel();}catch(error){}}
            reader.releaseLock();
          }
          var unpacked=new Uint8Array(length),position=0;
          chunks.forEach(function(chunk){unpacked.set(chunk,position);position+=chunk.byteLength;});
          if(unpacked.length !== entry.size) throw new Error('The ZIP entry “'+entry.name+'” has an unexpected size.');
          if(crc32(unpacked) !== entry.crc) throw new Error('The ZIP entry “'+entry.name+'” failed its integrity check.');
          return unpacked;
        })();
      } catch(err){ return Promise.reject(new Error('Could not decompress “'+entry.name+'”: '+err.message)); }
    }
    return { entries: entries, read: entryData };
  };

  function textFile(name, value){ return { name: name, data: bytes(value || '') }; }
  function chapterText(chapter){
    var holder = document.createElement('div');
    holder.innerHTML = chapter.contentHTML || '';
    return holder.textContent || '';
  }

  DAL.projectTextFiles = function(proj,linkedBible){
    if(!proj) throw new Error('Open a project before saving its ZIP file.');
    var snapshot = DAL.clone(proj), files = [];
    delete snapshot.folderHandle;
    var portable={project:snapshot};
    if(arguments.length>1){if(linkedBible)portable.linkedBible=DAL.clone(linkedBible);}
    else if(proj.bibleId&&DAL.state.bibles&&DAL.state.bibles[proj.bibleId]) portable.linkedBible=DAL.clone(DAL.state.bibles[proj.bibleId]);
    files.push(textFile('project.json', JSON.stringify(portable, null, 2)));
    (proj.chapters || []).forEach(function(ch, i){ files.push(textFile('chapters/'+String(i+1).padStart(2, '0')+'-'+DAL.sanitizeFilename(ch.title)+'.txt', chapterText(ch))); });
    (proj.characters || []).forEach(function(character,i){ files.push(textFile('characters/'+String(i+1).padStart(2,'0')+'-'+DAL.sanitizeFilename(character.name)+'.txt', character.backstory || '')); });
    ((proj.lore && proj.lore.entries) || []).forEach(function(entry,i){ files.push(textFile('lore/'+DAL.sanitizeFilename(entry.folder || 'miscellaneous')+'/'+String(i+1).padStart(2,'0')+'-'+DAL.sanitizeFilename(entry.title)+'.txt', entry.content || '')); });
    (proj.plots || []).forEach(function(plot,i){ files.push(textFile('plots/'+String(i+1).padStart(2,'0')+'-'+DAL.sanitizeFilename(plot.title)+'.txt', plot.description || '')); });
    return files;
  };

  DAL.projectAssetFiles = function(proj){
    DAL.ensureAssets(proj);
    var files = [], reads = [];
    DAL.ASSET_FOLDERS.forEach(function(folder){
      (proj.assets[folder.key] || []).forEach(function(asset){
        reads.push(function(){
          if(asset.inline){ files.push({ name:'Assets/'+folder.dir+'/'+asset.name, data:bytes(asset.inline), mime:asset.mime || '' }); return Promise.resolve(); }
          return DAL.blobStore.get(asset.id).then(function(record){
            if(!record || !record.blob) throw new Error('Asset “'+asset.name+'” is no longer available on this device.');
            return record.blob.arrayBuffer().then(function(buffer){ files.push({ name:'Assets/'+folder.dir+'/'+asset.name, data:new Uint8Array(buffer), mime:asset.mime || record.blob.type || '' }); });
          });
        });
      });
    });
    return reads.reduce(function(chain, read){ return chain.then(read); }, Promise.resolve()).then(function(){ return files; });
  };

  DAL.projectFolderFiles = function(proj){
    var textFiles,snapshot;
    try{ snapshot=DAL.clone(proj);textFiles = DAL.projectTextFiles(snapshot); }
    catch(error){ return Promise.reject(error); }
    return DAL.projectAssetFiles(snapshot).then(function(assetFiles){ return textFiles.concat(assetFiles); });
  };

  DAL.projectBundleBytes = function(proj){
    return DAL.projectFolderFiles(proj).then(function(files){ return DAL.makeZip(files); });
  };

  function base64(data){
    var binary = '', size = 0x8000;
    for(var i=0; i<data.length; i+=size) binary += String.fromCharCode.apply(null, data.subarray(i, i+size));
    return btoa(binary);
  }

  DAL.syncNativeAssets = function(proj, handle){
    var plugin = DAL.nativeFolderPlugin && DAL.nativeFolderPlugin();
    if(!plugin) return Promise.reject(new Error('Android folder access is unavailable.'));
    handle = handle || DAL.folderHandles[proj.id];
    return DAL.projectAssetFiles(proj).then(function(files){
      return files.reduce(function(chain, file){
        return chain.then(function(){ return plugin.writeFile({ projectId:proj.id, path:file.name, base64:base64(file.data), mime:file.mime || 'application/octet-stream' }); });
      }, Promise.resolve());
    }).then(function(){ if(handle) handle.assetsSynced = true; });
  };

  DAL.syncNativeFolder = function(proj, handle, linkedBible){
    var plugin = DAL.nativeFolderPlugin && DAL.nativeFolderPlugin();
    if(!plugin) return Promise.reject(new Error('Android folder access is unavailable.'));
    var source=arguments.length>2?DAL.projectTextFiles(proj,linkedBible):DAL.projectTextFiles(proj);
    var files = source.map(function(file){ return { path:file.name, text:text(file.data), mime:file.name === 'project.json' ? 'application/json' : 'text/plain' }; });
    var metadata=files.shift();files.push(metadata);
    return Promise.resolve().then(function(){return handle.assetsSynced ? null : DAL.syncNativeAssets(proj, handle);}).then(function(){return plugin.syncTextFiles({ projectId:proj.id, files:files });});
  };

  function xml(value){ return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function docxFill(value){var m=String(value||'').match(/^#([0-9a-f]{6})$/i);if(m)return m[1].toUpperCase();m=String(value||'').match(/rgb\(\s*(\d+)\D+(\d+)\D+(\d+)/i);return m?[m[1],m[2],m[3]].map(function(n){return Math.max(0,Math.min(255,parseInt(n))).toString(16).padStart(2,'0');}).join('').toUpperCase():'';}
  function docxRuns(node, marks){
    marks = Object.assign({}, marks || {});
    if(node.nodeType === 3){
      if(!node.nodeValue) return '';
      var props = (marks.bold?'<w:b/>':'')+(marks.italic?'<w:i/>':'')+(marks.underline?'<w:u w:val="single"/>':'')+(marks.strike?'<w:strike/>':'')+(marks.highlight?'<w:shd w:val="clear" w:color="auto" w:fill="'+marks.highlight+'"/>':'');
      return '<w:r>'+(props?'<w:rPr>'+props+'</w:rPr>':'')+'<w:t xml:space="preserve">'+xml(node.nodeValue)+'</w:t></w:r>';
    }
    if(node.nodeType !== 1) return '';
    if(node.tagName === 'BR') return '<w:r><w:br/></w:r>';
    if(node.tagName === 'IMG') return node.getAttribute('alt') ? '<w:r><w:t>['+xml(node.getAttribute('alt'))+']</w:t></w:r>' : '';
    if(node.matches('B,STRONG')) marks.bold = true;
    if(node.matches('I,EM')) marks.italic = true;
    if(node.matches('U')) marks.underline = true;
    if(node.matches('S,STRIKE')) marks.strike = true;
    if(node.matches('.writer-highlight')) marks.highlight = docxFill(node.style.backgroundColor||node.getAttribute('data-color'));
    return Array.from(node.childNodes).map(function(child){ return docxRuns(child, marks); }).join('');
  }
  function docxParagraph(node, style, prefix){
    var runs = (prefix ? '<w:r><w:t>'+xml(prefix)+'</w:t></w:r>' : '') + docxRuns(node, {});
    if(!runs) runs = '<w:r><w:t></w:t></w:r>';
    return '<w:p>'+(style?'<w:pPr><w:pStyle w:val="'+style+'"/></w:pPr>':'')+runs+'</w:p>';
  }
  function docxTable(table){
    var rows=Array.from(table.rows||[]);if(!rows.length)return '';
    var borders='<w:tblBorders><w:top w:val="single" w:sz="4" w:color="808080"/><w:left w:val="single" w:sz="4" w:color="808080"/><w:bottom w:val="single" w:sz="4" w:color="808080"/><w:right w:val="single" w:sz="4" w:color="808080"/><w:insideH w:val="single" w:sz="4" w:color="B0B0B0"/><w:insideV w:val="single" w:sz="4" w:color="B0B0B0"/></w:tblBorders>';
    return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>'+borders+'</w:tblPr>'+rows.map(function(row){return '<w:tr>'+Array.from(row.cells).map(function(cell){var span=Math.max(1,parseInt(cell.getAttribute('colspan'))||1),props='<w:tcW w:w="0" w:type="auto"/>'+(span>1?'<w:gridSpan w:val="'+span+'"/>':'')+(cell.tagName==='TH'?'<w:shd w:val="clear" w:color="auto" w:fill="E7E7E7"/>':'');return '<w:tc><w:tcPr>'+props+'</w:tcPr>'+docxParagraph(cell,'')+'</w:tc>';}).join('')+'</w:tr>';}).join('')+'</w:tbl>';
  }
  function docxBody(html){
    var holder = document.createElement('div'); holder.innerHTML = DAL.sanitizeRichHTML(html || '');
    var out = [];
    function walk(parent){
      var inline = [];
      function flush(){ if(inline.length){ var wrap=document.createElement('span'); inline.forEach(function(n){wrap.appendChild(n.cloneNode(true));}); out.push(docxParagraph(wrap)); inline=[]; } }
      Array.from(parent.childNodes).forEach(function(node){
        if(node.nodeType === 1 && node.tagName === 'TABLE'){ flush(); out.push(docxTable(node)); }
        else if(node.nodeType === 1 && node.matches('HR.writer-page-break')){ flush(); out.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>'); }
        else if(node.nodeType === 1 && /^(P|DIV|H1|H2|H3|H4|BLOCKQUOTE|LI|PRE|ASIDE)$/.test(node.tagName)){
          flush();
          var style = /^H[1-4]$/.test(node.tagName) ? 'Heading'+node.tagName.slice(1) : (/^(BLOCKQUOTE|ASIDE)$/.test(node.tagName) ? 'Quote' : (node.tagName === 'PRE' ? 'Code' : ''));
          out.push(docxParagraph(node, style, node.tagName === 'LI' ? '• ' : ''));
        } else if(node.nodeType === 1 && /^(UL|OL|SECTION)$/.test(node.tagName)){ flush(); walk(node); }
        else inline.push(node);
      });
      flush();
    }
    walk(holder); return out.join('');
  }

  DAL.exportManuscriptDocx = function(proj){
    if(!proj || !(proj.chapters || []).length){ DAL.toast((DAL.i18n?DAL.i18n.text("ui_Add_a_chapter_before_exporting_a_Word_manu_25b85b4","Add a chapter before exporting a Word manuscript."):"Add a chapter before exporting a Word manuscript."), 'info'); return; }
    var body = '<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>'+xml((proj.cover&&proj.cover.title)||proj.name)+'</w:t></w:r></w:p>';
    var author = (proj.cover&&proj.cover.author) || (DAL.state.autoFillAuthor ? DAL.state.authorName : '');
    if(author) body += '<w:p><w:pPr><w:pStyle w:val="Subtitle"/></w:pPr><w:r><w:t>'+xml(author)+'</w:t></w:r></w:p>';
    (proj.chapters || []).forEach(function(ch){ body += '<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:pageBreakBefore/></w:pPr><w:r><w:t>'+xml(ch.title)+'</w:t></w:r></w:p>'+docxBody(DAL.writerPublishHTML?DAL.writerPublishHTML(proj,ch):ch.contentHTML); });
    body += '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>';
    var documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+'</w:body></w:document>';
    var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:i/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:rPr><w:b/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/></w:rPr></w:style></w:styles>';
    var files = [
      textFile('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'),
      textFile('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
      textFile('word/document.xml',documentXml), textFile('word/styles.xml',styles),
      textFile('word/_rels/document.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')
    ];
    return DAL.download(DAL.sanitizeFilename(proj.name)+'-manuscript.docx', DAL.makeZip(files), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').then(function(saved){if(saved)DAL.toast((DAL.i18n?DAL.i18n.text("ui_Word_manuscript_export_completed_Check_the_028a96f","Word manuscript export completed. Check the saved file."):"Word manuscript export completed. Check the saved file."),'success');return saved;});
  };

  DAL.exportProjectBundle = function(projectId){
    var proj = DAL.state.projects[projectId || DAL.currentProjectId];
    if(!proj){ DAL.toast((DAL.i18n?DAL.i18n.text("ui_Open_a_project_before_saving_a_bundle__fec49f1","Open a project before saving its ZIP file."):"Open a project before saving its ZIP file."), 'error'); return Promise.resolve(false); }
    DAL.toast((DAL.i18n?DAL.i18n.text("ui_Packing_project_bundle__dc6e043","Preparing project ZIP…"):"Preparing project ZIP…"), 'info');
    return DAL.projectBundleBytes(proj).then(async function(data){
      if(!await DAL.download(DAL.sanitizeFilename(proj.name)+'.zip',data,'application/zip'))return false;
      DAL.toast('Project ZIP export completed for “'+proj.name+'”. Check the saved file.','success');
      return true;
    }).catch(function(err){ DAL.toast('Could not save project ZIP: '+err.message, 'error'); return false; });
  };

  function bundleProjectEntry(zip){
    var entries=zip.entries.filter(function(item){return /(^|\/)project\.json$/.test(item.name);});
    if(entries.length>1)throw new Error('That ZIP file contains more than one project. Import one project ZIP at a time.');
    return entries[0]||null;
  }

  /* Asset records in project.json retain their source ids. Reusing the normal
     folder-import remapper writes new blobs into IndexedDB and repairs every
     scene, chapter and audio binding to the new local asset ids. */
  DAL.importProjectBundle = function(file){
    if(!file) return Promise.resolve(false);
    if(DAL._folderRestoreBusy||DAL._workspaceRestoreBusy||DAL._bundleImportBusy){DAL.toast('Wait for the current import or restore to finish.','info');return Promise.resolve(false);}
    if(file.size > MAX_ARCHIVE_BYTES){ DAL.toast(DAL.importText('bundleImportTooLarge','That ZIP file is larger than the 512 MB safety limit.'), 'error'); return Promise.resolve(false); }
    var workspace=DAL.state;
    DAL._bundleImportBusy=true;
    DAL.toast(DAL.importText('readingProjectBundle','Reading project ZIP…'), 'info');
    return file.arrayBuffer().then(function(buffer){
      var zip = DAL.readZip(buffer), projectEntry = bundleProjectEntry(zip);
      if(!projectEntry) throw new Error(DAL.importText('bundleProjectMissing','That ZIP file does not contain a Draft A Lore project.'));
      var root = projectEntry.name.slice(0, -'project.json'.length);
      return zip.read(projectEntry).then(function(raw){
        var data;
        try{ data = JSON.parse(text(raw)); }catch(err){ throw new Error(DAL.importText('bundleProjectInvalid','The project data in that ZIP file is damaged.')); }
        var proj = DAL.adoptImportedProject(data, true), jobs = [];
        DAL.ASSET_FOLDERS.forEach(function(folder){
          var prefix = root+'Assets/'+folder.dir+'/';
          zip.entries.forEach(function(entry){
            if(entry.name.indexOf(prefix) !== 0 || entry.name.slice(prefix.length).indexOf('/') >= 0 || !entry.name.slice(prefix.length)) return;
            jobs.push(function(){
              return zip.read(entry).then(function(assetData){
                var name = entry.name.slice(prefix.length), matches = (proj.assets[folder.key] || []).filter(function(asset){ return asset.name === name; });
                var old = matches[0], blob = new Blob([assetData], { type: (old && old.mime) || '' });
                /* File is broadly available, but a named Blob has the same
                   import contract on older Safari releases that lack its
                   constructor. */
                var importedFile = typeof File === 'function' ? new File([blob], name, { type: blob.type }) : blob;
                if(!importedFile.name) importedFile.name = name;
                return DAL.remapImportedAsset(proj, importedFile, folder.key);
              });
            });
          });
        });
        return jobs.reduce(function(chain, job){ return chain.then(function(results){ return job().then(function(result){ if(!result) throw new Error('An asset could not be imported. The project was not added.'); results.push(result); return results; }); }); }, Promise.resolve([])).then(function(results){
          var count = results.filter(Boolean).length;
          return Promise.resolve(DAL.validateFolderAssets?DAL.validateFolderAssets(proj):null).then(function(){
            if(DAL.state!==workspace||DAL._workspaceRestoreBusy||DAL._folderRestoreBusy)throw new Error('The workspace changed while importing. No project was added.');
            return DAL.finishImportedProject(proj,count);
          });
        });
      });
    }).catch(function(err){ DAL.toast(DAL.importText('bundleImportFailed','Could not import that ZIP file: '+(err&&err.message||'unknown error'),{reason:err&&err.message||'unknown error'}), 'error'); return false; }).finally(function(){DAL._bundleImportBusy=false;});
  };

  DAL.chooseProjectBundle = function(){
    var input = document.getElementById('projectBundleImportInput');
    if(!input){
      input = document.createElement('input'); input.type = 'file'; input.id = 'projectBundleImportInput';
      input.accept = '.zip,.dalz,application/zip,application/x-zip-compressed'; input.hidden = true;
      document.body.appendChild(input);
      input.addEventListener('change', function(){ var file = input.files && input.files[0]; input.value = ''; if(file) DAL.importProjectBundle(file); });
    }
    input.click();
  };

  function addBundleButton(after, projectId){
    if(!after || !after.parentNode || after.parentNode.querySelector('[data-action="save-project-bundle"]')) return;
    var button = document.createElement('button');
    button.className = 'btn sm bundle-save-button'; button.setAttribute('data-action', 'save-project-bundle'); button.setAttribute('data-pid', projectId || DAL.currentProjectId || '');
    button.textContent = 'Export project ZIP'; after.parentNode.insertBefore(button, after.nextSibling);
  }

  DAL.registerAfterRender(function(){
    Array.prototype.forEach.call(document.querySelectorAll('[data-action="link-folder"]'), function(button){ addBundleButton(button, button.getAttribute('data-pid')); });
  });

  DAL.registerActionHandler(function(action, el){
    if(action === 'save-project-bundle' || action === 'export-project-bundle'){
      DAL.exportProjectBundle(el && el.getAttribute ? el.getAttribute('data-pid') : null); return true;
    }
    if(action === 'import-project-bundle'){ DAL.chooseProjectBundle(); return true; }
    if(action === 'export-manuscript-docx'){ DAL.exportManuscriptDocx(DAL.state.projects[DAL.currentProjectId]); return true; }
    /* The existing File-menu import action now opens the complete choice dialog,
       so a bundle is reachable from every import surface without changing its
       long-standing data-action value. */
    if(action === 'import-project'){ DAL.openProjectImport(); return true; }
    return false;
  });

})();
