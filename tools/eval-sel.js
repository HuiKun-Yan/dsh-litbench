/* 选区三按钮 → 高亮 → 笔记 → 提问 全链路自动化验证 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const pid = (location.hash.match(/#\/p\/([\w-]+)/) || [])[1] || window.__PID;
  out.pid = pid;
  if (!pid) return { error: 'no pid' };
  const doc0 = () => (LB.currentDoc ? LB.currentDoc() : null);
  for (let i = 0; i < 60 && !doc0(); i++) await sleep(400);
  if (!doc0()) return { error: 'no doc' };
  const doc = doc0();
  out.before = (doc.state.annos || []).length;

  const page = document.querySelector('.page-wrap[data-n="1"]');
  const tl = page.querySelector('.textLayer');
  const spans = [...tl.querySelectorAll('span')].filter((s) => (s.textContent || '').trim().length > 6);
  out.spanCount = spans.length;
  const pick = spans.slice(2, 5);
  const range = document.createRange();
  range.setStart(pick[0].firstChild, 0);
  const last = pick[pick.length - 1].firstChild;
  range.setEnd(last, Math.min(12, (last.textContent || '').length));
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  out.selText = sel.toString().replace(/\s+/g, ' ').slice(0, 80);
  out.rects = range.getClientRects().length;

  const sc = document.querySelector('.doc-scroll');
  const r0 = range.getBoundingClientRect();
  sc.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: r0.left + 5, clientY: r0.top + 5 }));
  await sleep(400);

  const menu = document.getElementById('selMenu');
  out.menuShown = !!menu && !menu.classList.contains('hidden');
  out.btns = menu ? [...menu.querySelectorAll('button')].map((b) => b.textContent.trim()) : [];
  out.btnClasses = menu ? [...menu.querySelectorAll('button')].map((b) => b.className) : [];
  out.menuPos = menu ? { left: menu.style.left, top: menu.style.top } : null;

  if (out.menuShown) {
    menu.querySelectorAll('button')[0].click();
    await sleep(300);
    const pop = document.getElementById('popover');
    out.popShown = !!pop && !pop.classList.contains('hidden');
    out.popQuote = pop ? (pop.querySelector('.pop-quote') || {}).textContent : null;
    out.colorBtns = pop ? pop.querySelectorAll('.pop-colors button').length : 0;
    if (out.popShown) {
      const okBtn = [...pop.querySelectorAll('button')].find((b) => b.textContent.trim() === '保存');
      out.hasSave = !!okBtn;
      if (okBtn) okBtn.click();
      await sleep(500);
    }
  }
  out.annosAfter = (doc.state.annos || []).length;
  out.hlDom = document.querySelectorAll('.hl-layer .hl').length;
  out.hlCls = [...document.querySelectorAll('.hl-layer .hl')].map((n) => n.className);

  // 笔记链路
  const notePick = spans.slice(9, 12);
  if (notePick.length) {
    const r2 = document.createRange();
    r2.setStart(notePick[0].firstChild, 0);
    const l2 = notePick[notePick.length - 1].firstChild;
    r2.setEnd(l2, Math.min(10, (l2.textContent || '').length));
    sel.removeAllRanges();
    sel.addRange(r2);
    const b2 = r2.getBoundingClientRect();
    sc.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: b2.left + 3, clientY: b2.top + 3 }));
    await sleep(350);
    const m2 = document.getElementById('selMenu');
    out.menu2 = !!m2 && !m2.classList.contains('hidden');
    if (out.menu2) {
      const noteBtn = [...m2.querySelectorAll('button')].find((b) => (b.textContent || '').trim() !== '高亮' && (b.textContent || '').trim() !== '提问');
      if (noteBtn) noteBtn.click();
      await sleep(350);
      const pop2 = document.getElementById('popover');
      const ta = pop2 ? pop2.querySelector('textarea') : null;
      out.notePop = !!ta;
      if (ta) {
        ta.value = '自动化验证笔记：注意力机制';
        const ok2 = [...pop2.querySelectorAll('button')].find((b) => b.textContent.trim() === '保存');
        if (ok2) ok2.click();
        await sleep(500);
      }
    }
  }
  out.annosFinal = (doc.state.annos || []).length;
  out.notesTab = (() => {
    const t = document.querySelector('.rtab[data-tab="notes"]');
    if (t) t.click();
    return !!t;
  })();
  await sleep(600);
  out.noteCards = document.querySelectorAll('.rpanel .note-card').length;

  // 提问链路
  const askPick = spans.slice(15, 18);
  if (askPick.length) {
    const r3 = document.createRange();
    r3.setStart(askPick[0].firstChild, 0);
    const l3 = askPick[askPick.length - 1].firstChild;
    r3.setEnd(l3, Math.min(8, (l3.textContent || '').length));
    sel.removeAllRanges();
    sel.addRange(r3);
    const b3 = r3.getBoundingClientRect();
    document.querySelector('.doc-scroll').dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: b3.left + 3, clientY: b3.top + 3 }));
    await sleep(350);
    const m3 = document.getElementById('selMenu');
    const askBtn = m3 ? [...m3.querySelectorAll('button')].find((b) => b.className.indexOf('ask') >= 0) : null;
    out.askBtn = !!askBtn;
    if (askBtn) {
      askBtn.click();
      await sleep(900);
    }
  }
  out.pendingAsk = doc.state.pendingAsk ? (doc.state.pendingAsk.text || '').slice(0, 40) : null;
  out.chatTabActive = (() => { const t = document.querySelector('.rtab.active'); return t ? t.textContent.trim() : null; })();
  out.chatBox = !!document.querySelector('.rpanel .composer textarea');

  try { if (LB.flushState) await LB.flushState(); } catch (e) { }
  await sleep(600);
  try {
    const st = await (await fetch('/api/papers/' + pid + '/state')).json();
    out.server = { annos: (st.state.annos || []).length, notes: (st.state.annos || []).filter((a) => a.note).length };
  } catch (e) { out.serverErr = String(e); }
  return out;
})()
