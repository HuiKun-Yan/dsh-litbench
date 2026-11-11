(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 60 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  if (!doc) return { error: 'no doc' };
  for (let i = 0; i < 60 && !(doc.lines && doc.lines[1]); i++) await sleep(400);
  const all = doc.lines[1] || [];
  const L = all.slice(23).map((l, i) => ({
    i: i + 23, y: Math.round(l.y), x: Math.round(l.x), s: +l.size.toFixed(1),
    t: (l.text || '').slice(0, 110),
  }));
  return { n: all.length, L };
})()
