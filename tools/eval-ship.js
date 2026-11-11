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
  await sleep(800);

  const out = { pid };
  const q = (s) => document.querySelector(s);
  const qa = (s) => Array.from(document.querySelectorAll(s));

  out.pages = qa('.page').length;
  out.spans = qa('.page .textLayer span').length;
  out.toolbar = qa('.toolbar .tb-btn').length;
  out.sideTabs = qa('.side-tab').map((b) => b.textContent.trim());
  out.tocItems = qa('.toc-item').length;

  // 分区导航 tab
  const navTab = qa('.side-tab').find((b) => /分区|Section|Outline/i.test(b.textContent));
  if (navTab) { navTab.click(); await sleep(600); }
  out.navDom = { secDots: qa('.sec-dot').length, tocItems: qa('.toc-item').length };
  const tocTab = qa('.side-tab').find((b) => /目录|Contents/i.test(b.textContent));
  if (tocTab) tocTab.click();

  // 页内查找
  const findBox = q('.tb-search input');
  if (findBox) {
    findBox.value = 'attention';
    findBox.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(1500);
    out.findHits = qa('.textLayer span.hit').length;
out.findCur = qa('.textLayer span.cur').length;
    out.findCnt = (q('.tb-search .cnt') || {}).textContent || null;
    findBox.value = '';
    findBox.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 缩放
  const zoomIn = qa('.tb-zoom .tb-btn').find((b) => b.textContent.trim() === '+' && b.closest('.tb-zoom'));
  if (zoomIn) { zoomIn.click(); await sleep(900); }
  out.zoomLabel = (q('.zoom-badge') || {}).textContent || null;

  // 选区菜单
  const span = q('.page .textLayer span');
  if (span) {
    const r = document.createRange();
    r.selectNodeContents(span);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    document.querySelector('.doc-scroll').dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 420, clientY: 420 }));
    await sleep(700);
    const menu = q('#selMenu');
    out.selMenu = !!menu && !menu.classList.contains('hidden');
    out.selBtns = qa('#selMenu button').map((b) => b.textContent.trim());
    sel.removeAllRanges();
  }

  // 笔记 tab
  doc.state.annos = doc.state.annos || [];
  const notesTab = qa('.rtab').find((b) => /笔记|Notes/i.test(b.textContent));
  if (notesTab) { notesTab.click(); await sleep(600); }
  out.notesCards = qa('.rpanel .note-card').length;
  out.annos = doc.state.annos.length;

  // 翻译 tab 有内容
  const trTab = qa('.rtab').find((b) => /翻译|Translate/i.test(b.textContent));
  if (trTab) { trTab.click(); await sleep(900); }
  out.paraBlocks = qa('.rpanel .para-block').length;
  out.translated = Object.keys(doc.state.translates || {}).length;

  await LB.flushState();
  await sleep(400);
  const srv = await (await fetch('/api/papers/' + pid + '/state')).json();
  out.server = {
    paras: (srv.state.paragraphs || []).length,
    sections: (srv.state.sections || []).length,
    annos: (srv.state.annos || []).length,
    translates: Object.keys(srv.state.translates || {}).length
  };
  return out;
})()
