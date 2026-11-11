/* chat.js — 对话面板：SSE 流式、RAG 检索、引用跳转、选中内容提问 */
(function () {
  const LB = window.LB;
  const U = LB.util;
  const el = U.el, esc = U.esc;
  const T = (k, v) => LB.t(k, v);

  const STOP = new Set(['the', 'and', 'for', 'that', 'with', 'this', 'are', 'was', 'from', 'have', 'has', 'not', 'but', 'our', 'which', 'such', 'can', 'than', 'then', 'they', 'their', 'these', 'those', 'there', 'were', 'been', 'into', 'about', 'also', 'more', 'most', 'one', 'two', 'all', 'any', 'may', 'its', 'it', 'is', 'in', 'of', 'to', 'on', 'we', 'as', 'by', 'be', 'an', 'or', 'at', 'a']);

  function terms(q) {
    const out = [];
    const en = q.toLowerCase().match(/[a-z][a-z0-9\-]{1,}/g) || [];
    en.forEach((w) => { if (w.length > 2 && !STOP.has(w)) out.push(w); });
    const cjk = q.match(/[\u4e00-\u9fa5]{2,}/g) || [];
    cjk.forEach((run) => {
      for (let i = 0; i + 2 <= run.length; i++) out.push(run.slice(i, i + 2));
      if (run.length > 3) out.push(run);
    });
    return Array.from(new Set(out)).slice(0, 24);
  }

  function retrieve(doc, q, k) {
    const ps = (doc.state.paragraphs || []).filter((p) => !p.heading && p.text && p.text.length > 40);
    if (!ps.length) return [];
    const ts = terms(q);
    if (!ts.length) return [];
    const scored = ps.map((p) => {
      const low = p.text.toLowerCase();
      let s = 0;
      ts.forEach((t) => {
        let idx = 0, hits = 0;
        while (hits < 6) {
          idx = low.indexOf(t, idx);
          if (idx < 0) break;
          hits++; idx += t.length;
        }
        if (hits) s += hits * (t.length >= 4 ? 2 : 1);
      });
      return { p: p, s: s };
    }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    return scored.slice(0, k || 6).map((x) => x.p);
  }

  /* 组装上下文：目录 + 检索命中 + （命中不足时）各章节首段 */
  function buildContext(doc, q, budget) {
    const ps = (doc.state.paragraphs || []).filter((p) => p.text && p.text.length > 40);
    const ret = ps.length ? retrieve(doc, q, 8) : [];
    const secs = doc.state.sections || [];
    const parts = [];
    if (secs.length) {
      const toc = secs.map((s) => '  '.repeat(Math.max(0, (s.level || 1) - 1)) + (s.title || '') + (s.page ? ' (p.' + s.page + ')' : '')).join('\n');
      parts.push('[论文目录]\n' + toc.slice(0, 1800));
    }
    if (ret.length) {
      parts.push('[与问题最相关的原文段落]\n' + ret.map((p) => '(p.' + p.page + (p.section ? ' · ' + p.section : '') + ') ' + p.text).join('\n\n'));
    }
    if (ret.length < 3 && ps.length) {
      const seen = new Set(ret.map((p) => p.text));
      const sampled = [];
      let cur = null;
      for (const p of ps) {
        const s = p.section || '';
        if (s !== cur) { cur = s; if (!seen.has(p.text)) sampled.push(p); }
      }
      const rest = sampled.slice(0, 16).map((p) => '(p.' + p.page + (p.section ? ' · ' + p.section : '') + ') ' + p.text).join('\n\n');
      parts.push('[各章节开头的原文段落]\n' + rest);
    }
    let txt = parts.join('\n\n');
    if (txt.length > (budget || 14000)) txt = txt.slice(0, budget || 14000);
    return { ret: ret, text: txt };
  }

  function paperContext(doc, maxChars) {
    const ps = doc.state.paragraphs || [];
    let s = '';
    for (const p of ps) { s += p.text + '\n\n'; if (s.length > maxChars) break; }
    return s.slice(0, maxChars);
  }

  function chatPane(panel, doc) {
    panel.innerHTML = '';
    panel.style.padding = '0';
    const wrap = el('div', { class: 'chat' });
    panel.append(wrap);

    doc.state.chat = doc.state.chat || [];
    const msgs = doc.state.chat;

    /* ---- 顶栏：模型选择 ---- */
    const top = el('div', { class: 'chat-top' });
    const sel = el('select', { class: 'hdr-select' });
    const list = (LB.store.config.models || []).map((m) => (typeof m === 'string' ? { id: m } : m));
    list.forEach((m) => {
      const o = el('option', { text: m.id + (m.vision ? ' 👁' : '') });
      o.value = m.id;
      if (m.id === (doc.state.chatModel || LB.store.config.textModel)) o.selected = true;
      sel.append(o);
    });
    sel.onchange = () => { doc.state.chatModel = sel.value; if (LB.saveState) LB.saveState(); };
    const fresh = el('button', { class: 'btn ghost sm', text: T('new_chat') });
    fresh.onclick = () => {
      msgs.length = 0;
      doc.state.pendingAsk = null;
      doc.state.retCtx = [];
      if (doc.saveState) doc.saveState();
      chatPane(panel, doc);
    };
    top.append(sel, fresh);
    wrap.append(top);

    /* ---- 上下文 chips ---- */
    const ctx = el('div', { class: 'chat-ctx' });
    const pending = doc.state.pendingAsk;
    let useSel = !!pending;
    let usePaper = doc.state.ctxPaper !== false;

    const chipPaper = el('label', { class: 'ctx-chip' + (usePaper ? ' on' : '') });
    const cbPaper = el('input', { type: 'checkbox' });
    cbPaper.checked = usePaper;
    cbPaper.onchange = () => { usePaper = cbPaper.checked; doc.state.ctxPaper = usePaper; chipPaper.classList.toggle('on', usePaper); if (doc.saveState) doc.saveState(); };
    chipPaper.append(cbPaper, el('span', { text: T('ctx_paper') }));
    ctx.append(chipPaper);

    if (pending) {
      const chipSel = el('label', { class: 'ctx-chip on' });
      chipSel.title = pending.text;
      const cbSel = el('input', { type: 'checkbox' });
      cbSel.checked = true;
      cbSel.onchange = () => { useSel = cbSel.checked; chipSel.classList.toggle('on', useSel); };
      chipSel.append(cbSel, el('span', { text: T('ctx_selection') + ' · p.' + pending.page }));
      ctx.append(chipSel);
    }
    wrap.append(ctx);

    /* ---- 消息区 ---- */
    const box = el('div', { class: 'msgs' });
    wrap.append(box);

    function scrollBottom() { box.scrollTop = box.scrollHeight; }

    function addMsg(m) {
      const node = el('div', { class: 'msg' + (m.role === 'user' ? ' user' : '') });
      const role = el('div', { class: 'msg-role', text: m.role === 'user' ? '我' : (doc.state.chatModel || 'AI') });
      node.append(role);
      if (m.quote) node.append(el('div', { class: 'msg-quote', text: m.quote }));
      const bubble = el('div', { class: 'msg-bubble md' });
      bubble.innerHTML = m.role === 'user' ? esc(m.content) : LB.md(m.content || '');
      node.append(bubble);
      if (m.sources && m.sources.length) {
        const src = el('div', { class: 'msg-src' });
        const seen = new Set();
        m.sources.forEach((s) => {
          if (seen.has(s.page)) return;
          seen.add(s.page);
          const b = el('button', { class: 'btn ghost xs', text: 'p.' + s.page });
          b.onclick = () => { if (LB.goPage) LB.goPage(s.page, true); };
          src.append(b);
        });
        node.append(src);
      }
      const tools = el('div', { class: 'msg-tools' });
      if (m.role !== 'user') {
        const cp = el('button', { class: 'btn ghost xs', text: T('copy') });
        cp.onclick = () => { U.copy(m.content); LB.toast(T('copied')); };
        tools.append(cp);
      }
      node.append(tools);
      box.append(node);
      return { node: node, bubble: bubble };
    }

    msgs.forEach(addMsg);
    if (!msgs.length) {
      const e = el('div', { class: 'empty-hint', text: T('chat_empty') });
      box.append(e);
    }
    scrollBottom();

    /* ---- 输入区 ---- */
    const composer = el('div', { class: 'composer' });
    const bx = el('div', { class: 'box' });
    const ta = el('textarea');
    ta.placeholder = T('chat_ph');
    const row = el('div', { class: 'crow' });
    const hint = el('span', { class: 'hint', text: T('lang_note') });
    const send = el('button', { class: 'send-btn', text: '↑' });
    row.append(hint, send);
    bx.append(ta, row);
    composer.append(bx);
    wrap.append(composer);

    if (pending) {
      ta.placeholder = T('chat_ph');
      ta.value = '';
      ta.focus();
    }

    let busy = false;
    let typing = null;

    async function doSend() {
      const q = ta.value.trim();
      if (!q || busy) return;
      const pend = doc.state.pendingAsk && useSel ? doc.state.pendingAsk : null;
      ta.value = '';
      const emptyHint = box.querySelector('.empty-hint');
      if (emptyHint) emptyHint.remove();

      const userMsg = { role: 'user', content: q, quote: pend ? pend.text.slice(0, 300) : null, page: pend ? pend.page : 0 };
      msgs.push(userMsg);
      if (LB.saveState) LB.saveState();
      addMsg(userMsg);

      const built = usePaper ? buildContext(doc, q + ' ' + (pend ? pend.text.slice(0, 400) : ''), 14000) : { ret: [], text: '' };
      const ret = built.ret;
      doc.state.retCtx = ret.map((p) => ({ page: p.page, text: p.text.slice(0, 500) }));

      const sys = '你是 LitBench 的论文阅读助手。只根据提供的材料回答；材料不足就直说不知道。引用时标注页码（如 p.3）。' + LB.langRule();
      const ctxParts = [];
      if (pend) ctxParts.push('[用户选中的原文，p.' + pend.page + ']\n' + pend.text);
      if (built.text) ctxParts.push(built.text);
      else if (usePaper) {
        const txt = paperContext(doc, 12000);
        if (txt) ctxParts.push('[论文开头部分]\n' + txt);
      }

      const hist = msgs.slice(-8, -1).map((m) => ({ role: m.role, content: m.content }));
      const payload = [
        { role: 'system', content: sys },
        { role: 'user', content: '【引用材料】\n' + (ctxParts.join('\n\n') || '（无，可基于论文标题作答）') + '\n\n【历史】\n' + (hist.map((h) => h.role + ': ' + h.content).join('\n') || '（无）') + '\n\n【问题】' + q }
      ];

      const m = { role: 'assistant', content: '', sources: ret.map((p) => ({ page: p.page })) };
      msgs.push(m);
      if (LB.saveState) LB.saveState();
      const node = el('div', { class: 'msg' });
      node.append(el('div', { class: 'msg-role', text: doc.state.chatModel || 'AI' }));
      const bubble = el('div', { class: 'msg-bubble md' });
      node.append(bubble);
      box.append(node);
      typing = el('div', { class: 'typing' }, '<i></i><i></i><i></i>');
      bubble.append(typing);
      scrollBottom();

      busy = true;
      send.classList.add('spin-inline');
      send.textContent = '■';
      doc.chatAc = new AbortController();

      const render = U.debounce(() => {
        bubble.innerHTML = LB.md(m.content || '');
        scrollBottom();
      }, 90);

      try {
        await LB.streamChat({
          model: doc.state.chatModel || LB.store.config.textModel,
          messages: payload,
          max_tokens: 3000,
          temperature: 0.3,
          signal: doc.chatAc.signal,
          onDelta: (d) => { if (typing && typing.parentNode) typing.remove(); m.content += d; render(); },
          onThinking: () => {}
        });
        bubble.innerHTML = LB.md(m.content || '');
        if (!m.content) bubble.textContent = '（空回复）';
        if (m.sources.length) {
          const src = el('div', { class: 'msg-src' });
          const seen = new Set();
          m.sources.forEach((s) => {
            if (seen.has(s.page)) return;
            seen.add(s.page);
            const b = el('button', { class: 'btn ghost xs', text: 'p.' + s.page });
            b.onclick = () => { if (LB.goPage) LB.goPage(s.page, true); };
            src.append(b);
          });
          node.append(src);
        }
        if (LB.saveState) LB.saveState();
      } catch (e) {
        bubble.innerHTML = '<span style="color:var(--danger)">' + esc(T('failed', { e: String(e.message || e) })) + '</span>';
      } finally {
        busy = false;
        send.classList.remove('spin-inline');
        send.textContent = '↑';
        scrollBottom();
      }
    }

    send.onclick = doSend;
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(160, ta.scrollHeight) + 'px';
    });

    /* ---- 常用提问 ---- */
    if (!msgs.length) {
      const sug = el('div', { class: 'suggests' });
      const qs = LB.lang === 'en'
        ? ['What is the core contribution?', 'Do the experiments support the claims?', 'What are the limitations?']
        : ['这篇的核心创新是什么？', '实验是否支持结论？', '作者自己承认的局限有哪些？'];
      qs.forEach((q) => {
        const b = el('button', { text: q });
        b.onclick = () => { ta.value = q; doSend(); };
        sug.append(b);
      });
      composer.insertBefore(sug, bx);
      sug.style.padding = '0 0 6px';
    }
  }

  LB.panes.chat = chatPane;
})();
