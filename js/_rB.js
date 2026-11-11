/* ---------- 顶栏 / 工具条 ---------- */
function renderHeadMeta() {
  const doc = R.doc, sh = R.sh, p = doc.paper;
  sh.title.textContent = p.title || p.fileName || 'PDF';
  sh.title.title = sh.title.textContent;
  const parts = [];
  if (p.authors) parts.push(p.authors);
  if (p.year) parts.push(p.year);
  if (p.venue) parts.push(p.venue);
  sh.meta.innerHTML = '';
  if (parts.length) sh.meta.append(el('span', { text: parts.join(' · ') }));
  sh.meta.append(el('span', { class: 'badge ' + (p.role || 'main'), text: T('role_' + (p.role || 'main')) }));
  sh.meta.append(el('span', { class: 'badge ' + (p.status || 'unread'), text: T(p.status || 'unread') }));
  if (doc.num) sh.meta.append(el('span', { text: doc.num + ' ' + T('page') }));

  sh.hacts.innerHTML = '';
  const roleSel = el('select', { class: 'hdr-select' });
  ['main', 'si', 'review', 'other'].forEach((r) => {
    const o = el('option', { value: r, text: T('role_' + r) });
    if ((p.role || 'main') === r) o.selected = true;
    roleSel.append(o);
  });
  roleSel.onchange = async () => {
    await LB.store.patch(p.id, { role: roleSel.value });
    doc.paper = LB.store.paper(p.id) || p;
    renderHeadMeta();
    renderSide();
  };
  const relBtn = el('button', { class: 'btn ghost sm', text: T('related') });
  relBtn.onclick = () => openRelated();
  sh.hacts.append(roleSel, relBtn);
}

function openRelated() {
  const doc = R.doc;
  const rel = LB.store.related(doc.id);
  const rows = [];
  const push = (list, label) => {
    (list || []).forEach((x) => rows.push({ x, label }));
  };
  push([rel.main], T('role_main'));
  push(rel.si, T('role_si'));
  push(rel.reviews, T('role_review'));
  const body = el('div');
  if (!rows.length) body.append(el('div', { class: 'empty-hint', text: T('synth_none') }));
  rows.forEach((r) => {
    const b = el('button', { class: 'sr-item', html: '<span class="pg">' + esc(r.label) + '</span> ' + esc(r.x.title || r.x.fileName || '') });
    b.onclick = () => { m.close(); LB.go('#/p/' + r.x.id); };
    body.append(b);
  });
  const m = LB.modal({ title: T('related'), body });
}

function buildToolbar() {
  const sh = R.sh;
  sh.toolbar.innerHTML = '';

  const nav = el('div', { class: 'tb-group' });
  const bPrev = el('button', { class: 'tb-btn', title: '↑', html: '&#8593;' });
  const bNext = el('button', { class: 'tb-btn', title: '↓', html: '&#8595;' });
  bPrev.onclick = () => goPage(R.doc.cur - 1, true);
  bNext.onclick = () => goPage(R.doc.cur + 1, true);
  const pg = el('div', { class: 'tb-pg' });
  const inp = el('input', { value: String(R.doc.cur) });
  inp.onkeydown = (e) => {
    if (e.key === 'Enter') { goPage(+inp.value || 1, true); inp.blur(); }
  };
  inp.onblur = () => { inp.value = String(R.doc.cur); };
  pg.append(inp, el('span', { text: '/ ' + R.doc.num }));
  nav.append(bPrev, pg, bNext);

  const zoom = el('div', { class: 'tb-group' });
  const zOut = el('button', { class: 'tb-btn', text: '−', title: T('zoom_out') });
  const zLabel = el('span', { class: 'tb-zoom', text: Math.round(R.doc.scale * 100) + '%' });
  const zIn = el('button', { class: 'tb-btn', text: '+', title: T('zoom_in') });
  zOut.onclick = () => applyScale(R.doc.scale / 1.15, true);
  zIn.onclick = () => applyScale(R.doc.scale * 1.15, true);
  zLabel.style.cursor = 'pointer';
  zLabel.onclick = () => applyScale(1, true);
  zoom.append(zOut, zLabel, zIn);

  const fits = el('div', { class: 'tb-group' });
  const fw = el('button', { class: 'tb-btn', text: '↔', title: T('fit_width') });
  const fp = el('button', { class: 'tb-btn', text: '⤢', title: T('fit_page') });
  fw.onclick = () => { R.doc.state.fit = 'width'; applyScale(fitScale('width'), true); };
  fp.onclick = () => { R.doc.state.fit = 'page'; applyScale(fitScale('page'), true); };
  fits.append(fw, fp);

  const spacer = el('div', { class: 'tb-spacer' });

  const search = el('div', { class: 'tb-search' });
  const sInp = el('input', { placeholder: T('find_ph'), type: 'search' });
  const sCnt = el('span', { class: 'cnt' });
  sInp.oninput = deb(() => { if (sInp.value.trim()) findInDoc(sInp.value); else clearFind(); }, 260);
  sInp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); } };
  search.append(sInp, sCnt);

  sh.toolbar.append(nav, zoom, fits, spacer, search);
}

/* ---------- 左栏（目录 / 缩略图 / 分区） ---------- */
function renderSide() {
  const doc = R.doc, sh = R.sh;
  const tabs = [['toc', T('toc')], ['thumb', T('thumbs')], ['outline', T('sections')]];
  doc.sideTab = doc.sideTab || 'toc';
  sh.stab.innerHTML = '';
  tabs.forEach((t) => {
    const b = el('button', { class: 'side-tab' + (doc.sideTab === t[0] ? ' active' : ''), text: t[1] });
    b.onclick = () => { doc.sideTab = t[0]; renderSide(); };
    sh.stab.append(b);
  });
  const body = sh.sbody;
  body.innerHTML = '';
  if (doc.sideTab === 'thumb') return renderThumbs(body);
  const secs = doc.state.sections || [];
  if (!secs.length) {
    body.append(el('div', { class: 'side-empty', text: T('no_sections') }));
    return;
  }
  secs.forEach((s, i) => {
    const b = el('button', { class: 'toc-item lvl' + (s.level || 1) });
    b.dataset.p = s.page || 1;
    b.dataset.i = i;
    b.innerHTML = '<span class="sec-dot"></span> ' + esc(s.text || '');
    if (s.page) b.append(el('span', { class: 'pg', text: ' ' + s.page }));
    b.onclick = () => goPage(s.page || 1, true);
    body.append(b);
  });
  markSideActive(doc.cur);
}

function renderThumbs(body) {
  const doc = R.doc;
  doc.thumbCache = doc.thumbCache || {};
  for (let n = 1; n <= doc.num; n++) {
    const th = el('div', { class: 'thumb' + (n === doc.cur ? ' active' : '') });
    th.dataset.n = n;
    const img = el('img');
    th.append(img, el('span', { class: 'n', text: String(n) }));
    th.onclick = () => goPage(n, true);
    body.append(th);
    const cached = doc.thumbCache[n];
    if (cached) { img.src = cached; continue; }
    (async () => {
      try {
        const page = await doc.pdf.getPage(n);
        const vp = page.getViewport({ scale: 0.35 });
        const cv = document.createElement('canvas');
        cv.width = Math.ceil(vp.width);
        cv.height = Math.ceil(vp.height);
        await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        const url = cv.toDataURL('image/jpeg', 0.62);
        doc.thumbCache[n] = url;
        img.src = url;
      } catch (e) { }
    })();
  }
}

function markSideActive(n) {
  const doc = R.doc;
  if (!doc || !R.sh) return;
  for (const b of R.sh.sbody.querySelectorAll('.toc-item')) {
    b.classList.toggle('active', +b.dataset.p === n);
  }
  for (const t of R.sh.sbody.querySelectorAll('.thumb')) {
    t.classList.toggle('active', +t.dataset.n === n);
  }
}

/* ---------- 页内查找 ---------- */
function paintHits(p) {
  if (!p || !p.textLayer) return;
  const spans = p.textLayer.querySelectorAll('span');
  spans.forEach((s) => s.classList.remove('hit'));
  if (!R.hits || !R.hits.length) return;
  for (const h of R.hits) {
    if (h.page !== p.n) continue;
    const sp = spans[h.item];
    if (sp) sp.classList.add('hit');
  }
}

function clearFind() {
  const doc = R.doc;
  if (!doc) return;
  R.hits = [];
  R.hitIdx = -1;
  for (const p of doc.pages) {
    if (!p.textLayer) continue;
    p.textLayer.querySelectorAll('.hit, .cur').forEach((s) => s.classList.remove('hit', 'cur'));
  }
  const c = R.sh.toolbar.querySelector('.tb-search .cnt');
  if (c) c.textContent = '';
}

async function findInDoc(q) {
  const doc = R.doc;
  q = String(q || '').trim();
  if (!q) return clearFind();
  const needle = q.toLowerCase();
  R.hits = [];
  for (let n = 1; n <= doc.num; n++) {
    const data = await getTextData(n);
    let joined = '', map = [];
    data.items.forEach((it, i) => {
      map.push([joined.length, i]);
      joined += it.str.toLowerCase() + ' ';
    });
    let at = joined.indexOf(needle);
    while (at >= 0 && R.hits.length < 400) {
      let idx = 0;
      for (const m of map) { if (m[0] <= at) idx = m[1]; else break; }
      R.hits.push({ page: n, item: idx, text: data.items[idx].str });
      at = joined.indexOf(needle, at + needle.length);
    }
  }
  R.hitIdx = -1;
  for (const p of doc.pages) if (p.drawn && p.textLayer) paintHits(p);
  const cnt = R.sh.toolbar.querySelector('.tb-search .cnt');
  if (cnt) cnt.textContent = R.hits.length ? R.hits.length + ' ' + T('matches') : T('find_none');
  if (R.hits.length) findStep(1);
  else clearFind();
}

async function findStep(dir) {
  const doc = R.doc;
  if (!doc || !R.hits || !R.hits.length) return;
  R.hitIdx = (R.hitIdx + (dir || 1) + R.hits.length) % R.hits.length;
  const h = R.hits[R.hitIdx];
  const p = doc.pages[h.page - 1];
  if (!p) return;
  if (!p.drawn) await renderPage(p);
  goPage(h.page, false);
  p.textLayer.querySelectorAll('.cur').forEach((s) => s.classList.remove('cur'));
  const spans = p.textLayer.querySelectorAll('span');
  const sp = spans[h.item] || spans[0];
  if (sp) {
    sp.classList.add('cur');
    const y = p.wrap.offsetTop + sp.offsetTop - R.sh.scroll.clientHeight / 2;
    R.sh.scroll.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }
  const cnt = R.sh.toolbar.querySelector('.tb-search .cnt');
  if (cnt) cnt.textContent = (R.hitIdx + 1) + '/' + R.hits.length;
}

/* ---------- 选区菜单 ---------- */
function hideSelMenu() {
  const m = document.getElementById('selMenu');
  if (m) m.classList.add('hidden');
  R.sel = null;
}

function selInfo() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const text = sel.toString().replace(/\s+/g, ' ').trim();
  if (text.length < 2) return null;
  const range = sel.getRangeAt(0);
  const startEl = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentNode;
  const wrap = startEl && startEl.closest ? startEl.closest('.page-wrap') : null;
  if (!wrap || !wrap.closest('.doc-scroll')) return null;
  const doc = R.doc;
  if (!doc) return null;
  const pageEl = wrap.querySelector('.page');
  const pr = pageEl.getBoundingClientRect();
  const s = doc.scale;
  const rects = [];
  for (const r of range.getClientRects()) {
    if (r.width < 1.2 || r.height < 1.2) continue;
    rects.push({
      x: (r.left - pr.left) / s,
      y: (r.top - pr.top) / s,
      w: r.width / s,
      h: r.height / s
    });
  }
  if (!rects.length) return null;
  return { text, page: +wrap.dataset.n, rects, box: range.getBoundingClientRect() };
}

function setupSelection() {
  const sc = R.sh.scroll;
  const onUp = () => {
    setTimeout(() => {
      const info = selInfo();
      if (!info) return hideSelMenu();
      R.sel = info;
      showSelMenu(info);
    }, 10);
  };
  sc.addEventListener('mouseup', onUp, { signal: R.ac.signal });
  sc.addEventListener('touchend', onUp, { signal: R.ac.signal });
  document.addEventListener('mousedown', (e) => {
    const m = document.getElementById('selMenu');
    if (m && !m.contains(e.target)) hideSelMenu();
  }, { signal: R.ac.signal });
}

function showSelMenu(info) {
  const m = document.getElementById('selMenu');
  if (!m) return;
  m.innerHTML = '';
  const mk = (label, cls, fn) => {
    const b = el('button', { class: cls || '', text: label });
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = fn;
    m.append(b);
    return b;
  };
  mk(T('highlight'), '', () => openHlPop());
  m.append(el('div', { class: 'sep' }));
  mk(T('add_note'), '', () => openNotePop());
  m.append(el('div', { class: 'sep' }));
  mk(T('ask'), 'ask', () => askSelection());
  m.classList.remove('hidden');
  const r = info.box;
  const mw = 250, mh = 40;
  let left = r.left + r.width / 2 - mw / 2;
  let top = r.top - mh - 8;
  if (top < 8) top = r.bottom + 8;
  left = clamp(left, 8, window.innerWidth - mw - 8);
  top = clamp(top, 8, window.innerHeight - mh - 8);
  m.style.left = left + 'px';
  m.style.top = top + 'px';
}

/* ---------- 高亮 / 笔记 ---------- */
function openHlPop() {
  const info = R.sel;
  if (!info) return;
  const pop = document.getElementById('popover');
  pop.innerHTML = '';
  pop.append(el('div', { class: 'pop-quote', text: info.text }));
  const colors = el('div', { class: 'pop-colors' });
  let pick = 'yellow';
  COLORS.forEach((c) => {
    const b = el('button', { class: '' });
    b.style.background = HL_HEX[c];
    b.title = T('hl_' + c);
    if (c === pick) b.classList.add('on');
    b.onclick = () => {
      pick = c;
      colors.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    };
    colors.append(b);
  });
  const del = el('button', { class: 'btn ghost sm', text: T('cancel') });
  const ok = el('button', { class: 'btn primary sm', text: T('save') });
  const row = el('div', { class: 'pop-row' });
  row.append(colors, del, ok);
  pop.append(row);
  ok.onclick = () => {
    addAnno(info, pick, '');
    hidePop();
    hint(T('hl_saved'));
  };
  del.onclick = hidePop;
  placePop(pop, info.box);
  hideSelMenu();
}

function openNotePop() {
  const info = R.sel;
  if (!info) return;
  const pop = document.getElementById('popover');
  pop.innerHTML = '';
  pop.append(el('div', { class: 'pop-quote', text: info.text }));
  const ta = el('textarea', { placeholder: T('note_ph') });
  pop.append(ta);
  const colors = el('div', { class: 'pop-colors' });
  let pick = 'yellow';
  COLORS.forEach((c) => {
    const b = el('button');
    b.style.background = HL_HEX[c];
    b.title = T('hl_' + c);
    if (c === pick) b.classList.add('on');
    b.onclick = () => {
      pick = c;
      colors.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    };
    colors.append(b);
  });
  const del = el('button', { class: 'btn ghost sm', text: T('cancel') });
  const ok = el('button', { class: 'btn primary sm', text: T('save') });
  const row = el('div', { class: 'pop-row' });
  row.append(colors, del, ok);
  pop.append(row);
  ok.onclick = () => {
    const note = ta.value.trim();
    addAnno(info, note ? pick : '', note);
    hidePop();
    hint(T('note_saved'));
  };
  del.onclick = hidePop;
  placePop(pop, info.box);
  hideSelMenu();
  setTimeout(() => ta.focus(), 60);
}

function placePop(pop, box) {
  pop.classList.remove('hidden');
  const w = Math.min(340, pop.offsetWidth || 300);
  const h = pop.offsetHeight || 180;
  let left = box.left + box.width / 2 - w / 2;
  let top = box.bottom + 10;
  if (top + h > window.innerHeight - 8) top = Math.max(8, box.top - h - 10);
  left = clamp(left, 8, window.innerWidth - w - 8);
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
}

function hidePop() {
  const p = document.getElementById('popover');
  if (p) p.classList.add('hidden');
}

const HL_HEX = { yellow: '#ffd54a', green: '#9ede7a', blue: '#8ec9ff', pink: '#ffb0d0', purple: '#c9b4ff' };

function addAnno(info, color, note) {
  const doc = R.doc;
  if (!doc) return;
  const a = {
    id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    page: info.page,
    color: color || 'note',
    rects: info.rects,
    text: info.text,
    note: note || '',
    ts: Date.now()
  };
  doc.state.annos.push(a);
  saveState();
  const p = doc.pages[a.page - 1];
  if (p) paintAnnos(p);
  paintBadges();
  if (doc.tab === 'notes') setTab('notes');
}

function paintAnnos(p) {
  const doc = R.doc;
  if (!doc || !p || !p.hlLayer) return;
  p.hlLayer.innerHTML = '';
  const s = doc.scale;
  for (const a of doc.state.annos) {
    if (a.page !== p.n) continue;
    for (const r of a.rects) {
      const d = el('div', { class: 'hl' + (a.color && a.color !== 'note' ? ' c-' + a.color : '') });
      d.style.left = (r.x * s) + 'px';
      d.style.top = (r.y * s) + 'px';
      d.style.width = (r.w * s) + 'px';
      d.style.height = (r.h * s) + 'px';
      d.onclick = (e) => { e.stopPropagation(); openAnnoPop(a, d); };
      p.hlLayer.append(d);
    }
  }
}

function paintBadges() {
  const doc = R.doc;
  if (!doc) return;
  doc.pages.forEach((p) => {
    if (!p.badge) return;
    p.badge.innerHTML = '';
    doc.state.annos.filter((a) => a.page === p.n).slice(0, 6).forEach((a) => {
      const i = el('i');
      i.style.background = HL_HEX[a.color] || 'var(--accent)';
      i.title = a.note || a.text.slice(0, 40);
      p.badge.append(i);
    });
  });
}

function openAnnoPop(a, node) {
  const pop = document.getElementById('popover');
  pop.innerHTML = '';
  pop.append(el('div', { class: 'pop-quote', text: a.note || a.text }));
  const ta = el('textarea', { placeholder: T('note_ph'), value: a.note || '' });
  pop.append(ta);
  const colors = el('div', { class: 'pop-colors' });
  COLORS.forEach((c) => {
    const b = el('button', { class: a.color === c ? 'on' : '' });
    b.style.background = HL_HEX[c];
    b.title = T('hl_' + c);
    b.onclick = () => {
      a.color = c;
      colors.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      saveState();
      paintAnnos(R.doc.pages[a.page - 1]);
      paintBadges();
    };
    colors.append(b);
  });
  const del = el('button', { class: 'btn ghost sm', text: T('delete') });
  const ok = el('button', { class: 'btn primary sm', text: T('save') });
  const close = el('button', { class: 'btn ghost sm', text: T('close') });
  const row = el('div', { class: 'pop-row' });
  row.append(colors, del, close, ok);
  pop.append(row);
  del.onclick = () => {
    R.doc.state.annos = R.doc.state.annos.filter((x) => x.id !== a.id);
    saveState();
    paintAnnos(R.doc.pages[a.page - 1]);
    paintBadges();
    if (R.doc.tab === 'notes') setTab('notes');
    hidePop();
  };
  close.onclick = hidePop;
  ok.onclick = () => {
    a.note = ta.value.trim();
    saveState();
    paintBadges();
    if (R.doc.tab === 'notes') setTab('notes');
    hidePop();
    hint(T('note_saved'));
  };
  const box = node.getBoundingClientRect();
  placePop(pop, box);
}

function askSelection() {
  const info = R.sel;
  hideSelMenu();
  if (!info) return;
  const doc = R.doc;
  doc.state.pendingAsk = { text: info.text, page: info.page };
  saveState();
  setTab('chat');
}

/* ---------- 右栏面板骨架 ---------- */
const TAB_DEFS = [
  ['quick', 'tab_quick'], ['translate', 'tab_translate'], ['figures', 'tab_figures'],
  ['structure', 'tab_structure'], ['synth', 'tab_synth'], ['notes', 'tab_notes'], ['chat', 'tab_chat']
];

function buildRightTabs() {
  const sh = R.sh;
  sh.rtabs.innerHTML = '';
  for (const def of TAB_DEFS) {
    const b = el('button', { class: 'rtab', text: T(def[1]) });
    b.dataset.tab = def[0];
    b.onclick = () => setTab(def[0]);
    sh.rtabs.append(b);
  }
}

function setTab(k) {
  const doc = R.doc;
  if (!doc) return;
  doc.tab = k;
  doc.state.lastTab = k;
  for (const b of R.sh.rtabs.children) b.classList.toggle('active', b.dataset.tab === k);
  const panel = R.sh.rpanel;
  panel.innerHTML = '';
  const fn = LB.panes[k];
  if (typeof fn === 'function') {
    try { fn(panel, doc); } catch (e) { panel.append(el('div', { class: 'empty-hint', text: T('failed', { e: String(e && e.message || e) }) })); }
  } else {
    panel.append(el('div', { class: 'empty-hint', text: '…' }));
  }
  saveState();
}
