// build-reader.mjs — 把 _rA.js / _rB.js / _rC.js 拼成 reader.js，并打三处补丁（幂等）。
// public/js/reader.js 是拼接产物，别手改；改分片后跑 npm run build:reader。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(ROOT, 'public', 'js') + path.sep;
const read = (f) => fs.readFileSync(dir + f, 'utf8');

let a = read('_rA.js');
let b = read('_rB.js');
const c = read('_rC.js');

const patch = (src, from, to, name) => {
  const n = src.split(from).length - 1;
  if (n !== 1) {
    console.log('WARN ' + name + ' hits=' + n);
    return src;
  }
  console.log('ok ' + name);
  return src.split(from).join(to);
};

b = patch(
  b,
  "  panel.innerHTML = '';\n  const fn = LB.panes[k];",
  "  panel.innerHTML = '';\n  panel.style.padding = '';\n  const fn = LB.panes[k];",
  'setTab padding'
);

b = patch(
  b,
  "b.innerHTML = '<span class=\"sec-dot\"></span> ' + esc(s.text || '');",
  "b.innerHTML = '<span class=\"sec-dot\"></span><span class=\"tt\">' + esc(s.text || '') + '</span>';",
  'toc tt span'
);

a = patch(a, "text: '/ ' + doc.num + ' · ' + n }", "text: n + ' / ' + doc.num }", 'page-no');

const out = a + '\n\n' + b + '\n\n' + c;
fs.writeFileSync(dir + 'reader.js', out, 'utf8');
console.log('reader.js bytes=' + Buffer.byteLength(out));
