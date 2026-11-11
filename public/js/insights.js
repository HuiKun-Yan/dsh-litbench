/* insights.js — 右栏面板：速读 / 翻译 / 图表 / 结构 / 综合 */
(function () {
  const LB = window.LB;
  const U = LB.util;
  const el = U.el, esc = U.esc, deb = U.debounce;
  const T = (k, v) => LB.t(k, v);

  function cfg() { return LB.store.config || {}; }
  function textModel() { return cfg().textModel; }
  function visionModel() { return cfg().visionModel || cfg().textModel; }
  function cur() { return LB.currentDoc ? LB.currentDoc() : null; }

  function paneHead(wrap, titleKey, actLabel, actFn, extra) {
    const head = el('div', { class: 'pane-head' });
    head.style.display = 'flex';
    head.style.alignItems = 'center';
    head.style.gap = '8px';
    const h = el('h4', { text: T(titleKey) });
    h.style.flex = '1';
    h.style.margin = '0';
    head.append(h);
    if (actLabel) {
      const b = el('button', { class: 'btn ghost xs', text: actLabel });
      b.onclick = actFn;
      head.append(b);
    }
    if (extra) head.append(extra);
    wrap.append(head);
    return head;
  }

  function emptyBox(wrap, msgKey, btnKey, fn) {
    const e = el('div', { class: 'empty-hint', text: T(msgKey) });
    if (btnKey) {
      const b = el('button', { class: 'btn primary sm', text: T(btnKey) });
      b.onclick = fn;
      e.append(b);
    }
    wrap.append(e);
    return e;
  }

  function busy(wrap, labelKey) {
    const b = el('div', { class: 'empty-hint' });
    b.append(el('span', { class: 'spinner' }), el('div', { text: T(labelKey || 'thinking') }));
    wrap.append(b);
    return b;
  }

  function paperText(doc, maxChars, from, to) {
    from = from || 1;
    to = to || (doc.num || 999);
    const ps = (doc.state.paragraphs || []).filter((p) => p.page >= from && p.page <= to);
    let s = '';
    if (ps.length) {
      for (const p of ps) { s += p.text + '\n\n'; if (s.length > maxChars) break; }
    } else if (doc.lines) {
      for (let n = from; n <= to && n <= doc.num; n++) {
        const lines = doc.lines[n] || [];
        for (const l of lines) { s += l.text + '\n'; if (s.length > maxChars) break; }
        if (s.length > maxChars) break;
      }
    }
    return s.slice(0, maxChars);
  }

  function metaLine(doc) {
    const p = doc.paper || {};
    return [p.title, p.authors, p.year, p.venue].filter(Boolean).join(' | ');
  }

  /* ---- 模型选择：推理型模型跑长 JSON 会超时/烧光预算，默认优先快速模型 ---- */
  const FAST_PREF = ['qwen3.8-chat', 'glm-5.3-flash'];

  function modelList() {
    const ms = (cfg().models || []).map((m) => m.id).filter(Boolean);
    return ms.length ? ms : [textModel()].filter(Boolean);
  }

  function modelFor(doc, task) {
    const list = modelList();
    const saved = ((doc.state || {}).models || {})[task];
    if (saved && list.indexOf(saved) >= 0) return saved;
    const fast = FAST_PREF.filter((id) => list.indexOf(id) >= 0);
    return fast[0] || textModel() || list[0];
  }

  function pickModel(doc, task) {
    const list = modelList();
    if (list.length < 2) return null;
    const sel = el('select', { class: 'hdr-select' });
    sel.style.maxWidth = '124px';
    sel.style.fontSize = '11px';
    sel.title = LB.lang === 'en' ? 'Model for this task' : '该任务使用的模型';
    for (const id of list) {
      const o = el('option', { text: id, value: id });
      if (id === modelFor(doc, task)) o.selected = true;
      sel.append(o);
    }
    sel.onclick = (e) => e.stopPropagation();
    sel.onchange = () => {
      doc.state.models = doc.state.models || {};
      doc.state.models[task] = sel.value;
      if (LB.saveState) LB.saveState();
      if (LB.renderTab) LB.renderTab();
    };
    return sel;
  }

  /* ================= 速读卡 ================= */
  function quickPane(panel, doc) {
    panel.innerHTML = '';
    const wrap = el('div', { class: 'pane' });
    panel.append(wrap);
    const q = doc.state.quick;
    paneHead(wrap, 'tab_quick', q ? T('quick_regen') : null, () => runQuick(wrap, doc), pickModel(doc, 'quick'));

    if (!q) {
      emptyBox(wrap, 'quick_empty', 'quick_go', () => runQuick(wrap, doc));
      return;
    }
    const thesis = el('div', { class: 'thesis' });
    thesis.append(el('div', { class: 'lab', text: T('tldr') }));
    thesis.append(el('p', { text: q.tldr || '—' }));
    wrap.append(thesis);

    const sec = (titleKey, list, num) => {
      if (!list || !list.length) return;
      const c = el('div', { class: 'pc-card' });
      c.append(el('h5', { text: T(titleKey) }));
      const ul = el('ul', { class: 'ul' + (num ? ' num' : '') });
      list.forEach((x) => ul.append(el('li', { text: x })));
      c.append(ul);
      wrap.append(c);
    };
    sec('contributions', q.contributions, true);
    sec('methods', q.methods, false);
    sec('findings', q.findings, false);
    sec('limitations', q.limitations, false);
    if (q.keywords && q.keywords.length) {
      const c = el('div', { class: 'pc-card' });
      c.append(el('h5', { text: T('keywords') }));
      const row = el('div', { class: 'tagrow' });
      q.keywords.forEach((k) => row.append(el('span', { class: 'tag', text: k })));
      c.append(row);
      const applyBtn = el('button', { class: 'btn ghost xs', text: LB.lang === 'en' ? 'Save keywords as tags' : '关键词存为标签', style: 'margin-top:6px;align-self:flex-start' });
      applyBtn.onclick = async () => {
        try {
          const p = LB.store.paper(doc.paper.id) || doc.paper;
          const tags = [...new Set([].concat(p.tags || [], q.keywords.slice(0, 6)))];
          await LB.store.patch(doc.paper.id, { tags });
          LB.toast(LB.t('note_saved'), 'ok');
          applyBtn.disabled = true;
        } catch (e) {
          LB.toast(String(e && e.message || e), 'error');
        }
      };
      c.append(applyBtn);
      wrap.append(c);
    }
  }

  async function runQuick(wrap, doc) {
    const body = el('div');
    wrap.innerHTML = '';
    paneHead(wrap, 'tab_quick', null, null);
    const box = busy(wrap, 'thinking');
    try {
      const text = paperText(doc, 14000);
      const j = await LB.chatJSON({
        model: modelFor(doc, 'quick'),
        max_tokens: 3000,
        system: '你是一位严谨的学术阅读助手，擅长把论文压缩成结构化速读卡。只依据给定原文，不要编造数据。',
        user: '论文：《' + metaLine(doc) + '》\n\n正文片段：\n' + text +
          '\n\n请输出 JSON：{"tldr":"一句话结论","contributions":["主要贡献1","2","3"],"methods":["方法要点1","2"],"findings":["关键结果1","2","3"],"limitations":["局限或疑问1","2"],"keywords":["关键词1","2","3"]}'
      });
      if (cur() !== doc) return;
      doc.state.quick = {
        tldr: String(j.tldr || ''),
        contributions: (j.contributions || []).map(String).slice(0, 6),
        methods: (j.methods || []).map(String).slice(0, 6),
        findings: (j.findings || []).map(String).slice(0, 6),
        limitations: (j.limitations || []).map(String).slice(0, 6),
        keywords: (j.keywords || []).map(String).slice(0, 10),
        ts: Date.now()
      };
      if (LB.saveState) LB.saveState();
      quickPane(wrap.parentNode || wrap, doc);
    } catch (e) {
      box.remove();
      wrap.append(el('div', { class: 'empty-hint', text: T('failed', { e: String(e.message || e) }) }));
    }
  }

  /* ================= 逐段翻译 ================= */
  function translatePane(panel, doc) {
    panel.innerHTML = '';
    const wrap = el('div', { class: 'pane' });
    panel.append(wrap);
    const tr = doc.state.translates || {};
    const mode = doc.state.transMode || 'pair';

    paneHead(wrap, 'tab_translate', null, null, pickModel(doc, 'translate'));

    const ctrl = el('div', { class: 'trans-ctrl' });
    const seg = el('div', { class: 'seg' });
    [['pair', 'translate_pair'], ['only', 'translate_only']].forEach((m) => {
      const b = el('button', { class: m[0] === mode ? 'on' : '', text: T(m[1]) });
      b.onclick = () => { doc.state.transMode = m[0]; translatePane(panel, doc); };
      seg.append(b);
    });
    const go = el('button', { class: 'btn primary sm', text: T('translate_go') });
    go.onclick = () => runTranslate(wrap, doc);
    ctrl.append(seg, el('div', { class: 'grow' }), go);
    wrap.append(ctrl);

    const paras = doc.state.paragraphs || [];
    if (!paras.length) {
      emptyBox(wrap, 'translate_empty', null, null);
      if (doc.state.extracted) wrap.append(el('div', { class: 'empty-hint', text: T('no_sections') }));
      return;
    }
    const junk = (s) => {
      if (!s) return true;
      if (s.length < 24) return true;
      if (/@[a-z0-9.-]+\.[a-z]{2,}/i.test(s) && s.length < 220) return true;
      if (/copyright|all rights reserved|hereby grants? permission|permission is granted|arxiv:\d{4}\.\d{4,5}|proceedings of the|licensed under/i.test(s)) return true;
      if (/^(?:received|revised|accepted|published)\s*[:：]/i.test(s)) return true;
      if (/^(?:keywords?|key words|how to cite|doi\b|dedicated to)/i.test(s)) return true;
      if (/©/i.test(s) && s.length < 300) return true;
      if (/^[\s\d.,;:()\[\]-]+$/.test(s)) return true;
      if (/@/.test(s)) return true;
      const words = s.split(/\s+/).filter(Boolean);
      if (words.length >= 3) {
        const cap = words.filter((w) => /^[A-Z]/.test(w)).length / words.length;
        if (cap >= 0.7 && !/[.?!]/.test(s)) return true;
      }
      const letters = (s.match(/[A-Za-z\u4e00-\u9fa5]/g) || []).length;
      return letters / s.length < 0.45;
    };
    const frontSec = ((doc.state.sections || [])[0] || {}).text || '';
    const usable = paras.filter(
      (p) =>
        !p.heading &&
        !junk(p.text) &&
        !(p.page === 1 && frontSec && (p.section === frontSec || !p.section))
    );
    let shown = 0;
    let limit = 40;
    const draw = () => {
      wrap.querySelectorAll('.para-block, .more-bar').forEach((n) => n.remove());
      shown = 0;
      usable.slice(0, limit).forEach((p) => {
        shown++;
        const zh = tr[p.i];
        const blk = el('div', { class: 'para-block' });
        const top = el('div', { class: 'para-top' });
        top.append(el('span', { class: 'para-pg', text: 'p.' + p.page + (p.section ? ' · ' + p.section : '') }));
        const act = el('div', { class: 'para-actions' });
        const b = el('button', { class: 'btn ghost xs', text: T('translate_para') });
        b.onclick = () => runTranslatePara(blk, doc, p, mode);
        act.append(b);
        top.append(act);
        blk.append(top, el('div', { class: 'para-src', text: p.text }));
        if (zh) blk.append(el('div', { class: 'para-zh' + (mode === 'only' ? ' only' : ''), text: zh }));
        wrap.append(blk);
      });
      if (usable.length > limit) {
        const bar = el('div', { class: 'more-bar' });
        bar.append(el('span', { class: 'empty-hint', text: (LB.lang === 'en' ? 'Showing ' : '已显示 ') + limit + ' / ' + usable.length + (LB.lang === 'en' ? ' paragraphs' : ' 段') }));
        const mb = el('button', { class: 'btn ghost sm', text: LB.lang === 'en' ? 'Show 40 more' : '再看 40 段' });
        mb.onclick = () => { limit += 40; draw(); };
        bar.append(mb);
        wrap.append(bar);
      }
    };
    draw();
    if (!shown) emptyBox(wrap, 'translate_empty', null, null);
  }

  async function runTranslatePara(blk, doc, p, mode) {
    let out = blk.querySelector('.para-zh');
    if (!out) { out = el('div', { class: 'para-zh' + (mode === 'only' ? ' only' : ''), text: T('translating') }); blk.append(out); }
    try {
      const j = await LB.chatJSON({
        model: modelFor(doc, 'translate'),
        max_tokens: 1200,
        system: '你是学术翻译，把英文原文翻成准确、通顺的中文，保留术语与数字，不要加解释。',
        user: '原文：\n' + p.text + '\n\n输出 JSON：{"zh":"译文"}'
      });
      out.textContent = String(j.zh || '').trim();
      doc.state.translates = doc.state.translates || {};
      doc.state.translates[p.i] = out.textContent;
      if (LB.saveState) LB.saveState();
    } catch (e) {
      out.textContent = T('failed', { e: String(e.message || e) });
    }
  }

  async function runTranslate(wrap, doc) {
    const paras = (doc.state.paragraphs || []).filter((p) => !p.heading && p.text.length >= 12);
    const targets = paras.filter((p) => !(doc.state.translates || {})[p.i]).slice(0, 80);
    if (!targets.length) { LB.toast(T('trans_done')); return; }
    const bar = el('div', { class: 'progline' });
    const fill = el('i');
    fill.style.width = '0%';
    bar.append(fill);
    wrap.insertBefore(bar, wrap.children[1] || null);
    let done = 0;
    const chunk = 6;
    for (let i = 0; i < targets.length; i += chunk) {
      const part = targets.slice(i, i + chunk);
      try {
        const j = await LB.chatJSON({
          model: modelFor(doc, 'translate'),
          max_tokens: 4000,
          temperature: 0.15,
          system: '你是学术翻译，逐段把英文翻成准确通顺的中文，保留术语、公式符号与数字，不要合并段落、不要加解释。',
          user: '请翻译下面 ' + part.length + ' 段（段号从 ' + part[0].i + ' 开始连续）。' +
            part.map((p) => '[' + p.i + '] ' + p.text).join('\n\n') +
            '\n\n输出 JSON：{"items":[{"i":段号,"zh":"译文"}]}'
        });
        (j.items || []).forEach((it) => {
          const idx = +it.i;
          if (!isNaN(idx) && it.zh) {
            doc.state.translates = doc.state.translates || {};
            doc.state.translates[idx] = String(it.zh);
          }
        });
        if (LB.saveState) LB.saveState();
      } catch (e) {
        LB.toast(T('failed', { e: String(e.message || e) }), 'error', 5000);
        break;
      }
      done += part.length;
      fill.style.width = Math.min(100, Math.round((done / targets.length) * 100)) + '%';
      if (cur() !== doc) return;
    }
    LB.toast(T('trans_done'));
    const panel = wrap.parentNode;
    if (panel && cur() === doc) translatePane(panel, doc);
  }

  /* ================= 图表解读 ================= */
  function figuresPane(panel, doc) {
    panel.innerHTML = '';
    const wrap = el('div', { class: 'pane' });
    panel.append(wrap);
    const figs = doc.state.figures || [];
    paneHead(wrap, 'tab_figures', T('fig_go'), () => {
      const d = cur();
      if (!d) return;
      d.state.showFigBoxes = !d.state.showFigBoxes;
      (d.pages || []).forEach((p) => { if (LB.paintFigBoxes) LB.paintFigBoxes(p); });
      figuresPane(panel, d);
    });
    if (!figs.length) {
      emptyBox(wrap, 'fig_empty', null, null);
      return;
    }
    figs.forEach((f) => {
      const c = el('div', { class: 'fig-card' });
      const img = el('img', { class: 'fig-img' });
      img.alt = f.label;
      c.append(img);
      LB.figImage(f).then((url) => { if (url) img.src = url; });
      const cap = el('div', { class: 'fig-cap', text: f.caption });
      c.append(cap);
      const note = (doc.state.figNote || {})[f.id];
      if (note) {
        const a = el('div', { class: 'fig-analysis' });
        a.append(el('h6', { text: note.title || f.label }));
        const ul = el('ul');
        (note.points || []).forEach((x) => ul.append(el('li', { text: x })));
        a.append(ul);
        if (note.caveats && note.caveats.length) {
          const row = el('div', { class: 'tagrow' });
          note.caveats.forEach((x) => row.append(el('span', { class: 'tag', text: x })));
          a.append(row);
        }
        c.append(a);
      }
      const acts = el('div', { class: 'fig-acts' });
      const b = el('button', { class: 'btn soft xs', text: T('fig_analyze') });
      b.onclick = () => runFigure(c, doc, f, b);
      acts.append(b);
      c.append(acts);
      wrap.append(c);
    });
  }

  async function runFigure(card, doc, f, btn) {
    btn.disabled = true;
    btn.textContent = T('fig_analyzing');
    try {
      const url = await LB.figImage(f);
      const ctxText = paperText(doc, 2200, Math.max(1, f.page - 1), Math.min(doc.num, f.page + 1));
      const msgs = [
        { role: 'system', content: '你是科研图的解读者。看图 + 上下文，说明它画了什么、关键趋势或关系、作者想用它支撑什么、以及可疑之处。' + LB.langRule() },
        {
          role: 'user',
          content: [
            { type: 'text', text: '图注：' + f.caption + '\n\n该页附近正文：\n' + ctxText + '\n\n请输出 JSON：{"title":"图的主题（一句话）","points":["看点1","看点2","看点3"],"caveats":["疑点或局限"]}' },
            { type: 'image_url', image_url: { url: url } }
          ]
        }
      ];
      const out = await LB.chatOnce({ messages: msgs, model: visionModel(), max_tokens: 1600, temperature: 0.2 });
      const j = LB.parseJSON(out.content) || { points: [out.content] };
      doc.state.figNote = doc.state.figNote || {};
      doc.state.figNote[f.id] = { title: j.title || f.label, points: (j.points || []).map(String), caveats: (j.caveats || []).map(String), ts: Date.now() };
      if (LB.saveState) LB.saveState();
      const panel = card.closest('.rpanel');
      if (panel && cur() === doc) figuresPane(panel, doc);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = T('fig_analyze');
      LB.toast(T('failed', { e: String(e.message || e) }), 'error', 5000);
    }
  }

  /* ================= 论证结构树 ================= */
  const TYPE_KEY = { thesis: 't_tree', premise: 't_premise', evidence: 't_evidence', inference: 't_inference', counter: 't_counter', conclusion: 't_conclusion' };

  function structurePane(panel, doc) {
    panel.innerHTML = '';
    const wrap = el('div', { class: 'pane' });
    panel.append(wrap);
    const st = doc.state.structure;
    paneHead(wrap, 'tab_structure', st ? T('quick_regen') : null, () => runStructure(wrap, doc), pickModel(doc, 'structure'));
    if (!st) {
      emptyBox(wrap, 'struct_empty', 'struct_go', () => runStructure(wrap, doc));
      return;
    }
    if (st.thesis) {
      const th = el('div', { class: 'thesis' });
      th.append(el('div', { class: 'lab', text: T('tab_structure') }));
      th.append(el('p', { text: st.thesis }));
      wrap.append(th);
    }
    const tree = el('div', { class: 'tree' });
    (st.nodes || []).forEach((n) => tree.append(treeNode(n, 1)));
    wrap.append(tree);
  }

  function treeNode(n, lvl) {
    const node = el('div', { class: 'tree-node' + (lvl === 1 ? ' lvl1' : '') });
    const head = el('div', { class: 'tree-head' });
    const caret = el('span', { class: 'caret', text: '▾' });
    const type = el('span', { class: 'tree-type ' + (TYPE_KEY[n.type] || 't_tree'), text: n.type ? n.type : 'node' });
    const claim = el('span', { class: 'tree-claim', text: n.claim || n.text || '' });
    head.append(caret, type, claim);
    if (n.page) head.append(el('span', { class: 'tree-loc', text: 'p.' + n.page }));
    node.append(head);
    if (n.quote) node.append(el('div', { class: 'tree-ev', text: n.quote }));
    const kids = n.children || [];
    if (kids.length) {
      const box = el('div', { class: 'tree-children' });
      kids.forEach((k) => box.append(treeNode(k, lvl + 1)));
      node.append(box);
      if (lvl >= 2) {
        node.classList.add('closed');
        caret.textContent = '▸';
      }
      head.style.cursor = 'pointer';
      head.onclick = () => {
        node.classList.toggle('closed');
        caret.textContent = node.classList.contains('closed') ? '▸' : '▾';
      };
    } else {
      caret.style.visibility = 'hidden';
    }
    return node;
  }

  async function runStructure(wrap, doc) {
    wrap.innerHTML = '';
    paneHead(wrap, 'tab_structure', null, null);
    busy(wrap, 'thinking');
    try {
      const text = paperText(doc, 16000);
      const j = await LB.chatJSON({
        model: modelFor(doc, 'structure'),
        max_tokens: 8000,
        temperature: 0.2,
        system: '你是论证分析专家。把论文拆成「主张—前提—证据—推理—反例/局限」的树，层级代表支撑关系，每个节点尽量给原文依据与页码线索。',
        user: '论文：《' + metaLine(doc) + '》\n\n正文：\n' + text +
          '\n\n输出 JSON：{"thesis":"全文核心主张","nodes":[{"type":"premise|evidence|inference|counter|conclusion","claim":"论点或前提","quote":"原文依据（可空）","page":页码或0,"children":[同结构]}]}'
      });
      if (cur() !== doc) return;
      doc.state.structure = { thesis: String(j.thesis || ''), nodes: j.nodes || [], ts: Date.now() };
      if (LB.saveState) LB.saveState();
      structurePane(wrap.parentNode, doc);
    } catch (e) {
      const panel = wrap.parentNode;
      if (panel) {
        panel.innerHTML = '';
        const w2 = el('div', { class: 'pane' });
        panel.append(w2);
        paneHead(w2, 'tab_structure', null, null);
        w2.append(el('div', { class: 'empty-hint', text: T('failed', { e: String(e.message || e) }) }));
        const b = el('button', { class: 'btn primary sm', text: T('quick_regen') });
        b.onclick = () => { const w3 = el('div', { class: 'pane' }); panel.innerHTML = ''; panel.append(w3); runStructure(w3, doc); };
        w2.append(b);
      }
    }
  }

  /* ================= 跨文档综合 ================= */
  async function fetchDocText(id, maxChars, pages) {
    try {
      const pdf = await window.pdfjsLib.getDocument({ url: (LB.base || '') + '/api/pdf/' + id }).promise;
      let s = '';
      const n = Math.min(pdf.numPages, pages || 3);
      for (let i = 1; i <= n; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        s += tc.items.map((it) => it.str).join(' ') + '\n';
        if (s.length > maxChars) break;
      }
      return s.slice(0, maxChars);
    } catch (e) { return ''; }
  }

  function synthPane(panel, doc) {
    panel.innerHTML = '';
    const wrap = el('div', { class: 'pane' });
    panel.append(wrap);
    const rel = LB.store.related(doc.id);
    const others = [].concat(rel.si || [], rel.reviews || []).filter((x) => x.id !== doc.id);
    paneHead(wrap, 'tab_synth', null, null, pickModel(doc, 'synth'));

    const pick = el('div', { class: 'pc-card' });
    pick.append(el('h5', { text: T('synth_pick') }));
    if (!others.length) {
      wrap.append(el('div', { class: 'empty-hint', text: T('synth_none') }));
      const solo = el('button', { class: 'btn primary sm', text: T('synth_solo_run') });
      solo.style.marginTop = '8px';
      solo.onclick = () => runSynth(wrap, doc, others);
      pick.append(solo);
      wrap.append(pick);
      if (!doc.state.synth) return;
    } else {
      if (!doc.state.synthPick || !doc.state.synthPick.length) doc.state.synthPick = others.map((o) => o.id);
      doc.state.synthPick = doc.state.synthPick.filter((id) => others.some((o) => o.id === id));
      others.forEach((o) => {
        const row = el('label', { class: 'ctx-chip' + (doc.state.synthPick.indexOf(o.id) >= 0 ? ' on' : '') });
        const cb = el('input', { type: 'checkbox' });
        cb.checked = doc.state.synthPick.indexOf(o.id) >= 0;
        cb.onchange = () => {
          const i = doc.state.synthPick.indexOf(o.id);
          if (cb.checked && i < 0) doc.state.synthPick.push(o.id);
          if (!cb.checked && i >= 0) doc.state.synthPick.splice(i, 1);
          row.classList.toggle('on', cb.checked);
          if (LB.saveState) LB.saveState();
        };
        row.append(cb, el('span', { text: o.title || o.fileName || o.id }));
        pick.append(row);
      });
      const run = el('button', { class: 'btn primary sm', text: T('synth_run') });
      run.style.marginTop = '8px';
      run.onclick = () => runSynth(wrap, doc, others);
      pick.append(run);
      wrap.append(pick);
    }

    const res = doc.state.synth;
    if (!res) {
      if (others.length) emptyBox(wrap, 'synth_empty', null, null);
      return;
    }
    if (res.summary) wrap.append(el('div', { class: 'thesis' }, '<div class="lab">' + T('tab_synth') + '</div><p>' + esc(res.summary) + '</p>'));
    const sec = (label, list) => {
      if (!list || !list.length) return;
      const c = el('div', { class: 'pc-card' });
      c.append(el('h5', { text: label }));
      const ul = el('ul', { class: 'ul' });
      list.forEach((x) => ul.append(el('li', { text: typeof x === 'string' ? x : JSON.stringify(x) })));
      c.append(ul);
      wrap.append(c);
    };
    sec(T('synth_agree'), res.agreements);
    sec(T('synth_conflict'), res.conflicts);
    sec(T('synth_detail'), res.details);
    sec(T('synth_critique'), res.critiques);
  }

  async function runSynth(wrap, doc, others) {
    const picks = (doc.state.synthPick || []).map((id) => others.find((o) => o.id === id)).filter(Boolean);
    if (!picks.length && others.length) { LB.toast(T('synth_none')); return; }
    const solo = !picks.length;
    const panel = wrap.parentNode;
    wrap.innerHTML = '';
    paneHead(wrap, 'tab_synth', null, null, pickModel(doc, 'synth'));
    busy(wrap, 'thinking');
    try {
      const t0 = Date.now();
      const mainText = paperText(doc, 6000);
      const brief = paperText(doc, 2200);
      const parts = [];
      for (const o of picks.slice(0, 3)) {
        const tt = await fetchDocText(o.id, 2500, 2);
        console.log('[synth] fetched ' + o.id + ' ' + tt.length + ' chars @' + Math.round((Date.now() - t0) / 1000) + 's');
        const sub = await LB.chatJSON({
          model: modelFor(doc, 'synth'),
          max_tokens: 900,
          temperature: 0.2,
          system: '你是同行评审助手。阅读正文摘要与附件节选，判断附件相对正文提供了什么：印证、补充细节、矛盾、或质疑。',
          user: '## 正文摘要\n' + brief + '\n\n## 附件（' + (o.role === 'review' ? '审稿意见' : '支撑材料') + '）\n' + tt +
            '\n\n输出 JSON：{"points":["具体要点，尽量带出处描述"]}'
        });
        const pts = (sub.points || []).map(String);
        parts.push('### ' + (o.role === 'review' ? '审稿/评论' : '支撑材料') + '：' + (o.title || o.fileName) + '\n' + pts.map((x) => '- ' + x).join('\n'));
        console.log('[synth] digested ' + o.id + ' pts=' + pts.length + ' @' + Math.round((Date.now() - t0) / 1000) + 's');
      }
      console.log('[synth] final call @' + Math.round((Date.now() - t0) / 1000) + 's len=' + (mainText.length + parts.join('').length));
      const j = await LB.chatJSON({
        model: modelFor(doc, 'synth'),
        max_tokens: 2600,
        temperature: 0.25,
        system: solo
          ? '你是严格的同行评审助手。只读这一篇正文，检查它自身的论证一致性：结论是否有数据支撑，方法局限在哪，哪些强论断缺证据。'
          : '你是严格的同行评审助手，同时读正文与支撑材料/审稿意见，找出彼此印证、矛盾、补充与质疑。',
        user: solo
          ? '## 正文：《' + metaLine(doc) + '》\n' + mainText +
            '\n\n输出 JSON：{"summary":"综合判断（中文，120 字内）","agreements":["结论与证据相互印证之处"],"conflicts":["文中前后矛盾或张力"],"details":["关键实验/计算细节"],"critiques":["可被审稿人质疑的薄弱点"]}'
          : '## 正文：《' + metaLine(doc) + '》\n' + mainText + '\n\n' + parts.join('\n\n') +
            '\n\n输出 JSON：{"summary":"综合判断（中文，120 字内）","agreements":["正文与附件相互印证之处"],"conflicts":["矛盾与张力"],"details":["SI 补充的关键细节"],"critiques":["审稿质疑与作者回应"]}'
      });
      console.log('[synth] done @' + Math.round((Date.now() - t0) / 1000) + 's');
      if (cur() !== doc) return;
      doc.state.synth = {
        summary: String(j.summary || ''),
        agreements: (j.agreements || []).map(String),
        conflicts: (j.conflicts || []).map(String),
        details: (j.details || []).map(String),
        critiques: (j.critiques || []).map(String),
        ts: Date.now()
      };
      if (LB.saveState) LB.saveState();
      if (panel) synthPane(panel, doc);
    } catch (e) {
      if (panel) {
        panel.innerHTML = '';
        const w2 = el('div', { class: 'pane' });
        panel.append(w2);
        paneHead(w2, 'tab_synth', null, null);
        w2.append(el('div', { class: 'empty-hint', text: T('failed', { e: String(e.message || e) }) }));
      }
    }
  }

  LB.panes.quick = quickPane;
  LB.panes.translate = translatePane;
  LB.panes.figures = figuresPane;
  LB.panes.structure = structurePane;
  LB.panes.synth = synthPane;
})();
