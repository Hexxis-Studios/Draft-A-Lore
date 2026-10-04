const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=fs.readFileSync(path.join(__dirname,'../../src/core.js'),'utf8');
function loadWordCounters(DAL,document){
  const context=vm.createContext({DAL,document});
  vm.runInContext(core.slice(core.indexOf('DAL.manuscriptTextModel ='),core.indexOf('DAL.formatNumber =')),context);
  vm.runInContext(core.slice(core.indexOf('DAL.WORD_COUNT_VERSION ='),core.indexOf('DAL.dateKey =')),context);
  return DAL;
}
module.exports={loadWordCounters};
