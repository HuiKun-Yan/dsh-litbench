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
