/* 打开阅读器 → 结构树 tab → 点生成 → 轮询 structure 结果 */
(async () => {
  const LB = window.LB;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { steps: [] };
  try {
    const m = (location.hash || '').match(/#\/p\/([\w-]+)/);
    const pid = window.__PID || (m && m[1]);
    if (!pid) return { error: 'no pid in hash', hash: location.hash };
    try { LB.closeReader(true); } catch (_) {}
    LB.go('#/p/' + pid);
    for (let i = 0; i < 80 && !(LB.currentDoc && LB.currentDoc()); i++) await sleep(250);
    const doc = LB.currentDoc();
    if (!doc) return { error: 'no doc' };
    for (let i = 0; i < 120 && !(doc.state && doc.state.paragraphs && doc.state.paragraphs.length); i++) await sleep(300);
    out.paras = (doc.state.paragraphs || []).length;
    const tab = document.querySelector('.rtab[data-tab="structure"]');
    tab.click();
    await sleep(600);
    const btns = [...document.querySelectorAll('.rpanel .empty-hint .btn, .rpanel .pane-head .btn')];
    out.buttons = btns.map((b) => b.textContent.trim());
    const go = btns.find((b) => /生成|Generate/i.test(b.textContent));
    if (!go) return { error: 'no generate button', buttons: out.buttons };
    const sel = document.querySelector('.rpanel .hdr-select');
    out.picker = sel ? sel.value : null;
    out.pickerOptions = sel ? [...sel.options].map((o) => o.value) : null;
    const t0 = Date.now();
    go.click();
    let st = null;
    for (let i = 0; i < 400; i++) {
      await sleep(500);
      st = doc.state.structure;
      if (st && st.nodes) break;
      const err = document.querySelector('.rpanel .empty-hint');
      if (err && /失败|错误|failed|error/i.test(err.textContent)) { out.errHint = err.textContent.slice(0, 200); break; }
    }
    out.secs = Math.round((Date.now() - t0) / 1000);
    if (st && st.nodes) {
      out.thesis = (st.thesis || '').slice(0, 120);
      out.nodes = st.nodes.length;
      out.types = st.nodes.map((n) => n.type).join(',');
      out.firstClaim = (st.nodes[0] && st.nodes[0].claim || '').slice(0, 80);
      const treeNodes = document.querySelectorAll('.rpanel .tree-node').length;
      const types = [...document.querySelectorAll('.rpanel .tree-type')].map((n) => n.textContent.trim());
      out.domTree = { nodes: treeNodes, types: types.slice(0, 12) };
    } else {
      out.state = st ? 'present-no-nodes' : 'empty';
      out.panelText = (document.querySelector('.rpanel') || {}).textContent ? document.querySelector('.rpanel').textContent.slice(0, 300) : null;
    }
    out.savedAt = doc.state.structure ? 'yes' : 'no';
    return out;
  } catch (e) {
    return { error: String(e && e.stack || e), out };
  }
})()
