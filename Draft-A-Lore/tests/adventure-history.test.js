const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function api() {
  const listeners = {};
  const document = {
    addEventListener(type, handler) { (listeners[type] ||= []).push(handler); },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  const DAL = {
    state: { projects: {} }, CTX: {}, SELECT: {}, PASTE: {}, DROP: {},
    registerAfterRender() {}, pushHistory() { this.historyCalls = (this.historyCalls || 0) + 1; }
  };
  const sandbox = {
    DAL, document, window: { addEventListener() {} }, console, Date,
    setTimeout, clearTimeout, setInterval, clearInterval, confirm() { return true; }
  };
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'src', 'adventure-tools.js'), 'utf8'),
    sandbox,
    { filename: 'adventure-tools.js' }
  );
  return { DAL, listeners };
}

test('script-safe adventure JSON preserves hostile text without breaking the data', () => {
  const { DAL } = api();
  const payload = { text: '</script><script>window.compromised=true</script><!--\u2028\u2029' };
  const encoded = DAL.scriptSafeJSON(payload);
  assert.equal(encoded.includes('<'), false);
  assert.equal(encoded.includes('\u2028'), false);
  assert.equal(encoded.includes('\u2029'), false);
  assert.match(encoded, /\\u003c\/script>/);
  assert.deepEqual(JSON.parse(encoded), payload);
});

test('all playable and Twine exports use the script-safe serializer', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'adventure-tools.js'), 'utf8');
  const safeCalls = source.match(/DAL\.scriptSafeJSON\((?:data|out\.data)\)/g) || [];
  assert.equal(safeCalls.length, 2);
  assert.doesNotMatch(source, /JSON\.stringify\((?:data|out\.data)\)/);
});

test('an RPG editor control creates one undo point per focus session', () => {
  const { DAL, listeners } = api();
  const control = {
    _dalHistoryCaptured: false,
    matches(selector) { return selector.includes('[data-node-field]'); }
  };

  DAL.captureAdventureEdit(control);
  DAL.captureAdventureEdit(control);
  assert.equal(DAL.historyCalls, 1);

  for (const handler of listeners.focusout || []) handler({ target: control });
  DAL.captureAdventureEdit(control);
  assert.equal(DAL.historyCalls, 2);
});

test('unrelated controls do not create RPG undo points', () => {
  const { DAL } = api();
  DAL.captureAdventureEdit({ matches() { return false; } });
  assert.equal(DAL.historyCalls, undefined);
});

test('a newly created scene is immediately available to selection actions', () => {
  const { DAL } = api();
  DAL.currentProjectId = 'project';
  DAL.state.projects.project = {
    adventure: { stats: [], traits: [], flags: [], items: [], nodes: [], rules: { failures: [] } }
  };
  DAL.uid = () => 'new-scene';
  DAL.nodeSpawnPoint = () => ({ x: 40, y: 60 });
  DAL.saveState = () => {};
  DAL.render = () => {};
  DAL.select = (kind, id) => { DAL.selection = { kind, id }; };

  DAL.handleAdventureClick('sg-add-node', {}, {});

  assert.deepEqual(DAL.selection, { kind: 'rpg-node', id: 'new-scene' });
  assert.equal(DAL.selectedNodeId, 'new-scene');
});

test('story graph keeps hostile scene IDs inside their attributes', () => {
  const { DAL } = api();
  DAL.escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  DAL.uiLabel = (_key, fallback) => fallback;
  DAL.canvasViewControls = () => '';
  const hostile = 'scene" autofocus onfocus="alert(1)';
  const project = {name:'Test',adventure:{nodes:[{id:hostile,title:'Scene',text:'',choices:[]}],stats:[],traits:[],flags:[],items:[],rules:{failures:[]}}};
  const html = DAL.renderStoryGraph(project);
  assert.ok(html.includes('data-nid="scene&quot; autofocus onfocus=&quot;alert(1)"'));
  assert.equal(html.includes('data-nid="scene" autofocus'), false);
  assert.equal(project.adventure.nodes[0].id, hostile);
});

test('story graph treats scene coordinates as numbers before rendering styles', () => {
  const { DAL } = api();
  DAL.escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  DAL.uiLabel = (_key, fallback) => fallback; DAL.canvasViewControls = () => '';
  const project = {name:'Test',adventure:{nodes:[{id:'n',title:'Scene',x:'0px" onmouseover="alert(1)',y:42,choices:[]}],stats:[],traits:[],flags:[],items:[],rules:{failures:[]}}};
  const html = DAL.renderStoryGraph(project);
  assert.ok(html.includes('style="left:0px;top:42px"'));
  assert.equal(html.includes('onmouseover='),false);
});

test('RPG editor keeps untrusted node IDs inside attributes and datalist names', () => {
  const { DAL } = api();
  DAL.escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  DAL.uiLabel = (_key, fallback) => fallback;
  DAL.rpgPickLists = () => ({flags:[],stats:[],traits:[],items:[],nodes:[]});
  DAL.rpgOptions = () => '';
  const html = DAL.renderEffectRow('entry',0,{type:'flag',key:'flag',op:'set'}, {}, 'scene" onfocus="alert(1)', undefined);
  assert.ok(html.includes('data-nid="scene&quot; onfocus=&quot;alert(1)"'));
  assert.equal(html.includes('data-nid="scene" onfocus='),false);
  assert.equal(html.includes('list="effflags_scene" onfocus='),false);
});
