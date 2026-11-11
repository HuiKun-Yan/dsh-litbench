(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 80 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  if (!doc) return { error: 'no doc' };
  for (let i = 0; i < 90 && !(doc.state.paragraphs || []).length; i++) await sleep(400);
  const lines = doc.lines ? doc.lines[1] || [] : [];
  return {
    hasSplit: typeof window.splitColumns === 'function',
    scriptLen: (document.querySelector('script[src*="reader.js"]') || {}).src,
    lineCount: lines.length,
    head: lines.slice(0, 14).map((l) => [Math.round(l.x), Math.round(l.y), Math.round(l.size), (l.text || '').slice(0, 70)]),
    mid: lines.slice(24, 34).map((l) => [Math.round(l.x), Math.round(l.y), Math.round(l.size), (l.text || '').slice(0, 70)]),
    secs: (doc.state.sections || []).map((s) => s.level + '|' + s.text.slice(0, 50) + '|p' + s.page),
  };
})()
