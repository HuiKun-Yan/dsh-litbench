(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  const out = {};
  out.lang0 = LB.lang;
  out.cards = document.querySelectorAll('.lib-grid .card').length;
  out.rail = Array.from(document.querySelectorAll('.rail-item')).slice(0, 3).map((n) => n.textContent.trim());
  LB.setLang('en');
  await sleep(500);
  out.langEN = LB.lang;
  out.railEN = Array.from(document.querySelectorAll('.rail-item')).slice(0, 3).map((n) => n.textContent.trim());
  out.htmlLang = document.documentElement.lang;
  out.searchPh = (document.querySelector('#globalSearch') || {}).placeholder;
  LB.setLang('zh');
  await sleep(500);
  out.langBack = LB.lang;
  out.railZH = Array.from(document.querySelectorAll('.rail-item')).slice(0, 3).map((n) => n.textContent.trim());
  out.progress = (LB.store.papers || []).map((p) => [p.id.slice(-6), p.role, p.status, p.hasThumb ? 'T' : '-']).slice(0, 6);
  return out;
})()
