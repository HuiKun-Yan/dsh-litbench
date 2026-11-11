(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 50 && !doc; i++) { try { doc = LB.currentDoc(); } catch (e) {} if (!doc) await sleep(300); }
  const errs = (window.__errs || []).slice(0, 5);
  return {
    base: LB.base, hasLib: !!document.querySelector('.paper-card'), isReader: !!LB.currentDoc(),
    pages: doc ? doc.pages.length : 0,
    spans: document.querySelectorAll('.textLayer span').length,
    paras: doc && doc.state.paragraphs ? doc.state.paragraphs.length : 0,
    errs,
  };
})()
