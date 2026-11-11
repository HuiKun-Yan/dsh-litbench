(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const LB = window.LB;
  const pid = (location.hash.match(/#\/p\/([\w-]+)/) || [])[1] || window.__PID;
  out.pid = pid;
  if (!pid) return { error: 'no pid' };

  if (LB.currentDoc && LB.currentDoc()) LB.closeReader(true);
  await sleep(300);
  LB.go('#/p/' + pid);

  let doc = null;
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    doc = LB.currentDoc && LB.currentDoc();
    if (doc && doc.state && (doc.state.paragraphs || []).length) break;
  }
  if (!doc) return { error: 'no doc' };
  out.paras = (doc.state.paragraphs || []).length;
  out.parasWithSection = (doc.state.paragraphs || []).filter((p) => p.section).length;
  out.sections = (doc.state.sections || []).length;
  out.figures = (doc.state.figures || []).length;
  out.before = Object.keys(doc.state.translates || {}).length;

  const tab = document.querySelector('.rtab[data-tab="translate"]');
  if (!tab) return { error: 'no translate tab', ...out };
  tab.click();
  await sleep(400);
  out.paneHead = !!document.querySelector('.rpanel .pane-head');
  out.modelSel = (document.querySelector('.rpanel .hdr-select') || {}).value || null;
  out.blocks = document.querySelectorAll('.rpanel .para-block').length;

  const btn = document.querySelector('.rpanel .para-actions .btn');
  out.hasParaBtn = !!btn;
  if (btn) btn.click();

  for (let i = 0; i < 120; i++) {
    await sleep(500);
    const n = Object.keys(doc.state.translates || {}).length;
    out.now = n;
    if (n > out.before) break;
  }
  out.after = Object.keys(doc.state.translates || {}).length;
  out.zhSample = String(Object.values(doc.state.translates || {})[0] || '').slice(0, 60);
  out.zhDom = (document.querySelector('.rpanel .para-zh') || {}).textContent || '';
  if (LB.flushState) await LB.flushState();
  await sleep(500);
  try {
    const s = await (await fetch('/api/papers/' + pid + '/state')).json();
    out.serverTranslates = Object.keys((s.state || {}).translates || {}).length;
  } catch (e) { out.serverErr = String(e); }
  return out;
})()
