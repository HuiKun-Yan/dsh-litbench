/**
 * 把 public/ 真实拷贝进 plugin/public/，供发布/打包时使用。
 * 本地开发时 plugin/public 是指向 ../public 的 junction，可跳过；发布前必须跑一次，
 * 否则 tar/zip 里会带一个不可移植的链接。
 *
 *   node tools/sync-plugin-public.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public');
const DST = path.join(ROOT, 'plugin', 'public');

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) n += copyDir(s, d);
    else if (ent.isFile()) {
      fs.copyFileSync(s, d);
      n++;
    }
  }
  return n;
}

// 如果 DST 是链接（junction / symlink），先删链接本身，绝不能递归删内容
let st = null;
try {
  st = fs.lstatSync(DST);
} catch (_) {}

if (st) {
  if (st.isSymbolicLink()) {
    fs.unlinkSync(DST);
    console.log('unlinked junction', DST);
  } else {
    fs.rmSync(DST, { recursive: true, force: true });
  }
}

const n = copyDir(SRC, DST);
console.log(`copied ${n} files -> ${path.relative(ROOT, DST)}`);
