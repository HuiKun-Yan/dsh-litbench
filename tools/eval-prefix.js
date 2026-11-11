(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(2500);
  const LB = window.LB;
  const cards = document.querySelectorAll('.paper-card, .pcard, .card').length;
  const bodyTxt = (document.body.textContent || '').replace(/\s+/g, ' ').slice(0, 160);
  return {
    title: document.title,
    base: LB && LB.base,
    hasLB: !!LB,
    cards,
    boot: !!(LB && LB.store && LB.store.library),
    libLen: LB && LB.store && LB.store.library ? LB.store.library.length : -1,
    bodyTxt,
    scripts: [...document.querySelectorAll('script[src],link[rel=stylesheet]')].map((n) => n.src || n.href).slice(0, 6),
  };
})()
