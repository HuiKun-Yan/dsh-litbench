(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const doc = window.LB.currentDoc();
  const tab = async (k) => {
    document.querySelector('.rtab[data-tab="' + k + '"]').click();
    await sleep(300);
  };
  const clickEmpty = async () => {
    const b = document.querySelector('.rpanel .empty-hint .btn');
    if (!b) return 'nobtn';
    b.click();
    return b.textContent.trim();
  };
  const waitFor = async (fn, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      try { if (fn()) return true; } catch (e) {}
      await sleep(700);
    }
    return false;
  };

  await tab('quick');
  out.quickClick = await clickEmpty();
  out.quickDone = await waitFor(() => doc.state.quick, 180000);
  if (doc.state.quick) {
    const q = doc.state.quick;
    out.quick = { tldr: String(q.tldr || '').slice(0, 120), contrib: (q.contributions || []).length, kw: (q.keywords || []).join(',') };
    out.quickPaneText = document.querySelector('.rpanel').innerText.replace(/\s+/g, '|').slice(0, 160);
  }

  await tab('structure');
  out.structClick = await clickEmpty();
  out.structDone = await waitFor(() => doc.state.structure, 200000);
  if (doc.state.structure) {
    const s = doc.state.structure;
    out.struct = { thesis: String(s.thesis || '').slice(0, 90), nodes: (s.nodes || []).length, types: [...new Set((s.nodes || []).map((n) => n.type))].join(',') };
    out.treeNodes = document.querySelectorAll('.rpanel .tree-node').length;
  }

  await tab('figures');
  const figBtn = document.querySelector('.rpanel .fig-acts .btn');
  out.figClick = figBtn ? figBtn.textContent.trim() : 'nobtn';
  if (figBtn) figBtn.click();
  out.figDone = await waitFor(() => doc.state.figNote && Object.keys(doc.state.figNote).length, 200000);
  if (doc.state.figNote) {
    const k = Object.keys(doc.state.figNote)[0];
    out.fig = { n: Object.keys(doc.state.figNote).length, title: String(doc.state.figNote[k].title || '').slice(0, 80), points: (doc.state.figNote[k].points || []).length };
  }

  await tab('translate');
  const paraBtn = document.querySelector('.rpanel .para-actions .btn');
  out.trClick = paraBtn ? paraBtn.textContent.trim() : 'nobtn';
  if (paraBtn) paraBtn.click();
  out.trDone = await waitFor(() => doc.state.translates && Object.keys(doc.state.translates).length, 120000);
  if (doc.state.translates) {
    const k = Object.keys(doc.state.translates)[0];
    out.tr = { n: Object.keys(doc.state.translates).length, paras: String(doc.state.translates[k].paras || '').slice(0, 60), zh: String(doc.state.translates[k].zh || '').slice(0, 100) };
  }
  out.finalTab = doc.state.lastTab;
  return out;
})()
