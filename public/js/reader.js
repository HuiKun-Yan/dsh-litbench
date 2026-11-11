/* LitBench · reader.js — PDF 阅读内核
   高保真 canvas 渲染 + 自建文本层 + 选区三选项菜单 + 高亮/笔记 + 目录/缩略图
   + 缩放翻页页内查找 + 段落/分区/图表抽取 + 右栏面板骨架 */
const LB = window.LB;
const U = LB.util;
const el = U.el, esc = U.esc, deb = U.debounce, clamp = U.clamp;
const pdfjs = window.pdfjsLib;

const COLORS = ['yellow', 'green', 'blue', 'pink', 'purple'];
const R = { doc: null, sh: null, io: null, ac: null, sel: null, saveT: null, msgT: null };

const T = (k, v) => LB.t(k, v);

/* ---------- 状态归一 ---------- */
function normState(s) {
  s = s && typeof s === 'object' ? s : {};
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    annos: arr(s.annos),
    paragraphs: arr(s.paragraphs),
    sections: arr(s.sections),
    figures: arr(s.figures),
    quick: s.quick || null,
    structure: s.structure || null,
    translates: s.translates || {},
    synth: s.synth || null,
    chat: arr(s.chat),
    chatModel: s.chatModel || '',
    figNote: s.figNote || {},
    extracted: arr(s.extracted),
    lastPage: s.lastPage || 1,
    zoom: s.zoom || null,
    fit: s.fit || 'width',
    showFigBoxes: !!s.showFigBoxes,
    pendingAsk: s.pendingAsk || null,
    models: s.models && typeof s.models === 'object' ? s.models : {},
    transMode: s.transMode || 'pair',
    lastTab: s.lastTab || 'quick'
  };
}

function saveState() {
  const doc = R.doc;
  if (!doc) return;
  clearTimeout(R.saveT);
  R.saveT = setTimeout(() => { flushState(doc); }, 900);
}

async function flushState(doc) {
  doc = doc || R.doc;
  if (!doc) return;
  clearTimeout(R.saveT);
  R.saveT = null;
  try { await LB.api.put('/api/papers/' + doc.id + '/state', doc.state); } catch (e) { }
}

function hint(msg, ms) {
  const sh = R.sh;
  if (!sh) return;
  let n = sh.scroll.querySelector('.reader-toast-hint');
  if (!n) { n = el('div', { class: 'reader-toast-hint' }); sh.scroll.append(n); }
  n.textContent = msg;
  n.style.opacity = '1';
  clearTimeout(R.msgT);
  R.msgT = setTimeout(() => { n.style.opacity = '0'; }, ms || 1600);
}

/* ---------- 骨架 ---------- */
function buildShell(paper) {
  const view = document.getElementById('view');
  view.innerHTML = '';
  const root = el('div', { class: 'reader' });

  const head = el('div', { class: 'reader-head' });
  const back = el('button', { class: 'back-btn', title: T('back'), html: '&#8592;' });
  back.onclick = () => LB.go('#/');
  const hmain = el('div', { class: 'rh-main' });
  const title = el('div', { class: 'rh-title', text: paper.title || paper.fileName || 'PDF' });
  title.title = title.textContent;
  const meta = el('div', { class: 'rh-meta' });
  const hacts = el('div', { class: 'rh-actions' });
  hmain.append(title, meta);
  head.append(back, hmain, hacts);

  const body = el('div', { class: 'reader-body' });
  const side = el('div', { class: 'side' });
  const stab = el('div', { class: 'side-tabs' });
  const sbody = el('div', { class: 'side-body' });
  side.append(stab, sbody);

  const center = el('div', { class: 'center' });
  const toolbar = el('div', { class: 'toolbar' });
  const scroll = el('div', { class: 'doc-scroll' });
  const pages = el('div', { class: 'pages' });
  scroll.append(pages);
  const zoomBadge = el('div', { class: 'zoom-badge' });
  center.append(toolbar, scroll, zoomBadge);

  const rside = el('div', { class: 'rside' });
  const rtabs = el('div', { class: 'rtabs' });
  const rpanel = el('div', { class: 'rpanel' });
  rside.append(rtabs, rpanel);

  body.append(side, center, rside);
  root.append(head, body);
  view.append(root);

  // 目录侧栏：折叠 / 拖拽调宽，和文献库 rail 共用同一套布局逻辑
  if (LB.mountPanel) {
    LB.mountPanel(side, { key: 'side', defaultWidth: 236, fold: true });
    // 右侧速览/对话栏：贴右边缘收起，左缘拖拽调宽
    R.rctl = LB.mountPanel(rside, { key: 'rside', defaultWidth: 392, min: 280, max: 760, edge: 'right' });
    if (LB.syncPanelButton) LB.syncPanelButton();
  }
  return { root, head, back, title, meta, hacts, side, stab, sbody, center, toolbar, scroll, pages, zoomBadge, rside, rtabs, rpanel };
}

/* ---------- 打开 ---------- */
LB.openReader = async function (id) {
  if (R.doc && R.doc.id === id) return;
  if (R.doc) LB.closeReader(false);
  const paper = LB.store.paper(id);
  if (!paper) { LB.go('#/'); return; }

  const doc = {
    id, paper, num: paper.pages || 0, scale: 1, pdf: null, pages: [],
    txt: {}, figCache: {}, tab: 'quick', cur: 1, state: normState(null)
  };
  R.doc = doc;
  R.sh = buildShell(paper);
  R.ac = new AbortController();

  const q = parseHash();
  doc.startPage = q.p || paper.progress && paper.progress.page || 1;

  try {
    const r = await LB.api.get('/api/papers/' + id + '/state');
    doc.state = normState(r.state);
  } catch (e) { }

  try {
    doc.pdf = await pdfjs.getDocument({
      url: (LB.base || '') + '/api/pdf/' + id,
      cMapUrl: (LB.base || '') + '/vendor/cmaps/', cMapPacked: true,
      standardFontDataUrl: (LB.base || '') + '/vendor/standard_fonts/',
      wasmUrl: (LB.base || '') + '/vendor/wasm/', iccUrl: (LB.base || '') + '/vendor/iccs/'
    }).promise;
  } catch (e) {
    R.sh.pages.innerHTML = '';
    R.sh.pages.append(el('div', { class: 'doc-error', text: T('failed', { e: String(e && e.message || e) }) }));
    return;
  }

  doc.num = doc.pdf.numPages;
  const p1 = await doc.pdf.getPage(1);
  doc.vp1 = p1.getViewport({ scale: 1 });

  renderHeadMeta();
  buildToolbar();
  buildRightTabs();

  doc.scale = doc.state.zoom || 1;
  createPages();
  R.sh.scroll.scrollTop = 0;
  doc.scale = fitScale(doc.state.fit || 'width');
  applyScale(doc.scale, false);
  updateZoomLabel();

  setupScroll();
  setupSelection();
  setCurrent(clamp(doc.startPage, 1, doc.num));
  R.sh.scroll.scrollTop = Math.max(0, (doc.pages[doc.cur - 1] || {}).wrap ? doc.pages[doc.cur - 1].wrap.offsetTop - 8 : 0);
  renderVisible();
  if (q.q) findInDoc(q.q);

  renderSide();
  setTab(doc.state.lastTab || 'quick');

  extractText().catch((e) => console.warn('[litbench] extract', e));
  maybeThumb();
};

function parseHash() {
  const h = (location.hash || '').replace(/^#/, '');
  const i = h.indexOf('?');
  const q = {};
  if (i > 0) {
    h.slice(i + 1).split('&').forEach((kv) => {
      const k = kv.split('=');
      q[decodeURIComponent(k[0])] = decodeURIComponent(k[1] || '');
    });
  }
  return q;
}

LB.closeReader = function (silent) {
  if (R.io) { R.io.disconnect(); R.io = null; }
  if (R.ac) { R.ac.abort(); R.ac = null; }
  if (R.doc && R.doc.pdf) { try { R.doc.pdf.destroy(); } catch (e) { } R.doc.pdf = null; }
  if (R.doc) flushState(R.doc);
  R.doc = null;
  R.sh = null;
  hideSelMenu();
  if (!silent) {
    const v = document.getElementById('view');
    if (v) v.innerHTML = '';
  }
};

LB.currentDoc = () => R.doc;

/* ---------- 页面 ---------- */
function createPages() {
  const doc = R.doc, pagesEl = R.sh.pages;
  pagesEl.innerHTML = '';
  doc.pages = [];
  const w = Math.round(doc.vp1.width * doc.scale);
  const h = Math.round(doc.vp1.height * doc.scale);
  for (let n = 1; n <= doc.num; n++) {
    const wrap = el('div', { class: 'page-wrap' });
    wrap.dataset.n = n;
    wrap.style.width = w + 'px';
    const page = el('div', { class: 'page', style: 'width:' + w + 'px;height:' + h + 'px' });
    const canvas = document.createElement('canvas');
    const textLayer = el('div', { class: 'textLayer' });
    const hlLayer = el('div', { class: 'hl-layer' });
    const figLayer = el('div', { class: 'fig-layer' });
    const loading = el('div', { class: 'page-loading', text: String(n) });
    const no = el('div', { class: 'page-no', text: n + ' / ' + doc.num });
    const badge = el('div', { class: 'page-anno-badge' });
    page.append(canvas, textLayer, hlLayer, figLayer, loading);
    wrap.append(page, no, badge);
    pagesEl.append(wrap);
    doc.pages.push({ n, wrap, page, canvas, textLayer, hlLayer, figLayer, loading, no, badge, drawn: false, busy: false, pageObj: null });
  }
}

async function renderPage(p) {
  const doc = R.doc;
  if (!doc || !p || p.busy || p.drawn) return;
  p.busy = true;
  try {
    const page = await doc.pdf.getPage(p.n);
    if (!R.doc || R.doc !== doc) return;
    const s = doc.scale;
    const vp = page.getViewport({ scale: s });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    p.canvas.width = Math.max(1, Math.floor(vp.width * dpr));
    p.canvas.height = Math.max(1, Math.floor(vp.height * dpr));
    p.page.style.width = Math.round(vp.width) + 'px';
    p.page.style.height = Math.round(vp.height) + 'px';
    p.wrap.style.width = Math.round(vp.width) + 'px';
    await page.render({
      canvasContext: p.canvas.getContext('2d'),
      viewport: vp,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null
    }).promise;
    p.loading.style.display = 'none';
    p.pageObj = page;
    p.drawn = true;
    await buildTextLayer(p);
    paintAnnos(p);
    paintFigBoxes(p);
  } catch (e) {
    p.loading.textContent = '!';
  } finally {
    p.busy = false;
  }
}

function renderVisible() {
  const doc = R.doc;
  if (!doc) return;
  const sc = R.sh.scroll;
  const top = sc.scrollTop, bot = top + sc.clientHeight;
  for (const p of doc.pages) {
    const t = p.wrap.offsetTop, b = t + p.wrap.offsetHeight;
    if (b > top - 1400 && t < bot + 1400) renderPage(p);
  }
}

async function getTextData(n) {
  const doc = R.doc;
  if (doc.txt[n]) return doc.txt[n];
  const page = await doc.pdf.getPage(n);
  const tc = await page.getTextContent();
  const vp1 = page.getViewport({ scale: 1 });
  const items = [];
  for (const it of tc.items) {
    if (typeof it.str !== 'string' || !it.str.trim()) continue;
    const st = tc.styles[it.fontName] || {};
    const tx = pdfjs.Util.transform(vp1.transform, it.transform);
    const h = Math.hypot(tx[2], tx[3]) || it.height || 10;
    const asc = (typeof st.ascent === 'number' && st.ascent > 0.05 && st.ascent < 1.3) ? st.ascent : 0.8;
    items.push({
      str: it.str,
      x: tx[4],
      y: tx[5] - asc * h,
      w: it.width || 0,
      h,
      font: st.fontFamily || 'sans-serif',
      eol: !!it.hasEOL
    });
  }
  doc.txt[n] = { items, w: vp1.width, h: vp1.height };
  return doc.txt[n];
}

async function buildTextLayer(p) {
  const doc = R.doc;
  if (!doc) return;
  const data = await getTextData(p.n);
  if (!R.doc || R.doc !== doc) return;
  const s = doc.scale;
  p.textLayer.innerHTML = '';
  const frag = document.createDocumentFragment();
  const list = [];
  for (const it of data.items) {
    const sp = document.createElement('span');
    sp.textContent = it.str;
    sp.style.left = (it.x * s).toFixed(2) + 'px';
    sp.style.top = (it.y * s).toFixed(2) + 'px';
    sp.style.fontSize = (it.h * s).toFixed(2) + 'px';
    sp.style.fontFamily = it.font;
    frag.append(sp);
    list.push([sp, it.w * s]);
  }
  p.textLayer.append(frag);
  for (const o of list) {
    const sp = o[0], want = o[1];
    const got = sp.getBoundingClientRect().width;
    if (got > 0.6 && want > 0.6) {
      const k = want / got;
      if (k > 0.08 && k < 10) sp.style.transform = 'scaleX(' + k.toFixed(4) + ')';
    }
  }
  if (R.hits && R.hits.length) paintHits(p);
}

/* ---------- 缩放 ---------- */
function fitScale(kind) {
  const doc = R.doc;
  const sc = R.sh.scroll;
  const aw = (sc.clientWidth || 820) - 56;
  const ah = (sc.clientHeight || 900) - 44;
  if (kind === 'page') return Math.min(aw / doc.vp1.width, ah / doc.vp1.height);
  return aw / doc.vp1.width;
}

function applyScale(s, keepAnchor) {
  const doc = R.doc;
  if (!doc) return;
  s = clamp(s, 0.25, 4);
  const anchor = keepAnchor ? { n: doc.cur, r: pageRatio(doc.cur) } : null;
  doc.scale = s;
  doc.state.zoom = Math.round(s * 1000) / 1000;
  for (const p of doc.pages) {
    const w = Math.round(doc.vp1.width * s), h = Math.round(doc.vp1.height * s);
    p.wrap.style.width = w + 'px';
    p.page.style.width = w + 'px';
    p.page.style.height = h + 'px';
    p.canvas.width = 1; p.canvas.height = 1;
    p.canvas.style.width = '100%'; p.canvas.style.height = '100%';
    p.loading.style.display = 'grid';
    p.loading.textContent = String(p.n);
    p.textLayer.innerHTML = '';
    p.hlLayer.innerHTML = '';
    p.figLayer.innerHTML = '';
    p.drawn = false; p.pageObj = null;
  }
  if (anchor) {
    const w = doc.pages[anchor.n - 1];
    if (w) R.sh.scroll.scrollTop = Math.max(0, w.wrap.offsetTop - 8 + anchor.r * w.wrap.offsetHeight);
  }
  updateZoomLabel();
  renderVisible();
  saveState();
}

function pageRatio(n) {
  const doc = R.doc;
  const p = doc.pages[n - 1];
  if (!p) return 0;
  return clamp((R.sh.scroll.scrollTop + 8 - p.wrap.offsetTop) / Math.max(1, p.wrap.offsetHeight), 0, 1);
}

function updateZoomLabel() {
  const doc = R.doc;
  if (!doc) return;
  const z = R.sh.toolbar.querySelector('.tb-zoom');
  if (z) z.textContent = Math.round(doc.scale * 100) + '%';
  const b = R.sh.zoomBadge;
  b.textContent = Math.round(doc.scale * 100) + '%';
  b.style.opacity = '1';
  clearTimeout(R.zoomT);
  R.zoomT = setTimeout(() => { b.style.opacity = '0'; }, 1100);
}

/* ---------- 翻页 / 滚动 ---------- */
function setCurrent(n) {
  const doc = R.doc;
  if (!doc) return;
  n = clamp(n, 1, doc.num);
  doc.cur = n;
  const inp = R.sh.toolbar.querySelector('.tb-pg input');
  if (inp && document.activeElement !== inp) inp.value = String(n);
  doc.state.lastPage = n;
  const p = doc.pages[n - 1];
  if (p && p.wrap) {
    doc.pages.forEach((q) => q.wrap.classList && q.wrap.classList.toggle('cur', q === p));
  }
  markSideActive(n);
  clearTimeout(R.progT);
  R.progT = setTimeout(() => {
    const paper = LB.store.paper(doc.id);
    if (paper && (!paper.progress || paper.progress.page !== n)) {
      LB.store.patch(doc.id, { progress: { page: n }, status: paper.status === 'unread' ? 'reading' : paper.status });
    }
  }, 700);
  saveState();
}

function goPage(n, smooth) {
  const doc = R.doc;
  if (!doc) return;
  n = clamp(Math.round(n), 1, doc.num);
  const p = doc.pages[n - 1];
  if (!p) return;
  R.sh.scroll.scrollTo({ top: Math.max(0, p.wrap.offsetTop - 8), behavior: smooth ? 'smooth' : 'auto' });
  setCurrent(n);
  renderPage(p);
}

function setupScroll() {
  const sc = R.sh.scroll;
  const sig = R.ac.signal;
  let raf = 0;
  sc.addEventListener('scroll', () => {
    hideSelMenu();
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const doc = R.doc;
      if (!doc) return;
      const mid = sc.scrollTop + sc.clientHeight * 0.35;
      let best = 1;
      for (const p of doc.pages) {
        if (p.wrap.offsetTop <= mid) best = p.n; else break;
      }
      if (best !== doc.cur) setCurrent(best);
      renderVisible();
    });
  }, { signal: sig, passive: true });
  window.addEventListener('resize', deb(() => {
    const doc = R.doc;
    if (!doc) return;
    if (doc.state.fit === 'width' || doc.state.fit === 'page') applyScale(fitScale(doc.state.fit), true);
  }, 220), { signal: sig });
}


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

  // 右侧速览/对话栏开关（收起后贴右边缘，可再点开）
  const rbtn = el('button', { class: 'tb-btn rside-toggle', title: T('side_toggle') });
  const syncRbtn = () => {
    const c = R.rctl;
    const off = c ? c.isCollapsed() : false;
    rbtn.innerHTML = off ? '&#171;' : '&#187;';
    rbtn.setAttribute('aria-pressed', String(!off));
  };
  rbtn.onclick = () => { if (R.rctl) R.rctl.toggle(); syncRbtn(); };
  syncRbtn();

  sh.toolbar.append(nav, zoom, fits, spacer, search, rbtn);
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
    b.innerHTML = '<span class="sec-dot"></span><span class="tt">' + esc(s.text || '') + '</span>';
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
  panel.style.padding = '';
  const fn = LB.panes[k];
  if (typeof fn === 'function') {
    try { fn(panel, doc); } catch (e) { panel.append(el('div', { class: 'empty-hint', text: T('failed', { e: String(e && e.message || e) }) })); }
  } else {
    panel.append(el('div', { class: 'empty-hint', text: '…' }));
  }
  saveState();
}


/* ---------- 文本 / 段落 / 分区 / 图表抽取 ---------- */
LB.panes = LB.panes || {};

function rowsFrom(items) {
  const rows = [];
  for (const it of items) {
    let row = null;
    for (const r of rows) {
      if (Math.abs(r.y - it.y) < Math.max(2.2, it.h * 0.45)) { row = r; break; }
    }
    if (!row) { row = { y: it.y, h: it.h, items: [] }; rows.push(row); }
    row.items.push(it);
    row.h = Math.max(row.h, it.h);
  }
  rows.sort((a, b) => a.y - b.y);
  /* 同一 y 桶里若出现大水平空隙（双栏中缝 / 表格列间距），拆成多行，避免左右栏文字缝合 */
  const out = [];
  for (const r of rows) {
    r.items.sort((a, b) => a.x - b.x);
    let seg = [];
    const flush = () => {
      if (!seg.length) return;
      const items = seg;
      const first = items[0], last = items[items.length - 1];
      const text = items.reduce((acc, it, idx) => {
        if (!acc) return it.str;
        const prev = items[idx - 1];
        const gap = it.x - (prev.x + prev.w);
        const sp = gap > Math.max(0.9, it.h * 0.12) && !/\s$/.test(acc) && !/^\s/.test(it.str);
        return acc + (sp ? ' ' : '') + it.str;
      }, '').replace(/\s+/g, ' ').trim();
      if (text) {
        out.push({
          y: r.y,
          h: Math.max.apply(null, items.map((i) => i.h)),
          items,
          text,
          x: first.x,
          w: Math.max(0, last.x + last.w - first.x),
          size: Math.max.apply(null, items.map((i) => i.h)),
          bold: /bold|black|heavy|semibold|demibold/i.test(items[0].font || ''),
        });
      }
      seg = [];
    };
    for (const it of r.items) {
      if (seg.length) {
        const prev = seg[seg.length - 1];
        const g = it.x - (prev.x + prev.w);
        const lim = Math.max(10, Math.max(it.h || 9, prev.h || 9) * 1.1);
        if (g > lim) flush();
      }
      seg.push(it);
    }
    flush();
  }
  return out;
}

/* 检测双栏版面：按 x 区间投影找中缝，分左右两栏后逐栏成行，阅读顺序先左后右 */
function splitColumns(items) {
  const minX = Math.min.apply(null, items.map((i) => i.x));
  const maxX = Math.max.apply(null, items.map((i) => i.x + i.w));
  const edges = items.map((i) => i.x + i.w).sort((a, b) => a - b);
  const rightEdge = edges[Math.min(edges.length - 1, Math.floor(edges.length * 0.97))];
  const pageW = Math.max(120, rightEdge - minX);
  LB.colDbg = { items: items.length, pageW: +pageW.toFixed(1), minX: +minX.toFixed(1), maxX: +maxX.toFixed(1) };
  if (pageW < 220 || items.length < 12) { LB.colDbg.reason = 'small'; return rowsFrom(items); }

  const narrow = items.filter((i) => i.w < pageW * 0.55);
  LB.colDbg.narrow = narrow.length;
  if (narrow.length < 10) { LB.colDbg.reason = 'fewnarrow'; return rowsFrom(items); }

  const bins = new Uint8Array(Math.ceil(pageW) + 1);
  for (const i of narrow) {
    const a = Math.max(0, Math.round(i.x - minX));
    const b = Math.min(bins.length - 1, Math.round(i.x + i.w - minX));
    for (let k = a; k <= b; k++) bins[k] = 1;
  }
  let best = null;
  for (let a = Math.round(pageW * 0.25); a < pageW * 0.75; a++) {
    if (bins[a]) { continue; }
    let b = a;
    while (b + 1 < bins.length && !bins[b + 1]) b++;
    if (bins[a - 1] && b + 1 < bins.length && bins[b + 1]) {
      const width = b - a;
      if (width >= 4 && (!best || width > best.w)) best = { a, b, w: width };
    }
    a = b;
  }
  LB.colDbg.best = best;
  if (!best) { LB.colDbg.reason = 'nogutter'; return rowsFrom(items); }

  const cut = minX + best.a;
  const cutR = minX + best.b;
  const left = [], right = [], full = [];
  const ls = items.filter((i) => i.w < pageW * 0.55 && i.x < cut).map((i) => i.x).sort((a, b) => a - b);
  const rs = items.filter((i) => i.w < pageW * 0.55 && i.x >= cutR).map((i) => i.x).sort((a, b) => a - b);
  const leftC = ls.length ? ls[Math.floor(ls.length / 2)] : minX;
  const rightC = rs.length ? rs[Math.floor(rs.length / 2)] : cutR;
  for (const i of items) {
    if (i.w > pageW * 0.6 || (i.x < cut - 6 && i.x + i.w > cutR + 6)) full.push(i);
    else if (Math.abs(i.x - rightC) < Math.abs(i.x - leftC)) right.push(i);
    else left.push(i);
  }
  try {
    if (window.LB && items.some((i) => /Introduction/.test(i.str || ''))) {
      const zz = items.filter((i) => i.y > 550 && i.y < 600);
      window.LB.colRows = zz.map((i) => ({ x: +i.x.toFixed(1), w: +i.w.toFixed(1), y: +i.y.toFixed(1), lc: +leftC.toFixed(1), rc: +rightC.toFixed(1), s: (i.str || '').slice(0, 26) }));
    }
  } catch (e) {}
  LB.colDbg.left = left.length; LB.colDbg.right = right.length; LB.colDbg.full = full.length; LB.colDbg.cut = +cut.toFixed(1);
  if (left.length < 6 || right.length < 6) { LB.colDbg.reason = 'lopsided'; return rowsFrom(items); }

  const lR = rowsFrom(left);
  const rR = rowsFrom(right);
  const fullR = rowsFrom(full);
  LB.colDbg.reason = 'ok';

  const colTop = Math.min(lR[0].y, rR[0].y);
  const colBot = Math.max(lR[lR.length - 1].y, rR[rR.length - 1].y);
  const above = fullR.filter((r) => r.y < colTop - 2);
  const below = fullR.filter((r) => r.y > colBot + 2);
  const mids = fullR.filter((r) => r.y >= colTop - 2 && r.y <= colBot + 2).sort((a, b) => a.y - b.y);

  // 按栏整块输出（左栏读完再读右栏），保证跨行段落能正确拼接
  const out = above.slice();
  out.push.apply(out, lR);
  out.push.apply(out, mids);
  out.push.apply(out, rR);
  out.push.apply(out, below);
  return out;
}

function groupLines(items) {
  const rows = rowsFrom(items);
  if (rows.length < 8) return rows;
  const minX = Math.min.apply(null, rows.map((r) => r.x));
  const maxRight = Math.max.apply(null, rows.map((r) => r.x + r.w));
  const pageW = Math.max(120, maxRight - minX);
  const xs = rows.map((r) => r.x).sort((a, b) => a - b);
  let bestScore = -1;
  let cut = 0;
  let sumAll = 0;
  for (const x of xs) sumAll += x;
  let sumL = 0;
  for (let i = 1; i < xs.length; i++) {
    sumL += xs[i - 1];
    const nL = i;
    const nR = xs.length - i;
    if (nL < 3 || nR < 3) continue;
    const mL = sumL / nL;
    const mR = (sumAll - sumL) / nR;
    const score = nL * nR * (mL - mR) * (mL - mR);
    if (score > bestScore) { bestScore = score; cut = (xs[i - 1] + xs[i]) / 2; }
  }
  if (bestScore <= 0 || cut - minX < 40 || maxRight - cut < 40) return rows;
  const full = rows.filter((r) => r.w > pageW * 0.62);
  const left = rows.filter((r) => r.w <= pageW * 0.62 && r.x < cut);
  const right = rows.filter((r) => r.w <= pageW * 0.62 && r.x >= cut);
  if (left.length < 3 || right.length < 3) return rows;
  const out = [];
  let from = -1e9;
  const fSorted = full.slice().sort((a, b) => a.y - b.y);
  for (const f of fSorted) {
    out.push.apply(out, left.filter((r) => r.y > from && r.y < f.y));
    out.push.apply(out, right.filter((r) => r.y > from && r.y < f.y));
    out.push(f);
    from = f.y;
  }
  out.push.apply(out, left.filter((r) => r.y > from));
  out.push.apply(out, right.filter((r) => r.y > from));
  return out;
}

const HEAD_RE = /^(\d+(\.\d+)*)[\.\s\u00a0]|^(abstract|introduction|related work|background|methods?|materials? and methods?|experimental|results?|discussion|conclusions?|references|acknowledg|appendix|supplementary)\b/i;

async function imgRegions(n) {
  const doc = R.doc;
  if (!doc) return [];
  doc.imgCache = doc.imgCache || {};
  if (doc.imgCache[n]) return doc.imgCache[n];
  const pdfjs = window.pdfjsLib;
  const out = [];
  try {
    const page = await doc.pdf.getPage(n);
    const vp1 = page.getViewport({ scale: 1 });
    const OPS = pdfjs.OPS;
    const ol = await page.getOperatorList();
    const fnA = ol.fnArray;
    const argsA = ol.argsArray;
    const stack = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    for (let i = 0; i < fnA.length; i++) {
      const f = fnA[i];
      if (f === OPS.save) { stack.push(ctm); continue; }
      if (f === OPS.restore) { ctm = stack.pop() || [1, 0, 0, 1, 0, 0]; continue; }
      if (f === OPS.transform) { ctm = pdfjs.Util.transform(ctm, argsA[i]); continue; }
      if (f === OPS.paintImageXObject || f === OPS.paintInlineImageXObject || f === OPS.paintImageMaskXObject) {
        const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map((uv) => {
          const m = pdfjs.Util.transform(ctm, [1, 0, 0, 1, uv[0], uv[1]]);
          return vp1.convertToViewportPoint(m[4], m[5]);
        });
        const xs = pts.map((q) => q[0]);
        const ys = pts.map((q) => q[1]);
        const x = Math.min.apply(null, xs);
        const y = Math.min.apply(null, ys);
        const w = Math.max.apply(null, xs) - x;
        const h = Math.max.apply(null, ys) - y;
        if (w >= 60 && h >= 40) out.push({ x: x, y: y, w: w, h: h });
      }
    }
  } catch (e) { }
  // 合并相邻/重叠框
  const merged = [];
  const near = (a, b) => a.x < b.x + b.w + 14 && b.x < a.x + a.w + 14 && a.y < b.y + b.h + 14 && b.y < a.y + a.h + 14;
  for (const r of out.sort((a, b) => a.y - b.y)) {
    const hit = merged.find((m) => near(m, r));
    if (hit) {
      const x2 = Math.max(hit.x + hit.w, r.x + r.w);
      const y2 = Math.max(hit.y + hit.h, r.y + r.h);
      hit.x = Math.min(hit.x, r.x);
      hit.y = Math.min(hit.y, r.y);
      hit.w = x2 - hit.x;
      hit.h = y2 - hit.y;
    } else merged.push({ x: r.x, y: r.y, w: r.w, h: r.h });
  }
  const res = merged.filter((r) => r.w >= 90 && r.h >= 70);
  doc.imgCache[n] = res;
  return res;
}

function isHeading(line, bodySize, page) {
  const t = (line.text || '').trim();
  if (!t || t.length > 80) return false;
  if (/^[a-z]/.test(t)) return false;
  if (/[.,;:]\s*$/.test(t)) return false;
  // 页眉页脚：2 of 10 / 1/10 / 第 2 页
  if (/^\d+\s*(?:of|\/|of\s)\s*\d+/i.test(t)) return false;
  // 出版信息 / 关键词块 / 版权声明
  if (/^(?:how to cite|doi\b|https?:|www\.|©|all rights reserved|received\b|revised\b|accepted\b|published\b|keywords\b|citation\b|correspondence\b|supporting information|dedicated to)/i.test(t)) return false;
  // 期刊名页眉
  if (/(?:angewandte chemie|wiley-vch|chem\. eur\.|adv\. mater\.|j\. am\. chem\. soc\.|nature|science)/i.test(t) && t.split(/\s+/).length <= 10) return false;
  const letters = (t.match(/[A-Za-z\u4e00-\u9fa5]/g) || []).length;
  if (letters / Math.max(1, t.replace(/\s+/g, '').length) < 0.5) return false;
  const words = t.split(/\s+/).filter(Boolean).length;
  const big = bodySize > 0 && line.size > bodySize * 1.12;
  const numM = /^(\d+(?:\.\d+)*)\s*[|｜.:]?\s*(\S.*)$/.exec(t);
  if (/^\d+(?:\.\d+)*\s*[a-z]\s*[,)]/.test(t)) return false;
  const numHead = !!numM && !/^\d/.test(numM[2]) && /^[A-Za-z\u4e00-\u9fa5]/.test(numM[2]);
  const named = /^(abstract|introduction|related work|background|methods?|materials? and methods?|experiment(al)?s?|results?|discussion|conclusions?|references|acknowledg\w*|appendix|supplementary|contents)\b/i.test(t);
  if (numHead && words <= 12 && line.size >= bodySize * 0.98) return true;
  if (named && words <= 8) return true;
  // 首页大字号行多半是被拆成多段的大标题碎片，不当章节
  if (page === 1) return false;
  if (big && (line.bold || words <= 8)) return true;
  return false;
}

async function extractText() {
  const doc = R.doc;
  if (!doc) return;
  const pageTexts = [];
  const paras = [];
  const sections = [];
  const figs = [];
  const sizeHist = {};

  for (let n = 1; n <= doc.num; n++) {
    const data = await getTextData(n);
    const lines = groupLines(data.items);
    // 章节号（"1" / "2.1"）与标题被间距断成两行时合回一行
    for (let li = 0; li + 1 < lines.length; li++) {
      if (/^\d+(?:\.\d+)*$/.test(lines[li].text)) {
        const nx = lines[li + 1];
        const dx = nx.x - lines[li].x;
        if (Math.abs(nx.y - lines[li].y) < 4 && dx > 0 && dx < 70) {
          lines[li] = Object.assign({}, lines[li], { text: lines[li].text + ' ' + nx.text });
          lines.splice(li + 1, 1);
          li--;
        }
      }
    }
    pageTexts.push(lines.map((l) => l.text).join('\n'));
    for (const l of lines) {
      const k = l.size.toFixed(1);
      sizeHist[k] = (sizeHist[k] || 0) + l.text.length;
    }
    doc.lines = doc.lines || {};
    doc.lines[n] = lines;
  }

  let bodySize = 0, bestW = -1;
  Object.keys(sizeHist).forEach((k) => { if (sizeHist[k] > bestW) { bestW = sizeHist[k]; bodySize = +k; } });
  doc.bodySize = bodySize;

  const W = doc.vp1.width;
  for (let n = 1; n <= doc.num; n++) {
    const lines = doc.lines[n];
    let cur = null;
    let lastY = -1;
    let curSec = '';
    for (const l of lines) {
      const heading = isHeading(l, bodySize, n);
      const gap = lastY >= 0 ? l.y - lastY : 0;
      if (heading) {
        let level = 1;
        const m = /^(\d+(\.\d+)*)/.exec(l.text);
        if (m) level = Math.min(3, m[1].split('.').length);
        else if (bodySize && l.size > bodySize * 1.3) level = 1;
        else level = 2;
        curSec = l.text.replace(/\s+/g, ' ').replace(/\s*\|\s*/g, ' | ').replace(/^(\d+(?:\.\d+)*)(?=[A-Za-z\u4e00-\u9fa5])/, '$1 ');
        const dup = sections.some((s) => s.text === curSec || (s.text.length >= 12 && curSec.indexOf(s.text) === 0));
        if (!dup) sections.push({ text: curSec, page: n, level, size: +l.size.toFixed(1) });
      }
      const newPara = !cur || heading || gap > Math.max(3.2, l.size * 1.6) || Math.abs(l.x - cur.x) > 14;
      if (newPara) {
        const ptext = heading ? l.text.replace(/^(\d+(?:\.\d+)*)(?=[A-Za-z\u4e00-\u9fa5])/, '$1 ') : l.text;
        cur = { page: n, i: paras.length, x: +l.x.toFixed(1), y: +l.y.toFixed(1), text: ptext, size: +l.size.toFixed(1), heading, section: curSec };
        paras.push(cur);
      } else {
        cur.text += (cur.text.endsWith('-') ? '' : ' ') + l.text;
        cur.text = cur.text.replace(/-\s+/g, '');
      }
      lastY = l.y;
    }

    // 图表：caption 行 → 向上取一块区域
    const CAPRE = /(?:^|[\s.．])(figure|fig\.?|table|scheme|algorithm)\s*\d+/i;
    const caps = lines.filter((l) => CAPRE.test(l.text));
    for (const c of caps) {
      const cm = c.text.match(CAPRE);
      if (!cm) continue;
      const labM = c.text.slice(cm.index).replace(/^[\s.．]+/, '').match(/^(figure|fig\.?|table|scheme|algorithm)\s*\d+/i);
      if (!labM) continue;
      const label = labM[0];
      const above = lines.filter((l) => l.y + l.size <= c.y - 1 && !/^(figure|fig\.?|table|scheme|algorithm)\s*\d+/i.test(l.text));
      const bottom = Math.max(0, c.y - 6);
      const topEdge = above.length ? Math.max(above[above.length - 1].y + above[above.length - 1].size + 4, 36) : 36;
      const h = bottom - topEdge;
      if (h < 60) continue;
      if (figs.some((f) => f.page === n && Math.abs(f.bbox.y - topEdge) < 40)) continue;
      figs.push({
        id: 'f' + n + '_' + Math.round(topEdge),
        page: n,
        label,
        caption: (label + ' ' + c.text.slice(c.text.indexOf(label) + label.length).trim()).slice(0, 400),
        bbox: { x: W * 0.06, y: topEdge, w: W * 0.88, h },
        kind: /^table/i.test(c.text) ? 'table' : 'figure'
      });
    }

    const regs = await imgRegions(n);
    for (const rg of regs) {
      if (rg.w > W * 0.95 && rg.h > doc.vp1.height * 0.95) continue;
      if (figs.some((f) => f.page === n && rg.y < f.bbox.y + f.bbox.h + 20 && rg.y + rg.h > f.bbox.y - 20)) continue;
      const capNear = caps
        .filter((c) => Math.abs(c.y - (rg.y + rg.h)) < 90 || (c.y > rg.y && c.y < rg.y + rg.h + 110))
        .sort((a, b) => Math.abs(a.y - (rg.y + rg.h)) - Math.abs(b.y - (rg.y + rg.h)))[0];
      let label = 'Figure p' + n;
      let caption = '';
      if (capNear) {
        const lm = capNear.text.match(/(figure|fig\.?|table|scheme|algorithm)\s*\d+/i);
        if (lm) label = lm[0];
        caption = capNear.text.slice(0, 400);
      }
      figs.push({
        id: 'g' + n + '_' + Math.round(rg.y),
        page: n,
        label,
        caption,
        bbox: { x: rg.x, y: rg.y, w: rg.w, h: rg.h },
        kind: 'figure'
      });
    }
  }

  if (!R.doc || R.doc !== doc) return;
  doc.state.paragraphs = paras;
  doc.state.sections = sections;
  doc.state.figures = figs;
  doc.state.extracted = [doc.num, bodySize];
  saveState();

  try {
    await LB.api.put('/api/papers/' + doc.id + '/text', { pages: pageTexts });
  } catch (e) { }

  paintBadges();
  if (doc.sideTab === 'toc' || doc.sideTab === 'outline') renderSide();
  const tab = doc.tab;
  if (tab === 'translate' || tab === 'figures' || tab === 'structure' || tab === 'quick') setTab(tab);
}

async function figImage(fig) {
  const doc = R.doc;
  if (!doc) return '';
  doc.figCache = doc.figCache || {};
  if (doc.figCache[fig.id]) return doc.figCache[fig.id];
  try {
    const page = await doc.pdf.getPage(fig.page);
    const s = 2;
    const vp = page.getViewport({ scale: s });
    const raw = document.createElement('canvas');
    raw.width = Math.ceil(vp.width);
    raw.height = Math.ceil(vp.height);
    await page.render({ canvasContext: raw.getContext('2d'), viewport: vp }).promise;
    const b = fig.bbox;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(b.w * s));
    cv.height = Math.max(1, Math.ceil(b.h * s));
    cv.getContext('2d').drawImage(raw, b.x * s, b.y * s, b.w * s, b.h * s, 0, 0, cv.width, cv.height);
    const url = cv.toDataURL('image/png');
    doc.figCache[fig.id] = url;
    return url;
  } catch (e) {
    return '';
  }
}
LB.figImage = figImage;

function paintFigBoxes(p) {
  const doc = R.doc;
  if (!doc || !p || !p.figLayer) return;
  p.figLayer.innerHTML = '';
  if (!doc.state.showFigBoxes) return;
  const s = doc.scale;
  for (const f of doc.state.figures || []) {
    if (f.page !== p.n) continue;
    const d = el('div', { class: 'crop' });
    d.style.left = (f.bbox.x * s) + 'px';
    d.style.top = (f.bbox.y * s) + 'px';
    d.style.width = (f.bbox.w * s) + 'px';
    d.style.height = (f.bbox.h * s) + 'px';
    d.title = f.label;
    p.figLayer.append(d);
  }
}

async function maybeThumb() {
  const doc = R.doc;
  if (!doc || doc.paper.hasThumb) return;
  try {
    const p = doc.pages[0];
    if (!p) return;
    if (!p.drawn) await renderPage(p);
    const url = p.canvas.toDataURL('image/png');
    await LB.api.post('/api/papers/' + doc.id + '/thumb', { dataUrl: url });
    const paper = LB.store.paper(doc.id);
    if (paper) paper.hasThumb = true;
    LB.bus.emit('library');
  } catch (e) { }
}

/* ---------- 笔记面板 ---------- */
function notesPane(panel, doc) {
  const wrap = el('div', { class: 'pane' });
  const head = el('div', { class: 'pane-head' });
  head.append(el('h4', { text: T('tab_notes') + ' · ' + doc.state.annos.length }));
  wrap.append(head);
  const list = doc.state.annos.slice().sort((a, b) => a.page - b.page || a.ts - b.ts);
  if (!list.length) {
    wrap.append(el('div', { class: 'empty-hint', text: T('notes_empty') }));
  }
  list.forEach((a) => {
    const c = el('div', { class: 'note-card' });
    const q = el('div', { class: 'nq', text: a.text });
    q.style.borderLeftColor = HL_HEX[a.color] || 'var(--line-2)';
    const meta = el('div', { class: 'nm' });
    meta.append(el('span', { text: T('note_at', { p: a.page }) }));
    const del = el('button', { class: 'btn ghost xs ndel', text: T('delete') });
    del.onclick = (e) => {
      e.stopPropagation();
      doc.state.annos = doc.state.annos.filter((x) => x.id !== a.id);
      saveState();
      paintAnnos(doc.pages[a.page - 1]);
      paintBadges();
      setTab('notes');
    };
    meta.append(del);
    c.append(q);
    if (a.note) c.append(el('div', { class: 'nt', text: a.note }));
    c.append(meta);
    c.onclick = () => {
      goPage(a.page, true);
      setTimeout(() => {
        const p = doc.pages[a.page - 1];
        if (p) p.hlLayer.querySelectorAll('.hl').forEach((h) => h.classList.add('flash'));
      }, 260);
    };
    wrap.append(c);
  });
  panel.append(wrap);
}
LB.panes.notes = notesPane;

/* ---------- 外部提问入口 ---------- */
LB.askAbout = function (text, page) {
  const doc = R.doc;
  if (!doc) return;
  doc.state.pendingAsk = { text: String(text || '').slice(0, 6000), page: page || doc.cur };
  saveState();
  setTab('chat');
};

/* ---------- 语言切换重绘 ---------- */
LB.bus.on('lang', () => {
  if (!R.doc || !R.sh) return;
  renderHeadMeta();
  buildToolbar();
  buildRightTabs();
  renderSide();
  setTab(R.doc.tab);
});

/* ---------- 键盘 / 初始化 ---------- */
window.addEventListener('keydown', (e) => {
  const doc = R.doc;
  if (!doc) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') goPage(doc.cur + 1, true);
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goPage(doc.cur - 1, true);
  else if (e.key === 'Escape') { hideSelMenu(); hidePop(); }
});

LB.readerReady = true;
LB.setTab = setTab;
LB.saveState = saveState;
LB.flushState = () => flushState(R.doc);
LB.renderTab = () => { if (R.doc && R.sh) setTab(R.doc.tab); };
if (typeof LB.log === 'function') LB.log('reader ready');
