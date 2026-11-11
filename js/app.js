/* ============ LitBench app: router, library, upload, settings, global search ============ */
const LB = window.LB;
const { el, $, $$, esc, bytes, ago, debounce, toast } = { el: LB.util.el, $: LB.util.$, $$: LB.util.$$, esc: LB.util.esc, bytes: LB.util.bytes, ago: LB.util.ago, debounce: LB.util.debounce, toast: LB.toast };

LB.filters = { q: '', collection: '', tag: '', status: '', role: '', sort: 'recent' };

/* ---------------- router ---------------- */
function parseHash() {
  const raw = location.hash.replace(/^#\/*/, '');
  const qi = raw.indexOf('?');
  const pathPart = qi >= 0 ? raw.slice(0, qi) : raw;
  const params = new URLSearchParams(qi >= 0 ? raw.slice(qi + 1) : '');
  const [head, ...rest] = pathPart.split('/');
  return {
    view: head || 'library',
    id: rest[0] || '',
    p: parseInt(params.get('p') || '0', 10) || 0,
    q: params.get('q') || ''
  };
}
LB.go = (hash) => {
  if (location.hash === hash) { onHash(); return; }
  location.hash = hash;
};
function onHash() {
  const { view, id } = parseHash();
  if (view === 'p' && id) {
    LB.openReader(id);
  } else {
    if (LB.closeReader) LB.closeReader(true);
    renderLibrary();
  }
}
window.addEventListener('hashchange', onHash);

/* ---------------- rail ---------------- */
function renderRail() {
  const rail = document.getElementById('rail');
  if (!rail) return;
  rail.innerHTML = '';
  const cur = parseHash();
  const sec1 = el('div', { class: 'rail-sec' });
  sec1.appendChild(el('div', { class: 'rail-title', text: LB.t('library') }));
  const all = el('button', { class: 'rail-item' + (cur.view === 'library' && !LB.filters.collection ? ' active' : '') },
    '<span class="ri-ico">▤</span><span class="ri-txt">' + esc(LB.t('all_papers')) + '</span><span class="ri-n">' + LB.store.papers.length + '</span>');
  all.addEventListener('click', () => { LB.filters.collection = ''; LB.filters.tag = ''; LB.go('#/'); renderLibrary(); });
  sec1.appendChild(all);
  rail.appendChild(sec1);

  const counts = {};
  LB.store.papers.forEach((p) => { if (p.collection) counts[p.collection] = (counts[p.collection] || 0) + 1; });
  const sec2 = el('div', { class: 'rail-sec' });
  sec2.appendChild(el('div', { class: 'rail-title', text: LB.t('collections') }));
  const cols = LB.store.collections.slice();
  LB.store.papers.forEach((p) => { if (p.collection && !cols.includes(p.collection)) cols.push(p.collection); });
  cols.forEach((c) => {
    const b = el('button', { class: 'rail-item' + (LB.filters.collection === c ? ' active' : '') },
      '<span class="ri-ico">▸</span><span class="ri-txt">' + esc(c) + '</span><span class="ri-n">' + (counts[c] || 0) + '</span>');
    b.addEventListener('click', () => { LB.filters.collection = c; LB.go('#/'); renderLibrary(); });
    sec2.appendChild(b);
  });
  const addCol = el('button', { class: 'rail-item small' }, '<span class="ri-ico">＋</span><span class="ri-txt">' + esc(LB.t('new_collection')) + '</span>');
  addCol.addEventListener('click', newCollection);
  sec2.appendChild(addCol);
  rail.appendChild(sec2);

  const tags = {};
  LB.store.papers.forEach((p) => (p.tags || []).forEach((t) => { tags[t] = (tags[t] || 0) + 1; }));
  const tagList = Object.keys(tags).sort((a, b) => tags[b] - tags[a]).slice(0, 12);
  if (tagList.length) {
    const sec3 = el('div', { class: 'rail-sec' });
    sec3.appendChild(el('div', { class: 'rail-title', text: LB.t('tags') }));
    const wrap = el('div', { class: 'rail-tags' });
    tagList.forEach((t) => {
      const c = el('button', { class: 'tag' + (LB.filters.tag === t ? ' on' : ''), text: '#' + t });
      c.addEventListener('click', () => { LB.filters.tag = LB.filters.tag === t ? '' : t; LB.go('#/'); renderLibrary(); });
      wrap.appendChild(c);
    });
    sec3.appendChild(wrap);
    rail.appendChild(sec3);
  }

  const foot = el('div', { class: 'rail-foot' });
  const up = el('button', { class: 'btn soft block sm' }, '＋ ' + esc(LB.t('upload')));
  up.addEventListener('click', () => pickFiles());
  const imp = el('button', { class: 'btn ghost block sm' }, '⇣ ' + esc(LB.t('import_url')));
  imp.addEventListener('click', importDialog);
  foot.appendChild(up); foot.appendChild(imp);
  rail.appendChild(foot);

  // 折叠 / 拖拽调宽（布局层在 js/layout.js，按 key 记忆宽度）
  if (LB.mountPanel) {
    LB.mountPanel(rail, { key: 'rail', defaultWidth: 236 });
    if (LB.syncPanelButton) LB.syncPanelButton();
  }
}

/* ---------------- library ---------------- */
function sortPapers(list) {
  const s = LB.filters.sort;
  const cp = list.slice();
  cp.sort((a, b) => {
    if (s === 'title') return (a.title || '').localeCompare(b.title || '');
    if (s === 'year') return (b.year || 0) - (a.year || 0);
    if (s === 'progress') return ((b.progress && b.progress.page) || 0) - ((a.progress && a.progress.page) || 0);
    return new Date(b.addedAt || 0) - new Date(a.addedAt || 0);
  });
  return cp;
}

function visiblePapers() {
  let list = LB.store.papers;
  const f = LB.filters;
  if (f.collection) list = list.filter((p) => p.collection === f.collection);
  if (f.tag) list = list.filter((p) => (p.tags || []).includes(f.tag));
  if (f.status) list = list.filter((p) => (p.status || 'unread') === f.status);
  if (f.role) list = list.filter((p) => (p.role || 'main') === f.role);
  if (f.q) {
    const q = f.q.toLowerCase();
    list = list.filter((p) => [p.title, p.authors, (p.tags || []).join(' '), p.venue, p.fileName].join(' ').toLowerCase().includes(q));
  }
  return sortPapers(list);
}

function card(p) {
  const role = p.role || 'main';
  const st = p.status || 'unread';
  const c = el('div', { class: 'card', 'data-id': p.id });
  const thumb = el('div', { class: 'card-thumb' });
  if (p.hasThumb) {
    const img = el('img', { src: (LB.base || '') + '/api/thumb/' + p.id + '?v=' + (p.updatedAt || '1'), alt: '' });
    thumb.appendChild(img);
  } else {
    thumb.appendChild(el('div', { class: 'thumb-ph' }, '<span>' + esc((p.title || 'PDF').slice(0, 2)) + '</span>'));
  }
  const prog = el('div', { class: 'progress-mini' }, '<i style="width:' + Math.round((((p.progress && p.progress.page) || 0) / Math.max(1, p.pages || 1)) * 100) + '%"></i>');
  thumb.appendChild(prog);
  c.appendChild(thumb);

  const body = el('div', { class: 'card-body' });
  const title = el('div', { class: 'card-title', title: p.title || p.fileName || '' });
  title.innerHTML = esc(p.title || p.fileName || 'Untitled');
  body.appendChild(title);
  const metaBits = [];
  if (p.authors) metaBits.push(String(p.authors).split(',')[0] + (String(p.authors).includes(',') ? ' et al.' : ''));
  if (p.year) metaBits.push(p.year);
  if (p.venue) metaBits.push(p.venue);
  if (!metaBits.length) metaBits.push(bytes(p.size));
  body.appendChild(el('div', { class: 'card-meta', text: metaBits.join(' · ') }));
  const tags = el('div', { class: 'card-tags' });
  tags.appendChild(el('span', { class: 'badge ' + role, text: LB.t('role_' + role) }));
  tags.appendChild(el('span', { class: 'badge ' + st, text: LB.t(st) }));
  (p.tags || []).slice(0, 2).forEach((t) => tags.appendChild(el('span', { class: 'tag', text: '#' + t })));
  body.appendChild(tags);
  c.appendChild(body);

  const menu = el('button', { class: 'card-menu', title: '⋯' }, '⋯');
  menu.addEventListener('click', (e) => { e.stopPropagation(); paperMenu(p, menu); });
  c.appendChild(menu);

  c.addEventListener('click', () => LB.go('#/p/' + p.id));
  return c;
}

function paperMenu(p, anchor) {
  const r = anchor.getBoundingClientRect();
  const pop = document.getElementById('popover');
  pop.innerHTML = '';
  pop.classList.remove('hidden');
  const items = [
    { label: LB.t('open'), fn: () => LB.go('#/p/' + p.id) },
    { label: LB.t('edit_meta'), fn: () => editMeta(p) },
    { label: LB.t('set_role'), fn: () => attachDialog(p) },
    { label: LB.t('status') + ': ' + LB.t('unread'), fn: () => LB.store.patch(p.id, { status: 'unread' }) },
    { label: LB.t('status') + ': ' + LB.t('reading'), fn: () => LB.store.patch(p.id, { status: 'reading' }) },
    { label: LB.t('status') + ': ' + LB.t('read'), fn: () => LB.store.patch(p.id, { status: 'read' }) },
    { label: LB.t('delete'), danger: true, fn: async () => { if (await LB.confirm(LB.t('confirm_delete'))) { await LB.store.remove(p.id); renderLibrary(); } } },
  ];
  items.forEach((it) => {
    const b = el('button', { class: 'pop-item' + (it.danger ? ' danger' : '') }, esc(it.label));
    b.addEventListener('click', () => { pop.classList.add('hidden'); it.fn(); });
    pop.appendChild(b);
  });
  pop.style.left = Math.min(window.innerWidth - 220, r.right - 200) + 'px';
  pop.style.top = (r.bottom + 6) + 'px';
  const away = (e) => { if (!pop.contains(e.target)) { pop.classList.add('hidden'); document.removeEventListener('mousedown', away); } };
  setTimeout(() => document.addEventListener('mousedown', away), 0);
}

function renderLibrary() {
  renderRail();
  const view = document.getElementById('view');
  view.innerHTML = '';
  const wrap = el('div', { class: 'lib' });
  const inner = el('div', { class: 'lib-inner' });
  const head = el('div', { class: 'lib-head' });
  const titleWrap = el('div');
  const t = LB.filters.collection || LB.t('all_papers');
  titleWrap.appendChild(el('div', { class: 'lib-title', text: t }));
  const n = visiblePapers().length;
  titleWrap.appendChild(el('div', { class: 'lib-sub', text: n + ' ' + LB.t('papers') }));
  head.appendChild(titleWrap);

  const actions = el('div', { class: 'lib-actions' });
  const search = el('input', { class: 'lib-search', placeholder: LB.t('search_ph'), value: LB.filters.q });
  search.addEventListener('input', debounce((e) => { LB.filters.q = e.target.value.trim(); renderGrid(); }, 180));
  actions.appendChild(search);
  const sel = el('select', { class: 'lib-sort' });
  [['recent', 'sort_recent'], ['title', 'sort_title'], ['year', 'sort_year'], ['progress', 'sort_progress']].forEach(([v, k]) => {
    const o = el('option', { value: v, text: LB.t(k) });
    if (LB.filters.sort === v) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => { LB.filters.sort = sel.value; renderGrid(); });
  actions.appendChild(sel);
  const up = el('button', { class: 'btn primary sm' }, '＋ ' + esc(LB.t('upload')));
  up.addEventListener('click', () => pickFiles());
  actions.appendChild(up);
  head.appendChild(actions);
  inner.appendChild(head);

  const filters = el('div', { class: 'filters' });
  const mk = (label, active, fn) => { const c = el('button', { class: 'chip' + (active ? ' active' : '') }, esc(label)); c.addEventListener('click', fn); filters.appendChild(c); };
  mk(LB.t('all_papers'), !LB.filters.status && !LB.filters.role, () => { LB.filters.status = ''; LB.filters.role = ''; renderLibrary(); });
  ['unread', 'reading', 'read'].forEach((s) => mk(LB.t(s), LB.filters.status === s, () => { LB.filters.status = LB.filters.status === s ? '' : s; renderLibrary(); }));
  ['main', 'si', 'review', 'other'].forEach((r) => mk(LB.t('role_' + r), LB.filters.role === r, () => { LB.filters.role = LB.filters.role === r ? '' : r; renderLibrary(); }));
  if (LB.filters.tag) mk('#' + LB.filters.tag + ' ✕', true, () => { LB.filters.tag = ''; renderLibrary(); });
  inner.appendChild(filters);

  const gridWrap = el('div', { class: 'lib-grid-wrap' });
  inner.appendChild(gridWrap);
  wrap.appendChild(inner);
  view.appendChild(wrap);

  // 同一篇文献：正文 + 支撑材料/审稿文件 收进同一张卡下面（按 parentId 归组）
  function rootOf(p, byId) {
    let cur = p; let hops = 0;
    while (cur.parentId) {
      const nxt = byId[cur.parentId];
      if (!nxt || nxt === cur || hops >= 8 || nxt === p) return null;
      cur = nxt; hops++;
    }
    return cur === p ? null : cur;
  }

  function subsBlock(subs) {
    const box = el('div', { class: 'paper-subs' });
    const body = el('div', { class: 'paper-subs-body' });
    const caret = el('span', { text: '▾' });
    const head = el('button', { class: 'paper-subs-head', type: 'button', title: LB.t('supporting_hint') });
    head.append(caret, el('span', { text: LB.t('supporting') }), el('span', { class: 'cnt', text: String(subs.length) }));
    subs.forEach((c) => {
      const row = el('button', { class: 'paper-sub', type: 'button', title: c.title || c.fileName || '' });
      row.append(
        el('span', { class: 'ps-title', text: c.title || c.fileName || 'Untitled' }),
        el('span', { class: 'ps-meta', text: c.pages ? c.pages + 'p' : LB.t('role_' + (c.role || 'si')) })
      );
      row.addEventListener('click', () => LB.go('#/p/' + c.id));
      body.appendChild(row);
    });
    head.addEventListener('click', (e) => {
      e.stopPropagation();
      const hide = body.classList.toggle('hide');
      caret.textContent = hide ? '▸' : '▾';
    });
    box.append(head, body);
    return box;
  }

  function renderGrouped(grid, list) {
    const byId = Object.create(null);
    list.forEach((p) => { byId[p.id] = p; });
    const kids = Object.create(null);
    const roots = [];
    list.forEach((p) => {
      const root = rootOf(p, byId);
      if (root && root !== p) (kids[root.id] = kids[root.id] || []).push(p);
      else roots.push(p);
    });
    roots.forEach((p) => {
      const item = el('div', { class: 'lib-item', 'data-id': p.id });
      item.appendChild(card(p));
      if (kids[p.id] && kids[p.id].length) item.appendChild(subsBlock(kids[p.id]));
      grid.appendChild(item);
    });
  }

  function renderGrid() {
    gridWrap.innerHTML = '';
    const list = visiblePapers();
    const sub = inner.querySelector('.lib-sub');
    if (sub) sub.textContent = list.length + ' ' + LB.t('papers');
    if (!list.length) {
      const e = el('div', { class: 'empty' });
      e.innerHTML = '<b>' + esc(LB.t('empty_lib')) + '</b><p>' + esc(LB.t('empty_lib_sub')) + '</p>';
      const b = el('button', { class: 'btn primary' }, '＋ ' + esc(LB.t('upload')));
      b.addEventListener('click', () => pickFiles());
      e.appendChild(b);
      gridWrap.appendChild(e);
      return;
    }
    const grid = el('div', { class: 'lib-grid' });
    renderGrouped(grid, list);
    gridWrap.appendChild(grid);
    const hint = el('div', { class: 'upload-hint', text: '⤓ ' + LB.t('drop_sub') });
    gridWrap.appendChild(hint);
  }
  renderGrid();
  if (LB.closeReader) LB.closeReader(true);
}

/* ---------------- upload / import ---------------- */
let uploading = 0;
function pickFiles() {
  const inp = document.getElementById('filePicker');
  inp.value = '';
  inp.click();
}
async function uploadFiles(files) {
  const pdfs = Array.from(files || []).filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
  if (!pdfs.length) { toast(LB.lang === 'en' ? 'Only PDF files are supported' : '只支持 PDF 文件', 'error'); return; }
  for (const f of pdfs) {
    const pid = 'up-' + LB.util.uid();
    const t = el('div', { class: 'toast', id: pid }, esc(f.name) + ' …');
    document.getElementById('toast').appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    try {
      const j = await LB.api.upload(f);
      await LB.store.refresh();
      renderLibrary();
      t.className = 'toast ok in';
      t.textContent = (LB.lang === 'en' ? 'Added: ' : '已加入：') + (j.paper.title || j.paper.fileName);
      setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 2600);
    } catch (e) {
      t.className = 'toast error in';
      t.textContent = f.name + ': ' + e.message;
      setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 6000);
    }
  }
}

function importDialog() {
  const form = el('div', { class: 'field' });
  const inp = el('input', { class: 'input', placeholder: LB.t('import_ph') });
  form.appendChild(el('label', { class: 'label', text: 'URL' }));
  form.appendChild(inp);
  const m = LB.modal({
    title: LB.t('import_title'),
    body: form,
    actions: [
      { label: LB.t('cancel'), kind: 'ghost' },
      {
        label: LB.t('import_go'), kind: 'primary',
        onClick: async () => {
          const url = inp.value.trim();
          if (!url) return false;
          try {
            const j = await LB.api.post('/api/import', { url });
            await LB.store.refresh();
            renderLibrary();
            toast((LB.lang === 'en' ? 'Added: ' : '已加入：') + (j.paper.title || j.paper.fileName), 'ok');
          } catch (e) { toast(LB.t('failed', { e: e.message }), 'error'); return false; }
        },
      },
    ],
  });
  setTimeout(() => inp.focus(), 60);
}

function newCollection() {
  const inp = el('input', { class: 'input', placeholder: LB.t('new_collection') });
  LB.modal({
    title: LB.t('new_collection'), body: inp,
    actions: [{ label: LB.t('cancel'), kind: 'ghost' }, {
      label: LB.t('save'), kind: 'primary', onClick: async () => {
        const name = inp.value.trim();
        if (!name) return false;
        const list = LB.store.collections.slice();
        if (!list.includes(name)) list.push(name);
        await LB.store.saveCollections(list);
        renderLibrary();
      },
    }],
  });
  setTimeout(() => inp.focus(), 60);
}

/* ---------------- metadata / relations ---------------- */
function editMeta(p) {
  const box = el('div');
  const mk = (label, key, val, ph) => {
    const f = el('div', { class: 'field' });
    f.appendChild(el('label', { class: 'label', text: label }));
    const i = el('input', { class: 'input', value: val || '', placeholder: ph || '' });
    f.appendChild(i); box.appendChild(f); return i;
  };
  const ti = mk(LB.t('title'), 'title', p.title);
  const au = mk(LB.t('authors'), 'authors', p.authors);
  const ye = mk(LB.t('year'), 'year', p.year, '2024');
  const ve = mk(LB.t('venue'), 'venue', p.venue);
  const doi = mk(LB.t('doi'), 'doi', p.doi);
  const tg = mk(LB.t('tags'), 'tags', (p.tags || []).join(', '), LB.t('tags_ph'));
  const colF = el('div', { class: 'field' });
  colF.appendChild(el('label', { class: 'label', text: LB.t('folder') }));
  const colSel = el('select', { class: 'input' });
  colSel.appendChild(el('option', { value: '', text: LB.t('no_folder') }));
  const cols = LB.store.collections.slice();
  if (p.collection && !cols.includes(p.collection)) cols.push(p.collection);
  cols.forEach((c) => { const o = el('option', { value: c, text: c }); if (p.collection === c) o.selected = true; colSel.appendChild(o); });
  colF.appendChild(colSel); box.appendChild(colF);

  LB.modal({
    title: LB.t('edit_meta'), body: box,
    actions: [{ label: LB.t('cancel'), kind: 'ghost' }, {
      label: LB.t('save'), kind: 'primary', onClick: async () => {
        await LB.store.patch(p.id, {
          title: ti.value.trim(), authors: au.value.trim(), year: parseInt(ye.value, 10) || 0,
          venue: ve.value.trim(), doi: doi.value.trim(),
          tags: tg.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
          collection: colSel.value,
        });
        renderLibrary();
      },
    }],
  });
}

function attachDialog(p) {
  const box = el('div');
  const f1 = el('div', { class: 'field' });
  f1.appendChild(el('label', { class: 'label', text: LB.t('role') }));
  const roleSel = el('select', { class: 'input' });
  ['main', 'si', 'review', 'other'].forEach((r) => { const o = el('option', { value: r, text: LB.t('role_' + r) }); if ((p.role || 'main') === r) o.selected = true; roleSel.appendChild(o); });
  f1.appendChild(roleSel); box.appendChild(f1);

  const f2 = el('div', { class: 'field' });
  f2.appendChild(el('label', { class: 'label', text: LB.t('attach_to') }));
  const parSel = el('select', { class: 'input' });
  parSel.appendChild(el('option', { value: '', text: '—' }));
  LB.store.papers.filter((x) => x.id !== p.id).forEach((x) => {
    const o = el('option', { value: x.id, text: x.title || x.fileName });
    if (p.parentId === x.id) o.selected = true;
    parSel.appendChild(o);
  });
  f2.appendChild(parSel); box.appendChild(f2);
  const sync = () => { parSel.disabled = roleSel.value === 'main'; };
  roleSel.addEventListener('change', sync); sync();

  LB.modal({
    title: LB.t('set_role'), body: box,
    actions: [{ label: LB.t('cancel'), kind: 'ghost' }, {
      label: LB.t('save'), kind: 'primary', onClick: async () => {
        const role = roleSel.value;
        await LB.store.patch(p.id, { role, parentId: role === 'main' ? '' : parSel.value });
        renderLibrary();
      },
    }],
  });
}

/* ---------------- settings ---------------- */
function settingsDialog() {
  const cfg = LB.store.config || {};
  const box = el('div');
  const field = (label, node) => { const f = el('div', { class: 'field' }); f.appendChild(el('label', { class: 'label', text: label })); f.appendChild(node); box.appendChild(f); };
  const base = el('input', { class: 'input', value: cfg.baseURL || '' });
  field(LB.t('base_url'), base);

  // 模型名可下拉可手填（不同网关/中转的名字不一样）
  const dl = el('datalist', { id: 'lb-model-list' });
  (cfg.models || []).forEach((m) => dl.appendChild(el('option', { value: m.id })));
  box.appendChild(dl);
  const tSel = el('input', { class: 'input', list: 'lb-model-list', value: cfg.textModel || '', placeholder: 'gpt-4o-mini' });
  const vSel = el('input', { class: 'input', list: 'lb-model-list', value: cfg.visionModel || '', placeholder: LB.t('vision_optional') });
  field(LB.t('text_model'), tSel);
  field(LB.t('vision_model'), vSel);

  const key = el('input', { class: 'input', type: 'password', placeholder: cfg.hasKey ? LB.t('key_saved', { hint: cfg.keyHint || '' }) : LB.t('key_missing') });
  field(LB.t('api_key'), key);

  const testOut = el('div', { class: 'kv', text: '' });

  /* ---- 存储位置 ---- */
  const st = cfg.storage || {};
  const stTitle = el('div', { class: 'label', style: 'margin-top:16px;font-weight:600', text: LB.t('storage_sec') });
  const stNow = el('div', { class: 'kv', text: LB.t('storage_now') + '：' + (st.dir || '—') });
  const stHint = el('div', { class: 'kv', text: LB.t('storage_hint') });
  const dirIn = el('input', { class: 'input', value: st.dir || '', placeholder: st.defaultDir || 'D:\\LitBench' });
  const mig = el('input', { type: 'checkbox' });
  mig.checked = true;
  const migRow = el('label', { class: 'kv', style: 'display:flex;align-items:center;gap:6px;margin:8px 0;cursor:pointer' });
  migRow.appendChild(mig);
  migRow.appendChild(el('span', { text: LB.t('storage_migrate') }));
  const applyBtn = el('button', { class: 'btn', type: 'button', text: LB.t('storage_apply') });
  const stOut = el('div', { class: 'kv', text: '' });
  applyBtn.addEventListener('click', async () => {
    const dir = dirIn.value.trim();
    if (!dir) return;
    if (!/^[A-Za-z]:[\\/]|^\//.test(dir)) { stOut.textContent = LB.t('storage_need_abs'); stOut.className = 'kv err'; return; }
    applyBtn.disabled = true;
    stOut.textContent = '…';
    try {
      const r = await LB.api.post('/api/storage', { dir, migrate: !!mig.checked });
      stOut.textContent = '✓ ' + LB.t('storage_moved') + ' ' + r.dir;
      stOut.className = 'kv ok';
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      stOut.textContent = '✗ ' + e.message;
      stOut.className = 'kv err';
      applyBtn.disabled = false;
    }
  });
  box.appendChild(stTitle);
  box.appendChild(stNow);
  box.appendChild(stHint);
  field(LB.t('storage_dir'), dirIn);
  box.appendChild(migRow);
  box.appendChild(applyBtn);
  box.appendChild(stOut);

  LB.modal({
    title: LB.t('settings'), wide: true, body: box,
    actions: [
      {
        label: LB.t('test'), kind: 'ghost', keep: true, onClick: async () => {
          testOut.textContent = LB.t('testing');
          try {
            await LB.api.put('/api/config', { baseURL: base.value.trim(), textModel: tSel.value, visionModel: vSel.value, apiKey: key.value.trim() || undefined });
            await LB.store.refresh();
            const r = await LB.chatOnce({ messages: [{ role: 'user', content: 'ping' }], max_tokens: 512 });
            testOut.textContent = '✓ ' + LB.t('test_ok') + ' · ' + ((r.content || '').slice(0, 40) || 'ok');
            testOut.className = 'kv ok';
          } catch (e) { testOut.textContent = '✗ ' + e.message; testOut.className = 'kv err'; }
          return false;
        },
      },
      { label: LB.t('save_settings'), kind: 'primary', onClick: async () => { await LB.api.put('/api/config', { baseURL: base.value.trim(), textModel: tSel.value, visionModel: vSel.value, apiKey: key.value.trim() || undefined }); await LB.store.refresh(); toast(LB.t('save'), 'ok'); } },
    ],
  });
}

function helpDialog() {
  const body = el('div', { class: 'help' });
  const L = LB.lang === 'en';
  body.innerHTML = L
    ? '<ol>' +
      '<li><b>Add papers.</b> Drop PDFs anywhere, or use Upload / Import link. The original layout, fonts and figures are kept — pages are rendered by pdf.js onto canvas.</li>' +
      '<li><b>Browse by structure.</b> Every paper is parsed into sections (Abstract, Intro, Methods, Results…); the left rail groups your whole library by collections, tags, reading status and role (main / SI / review).</li>' +
      '<li><b>Select text.</b> A floating menu gives you <i>Highlight</i>, <i>Note</i> and <i>Ask</i>. The question is pre-filled and its language follows the interface language.</li>' +
      '<li><b>Right panel.</b> Brief (one-page digest), Translate (paragraph-by-paragraph bilingual), Figures (extracted + interpreted), Structure (argument tree of claims / premises / evidence / inference / counterpoints), Synthesis (compare main text with SI and reviews), Notes, Chat.</li>' +
      '<li><b>Attach related files.</b> Card menu → Attach role: mark a PDF as SI or Review and point it at the main paper; Chat and Synthesis then reason over all of them.</li>' +
      '</ol>'
    : '<ol>' +
      '<li><b>加入文献。</b>直接把 PDF 拖进窗口，或用「上传 PDF」/「链接导入」。原始排版、字体与图片完整保留 —— 页面由 pdf.js 渲染到 canvas，不做重排。</li>' +
      '<li><b>按结构浏览。</b>每篇文献会自动解析章节（摘要、引言、方法、结果…）；左侧栏可按分区、标签、阅读状态、角色（正文 / 支撑材料 / 审稿）整理整个库。</li>' +
      '<li><b>选中文字。</b>会浮出菜单：「高亮」「笔记」「在会话中提问」。提问内容已预填，且语言跟随界面语言。</li>' +
      '<li><b>右侧面板。</b>速读（一页纸摘要）、翻译（逐段中英对照）、图表（自动提取并解读）、结构（论点/前提/证据/推理/反例的论证树）、综合（本文与 SI、审稿意见比对）、笔记、对话。</li>' +
      '<li><b>关联文件。</b>卡片菜单 → 关联角色：把支撑材料或审稿意见标成 SI/Review 并指到正文；之后对话与综合会一起使用这些文档。</li>' +
      '</ol>';
  LB.modal({ title: LB.t('help_title'), wide: true, body, actions: [{ label: LB.t('close'), kind: 'primary' }] });
}

/* ---------------- topbar actions ---------------- */
function initTopbar() {
  document.getElementById('btnSettings').addEventListener('click', settingsDialog);
  document.getElementById('btnHelp').addEventListener('click', helpDialog);
  document.getElementById('btnTheme').addEventListener('click', () => LB.toggleTheme());
  document.getElementById('btnLang').addEventListener('click', () => {
    LB.setLang(LB.lang === 'en' ? 'zh' : 'en');
    renderLibrary();
    if (LB.onLangChange) LB.onLangChange();
  });
  const brand = document.querySelector('.brand');
  if (brand) brand.addEventListener('click', () => LB.go('#/'));

  const inp = document.getElementById('globalSearch');
  const pop = document.getElementById('searchPop');
  const run = debounce(async () => {
    const q = inp.value.trim();
    if (q.length < 2) { pop.classList.add('hidden'); pop.innerHTML = ''; return; }
    pop.classList.remove('hidden');
    pop.innerHTML = '<div class="search-tip">…</div>';
    try {
      const j = await LB.api.get('/api/search?q=' + encodeURIComponent(q));
      pop.innerHTML = '';
      if (!j.hits || !j.hits.length) { pop.innerHTML = '<div class="search-tip">' + esc(LB.t('search_empty')) + '</div>'; return; }
      j.hits.forEach((h) => {
        const it = el('button', { class: 'search-item' });
        it.innerHTML = '<div class="si-title">' + esc(h.title || h.id) + '</div><div class="si-snippet">' + esc(h.snippet || '') + '</div><div class="si-page">' + esc(LB.t('page')) + ' ' + h.page + '</div>';
        it.addEventListener('click', () => {
          pop.classList.add('hidden');
          LB.go('#/p/' + h.id + '?p=' + h.page + '&q=' + encodeURIComponent(q));
        });
        pop.appendChild(it);
      });
    } catch (e) { pop.innerHTML = '<div class="search-tip">' + esc(e.message) + '</div>'; }
  }, 240);
  inp.addEventListener('input', run);
  inp.addEventListener('focus', () => { if (inp.value.trim().length >= 2) run(); });
  document.addEventListener('mousedown', (e) => {
    if (!pop.contains(e.target) && e.target !== inp) pop.classList.add('hidden');
  });

  const fp = document.getElementById('filePicker');
  fp.addEventListener('change', () => uploadFiles(fp.files));

  /* drag & drop */
  const ov = document.getElementById('dropOverlay');
  let depth = 0;
  window.addEventListener('dragenter', (e) => { if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return; depth++; ov.classList.remove('hidden'); });
  window.addEventListener('dragover', (e) => { e.preventDefault(); });
  window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) ov.classList.add('hidden'); });
  window.addEventListener('drop', (e) => {
    e.preventDefault(); depth = 0; ov.classList.add('hidden');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  });
}

/* ---------------- boot ---------------- */
initTopbar();
LB.ready.then(() => {
  document.getElementById('loading').classList.add('gone');
  const { view, id } = parseHash();
  if (view === 'p' && id) LB.openReader(id); else renderLibrary();
});
LB.bus.on('library', () => { if (parseHash().view === 'library') renderLibrary(); });
LB.bus.on('lang', () => { if (parseHash().view === 'library') renderLibrary(); });
