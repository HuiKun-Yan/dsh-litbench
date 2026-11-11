// test-plugin.cjs — 用本地 HTTP 顶替 DSH 宿主，验证插件挂载与子路径剥离。
// 用法：node tools/test-plugin.cjs   （然后浏览器打开 http://127.0.0.1:8799/dsh-litbench/）
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');

process.env.LITBENCH_DATA =
  process.env.LITBENCH_DATA || path.join(os.homedir(), '.litbench-test');

const impl = require('../plugin/server.cjs');
impl.setBase('/dsh-litbench');
impl.ensure();

const PORT = Number(process.env.PORT || 8799);
http
  .createServer((req, res) => impl.handle(req, res))
  .listen(PORT, '127.0.0.1', () => {
    const p = impl.paths();
    console.log(`[test-host] http://127.0.0.1:${PORT}/dsh-litbench/  data=${p.DATA}`);
  });
