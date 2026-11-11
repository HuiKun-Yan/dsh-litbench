(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 80 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  for (let i = 0; i < 80 && !(doc.state.paragraphs || []).length; i++) await sleep(400);
  const qa = (s) => document.querySelectorAll(s);
  document.querySelector('.rtab[data-tab="figures"]').click();
  await sleep(1200);
  const cards = [...qa('.rpanel .fig-card')];
  return {
    cards: cards.length,
    labels: cards.map((c) => (c.querySelector('.fig-label') || {}).textContent || '').slice(0, 8),
    imgs: qa('.rpanel .fig-card img').length,
    caps: cards.map((c) => ((c.querySelector('.fig-cap') || {}).textContent || '').slice(0, 60)).slice(0, 4),
    btns: [...qa('.rpanel .fig-card button')].map((b) => b.textContent.trim()).slice(0, 6)
  };
})()
