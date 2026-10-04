const fs=require('node:fs');
const path=require('node:path');
const {parse}=require('@formatjs/icu-messageformat-parser');
function argumentsIn(message){
  const argumentsUsed=new Set();
  function walk(nodes){for(const node of nodes){if([1,2,3,4,5,6].includes(node.type))argumentsUsed.add(node.value);if(node.options)for(const option of Object.values(node.options))walk(option.value);if(node.children)walk(node.children);}}
  walk(parse(message));return [...argumentsUsed].sort();
}
function validateResources(source,translated){
  if(JSON.stringify(Object.keys(source).sort())!==JSON.stringify(Object.keys(translated).sort()))throw new Error('Translation keys do not match English.');
  for(const key of Object.keys(source)){
    if(typeof translated[key]!=='string'||!translated[key].trim())throw new Error('Blank translation: '+key);
    if(JSON.stringify(argumentsIn(source[key]))!==JSON.stringify(argumentsIn(translated[key])))throw new Error('ICU variables changed: '+key);
  }
}
module.exports={validateResources};
if(require.main===module){
  const directory=path.join(__dirname,'../src/locales');
  const source=JSON.parse(fs.readFileSync(path.join(directory,'en.json'),'utf8'));
  const catalog=JSON.parse(fs.readFileSync(path.join(directory,'catalog.json'),'utf8'));
  for(const [code,entry] of Object.entries(catalog))if(entry.released)validateResources(source,JSON.parse(fs.readFileSync(path.join(directory,code+'.json'),'utf8')));
}
