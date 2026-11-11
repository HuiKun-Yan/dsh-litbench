(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  const out = {};
  const pid = (location.hash.match(/#\/p\/([\w-]+)/) || [])[1] || window.__PID;
  out.pid = pid;
  let doc = null;
  for (let i = 0; i < 80; i++) { await sleep(250); doc = LB.currentDoc && LB.currentDoc(); if (doc && doc.state && (doc.state.paragraphs || []).length) break; }
  if (!doc) return { error: 'no doc' };
  out.figures = (doc.state.figures || []).length;
  const tab = document.querySelector('.rtab[data-tab="figures"]');
  if (!tab) return { error: 'no fig tab', ...out };
  tab.click();
  await sleep(1200);
  out.cards = document.querySelectorAll('.rpanel .fig-card').length;
  out.imgs = Array.from(document.querySelectorAll('.rpanel .fig-img')).map((i) => i.src.length);
  const btn = Array.from(document.querySelectorAll('.rpanel .fig-card button')).find((b) => /解读|分析|analyse|analyze/i.test(b.textContent || ''));
  out.hasBtn = !!btn;
  if (!btn) return { error: 'no analyze btn', ...out };
  btn.click();
  const t0 = Date.now();
  for (let i = 0; i < 200; i++) {
    await sleep(500);
    const notes = doc.state.figNote || {};
    if (Object.keys(notes).length) break;
    const hint = document.querySelector('.rpanel .empty-hint');
    if (hint && /失败|failed|error/i.test(hint.textContent || '')) { out.failHint = hint.textContent.slice(0, 160); break; }
  }
  out.secs = Math.round((Date.now() - t0) / 1000);
  const notes = doc.state.figNote || {};
  out.noteKeys = Object.keys(notes).length;
  const first = Object.values(notes)[0];
  if (first) {
    out.title = String(first.title || '').slice(0, 60);
    out.points = (first.points || []).length;
    out.caveats = (first.caveats || []).length;
  }
  out.analysisDom = document.querySelectorAll('.rpanel .fig-analysis').length;
  if (LB.flushState) await LB.flushState();
  return out;
})()
