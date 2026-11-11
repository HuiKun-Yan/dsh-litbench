(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 80 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  for (let i = 0; i < 80 && !(doc.state.paragraphs || []).length; i++) await sleep(400);
  document.querySelector('.rtab[data-tab="structure"]').click();
  await sleep(1200);
  const btn = [...document.querySelectorAll('.rpanel button')].find((b) => /生成论证结构树/.test(b.textContent));
  if (!btn) return { err: 'no btn' };
  const t0 = Date.now();
  btn.click();
  for (let i = 0; i < 90; i++) { await sleep(2000); if (document.querySelectorAll('.rpanel .tree-node').length > 2) break; }
  const nodes = [...document.querySelectorAll('.rpanel .tree-node')];
  return {
    secs: Math.round((Date.now() - t0) / 1000),
    nodes: nodes.length,
    types: [...new Set(nodes.map((n) => (n.className.match(/tree-node\s+(\S+)/) || [])[1]).filter(Boolean))],
    texts: nodes.slice(0, 5).map((n) => n.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)),
    structKeys: Object.keys(doc.state.structure || {}).length,
  };
})()
