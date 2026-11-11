/* ============ LitBench core: i18n, api, store, utils, md, toast, modal ============ */
import * as pdfjsLib from '../vendor/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.mjs', import.meta.url).href;
window.pdfjsLib = pdfjsLib;

const LB = (window.LB = window.LB || {});
const BASE = (LB.base = window.LB_BASE || '');

/* ---------------- i18n ---------------- */
const I18N = {
  zh: {
    app: '文献工作台', super: 'LITBENCH',
    search_ph: '搜索标题、正文…', search_empty: '没有匹配的文献', search_hint: '输入关键词，全库检索正文',
    settings: '设置', help: '帮助', theme: '切换主题', language: '语言 / Language',
    library: '文献库', all_papers: '全部文献', collections: '分区', tags: '标签', status: '状态',
    unread: '未读', reading: '在读', read: '读完',
    upload: '上传 PDF', import_url: '链接导入', new_collection: '新建分区', new_tag: '标签',
    empty_lib: '文献库还是空的', empty_lib_sub: '把 PDF 拖进这个窗口，或点击「上传 PDF」。原始排版、字体与图片都会完整保留。',
    drop_here: '松开以上传论文', drop_sub: '支持多篇 · 原始排版与图片完整保留',
    papers: '篇', open: '打开', delete: '删除', edit_meta: '编辑信息', set_role: '关联角色',
    role_main: '正文', role_si: '支撑材料', role_review: '审稿/评论', role_other: '其他',
    attach_to: '关联到…', detach: '解除关联', folder: '分区', no_folder: '未分区',
    side_toggle: '速览 / 对话', supporting: '支撑材料', supporting_hint: '这篇正文的配套文件，点开即读',
    sort_recent: '最近添加', sort_title: '标题', sort_year: '年份', sort_progress: '进度',
    import_title: '从链接导入 PDF', import_ph: '粘贴 PDF 链接或 arXiv 链接（如 1706.03762）',
    import_go: '下载并加入文献库', importing: '正在下载…',
    title: '标题', authors: '作者', year: '年份', venue: '期刊/会议', doi: 'DOI',
    tags_ph: '标签，用逗号分隔', save: '保存', cancel: '取消', close: '关闭', ok: '确定',
    confirm_delete: '删除这篇文献？PDF、高亮与笔记都会一起删除。',
    settings_llm: '大模型接口', base_url: '接口地址', text_model: '文本模型', vision_model: '视觉模型',
    api_key: 'API Key', key_saved: '已保存密钥 {hint}', key_missing: '尚未配置 API Key', reload_key: '从默认文件重新读取',
    test: '测试连接', testing: '测试中…', test_ok: '连接正常，模型可用', save_settings: '保存设置',
    storage_sec: '存储位置', storage_dir: '文献存储目录', storage_now: '当前目录',
    storage_migrate: '把现有文献一起搬到新目录', storage_apply: '应用目录',
    storage_moved: '已切换，正在刷新…', storage_need_abs: '请填写绝对路径，例如 D:\\LitBench',
    storage_hint: 'PDF、缩略图、阅读状态都放在这里，可指到别的大盘。',
    vision_optional: '可留空，留空就用文本模型',
    help_title: '使用指南', help_body: '',
    /* reader */
    back: '返回文献库', toc: '目录', thumbs: '缩略图', sections: '分区导航', no_sections: '还没有识别出标题结构',
    page: '页', of: '共', zoom_in: '放大', zoom_out: '缩小', fit_width: '适应宽度', fit_page: '整页',
    find_in_doc: '页内查找', find_ph: '在当前文献中查找…', find_none: '没有找到', matches: '处',
    highlight: '高亮', add_note: '笔记', ask: '提问', ask_about: '就这段提问', colors: '颜色',
    hl_yellow: '黄', hl_green: '绿', hl_blue: '蓝', hl_pink: '粉', hl_purple: '紫',
    note_title: '添加笔记', note_ph: '写下你的想法…', quote: '引用', note_saved: '笔记已保存',
    hl_saved: '已高亮', removed: '已删除',
    tab_quick: '速读', tab_translate: '翻译', tab_figures: '图表', tab_structure: '结构', tab_synth: '综合', tab_notes: '笔记', tab_chat: '对话',
    quick_go: '生成速读卡', quick_regen: '重新生成', quick_empty: '用一段话概括问题、方法、结论、局限，并列出关键贡献。',
    tldr: '一句话结论', contributions: '主要贡献', methods: '方法要点', findings: '关键结果', limitations: '局限与疑问', keywords: '关键词',
    translate_go: '翻译全文', translate_para: '翻译本段', translate_empty: '按段落生成中英对照，原文排版不动。',
    translate_pair: '双语对照', translate_only: '仅译文', translating: '正在翻译…', trans_done: '翻译完成',
    fig_go: '提取图表', fig_empty: '从版面中提取图与表，并结合上下文解读。',
    fig_analyze: '解读', fig_analyzing: '解读中…', fig_none: '没有识别到图表标题',
    struct_go: '生成论证结构树', struct_empty: '把文章拆成论点、前提、证据、推理与反例，分层展示论证链条。',
    synth_go: '综合多文档', synth_empty: '把本文与关联的支撑材料、审稿意见放在一起比对，找出矛盾与补充。',
    synth_pick: '选择要一起分析的文档', synth_run: '开始综合分析', synth_none: '还没有关联其他文档（正文/支撑材料/审稿意见）', synth_solo_run: '仅本文综合',
    synth_agree: '一致性 / 相互印证', synth_conflict: '矛盾与张力', synth_detail: 'SI 补充的关键细节', synth_critique: '审稿意见的质疑',
    notes_empty: '还没有笔记。选中文字后可以高亮或写笔记。', note_at: '第 {p} 页',
    chat_ph: '就这篇文献提问，Enter 发送，Shift+Enter 换行…', chat_send: '发送', chat_empty: '可以问：这篇的核心创新是什么？实验是否支持结论？',
    chat_ctx: '上下文', ctx_paper: '全文检索片段', ctx_selection: '选中内容', ctx_none: '无',
    thinking: '思考中', sources: '参考段落', stop: '停止', new_chat: '新对话',
    copied: '已复制', loading_pdf: '正在加载 PDF…', text_progress: '正在提取文本 {n}/{t}',
    read_progress: '第 {p} 页', role: '角色', related: '关联文档', open_related: '打开',
    /* misc */
    failed: '操作失败：{e}', no_key: '还没有配置 API Key，请到设置里填写。',
    lang_note: '提问语言会跟随界面语言', sample: '示例数据',
  },
  en: {
    app: 'Literature Workbench', super: 'LITBENCH',
    search_ph: 'Search titles and full text…', search_empty: 'No matching papers', search_hint: 'Type keywords to search the whole library',
    settings: 'Settings', help: 'Help', theme: 'Toggle theme', language: 'Language / 语言',
    library: 'Library', all_papers: 'All papers', collections: 'Collections', tags: 'Tags', status: 'Status',
    unread: 'Unread', reading: 'Reading', read: 'Finished',
    upload: 'Upload PDF', import_url: 'Import link', new_collection: 'New collection', new_tag: 'Tag',
    empty_lib: 'Your library is empty', empty_lib_sub: 'Drop PDFs into this window, or click “Upload PDF”. Original layout, fonts and figures are preserved.',
    drop_here: 'Drop to upload', drop_sub: 'Multiple files · layout & figures preserved',
    papers: 'papers', open: 'Open', delete: 'Delete', edit_meta: 'Edit metadata', set_role: 'Attach role',
    role_main: 'Main text', role_si: 'Supporting info', role_review: 'Review', role_other: 'Other',
    attach_to: 'Attach to…', detach: 'Detach', folder: 'Collection', no_folder: 'Unfiled',
    side_toggle: 'Quick look / Chat', supporting: 'Supporting files', supporting_hint: 'Files attached to this paper — click to read',
    sort_recent: 'Recently added', sort_title: 'Title', sort_year: 'Year', sort_progress: 'Progress',
    import_title: 'Import PDF from URL', import_ph: 'Paste a PDF or arXiv link (e.g. 1706.03762)',
    import_go: 'Download and add', importing: 'Downloading…',
    title: 'Title', authors: 'Authors', year: 'Year', venue: 'Venue', doi: 'DOI',
    tags_ph: 'Tags, comma separated', save: 'Save', cancel: 'Cancel', close: 'Close', ok: 'OK',
    confirm_delete: 'Delete this paper? Its PDF, highlights and notes will be removed too.',
    settings_llm: 'Model endpoint', base_url: 'Base URL', text_model: 'Text model', vision_model: 'Vision model',
    api_key: 'API key', key_saved: 'Key saved ({hint})', key_missing: 'No API key configured', reload_key: 'Reload from default file',
    test: 'Test connection', testing: 'Testing…', test_ok: 'Connected, model is ready', save_settings: 'Save settings',
    storage_sec: 'Storage', storage_dir: 'Library folder', storage_now: 'Current folder',
    storage_migrate: 'Move existing papers to the new folder', storage_apply: 'Apply folder',
    storage_moved: 'Switched, reloading…', storage_need_abs: 'Enter an absolute path, e.g. D:\\LitBench',
    storage_hint: 'PDFs, thumbnails and reading state live here. Point it at a bigger drive if you like.',
    vision_optional: 'optional — falls back to the text model',
    help_title: 'How to use', help_body: '',
    back: 'Back to library', toc: 'Contents', thumbs: 'Thumbnails', sections: 'Sections', no_sections: 'No heading structure detected yet',
    page: 'Page', of: 'of', zoom_in: 'Zoom in', zoom_out: 'Zoom out', fit_width: 'Fit width', fit_page: 'Fit page',
    find_in_doc: 'Find in document', find_ph: 'Find in this paper…', find_none: 'No match', matches: 'matches',
    highlight: 'Highlight', add_note: 'Note', ask: 'Ask', ask_about: 'Ask about this passage', colors: 'Colour',
    hl_yellow: 'Yellow', hl_green: 'Green', hl_blue: 'Blue', hl_pink: 'Pink', hl_purple: 'Purple',
    note_title: 'Add a note', note_ph: 'Write down your thought…', quote: 'Quote', note_saved: 'Note saved',
    hl_saved: 'Highlighted', removed: 'Deleted',
    tab_quick: 'Brief', tab_translate: 'Translate', tab_figures: 'Figures', tab_structure: 'Structure', tab_synth: 'Synthesis', tab_notes: 'Notes', tab_chat: 'Chat',
    quick_go: 'Generate brief', quick_regen: 'Regenerate', quick_empty: 'Summarise problem, method, findings and limitations in a few lines, plus key contributions.',
    tldr: 'One-line takeaway', contributions: 'Contributions', methods: 'Method', findings: 'Key results', limitations: 'Limitations & questions', keywords: 'Keywords',
    translate_go: 'Translate paper', translate_para: 'Translate paragraph', translate_empty: 'Generate a paragraph-by-paragraph bilingual view; the original layout stays untouched.',
    translate_pair: 'Bilingual', translate_only: 'Translation only', translating: 'Translating…', trans_done: 'Translation ready',
    fig_go: 'Extract figures', fig_empty: 'Pull figures and tables from the layout and interpret them with context.',
    fig_analyze: 'Interpret', fig_analyzing: 'Interpreting…', fig_none: 'No figure captions detected',
    struct_go: 'Build argument tree', struct_empty: 'Break the paper into claims, premises, evidence, inferences and counterpoints.',
    synth_go: 'Synthesise documents', synth_empty: 'Compare this paper with its supporting information and reviews to surface conflicts and additions.',
    synth_pick: 'Documents to analyse together', synth_run: 'Run synthesis', synth_none: 'No related documents attached yet (main / SI / review)', synth_solo_run: 'Analyse this paper alone',
    synth_agree: 'Agreements / mutual support', synth_conflict: 'Conflicts and tensions', synth_detail: 'Key details from supporting information', synth_critique: 'Concerns raised by reviewers',
    notes_empty: 'No notes yet. Select text to highlight or annotate.', note_at: 'Page {p}',
    chat_ph: 'Ask about this paper. Enter to send, Shift+Enter for newline…', chat_send: 'Send', chat_empty: 'Try: what is the core novelty? Do the experiments support the claims?',
    chat_ctx: 'Context', ctx_paper: 'Retrieved passages', ctx_selection: 'Selection', ctx_none: 'none',
    thinking: 'Thinking', sources: 'Sources', stop: 'Stop', new_chat: 'New chat',
    copied: 'Copied', loading_pdf: 'Loading PDF…', text_progress: 'Extracting text {n}/{t}',
    read_progress: 'Page {p}', role: 'Role', related: 'Related', open_related: 'Open',
    failed: 'Failed: {e}', no_key: 'No API key configured yet. Add one in Settings.',
    lang_note: 'Questions follow the interface language', sample: 'sample data',
  },
};

LB.lang = localStorage.getItem('lb.lang') || (navigator.language || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en';
if (localStorage.getItem('lb.lang')) LB.lang = localStorage.getItem('lb.lang');
LB.t = function (key, vars) {
  const d = I18N[LB.lang] || I18N.zh;
  let s = d[key];
  if (s === undefined) s = I18N.zh[key];
  if (s === undefined) return key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return s;
};
LB.promptLang = () => (LB.lang === 'en' ? 'en' : 'zh');
LB.langRule = () => (LB.lang === 'en'
  ? 'Always answer in English. Keep technical terms, formulas and citation markers unchanged.'
  : '请始终用中文回答，专业术语与公式保留原文。');

/* ---------------- api ---------------- */
const api = (LB.api = {
  async req(method, path, body, headers) {
    const opt = { method, headers: Object.assign({}, headers || {}) };
    if (body !== undefined && body !== null) {
      if (body instanceof Blob || body instanceof ArrayBuffer) {
        opt.body = body;
      } else {
        opt.headers['Content-Type'] = 'application/json';
        opt.body = JSON.stringify(body);
      }
    }
    const r = await fetch(BASE + path, opt);
    const ct = r.headers.get('content-type') || '';
    if (!r.ok) {
      let msg = 'HTTP ' + r.status;
      try { const j = await r.json(); msg = j.error || msg; } catch (_) {}
      throw new Error(msg);
    }
    if (ct.includes('json')) return r.json();
    return r.text();
  },
  get: (p) => api.req('GET', p),
  post: (p, b) => api.req('POST', p, b),
  put: (p, b) => api.req('PUT', p, b),
  patch: (p, b) => api.req('PATCH', p, b),
  del: (p) => api.req('DELETE', p),
  async upload(file) {
    return api.req('POST', '/api/upload', file, { 'x-filename': encodeURIComponent(file.name), 'Content-Type': 'application/pdf' });
  },
});

/* ---------------- store ---------------- */
const store = (LB.store = {
  papers: [], collections: [], config: null, loaded: false,
  async load() {
    const j = await api.get('/api/bootstrap');
    this.papers = j.library || [];
    this.collections = j.collections || [];
    this.config = j.config || {};
    this.loaded = true;
    return this;
  },
  paper(id) { return this.papers.find((p) => p.id === id); },
  async refresh() {
    const j = await api.get('/api/bootstrap');
    this.papers = j.library || [];
    this.collections = j.collections || [];
    this.config = j.config || {};
    bus.emit('library');
    return this;
  },
  async patch(id, patch) {
    const j = await api.patch('/api/papers/' + id, patch);
    const p = this.paper(id);
    if (p) Object.assign(p, j.paper);
    bus.emit('library');
    return j.paper;
  },
  async remove(id) {
    await api.del('/api/papers/' + id);
    this.papers = this.papers.filter((p) => p.id !== id);
    bus.emit('library');
  },
  related(id) {
    const p = this.paper(id);
    if (!p) return { main: null, si: [], reviews: [], siblings: [] };
    const root = p.parentId || p.id;
    const main = p.parentId ? this.paper(p.parentId) : p;
    const others = this.papers.filter((x) => x.id !== p.id && (x.parentId === root || (root === p.id && x.parentId === p.id)));
    return {
      main: main || p,
      si: others.filter((x) => x.role === 'si'),
      reviews: others.filter((x) => x.role === 'review'),
      siblings: others,
    };
  },
  async saveCollections(list) {
    const j = await api.put('/api/collections', { collections: list });
    this.collections = j.collections;
    bus.emit('library');
  },
});

/* ---------------- event bus ---------------- */
const bus = (LB.bus = {
  map: new Map(),
  on(ev, fn) { (this.map.get(ev) || this.map.set(ev, []).get(ev)).push(fn); return () => this.off(ev, fn); },
  off(ev, fn) { const a = this.map.get(ev) || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); },
  emit(ev, data) { (this.map.get(ev) || []).slice().forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); },
});

/* ---------------- utils ---------------- */
const U = (LB.util = {
  el(tag, attrs, html) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    if (html !== undefined) n.innerHTML = html;
    return n;
  },
  $(sel, root) { return (root || document).querySelector(sel); },
  $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); },
  esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  bytes(n) {
    if (!n) return '—';
    const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return v.toFixed(v < 10 && i > 0 ? 1 : 0) + ' ' + u[i];
  },
  ago(iso) {
    if (!iso) return '';
    const d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 60) return LB.lang === 'en' ? 'just now' : '刚刚';
    if (d < 3600) return Math.floor(d / 60) + (LB.lang === 'en' ? ' min ago' : ' 分钟前');
    if (d < 86400) return Math.floor(d / 3600) + (LB.lang === 'en' ? ' h ago' : ' 小时前');
    if (d < 86400 * 30) return Math.floor(d / 86400) + (LB.lang === 'en' ? ' d ago' : ' 天前');
    return new Date(iso).toLocaleDateString();
  },
  debounce(fn, ms) { let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; },
  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
  uid() { return Math.random().toString(36).slice(2, 9); },
  hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); },
  sleep(ms) { return new Promise((r) => setTimeout(r, ms)); },
  async copy(text) {
    try { await navigator.clipboard.writeText(text); toast(LB.t('copied'), 'ok'); }
    catch (_) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast(LB.t('copied'), 'ok'); }
  },
});

/* ---------------- very small markdown ---------------- */
function inlineMd(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
LB.md = function (src) {
  const blocks = [];
  let s = U.esc(src || '').replace(/```(\w*)\n?([\s\S]*?)```/g, (m, l, c) => {
    blocks.push('<pre class="code"><code>' + c.replace(/\n$/, '') + '</code></pre>');
    return '\u0000' + (blocks.length - 1) + '\u0000';
  });
  const out = []; let list = null;
  const flush = () => { if (list) { out.push('</' + list + '>'); list = null; } };
  for (const raw of s.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    const bm = line.match(/^\u0000(\d+)\u0000$/);
    if (bm) { flush(); out.push(blocks[+bm[1]]); continue; }
    if (!line.trim()) { flush(); continue; }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flush(); const n = Math.min(6, m[1].length + 2); out.push('<h' + n + '>' + inlineMd(m[2]) + '</h' + n + '>'); continue; }
    if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) { if (list !== 'ul') { flush(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inlineMd(m[1]) + '</li>'); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { if (list !== 'ol') { flush(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inlineMd(m[1]) + '</li>'); continue; }
    if ((m = line.match(/^&gt;\s?(.*)$/))) { flush(); out.push('<blockquote>' + inlineMd(m[1]) + '</blockquote>'); continue; }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) { flush(); out.push('<hr>'); continue; }
    flush(); out.push('<p>' + inlineMd(line) + '</p>');
  }
  flush();
  return out.join('');
};

/* ---------------- toast ---------------- */
let toastTimer = null;
function toast(msg, type, ms) {
  const box = document.getElementById('toast');
  if (!box) return;
  const n = U.el('div', { class: 'toast ' + (type || '') }, U.esc(msg));
  box.appendChild(n);
  requestAnimationFrame(() => n.classList.add('in'));
  const ttl = ms || (type === 'error' ? 5200 : 2600);
  setTimeout(() => { n.classList.remove('in'); setTimeout(() => n.remove(), 260); }, ttl);
}
LB.toast = toast;

/* ---------------- modal ---------------- */
LB.modal = function ({ title, body, actions, wide, onClose }) {
  const root = document.getElementById('modalRoot');
  const back = U.el('div', { class: 'modal-back' });
  const card = U.el('div', { class: 'modal' + (wide ? ' wide' : '') });
  const head = U.el('div', { class: 'modal-head' });
  head.appendChild(U.el('b', { text: title || '' }));
  const x = U.el('button', { class: 'icon-btn', title: LB.t('close') }, '✕');
  head.appendChild(x);
  const bodyEl = U.el('div', { class: 'modal-body' });
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
  const foot = U.el('div', { class: 'modal-foot' });
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    back.classList.remove('in');
    setTimeout(() => back.remove(), 180);
    if (onClose) onClose();
  };
  (actions || []).forEach((a) => {
    const b = U.el('button', { class: 'btn ' + (a.kind || '') }, U.esc(a.label));
    b.addEventListener('click', async () => {
      if (a.onClick) {
        b.disabled = true;
        try {
          const keep = await a.onClick({ close, modal: card });
          if (keep === false) return;
        } catch (e) { toast(LB.t('failed', { e: e.message }), 'error'); b.disabled = false; return; }
      }
      if (a.keep !== true) close();
    });
    foot.appendChild(b);
  });
  card.appendChild(head); card.appendChild(bodyEl);
  if (foot.children.length) card.appendChild(foot);
  back.appendChild(card);
  root.appendChild(back);
  requestAnimationFrame(() => back.classList.add('in'));
  x.addEventListener('click', close);
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  return { close, body: bodyEl, card };
};

LB.confirm = function (msg, { danger = true, okLabel } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = LB.modal({
      title: okLabel || LB.t('ok'),
      body: U.el('p', { class: 'muted', text: msg }),
      actions: [
        { label: LB.t('cancel'), kind: 'ghost', onClick: () => { done = true; resolve(false); } },
        { label: okLabel || LB.t('delete'), kind: danger ? 'danger' : 'primary', onClick: () => { done = true; resolve(true); } },
      ],
      onClose: () => { if (!done) resolve(false); },
    });
    return m;
  });
};

/* ---------------- LLM helpers ---------------- */
LB.chatOnce = async function ({ messages, model, max_tokens, temperature }) {
  if (!store.config || !store.config.hasKey) throw new Error(LB.t('no_key'));
  const j = await api.post('/api/chat', { messages, model: model || store.config.textModel, stream: false, max_tokens: max_tokens || 2048, temperature: temperature === undefined ? 0.3 : temperature });
  return { content: j.content || '', usage: j.usage || null };
};

LB.parseJSON = function (text) {
  if (!text) return null;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(s); } catch (_) {}
  const first = s.search(/[\[{]/);
  if (first < 0) return null;
  const open = s[first];
  const closeCh = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = first; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === open) depth++;
    else if (ch === closeCh) { depth--; if (!depth) { try { return JSON.parse(s.slice(first, i + 1)); } catch (_) { return null; } } }
  }
  const last = s.lastIndexOf(closeCh);
  if (last > first) { try { return JSON.parse(s.slice(first, last + 1)); } catch (_) {} }
  return null;
};

LB.chatJSON = async function ({ system, user, model, max_tokens, temperature }) {
  const messages = [];
  const sys = [system || '', LB.langRule(), '只输出一个合法 JSON 对象/数组，不要输出任何解释、注释或 Markdown 围栏。'].join('\n\n');
  messages.push({ role: 'system', content: LB.lang === 'en' ? sys.replace('只输出一个合法 JSON 对象/数组，不要输出任何解释、注释或 Markdown 围栏。', 'Output ONLY one valid JSON object/array. No explanation, no comments, no code fences.') : sys });
  messages.push({ role: 'user', content: user });
  for (let attempt = 0; attempt < 2; attempt++) {
    const { content } = await LB.chatOnce({ messages, model, max_tokens: max_tokens || 3072, temperature: temperature === undefined ? 0.2 : temperature });
    const j = LB.parseJSON(content);
    if (j) return j;
    messages.push({ role: 'assistant', content: content || '(empty)' });
    messages.push({ role: 'user', content: LB.lang === 'en' ? 'That was not valid JSON. Reply with the JSON only.' : '上面的输出不是合法 JSON，请只输出 JSON。' });
  }
  throw new Error(LB.lang === 'en' ? 'Model did not return valid JSON' : '模型没有返回合法 JSON');
};

LB.streamChat = async function ({ messages, model, max_tokens, temperature, onDelta, onThinking, signal }) {
  if (!store.config || !store.config.hasKey) throw new Error(LB.t('no_key'));
  const r = await fetch(BASE + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model: model || store.config.textModel, stream: true, max_tokens: max_tokens || 3000, temperature: temperature === undefined ? 0.4 : temperature }),
    signal,
  });
  if (!r.ok) {
    let msg = 'HTTP ' + r.status;
    try { const j = await r.json(); msg = j.error || msg; } catch (_) {}
    throw new Error(msg);
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      let j;
      try { j = JSON.parse(line.slice(5).trim()); } catch (_) { continue; }
      if (j.delta && onDelta) onDelta(j.delta);
      if (j.thinking && onThinking) onThinking(j.thinking);
      if (j.error) throw new Error(j.error);
      if (j.done) return j;
    }
  }
  return { done: true };
};

/* ---------------- theme & language ---------------- */
LB.theme = localStorage.getItem('lb.theme') || 'light';
LB.applyTheme = function () {
  document.documentElement.setAttribute('data-theme', LB.theme);
  const b = document.getElementById('btnTheme');
  if (b) b.textContent = LB.theme === 'dark' ? '☀' : '◐';
};
LB.toggleTheme = function () {
  LB.theme = LB.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('lb.theme', LB.theme);
  LB.applyTheme();
};
LB.applyLang = function () {
  document.documentElement.lang = LB.lang === 'en' ? 'en' : 'zh-CN';
  const lb = document.getElementById('langLabel');
  if (lb) lb.textContent = LB.lang === 'en' ? 'EN' : '中';
  const inp = document.getElementById('globalSearch');
  if (inp) inp.placeholder = LB.t('search_ph');
  U.$$('[data-i18n]').forEach((n) => { n.textContent = LB.t(n.dataset.i18n); });
  U.$$('[data-i18n-ph]').forEach((n) => { n.placeholder = LB.t(n.dataset.i18nPh); });
  bus.emit('lang');
};
LB.setLang = function (lang) {
  LB.lang = lang;
  localStorage.setItem('lb.lang', lang);
  LB.applyLang();
};

/* convenience: tooltip text = t(key) */
LB.tt = (key) => ({ title: LB.t(key) });

LB.applyTheme();
LB.applyLang();

/* ready promise: app.js waits for it */
LB.ready = (async () => {
  try { await store.load(); }
  catch (e) { console.error(e); toast('bootstrap failed: ' + e.message, 'error', 9000); }
  bus.emit('ready');
})();
