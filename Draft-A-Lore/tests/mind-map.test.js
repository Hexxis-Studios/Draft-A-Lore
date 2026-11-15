const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function mindMapApi() {
  let nextId = 0;
  const DAL = {
    CTX: {}, SELECT: {}, PASTE: {}, DROP: {}, CLIP_LABELS: {},
    state: { projects: {} },
    uid(prefix) { return (prefix || 'id') + '_' + (++nextId); },
    clone(value) { return JSON.parse(JSON.stringify(value)); },
    escapeHtml: String,
    infoIcon() { return ''; },
    registerAfterRender() {},
    pushHistory() { this.historyCalls = (this.historyCalls || 0) + 1; },
    saveState() { this.saveCalls = (this.saveCalls || 0) + 1; },
    render() { this.renderCalls = (this.renderCalls || 0) + 1; },
    toast() {}
  };
  const document = {
    addEventListener() {}, getElementById() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; }
  };
  const sandbox = { DAL, document, window: { addEventListener() {} }, Date, setTimeout, clearTimeout, console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'story-tools.js'), 'utf8'), sandbox, { filename: 'story-tools.js' });
  return DAL;
}

test('new mind-map ideas fit the visible phone canvas and avoid existing nodes',()=>{
  const DAL=mindMapApi();DAL.canvasView=project=>project.canvasView||(project.canvasView={zoom:1,scrollX:0,scrollY:0});
  const project={mindmap:{nodes:[],edges:[]}},viewport={clientWidth:360,clientHeight:520,scrollLeft:0,scrollTop:0};
  const first=DAL.mindMapNodePosition(project,viewport);
  assert.ok(first.x>=0&&first.x+220<=360);assert.ok(first.y>=0&&first.y+120<=520);
  project.mindmap.nodes.push({id:'one',...first});
  const second=DAL.mindMapNodePosition(project,viewport);
  assert.notDeepEqual(second,first);assert.ok(second.x>=0&&second.x+220<=360);assert.ok(second.y>=0&&second.y+120<=520);
});
test('revealing a new mind-map node pans and persists its location',()=>{
  const DAL=mindMapApi();const project={canvasView:{zoom:1},mindmap:{nodes:[{id:'node',x:1200,y:800}],edges:[]}};
  const container={clientWidth:360,clientHeight:500,scrollWidth:2600,scrollHeight:1700,scrollLeft:0,scrollTop:0};
  DAL.canvasView=p=>p.canvasView;DAL.canvasEls=()=>({container,stage:{}});DAL.currentProjectId='p';DAL.state.projects.p=project;
  assert.equal(DAL.revealMindMapNode('node'),true);assert.ok(container.scrollLeft>0);assert.ok(container.scrollTop>0);
  assert.equal(project.canvasView.scrollX,container.scrollLeft);assert.equal(project.canvasView.scrollY,container.scrollTop);assert.equal(DAL.saveCalls,1);
});
test('mind map connections reject self-links and duplicate lines', () => {
  const DAL = mindMapApi();
  const project = { mindmap: { nodes: [{ id: 'a' }, { id: 'b' }], edges: [] } };
  assert.equal(DAL.connectMindMapNodes(project, 'a', 'b'), true);
  assert.equal(project.mindmap.edges.length, 1);
  assert.equal(DAL.connectMindMapNodes(project, 'b', 'a'), false);
  assert.equal(DAL.connectMindMapNodes(project, 'a', 'a'), false);
  assert.equal(DAL.connectMindMapNodes(project, 'a', 'missing'), false);
  assert.equal(project.mindmap.edges.length, 1);
});

test('deleting a mind map idea also removes every attached connection', () => {
  const DAL = mindMapApi();
  DAL.currentProjectId = 'project';
  DAL.selectedNodeId = 'a';
  DAL.state.projects.project = {
    mindmap: {
      nodes: [{ id: 'a', label: 'First' }, { id: 'b', label: 'Second' }, { id: 'c', label: 'Third' }],
      edges: [{ id: 'ab', from: 'a', to: 'b' }, { id: 'ca', from: 'c', to: 'a' }, { id: 'bc', from: 'b', to: 'c' }]
    }
  };

  assert.equal(DAL.removeMindMapNode('a'), true);
  assert.deepEqual(DAL.state.projects.project.mindmap.nodes.map(node => node.id), ['b', 'c']);
  assert.deepEqual(DAL.state.projects.project.mindmap.edges.map(edge => edge.id), ['bc']);
  assert.equal(DAL.selectedNodeId, null);
  assert.equal(DAL.historyCalls, 1);
  assert.equal(DAL.saveCalls, 1);
  assert.equal(DAL.renderCalls, 1);
});

test('mind map safely renders hostile identifiers and coordinates without changing them', () => {
  const DAL = mindMapApi();
  DAL.escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  DAL.uiLabel = (_key, fallback) => fallback; DAL.canvasViewControls = () => '';
  const id = 'node" autofocus onfocus="alert(1)';
  const project = {mindmap:{nodes:[{id,label:'Idea',x:'0px" onmouseover="alert(1)',y:42}],edges:[]}};
  const html = DAL.renderMindMap(project);
  assert.ok(html.includes('data-nid="node&quot; autofocus onfocus=&quot;alert(1)"'));
  assert.ok(html.includes('style="left:0px;top:42px;'));
  assert.equal(html.includes('onmouseover='),false);
  assert.equal(project.mindmap.nodes[0].id,id);
});
