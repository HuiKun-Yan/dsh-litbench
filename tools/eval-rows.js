(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 80 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  for (let i = 0; i < 90 && !(doc && (doc.state.paragraphs || []).length); i++) await sleep(400);
  return { rows: LB.colRows || null };
})()
