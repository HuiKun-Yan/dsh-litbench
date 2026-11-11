// make-plugin-server.mjs — 从 server.js 生成 plugin/server.cjs
// 差异只有四点：数据目录默认值、权限剥离、模块化导出。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'server.js');
const DST = path.join(ROOT, 'plugin', 'server.cjs');

let s = fs.readFileSync(SRC, 'utf8');
const must = (from, to) => {
  if (!s.includes(from)) throw new Error('anchor missing: ' + JSON.stringify(from.slice(0, 70)));
  s = s.split(from).join(to);
};

// 1. 数据目录默认放到用户目录（插件里由宿主/环境变量接管）
must(
  "const DEFAULT_DATA = process.env.LITBENCH_DEFAULT_DATA || path.join(ROOT, 'data');",
  "const DEFAULT_DATA = process.env.LITBENCH_DEFAULT_DATA || path.join(os.homedir(), '.litbench');"
);

// 2. HTTP 服务改成可被宿主调用的 handle(req,res)
must('const server = http.createServer(async (req, res) => {', 'async function handle(req, res) {');
must(
  '  const p = url.pathname;\n',
  "  let p = url.pathname;\n  if (BASE && (p === BASE || p.startsWith(BASE + '/'))) p = p.slice(BASE.length) || '/';\n"
);

// 3. 尾部 listen 换成模块导出
const tail = s.match(/\n\}\);\n\nserver\.listen\([^\n]*\n[^\n]*\n\}\);\n?$/);
if (!tail) throw new Error('tail not found');
s =
  s.slice(0, tail.index) +
  `
}

let BASE = '';
function setBase(b) { BASE = String(b || '').replace(/\\/+$/, ''); }

function ensure() {
  try { if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true }); } catch (_) {}
}

module.exports = { handle, setBase, ensure, useDataDir, paths: () => ({ ROOT, PUB, DATA, KEYFILE, HOMEFILE }) };
`;

fs.writeFileSync(DST, s);
console.log('wrote', DST, s.length, 'bytes');
