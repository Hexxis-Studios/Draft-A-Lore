/* Draft A Lore — book design, publication preview, EPUB, and print layout */
DAL = DAL || {};

DAL.BOOK_TRIMS={
  'paperback-6x9':{label:'Paperback 6 × 9 in',width:6,height:9,top:.65,right:.6,bottom:.7,left:.75,gutter:.15},
  'paperback-5x8':{label:'Paperback 5 × 8 in',width:5,height:8,top:.6,right:.5,bottom:.65,left:.65,gutter:.15},
  'a5':{label:'A5 paperback',width:5.83,height:8.27,top:.65,right:.55,bottom:.7,left:.7,gutter:.15},
  'hardcover-6x9':{label:'Hardcover 6 × 9 in',width:6,height:9,top:.75,right:.7,bottom:.8,left:.85,gutter:.2},
  'letter':{label:'US Letter manuscript',width:8.5,height:11,top:1,right:1,bottom:1,left:1,gutter:0}
};
DAL.BOOK_TYPE={classic:{label:'Classic serif',body:"Georgia, 'Times New Roman', serif",heading:"Georgia, 'Times New Roman', serif"},literary:{label:'Literary old style',body:"'Palatino Linotype', Palatino, Georgia, serif",heading:"'Palatino Linotype', Palatino, Georgia, serif"},modern:{label:'Modern sans',body:"Arial, Helvetica, sans-serif",heading:"Arial, Helvetica, sans-serif"},accessible:{label:'Accessible humanist',body:"'Trebuchet MS', Verdana, sans-serif",heading:"'Trebuchet MS', Verdana, sans-serif"},typewriter:{label:'Typewriter',body:"'Courier New', monospace",heading:"'Courier New', monospace"}};
DAL.publicationText=function(key,fallback,values){return DAL.i18n?DAL.i18n.text(key,fallback,values):fallback;};
DAL.ensureBookDesign=function(proj){
  var base=DAL.BOOK_TRIMS['paperback-6x9'],design=proj.bookDesign;if(!design||typeof design!=='object'||Array.isArray(design))design=proj.bookDesign={};
  if(!Object.prototype.hasOwnProperty.call(DAL.BOOK_TRIMS,design.trim))design.trim='paperback-6x9';if(!Object.prototype.hasOwnProperty.call(DAL.BOOK_TYPE,design.typography))design.typography='classic';
  ['width','height','top','right','bottom','left','gutter'].forEach(function(key){var fallback=DAL.BOOK_TRIMS[design.trim][key],value=design[key];design[key]=value!=null&&value!==''&&Number.isFinite(Number(value))?Math.max(0,Number(value)):fallback;});
  design.fontSize=Math.max(8,Math.min(24,Number(design.fontSize)||11));design.lineHeight=Math.max(1,Math.min(3,Number(design.lineHeight)||1.5));design.paragraphIndent=Number.isFinite(Number(design.paragraphIndent))&&design.paragraphIndent!=null?Math.max(0,Math.min(1,Number(design.paragraphIndent))):.25;design.dropCaps=design.dropCaps!==false;design.pageNumbers=design.pageNumbers!==false;design.chapterNewPage=design.chapterNewPage!==false;return design;
};
DAL.bookDesignVars=function(proj){var d=DAL.ensureBookDesign(proj),type=DAL.BOOK_TYPE[d.typography];return '--design-body:'+type.body+';--design-heading:'+type.heading+';--design-font-size:'+d.fontSize+'pt;--design-line-height:'+d.lineHeight+';--design-indent:'+d.paragraphIndent+'in;--design-pad-top:'+d.top+'in;--design-pad-right:'+d.right+'in;--design-pad-bottom:'+d.bottom+'in;--design-pad-left:'+d.left+'in';};
DAL.previewProfileControl=function(proj){var profiles=[['responsive','Responsive'],['phone','Android phone'],['tablet','Android tablet'],['kindle','Kindle'],['ipad','iPad'],['paperback','Paperback'],['hardcover','Hardcover']],label=DAL.escapeHtml(DAL.publicationText('publicationPreviewFormat','Preview format'));return '<select class="form-select preview-profile" data-preview-profile title="'+label+'" aria-label="'+label+'">'+profiles.map(function(profile){return'<option value="'+profile[0]+'"'+(proj.previewProfile===profile[0]?' selected':'')+'>'+DAL.escapeHtml(DAL.publicationText('publicationProfile_'+profile[0],profile[1]))+'</option>';}).join('')+'</select>';};

DAL.publicationCheck=function(proj){
  var d=DAL.ensureBookDesign(proj),checks=[],title=String((proj.cover&&proj.cover.title)||proj.name||'').trim(),author=String((proj.cover&&proj.cover.author)||(DAL.state.autoFillAuthor&&DAL.state.authorName)||'').trim(),chapters=proj.chapters||[],usableWidth=d.width-d.left-d.right-d.gutter,usableHeight=d.height-d.top-d.bottom;
  function add(level,label,detail){checks.push({level:level,label:label,detail:detail});}
  add(title?'ready':'error',DAL.publicationText('publicationBookTitle','Book title'),title||DAL.publicationText('publicationAddTitle','Add a title in Project Settings.'));
  add(author?'ready':'warning',DAL.publicationText('publicationAuthor','Author or pen name'),author||DAL.publicationText('publicationAddAuthor','Add the public name you want printed in the book.'));
  add(chapters.length?'ready':'error',DAL.publicationText('tool_manuscript','Manuscript'),chapters.length?DAL.publicationText('publicationChapterCount',chapters.length+' chapter'+(chapters.length===1?'':'s')+' included.',{count:chapters.length}):DAL.publicationText('publicationAddChapter','Add at least one chapter before exporting.'));
  var empty=chapters.filter(function(chapter){return !DAL.continuityText(chapter.contentHTML||'').trim();});
  if(empty.length)add('warning',DAL.publicationText('publicationEmptyChapters','Empty chapters'),empty.map(function(chapter){return chapter.title;}).join(', '));
  var duplicate={};chapters.forEach(function(chapter){var key=String(chapter.title||'').trim().toLowerCase();if(key)duplicate[key]=(duplicate[key]||0)+1;});var duplicateTitles=Object.keys(duplicate).filter(function(key){return duplicate[key]>1;});
  if(duplicateTitles.length)add('warning',DAL.publicationText('publicationRepeatedTitles','Repeated chapter titles'),duplicateTitles.join(', '));
  add(usableWidth>=2.5&&usableHeight>=4?'ready':'error',DAL.publicationText('publicationTrimMargins','Trim and margins'),DAL.publicationText('publicationLiveArea',usableWidth.toFixed(2)+' × '+usableHeight.toFixed(2)+' in live text area.',{width:usableWidth.toFixed(2),height:usableHeight.toFixed(2)}));
  if(d.width<1||d.width>24||d.height<1||d.height>36)add('error',DAL.publicationText('publicationPageSize','Page size'),DAL.publicationText('publicationPageBounds','Choose a page width between 1 and 24 inches and height between 1 and 36 inches.'));
  var cover=DAL.bookPageImages(proj,1)[0];add(cover?'ready':'warning',DAL.publicationText('publicationCoverImage','Cover image'),DAL.publicationText(cover?'publicationCoverAssigned':'publicationCoverOptional',cover?'Assigned to page 1.':'Optional for draft exports; add one before a store-ready EPUB.'));
  var counts={error:0,warning:0,ready:0};checks.forEach(function(check){counts[check.level]++;});return{checks:checks,counts:counts,ready:counts.error===0};
};

DAL.renderBookDesign=function(proj){var d=DAL.ensureBookDesign(proj),type=DAL.BOOK_TYPE[d.typography],preflight=DAL.publicationCheck(proj),html="<div class=\"book-design\"><div class=\"section-header\"><div><div class=\"section-title\">"+DAL.uiLabel("tool_bookdesign","Book Design")+"</div><p class=\"writer-muted\">"+DAL.uiLabel("ui_Publication_settings_used_by_Book_Preview__df88b58","Publication settings used by Book Preview, EPUB, and print/PDF layout. Check exported files before submitting them to a publisher.")+"</p></div><div class=\"writer-tool-actions\"><button class=\"btn\" data-action=\"ws-tool\" data-tool=\"bookpreview\">"+DAL.uiLabel("ui_Preview_324b134","Preview")+"</button><button class=\"btn\" data-action=\"export-epub\">"+DAL.uiLabel("ui_Export_EPUB_57d6ef0","Export EPUB")+"</button><button class=\"btn primary\" data-action=\"writer-print\">"+DAL.uiLabel("ui_Print_ready_PDF_7c3d4e3","Print / save PDF")+"</button></div></div>";
  if(typeof window!=='undefined'&&window.Capacitor&&window.Capacitor.getPlatform&&window.Capacitor.getPlatform()==='android')html+='<p class="writer-muted" role="note">'+DAL.uiLabel('nativeBookPdfHelp','Android may replace a custom book size with a standard paper size when saving PDF. Check the paper size in its print dialog and inspect the exported file. For custom paperback trim, export your project and prepare the PDF on desktop.')+'</p>';
  html+="<div class=\"book-design-grid\"><section class=\"card\"><h3>"+DAL.uiLabel("ui_Page_0a30a81","Page")+"</h3><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("ui_Trim_preset_6a25ab8","Trim preset")+"</label><select class=\"form-select\" data-book-design=\"trim\">"+Object.keys(DAL.BOOK_TRIMS).map(function(key){return'<option value="'+key+'"'+(d.trim===key?' selected':'')+'>'+DAL.uiLabel('publicationTrim_'+key,DAL.BOOK_TRIMS[key].label)+'</option>';}).join('')+"</select></div><div class=\"writer-form-grid\"><label class=\"form-group\"><span class=\"form-label\">"+DAL.uiLabel("ui_Width_in__a5c4ee4","Width (in)")+"</span><input class=\"form-input\" type=\"number\" min=\"1\" step=\".01\" data-book-design=\"width\" value=\""+d.width+"\"></label><label class=\"form-group\"><span class=\"form-label\">"+DAL.uiLabel("ui_Height_in__322aa56","Height (in)")+"</span><input class=\"form-input\" type=\"number\" min=\"1\" step=\".01\" data-book-design=\"height\" value=\""+d.height+'"></label></div></section>';
  html+="<section class=\"card\"><h3>"+DAL.uiLabel("ui_Margins_eea8d24","Margins")+"</h3><div class=\"margin-grid\">"+[['top','Top'],['right','Outside'],['bottom','Bottom'],['left','Inside'],['gutter','Gutter']].map(function(field){return'<label class="form-group"><span class="form-label">'+DAL.uiLabel('publicationMargin_'+field[0],field[1])+' (in)</span><input class="form-input" type="number" min="0" step=".05" data-book-design="'+field[0]+'" value="'+d[field[0]]+'"></label>';}).join('')+'</div></section>';
  html+="<section class=\"card\"><h3>"+DAL.uiLabel("ui_Typography_cab94ab","Typography")+"</h3><div class=\"form-group\"><label class=\"form-label\">"+DAL.uiLabel("menu_theme","Theme")+"</label><select class=\"form-select\" data-book-design=\"typography\">"+Object.keys(DAL.BOOK_TYPE).map(function(key){return'<option value="'+key+'"'+(d.typography===key?' selected':'')+'>'+DAL.uiLabel('publicationTypography_'+key,DAL.BOOK_TYPE[key].label)+'</option>';}).join('')+"</select></div><div class=\"writer-form-grid\"><label class=\"form-group\"><span class=\"form-label\">"+DAL.uiLabel("ui_Body_size_pt__bf26189","Body size (pt)")+"</span><input class=\"form-input\" type=\"number\" min=\"8\" max=\"24\" step=\".5\" data-book-design=\"fontSize\" value=\""+d.fontSize+"\"></label><label class=\"form-group\"><span class=\"form-label\">"+DAL.uiLabel("ui_Line_height_127166f","Line height")+"</span><input class=\"form-input\" type=\"number\" min=\"1\" max=\"3\" step=\".05\" data-book-design=\"lineHeight\" value=\""+d.lineHeight+"\"></label><label class=\"form-group\"><span class=\"form-label\">"+DAL.uiLabel("ui_Paragraph_indent_in__77cb3a4","Paragraph indent (in)")+"</span><input class=\"form-input\" type=\"number\" min=\"0\" max=\"1\" step=\".05\" data-book-design=\"paragraphIndent\" value=\""+d.paragraphIndent+'"></label></div><div class="book-type-sample" style="font-family:'+type.body+'"><strong style="font-family:'+type.heading+"\">"+DAL.uiLabel("ui_Chapter_Heading_0fd9bdc","Chapter Heading")+"</strong><p>"+DAL.uiLabel("ui_The_first_line_shows_the_selected_body_typ_833312f","The first line shows the selected body type, spacing, and paragraph rhythm.")+"</p></div></section>";
  html+="<section class=\"card\"><h3>"+DAL.uiLabel("ui_Structure_7203c2b","Structure")+"</h3><label class=\"check-row\"><input type=\"checkbox\" data-book-design=\"dropCaps\""+(d.dropCaps?' checked':'')+">"+DAL.uiLabel("ui_Drop_capital_on_chapter_openings_952feed"," Drop capital on chapter openings")+"</label><label class=\"check-row\"><input type=\"checkbox\" data-book-design=\"pageNumbers\""+(d.pageNumbers?' checked':'')+">"+DAL.uiLabel("ui_Page_numbers_d0b56af"," Page numbers")+"</label><label class=\"check-row\"><input type=\"checkbox\" data-book-design=\"chapterNewPage\""+(d.chapterNewPage?' checked':'')+">"+DAL.uiLabel("ui_Start_every_chapter_on_a_new_page_f7d0327"," Start every chapter on a new page")+"</label></section></div><section class=\"card publication-check\"><div><h3>"+DAL.uiLabel("ui_Publishing_check_590484c","Publishing check")+"</h3><p class=\"writer-muted\">"+DAL.uiLabel(preflight.ready?'publicationPreflightReady':'publicationPreflightErrors',preflight.ready?'No blocking export problems found.':'Fix the errors below before exporting.')+'</p></div><div class="publication-check-list">'+preflight.checks.map(function(check){return '<div class="publication-check-row '+check.level+'"><span class="publication-check-mark" aria-hidden="true">'+(check.level==='ready'?'✓':check.level==='error'?'!':'i')+'</span><div><strong>'+DAL.escapeHtml(check.label)+'</strong><p>'+DAL.escapeHtml(check.detail)+'</p></div></div>';}).join('')+'</div></section></div>';return html;
};

DAL.epubTextBytes=function(value){return new TextEncoder().encode(String(value));};
DAL.epubXml=function(value){return String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');};
DAL.epubXhtmlBody=function(html){var safe=DAL.sanitizeRichHTML(html||'');if(typeof XMLSerializer!=='undefined'&&document.createElement){var holder=document.createElement('div');holder.innerHTML=safe;var serializer=new XMLSerializer();return Array.from(holder.childNodes).map(function(node){return serializer.serializeToString(node);}).join('');}return safe.replace(/&nbsp;/gi,'&#160;').replace(/<(br|hr)(\s[^>]*)?>/gi,'<$1$2 />').replace(/<img([^>]*?)(?<!\/)\s*>/gi,'<img$1 />');};
DAL.epubImageCollector=function(){var files=[],manifest=[],counter=0,map={};return{replace:function(html,prefix){prefix=prefix===undefined?'../images/':prefix;return String(html||'').replace(/data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+/gi,function(uri,ext){var compact=uri.replace(/\s+/g,''),known=map[compact];if(known)return prefix+known;counter++;ext=ext.toLowerCase()==='jpg'?'jpeg':ext.toLowerCase();var filename='image-'+counter+'.'+(ext==='jpeg'?'jpg':ext),raw=atob(compact.slice(compact.indexOf(',')+1)),bytes=new Uint8Array(raw.length);for(var i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);files.push({name:'EPUB/images/'+filename,data:bytes});manifest.push({id:'img'+counter,href:'images/'+filename,type:'image/'+ext});map[compact]=filename;return prefix+filename;});},files:files,manifest:manifest};};
DAL.epubFiles=function(proj){
  var d=DAL.ensureBookDesign(proj),type=DAL.BOOK_TYPE[d.typography],lang=proj.language||'en',title=(proj.cover&&proj.cover.title)||proj.name,author=(proj.cover&&proj.cover.author)||(DAL.state.autoFillAuthor?DAL.state.authorName:'')||'Unknown',collector=DAL.epubImageCollector(),chapters=[];
  var cover=DAL.bookPageImages(proj,1)[0],coverMarkup=cover?'<div class="cover"><img src="'+DAL.imageSrc(proj,cover)+'" alt="'+DAL.epubXml(cover.name||'Cover')+'" /></div>':'<div class="cover-title"><h1>'+DAL.epubXml(title)+'</h1><p>'+DAL.epubXml(author)+'</p></div>';coverMarkup=collector.replace(coverMarkup,'images/');
  (proj.chapters||[]).forEach(function(chapter,index){var body=DAL.writerPublishHTML?DAL.writerPublishHTML(proj,chapter):chapter.contentHTML;body=collector.replace(DAL.epubXhtmlBody(body));chapters.push({id:'chapter'+(index+1),href:'text/chapter-'+(index+1)+'.xhtml',title:chapter.title,body:body});});
  (proj._epubArtPages||[]).forEach(function(page){chapters.push({id:'artpage'+page.page,href:'text/illustration-'+page.page+'.xhtml',title:'Illustration page '+page.page,body:collector.replace(DAL.epubXhtmlBody(page.html)),artOnly:true});});
  var css='body{font-family:'+type.body+';font-size:'+d.fontSize+'pt;line-height:'+d.lineHeight+';margin:5%;}h1,h2{font-family:'+type.heading+';page-break-after:avoid;}p{margin:0 0 .5em;text-indent:'+d.paragraphIndent+'in;}h1+p,h2+p{'+(d.dropCaps?'':'text-indent:0;')+'}.chapter>p:first-of-type::first-letter{'+(d.dropCaps?'float:left;font-size:3em;line-height:.85;margin-right:.08em;':'')+'}img{max-width:100%;height:auto}.cover{text-align:center}.cover img{max-height:95vh}.writer-page-break{page-break-after:always}';
  var tocArt=collector.replace(DAL.epubXhtmlBody(proj._epubTocArt||''),'images/');
  var nav='<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="'+DAL.epubXml(lang)+'"><head><title>Contents</title><link rel="stylesheet" href="style.css"/></head><body>'+tocArt+'<nav epub:type="toc" id="toc"><h1>Contents</h1><ol><li><a href="cover.xhtml">Cover</a></li>'+chapters.map(function(chapter){return'<li><a href="'+chapter.href+'">'+DAL.epubXml(chapter.title)+'</a></li>';}).join('')+'</ol></nav></body></html>';
  var imageItems=collector.manifest.map(function(image,index){return'<item id="'+image.id+'" href="'+image.href+'" media-type="'+image.type+'"'+(cover&&index===0?' properties="cover-image"':'')+'/>';}).join('');
  var opf='<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="'+DAL.epubXml(lang)+'"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:draftalore:'+DAL.epubXml(proj.id)+'</dc:identifier><dc:title>'+DAL.epubXml(title)+'</dc:title><dc:creator>'+DAL.epubXml(author)+'</dc:creator><dc:language>'+DAL.epubXml(lang)+'</dc:language><meta property="dcterms:modified">'+new Date().toISOString().replace(/\.\d{3}Z$/,'Z')+'</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>'+chapters.map(function(chapter){return'<item id="'+chapter.id+'" href="'+chapter.href+'" media-type="application/xhtml+xml"/>';}).join('')+imageItems+'</manifest><spine><itemref idref="cover"/><itemref idref="nav"/>'+chapters.map(function(chapter){return'<itemref idref="'+chapter.id+'"/>';}).join('')+'</spine></package>';
  var files=[{name:'mimetype',data:DAL.epubTextBytes('application/epub+zip')},{name:'META-INF/container.xml',data:DAL.epubTextBytes('<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')},{name:'EPUB/package.opf',data:DAL.epubTextBytes(opf)},{name:'EPUB/nav.xhtml',data:DAL.epubTextBytes(nav)},{name:'EPUB/style.css',data:DAL.epubTextBytes(css)},{name:'EPUB/cover.xhtml',data:DAL.epubTextBytes('<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" lang="'+DAL.epubXml(lang)+'"><head><title>Cover</title><link rel="stylesheet" href="style.css"/></head><body>'+coverMarkup+'</body></html>')}];
  chapters.forEach(function(chapter){files.push({name:'EPUB/'+chapter.href,data:DAL.epubTextBytes('<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" lang="'+DAL.epubXml(lang)+'"><head><title>'+DAL.epubXml(chapter.title)+'</title><link rel="stylesheet" href="../style.css"/></head><body><section class="'+(chapter.artOnly?'art-page':'chapter')+'">'+(chapter.artOnly?'':'<h1>'+DAL.epubXml(chapter.title)+'</h1>')+chapter.body+'</section></body></html>')});});return files.concat(collector.files);
};
DAL.downloadBytes=function(filename,bytes,mime){return DAL.download(filename,bytes,mime);};
DAL.exportImageSession=function(limit){return {bytes:0,limit:limit||20*1024*1024,cache:new Map()};};
DAL.publicationChapterArt=function(proj,chapter,index){
  var images=(chapter.images||[]).concat(index==null?[]:DAL.bookPageImages(proj,index+3)),seen=new Set();
  return images.map(function(image){var source=DAL.imageSrc(proj,image),key=image.assetId||source;if(!source||seen.has(key))return '';seen.add(key);return '<figure class="publication-illustration"><img src="'+DAL.escapeHtml(source)+'" alt="'+DAL.escapeHtml(image.name||'Illustration')+'" style="max-width:100%;height:auto"/></figure>';}).join('');
};
DAL.publicationArtPages=function(proj){
  var minimum=(proj.chapters||[]).length+2,pages=new Set();
  (proj.images||[]).forEach(function(image){var page=Number(image.bookPage);if(Number.isSafeInteger(page)&&page>minimum)pages.add(page);});
  return Array.from(pages).sort(function(a,b){return a-b;}).map(function(page){return{page:page,html:DAL.publicationChapterArt(proj,{images:DAL.bookPageImages(proj,page)},null)};});
};
DAL.exportLocalImage=async function(proj,source,session,epub){
  var key=(epub?'epub:':'print:')+source;if(session.cache.has(key))return session.cache.get(key);
  var value=source;
  if(value.indexOf('blob:')===0){
    var asset=(DAL.allAssets?DAL.allAssets(proj):[]).find(function(record){return DAL.blobUrl&&DAL.blobUrl(record.id)===value;});
    if(!asset)throw new Error('An illustration is no longer available. Reopen the project and retry.');
    var stored=await DAL.blobStore.get(asset.id);if(!stored||!stored.blob)throw new Error('Missing illustration “'+asset.name+'” on this device.');
    if(!/^image\/(png|jpeg|jpg|webp|gif|avif)$/i.test(stored.blob.type||asset.mime||''))throw new Error('Use PNG, JPG, WEBP, GIF or AVIF illustrations for this export.');
    value=await new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(reader.result);};reader.onerror=function(){reject(new Error('An illustration could not be read.'));};reader.onabort=function(){reject(new Error('Illustration preparation was interrupted.'));};reader.readAsDataURL(stored.blob);});
  }
  value=DAL.safeImportedImage(value);if(!value)throw new Error('Export requires local, supported image files. Remote images are not downloaded.');
  session.bytes+=Math.ceil((value.length-value.indexOf(',')-1)*.75);if(session.bytes>session.limit)throw new Error('Export images exceed the 20 MB preparation limit. Resize them before exporting.');
  if(epub&&/^data:image\/(webp|avif);/i.test(value)){
    value=await new Promise(function(resolve,reject){
      var image=new Image(),timer=setTimeout(function(){finish(new Error('An illustration took too long to decode.'));},15000),settled=false;
      function finish(error,result){if(settled)return;settled=true;clearTimeout(timer);image.onload=null;image.onerror=null;image.src='';if(error)reject(error);else resolve(result);}
      image.onerror=function(){finish(new Error('This device could not decode an illustration. Use PNG or JPG and retry.'));};
      image.onload=function(){try{if(!image.naturalWidth||image.naturalWidth*image.naturalHeight>24000000)throw new Error('An illustration exceeds the 24-megapixel conversion limit. Resize it before exporting.');var canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;var ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image conversion is unavailable. Use PNG or JPG and retry.');ctx.drawImage(image,0,0);var result=canvas.toDataURL('image/png');canvas.width=canvas.height=0;if(result.indexOf('data:image/png;base64,')!==0)throw new Error('Image conversion failed.');finish(null,result);}catch(error){finish(error);}};image.src=value;
    });
    session.bytes+=Math.ceil((value.length-value.indexOf(',')-1)*.75);if(session.bytes>session.limit)throw new Error('Converted EPUB images exceed the 20 MB preparation limit. Resize them before exporting.');
  }
  session.cache.set(key,value);return value;
};
DAL.prepareEpub=async function(proj){
  var session=DAL.exportImageSession(),cover=DAL.bookPageImages(proj,1)[0];
  if(cover){cover.dataUrl=await DAL.exportLocalImage(proj,DAL.imageSrc(proj,cover),session,true);delete cover.assetId;}
  else if(proj.cover&&proj.cover.imageDataUrl){proj.images=proj.images||[];proj.images.unshift({id:'epub-cover',name:'Cover',bookPage:1,dataUrl:await DAL.exportLocalImage(proj,proj.cover.imageDataUrl,session,true)});}
  var chapterIndex=0;
  for(var chapter of proj.chapters||[]){
    var holder=document.createElement('div');holder.innerHTML=DAL.sanitizeRichHTML(chapter.contentHTML||'')+DAL.publicationChapterArt(proj,chapter,chapterIndex++);
    for(var image of Array.from(holder.querySelectorAll('img')))image.setAttribute('src',await DAL.exportLocalImage(proj,image.getAttribute('src')||'',session,true));
    chapter.contentHTML=holder.innerHTML;
  }
  proj._epubTocArt=DAL.publicationChapterArt(proj,{images:DAL.bookPageImages(proj,2)},null);
  proj._epubArtPages=DAL.publicationArtPages(proj);
  for(var page of [{html:proj._epubTocArt,toc:true}].concat(proj._epubArtPages)){
    var art=document.createElement('div');art.innerHTML=page.html;
    for(var image of Array.from(art.querySelectorAll('img')))image.setAttribute('src',await DAL.exportLocalImage(proj,image.getAttribute('src')||'',session,true));
    if(page.toc)proj._epubTocArt=art.innerHTML;else page.html=art.innerHTML;
  }
  return proj;
};
DAL.exportEpub=function(proj){
  if(!proj||DAL._epubPreparing){DAL.toast((DAL.i18n?DAL.i18n.text("ui_An_EPUB_is_already_being_prepared__347f160","An EPUB is already being prepared."):"An EPUB is already being prepared."),'info');return;}
  if(DAL.currentProjectId===proj.id&&DAL.currentTool==='manuscript'&&DAL.saveChapterContent)DAL.saveChapterContent();
  var snapshot=DAL.snapshotProject?DAL.snapshotProject(proj):DAL.clone(proj);if(!DAL.publicationCheck(snapshot).ready){DAL.toast((DAL.i18n?DAL.i18n.text("ui_Fix_the_Book_Design_publishing_errors_befo_d10c40c","Fix the Book Design publishing errors before exporting."):"Fix the Book Design publishing errors before exporting."),'warning');return;}
  DAL._epubPreparing=true;
  return DAL.prepareEpub(snapshot).then(async function(prepared){var files=DAL.epubFiles(prepared),bytes=DAL.makeZip(files);if(await DAL.downloadBytes(DAL.sanitizeFilename((prepared.cover&&prepared.cover.title)||prepared.name)+'.epub',bytes,'application/epub+zip'))DAL.toast(DAL.publicationText('publicationEpubReady','EPUB prepared with '+(prepared.chapters||[]).length+' chapters. Check the saved file before publishing.',{count:(prepared.chapters||[]).length}),'success');}).catch(function(error){DAL.toast(DAL.publicationText('publicationEpubFailed','EPUB export failed: '+error.message,{message:error.message}),'error');}).finally(function(){DAL._epubPreparing=false;});
};
DAL.bookPrintDocument=function(proj){
  var d=DAL.ensureBookDesign(proj),type=DAL.BOOK_TYPE[d.typography],title=(proj.cover&&proj.cover.title)||proj.name,author=(proj.cover&&proj.cover.author)||(DAL.state.autoFillAuthor?DAL.state.authorName:''),css='@page{size:'+d.width+'in '+d.height+'in;margin:'+d.top+'in '+d.right+'in '+d.bottom+'in '+(d.left+d.gutter)+'in}@page:left{margin-left:'+d.right+'in;margin-right:'+(d.left+d.gutter)+'in}@page:right{margin-left:'+(d.left+d.gutter)+'in;margin-right:'+d.right+'in}'+(d.pageNumbers?'@page{@bottom-center{content:counter(page);font:9pt '+type.body+'}}':'')+'body{font:'+d.fontSize+'pt/'+d.lineHeight+' '+type.body+';color:#000;background:#fff;margin:0}h1,h2{font-family:'+type.heading+';page-break-after:avoid}section.chapter{'+(d.chapterNewPage?'break-before:page;page-break-before:always;':'')+'}p{margin:0 0 .5em;text-indent:'+d.paragraphIndent+'in}section.chapter>p:first-of-type{text-indent:0}'+(d.dropCaps?'section.chapter>p:first-of-type::first-letter{float:left;font-size:3em;line-height:.85;margin-right:.08em}':'')+'img{max-width:100%;height:auto}.title-page{height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;break-after:page}.writer-page-break{break-after:page}',body='<section class="title-page"><h1>'+DAL.escapeHtml(title)+'</h1>'+(author?'<p>'+DAL.escapeHtml(author)+'</p>':'')+'</section>'+(proj.chapters||[]).map(function(chapter,index){return'<section class="chapter"><h1>'+DAL.escapeHtml(chapter.title)+'</h1>'+(DAL.writerPublishHTML?DAL.writerPublishHTML(proj,chapter):chapter.contentHTML)+DAL.publicationChapterArt(proj,chapter,index)+'</section>';}).join('');return {title:title,design:DAL.clone(d),html:'<!doctype html><html lang="'+DAL.escapeHtml(proj.language||'en')+'"><head><meta charset="utf-8"><title>'+DAL.escapeHtml(title)+'</title><style>'+css+'</style></head><body>'+body+'</body></html>'};
};

DAL.prepareBookPrint=async function(proj){
  var output=DAL.bookPrintDocument(proj),holder=document.createElement('div');holder.innerHTML=output.html.slice(output.html.indexOf('<body>')+6,output.html.lastIndexOf('</body>'));
  var contents=document.createElement('section');contents.setAttribute('class','print-contents');contents.setAttribute('style','break-after:page');contents.innerHTML=DAL.publicationChapterArt(proj,{images:DAL.bookPageImages(proj,2)},null)+'<h1>Contents</h1>'+(proj.chapters||[]).map(function(chapter){return'<p>'+DAL.escapeHtml(chapter.title)+'</p>';}).join('');holder.insertBefore(contents,holder.firstChild&&holder.firstChild.nextSibling);
  DAL.publicationArtPages(proj).forEach(function(page){var section=document.createElement('section');section.setAttribute('class','print-art-page');section.setAttribute('style','break-before:page;text-align:center');section.innerHTML=page.html;holder.appendChild(section);});
  var cover=DAL.bookPageImages&&DAL.bookPageImages(proj,1)[0],coverSource=cover&&DAL.imageSrc(proj,cover);
  if(!coverSource&&proj.cover&&proj.cover.imageDataUrl)coverSource=proj.cover.imageDataUrl;
  if(coverSource){var section=document.createElement('section');section.setAttribute('class','print-cover');section.setAttribute('style','break-after:page;text-align:center');var image=document.createElement('img');image.setAttribute('src',coverSource);image.setAttribute('alt',cover&&cover.name||'Cover');image.setAttribute('style','max-width:100%;max-height:90vh;object-fit:contain');section.appendChild(image);holder.insertBefore(section,holder.firstChild);}
  var images=Array.from(holder.querySelectorAll('img')),session=DAL.exportImageSession();
  for(var img of images){
    var source=img.getAttribute('src')||'';
    img.setAttribute('src',await DAL.exportLocalImage(proj,source,session,false));
  }
  Array.from(holder.querySelectorAll('a')).forEach(function(link){link.removeAttribute('href');link.removeAttribute('target');});
  output.html=output.html.slice(0,output.html.indexOf('<body>')+6)+holder.innerHTML+'</body></html>';
  if(output.html.length>32*1024*1024)throw new Error('The print document exceeds the 32 MB preparation limit. Reduce illustration sizes before printing.');
  return output;
};
DAL.printBook=function(proj){
  if(!proj||DAL._bookPrintPreparing){DAL.toast((DAL.i18n?DAL.i18n.text("ui_A_print_document_is_already_being_prepared_d9aea16","A print document is already being prepared."):"A print document is already being prepared."),'info');return;}
  if(DAL.currentProjectId===proj.id&&DAL.currentTool==='manuscript'&&DAL.saveChapterContent)DAL.saveChapterContent();
  var snapshot=DAL.snapshotProject?DAL.snapshotProject(proj):DAL.clone(proj),check=DAL.publicationCheck(snapshot);
  if(!check.ready){DAL.toast((DAL.i18n?DAL.i18n.text("ui_Fix_the_Book_Design_publishing_errors_befo_ff38840","Fix the Book Design publishing errors before printing."):"Fix the Book Design publishing errors before printing."),'warning');return;}
  var capacitor=window.Capacitor,native=capacitor&&capacitor.getPlatform&&capacitor.getPlatform()==='android',win=native?null:window.open('','_blank');
  if(!native&&!win){DAL.toast((DAL.i18n?DAL.i18n.text("ui_Allow_the_print_window_then_choose_Save_as_13c89aa","Allow the print window, then choose Save as PDF."):"Allow the print window, then choose Save as PDF."),'warning');return;}
  if(win){win.document.open();win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Preparing print copy</title></head><body><p>Preparing your offline print copy…</p></body></html>');win.document.close();}
  DAL._bookPrintPreparing=true;
  DAL.prepareBookPrint(snapshot).then(async function(output){
    if(native){
      var printPlugin=capacitor.Plugins&&capacitor.Plugins.BookPrint;
      if(!printPlugin&&typeof capacitor.registerPlugin==='function')printPlugin=capacitor.registerPlugin('BookPrint');
      if(!printPlugin)throw new Error('Android printing is unavailable in this app build.');
      var d=output.design;
      var result=await printPlugin.print({html:output.html,title:output.title,width:d.width,height:d.height,left:d.left+d.gutter,right:d.right,top:d.top,bottom:d.bottom});
      if(!result||!result.opened)throw new Error('Android did not open the print dialog.');
      DAL.toast((DAL.i18n?DAL.i18n.text("ui_Choose_Save_as_PDF_in_Android_s_print_dial_14cca5f","Choose Save as PDF in Android’s print dialog. Android printing cannot guarantee mirrored gutters, page numbers or store acceptance; inspect the resulting PDF."):"Choose Save as PDF in Android’s print dialog. Android printing cannot guarantee mirrored gutters, page numbers or store acceptance; inspect the resulting PDF."),'info');
    }else{
      if(win.closed)throw new Error('The print window was closed. Your manuscript is unchanged.');
      win.document.open();win.document.write(output.html);win.document.close();win.focus();
      await new Promise(function(resolve,reject){
        var timeout=setTimeout(function(){reject(new Error('The print images took too long to load.'));},30000);
        Promise.all(Array.from(win.document.images).map(function(image){if(image.complete)return image.naturalWidth?Promise.resolve():Promise.reject(new Error('A print image could not load.'));return new Promise(function(done,fail){image.onload=done;image.onerror=function(){fail(new Error('A print image could not load.'));};});})).then(function(){clearTimeout(timeout);resolve();},function(error){clearTimeout(timeout);reject(error);});
      });
      if(win.closed)throw new Error('The print window was closed.');win.print();
    }
  }).catch(function(error){if(win&&!win.closed){win.document.body.textContent='Print preparation failed: '+error.message;}DAL.toast('Could not prepare print copy: '+error.message,'warning');}).finally(function(){DAL._bookPrintPreparing=false;});
};

DAL.registerActionHandler(function(action,el){var proj=DAL.state.projects[DAL.currentProjectId]||DAL.exportTarget&&DAL.exportTarget(el);if(action==='export-epub'){if(proj)DAL.exportEpub(proj);return true;}if(action==='writer-print'){if(proj)DAL.printBook(proj);return true;}return false;});
document.addEventListener('change',function(event){
  var el=event.target,proj=DAL.state.projects[DAL.currentProjectId];if(!proj||!el.hasAttribute)return;
  if(el.hasAttribute('data-preview-profile')){
    if(['responsive','phone','tablet','kindle','ipad','paperback','hardcover'].indexOf(el.value)<0)return;
    if(proj.previewProfile===el.value)return;
    DAL.pushHistory();proj.previewProfile=el.value;DAL.saveState();DAL.render();return;
  }
  if(!el.hasAttribute('data-book-design'))return;
  var previous=DAL.ensureBookDesign(proj),design=DAL.clone(previous),field=el.getAttribute('data-book-design'),value;
  if(field==='trim'){
    if(!Object.prototype.hasOwnProperty.call(DAL.BOOK_TRIMS,el.value))return;
    design.trim=el.value;var preset=DAL.BOOK_TRIMS[el.value];['width','height','top','right','bottom','left','gutter'].forEach(function(key){design[key]=preset[key];});
  }else if(field==='typography'){
    if(!Object.prototype.hasOwnProperty.call(DAL.BOOK_TYPE,el.value))return;design[field]=el.value;
  }else if(['dropCaps','pageNumbers','chapterNewPage'].indexOf(field)>=0)design[field]=!!el.checked;
  else if(['width','height','top','right','bottom','left','gutter','fontSize','lineHeight','paragraphIndent'].indexOf(field)>=0){
    var bounds={width:[1,24],height:[1,36],top:[0,36],right:[0,24],bottom:[0,36],left:[0,24],gutter:[0,24],fontSize:[8,24],lineHeight:[1,3],paragraphIndent:[0,1]}[field];
    value=Number(el.value);if(!String(el.value).trim()||!Number.isFinite(value)||value<bounds[0]||value>bounds[1]){el.value=design[field];DAL.toast(DAL.publicationText('publicationSettingBounds','Enter a value between '+bounds[0]+' and '+bounds[1]+'. The previous setting was kept.',{minimum:bounds[0],maximum:bounds[1]}),'warning');return;}design[field]=value;
  }else return;
  if(JSON.stringify(previous)===JSON.stringify(design))return;
  DAL.pushHistory();proj.bookDesign=design;DAL.ensureBookDesign(proj);proj.updatedAt=Date.now();DAL.saveState();DAL.render();
});
