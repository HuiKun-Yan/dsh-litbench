(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 80 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  for (let i = 0; i < 80 && !(doc.state.paragraphs || []).length; i++) await sleep(400);
  document.querySelector('.rtab[data-tab="structure"]').click();
  await sleep(1500);
  const nodes = [...document.querySelectorAll('.rpanel .tree-node')];
  return { nodes: nodes.length, types: [...new Set(nodes.map((n) => n.className.replace(/.*tree-node\s*/, '').trim()))], thesis: (document.querySelector('.rpanel') || {}).textContent.slice(0, 120) };
})()
