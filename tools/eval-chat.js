(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const LB = window.LB;
  let doc = null;
  for (let i = 0; i < 80 && !doc; i++) { doc = LB.currentDoc(); if (!doc) await sleep(300); }
  for (let i = 0; i < 80 && !(doc.state.paragraphs || []).length; i++) await sleep(400);
  const qa = (s) => document.querySelectorAll(s);
  document.querySelector('.rtab[data-tab="chat"]').click();
  await sleep(900);
  const ta = document.querySelector('.rpanel .composer textarea');
  const send = document.querySelector('.rpanel .send-btn');
  const out = { hasTa: !!ta, hasSend: !!send };
  if (!ta || !send) return out;
  ta.value = '这篇论文的核心结论是什么？用两句话回答。';
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  const t0 = Date.now();
  send.click();
  for (let i = 0; i < 80; i++) {
    await sleep(2000);
    const ms = qa('.rpanel .msg');
    const last = ms[ms.length - 1];
    if (ms.length >= 2 && last && !last.classList.contains('user') && last.textContent.trim().length > 20) break;
  }
  out.secs = Math.round((Date.now() - t0) / 1000);
  out.msgs = qa('.rpanel .msg').length;
  const ai = [...qa('.rpanel .msg')].filter((m) => !m.classList.contains('user'));
  out.answer = ai.length ? ai[ai.length - 1].querySelector('.msg-bubble').textContent.trim().slice(0, 300) : null;
  out.srcs = [...qa('.rpanel .msg-src button')].map((b) => b.textContent.trim()).slice(0, 5);
  out.chatTurns = (doc.state.chat || []).length;
  return out;
})()
