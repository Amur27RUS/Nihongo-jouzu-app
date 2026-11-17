(() => {
const COURSE = window.TANGO_COURSE;
const TOPICS = COURSE.flatMap(l => l.topics.map(t => Object.assign(t, { lesson: l.id })));
const WORDS = TOPICS.flatMap(t => t.items.map(it => ({ id: it[0] + '|' + it[1], topic: t.id, lesson: t.lesson, kana: it[0], kanji: it[1], romaji: it[2], ru: it[3], note: it[4], ex: it[5] })));
const lessonOf = id => COURSE.find(l => l.id === id);
const wordsOf = lessonId => WORDS.filter(w => w.lesson === lessonId);

// ---------- Helpers ----------
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
const dayKey = (d = new Date()) => d.toLocaleDateString('sv-SE');
const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5); // local day number
const SMALL = 'ゃゅょャュョぁぃぅぇぉァィゥェォー';
const graphemes = s => { const o = []; for (const ch of s.replace(/\s/g, '')) { if (SMALL.includes(ch) && o.length) o[o.length - 1] += ch; else o.push(ch); } return o; };
const hasKanji = w => w.kanji && w.kanji !== w.kana;
const showK = w => PREF.kanji !== false && hasKanji(w); // the learner can hide kanji and study in kana only
const hintKanji = w => showK(w) && !/^\d/.test(w.kanji); // "14日" next to じゅうよっか would give the answer away
const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

// ---------- Grammar drills: items that behave like words (id, prompt, answer) ----------
// class: u = 1-е спряжение, ru = 2-е, irr = неправильный
const VERBS = [['いく','u','идти, ехать',3],['きく','u','слушать',3],['はなす','u','говорить',3],['のむ','u','пить',3],['よむ','u','читать',3],['かえる','u','возвращаться',3],
 ['おきる','ru','вставать',3],['たべる','ru','есть',3],['ねる','ru','спать',3],['みる','ru','смотреть',3],['くる','irr','приходить',3],['する','irr','делать',3],['べんきょうする','irr','учиться',3],
 ['ある','u','быть (неодуш.)',4],['いる','ru','быть (одуш.)',4],['かう','u','покупать',4],['まつ','u','ждать',4],['とる','u','фотографировать',4]];
const I_ROW = { 'う':'い','く':'き','ぐ':'ぎ','す':'し','つ':'ち','ぬ':'に','ぶ':'び','む':'み','る':'り' };
function stems(v, cls) { // [right stem, a typical wrong stem]
  const head = v.slice(0, -1), last = v.slice(-1);
  if (cls === 'irr') return v.endsWith('くる') ? ['き', 'くり'] : [v.slice(0, -2) + 'し', v.slice(0, -2) + 'すり'];
  if (cls === 'ru') return [head, head + 'り'];
  return [head + I_ROW[last], last === 'る' ? head : v];
}
const VERB_RULE = { u: '1-е спряжение: последний слог меняется на «и»-ряд', ru: '2-е спряжение: убираем る', irr: 'неправильный глагол, форму нужно запомнить' };
function verbDrill(set, past) {
  return VERBS.filter(v => v[3] <= (past ? 4 : 3)).flatMap(([v, cls, ru]) => {
    const [st, bad] = stems(v, cls), note = v === 'かえる' ? 'かえる — исключение: спрягается по 1-му спряжению' : VERB_RULE[cls];
    const mk = (form, kind, answer, wrong) => ({ id: `g:${set}:${v}:${form}`, g: 1, kind, jp: v, ru, kana: answer, answer, wrong, note });
    return past
      ? [mk('past', 'Прошедшее время, утверждение', st + 'ました', [st + 'ます', st + 'ませんでした', bad + 'ました']),
         mk('pastneg', 'Прошедшее время, отрицание', st + 'ませんでした', [st + 'ません', st + 'ました', bad + 'ませんでした'])]
      : [mk('masu', 'Вежливая форма, утверждение', st + 'ます', [st + 'ません', bad + 'ます', bad + 'ません']),
         mk('masen', 'Вежливая форма, отрицание', st + 'ません', [st + 'ます', bad + 'ません', bad + 'ます'])];
  });
}
function adjDrill(set, past) {
  const seen = new Set(), out = [];
  WORDS.filter(w => w.topic === 'iadj' || w.topic === 'naadj').forEach(w => {
    if (seen.has(w.kana)) return; seen.add(w.kana);
    const k = w.kana, isI = w.topic === 'iadj', yo = k.endsWith('いい') && isI && (k === 'いい' || k === 'かっこいい');
    const st = isI ? (yo ? k.slice(0, -2) + 'よ' : k.slice(0, -1)) : k, fake = isI ? k.slice(0, -1) : (k.endsWith('い') ? k.slice(0, -1) : k);
    const note = yo ? 'いい → よ-: よくない, よかった' : isI ? 'い-прилагательное: い → くない / かった / くなかった' : 'な-прилагательное: じゃないです / でした / じゃなかったです';
    const mk = (form, kind, answer, wrong) => out.push({ id: `g:${set}:${k}:${form}`, g: 1, kind, jp: k, ru: w.ru, kana: answer, answer, wrong, note });
    if (isI) {
      if (!past) mk('neg', 'Настоящее время, отрицание', st + 'くないです', [yo ? fake + 'くないです' : k + 'じゃないです', st + 'くないでした', st + 'かったです']);
      else {
        mk('past', 'Прошедшее время, утверждение', st + 'かったです', [yo ? fake + 'かったです' : k + 'でした', st + 'くなかったです', st + 'くないです']);
        mk('pastneg', 'Прошедшее время, отрицание', st + 'くなかったです', [yo ? fake + 'くなかったです' : k + 'じゃなかったです', st + 'かったです', st + 'くないでした']);
      }
    } else if (!past) mk('neg', 'Настоящее время, отрицание', k + 'じゃないです', [fake + 'くないです', k + 'でした', k + 'じゃなかったです']);
    else {
      mk('past', 'Прошедшее время, утверждение', k + 'でした', [fake + 'かったです', k + 'じゃないです', k + 'じゃなかったです']);
      mk('pastneg', 'Прошедшее время, отрицание', k + 'じゃなかったです', [fake + 'くなかったです', k + 'でした', k + 'じゃないでした']);
    }
  });
  return out;
}
// «давайте»: the stem before ます + ましょう, and an invitation with ませんか (ある and いる make no sense as invitations)
function letDrill(set) {
  return VERBS.filter(v => v[0] !== 'ある' && v[0] !== 'いる').flatMap(([v, cls, ru]) => {
    const [st, bad] = stems(v, cls), note = (v === 'かえる' ? 'かえる — исключение, 1-е спряжение' : VERB_RULE[cls]) + '; ましょう и ませんか ставятся туда же, где ます';
    const mk = (form, kind, answer, wrong) => ({ id: `g:${set}:${v}:${form}`, g: 1, kind, jp: v, ru, kana: answer, answer, note,
      wrong: [...new Set(wrong)].filter(x => x !== answer) });
    return [mk('let', 'Давай сделаем: 〜ましょう', st + 'ましょう', [st + 'ます', bad + 'ましょう', v + 'ましょう', st + 'ませんか']),
            mk('inv', 'Приглашение: 〜ませんか', st + 'ませんか', [st + 'ましょう', st + 'ません', bad + 'ませんか'])];
  });
}
const GEN = { verbPres: s => verbDrill(s, false), verbPast: s => verbDrill(s, true), adjPres: s => adjDrill(s, false), adjPast: s => adjDrill(s, true), verbLet: s => letDrill(s) };
const DRILLS = {};
COURSE.forEach(l => (l.drills || []).forEach(d => {
  DRILLS[d.id] = d.gen ? GEN[d.gen](d.id) : d.items.map(it => it.tiles
    ? { id: `g:${d.id}:${it.tiles.join('')}`, g: 1, kind: it.k, ru: it.ru, tiles: it.tiles, extra: it.extra, free: it.free, kana: it.tiles.join(''), answer: it.tiles.join(' '), note: it.ex }
    : { id: `g:${d.id}:${it.jp}`, g: 1, kind: it.k, jp: it.jp, ru: it.ru, answer: it.a, wrong: it.w, kana: it.jp.replace('＿', it.a === '×' ? ' ' : it.a.length <= 2 ? it.a + ' ' : it.a).replace(/\s+/g, ' ').trim(), note: it.ex });
}));

// ---------- State ----------
// S is the synced progress: words[id] = {b: box 0..7, due: day number, t: changed-at ms, m: 1 if in "mistakes"} (grammar drill items live here too),
// dev[deviceId] = {t: total XP earned on that device, d: {date: XP}}, days = {date: 1} with a finished lesson, passed = {topicId: date}.
const KEY = 'tango-drill-v2', KEY_V1 = 'tango-drill-v1', KEY_PREF = 'tango-drill-pref';
const PREF = Object.assign({ sound: true, kanji: true, dev: 'd' + Math.random().toString(36).slice(2, 10) }, ls.get(KEY_PREF) || {});
ls.set(KEY_PREF, PREF);
const DEV = PREF.dev;

// ---------- Language: interface text and word meanings ----------
// Russian shows the Russian glosses; English and Japanese show the English ones. Grammar notes and grammar exercises stay in Russian.
const I18N = window.TANGO_I18N, EN = window.TANGO_EN, LANGS = ['ru', 'en', 'ja'];
const lang = () => LANGS.includes(PREF.lang) ? PREF.lang : 'ru';
function t(key, ...a) { const v = I18N[lang()][key] ?? I18N.ru[key]; return typeof v === 'function' ? v(...a) : v; }
const cyr = s => /[А-Яа-яЁё]/.test(s || '');
function localizeWords() {
  const L_ = lang();
  WORDS.forEach(w => {
    if (L_ === 'ru') { w.gl = w.ru; w.nt = w.note; return; }
    const e = EN.word(w); w.gl = e ? e[0] : w.ru; w.nt = e && e[1] != null ? e[1] : (cyr(w.note) ? '' : w.note);
  });
  Object.values(DRILLS).forEach(items => items.forEach(x => { x.gl = x.ru; x.nt = x.note; }));
}
const loc = (table, id, i, fallback) => { if (lang() === 'ru') return fallback; const e = table[id]; return (e && (Array.isArray(e) ? e[lang() === 'en' ? 0 : 1] : (e[lang()] || [])[i])) || fallback; };
const lname = l => loc(EN.lessons, l.id, 0, l.name), lsub = l => loc(EN.lessons, l.id, 1, l.sub);
const tname = tp => loc(EN.topics, tp.id, 0, tp.name), dname = d => loc(EN.drills, d.id, 0, d.name);
// static text in the page: data-t = text, data-t-aria = aria-label, data-t-title = title, data-t-ph = placeholder
function applyStatic() {
  document.documentElement.lang = lang();
  document.querySelectorAll('[data-t]').forEach(e => { e.textContent = t(e.dataset.t); });
  document.querySelectorAll('[data-t-aria]').forEach(e => e.setAttribute('aria-label', t(e.dataset.tAria)));
  document.querySelectorAll('[data-t-title]').forEach(e => e.setAttribute('title', t(e.dataset.tTitle)));
  document.querySelectorAll('[data-t-ph]').forEach(e => e.setAttribute('placeholder', t(e.dataset.tPh)));
}
const fresh = (epoch = 0) => ({ v: 2, epoch, words: {}, dev: {}, days: {}, passed: {} });
function sanitize(o) {
  if (!o || typeof o !== 'object') return null;
  const s = fresh(+o.epoch || 0), obj = x => (x && typeof x === 'object' ? x : {});
  for (const [k, r] of Object.entries(obj(o.words))) if (r && typeof r === 'object') { s.words[k] = { b: clamp(Math.round(+r.b || 0), 0, 7), due: Math.round(+r.due || 0), t: +r.t || 0 }; if (r.m) s.words[k].m = 1; }
  for (const [k, r] of Object.entries(obj(o.dev))) if (r && typeof r === 'object') { const d = {}; for (const [dk, x] of Object.entries(obj(r.d))) if (+x > 0) d[dk] = +x; s.dev[k] = { t: Math.max(0, +r.t || 0), d }; }
  for (const k of Object.keys(obj(o.days))) if (/^\d{4}-\d\d-\d\d$/.test(k)) s.days[k] = 1;
  for (const [k, v] of Object.entries(obj(o.passed))) if (typeof v === 'string') s.passed[k] = v;
  return s;
}
function migrateV1(o) {
  const s = fresh(0), order = window.TANGO_LEGACY_V1 || {}, t0 = today();
  const idOf = k => { const [tp, i] = String(k).split(':'); return (order[tp] || [])[+i]; };
  for (const [k, v] of Object.entries(o.str || {})) { const id = idOf(k); if (id) s.words[id] = { b: clamp(Math.round(+v || 0), 0, 5), due: t0, t: 1 }; }
  (o.mis || []).forEach(k => { const id = idOf(k); if (id) s.words[id] = Object.assign({ b: 0, due: t0, t: 1 }, s.words[id], { m: 1 }); });
  if (+o.xp > 0) s.dev[DEV] = { t: +o.xp, d: o.today && o.today.d && +o.today.xp > 0 ? { [o.today.d]: +o.today.xp } : {} };
  (o.days || []).forEach(d => { s.days[d] = 1; });
  Object.assign(s.passed, o.passed || {});
  return sanitize(s);
}
let S = sanitize(ls.get(KEY)) || (ls.get(KEY_V1) ? migrateV1(ls.get(KEY_V1)) : fresh());
const canon = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, x) => (a[x] = v[x], a), {}) : v);
// Two copies of the progress (this device and the cloud) merge field by field: the newer answer per word wins, XP adds up per device.
function merge(a, b) {
  if (a.epoch !== b.epoch) return sanitize(a.epoch > b.epoch ? a : b); // a reset on any device wins wholesale
  const o = fresh(a.epoch);
  for (const k of new Set([...Object.keys(a.words), ...Object.keys(b.words)])) { const x = a.words[k], y = b.words[k]; o.words[k] = { ...(!y || (x && x.t >= y.t) ? x : y) }; }
  for (const k of new Set([...Object.keys(a.dev), ...Object.keys(b.dev)])) {
    const x = a.dev[k], y = b.dev[k], w = !y || (x && x.t >= y.t) ? x : y, d = { ...w.d };
    if (x && y && x.t === y.t) for (const [dk, v] of Object.entries(y.d)) d[dk] = Math.max(d[dk] || 0, v);
    o.dev[k] = { t: w.t, d };
  }
  Object.assign(o.days, a.days, b.days);
  for (const k of new Set([...Object.keys(a.passed), ...Object.keys(b.passed)])) o.passed[k] = [a.passed[k], b.passed[k]].filter(Boolean).sort()[0];
  return o;
}
const save = (soon) => { ls.set(KEY, S); schedulePush(soon ? 300 : 4000); };

// derived
const rec = w => S.words[w.id] || null;
const box = w => (rec(w) || {}).b || 0;
const lvl = w => Math.min(3, box(w)); // 0 new, 1–2 learning, 3 learned
const isNew = w => !rec(w);
const isDue = w => { const r = rec(w); return !!r && (r.b === 0 || r.due <= today()); };
const lvlName = w => isNew(w) ? t(w.g ? 'lvNewTask' : 'lvNewWord') : t('lv')[lvl(w)];
const INTERVAL = [0, 0, 1, 3, 7, 14, 30, 60]; // days until the next review, by box
const totalXp = () => Object.values(S.dev).reduce((a, d) => a + d.t, 0);
const todayXp = () => Object.values(S.dev).reduce((a, d) => a + (d.d[dayKey()] || 0), 0);
const GOAL = 30;
function streak() { const d = new Date(); if (!S.days[dayKey(d)]) d.setDate(d.getDate() - 1); let n = 0; while (S.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); } return n; }
function addXp(xp) {
  if (!xp) return; const cur = S.dev[DEV] || { t: 0, d: {} }, d = { ...cur.d, [dayKey()]: (cur.d[dayKey()] || 0) + xp };
  Object.keys(d).sort().slice(0, -60).forEach(k => delete d[k]);
  S.dev[DEV] = { t: cur.t + xp, d };
}
function dueText(w) {
  const r = rec(w); if (!r) return t('lvNewWord');
  const d = r.b === 0 ? 0 : r.due - today();
  return d <= 0 ? t('dueToday') : d === 1 ? t('dueTomorrow') : t('dueIn', d);
}
const pct = (ws, lv = lvl) => ws.length ? Math.round(ws.reduce((a, w) => a + lv(w), 0) / (3 * ws.length) * 100) : 0;
function counts(ws) { let done = 0, fresh_ = 0; ws.forEach(w => { if (isNew(w)) fresh_++; else if (lvl(w) >= 3) done++; }); return { done, part: ws.length - done - fresh_, fresh: fresh_ }; }
// ---------- Motion helpers ----------
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// a number that runs up from one value to another
function countUp(node, from, to, ms = 900, fmt = v => String(v)) {
  const run = node._run = (node._run || 0) + 1; // a newer call on the same number stops the older one
  if (calm() || from === to) { node.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = t => { if (node._run !== run) return; const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); node.textContent = fmt(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(step); };
  node.textContent = fmt(from); requestAnimationFrame(step);
}
function bump(node) { if (calm()) return; node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); }

// bar: gold = learned words, blue = words in progress; with `from` (old levels) it grows from the old state
function barWidths(ws, lv) { const n = ws.length || 1; let done = 0, part = 0; ws.forEach(w => { const l = lv(w); if (l >= 3) done++; else if (l > 0) part += l / 3; }); return [done / n * 100, part / n * 100]; }
// `held`: wait for bar.play() instead of growing on its own (when something covers the screen first)
function segBar(ws, from, held) {
  const bar = el('span', 'bar'), a = el('i'), b = el('i', 'part'), to = barWidths(ws, lvl);
  const set = ([d, p]) => { a.style.width = d + '%'; b.style.width = p + '%'; };
  bar.append(a, b); bar.play = () => {};
  if (from && !calm()) { set(barWidths(ws, from)); bar.classList.add('grow'); bar.play = () => setTimeout(() => set(to), 500); if (!held) bar.play(); } else set(to);
  return bar;
}
function dots(n) {
  const d = el('span', 'dots'); d.setAttribute('role', 'img'); d.setAttribute('aria-label', t('levelAria', n));
  for (let i = 0; i < 3; i++) d.append(el('i', i < n ? 'on' : '')); return d;
}
// the lesson new words are drawn from: the one picked on the home screen, else the last lesson already started
function curLesson() {
  if (PREF.cur && lessonOf(PREF.cur)) return PREF.cur;
  const started = COURSE.filter(l => wordsOf(l.id).some(w => !isNew(w)));
  return (started.length ? started[started.length - 1] : COURSE[0]).id;
}

// ---------- Sync between devices (private per account) ----------
let ref = null, lastRemote = null, pushTimer = 0, pushing = false, dirty = false, syncState = 'local';
const SYNC_TEXT = {
  local: ['', 'syncLocal'],
  loading: ['warn', 'syncLoading'],
  saving: ['warn', 'syncSaving'],
  ok: ['ok', 'syncOk'],
  stale: ['warn', 'syncStale'],
  error: ['', 'syncError']
};
function setSync(s) { syncState = s; $('sync').className = 'sync ' + SYNC_TEXT[s][0]; $('syncTxt').textContent = t(SYNC_TEXT[s][1]); }
function schedulePush(delay) { if (!ref) return; dirty = true; clearTimeout(pushTimer); pushTimer = setTimeout(push, delay); if (syncState === 'ok') setSync('saving'); }
async function push(retry) {
  if (!ref || pushing || !dirty) return;
  pushing = true; dirty = false;
  const body = JSON.parse(JSON.stringify(S)), c = canon(body);
  try { await ref.set(body); lastRemote = c; setSync('ok'); }
  catch (e) {
    if (e && e.code === 'unavailable' && !retry) { pushing = false; dirty = true; setTimeout(() => push(true), 1500 + Math.random() * 1500); return; }
    setSync(e && e.code === 'unavailable' ? 'stale' : 'error');
  }
  pushing = false;
  if (dirty) { clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); }
}
async function initSync() {
  if (!window.claude || !window.claude.use) return;
  const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
  const uid = db && user ? await user.id() : null;
  if (!uid) return; // signed out or unavailable here: stay local
  ref = db.doc('data/users/' + uid + '/progress');
  setSync('loading');
  let timer = setTimeout(() => { if (syncState === 'loading') setSync('stale'); }, 10000);
  ref.onSnapshot(snap => {
    if (snap.metadata && snap.metadata.hasPendingWrites) return; // our own write, not yet confirmed
    const remote = snap.exists ? sanitize(snap.data()) : null;
    if (!snap.metadata || !snap.metadata.fromCache) { clearTimeout(timer); timer = 0; }
    lastRemote = remote ? canon(remote) : '';
    if (remote) {
      const m = merge(S, remote);
      if (canon(m) !== canon(S)) { S = m; ls.set(KEY, S); refresh(); }
    }
    const empty = !S.epoch && !Object.keys(S.words).length && !Object.keys(S.dev).length; // nothing to store yet: no write on a first visit
    if (canon(S) !== lastRemote && !(empty && !remote)) schedulePush(300); else if (!dirty && !pushing) setSync(snap.metadata && snap.metadata.fromCache ? 'loading' : 'ok');
  }, () => { clearTimeout(timer); ref = null; setSync('error'); });
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && dirty) { clearTimeout(pushTimer); push(); } });

// ---------- Sound, voice, haptics ----------
let actx;
function sfx(ok) {
  if (!PREF.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const now = actx.currentTime;
    (ok ? [660, 880, 1320] : [240, 180]).forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t0 = now + i * .09;
      o.type = ok ? 'sine' : 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.12, t0 + .02); g.gain.exponentialRampToValueAtTime(.001, t0 + .25);
      o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + .28);
    });
  } catch (e) {}
}
const canSpeak = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
function speak(text, force) {
  if (!canSpeak || (!PREF.sound && !force)) return;
  try { const u = new SpeechSynthesisUtterance(text.replace(/[〜~＿]/g, '')); u.lang = 'ja-JP'; u.rate = .85; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
}
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
function sayBtn(text) {
  if (!canSpeak) return null;
  const b = el('button', 'btn say'); b.type = 'button'; b.setAttribute('aria-label', t('say')); b.innerHTML = SAY_SVG;
  b.onclick = e => { e.stopPropagation(); speak(text, true); }; return b;
}

// ---------- Screens ----------
let screen = 'home';
const U = { id: COURSE[0].id };
function show(id) {
  screen = id; ['home', 'unit', 'note', 'dict', 'profile', 'lesson', 'result'].forEach(s => { $(s).hidden = s !== id; });
  $('tabs').hidden = id === 'lesson' || id === 'result' || id === 'note';
  const tab = id === 'dict' || id === 'profile' ? id : 'home';
  document.querySelectorAll('#tabs button').forEach(b => { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
}
function refresh() { if (screen === 'home') renderHome(); else if (screen === 'unit') renderUnit(); else if (screen === 'dict') renderDict(); else if (screen === 'profile') renderProfile(); }
function goHome() { renderHome(); show('home'); }
function goUnit(id) { if (id) U.id = id; renderUnit(); show('unit'); }
function goBack() { if (L.origin === 'unit') goUnit(); else if (L.origin === 'dict') { renderDict(); show('dict'); } else goHome(); }

// ---------- Home ----------
const WD = ['日', '月', '火', '水', '木', '金', '土'];
function bigRow(cls, glyph, name, right, ws, meta, check, onclick, badge) {
  const b = el('button', 'btn topic ' + cls); b.type = 'button';
  const tx_ = el('span', 'tx'), nm = el('span', 'nm');
  nm.append(el('span', '', name), el('small', '', right));
  tx_.append(nm); if (ws) tx_.append(segBar(ws)); if (meta) tx_.append(el('span', 'meta', meta));
  if (badge) tx_.append(el('span', 'badge', badge));
  const g = el('span', 'glyph', glyph);
  if (check) { const ck = el('span', 'check'); ck.innerHTML = CHECK_SVG; ck.setAttribute('role', 'img'); ck.setAttribute('aria-label', t('passedAria')); g.append(ck); }
  b.append(g, tx_); b.onclick = onclick; return b;
}
// Home: one "what to do now" card and the lessons. Stats and settings live on the Profile tab.
let shownXp = null, shownStreak = null; // what the header showed last, so new XP can run up
function renderHome() {
  const n = streak(), cur = curLesson(), curL = lessonOf(cur), xp = totalXp();
  $('hStreak').classList.toggle('off', !n);
  $('hStreak').setAttribute('aria-label', t('streakAria', n));
  if (shownStreak != null && n > shownStreak) { countUp($('hStreakN'), shownStreak, n, 600); bump($('hStreak')); } else countUp($('hStreakN'), n, n);
  if (shownXp != null && xp > shownXp) { countUp($('hXp'), shownXp, xp, 1100); bump($('hXp').parentElement); } else countUp($('hXp'), xp, xp);
  shownXp = xp; shownStreak = n;
  const due = WORDS.filter(isDue).length, newCur = wordsOf(cur).filter(isNew).length;
  const tom = WORDS.filter(w => { const r = rec(w); return r && r.b > 0 && r.due === today() + 1; }).length;
  $('nowTitle').textContent = due ? t('nowDue', due) : newCur ? t('nowNew', lname(curL)) : t('nowDone');
  $('nowSub').textContent = due ? (newCur ? t('subDueNew', lname(curL), newCur) : t('subDueNoNew'))
    : newCur ? t('subNew', lsub(curL), newCur) : tom ? t('subTomorrow', tom) : t('subFree');
  $('smartBtn').textContent = due ? t('btnReview') : newCur ? t('btnLearn') : t('btnFree');
  const mis = WORDS.filter(w => (rec(w) || {}).m);
  $('mistBtn').hidden = !mis.length;
  $('mistN').textContent = t('mistN', mis.length);
  const list = $('lessons'); list.innerHTML = '';
  COURSE.forEach(l => {
    const ws = wordsOf(l.id), c = counts(ws), gr = (l.drills || []).length;
    const row = bigRow('', l.glyph, lname(l), pct(ws) + '%', ws, lsub(l), false, () => goUnit(l.id));
    row.dataset.lesson = l.id; list.append(row);
  });
}
// The profile animates only what is new since it was last shown: everything on the first visit after the app opens,
// afterwards just the parts that changed (more XP, a new streak day, words that moved). Opening it again with nothing new shows it still.
let profSeen = null;
function renderProfile() {
  const n = streak(), tx = todayXp(), cur = curLesson(), arc = $('ringArc'), xp = totalXp(), prev = profSeen;
  const g0 = prev ? Math.min(prev.tx, GOAL) : 0, g1 = Math.min(tx, GOAL), off = g => String(194.8 * (1 - g / GOAL));
  if (g0 !== g1 && !calm()) {
    arc.style.transition = 'none'; arc.style.strokeDashoffset = off(g0); void arc.getBoundingClientRect(); arc.style.transition = '';
    requestAnimationFrame(() => requestAnimationFrame(() => { arc.style.strokeDashoffset = off(g1); }));
    countUp($('ringTxt'), g0, g1, 1000, v => `${v}/${GOAL}`);
  } else { arc.style.transition = 'none'; arc.style.strokeDashoffset = off(g1); countUp($('ringTxt'), g1, g1, 0, v => `${v}/${GOAL}`); }
  const lv = {}; WORDS.forEach(w => { lv[w.id] = lvl(w); });
  const lvChanged = !prev || WORDS.some(w => prev.lv[w.id] !== lv[w.id]);
  profSeen = { tx, xp, days: new Set(Object.keys(S.days)), lv };
  $('goalTitle').textContent = tx >= GOAL ? t('goalDone') : n ? t('streakN', n) : t('goalStart');
  $('goalSub').textContent = tx >= GOAL ? t('goalSubDone', tx) : S.days[dayKey()] ? t('goalLeft', GOAL - tx) : t('goalSubStart');
  weekRow($('week'), prev ? k => !prev.days.has(k) : true);
  const st = $('pStats'); st.innerHTML = '';
  const passed = TOPICS.filter(t => S.passed[t.id]).length, xpB = el('b', '', xp);
  [['f', t('statStreak'), el('b', '', t('days', n))], ['x', t('totalXp'), xpB], ['a', t('statTopics'), el('b', '', `${passed}/${TOPICS.length}`)]].forEach(([c, l, b]) => { const d = el('div', 'stat ' + c); d.append(el('span', '', l), b); st.append(d); });
  countUp(xpB, prev ? prev.xp : 0, xp, 1000);
  drawXpChart(!prev || prev.xp !== xp); // bars grow on the first visit and when new XP came in, like the rest of the profile
  const cl = $('curList'); cl.innerHTML = '';
  COURSE.forEach(l => {
    const b = el('button'); b.type = 'button'; b.dataset.lesson = l.id; b.setAttribute('aria-pressed', String(l.id === cur));
    b.append(lname(l), el('small', '', t('newN', wordsOf(l.id).filter(isNew).length)));
    b.onclick = () => { PREF.cur = l.id; ls.set(KEY_PREF, PREF); renderProfile(); };
    cl.append(b);
  });
  const ap = $('allProg'), ac = counts(WORDS), hd = el('div', 'nm'), lg = el('div', 'lg'); ap.innerHTML = '';
  hd.append(el('span', '', t('learnedOf', ac.done, WORDS.length)), el('small', '', pct(WORDS) + '%'));
  [['done', t('lgDone'), ac.done], ['part', t('lgPart'), ac.part], ['', t('lgNew'), ac.fresh]].forEach(([k, l, c]) => { const s = el('span'); s.append(el('i', k), `${l}: ${c}`); lg.append(s); });
  ap.append(hd, segBar(WORDS, lvChanged ? (prev ? w => prev.lv[w.id] || 0 : () => 0) : null), lg);
  $('soundVal').textContent = t(PREF.sound ? 'on' : 'off'); $('soundVal').className = PREF.sound ? '' : 'off';
  $('kanjiVal').textContent = t(PREF.kanji !== false ? 'on' : 'off');
  document.querySelectorAll('#langList button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang()))); $('kanjiVal').className = PREF.kanji !== false ? '' : 'off';
}

// ---------- XP by day chart (profile) ----------
// XP of one day, summed over all devices (each device keeps its last 60 days)
const xpOn = k => Object.values(S.dev).reduce((a, d) => a + (d.d[k] || 0), 0);
function drawXpChart(grow) {
  const R = [7, 14, 30].includes(PREF.xpRange) ? PREF.xpRange : 14, days = [];
  for (let i = R - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = dayKey(d); days.push({ k, d, xp: xpOn(k), today: i === 0 }); }
  document.querySelectorAll('#xpRange button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.r === R)));
  const total = days.reduce((a, x) => a + x.xp, 0), met = days.filter(x => x.xp >= GOAL).length;
  const sum = $('xpSum'); sum.innerHTML = '';
  t('xpSum', R, total, Math.round(total / R), met).forEach(part => sum.append(Array.isArray(part) ? el('b', '', part[0]) : part));
  // y scale: a round top above both the best day and the daily goal
  const max = Math.max(GOAL, ...days.map(x => x.xp)), step = max <= 60 ? 10 : max <= 150 ? 25 : max <= 400 ? 50 : 100;
  const top = Math.ceil(max * 1.08 / step) * step, y = v => (v / top * 100);
  const plot = $('xpPlot'); plot.innerHTML = '';
  const ya = el('div', 'xpc-y'), area = el('div', 'xpc-area'), bars = el('div', 'xpc-bars'), xa = el('div', 'xpc-x');
  ya.setAttribute('aria-hidden', 'true');
  [0, top / 2, top].forEach(v => { const s = el('span', '', String(v)); s.style.top = (100 - y(v)) + '%'; ya.append(s); if (v) { const g = el('div', 'xpc-grid'); g.style.top = (100 - y(v)) + '%'; area.append(g); } });
  const goal = el('div', 'xpc-goal'); goal.style.top = (100 - y(GOAL)) + '%'; area.append(goal);
  bars.style.gap = R > 14 ? '2px' : '4px'; xa.style.gap = bars.style.gap;
  const tip = el('div', 'xpc-tip'); tip.hidden = true;
  let sel = null, pinned = false; // pinned: chosen by a tap or click, so it stays until tapped again; hover only previews
  const pick = (col, x, tap) => {
    if (tap && sel === col && pinned) { col.setAttribute('aria-pressed', 'false'); sel = null; pinned = false; tip.hidden = true; return; }
    pinned = !!tap;
    if (sel) sel.setAttribute('aria-pressed', 'false');
    sel = col; col.setAttribute('aria-pressed', 'true');
    tip.textContent = `${t('date', x.d)} · ${x.xp} XP`;
    tip.style.left = (col.offsetLeft + col.offsetWidth / 2) + 'px'; tip.style.top = (100 - Math.max(y(x.xp), 0)) + '%'; tip.hidden = false;
    const r = area.getBoundingClientRect(), w = tip.offsetWidth, cx = col.offsetLeft + col.offsetWidth / 2; // keep the tip inside the plot
    tip.style.left = Math.min(Math.max(cx, w / 2), r.width - w / 2) + 'px';
  };
  const every = R <= 7 ? 1 : R <= 14 ? 2 : 5;
  days.forEach((x, i) => {
    const col = el('button', 'xpc-col' + (x.xp ? '' : ' zero')), bar = el('i');
    col.type = 'button'; col.setAttribute('aria-pressed', 'false');
    col.setAttribute('aria-label', `${t('dateShort', x.d)}${x.today ? ', ' + t('todayWord') : ''}: ${x.xp} XP`);
    const h = y(x.xp) + '%';
    if (grow && x.xp && !calm()) { bar.style.height = '0%'; setTimeout(() => { bar.style.height = h; }, 60 + i * (600 / R)); } else { bar.style.transition = 'none'; bar.style.height = h; }
    col.append(bar); col.onclick = () => pick(col, x, true);
    col.onpointerenter = e => { if (e.pointerType === 'mouse' && !pinned) pick(col, x); };
    bars.append(col);
    // day numbers under the bars, counted back from today: every day for a week, every 2nd for two weeks, every 5th for a month
    const show = (R - 1 - i) % every === 0;
    xa.append(el('span', x.today ? 'today' : '', x.today ? t('todayShort') : show ? String(x.d.getDate()) : ''));
  });
  bars.onpointerleave = e => { if (e.pointerType === 'mouse' && sel && !pinned) { sel.setAttribute('aria-pressed', 'false'); sel = null; tip.hidden = true; } };
  area.append(bars, tip); plot.append(ya, area, xa);
}

// the last seven days; `pop` (true, or a test on the date) lights those streak days up one after another,
// `todayLate` lights today last, after a pause
function weekRow(box_, pop, todayLate) {
  box_.innerHTML = '';
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const on = !!S.days[dayKey(d)];
    const c = el('div', 'wd' + (on && !(todayLate && i === 0) ? ' on' : '') + (i === 0 ? ' today' : ''));
    c.append(el('i', '', WD[d.getDay()]), el('span', '', i === 0 ? t('todayShort') : String(d.getDate())));
    if (on && !calm() && (pop === true || (typeof pop === 'function' && pop(dayKey(d))))) { c.classList.add('pop'); c.style.setProperty('--d', (6 - i) * 70 + 'ms'); }
    if (todayLate && i === 0 && on) setTimeout(() => { c.classList.add('on', 'pop'); c.style.setProperty('--d', '0ms'); }, calm() ? 0 : 900);
    box_.append(c);
  }
}

// full-screen moment when today's first finished lesson extends the streak
function streakSplash(n, done) {
  const bg = el('div', 'streak-bg'), s = el('div', 'streak gut'), num = el('div', 'st-num'), wk = el('div', 'week'), go = el('button', 'btn btn-main', t('cont'));
  go.type = 'button'; go.id = 'streakGo'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-label', t('streakAriaDlg'));
  const flame = el('div', 'st-flame'); flame.innerHTML = $('hStreak').querySelector('svg').outerHTML;
  s.append(flame, num, el('h2', '', n === 1 ? t('streakStarted') : t('streakExtended')),
    el('p', '', n === 1 ? t('streakStartedSub') : t('streakExtendedSub', n)), wk, go);
  bg.append(s); document.body.append(bg);
  num.textContent = Math.max(0, n - 1); // yesterday's count first, then it ticks over together with today's day
  setTimeout(() => { num.textContent = n; bump(num); }, calm() ? 0 : 900);
  weekRow(wk, false, true);
  go.onclick = () => { bg.remove(); done(); };
  go.focus();
}

// ---------- One lesson ----------
function renderUnit() {
  const l = lessonOf(U.id), ws = wordsOf(l.id), body = $('uBody'); body.innerHTML = '';
  $('uTitle').textContent = lname(l); $('uSub').textContent = lsub(l);
  const c = counts(ws), due = ws.filter(isDue).length, panel = el('div', 'panel all'), hd = el('div', 'nm'), go = el('button', 'btn btn-main');
  hd.append(el('span', '', t('learnedOf', c.done, ws.length)), el('small', '', pct(ws) + '%'));
  go.type = 'button'; go.id = 'uGo';
  go.textContent = due ? t('unitReview', due) : c.fresh ? t('unitLearn') : t('unitTrain');
  go.onclick = () => startSmart(l.id);
  panel.append(hd, segBar(ws), el('span', 'meta', t('unitMeta', due, c.part, c.fresh)), go);
  body.append(panel, el('p', 'sec', t('byTopic')));
  l.topics.forEach(tp => {
    const tw = WORDS.filter(w => w.topic === tp.id), tc = counts(tw), done = !!S.passed[tp.id];
    const td = tw.filter(isDue).length;
    const row = bigRow(done ? 'passed' : '', tp.glyph, tname(tp), `${tc.done} / ${tw.length}`, tw, '', done,
      () => startLesson(shuf(tw), { title: tname(tp), kind: 'topic', topicId: tp.id, pool: tw }), td ? t('dueBadge', td) : '');
    row.setAttribute('aria-label', t('topicAria', tname(tp), tc.done, tw.length, td, done));
    row.dataset.topic = tp.id; body.append(row);
  });
  if (l.notes || l.drills) body.append(el('p', 'sec', t('grammar')));
  if (l.notes) {
    const row = bigRow('note-btn', '文', t('notesBtn'), t('notesN', l.notes.length), null, '', false, () => { renderNote(); show('note'); });
    row.id = 'uNote'; body.append(row);
  }
  (l.drills || []).forEach(d => {
    const items = DRILLS[d.id], dc = counts(items);
    const row = bigRow('drill', d.glyph, dname(d), `${dc.done} / ${items.length}`, items, '', false,
      () => startLesson(pickWeak(items, 8), { title: dname(d), kind: 'custom', pool: items }));
    row.dataset.drill = d.id; body.append(row);
  });
  if (!l.notes && !l.drills) body.append(el('p', 'legend', t('onlyWords')));
}
// ---------- Notes as stories: one idea per screen, tap to move ----------
const ST = { slides: [], i: 0, topics: 0 };
function buildSlides(l) {
  const out = [];
  // rough height of a block in px on a phone; what fits below the title depends on the screen height
  const room = Math.max(260, innerHeight - 330);
  const lines = (s, per) => Math.ceil(s.length / per);
  const weight = b => 16 + (b.p ? lines(b.p, 30) * 27 : b.li ? b.li.reduce((a, x) => a + 10 + lines(x, 28) * 27, 0)
    : b.ex ? b.ex.reduce((a, e) => a + 14 + lines(e[0], 15) * 30 + lines(e[1], 36) * 21, 0)
    : 45 + b.tb.r.reduce((a, r) => a + 18 + Math.max(...r.map(c => lines(c, Math.max(6, Math.floor(30 / r.length))))) * 24, 0));
  l.notes.forEach((nt, ti) => {
    const blocks = [];
    nt.b.forEach(bl => { // long example lists are spread evenly over several screens
      if (bl.ex && bl.ex.length > 4) { const n = Math.ceil(bl.ex.length / 4), size = Math.ceil(bl.ex.length / n); for (let i = 0; i < bl.ex.length; i += size) blocks.push({ ex: bl.ex.slice(i, i + size) }); }
      else blocks.push(bl);
    });
    let cur = [], w = 0, part = 0;
    const flush = () => { if (cur.length) { out.push({ ti, t: nt.t, part: part++, b: cur }); cur = []; w = 0; } };
    blocks.forEach(b => { const x = weight(b); if (cur.length && w + x > room) flush(); cur.push(b); w += x; });
    flush();
  });
  out.push({ end: true, ti: l.notes.length });
  return out;
}
function renderNote() {
  const l = lessonOf(U.id);
  ST.slides = buildSlides(l); ST.i = 0; ST.topics = l.notes.length;
  $('stLesson').textContent = t('notesOf', lname(l));
  const bars = $('stBars'); bars.innerHTML = '';
  l.notes.forEach(() => { const s = el('span'); s.append(el('i')); bars.append(s); });
  drawSlide(0);
}
function drawSlide(dir) {
  const s = ST.slides[ST.i], card = $('stCard'), l = lessonOf(U.id);
  card.innerHTML = ''; card.className = 'st-card' + (s.end ? ' st-end' : '');
  if (dir) { void card.offsetWidth; card.classList.add(dir > 0 ? 'fwd' : 'back'); }
  if (s.end) {
    const drills = (l.drills || []).length, again = el('button', 'btn', t('reread')), done = el('button', 'btn btn-main', drills ? t('toDrills') : t('backUnit'));
    again.type = done.type = 'button';
    again.onclick = () => { ST.i = 0; drawSlide(-1); }; done.onclick = () => goUnit();
    card.append(el('div', 'big', 'おわり'), el('h2', '', t('notesDone')),
      el('p', '', drills ? t('notesDoneDrills', drills) : t('notesDoneWords')), done, again);
  } else {
    card.append(el('div', 'st-eyebrow', t('topicOf', s.ti + 1, ST.topics)), el('h2', s.part ? 'cont' : '', s.part ? s.t + ' · ' + t('contd') : s.t));
    s.b.forEach(bl => {
      if (bl.p) card.append(el('p', '', bl.p));
      if (bl.li) { const ul = el('ul'); bl.li.forEach(x => ul.append(el('li', '', x))); card.append(ul); }
      if (bl.ex) { const box_ = el('div', 'exs'); bl.ex.forEach(([jp, ru]) => { const d = el('div'); d.append(el('b', '', jp), el('span', '', ru)); box_.append(d); }); card.append(box_); }
      if (bl.tb) {
        const wrap = el('div', 'gt-wrap'), tbl = el('table', 'gt'), hr = el('tr');
        bl.tb.h.forEach(h => hr.append(el('th', '', h))); tbl.append(hr);
        bl.tb.r.forEach(r => { const row = el('tr'); r.forEach(x => row.append(el('td', '', x))); tbl.append(row); });
        wrap.append(tbl); card.append(wrap);
      }
    });
  }
  // each bar is one topic; it fills as its screens are read
  [...$('stBars').children].forEach((bar, ti) => {
    const mine = ST.slides.filter(x => x.ti === ti), read = mine.filter(x => ST.slides.indexOf(x) <= ST.i).length;
    bar.firstChild.style.width = (read / mine.length * 100) + '%';
  });
  $('stCount').textContent = s.end ? t('end') : t('screenOf', ST.i + 1, ST.slides.length - 1);
  $('stPrev').disabled = ST.i === 0; $('stNext').disabled = !!s.end;
  $('stHint').textContent = ST.i === 0 ? t('stHint') : '';
  $('stStage').scrollTop = 0;
}
function stGo(d) {
  const i = clamp(ST.i + d, 0, ST.slides.length - 1);
  if (i === ST.i) return; ST.i = i; drawSlide(d);
}

// ---------- Dictionary ----------
const D = { q: '', f: 'all', l: 'all', open: null };
const FILTERS = [['all', 'fAll', () => true], ['due', 'fDue', isDue], ['new', 'fNew', isNew], ['learn', 'fLearn', w => !isNew(w) && lvl(w) < 3], ['done', 'fDone', w => lvl(w) >= 3], ['mis', 'fMis', w => !!(rec(w) || {}).m]];
const norm = s => s.toLowerCase().replace(/[’'\s〜~]/g, '');
const inLesson = w => D.l === 'all' || w.lesson === D.l;
function dictWords() {
  const f = FILTERS.find(x => x[0] === D.f)[2], q = norm(D.q);
  return WORDS.filter(w => inLesson(w) && f(w) && (!q || [w.kana, w.kanji, w.romaji, w.ru, w.gl].some(x => norm(x).includes(q))));
}
function chip(box_, label, count, on, onclick) {
  const b = el('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(on));
  b.append(label); if (count != null) b.append(el('small', '', count)); b.onclick = onclick; box_.append(b);
}
function renderDict() {
  const lb = $('dLesson'); lb.innerHTML = '';
  lb.append(D.l === 'all' ? t('allLessons') : lname(lessonOf(D.l))); lb.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7 7-7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>');
  const fl = $('dFilters'); fl.innerHTML = '';
  FILTERS.forEach(([id, name, fn]) => chip(fl, t(name), WORDS.filter(w => inLesson(w) && fn(w)).length, D.f === id, () => { D.f = id; D.open = null; renderDict(); }));
  renderDictList();
}
function renderDictList() {
  const ws = dictWords(), list = $('dList'); list.innerHTML = '';
  if (!ws.length) list.append(el('p', 'd-empty', D.q ? t('noFound') : t('noWords')));
  TOPICS.forEach(tp => {
    const g = ws.filter(w => w.topic === tp.id); if (!g.length) return;
    list.append(el('p', 'd-group', `${lname(lessonOf(tp.lesson))} · ${tname(tp)} · ${g.length}`));
    g.forEach(w => {
      const row = el('button', 'd-row'); row.type = 'button'; row.dataset.id = w.id; row.setAttribute('aria-expanded', String(D.open === w.id));
      const r1 = el('span', 'r1'), k = el('span', 'k');
      k.append(el('b', '', w.kana), el('small', '', (showK(w) ? w.kanji + ' · ' : '') + w.romaji));
      r1.append(k, el('span', 'ru', w.gl), dots(lvl(w))); row.append(r1);
      if (D.open === w.id) {
        const more = el('span', 'd-more'), txt = el('span', 'txt');
        const st = el('span'); if (w.ex) { st.append(el('span', 'ex', '例外'), ' '); } st.append(isNew(w) ? t('lvNewWord') : lvlName(w) + ' · ' + dueText(w));
        txt.append(st); if (w.nt) txt.append(el('span', 'note', w.nt));
        more.append(txt); const sb = sayBtn(w.kana); if (sb) more.append(sb);
        row.append(more);
      }
      row.onclick = () => { D.open = D.open === w.id ? null : w.id; renderDictList(); };
      list.append(row);
    });
  });
  $('dFoot').hidden = !ws.length;
  $('dTrain').textContent = t('train', Math.min(8, ws.length), ws.length);
}

function chooser(title, items, current, onPick) { // bottom sheet with a short list to pick from
  const bg = el('div', 'sheet-bg'), s = el('div', 'sheet gut'), list = el('div', 'pick');
  const close = () => bg.remove();
  items.forEach(([v, label, sub]) => {
    const b = el('button'); b.type = 'button'; b.dataset.v = v; b.setAttribute('aria-pressed', String(v === current));
    b.append(el('span', '', label), el('small', '', sub)); b.onclick = () => { close(); onPick(v); }; list.append(b);
  });
  s.append(el('h3', '', title), list); bg.append(s); document.body.append(bg);
  bg.onclick = e => { if (e.target === bg) close(); };
  (list.querySelector('[aria-pressed="true"]') || list.firstChild).focus();
}

// ---------- Lesson building ----------
const L = {};
const pickWeak = (pool, n) => pool.map(w => ({ w, r: box(w) + ((rec(w) || {}).m ? -1 : 0) + (isDue(w) ? -.5 : 0) + Math.random() * 1.6 })).sort((a, b) => a.r - b.r).slice(0, n).map(x => x.w);
function makeQ(w) {
  if (w.g) return { type: w.tiles ? 'order' : 'gch', w };
  if (isNew(w)) return { type: 'jp2ru', w }; // first meeting: recognition only
  const b = box(w), types = b < 1 ? ['jp2ru', 'jp2ru', 'ru2jp'] : ['jp2ru', 'ru2jp', 'ru2jp'];
  if (showK(w)) types.push('kanji');
  const g = graphemes(w.kana);
  if (g.length >= 2 && g.length <= 9 && !/[〜Ｌ]/.test(w.kana)) types.push('build', b >= 1 ? 'build' : 'jp2ru');
  return { type: types[Math.floor(Math.random() * types.length)], w };
}
// Words go in groups of about four: new ones are introduced first, then the group is asked in random order.
function buildQueue(words) {
  const q = [], n = Math.max(1, Math.round(words.length / 4)), size = Math.ceil(words.length / n);
  for (let c = 0; c < n; c++) {
    const group = words.slice(c * size, c * size + size);
    group.filter(w => isNew(w) && !w.g).forEach(w => q.push({ type: 'intro', w }));
    shuf(group).forEach(w => q.push(makeQ(w)));
    const pairs = words.slice(0, c * size + size).filter(w => !w.g);
    if (pairs.length >= 4 && c === Math.min(1, n - 1)) q.push({ type: 'match', ws: shuf(pairs).slice(0, 5) });
  }
  return q;
}
// due words first, then new ones from one lesson; lessonId limits everything to that lesson
function startSmart(lessonId) {
  const pool = lessonId ? wordsOf(lessonId) : WORDS, from = lessonId || curLesson();
  if (lessonId) { PREF.cur = lessonId; ls.set(KEY_PREF, PREF); }
  const due = pool.filter(isDue).sort((a, b) => (rec(a).due - rec(b).due) || (box(a) - box(b)));
  let words = due.slice(0, 8), title = t('tReview');
  if (words.length < 8) words = words.concat(wordsOf(from).filter(isNew).slice(0, Math.min(5, 8 - words.length)));
  if (!words.length) { words = pickWeak(pool, 8); title = t('tFree'); }
  startLesson(words, { title, kind: 'smart', lessonId: lessonId || null });
}
function startMistakes() {
  const ws = WORDS.filter(w => (rec(w) || {}).m);
  startLesson(shuf(ws).slice(0, 8), { title: t('tMist'), kind: 'mist' });
}
function startLesson(words, o) {
  if (!words.length) return;
  const queue = buildQueue(words), before = {}, wasNew = new Set(words.filter(isNew).map(w => w.id));
  WORDS.concat(o.pool || [], words).forEach(w => { before[w.id] = lvl(w); });
  const total = queue.filter(q => q.type !== 'intro').length, intros = queue.filter(q => q.type === 'intro').length;
  Object.assign(L, { topicId: null, pool: null, lessonId: null }, o, { origin: screen === 'lesson' || screen === 'result' ? L.origin : screen, queue, total, before, wasNew, intros, introN: 0, i: 0,
    hearts: o.kind === 'topic' ? Math.max(5, Math.ceil(words.length / 5)) : 5, xp: 0, combo: 0, right: 0, wrong: 0, failed: new Set(), seen: words });
  show('lesson'); head(); renderQ();
}
function distract(w, field, n) {
  const seen = new Set([w[field]]), out = [];
  for (const x of shuf(WORDS.filter(x => x.topic === w.topic)).concat(shuf(WORDS.filter(x => x.lesson === w.lesson)), shuf(WORDS))) {
    if (out.length >= n) break;
    if (x.kana === w.kana || seen.has(x[field])) continue;
    seen.add(x[field]); out.push(x[field]);
  }
  return out;
}

// ---------- Lesson rendering ----------
const qEl = $('q'), foot = $('foot'), msg = $('msg'), act = $('act');
function head() {
  // every task is answered right exactly once (a miss is repeated), so the bar never moves back
  $('prog').style.width = (L.right / L.total * 100) + '%';
  $('count').textContent = t('count', L.right, L.total);
  $('heartsN').textContent = L.hearts;
  $('combo').textContent = L.combo >= 3 ? t('combo', L.combo) : '';
}
function setFoot(kind, title, sub, label, action) {
  foot.className = 'l-foot' + (kind ? ' ' + kind : '');
  msg.innerHTML = '';
  if (title) msg.append(el('b', '', title));
  if (sub) msg.append(sub instanceof Node ? sub : el('span', '', sub));
  act.hidden = !label; act.textContent = label || ''; L.action = action;
  act.disabled = action === 'check';
}
function renderQ() {
  const q = L.queue[L.i]; L.answered = false; L.sel = null; L.built = null;
  qEl.innerHTML = '';
  const kind = el('h1', 'q-kind');
  if (q.again) kind.append(el('span', 'again', t('retry')));
  qEl.append(kind);
  if (q.type === 'intro') return renderIntro(q, kind);
  if (q.type === 'match') return renderMatch(q, kind);
  if (q.type === 'kanji' && !showK(q.w)) q.type = 'ru2jp'; // kanji were switched off after the lesson was built
  const w = q.w, prompt = el('div', 'prompt'), main = el('div', 'prompt-main'), lv = el('div', 'lvl');
  lv.append(dots(lvl(w)), lvlName(w)); main.append(lv);
  let jpOpts = true, two = true, sayOpts = true;
  if (q.type === 'jp2ru') {
    kind.append(t('qJp'));
    main.append(el('div', 'big', w.kana), el('div', 'sub', (hintKanji(w) ? w.kanji + ' · ' : '') + w.romaji));
    const sb = sayBtn(w.kana); if (sb) prompt.append(sb);
    q.answer = w.gl; q.opts = q.opts || shuf([w.gl, ...distract(w, 'gl', 3)]); jpOpts = false;
    speak(w.kana);
  } else if (q.type === 'ru2jp') {
    kind.append(t('qRu'));
    main.append(el('div', 'ru', w.gl));
    q.answer = w.kana; q.opts = q.opts || shuf([w.kana, ...distract(w, 'kana', 3)]);
  } else if (q.type === 'kanji') {
    kind.append(t('qKanji'));
    main.append(el('div', 'big', w.kanji), el('div', 'sub', w.gl));
    q.answer = w.kana; q.opts = q.opts || shuf([w.kana, ...distract(w, 'kana', 3)]);
  } else if (q.type === 'gch') {
    kind.append(w.kind);
    main.append(el('div', 'big sent', w.jp), el('div', 'sub', w.ru));
    q.answer = w.answer; q.opts = q.opts || shuf([w.answer, ...shuf(w.wrong).slice(0, 3)]);
    two = q.opts.every(o => o.length <= 4); // two columns only when every answer fits on one line sayOpts = false;
  } else if (q.type === 'order') {
    kind.append(w.kind);
    main.append(el('div', 'ru', w.ru));
    prompt.append(main); qEl.append(prompt);
    return renderBuild(q, w.tiles, w.extra || [], true);
  } else {
    kind.append(t('qBuild'));
    main.append(el('div', 'ru', w.gl));
    prompt.append(main); qEl.append(prompt);
    const target = graphemes(w.kana);
    const extra = shuf(WORDS.flatMap(x => graphemes(x.kana)).filter(g => !target.includes(g) && !/[〜Ｌ0-9A-Za-z]/.test(g))).filter((g, i, a) => a.indexOf(g) === i).slice(0, 3);
    q.answer = w.kana;
    return renderBuild(q, target, extra, false);
  }
  prompt.append(main); qEl.append(prompt);
  const grid = el('div', 'opts' + (jpOpts && two ? ' two' : ''));
  q.opts.forEach((o, n) => {
    const b = el('button', 'btn opt'); b.type = 'button'; b.dataset.v = o; b.setAttribute('aria-pressed', 'false');
    b.append(el('span', 'n', n + 1), el('span', 't' + (jpOpts && o !== '×' ? ' jp' : ''), o === '×' ? t('nothing') : o));
    b.onclick = () => {
      if (L.answered) return; L.sel = o;
      grid.querySelectorAll('.opt').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      act.disabled = false; if (jpOpts && sayOpts) speak(o);
    };
    grid.append(b);
  });
  qEl.append(grid);
  setFoot('', '', '', t('check'), 'check');
}
function renderIntro(q, kind) {
  const w = q.w; L.answered = true; L.introN++;
  kind.append(t('newWord'));
  const card = el('div', 'intro'); card.dataset.id = w.id;
  if (w.ex) card.append(el('span', 'ex', '例外'));
  if (showK(w)) card.append(el('div', 'kanji', w.kanji));
  card.append(el('div', 'kana', w.kana), el('div', 'romaji', w.romaji), el('div', 'tr', w.gl));
  if (w.nt) card.append(el('div', 'note' + (w.ex ? ' exn' : ''), w.nt));
  const sb = sayBtn(w.kana); if (sb) card.append(sb);
  qEl.append(card, el('p', 'intro-n', t('introN', L.introN, L.intros)));
  if (!rec(w)) { S.words[w.id] = { b: 0, due: today(), t: Date.now() }; save(); } // now it counts as met
  speak(w.kana);
  setFoot('', '', '', t('gotIt'), 'next');
}
// tiles to tap in order: syllables of a word, or words of a sentence
function renderBuild(q, target, extra, wide) {
  const tiles = shuf([...target, ...extra]).map((g, id) => ({ g, id }));
  const line = el('div', 'line'), bank = el('div', 'bank'), cls = 'btn tile' + (wide ? ' w' : '');
  L.built = []; q.target = target;
  const draw = () => {
    line.innerHTML = ''; bank.innerHTML = '';
    L.built.forEach(t => { const b = el('button', cls, t.g); b.type = 'button'; b.onclick = () => { if (L.answered) return; L.built = L.built.filter(x => x !== t); draw(); }; line.append(b); });
    tiles.forEach(t => {
      const used = L.built.includes(t), b = el('button', cls + (used ? ' ghost' : ''), t.g); b.type = 'button';
      if (used) b.tabIndex = -1;
      b.onclick = () => { if (L.answered || used) return; L.built.push(t); buzz(8); draw(); };
      bank.append(b);
    });
    if (L.action === 'check') act.disabled = !L.built.length;
  };
  L.redraw = draw;
  qEl.append(line, bank);
  setFoot('', '', '', t('check'), 'check'); draw();
}
function renderMatch(q, kind) {
  kind.append(t('qMatch'));
  const left = el('div'), right = el('div'), wrap = el('div', 'match');
  let sL = null, sR = null, matched = 0;
  const pick = (b, side) => {
    if (b.classList.contains('ok')) return;
    if (side === 'L') { sL && sL.setAttribute('aria-pressed', 'false'); sL = b; speak(b.dataset.say); } else { sR && sR.setAttribute('aria-pressed', 'false'); sR = b; }
    b.setAttribute('aria-pressed', 'true');
    if (!sL || !sR) return;
    const a = sL, c = sR; sL = sR = null;
    a.setAttribute('aria-pressed', 'false'); c.setAttribute('aria-pressed', 'false');
    if (a.dataset.k === c.dataset.k) {
      a.classList.add('ok'); c.classList.add('ok'); a.disabled = c.disabled = true; matched++; buzz(12);
      if (matched === q.ws.length) { sfx(true); resolve(true, q); }
    } else {
      [a, c].forEach(x => { x.classList.remove('bad'); void x.offsetWidth; x.classList.add('bad'); setTimeout(() => x.classList.remove('bad'), 450); });
      L.combo = 0; L.wrong++; sfx(false); buzz([30, 40, 30]); head();
    }
  };
  shuf(q.ws).forEach(w => { const b = el('button', 'btn pair jp', w.kana); b.type = 'button'; b.dataset.k = w.id; b.dataset.say = w.kana; b.onclick = () => pick(b, 'L'); left.append(b); });
  shuf(q.ws).forEach(w => { const b = el('button', 'btn pair', w.gl); b.type = 'button'; b.dataset.k = w.id; b.onclick = () => pick(b, 'R'); right.append(b); });
  wrap.append(left, right); qEl.append(wrap);
  setFoot('', '', t('matchHint'), '', null);
}

// ---------- Answers and spaced repetition ----------
function promote(w) { // right answer, first try in this lesson
  const r = rec(w) || { b: 0, due: today() };
  if (r.b >= 3 && r.due > today()) return; // learned and not due yet: extra practice does not shift the schedule
  const b = Math.min(7, r.b + 1), n = { b, due: today() + INTERVAL[b], t: Date.now() };
  if (r.m && b < 2) n.m = 1;
  S.words[w.id] = n;
}
function demote(w) {
  const r = rec(w) || { b: 0 };
  S.words[w.id] = { b: Math.max(0, r.b - 2), due: today(), t: Date.now(), m: 1 };
}
function builtOk(q) {
  const got = L.built.map(t => t.g), want = q.target, free = q.w.free || 0;
  if (!free) return got.join('') === want.join('');
  if (got.length !== want.length || got[got.length - 1] !== want[want.length - 1]) return false; // the verb closes the sentence
  if (free === 1 && got[0] !== want[0]) return false; // the topic opens it
  return got.slice().sort().join('|') === want.slice().sort().join('|'); // the middle may go in any order
}
function check() {
  const q = L.queue[L.i], tiles = q.type === 'build' || q.type === 'order';
  const ok = tiles ? builtOk(q) : L.sel === q.answer;
  if (!tiles) qEl.querySelectorAll('.opt').forEach(b => { b.disabled = true; if (b.dataset.v === q.answer) b.classList.add('ok'); else if (b.dataset.v === L.sel) b.classList.add('bad'); });
  resolve(ok, q);
}
function resolve(ok, q) {
  L.answered = true;
  if (ok) {
    L.combo++; L.right++;
    const gain = L.combo >= 3 ? 15 : 10; L.xp += gain;
    let note = `+${gain} XP`;
    if (q.w) {
      const b0 = lvl(q.w);
      if (!L.failed.has(q.w.id)) promote(q.w);
      const b1 = lvl(q.w);
      if (b1 > b0) note += b1 === 3 ? t(q.w.g ? 'taskDone' : 'wordDone') : t('levelUp', b1);
      else if (!L.failed.has(q.w.id) && box(q.w) >= 3) note += ' · ' + dueText(q.w);
      sfx(true); buzz(15); if (q.type !== 'jp2ru') speak(q.w.kana);
    }
    const praise = t('praise');
    setFoot('ok', praise[Math.floor(Math.random() * praise.length)], note, t('cont'), 'next');
  } else {
    L.combo = 0; L.wrong++; L.hearts--;
    demote(q.w); L.failed.add(q.w.id);
    L.queue.push({ type: q.type, w: q.w, again: true });
    sfx(false); buzz([40, 40, 40]);
    $('hearts').classList.remove('hit'); void $('hearts').offsetWidth; $('hearts').classList.add('hit');
    const sub = el('span'), right = q.w.g ? (q.w.tiles ? q.w.tiles.join(' ') : q.w.kana) : q.answer;
    sub.append(t('rightIs'), el('span', q.type === 'jp2ru' ? '' : 'jp', right));
    if (q.w.nt) sub.append(' · ' + q.w.nt);
    setFoot('bad', t('wrong'), sub, t('gotIt'), 'next');
    speak(q.w.kana);
  }
  save();
  if ((q.type === 'build' || q.type === 'order') && L.redraw) L.redraw();
  head(); act.focus({ preventScroll: true });
}
function next() {
  L.redraw = null; L.i++;
  if (L.hearts <= 0) return finish(false);
  if (L.i >= L.queue.length) return finish(true);
  renderQ(); $('q').parentElement.scrollTop = 0;
}

// ---------- Result ----------
function finish(passed) {
  addXp(L.xp);
  const extended = passed && !S.days[dayKey()]; // first finished lesson today
  if (passed) S.days[dayKey()] = 1;
  const clean = passed && L.wrong === 0, topic = L.kind === 'topic' ? TOPICS.find(t => t.id === L.topicId) : null;
  const wasDone = topic && !!S.passed[topic.id], gram = L.seen.every(w => w.g);
  if (topic && clean && !wasDone) S.passed[topic.id] = dayKey();
  save(true);
  const n = streak(), acc = Math.round(L.right / Math.max(1, L.right + L.wrong) * 100);
  const body = $('rBody'); body.innerHTML = '';
  let title, text;
  if (topic && clean) {
    const badge = el('div', 'r-badge', topic.glyph), c = el('span', 'check'); c.innerHTML = CHECK_SVG; badge.append(c); body.append(badge);
    title = wasDone ? t('topicAgain', tname(topic)) : t('topicPassed', tname(topic));
    text = wasDone ? t('topicAgainText') : t('topicPassedText');
  } else if (topic && passed) {
    title = t('withErrors');
    text = t('withErrorsText', L.wrong, wasDone);
  } else if (passed) {
    title = acc === 100 ? t('noErrors') : gram ? t('drillDone') : t('lessonDone');
    text = gram ? t('drillText') : t('lessonText');
  } else {
    title = t('livesOut');
    text = t('livesOutText');
  }
  body.append(el('div', 'r-big', clean ? 'かんぺき！' : passed ? 'おめでとう！' : 'がんばって！'), el('h2', '', title), el('p', '', text));
  // the numbers run up and the bar grows from where it was before the lesson
  const stats = el('div', 'stats'), xpB = el('b'), accB = el('b'), stB = el('b', '', t('days', n));
  [['x', 'XP', xpB], ['a', t('accuracy'), accB], ['f', t('statStreak'), stB]].forEach(([c, l, b]) => { const d = el('div', 'stat ' + c); d.append(el('span', '', l), b); stats.append(d); });
  body.append(stats);
  const scope = L.pool || L.seen, old = w => L.before[w.id] || 0;
  const p0 = pct(scope, old), p1 = pct(scope);
  const moved = L.seen.filter(w => lvl(w) > old(w)).length, learned = L.seen.filter(w => lvl(w) === 3 && old(w) < 3).length;
  const rp = el('div', 'panel r-prog'), rn = el('div', 'nm'), pB = el('b'), pv = el('span', 'pv');
  pv.append(pB); if (p1 > p0) pv.append(el('span', 'gain', `+${p1 - p0}%`));
  rn.append(el('span', '', L.pool ? t('progressOf', L.title) : t('progressWords')), pv);
  const bar = segBar(scope, old, true);
  xpB.textContent = '+0'; accB.textContent = '0%'; pB.textContent = p0 + '%';
  const play = () => { // runs once the result is actually visible
    countUp(xpB, 0, L.xp, 900, v => '+' + v); countUp(accB, 0, acc, 900, v => v + '%');
    setTimeout(() => countUp(pB, p0, p1, 1100, v => v + '%'), calm() ? 0 : 500); bar.play();
  };
  rp.append(rn, bar, el('small', '', gram ? t('gramSum', moved, learned) : t('wordSum', L.wasNew.size, moved, learned)));
  body.append(rp);
  const words = el('div', 'words');
  L.seen.forEach(w => {
    const r = el('div', 'word' + (L.failed.has(w.id) ? ' bad' : '') + (w.g ? ' g' : '')), ch = el('span', 'ch'), d = lvl(w) - old(w);
    if (d) ch.append(el('span', d > 0 ? 'up' : 'down', d > 0 ? '↑' : '↓'));
    ch.append(dots(lvl(w)));
    r.append(el('span', 'jp', w.kana), el('span', 'ru', w.g && w.jp && !w.jp.includes('＿') ? `${w.jp} · ${w.kind.toLowerCase()}` : w.gl), ch); words.append(r);
  });
  body.append(el('p', 'sec', gram ? t('tasks') : t('lessonWords')), words);
  $('rHome').textContent = L.origin === 'unit' ? t('backUnit') : L.origin === 'dict' ? t('backDict') : t('home');
  show('result');
  if (extended) streakSplash(n, () => { play(); confetti(); }); else { play(); if (passed) confetti(); }
}

// ---------- Confetti ----------
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('confetti'), ctx = c.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const cs = getComputedStyle(document.documentElement);
  const cols = ['--accent', '--gold', '--good', '--fire', '--bad'].map(v => cs.getPropertyValue(v).trim());
  const P = Array.from({ length: 110 }, () => ({ x: innerWidth / 2, y: innerHeight * .3, vx: (Math.random() - .5) * 12, vy: -Math.random() * 12 - 4, r: Math.random() * 6, s: 5 + Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)], vr: (Math.random() - .5) * .4 }));
  let t = 0;
  (function frame() {
    ctx.clearRect(0, 0, innerWidth, innerHeight); t++;
    P.forEach(p => { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - t / 120); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
    if (t < 120) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}

// ---------- In-page confirm ----------
function sheet(title, text, yes, no, onYes) {
  const bg = el('div', 'sheet-bg'), s = el('div', 'sheet gut');
  const by = el('button', 'btn btn-main', no), bn = el('button', 'btn-quit', yes);
  by.type = bn.type = 'button';
  s.append(el('h3', '', title), el('p', '', text), by, bn); bg.append(s); document.body.append(bg);
  const close = () => bg.remove();
  by.onclick = close; bn.onclick = () => { close(); onYes(); };
  bg.onclick = e => { if (e.target === bg) close(); };
  by.focus();
}

// ---------- Wiring ----------
act.onclick = () => { if (L.action === 'check') check(); else if (L.action === 'next') next(); };
$('quitBtn').onclick = () => sheet(t('quitTitle'), t('quitText'), t('quitYes'), t('quitNo'), () => { if (canSpeak) try { speechSynthesis.cancel(); } catch (e) {} goBack(); });
$('smartBtn').onclick = () => startSmart();
$('mistBtn').onclick = startMistakes;
$('rAgain').onclick = () => {
  if (L.kind === 'topic') startLesson(shuf(L.pool), { title: L.title, kind: 'topic', topicId: L.topicId, pool: L.pool });
  else if (L.kind === 'mist' && WORDS.some(w => (rec(w) || {}).m)) startMistakes();
  else if (L.kind === 'custom') startLesson(pickWeak(L.pool, 8), { title: L.title, kind: 'custom', pool: L.pool });
  else startSmart(L.lessonId || undefined);
};
$('rHome').onclick = goBack;
$('uBack').onclick = goHome;
$('nBack').onclick = () => goUnit();
$('stPrev').onclick = () => stGo(-1);
$('stNext').onclick = () => stGo(1);
// tap the right two thirds of the screen to go on, the left third to go back; a sideways swipe works too
$('note').addEventListener('click', e => {
  if (e.target.closest('button')) return;
  const r = $('note').getBoundingClientRect();
  stGo(e.clientX - r.left < r.width * .32 ? -1 : 1);
});
let stTouch = null;
$('note').addEventListener('touchstart', e => { const t = e.changedTouches[0]; stTouch = { x: t.clientX, y: t.clientY }; }, { passive: true });
$('note').addEventListener('touchend', e => {
  if (!stTouch) return; const t = e.changedTouches[0], dx = t.clientX - stTouch.x, dy = t.clientY - stTouch.y; stTouch = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && !e.target.closest('.gt-wrap')) stGo(dx < 0 ? 1 : -1);
}, { passive: true });
document.querySelectorAll('#xpRange button').forEach(b => { b.onclick = () => { PREF.xpRange = +b.dataset.r; ls.set(KEY_PREF, PREF); drawXpChart(false); }; });
document.querySelectorAll('#langList button').forEach(b => { b.onclick = () => {
  if (b.dataset.lang === lang()) return;
  PREF.lang = b.dataset.lang; ls.set(KEY_PREF, PREF);
  localizeWords(); applyStatic(); setSync(syncState); renderProfile();
}; });
$('soundBtn').onclick = () => { PREF.sound = !PREF.sound; ls.set(KEY_PREF, PREF); renderProfile(); };
$('resetBtn').onclick = () => sheet(t('resetTitle'), t('resetText'), t('resetYes'), t('resetNo'), () => { S = fresh(Date.now()); save(true); renderProfile(); });
document.querySelectorAll('#tabs button').forEach(b => { b.onclick = () => {
  if (b.dataset.tab === 'dict') { renderDict(); show('dict'); } else if (b.dataset.tab === 'profile') { renderProfile(); show('profile'); } else goHome();
}; });
$('dLesson').onclick = () => chooser(t('pickLesson'), [['all', t('allLessons'), t('wordsN', WORDS.length)], ...COURSE.map(l => [l.id, lname(l), `${lsub(l)} · ${wordsOf(l.id).length}`])], D.l, v => { D.l = v; D.open = null; renderDict(); });
$('kanjiBtn').onclick = () => { PREF.kanji = PREF.kanji === false; ls.set(KEY_PREF, PREF); renderProfile(); };
$('dq').oninput = e => { D.q = e.target.value; D.open = null; renderDictList(); };
$('dTrain').onclick = () => { const ws = dictWords(); startLesson(pickWeak(ws, 8), { title: t('tDict'), kind: 'custom', pool: ws }); };
addEventListener('keydown', e => {
  if (screen === 'note') {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); stGo(1); }
    else if (e.key === 'ArrowLeft') stGo(-1);
    else if (e.key === 'Escape') goUnit();
    return;
  }
  if (screen !== 'lesson' || document.querySelector('.sheet-bg')) return;
  const onBtn = e.target.closest && e.target.closest('button');
  if (e.key === 'Enter' && !onBtn) { e.preventDefault(); if (!act.hidden && !act.disabled) act.click(); return; }
  if (L.answered) return;
  if (/^[1-4]$/.test(e.key)) { const b = qEl.querySelectorAll('.opt')[+e.key - 1]; if (b) b.click(); }
  if (e.key === 'Backspace' && L.built && L.built.length && L.redraw) { e.preventDefault(); L.built.pop(); L.redraw(); }
});
if (location.hash === '#debug') window.__tango = { L, DRILLS, WORDS, state: () => S }; // for automated checks
ls.set(KEY, S);
localizeWords(); applyStatic(); setSync('local');
renderHome();
initSync().catch(() => setSync('error'));
})();
