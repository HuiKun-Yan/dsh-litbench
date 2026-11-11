(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 60 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  for (let i = 0; i < 90 && !((doc.state.paragraphs || []).length); i++) await sleep(400);
  const tab = [...document.querySelectorAll('.rtab')].find((t) => /翻译|Translate/.test(t.textContent));
  tab.click();
  await sleep(1500);
  const rows = [...document.querySelectorAll('.rpanel .para-block')].map((b) => {
    const kids = [...b.children].map((c) => (c.className || c.tagName) + ':' + (c.textContent || '').trim().slice(0, 40));
    return kids;
  });
  return { n: rows.length, first3: rows.slice(0, 3), stored: Object.keys(doc.state.translates || {}).length };
})()
