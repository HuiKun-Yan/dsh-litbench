// test-storage.mjs — 存储目录切换 / 迁移自测。
// 自己拉起一个临时 server（临时数据目录 + 随机端口），不碰你正在用的库。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.TEST_PORT || 8811);
const API = `http://127.0.0.1:${PORT}`;
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'litbench-t-'));
const seed = path.join(base, 'seed');
const target = path.join(base, 'moved');

// 造两篇假文献，验证迁移确实带过去
fs.mkdirSync(path.join(seed, 'pdfs'), { recursive: true });
fs.mkdirSync(path.join(seed, 'papers'), { recursive: true });
fs.writeFileSync(path.join(seed, 'pdfs', 'a.pdf'), Buffer.alloc(1024, 1));
fs.writeFileSync(path.join(seed, 'papers', 'a.json'), '{"annos":[]}');
fs.writeFileSync(
  path.join(seed, 'library.json'),
  JSON.stringify({
    papers: [{ id: 'a', title: 'Test A', pages: 1, size: 1024, addedAt: Date.now(), kind: 'paper' }],
    collections: [],
  })
);

const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
  env: { ...process.env, PORT: String(PORT), LITBENCH_DATA: seed, LITBENCH_HOME_FILE: path.join(base, 'home.json') },
  stdio: 'ignore',
});

const j = async (p, opt) => (await fetch(API + p, opt)).json();
const post = (body) =>
  j('/api/storage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

let ok = true;
const check = (label, cond, extra) => {
  console.log((cond ? 'ok   ' : 'FAIL ') + label + (extra ? '  ' + extra : ''));
  if (!cond) ok = false;
};

try {
  for (let i = 0; i < 50; i++) {
    try {
      await j('/api/health');
      break;
    } catch (_) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const before = await j('/api/storage');
  check('初始目录 = seed', path.resolve(before.dir) === path.resolve(seed), before.dir);
  check('初始 1 篇', before.papers === 1, 'papers=' + before.papers);

  const r1 = await post({ dir: target, migrate: true });
  check('切换成功', r1.ok === true, JSON.stringify(r1));
  check('迁移了文件', r1.copied > 0, 'copied=' + r1.copied);
  check('迁移后 1 篇', r1.papers === 1, 'papers=' + r1.papers);
  check('目标目录有 pdf', fs.existsSync(path.join(target, 'pdfs', 'a.pdf')));

  const boot = await j('/api/bootstrap');
  check('bootstrap.storage.dir 同步', path.resolve(boot.config.storage.dir) === path.resolve(target));
  check('bootstrap 仍是 1 篇', (boot.library || []).length === 1);

  const r2 = await post({ dir: seed, migrate: false });
  check('切回成功', r2.ok === true, JSON.stringify(r2));
  const after = await j('/api/storage');
  check('切回后目录正确', path.resolve(after.dir) === path.resolve(seed), after.dir);

  const bad = await post({ dir: 'relative/path' });
  check('相对路径被拒', bad.ok === false, JSON.stringify(bad));
} finally {
  srv.kill();
  fs.rmSync(base, { recursive: true, force: true });
}

console.log(ok ? '\nALL PASS' : '\nSOME FAILED');
process.exit(ok ? 0 : 1);
