(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pid = (location.hash.match(/#\/p\/([\w-]+)/) || [])[1] || window.__PID;
  if (!pid) return { error: 'no pid' };
  try { LB.closeReader(true); } catch (e) {}
  LB.go('#/p/' + pid);
  let doc = null;
  for (let i = 0; i < 80; i++) { doc = LB.currentDoc(); if (doc) break; await sleep(400); }
  if (!doc) return { error: 'no doc' };
  for (let i = 0; i < 60; i++) { if (doc.state.paragraphs && doc.state.paragraphs.length) break; await sleep(500); }
  await sleep(1200);
  const secs = (doc.state.sections || []).map((s) => s.level + '|' + s.title + '|' + s.page);
  const paras = doc.state.paragraphs || [];
  return {
    pid: pid,
    paras: paras.length,
    headings: paras.filter((p) => p.heading).length,
    sections: secs.length,
    tocFirst: secs.slice(0, 14),
    tocBad: secs.filter((s) => (s.split('|')[1].match(/[A-Za-z\u4e00-\u9fa5]/g) || []).length < 4),
    figures: (doc.state.figures || []).length
  };
})()
