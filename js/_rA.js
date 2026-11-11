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
    const no = el('div', { class: 'page-no', text: '/ ' + doc.num + ' · ' + n });
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
