(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const doc = window.LB.currentDoc();
  const out = {};
  document.querySelector('.rtab[data-tab="structure"]').click();
  await sleep(400);
  const b = document.querySelector('.rpanel .empty-hint .btn');
  out.clicked = b ? b.textContent.trim() : 'nobtn';
  if (b) b.click();
  const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    if (doc.state.structure) break;
    const err = document.querySelector('.rpanel .empty-hint');
    if (err && /失败|failed|error/i.test(err.textContent) && Date.now() - t0 > 4000) { out.err = err.textContent.slice(0, 300); break; }
    await sleep(800);
  }
  out.secs = Math.round((Date.now() - t0) / 1000);
  if (doc.state.structure) {
    const s = doc.state.structure;
    out.thesis = String(s.thesis || '').slice(0, 120);
    out.nodes = (s.nodes || []).length;
    out.types = [...new Set((s.nodes || []).map((n) => n.type))].join(',');
    out.treeNodes = document.querySelectorAll('.rpanel .tree-node').length;
    out.firstClaim = String(((s.nodes || [])[0] || {}).claim || '').slice(0, 80);
  }
  const tr = doc.state.translates || {};
  const keys = Object.keys(tr);
  out.transKeys = keys.length;
  if (keys.length) out.transSample = JSON.stringify(tr[keys[0]]).slice(0, 200);
  out.paraCount = (doc.state.paragraphs || []).length;
  return out;
})()
