(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 80 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  for (let i = 0; i < 80 && !(doc.state.paragraphs || []).length; i++) await sleep(400);
  const qa = (s) => document.querySelectorAll(s);
  const sc = document.querySelector('.doc-scroll');
  const spans = [...qa('.textLayer span')].filter((s) => s.textContent.trim().length > 8);
  const out = { spanCount: spans.length };
  if (spans.length < 3) return out;
  const a = spans[3], b = spans[5];
  const r = document.createRange();
  r.setStart(a.firstChild || a, 0);
  r.setEnd(b.firstChild || b, (b.textContent || '').length);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(r);
  const rect = r.getBoundingClientRect();
  sc.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: rect.left + 40, clientY: rect.bottom - 4 }));
  await sleep(500);
  const menu = document.getElementById('selMenu');
  out.menuShown = !!menu && !menu.hidden;
  out.btns = menu ? [...menu.querySelectorAll('button')].map((x) => x.textContent.trim()) : [];
  out.selText = String(sel).slice(0, 60);
  if (menu && !menu.hidden) {
    const hl = out.btns.length ? menu.querySelectorAll('button')[0] : null;
    hl && hl.click();
    await sleep(500);
    out.popShown = !!document.getElementById('popover') && !document.getElementById('popover').hidden;
    const save = [...qa('#popover button')].find((x) => /保存/.test(x.textContent));
    save && save.click();
    await sleep(600);
    out.annos = (doc.state.annos || []).length;
    out.hlDom = qa('.hl-layer .hl').length;
  }
  LB.flushState && LB.flushState();
  await sleep(800);
  const res = await fetch('/api/papers/' + doc.id + '/state').then((r) => r.json());
  out.serverAnnos = ((res.payload || res.state || res).annos || []).length;
  return out;
})()
