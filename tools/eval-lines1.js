(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 80 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  if (!doc) return { error: 'no doc' };
  for (let i = 0; i < 90 && !(doc.state.paragraphs || []).length; i++) await sleep(400);
  const lines = (doc.lines && doc.lines[1]) || [];
  return lines.map((l) => Math.round(l.x) + ',' + Math.round(l.y) + ' ' + (l.text || '').slice(0, 55));
})()
