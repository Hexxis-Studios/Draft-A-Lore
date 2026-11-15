const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'src/core.js'), 'utf8');
const escapeSource = core.match(/DAL\.escapeHtml = function\(str\)\{[^\n]*\};/);
assert.ok(escapeSource, 'the shared HTML escaper must remain available');
const context = { DAL: {} };
vm.runInNewContext(escapeSource[0] + '\nthis.escapeHtml = DAL.escapeHtml;', context);

test('HTML escaping protects quote-delimited attributes without a DOM allocation', () => {
  const payload = '" autofocus onfocus="alert(1)\'&<>';
  const escaped = context.escapeHtml(payload);
  assert.equal(escaped, '&quot; autofocus onfocus=&quot;alert(1)&#39;&amp;&lt;&gt;');
  const field = '<input value="' + escaped + '">';
  assert.equal((field.match(/"/g) || []).length, 2);
  assert.equal(context.escapeHtml(0), '0');
  assert.equal(context.escapeHtml(null), '');
});

test('new record ids use cryptographic UUIDs when available and retain a compatibility fallback', () => {
  const uidSource = core.match(/DAL\.uid = function\(prefix\)\{[^\n]*\};/);
  assert.ok(uidSource, 'the shared ID generator must remain available');
  const modern = { DAL: {}, window: { crypto: { randomUUID: () => '12345678-1234-1234-1234-123456789abc' } } };
  vm.runInNewContext(uidSource[0], modern);
  assert.equal(modern.DAL.uid('chapter'), 'chapter_12345678123412341234123456789abc');
  const fallback = { DAL: {}, Date, Math };
  vm.runInNewContext(uidSource[0], fallback);
  assert.match(fallback.DAL.uid('chapter'), /^chapter_[a-z0-9]+$/);
});
test('generated app pages keep the narrow offline-compatible CSP directives', () => {
  const build = fs.readFileSync(path.join(root, 'build.py'), 'utf8');
  assert.match(build, /Content-Security-Policy/);
  assert.match(build, /connect-src 'self' https:\/\/www\.googleapis\.com https:\/\/accounts\.google\.com https:\/\/oauth2\.googleapis\.com http:\/\/127\.0\.0\.1:\*/);
  assert.match(build, /object-src 'none'; base-uri 'none'/);
});

test('Windows shortcut installer uses the launcher and contains no self-evaluating PowerShell', () => {
  const batch = fs.readFileSync(path.join(root, 'releases/Install-DraftALore.bat'), 'utf8');
  const launcher = fs.readFileSync(path.join(root, 'build-windows.ps1'), 'utf8');
  assert.doesNotMatch(batch, /Invoke-Expression|ExecutionPolicy Bypass|EnableDelayedExpansion/i);
  assert.match(batch, /"%DAL_LAUNCHER%" --install-shortcuts/);
  assert.match(launcher, /--install-shortcuts/);
  assert.match(launcher, /Process\.GetCurrentProcess\(\)\.MainModule\.FileName/);
  assert.match(launcher, /SetShortcutProperty\(shortcutType, shortcut, "TargetPath", launcherPath\)/);
});