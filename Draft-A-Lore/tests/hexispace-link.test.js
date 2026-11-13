const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/core.js'), 'utf8');
const linkCode = source.slice(source.indexOf('DAL.HEXISPACE_URL ='), source.indexOf('DAL.runAction = function(action, el, e){'));

function setup(window) {
  const messages = [];
  const DAL = { toast: (...args) => messages.push(args) };
  vm.runInNewContext(linkCode, { DAL, window });
  return { DAL, messages };
}

test('HexiSpace appears between Library and Settings in the primary sidebar', () => {
  const library = source.indexOf('data-nav="library"');
  const hexispace = source.indexOf('data-nav="hexispace"');
  const settings = source.indexOf('data-nav="settings"');
  assert.ok(library >= 0 && hexispace > library && settings > hexispace);
  assert.match(source, /data-action="nav-hexispace"/);
  assert.match(source, /https:\/\/hexispace\.com\/draftalore\/me/);
});

test('desktop and browser builds open HexiSpace in a separate tab', () => {
  let opened;
  const { DAL } = setup({
    Capacitor: { getPlatform: () => 'web' },
    open: (url, target) => (opened = { url, target, opener: {} })
  });
  DAL.openHexiSpace();
  assert.equal(opened.url, 'https://hexispace.com/draftalore/me');
  assert.equal(opened.target, '_blank');
  assert.equal(opened.opener, null);
});

test('Android standalone builds hand the URL to the system browser', () => {
  let opened;
  const { DAL } = setup({
    Capacitor: { getPlatform: () => 'android' },
    location: { assign: url => (opened = url) },
    open: () => assert.fail('Android should use system URL handling')
  });
  DAL.openHexiSpace();
  assert.equal(opened, 'https://hexispace.com/draftalore/me');
});

test('blocked desktop pop-ups show a useful recovery message', () => {
  const { DAL, messages } = setup({
    Capacitor: { getPlatform: () => 'web' },
    open: () => null
  });
  DAL.openHexiSpace();
  assert.match(messages[0][0], /could not open/i);
  assert.equal(messages[0][1], 'error');
});