(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 60 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  if (!doc) return { error: 'no doc' };
  for (let i = 0; i < 80 && !(doc.lines && Object.keys(doc.lines).length); i++) await sleep(400);
  const out = { bodySize: doc.bodySize, figs: (doc.state.figures || []).map((f) => f.label + '@p' + f.page + ' h' + Math.round(f.bbox.h)) };
  out.caps = [];
  for (const n of Object.keys(doc.lines || {})) {
    for (const l of doc.lines[n]) {
      if (/figure|table|scheme|algorithm/i.test(l.text)) out.caps.push(n + '|' + Math.round(l.y) + '|' + Math.round(l.x) + '|s' + l.size + '|' + l.text.slice(0, 70));
    }
  }
  return out;
})()
