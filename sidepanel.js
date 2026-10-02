// H(x) side panel — talks to window.__HF (core.js) in the editor tab via chrome.scripting.
const $ = s => document.querySelector(s);
const TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div'];
const HEAD = new Set(TAGS.slice(0, 6));
const BP_NAME = { desktop: 'Desktop', tablet: 'Tablet', landscape: 'Landscape', mobile: 'Mobile' };
const CORE_BUILD = '1.3.0+b2';   // must match VERSION in core.js

const st = {
  tabId: null, pageKey: null, data: null, rowIndex: new Map(),
  final: {},                         // id -> tag the user will get
  skipped: new Set(),                // ids the user chose not to change (persisted)
  forced: new Set(),                 // uncertain ids the user chose to include
  bp: null, tab: 'outline', onlyChanged: false, poll: null,
};

// ---------- tab plumbing ----------
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab.');
  return tab;
}
async function ensureAccess(tab) {
  const u = new URL(tab.url);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Switch to the tab with the Kirki editor first.');
  const origins = [`${u.origin}/*`];
  if (await chrome.permissions.contains({ origins })) return;
  if (!(await chrome.permissions.request({ origins }))) throw new Error(`Access to ${u.host} wasn't allowed.`);
}
async function exec(fn, args) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId: st.tabId }, world: 'MAIN',
    func: (fn, args, v) => (window.__HF?.version === v ? window.__HF[fn](...args) : { __missing: true }),
    args: [fn, args, CORE_BUILD],
  });
  return res?.result;
}
async function call(fn, ...args) {
  let r = await exec(fn, args);
  if (r?.__missing) {
    await chrome.scripting.executeScript({ target: { tabId: st.tabId }, world: 'MAIN', files: ['core.js'] });
    r = await exec(fn, args);
  }
  return r;
}

// ---------- storage ----------
const store = chrome.storage?.local;
async function loadPrefs() {
  try {
    const v = await store.get(['optLow', 'optOneH1', 'optHighlight', 'optParas']);
    $('#optHighlight').checked = v.optHighlight ?? false;
    $('#optParas').checked = v.optParas ?? false;
    applyHighlight();
    $('#optLow').checked = v.optLow ?? true;
    $('#optOneH1').checked = v.optOneH1 ?? true;
  } catch {}
}
async function loadSkipped() {
  st.skipped = new Set();
  try {
    const v = (await store.get('skip:' + st.pageKey))['skip:' + st.pageKey];
    if (v) st.skipped = new Set(v);
  } catch {}
}
function saveSkipped() { try { store.set({ ['skip:' + st.pageKey]: [...st.skipped] }); } catch {} }

// ---------- helpers ----------
function el(tag, props = {}, ...kids) {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat().forEach(k => k != null && k !== false && n.append(k.nodeType ? k : document.createTextNode(k)));
  return n;
}
const plural = (n, w, ws = w + 's') => `${n} ${n === 1 ? w : ws}`;
// Progress messages live in the footer (next to the action), never in the header,
// so they can't push into or overlap the tabs. Only errors go to the banner.
function setStatus(text, cls = '') {
  const s = $('#status'); s.hidden = true;
  if (cls === 'bad' && text) showError(text);
}
function showError(msg) { const e = $('#error'); e.hidden = !msg; e.textContent = msg || ''; }
const rowById = id => st.rowIndex.get(id);
const tagEl = (t, cls = '') => el('span', { className: `tag ${cls}`, textContent: t.toUpperCase() });

// a row is a "fix" when its final tag differs from what Kirki has now
const isFix = r => st.final[r.id] !== r.current;
const uncertain = r => r.confidence === 'low';
function applies(r) {
  if (r.symbol) return false;                      // inside a Kirki component — only you can change it
  if (!isFix(r) || r.confidence === 'skip' || st.skipped.has(r.id)) return false;
  if (uncertain(r) && !$('#optLow').checked && !st.forced.has(r.id)) return false;
  return true;
}
const fixes = () => st.data.rows.filter(isFix);
const inComponents = () => st.data.rows.filter(r => r.symbol && isFix(r) && r.confidence !== 'skip');
const applying = () => st.data.rows.filter(applies);
function tagsAfter() {
  const out = {};
  for (const r of st.data.rows) out[r.id] = applies(r) ? st.final[r.id] : r.current;
  return out;
}
const tagsNow = () => Object.fromEntries(st.data.rows.map(r => [r.id, r.current]));

function sectionName(idx) {
  const sec = st.data.sections.find(s => s.idx === idx);
  if (sec?.label) return sec.label.replace(/[-_]/g, ' ');
  const rows = st.data.rows.filter(r => r.section === idx);
  const t = rows.find(r => /^h[12]$/.test(st.final[r.id])) || rows.find(r => HEAD.has(st.final[r.id]));
  return t ? t.text : `Section ${idx + 1}`;
}

// Turn the analyser's reason into one short, plain sentence.
function explain(r) {
  const s = r.reason;
  const q = (m) => m ? `“${m[1].replace(/…$/, '')}”` : '';
  let main =
    /page title/.test(s) ? 'Main page title — only one H1 per page' :
    /section has no title/.test(s) ? 'Card title (this section has no title)' :
    /section title/.test(s) ? 'Title of this section' :
    /^stat under/.test(s) ? `Number inside the ${q(s.match(/under “(.+?)”/))} card` :
    /under “.+?” \(same card\)/.test(s) ? `Sits inside the ${q(s.match(/under “(.+?)”/))} card` :
    /under “.+?” \(same section\)/.test(s) ? `Item under ${q(s.match(/under “(.+?)”/))}` :
    /top-level/.test(s) ? 'Top-level heading in this section' :
    /sentence/.test(s) ? 'A sentence, not a heading' :
    /long text/.test(s) ? 'A paragraph, not a heading' :
    /label of stat/.test(s) ? 'Label of a number, not a heading' :
    /number\/stat/.test(s) ? 'A number, not a heading' :
    /index number/.test(s) ? 'A step number, not a heading' :
    /call-to-action|button\/link/.test(s) ? 'Button or link text, not a heading' :
    /contact detail|address/.test(s) ? 'Contact detail, not a heading' :
    /body-sized|small text/.test(s) ? 'Body-size text, not a heading' :
    /responsive/.test(s) ? 'Copy shown only on some screen sizes' :
    /extra H1/.test(s) ? 'Second H1 on the page — only one allowed' :
    /differs per breakpoint/.test(s) ? 'Level differs between screen sizes' :
    s.replace(/^./, c => c.toUpperCase());
  const extras = [];
  if (/so the page doesn't skip|so no level is skipped/.test(s)) extras.push('keeps levels in order');
  if (/look-alike/.test(s)) extras.push('matches similar items');
  if (r.instances?.length > 1) extras.push(`applies to all ${r.instances.length} CMS items`);
  return { main, extras };
}

// heading-order checks on a tag map
function validate(tags) {
  const { rows, bps } = st.data;
  const raw = [];
  for (const bp of bps) {
    let h1 = 0, prev = 0;
    for (const r of rows) {
      const t = tags[r.id];
      if (!HEAD.has(t) || !r.visibleOn.includes(bp)) continue;
      const l = +t[1];
      if (l === 1) h1++;
      if (prev && l > prev + 1) raw.push({ bp, id: r.id, msg: `Jumps from H${prev} to H${l} at “${r.text.slice(0, 36)}”` });
      prev = l;
    }
    if (h1 === 0) raw.push({ bp, msg: 'No H1 (page title)' });
    if (h1 > 1) raw.push({ bp, msg: `${h1} H1s — a page should have one` });
  }
  const merged = new Map();
  for (const i of raw) {
    const k = (i.id || '') + i.msg;
    merged.has(k) ? merged.get(k).bps.push(i.bp) : merged.set(k, { ...i, bps: [i.bp] });
  }
  return [...merged.values()].map(i => ({
    ...i,
    where: i.bps.length === bps.length ? '' : ` (${i.bps.map(b => BP_NAME[b] || b).join(', ')})`,
  }));
}

// ---------- scan ----------
async function scan() {
  showError(''); stopWait();
  const btn = $('#rescan');
  btn.classList.add('busy'); setStatus('Scanning…');
  try {
    const tab = await activeTab();
    await ensureAccess(tab);
    const newPage = st.tabId !== tab.id || st.pageKey !== tab.url;
    st.tabId = tab.id; st.pageKey = tab.url;
    if (newPage) { await loadSkipped(); st.forced.clear(); }
    const data = await call('run', { oneH1InSource: $('#optOneH1').checked });
    if (!data?.ok) throw new Error(data?.error || 'Scan failed.');
    st.data = data;
    st.rowIndex = new Map(data.rows.map(r => [r.id, r]));
    st.final = Object.fromEntries(data.rows.map(r => [r.id, r.suggested]));
    if (!data.bps.includes(st.bp)) st.bp = data.bps[0];
    $('#empty').hidden = true; $('#results').hidden = false; $('#applyBar').hidden = false; $('#rescan').hidden = false;
    toggleSettings(false);
    setStatus('');
    render();
    const s = data.status;   // returned with the scan: no extra round trip
    s?.armed ? (renderFlow({ phase: 'armed', count: s.armed }), waitForSave()) : renderFlow({ phase: 'idle' });
  } catch (e) {
    showError(e.message);
  } finally { btn.classList.remove('busy'); }
}

// ---------- render ----------
function render() {
  renderSummary();
  st.tab === 'outline' ? renderOutline() : renderChanges();
}

// One line: how many fixes, and whether the page will be valid afterwards.
// "Now" problems aren't shown separately — the outline already shows every change.
function renderSummary() {
  const list = applying();
  const n = list.length;
  const comps = inComponents().length;
  const total = fixes().filter(r => r.confidence !== 'skip').length;
  const extra = [total - n - comps > 0 && `${total - n - comps} skipped`, comps && `${comps} in components`].filter(Boolean).join(' · ');
  $('#sumBig').textContent = total ? plural(n, 'fix', 'fixes') + (extra ? ` · ${extra}` : '') : 'All headings look right';
  $('#tabCount').textContent = total || '';
  const apply = $('#apply');
  apply.textContent = n ? `Apply ${plural(n, 'fix', 'fixes')}` : 'Nothing to apply';
  apply.disabled = !n;

  const after = validate(tagsAfter());
  const h = $('#health'); h.replaceChildren();
  if (!after.length) {
    h.append(el('span', { className: 'dot ok' }), 'Valid after fixes');
    $('#issues').hidden = true;
  } else {
    const b = el('button', { type: 'button', textContent: `${plural(after.length, 'problem')} left` });
    b.onclick = () => renderIssues(after, 'after');
    h.append(el('span', { className: 'dot warn' }), b);
    const box = $('#issues');
    if (!box.hidden) renderIssues(after, 'after', true);
  }
}

function renderIssues(list, key, keepOpen = false) {
  const box = $('#issues');
  if (!keepOpen && !box.hidden && box.dataset.key === key) { box.hidden = true; return; }
  box.dataset.key = key; box.hidden = !list.length; box.replaceChildren();
  for (const i of list) {
    const li = el('li', {}, el('span', { className: 'what', textContent: i.msg + i.where }));
    const r = i.id && rowById(i.id);
    if (r) {
      const acts = el('div', { className: 'row-actions' });
      const show = el('button', { type: 'button', className: 'text-btn', textContent: 'Show on canvas' });
      show.onclick = () => call('show', r.id, 0, st.bp);
      acts.append(show);
      if (key === 'after' && isFix(r) && !applies(r)) {
        const use = el('button', { type: 'button', className: 'text-btn', textContent: `Apply ${st.final[r.id].toUpperCase()} here` });
        use.onclick = () => { st.skipped.delete(r.id); st.forced.add(r.id); saveSkipped(); render(); };
        acts.append(use);
      }
      li.append(acts);
    }
    box.append(li);
  }
}

// Outline = the page's heading tree as it will be, with what changes marked inline.
function renderOutline() {
  const ICONS = {
    desktop: '<svg viewBox="0 0 20 20"><rect x="2.5" y="4" width="15" height="10" rx="1.5"/><path d="M7.5 17h5M10 14v3"/></svg>',
    tablet: '<svg viewBox="0 0 20 20"><rect x="4.5" y="2.5" width="11" height="15" rx="2"/><path d="M9 15h2"/></svg>',
    landscape: '<svg viewBox="0 0 20 20"><rect x="2.5" y="6" width="15" height="9" rx="2"/><path d="M15 10v1"/></svg>',
    mobile: '<svg viewBox="0 0 20 20"><rect x="6" y="2.5" width="8" height="15" rx="2"/><path d="M9.3 15h1.4"/></svg>',
  };
  const seg = $('#bpSeg'); seg.replaceChildren();
  for (const b of st.data.bps) {
    const btn = el('button', { type: 'button', className: b === st.bp ? 'on' : '', title: BP_NAME[b] || b, innerHTML: ICONS[b] || '' });
    btn.append(el('span', { textContent: BP_NAME[b] || b }));
    btn.setAttribute('role', 'radio'); btn.setAttribute('aria-checked', String(b === st.bp));
    btn.onclick = () => { st.bp = b; renderOutline(); };
    seg.append(btn);
  }
  const oc = $('#onlyChanged');
  oc.classList.toggle('on', st.onlyChanged); oc.setAttribute('aria-pressed', String(st.onlyChanged));
  const after = tagsAfter();
  const ol = $('#outline'); ol.replaceChildren();
  const frag = document.createDocumentFragment();
  let lastHeadingLevel = 1;
  for (const r of st.data.rows) {
    if (!r.visibleOn.includes(st.bp)) continue;
    // Component rows are never applied, but the outline still shows what the tag should be.
    const was = r.current, will = r.symbol ? st.final[r.id] : after[r.id];
    const wasH = HEAD.has(was), willH = HEAD.has(will);
    const changed = was !== will;
    const showParas = $('#optParas').checked;
    if (!wasH && !willH && !(showParas && !changed && will === 'p')) continue;   // body paragraphs only, and only with "Show paragraphs"
    if (st.onlyChanged && !changed) continue;
    const isPara = !wasH && !willH;
    const lvl = isPara ? Math.min(6, lastHeadingLevel + 1) : +(willH ? will : was)[1];
    const tags = el('span', { className: 'tags' });
    if (!changed) tags.append(tagEl(will, isPara ? '' : `lv lv${lvl}`));
    else tags.append(tagEl(was, 'old'), el('span', { className: 'arrow', textContent: '→' }), tagEl(will, willH ? `new lv lv${lvl}` : 'new'));
    const li = el('li', {
      className: `l${lvl}${changed ? ' changed' : ''}${!willH && !isPara ? ' removed' : ''}${isPara ? ' para' : ''}${r.symbol && changed ? ' in-comp' : ''}`,
      title: `${r.text}\n\n${changed ? `${was.toUpperCase()} → ${will.toUpperCase()}: ` : ''}${explain(r).main}`,
    }, tags, el('span', { className: 'otext', textContent: r.text }));
    if (r.symbol) li.append(el('span', { className: 'more comp-badge', textContent: 'Component' }));
    if (r.instances?.length > 1) li.append(el('span', { className: 'more', textContent: `+${r.instances.length - 1} CMS` }));
    if (!isPara) lastHeadingLevel = lvl;
    li.style.setProperty('--depth', lvl - 1);
    li.onclick = () => call('show', r.id, 0, st.bp);
    frag.append(li);
  }
  if (!frag.childNodes.length) frag.append(el('li', { className: 'empty-row', textContent: st.onlyChanged ? 'No changes on this screen size.' : 'No headings on this screen size.' }));
  ol.append(frag);
}

// Changes = every fix, grouped by section, each with the reason and a Skip.
function renderChanges() {
  const pane = $('#paneChanges'); pane.replaceChildren();
  const comps = inComponents();
  const list = fixes().filter(r => r.confidence !== 'skip' && !r.symbol);
  if (!list.length && !comps.length) { pane.append(el('p', { className: 'all-good', textContent: 'No changes needed — every heading already has the right tag.' })); return; }
  const bySec = new Map();
  list.forEach(r => (bySec.get(r.section) ?? bySec.set(r.section, []).get(r.section)).push(r));
  for (const [idx, rows] of [...bySec].sort((a, b) => a[0] - b[0])) {
    const allSkipped = rows.every(r => !applies(r));
    const toggle = el('button', { type: 'button', className: 'text-btn', textContent: allSkipped ? 'Include section' : 'Skip section' });
    toggle.onclick = () => {
      rows.forEach(r => allSkipped ? (st.skipped.delete(r.id), st.forced.add(r.id)) : st.skipped.add(r.id));
      saveSkipped(); render();
    };
    const sec = el('section', { className: 'sec' },
      el('div', { className: 'sec-head' }, el('span', { className: 'sec-name', textContent: sectionName(idx) }), toggle));
    rows.forEach(r => sec.append(fixRow(r)));
    pane.append(sec);
  }
  if (comps.length) {
    const sec = el('section', { className: 'sec comps' },
      el('div', { className: 'sec-head' }, el('span', { className: 'sec-name', textContent: `In components (${comps.length})` })),
      el('p', { className: 'comp-note', textContent: 'These sit inside a Kirki component, so H of x doesn’t change them. Open the component in Kirki and set the tag there — it updates everywhere the component is used.' }));
    comps.forEach(r => sec.append(fixRow(r)));
    pane.append(sec);
  }
}

// A heading inside a component: shown with its problem, but nothing to tick — you fix it in Kirki.
function compRow(r) {
  const { main } = explain(r);
  const text = el('span', { className: 'fix-text', textContent: r.text, title: r.text });
  text.onclick = () => call('show', r.id, 0, st.bp);
  return el('div', { className: 'fix comp' },
    text,
    el('span', { className: 'fix-change' }, tagEl(r.current, 'old'), el('span', { className: 'arrow', textContent: '→' }), tagEl(st.final[r.id], 'new')),
    el('span', { className: 'fix-why' }, main),
    el('span', { className: 'fix-end' }, el('span', { className: 'comp-badge', textContent: 'Component' })));
}

function fixRow(r) {
  if (r.symbol) return compRow(r);
  const on = applies(r);
  const { main, extras } = explain(r);
  const sel = el('select', { className: 'tag-select' },
    TAGS.map(t => el('option', { value: t, textContent: t.toUpperCase(), selected: t === st.final[r.id] })));
  sel.setAttribute('aria-label', `New tag for “${r.text}”`);
  sel.onchange = () => { st.final[r.id] = sel.value; st.skipped.delete(r.id); st.forced.add(r.id); saveSkipped(); render(); };

  const why = el('span', { className: 'fix-why' }, main + (extras.length ? ` · ${extras.join(' · ')}` : ''));
  const needsCheck = uncertain(r) && !$('#optLow').checked && !st.forced.has(r.id) && !st.skipped.has(r.id);
  if (uncertain(r)) why.prepend(el('span', { className: 'check-note', textContent: needsCheck ? 'Check this · not applied · ' : 'Check this · ' }));

  const btn = el('button', { type: 'button', className: 'text-btn', textContent: on ? 'Skip' : 'Include' });
  btn.onclick = () => {
    if (on) st.skipped.add(r.id); else { st.skipped.delete(r.id); st.forced.add(r.id); }
    saveSkipped(); render();
  };
  const text = el('span', { className: 'fix-text', textContent: r.text, title: r.instances?.length > 1 ? r.instances.join('\n') : r.text });
  text.onclick = () => call('show', r.id, 0, st.bp);

  return el('div', { className: `fix${on ? '' : ' skipped'}` },
    text,
    el('span', { className: 'fix-change' }, tagEl(r.current, 'old'), el('span', { className: 'arrow', textContent: '→' }), sel),
    why,
    el('span', { className: 'fix-end' }, btn));
}

function setTab(t) {
  st.tab = t;
  for (const [id, name] of [['#tabOutline', 'outline'], ['#tabChanges', 'changes']]) {
    $(id).classList.toggle('on', t === name); $(id).setAttribute('aria-selected', String(t === name));
  }
  $('#paneOutline').hidden = t !== 'outline';
  $('#paneChanges').hidden = t !== 'changes';
  render();
}
function toggleMenu(force) {
  const menu = $('#menu'), btn = $('#menuBtn');
  const open = force === undefined ? !menu.classList.contains('open') : force;
  menu.classList.toggle('open', open);
  menu.setAttribute('aria-hidden', String(!open));
  btn.setAttribute('aria-expanded', String(open));
  if (open) setTimeout(() => menu.querySelector('.menu-item')?.focus({ preventScroll: true }), 60);
}
const toggleSettings = toggleMenu;   // scan() closes it

// ---------- apply flow ----------
function renderFlow({ phase, count, info }) {
  const f = $('#flow');
  $('#disarm').hidden = phase !== 'armed';
  $('#reload').hidden = phase !== 'done' || !!st.applied;
  $('#apply').hidden = phase === 'armed' || phase === 'done';
  f.hidden = phase === 'idle';
  const cfg = {
    idle: ['', ''],
    armed: ['armed', `${plural(count, 'fix', 'fixes')} ready. Now click Save in Kirki (make a small edit first if Save is greyed out).`],
    done: ['done', info],
    bad: ['bad', info],
  }[phase];
  f.className = 'flow ' + cfg[0]; f.textContent = cfg[1];
  if (phase === 'armed') setStatus('Waiting for you to save in Kirki…', 'armed');
  if (phase === 'done') setStatus(st.applied ? 'Applied' : 'Saved', 'ok');
}
async function apply() {
  const map = Object.fromEntries(applying().map(r => [r.id, st.final[r.id]]));
  // First try: change the tags straight in the open editor (no Save click, no reload).
  setStatus('Applying…');
  let live = null;
  try { live = await call('applyLive', map); } catch { live = null; }
  if (live?.ok) {
    const miss = live.missing?.length ? ` ${live.missing.length} weren’t found.` : '';
    st.applied = true;
    return renderFlow({ phase: 'done', info: live.savedBy === 'kirki'
      ? `${plural(live.applied, 'tag')} applied and saved.${miss}`
      : `${plural(live.applied, 'tag')} applied in the editor.${miss} Click Save in Kirki to store them.` });
  }
  const res = await call('arm', map);
  if (!res?.ok) return showError(res?.error || 'Couldn’t prepare the fixes.');
  renderFlow({ phase: 'armed', count: res.count });
  waitForSave();
}
async function waitForSave() {
  const token = (st.poll = Symbol('wait'));
  let s;
  try { s = await call('waitForSave'); } catch (e) { s = { errors: [String(e)] }; }
  if (st.poll !== token) return;
  st.poll = null;
  if (s?.errors?.length) return renderFlow({ phase: 'bad', info: 'Something went wrong while saving: ' + s.errors.join('; ') });
  if (s?.lastRewrite) {
    const miss = s.lastRewrite.missing.length ? ` ${s.lastRewrite.missing.length} weren’t found.` : '';
    return renderFlow({ phase: 'done', info: `${plural(s.lastRewrite.applied, 'tag')} saved.${miss} Reload the editor to see them.` });
  }
  if (s?.timeout) waitForSave();
}
function stopWait() { st.poll = null; }

// ---------- wiring ----------
$('#scanBig').onclick = scan;
$('#rescan').onclick = scan;
$('#menuBtn').onclick = e => { e.stopPropagation(); toggleMenu(); };
$('#menuClose').onclick = () => { toggleMenu(false); $('#menuBtn').focus(); };
$('#menuRescan').onclick = () => { toggleMenu(false); scan(); };
document.addEventListener('click', e => { if (!e.target.closest('#menu, #menuBtn')) toggleMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#menu').classList.contains('open')) { toggleMenu(false); $('#menuBtn').focus(); } });
function applyHighlight() { $('#outline').classList.toggle('hl', $('#optHighlight').checked); }
$('#optHighlight').addEventListener('change', e => { try { store.set({ optHighlight: e.target.checked }); } catch {} applyHighlight(); });
$('#optParas').addEventListener('change', e => { try { store.set({ optParas: e.target.checked }); } catch {} if (st.data) render(); });
for (const id of ['optLow', 'optOneH1']) {
  $('#' + id).addEventListener('change', e => {
    try { store.set({ [id]: e.target.checked }); } catch {}
    if (!st.data || st.poll) return;
    id === 'optOneH1' ? scan() : render();
  });
}
$('#clearIgnored').onclick = () => { toggleMenu(false); st.skipped.clear(); if (st.pageKey) saveSkipped(); if (st.data) render(); };
$('#tabOutline').onclick = () => setTab('outline');
$('#tabChanges').onclick = () => setTab('changes');
$('#onlyChanged').onclick = () => { st.onlyChanged = !st.onlyChanged; renderOutline(); };
$('#apply').onclick = apply;
$('#disarm').onclick = async () => { stopWait(); await call('disarm'); renderFlow({ phase: 'idle' }); setStatus('Cancelled — nothing was changed'); };
$('#reload').onclick = async () => {
  await chrome.tabs.reload(st.tabId);
  st.data = null;
  $('#results').hidden = true; $('#applyBar').hidden = true; $('#rescan').hidden = true; $('#empty').hidden = false;
  renderFlow({ phase: 'idle' });
  setStatus('Reloaded — scan again to check', 'ok');
};
chrome.tabs.onActivated.addListener(() => { if (!st.poll && st.data) setStatus('You switched tabs — scan again'); });
chrome.tabs.onUpdated.addListener((id, info) => { if (id === st.tabId && info.status === 'loading' && st.poll) { stopWait(); renderFlow({ phase: 'idle' }); } });
// appearance: Auto (follow system) / Light / Dark
function setTheme(t, save = true) {
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  document.querySelectorAll('.seg [data-theme]').forEach(b => {
    b.classList.toggle('on', b.dataset.theme === t); b.setAttribute('aria-checked', String(b.dataset.theme === t));
  });
  try { localStorage.setItem('hx-theme', t); } catch {}
  if (save) try { store.set({ theme: t }); } catch {}
}
document.querySelectorAll('.seg [data-theme]').forEach(b => { b.onclick = () => setTheme(b.dataset.theme); });
setTheme((() => { try { return localStorage.getItem('hx-theme') || 'system'; } catch { return 'system'; } })(), false);
store?.get('theme').then(v => v.theme && setTheme(v.theme, false)).catch(() => {});
loadPrefs();
