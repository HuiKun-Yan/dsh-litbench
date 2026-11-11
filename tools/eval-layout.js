(() => {
  const q = (s) => document.querySelector(s);
  const box = (s) => { const e = q(s); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight, ov: cs.overflow, pos: cs.position, disp: cs.display, fs: cs.fontSize }; };
  const out = {
    reader: box('.reader'), head: box('.reader-head'), body: box('.reader-body'),
    side: box('.side'), center: box('.center'), toolbar: box('.toolbar'),
    scroll: box('.doc-scroll'), pages: box('.pages'),
    page1: box('.page-wrap'), canvas1: box('.page-wrap canvas'), textLayer1: box('.page-wrap .textLayer'),
    rside: box('.rside'), rpanel: box('.rpanel'),
    spanCount: document.querySelectorAll('.page-wrap .textLayer span').length,
    tocItems: document.querySelectorAll('.toc-item').length,
    tocOverflow: (() => { const t = q('.side-body'); return t ? { sw: t.scrollWidth, cw: t.clientWidth } : null; })(),
    pageCount: document.querySelectorAll('.page-wrap').length,
    firstSpans: [...document.querySelectorAll('.page-wrap .textLayer span')].slice(0, 5).map((s) => ({ txt: s.textContent.slice(0, 30), r: (() => { const b = s.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; })(), fs: s.style.fontSize, tr: s.style.transform.slice(0, 40) })),
    canvasBlank: (() => { const c = q('.page-wrap canvas'); if (!c) return null; const g = c.getContext('2d'); const d = g.getImageData(0, 0, Math.min(50, c.width), Math.min(50, c.height)).data; let nz = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 30) nz++; return { px: nz, total: d.length / 4, w: c.width, h: c.height }; })(),
    scale: window.LB.currentDoc ? window.LB.currentDoc.scale : null,
  };
  return out;
})()
