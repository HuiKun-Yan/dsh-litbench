(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 80 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  for (let i = 0; i < 80 && !(doc.state.paragraphs || []).length; i++) await sleep(400);
  const qa = (s) => document.querySelectorAll(s);
  const tab = (name) => document.querySelector('.rtab[data-tab="' + name + '"]').click();
  const out = {};

  tab('translate');
  await sleep(600);
  const trBtn = qa('.rpanel .para-block button')[0] || qa('.rpanel button')[0];
  out.trBtn = trBtn ? trBtn.textContent.trim() : null;
  if (trBtn) {
    trBtn.click();
    for (let i = 0; i < 90; i++) {
      await sleep(2000);
      const tr = document.querySelector('.rpanel .para-tr');
      if (tr && tr.textContent.trim().length > 4) break;
    }
  }
  const trEl = document.querySelector('.rpanel .para-tr');
  out.translation = trEl ? trEl.textContent.trim().slice(0, 200) : null;
  out.trState = ((doc.state.translates || [])[0] || {}).text || null;

  tab('structure');
  await sleep(600);
  const sBtn = [...qa('.rpanel button')].find((b) => /结构树|structure/i.test(b.textContent));
  out.structBtn = sBtn ? sBtn.textContent.trim() : null;
  if (sBtn) {
    sBtn.click();
    for (let i = 0; i < 150; i++) { await sleep(2000); if (qa('.rpanel .tree-node').length > 0) break; }
  }
  out.treeNodes = qa('.rpanel .tree-node').length;
  out.thesis = ((doc.state.structure || {}).thesis || '').slice(0, 160);
  out.nodeTypes = [...new Set([...qa('.rpanel .tree-type')].map((n) => n.textContent.trim()))].slice(0, 8);
  return out;
})()
