(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 80 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  for (let i = 0; i < 80 && !(doc.state.paragraphs || []).length; i++) await sleep(400);
  const qa = (s) => document.querySelectorAll(s);
  document.querySelector('.rtab[data-tab="translate"]').click();
  await sleep(800);
  const btn = qa('.rpanel .para-block button')[0];
  const out = { btn: btn && btn.textContent.trim(), nPara: qa('.rpanel .para-block').length };
  if (btn) {
    btn.click();
    for (let i = 0; i < 60; i++) {
      await sleep(2000);
      const z = document.querySelector('.rpanel .para-block .para-zh');
      if (z && z.textContent.trim() && z.textContent.indexOf('翻译中') < 0) break;
    }
  }
  const z = document.querySelector('.rpanel .para-block .para-zh');
  out.zh = z ? z.textContent.trim().slice(0, 240) : null;
  const st = doc.state.translates || {};
  out.savedKeys = Object.keys(st).length;
  out.firstSaved = Object.values(st)[0] ? String(Object.values(st)[0]).slice(0, 120) : null;
  return out;
})()
