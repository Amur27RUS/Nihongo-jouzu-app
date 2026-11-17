#!/usr/bin/env node
// Static checks for the built index.html: scripts parse, word ids are unique, old progress still maps to words,
// every word has an English gloss, and the three interface languages share the same keys.
// Run from the repository root:  node tools/check.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const file = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const fail = msg => { console.error('FAIL: ' + msg); process.exitCode = 1; };
blocks.forEach((b, i) => { try { new vm.Script(b); } catch (e) { fail(`script ${i} does not parse: ${e.message}`); } });

const ctx = { window: {} }; vm.runInNewContext(blocks[0], ctx);
const { TANGO_COURSE: C, TANGO_EN: EN, TANGO_I18N: I, TANGO_LEGACY_V1: LEG } = ctx.window;
const cyr = s => /[А-Яа-яЁё]/.test(s || '');
const words = C.flatMap(l => l.topics.flatMap(t => t.items.map(it => ({ id: it[0] + '|' + it[1], topic: t.id, kana: it[0], kanji: it[1], ru: it[3], note: it[4] }))));
const ids = words.map(w => w.id), dups = ids.filter((x, i) => ids.indexOf(x) !== i);
if (dups.length) fail('duplicate word ids: ' + dups.join(', '));
const lost = Object.values(LEG).flat().filter(id => !ids.includes(id));
if (lost.length) fail('old progress keys no longer match a word: ' + lost.join(', '));

for (const w of words) {
  const e = EN.word(w);
  if (!e || !e[0]) fail('no English gloss: ' + w.id);
  else if (cyr(e[0]) || cyr(e[1])) fail('Russian text in the English gloss: ' + w.id);
  else if (e[1] == null && cyr(w.note)) fail('Russian note without an English one: ' + w.id);
}
for (const l of C) {
  if (!EN.lessons[l.id]) fail('lesson name not translated: ' + l.id);
  for (const t of l.topics) if (!EN.topics[t.id]) fail('topic name not translated: ' + t.id);
  for (const d of l.drills || []) if (!EN.drills[d.id]) fail('exercise name not translated: ' + d.id);
}
const keys = o => Object.keys(o).sort().join(',');
for (const L of ['en', 'ja']) if (keys(I[L]) !== keys(I.ru)) fail(`interface keys differ between ru and ${L}`);
const used = [...new Set([...html.matchAll(/(?<![A-Za-z0-9_$.])t\('([a-zA-Z0-9]+)'/g)].map(m => m[1]))].filter(k => !(k in I.ru));
const marked = [...html.matchAll(/data-t(?:-aria|-title|-ph)?="([a-zA-Z0-9]+)"/g)].map(m => m[1]).filter(k => !(k in I.ru));
if (used.length) fail('code uses unknown text keys: ' + used.join(', '));
if (marked.length) fail('page uses unknown text keys: ' + marked.join(', '));

if (!process.exitCode) console.log(`ok: ${C.length} lessons, ${words.length} words, ${Object.keys(I.ru).length} interface strings in 3 languages`);
