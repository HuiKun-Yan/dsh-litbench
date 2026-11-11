(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 80 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  if (!doc) return { error: 'no doc' };
  for (let i = 0; i < 90 && !(doc.state.paragraphs || []).length; i++) await sleep(400);
  const dbg = LB.colDbg || {};
  const lines = (doc.lines && doc.lines[1]) || [];
  const mid = lines.filter((l) => l.y > 550 && l.y < 600).map((l) => Math.round(l.x) + ',' + Math.round(l.y) + ' ' + (l.text || '').slice(0, 70));
  return { cut: dbg.cut, best: dbg.best, left: dbg.left, right: dbg.right, full: dbg.full, reason: dbg.reason, lineCount: lines.length, mid, src: (document.querySelector('script[src*="reader.js"]') || {}).src || '' };
})()
