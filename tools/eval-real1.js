(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const pid = (location.hash.match(/#\/p\/([\w-]+)/) || [])[1];
  const out = { pid };

  let doc = null;
  for (let i = 0; i < 80 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  if (!doc) return { error: 'no doc' };
  for (let i = 0; i < 90 && !(doc.state.paragraphs || []).length; i++) await sleep(400);

  out.pages = doc.pdf ? doc.pdf.numPages : null;
  out.scale = +(doc.scale || 0).toFixed(3);
  out.spans = qa('.textLayer span').length;
  out.tocItems = qa('.toc-item').length;
  out.paras = (doc.state.paragraphs || []).length;
  out.sections = (doc.state.sections || []).length;
  out.figures = (doc.state.figures || []).length;
  out.bodySize = doc.state.extracted ? doc.state.extracted.bodySize : null;
  out.sectionList = (doc.state.sections || []).slice(0, 14).map((s) => `${s.level}|${s.text.slice(0, 46)}|p${s.page}`);
  out.headingParas = (doc.state.paragraphs || []).filter((p) => p.heading).length;
  out.figList = (doc.state.figures || []).map((f) => `${f.label || ''} p${f.page} ${Math.round(f.w)}x${Math.round(f.h)}`);

  // translate panel
  const trTab = q('.rtab[data-tab="translate"]');
  if (trTab) {
    trTab.click();
    await sleep(800);
    out.trBlocks = qa('.rpanel .para-block').length;
    out.trFirst = qa('.rpanel .para-block').slice(0, 3).map((b) => ({
      pg: ((b.querySelector('.para-pg') || {}).textContent || '').trim(),
      src: ((b.querySelector('.para-src') || {}).textContent || '').slice(0, 80),
    }));
    out.trMore = ((q('.rpanel .more-bar') || {}).textContent || '').trim();
  }

  // figures panel
  const fgTab = q('.rtab[data-tab="figures"]');
  if (fgTab) {
    fgTab.click();
    await sleep(2500);
    out.figCards = qa('.rpanel .fig-card').length;
    out.figImgs = qa('.rpanel .fig-img').filter((i) => i.src && i.src.startsWith('data:image')).length;
    out.figCaps = qa('.rpanel .fig-cap').slice(0, 3).map((c) => c.textContent.trim().slice(0, 70));
  }

  // structure tab default state
  const stTab = q('.rtab[data-tab="structure"]');
  if (stTab) {
    stTab.click();
    await sleep(700);
    out.structEmpty = qa('.rpanel .empty-hint').map((n) => n.textContent.trim().slice(0, 50));
    out.structBtn = qa('.rpanel .pane-head .btn, .rpanel .empty-hint .btn').map((b) => b.textContent.trim());
    out.structModel = (q('.rpanel .hdr-select') || {}).value || null;
  }

  // synth tab
  const syTab = q('.rtab[data-tab="synth"]');
  if (syTab) {
    syTab.click();
    await sleep(700);
    out.synthChips = qa('.rpanel .ctx-chip').map((c) => c.textContent.trim().slice(0, 30));
    out.synthBtn = qa('.rpanel .btn').map((b) => b.textContent.trim()).slice(0, 4);
  }

  await LB.flushState && LB.flushState();
  return out;
})()
