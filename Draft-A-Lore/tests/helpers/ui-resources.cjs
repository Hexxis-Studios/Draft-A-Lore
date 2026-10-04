const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=fs.readFileSync(path.join(__dirname,'../../src/core.js'),'utf8');
function loadUiResources(DAL){
  vm.runInNewContext(core.slice(core.indexOf('DAL.toolLabel='),core.indexOf('DAL.uid =')),{DAL,Intl,Date});
  return DAL;
}
module.exports={loadUiResources};
