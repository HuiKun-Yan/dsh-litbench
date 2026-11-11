(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 80 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  if (!doc) return { error: 'no doc' };
  for (let i = 0; i < 90 && !(doc.state.paragraphs || []).length; i++) await sleep(400);
  const lines = doc.lines ? doc.lines[1] || [] : [];
  return {
    colDbg: LB.colDbg || null,
    lineCount: lines.length,
    merged: lines.filter((l) => /accel-|Introduction/.test(l.text || '')).map((l) => [Math.round(l.x), Math.round(l.y), Math.round(l.size), (l.text || '').slice(0, 80)]),
    secs: (doc.state.sections || []).map((s) => s.level + '|' + s.text.slice(0, 60) + '|p' + s.page),
  };
})()
