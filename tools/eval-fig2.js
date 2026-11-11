(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 80 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  for (let i = 0; i < 80 && !(doc.state.paragraphs || []).length; i++) await sleep(400);
  const qa = (s) => document.querySelectorAll(s);
  document.querySelector('.rtab[data-tab="figures"]').click();
  await sleep(1200);
  const out = { cards: qa('.rpanel .fig-card').length, imgs: qa('.rpanel .fig-card img').length };
  const btn = [...qa('.rpanel .fig-card button')].find((b) => /解读/.test(b.textContent));
  out.btn = btn ? btn.textContent.trim() : null;
  if (!btn) return out;
  const t0 = Date.now();
  btn.click();
  for (let i = 0; i < 70; i++) {
    await sleep(2000);
    const t = document.querySelector('.rpanel').textContent;
    if (/解读|要点|机制|趋势/.test(t) && t.length > 700) break;
  }
  out.secs = Math.round((Date.now() - t0) / 1000);
  out.figNoteKeys = Object.keys(doc.state.figNote || {}).length;
  const cards = qa('.rpanel .fig-card');
  out.lastCardText = cards.length ? cards[0].textContent.replace(/\s+/g, ' ').slice(0, 320) : null;
  return out;
})()
