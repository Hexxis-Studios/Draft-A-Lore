const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {validateResources}=require('./validate-locales.cjs');
const directory=path.join(__dirname,'../src/locales');
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(Object.keys(value).sort().map(key=>[key,value[key]]))).digest('hex');}
function resources(){return JSON.parse(fs.readFileSync(path.join(directory,'en.json'),'utf8'));}
function catalog(){return JSON.parse(fs.readFileSync(path.join(directory,'catalog.json'),'utf8'));}
function exchange(locale,translated){
  const source=resources(),languages=catalog();if(!languages[locale]||locale==='en')throw new Error('Choose one of the planned non-English locales.');
  return {kind:'draft-a-lore-translation',schemaVersion:1,locale,nativeName:languages[locale].name,sourceHash:digest(source),instructions:'Translate interface controls only. Preserve ICU arguments and syntax, Draft A Lore branding, format names, and technical identifiers. This packet does not enable the locale or record human review.',messages:Object.fromEntries(Object.entries(source).map(([key,value])=>[key,{source:value,translation:translated&&translated[key]||''}]))};
}
function importPacket(packet){
  if(!packet||packet.kind!=='draft-a-lore-translation'||packet.schemaVersion!==1)throw new Error('Not a supported translation packet.');
  const source=resources(),expected=exchange(packet.locale);
  if(packet.sourceHash!==expected.sourceHash)throw new Error('English labels changed after this packet was exported. Export an updated packet; no locale files were changed.');
  if(!packet.messages||JSON.stringify(Object.keys(packet.messages).sort())!==JSON.stringify(Object.keys(source).sort()))throw new Error('Translation message keys differ from English.');
  const translated={};for(const [key,value] of Object.entries(source)){
    const entry=packet.messages[key];if(!entry||entry.source!==value||typeof entry.translation!=='string'||/[\u0000\u0008\u000b\u000c]/.test(entry.translation))throw new Error('Invalid message: '+key);
    translated[key]=entry.translation;
  }
  validateResources(source,translated);return {locale:packet.locale,translated};
}
module.exports={digest,exchange,importPacket};
if(require.main===module){
  try{
    const [command,localeOrFile,destination]=process.argv.slice(2);
    if(command==='export'){
      if(!destination)throw new Error('Usage: node scripts/translation-exchange.cjs export <locale> <new-output-file>');
      const localeFile=path.join(directory,localeOrFile+'.json');
      const packet=exchange(localeOrFile,fs.existsSync(localeFile)?JSON.parse(fs.readFileSync(localeFile,'utf8')):null);
      fs.writeFileSync(destination,JSON.stringify(packet,null,2)+'\n',{flag:'wx'});console.log('Offline translation packet exported. No locale was released.');
    }else if(command==='import'){
      if(!localeOrFile)throw new Error('Usage: node scripts/translation-exchange.cjs import <completed-packet>');
      if(fs.statSync(localeOrFile).size>16*1024*1024)throw new Error('Translation packet exceeds 16 MB.');
      const result=importPacket(JSON.parse(fs.readFileSync(localeOrFile,'utf8'))),file=path.join(directory,result.locale+'.json');
      const languages=catalog();if(languages[result.locale].released)throw new Error('Do not replace a released translation without review. Unrelease it explicitly first.');
      if(fs.existsSync(file))fs.copyFileSync(file,file+'.previous-'+Date.now(),fs.constants.COPYFILE_EXCL);
      fs.writeFileSync(file,JSON.stringify(result.translated,null,2)+'\n');console.log('Translation imported as an unreleased draft. Human review and platform layout checks still required.');
    }else if(command==='status'){
      const source=resources();for(const [locale,entry] of Object.entries(catalog())){
        const file=path.join(directory,locale+'.json');let complete=false,error='No draft';
        if(fs.existsSync(file))try{validateResources(source,JSON.parse(fs.readFileSync(file,'utf8')));complete=true;error='';}catch(problem){error=problem.message;}
        console.log(locale+' | '+entry.name+' | '+(entry.released?'released':'unreleased')+' | '+(complete?'complete resources':error));
      }
    }else throw new Error('Commands: export, import, status. All operate on local files; no translation service or content upload.');
  }catch(error){console.error(error.message);process.exitCode=1;}
}
