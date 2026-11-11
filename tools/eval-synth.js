(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 80 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  for (let i = 0; i < 80 && !(doc.state.paragraphs || []).length; i++) await sleep(400);
  const qa = (s) => document.querySelectorAll(s);
  document.querySelector('.rtab[data-tab="synth"]').click();
  await sleep(900);
  const btn = [...qa('.rpanel button')].find((b) => /仅本文综合/.test(b.textContent));
  const out = { btn: btn ? btn.textContent.trim() : null };
  if (!btn) { out.html = document.querySelector('.rpanel').innerHTML.slice(0, 400); return out; }
  const t0 = Date.now();
  btn.click();
  for (let i = 0; i < 100; i++) {
    await sleep(2000);
    const body = document.querySelector('.rpanel');
    if (/##|•|结论|一致/.test(body.textContent) && body.textContent.length > 500 && !/分析中|正在/.test(body.textContent.slice(-200))) break;
  }
  out.secs = Math.round((Date.now() - t0) / 1000);
  out.len = document.querySelector('.rpanel').textContent.length;
  out.synthState = Object.keys(doc.state.synth || {}).length;
  const txt = document.querySelector('.rpanel').textContent.replace(/\s+/g, ' ').trim();
  const k = txt.indexOf('综合');
  out.snippet = txt.slice(Math.max(0, k + 2), k + 360);
  return out;
})()
