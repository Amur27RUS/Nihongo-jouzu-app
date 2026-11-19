// Portable progress only: preferences and the current device identity stay local.
window.TANGO_BACKUP = (() => {
  const MAX_BYTES = 5 * 1024 * 1024;
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const assert = condition => { if (!condition) throw new Error('Invalid progress backup'); };
  function validate(s) {
    assert(object(s) && s.v === 2 && integer(s.epoch));
    for (const key of ['words', 'dev', 'days', 'passed']) assert(object(s[key]));
    for (const r of Object.values(s.words)) {
      assert(object(r) && integer(r.b) && r.b <= 7 && integer(r.due) && integer(r.t));
      assert(r.m === undefined || r.m === 1);
    }
    for (const r of Object.values(s.dev)) {
      assert(object(r) && integer(r.t) && object(r.d));
      for (const [day, xp] of Object.entries(r.d)) assert(date(day) && integer(xp));
    }
    for (const [day, value] of Object.entries(s.days)) assert(date(day) && value === 1);
    for (const day of Object.values(s.passed)) assert(date(day));
    return s;
  }
  function parse(text) {
    assert(typeof text === 'string' && new TextEncoder().encode(text).length <= MAX_BYTES);
    const file = JSON.parse(text, (key, value) => {
      assert(!['__proto__', 'constructor', 'prototype'].includes(key));
      return value;
    });
    assert(object(file) && file.app === 'genki-drill' && file.version === 1);
    return validate(file.progress);
  }
  function stringify(progress) {
    const text = JSON.stringify({ app: 'genki-drill', version: 1, exportedAt: new Date().toISOString(), progress }, null, 2);
    parse(text); // Never export a backup that this version cannot restore.
    return text;
  }
  function restore(progress, currentEpoch, now = Date.now()) {
    const copy = parse(stringify(progress));
    // Explicit replacement wins over older copies, including a previous reset.
    copy.epoch = Math.max(now, currentEpoch + 1, copy.epoch + 1);
    return validate(copy);
  }
  return { MAX_BYTES, parse, stringify, restore };
})();
