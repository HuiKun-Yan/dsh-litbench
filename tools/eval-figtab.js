(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 60 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  for (let i = 0; i < 60 && !(doc.state.figures || []).length; i++) await sleep(400);
  const tab = [...document.querySelectorAll('.rtab')].find((t) => /图表|Figures/.test(t.textContent));
  tab.click();
  await sleep(1200);
  const cards = [...document.querySelectorAll('.fig-card')].map((c) => ({
    label: ((c.querySelector('.fig-label') || {}).textContent || '').trim().slice(0, 30),
    img: (c.querySelector('img') || {}).src ? 'yes' : 'no',
    h: c.getBoundingClientRect().height | 0,
  }));
  LB.flushState && LB.flushState();
  return { cards };
})()
