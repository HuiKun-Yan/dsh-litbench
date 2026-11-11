// test-index.mjs — 用桩宿主验证 plugin/index.js：路由注册、前缀剥离、静态资源与 API。
// 用法：node tools/test-index.mjs
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'litbench-ix-'));
process.env.LITBENCH_DATA = DATA;
delete process.env.LITBENCH_KEY_FILE;

const mod = await import(new URL('../plugin/index.js', import.meta.url).href);

const registered = [];
const ctx = {
  webServer: {
    register(opts) {
      registered.push(opts);
      return () => {};
    },
  },
  effect(fn) {
    const d = fn();
    return () => d && d();
  },
};

mod.apply(ctx, {});

const route = registered[0];
console.log('name=' + mod.name, 'inject=' + JSON.stringify(mod.inject));
console.log('registered=' + registered.length, 'kind=' + route.kind, 'path=' + route.path);

const PORT = Number(process.env.TEST_PORT || 8801);
const srv = http.createServer((req, res) => route.handler(req, res));
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));

const get = (pathname) =>
  new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port: PORT, path: pathname }, (res) => {
        let n = 0;
        res.on('data', (c) => (n += c.length));
        res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], bytes: n }));
      })
      .on('error', reject);
  });

let ok = true;
for (const p of [
  '/dsh-litbench/',
  '/dsh-litbench/api/bootstrap',
  '/dsh-litbench/api/health',
  '/dsh-litbench/js/core.js',
  '/dsh-litbench/app.css',
]) {
  const r = await get(p);
  const isJson = /json/.test(r.type || '');
  const good = p.endsWith('/api/health') ? r.status === 200 && isJson : r.status === 200 && r.bytes > 100;
  if (!good) ok = false;
  console.log((good ? 'ok   ' : 'FAIL ') + p, JSON.stringify(r));
}

console.log('dataDir created:', fs.existsSync(DATA));
srv.close();
fs.rmSync(DATA, { recursive: true, force: true });
console.log(ok ? '\nALL PASS' : '\nSOME FAILED');
process.exit(ok ? 0 : 1);
