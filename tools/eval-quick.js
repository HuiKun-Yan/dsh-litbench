(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 80 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  for (let i = 0; i < 80 && !(doc.state.paragraphs || []).length; i++) await sleep(400);
  const qa = (s) => document.querySelectorAll(s);
  document.querySelector('.rtab[data-tab="quick"]').click();
  await sleep(1000);
  const btn = [...qa('.rpanel button')].find((b) => /速读|生成/.test(b.textContent));
  const out = { btn: btn ? btn.textContent.trim() : null };
  if (btn) {
    btn.click();
    for (let i = 0; i < 90; i++) { await sleep(2000); if (document.querySelector('.rpanel').textContent.length > 400) break; }
  }
  out.len = document.querySelector('.rpanel').textContent.length;
  out.quickKeys = Object.keys(doc.state.quick || {}).length;
  out.snippet = document.querySelector('.rpanel').textContent.replace(/\s+/g, ' ').trim().slice(0, 300);
  return out;
})()
