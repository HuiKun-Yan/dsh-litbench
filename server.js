#!/usr/bin/env node
/* 文献工作台 LitBench — zero-dependency local server */
'use strict';

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const os = require('os');

const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 8788);

/* ---- 数据目录：环境变量 > 指针文件 > 默认（随安装位置） ---- */
const DEFAULT_DATA = process.env.LITBENCH_DEFAULT_DATA || path.join(ROOT, 'data');
const HOMEFILE = process.env.LITBENCH_HOME_FILE || path.join(os.homedir(), '.litbench', 'home.json');
const KEYFILE = process.env.LITBENCH_KEY_FILE || path.join(os.homedir(), '.litbench', 'key.txt');

let DATA = '';
let PDFS = '';
let THUMBS = '';
let STATES = '';
let TEXTS = '';
let LIBFILE = '';
let CFGFILE = '';

function readHome() {
  try {
    const o = JSON.parse(fs.readFileSync(HOMEFILE, 'utf8'));
    return o && typeof o.dir === 'string' ? o.dir : '';
  } catch (_) { return ''; }
}
function writeHome(dir) {
  try {
    fs.mkdirSync(path.dirname(HOMEFILE), { recursive: true });
    fs.writeFileSync(HOMEFILE, JSON.stringify({ dir, updatedAt: new Date().toISOString() }, null, 2));
  } catch (_) {}
}
function useDataDir(dir) {
  DATA = path.resolve(String(dir));
  PDFS = path.join(DATA, 'pdfs');
  THUMBS = path.join(DATA, 'thumbs');
  STATES = path.join(DATA, 'papers');
  TEXTS = path.join(DATA, 'texts');
  LIBFILE = path.join(DATA, 'library.json');
  CFGFILE = path.join(DATA, 'config.json');
  for (const d of [DATA, PDFS, THUMBS, STATES, TEXTS]) fs.mkdirSync(d, { recursive: true });
}
useDataDir(process.env.LITBENCH_DATA || readHome() || DEFAULT_DATA);

function copyDir(src, dst) {
  let n = 0;
  const walk = (a, b) => {
    fs.mkdirSync(b, { recursive: true });
    for (const e of fs.readdirSync(a, { withFileTypes: true })) {
      const sa = path.join(a, e.name);
      const sb = path.join(b, e.name);
      if (e.isDirectory()) walk(sa, sb);
      else { fs.copyFileSync(sa, sb); n++; }
    }
  };
  try { walk(src, dst); } catch (_) {}
  return n;
}

/* ---- 自动继承 DSH 当前使用的模型：provider / baseURL / key / 模型列表 ----
 * 读 $DSH_HOME（默认 ~/.dsh）里 profile 的 cordis.patch.yml：
 *   - name: "@deepseek-ai/dsh-llm-pi-ai" 那一条的 providers
 *   - name: "@deepseek-ai/dsh-agent-default-model" 的 provider/model 为首选模型
 * 以及 .credentials.yaml 的 refs（apiKeyEnv → 真实 key）。
 * 全部失败就返回空对象，调用方回落到通用默认值。 */
function readIf(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; }
}

// DSH 的模型配置里没有 vision 标记，用名字猜：deepseek-v*/chat/reasoner 视为纯文本
function visionGuess(id) {
  return !/deepseek-(v\d|chat|reasoner|coder)/i.test(String(id));
}

function detectDsh() {
  const out = { baseURL: '', apiKey: '', models: [], defaultModel: '', defaultProvider: '', source: '' };
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  const profiles = path.join(home, 'profiles');

  // 优先 desktop profile，其余按目录名
  const dirs = ['desktop'];
  try {
    for (const d of fs.readdirSync(profiles)) if (!dirs.includes(d)) dirs.push(d);
  } catch (_) {}

  let txt = '';
  for (const d of dirs) {
    const t = readIf(path.join(profiles, d, 'cordis.patch.yml'));
    if (t.includes('dsh-llm-pi-ai')) {
      txt = t;
      out.source = path.join(profiles, d, 'cordis.patch.yml');
      break;
    }
  }
  if (!txt) return out;

  const lines = txt.split(/\r?\n/);
  const entry = (name) => {
    const start = lines.findIndex((l) => new RegExp('^\\s*name:\\s*"?@deepseek-ai/' + name + '"?\\s*$').test(l));
    if (start < 0) return [];
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) if (/^-\s/.test(lines[i])) { end = i; break; }
    return lines.slice(start, end);
  };

  const llm = entry('dsh-llm-pi-ai');
  for (const l of llm) {
    let m;
    if (!out.baseURL && (m = /^\s*baseURL:\s*(\S+)\s*$/.exec(l))) out.baseURL = m[1];
    if (!out.apiKeyEnv && (m = /^\s*apiKeyEnv:\s*(\S+)\s*$/.exec(l))) out.apiKeyEnv = m[1];
    if (!out.apiKey && (m = /^\s*apiKey:\s*(\S{8,})\s*$/.exec(l))) out.apiKey = m[1];
  }

  // 模型列表：从 models: 之后收集 "- id: xxx" + 紧随的 "name: yyy"
  const mi = llm.findIndex((l) => /^\s*models:\s*$/.test(l));
  if (mi >= 0) {
    for (let i = mi + 1; i < llm.length; i++) {
      const l = llm[i];
      const idm = /^\s*-\s*id:\s*(\S+)\s*$/.exec(l);
      if (idm) {
        out.models.push({ id: idm[1], label: idm[1], vision: visionGuess(idm[1]), _label: false });
        continue;
      }
      const nm = /^\s*name:\s*(.+?)\s*$/.exec(l);
      if (nm && out.models.length && !out.models[out.models.length - 1]._label) {
        const last = out.models[out.models.length - 1];
        last.label = nm[1].replace(/^["']|["']$/g, '');
        last._label = true;
        continue;
      }
      if (/^\s*[A-Za-z_]+:\s*\S/.test(l) && out.models.length && /^\s{8}\S/.test(l)) break; // 出 models 段
    }
  }
  out.models = out.models.map(({ _label, ...m }) => m);

  // 首选模型
  const adm = entry('dsh-agent-default-model');
  for (const l of adm) {
    let m;
    if (!out.defaultProvider && (m = /^\s*provider:\s*(\S+)\s*$/.exec(l))) out.defaultProvider = m[1];
    if (!out.defaultModel && (m = /^\s*model:\s*(\S+)\s*$/.exec(l))) out.defaultModel = m[1];
  }

  // key：env 优先，其次 .credentials.yaml 的 refs
  if (!out.apiKey && out.apiKeyEnv && process.env[out.apiKeyEnv]) out.apiKey = process.env[out.apiKeyEnv];
  if (!out.apiKey) {
    const cred = readIf(path.join(home, '.credentials.yaml'));
    const ri = cred.split(/\r?\n/).findIndex((l) => /^refs:\s*$/.test(l));
    if (ri >= 0) {
      for (let i = ri + 1; i < cred.split(/\r?\n/).length; i++) {
        const l = cred.split(/\r?\n/)[i];
        if (/^\S/.test(l)) break;
        const m = /^\s+([A-Za-z0-9_]+):\s*(\S+)\s*$/.exec(l);
        if (m && m[2].startsWith('sk-')) out.apiKey = m[2];
      }
    }
  }

  return out;
}

const DSH = detectDsh();

const MODELS = (() => {
  const fallback = [
    { id: 'gpt-4o-mini', label: 'GPT-4o mini', vision: true },
    { id: 'gpt-4o', label: 'GPT-4o', vision: true },
    { id: 'deepseek-chat', label: 'DeepSeek Chat', vision: false },
  ];
  // LITBENCH_MODELS='[{"id":"qwen-max","label":"Qwen Max","vision":true}]'
  if (process.env.LITBENCH_MODELS) {
    try {
      const list = JSON.parse(process.env.LITBENCH_MODELS);
      if (Array.isArray(list) && list.length) return list;
    } catch (_) {}
  }
  if (DSH.models.length) return DSH.models;
  return fallback;
})();

const DEFAULTS = {
  baseURL: process.env.LITBENCH_BASE_URL || DSH.baseURL || 'https://api.openai.com/v1',
  textModel: process.env.LITBENCH_TEXT_MODEL || (MODELS.some((m) => m.id === DSH.defaultModel) ? DSH.defaultModel : MODELS[0].id),
  visionModel: process.env.LITBENCH_VISION_MODEL || (MODELS.find((m) => m.vision) || MODELS[0]).id,
  apiKey: process.env.LITBENCH_API_KEY || DSH.apiKey || '',
};

function readKey() {
  try {
    const k = fs.readFileSync(KEYFILE, 'utf8').trim();
    if (k) return k;
  } catch (_) {}
  return process.env.LITBENCH_API_KEY || '';
}

let cfg = { ...DEFAULTS };
try { Object.assign(cfg, JSON.parse(fs.readFileSync(CFGFILE, 'utf8'))); } catch (_) {}
if (!cfg.apiKey) cfg.apiKey = readKey();

function saveCfg() {
  const safe = { ...cfg };
  fs.writeFileSync(CFGFILE, JSON.stringify(safe, null, 2));
}

function reloadCfg() {
  cfg = { ...DEFAULTS };
  try { Object.assign(cfg, JSON.parse(fs.readFileSync(CFGFILE, 'utf8'))); } catch (_) {}
  if (!cfg.apiKey) cfg.apiKey = readKey();
}

function loadLib() {
  try { return JSON.parse(fs.readFileSync(LIBFILE, 'utf8')); }
  catch (_) { return { papers: [], collections: [] }; }
}
let lib = loadLib();
const saveLib = () => fs.writeFileSync(LIBFILE, JSON.stringify(lib, null, 2));

function json(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req, limit = 64 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function safeName(s) {
  return String(s || 'paper.pdf').replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 180);
}

function newId() {
  return 'p-' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

function getPaper(id) { return lib.papers.find((p) => p.id === id); }

function paperPath(id) {
  const p = getPaper(id);
  if (!p) return null;
  return path.join(PDFS, p.file);
}

function deletePaperFiles(id) {
  const p = getPaper(id);
  if (p) { try { fs.unlinkSync(path.join(PDFS, p.file)); } catch (_) {} }
  for (const f of [path.join(THUMBS, id + '.png'), path.join(STATES, id + '.json'), path.join(TEXTS, id + '.json')]) {
    try { fs.unlinkSync(f); } catch (_) {}
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ttc': 'font/ttc',
  '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream',
  '.wasm': 'application/wasm', '.map': 'application/json',
};

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const target = path.normalize(path.join(PUB, rel));
  if (!target.startsWith(PUB)) return json(res, 403, { error: 'forbidden' });
  fs.stat(target, (err, st) => {
    if (err || !st.isFile()) {
      if (req.headers['accept'] && req.headers['accept'].includes('text/html')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(fs.readFileSync(path.join(PUB, 'index.html')));
      }
      return json(res, 404, { error: 'not found' });
    }
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(target).pipe(res);
  });
}

/* ---------------- LLM proxy ---------------- */

async function upstream(messages, { model, stream = false, temperature = 0.3, max_tokens = 4096, images = null }) {
  if (!cfg.apiKey) throw new Error('API key not configured');
  const body = { model: model || cfg.textModel, messages, stream, temperature, max_tokens };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 240000);
  const r = await fetch(cfg.baseURL.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
    body: JSON.stringify(body),
    signal: ctrl.signal,
  }).finally(() => clearTimeout(timer));
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error('upstream ' + r.status + ': ' + text.slice(0, 600));
  }
  return r;
}

function sse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');
  let closed = false;
  return {
    send(obj) { if (!closed) { try { res.write('data: ' + JSON.stringify(obj) + '\n\n'); } catch (_) { closed = true; } } },
    end() { if (!closed) { closed = true; try { res.end(); } catch (_) {} } },
    get closed() { return closed || res.writableEnded; },
  };
}

async function chatStream(req, res, payload) {
  const out = sse(res);
  req.on('close', () => out.end());
  try {
    const r = await upstream(payload.messages, { ...payload, stream: true });
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let usage = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line || line.startsWith(':')) continue;
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') { out.send({ done: true, usage }); out.end(); return; }
        try {
          const j = JSON.parse(data);
          const d = j.choices && j.choices[0] && (j.choices[0].delta || j.choices[0].message);
          if (j.usage) usage = j.usage;
          if (d) {
            if (d.reasoning_content) out.send({ thinking: d.reasoning_content });
            if (d.content) out.send({ delta: d.content });
          }
        } catch (_) {}
      }
    }
    out.send({ done: true, usage });
    out.end();
  } catch (e) {
    out.send({ error: String(e.message || e) });
    out.end();
  }
}

async function chatOnce(payload) {
  const r = await upstream(payload.messages, { ...payload, stream: false });
  const j = await r.json();
  const msg = j.choices && j.choices[0] && j.choices[0].message;
  return { content: (msg && msg.content) || '', usage: j.usage || null };
}

/* ---------------- PDF import ---------------- */

function looksLikePdf(buf) {
  return buf.length > 800 && buf.slice(0, 1024).includes(Buffer.from('%PDF'));
}

async function createPaper(buf, fileName) {
  const id = newId();
  const file = id + '.pdf';
  await fsp.writeFile(path.join(PDFS, file), buf);
  const paper = {
    id, file, fileName: safeName(fileName), size: buf.length,
    title: safeName(fileName).replace(/\.pdf$/i, ''), authors: '', year: '', venue: '', doi: '',
    role: 'main', parentId: null, collection: '', tags: [], status: 'unread', pages: 0,
    addedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    progress: { page: 1, updatedAt: null }, hasThumb: false,
  };
  lib.papers.unshift(paper);
  saveLib();
  return paper;
}

async function downloadPdf(url) {
  let u = url.trim();
  const arxiv = u.match(/arxiv\.org\/(?:abs|pdf)\/([\w.\-]+)(?:v\d+)?/i);
  if (arxiv) u = 'https://arxiv.org/pdf/' + arxiv[1];
  const r = await fetch(u, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 LitBench' }, signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('下载失败 HTTP ' + r.status);
  const ct = r.headers.get('content-type') || '';
  const buf = Buffer.from(await r.arrayBuffer());
  if (!looksLikePdf(buf) && !ct.includes('pdf')) throw new Error('该链接不是 PDF（content-type: ' + ct + '）');
  let name = decodeURIComponent((u.split('/').pop() || 'paper.pdf').split('?')[0]);
  if (!/\.pdf$/i.test(name)) name += '.pdf';
  return { buf, name };
}

/* ---------------- search ---------------- */

const textCache = new Map();
function loadText(id) {
  if (textCache.has(id)) return textCache.get(id);
  let pages = null;
  try { pages = JSON.parse(fs.readFileSync(path.join(TEXTS, id + '.json'), 'utf8')).pages; } catch (_) {}
  textCache.set(id, pages);
  return pages;
}

/* ---------------- router ---------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const m = req.method;
  try {
    if (p === '/api/health') return json(res, 200, { ok: true, uptime: process.uptime() });

    if (p === '/api/bootstrap') {
      return json(res, 200, {
        ok: true,
        config: {
          baseURL: cfg.baseURL,
          textModel: cfg.textModel,
          visionModel: cfg.visionModel,
          models: MODELS,
          modelsSource: DSH.source || '',
          inheritedFrom: DSH.source ? 'dsh' : '',
          hasKey: !!cfg.apiKey,
          keyHint: cfg.apiKey ? cfg.apiKey.slice(0, 6) + '…' + cfg.apiKey.slice(-4) : '',
          storage: { dir: DATA, defaultDir: DEFAULT_DATA, homeFile: HOMEFILE },
        },
        library: lib.papers,
        collections: lib.collections,
        version: 1,
      });
    }

    if (p === '/api/config' && m === 'PUT') {
      const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      if (typeof b.baseURL === 'string' && b.baseURL) cfg.baseURL = b.baseURL.trim();
      if (typeof b.textModel === 'string' && b.textModel) cfg.textModel = b.textModel;
      if (typeof b.visionModel === 'string' && b.visionModel) cfg.visionModel = b.visionModel;
      if (typeof b.apiKey === 'string' && b.apiKey.trim()) cfg.apiKey = b.apiKey.trim();
      if (b.reloadKey) cfg.apiKey = readKey();
      saveCfg();
      return json(res, 200, { ok: true, hasKey: !!cfg.apiKey });
    }

    if (p === '/api/storage' && m === 'GET') {
      let files = 0;
      try {
        for (const d of [PDFS, THUMBS, STATES, TEXTS]) files += fs.readdirSync(d).length;
      } catch (_) {}
      return json(res, 200, {
        ok: true,
        dir: DATA,
        defaultDir: DEFAULT_DATA,
        homeFile: HOMEFILE,
        papers: (lib.papers || []).length,
        files,
      });
    }

    if (p === '/api/storage' && m === 'POST') {
      const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const raw = String(b.dir || '').trim();
      if (!raw) return json(res, 400, { ok: false, error: 'dir required' });
      if (!path.isAbsolute(raw) && !/^[A-Za-z]:[\\/]/.test(raw)) {
        return json(res, 400, { ok: false, error: 'absolute path required' });
      }
      const dir = path.resolve(raw);
      if (dir === DATA) return json(res, 200, { ok: true, dir: DATA, unchanged: true });
      try {
        fs.accessSync(path.dirname(dir), fs.constants.W_OK);
        fs.mkdirSync(dir, { recursive: true });
      } catch (e) {
        return json(res, 400, { ok: false, error: 'cannot write: ' + (e.message || e) });
      }
      const migrate = b.migrate !== false;
      let copied = 0;
      if (migrate) copied = copyDir(DATA, dir);
      useDataDir(dir);
      writeHome(dir);
      reloadCfg();
      lib = loadLib();
      return json(res, 200, { ok: true, dir: DATA, papers: (lib.papers || []).length, copied, migrated: migrate });
    }

    if (p === '/api/upload' && m === 'POST') {
      const buf = await readBody(req);
      if (!looksLikePdf(buf)) return json(res, 400, { error: '不是有效的 PDF 文件' });
      const name = decodeURIComponent(req.headers['x-filename'] || 'paper.pdf');
      const paper = await createPaper(buf, name);
      return json(res, 200, { ok: true, paper });
    }

    if (p === '/api/import' && m === 'POST') {
      const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      if (!b.url) return json(res, 400, { error: '缺少链接' });
      const { buf, name } = await downloadPdf(b.url);
      const paper = await createPaper(buf, name);
      return json(res, 200, { ok: true, paper });
    }

    if (p.startsWith('/api/pdf/')) {
      const id = decodeURIComponent(p.slice('/api/pdf/'.length));
      const file = paperPath(id);
      if (!file || !fs.existsSync(file)) return json(res, 404, { error: 'missing pdf' });
      const st = fs.statSync(file);
      const paper = getPaper(id) || {};
      const dl = url.searchParams.get('dl') === '1';
      // 注意：浏览器若装了 IDM 等下载扩展，Content-Type: application/pdf 的 GET 会被扩展
      // 截成 204（"Intercepted by the IDM Advanced Integration"），pdf.js 就打不开 PDF。
      // 所以阅读器取流走 octet-stream；要下载时显式加 ?dl=1 才给 application/pdf。
      const headers = {
        'Content-Type': dl ? 'application/pdf' : 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      };
      if (dl) {
        headers['Content-Disposition'] = "attachment; filename*=UTF-8''" + encodeURIComponent(paper.fileName || (id + '.pdf'));
      }
      const rng = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range).trim());
      if (rng) {
        let start = rng[1] === '' ? null : parseInt(rng[1], 10);
        let end = rng[2] === '' ? null : parseInt(rng[2], 10);
        if (start !== null || end !== null) {
          if (start === null) { start = Math.max(0, st.size - (end || 0)); end = st.size - 1; }
          else if (end === null || end >= st.size) { end = st.size - 1; }
          if (start > end || start >= st.size) {
            res.writeHead(416, { 'Content-Range': 'bytes */' + st.size });
            return res.end();
          }
          headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + st.size;
          headers['Content-Length'] = end - start + 1;
          res.writeHead(206, headers);
          return fs.createReadStream(file, { start, end }).pipe(res);
        }
      }
      headers['Content-Length'] = st.size;
      res.writeHead(200, headers);
      return fs.createReadStream(file).pipe(res);
    }

    if (p.startsWith('/api/thumb/')) {
      const id = p.slice('/api/thumb/'.length);
      const f = path.join(THUMBS, id + '.png');
      if (!fs.existsSync(f)) return json(res, 404, { error: 'no thumb' });
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=600' });
      return fs.createReadStream(f).pipe(res);
    }

    if (p.startsWith('/api/papers/')) {
      const rest = p.slice('/api/papers/'.length).split('/');
      const id = rest[0];
      const action = rest[1] || '';
      const paper = getPaper(id);
      if (!paper) return json(res, 404, { error: 'paper not found' });

      if (action === '' && m === 'PATCH') {
        const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
        for (const k of ['title', 'authors', 'year', 'venue', 'doi', 'role', 'parentId', 'collection', 'tags', 'status', 'pages', 'hasThumb']) {
          if (b[k] !== undefined) paper[k] = b[k];
        }
        if (b.progress) paper.progress = { ...paper.progress, ...b.progress };
        paper.updatedAt = new Date().toISOString();
        saveLib();
        return json(res, 200, { ok: true, paper });
      }
      if (action === '' && m === 'DELETE') {
        lib.papers = lib.papers.filter((x) => x.id !== id);
        deletePaperFiles(id);
        saveLib();
        return json(res, 200, { ok: true });
      }
      if (action === 'state') {
        const f = path.join(STATES, id + '.json');
        if (m === 'GET') {
          let st = {};
          try { st = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) {}
          return json(res, 200, { ok: true, state: st });
        }
        if (m === 'PUT') {
          const b = await readBody(req);
          JSON.parse(b.toString('utf8')); // validate
          await fsp.writeFile(f, b);
          return json(res, 200, { ok: true, bytes: b.length });
        }
      }
      if (action === 'text' && m === 'PUT') {
        const b = await readBody(req);
        const j = JSON.parse(b.toString('utf8'));
        await fsp.writeFile(path.join(TEXTS, id + '.json'), JSON.stringify({ pages: j.pages || [] }));
        textCache.set(id, j.pages || []);
        return json(res, 200, { ok: true });
      }
      if (action === 'thumb' && m === 'POST') {
        const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
        const m1 = /^data:image\/png;base64,(.+)$/.exec(b.dataUrl || '');
        if (!m1) return json(res, 400, { error: 'bad image' });
        await fsp.writeFile(path.join(THUMBS, id + '.png'), Buffer.from(m1[1], 'base64'));
        paper.hasThumb = true; paper.updatedAt = new Date().toISOString(); saveLib();
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: 'unknown action' });
    }

    if (p === '/api/collections' && m === 'PUT') {
      const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      lib.collections = Array.isArray(b.collections) ? b.collections : lib.collections;
      saveLib();
      return json(res, 200, { ok: true, collections: lib.collections });
    }

    if (p === '/api/search') {
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      if (!q) return json(res, 200, { ok: true, hits: [] });
      const hits = [];
      for (const paper of lib.papers) {
        const pages = loadText(paper.id);
        if (!pages) continue;
        for (let i = 0; i < pages.length; i++) {
          const txt = pages[i] || '';
          const idx = txt.toLowerCase().indexOf(q);
          if (idx >= 0) {
            const s = Math.max(0, idx - 60);
            hits.push({ id: paper.id, title: paper.title, page: i + 1, snippet: txt.slice(s, s + 190).replace(/\s+/g, ' ') });
            break;
          }
        }
        if (hits.length >= 40) break;
      }
      return json(res, 200, { ok: true, hits });
    }

    if (p === '/api/chat' && m === 'POST') {
      const payload = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      if (!Array.isArray(payload.messages)) return json(res, 400, { error: 'messages required' });
      if (payload.stream === false) {
        const out = await chatOnce(payload);
        return json(res, 200, { ok: true, ...out });
      }
      return chatStream(req, res, payload);
    }

    if (p.startsWith('/api/')) return json(res, 404, { error: 'unknown api' });
    return serveStatic(req, res, p);
  } catch (e) {
    console.error('[err]', p, e && e.message);
    if (!res.headersSent) return json(res, 500, { error: String((e && e.message) || e) });
    try { res.end(); } catch (_) {}
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('[LitBench] http://127.0.0.1:' + PORT + '  papers=' + lib.papers.length + '  key=' + (cfg.apiKey ? 'yes' : 'NO'));
});
