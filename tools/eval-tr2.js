(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 60 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  if (!doc) return { error: 'no doc' };
  for (let i = 0; i < 60 && !(doc.state.paragraphs || []).length; i++) await sleep(400);
  document.querySelector('.rtab[data-tab="translate"]').click();
  await sleep(700);
  const blocks = [...document.querySelectorAll('.rpanel .para-block')].slice(0, 6).map((b) => ({
    pg: (b.querySelector('.para-pg') || {}).textContent || '',
    src: ((b.querySelector('.para-src') || {}).textContent || '').slice(0, 90),
  }));
  const more = (document.querySelector('.rpanel .more-bar') || {}).textContent || '';
  return { total: document.querySelectorAll('.rpanel .para-block').length, blocks, more };
})()
