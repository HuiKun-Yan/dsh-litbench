(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pid = (location.hash.match(/#\/p\/([\w-]+)/) || [])[1] || window.__PID;
  if (!pid) return { error: 'no pid' };
  try { LB.closeReader(true); } catch (e) {}
  LB.go('#/p/' + pid);
  let doc = null;
  for (let i = 0; i < 60; i++) { doc = LB.currentDoc(); if (doc) break; await sleep(400); }
  if (!doc) return { error: 'no doc' };
  for (let i = 0; i < 40; i++) { if (doc.state.paragraphs && doc.state.paragraphs.length) break; await sleep(500); }

  const out = { pid, paras: (doc.state.paragraphs || []).length, sections: (doc.state.sections || []).length };

  // 1) 速读卡
  doc.state.quick = null;
  const tabQuick = document.querySelector('.rtab[data-tab="quick"]');
  tabQuick && tabQuick.click();
  await sleep(700);
  const runs = Array.from(document.querySelectorAll('.rpanel .btn')).filter((b) => /速读|生成|Run|Generate/i.test(b.textContent));
  if (runs[0]) runs[0].click();
  for (let i = 0; i < 180; i++) { await sleep(1000); if (doc.state.quick && doc.state.quick.tldr) break; }
  out.quick = doc.state.quick ? { tldr: (doc.state.quick.tldr || '').slice(0, 70), contrib: (doc.state.quick.contributions || []).length, kw: (doc.state.quick.keywords || []).length } : null;
  out.quickCards = document.querySelectorAll('.rpanel .pc-card').length;
  out.quickModel = (document.querySelector('.rpanel .hdr-select') || {}).value || null;

  // 2) 结构树 DOM
  const tabSt = document.querySelector('.rtab[data-tab="structure"]');
  tabSt && tabSt.click();
  await sleep(900);
  out.structDom = document.querySelectorAll('.rpanel .tree-node').length;
  out.structCached = !!(doc.state.structure && doc.state.structure.thesis);

  // 3) 语言切换
  LB.setLang('en');
  await sleep(700);
  out.enTabs = Array.from(document.querySelectorAll('.rtab')).map((b) => b.textContent.trim());
  const tabFig = document.querySelector('.rtab[data-tab="figures"]');
  tabFig && tabFig.click();
  await sleep(600);
  out.enPaneHead = (document.querySelector('.rpanel .pane-head h4') || {}).textContent || null;
  out.enFigBtns = Array.from(document.querySelectorAll('.rpanel .btn')).map((b) => b.textContent.trim()).slice(0, 4);
  LB.setLang('zh');
  await sleep(500);
  out.zhTabs = Array.from(document.querySelectorAll('.rtab')).map((b) => b.textContent.trim());
  out.lang = LB.lang;
  return out;
})()
