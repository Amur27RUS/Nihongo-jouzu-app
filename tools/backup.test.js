// Run with node --test tools/backup.test.js; no dependencies required.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { window: {}, TextEncoder };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/backup.js'), 'utf8'), context);
const backup = context.window.TANGO_BACKUP;
const plain = value => JSON.parse(JSON.stringify(value));
const state = () => ({
  v: 2, epoch: 0,
  words: { 'ねこ|猫': { b: 3, due: 20774, t: 1000, m: 1 }, 'g:verb:する': { b: 7, due: 20800, t: 1500 } },
  dev: { deviceA: { t: 50, d: { '2026-11-17': 50 } }, deviceB: { t: 20, d: {} } },
  days: { '2026-11-17': 1 }, passed: { animals: '2026-11-17' }
});
const file = progress => JSON.stringify({ app: 'genki-drill', version: 1, progress });

test('round trip preserves vocabulary, grammar, mistakes, schedule, XP and streak', () => {
  const s = state();
  assert.deepEqual(plain(backup.parse(backup.stringify(s))), s);
  assert.equal(JSON.parse(backup.stringify(s)).app, 'genki-drill');
});
test('empty progress is a valid backup', () => {
  const s = { v: 2, epoch: 0, words: {}, dev: {}, days: {}, passed: {} };
  assert.deepEqual(plain(backup.parse(backup.stringify(s))), s);
});
test('restore supersedes both resets and imported epochs without mutating input', () => {
  for (const [current, imported, now, expected] of [[100, 0, 50, 101], [0, 200, 50, 201], [0, 0, 500, 500]]) {
    const s = state(); s.epoch = imported;
    const restored = backup.restore(s, current, now);
    assert.deepEqual(plain(restored), { ...s, epoch: expected });
    assert.equal(s.epoch, imported);
    restored.words['ねこ|猫'].b = 0;
    assert.equal(s.words['ねこ|猫'].b, 3);
  }
});
test('rejects unrelated JSON, truncated files and unsupported formats', () => {
  for (const text of ['{', 'null', '[]', '{}', JSON.stringify(state()), file(null), file({ ...state(), v: 3 }),
    JSON.stringify({ app: 'other', version: 1, progress: state() }),
    JSON.stringify({ app: 'genki-drill', version: 2, progress: state() })]) {
    assert.throws(() => backup.parse(text));
  }
});
test('rejects malformed progress instead of silently clearing or coercing it', () => {
  const mutations = [
    s => delete s.words, s => { s.days = []; }, s => { s.epoch = -1; },
    s => { s.words['ねこ|猫'].b = 8; }, s => { s.words['ねこ|猫'].due = '20774'; },
    s => { s.words['ねこ|猫'].t = Infinity; }, s => { s.words['ねこ|猫'].m = 'yes'; },
    s => { s.dev.deviceA.t = -1; }, s => { s.dev.deviceA.d['2026-11-17'] = 1.5; },
    s => { s.days['2026-02-30'] = 1; }, s => { s.passed.animals = 'yesterday'; }
  ];
  for (const mutate of mutations) { const s = state(); mutate(s); assert.throws(() => backup.parse(file(s))); }
});
test('rejects prototype keys and oversized UTF-8 files', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const s = state(); s.words = JSON.parse(`{"${key}": {"b":0,"due":0,"t":0}}`);
    assert.throws(() => backup.parse(file(s)));
  }
  assert.throws(() => backup.parse(' '.repeat(backup.MAX_BYTES + 1)));
  const text = JSON.stringify({ app: 'genki-drill', version: 1, progress: state(), note: '猫'.repeat(backup.MAX_BYTES / 3) });
  assert.ok(text.length < backup.MAX_BYTES);
  assert.throws(() => backup.parse(text));
});
