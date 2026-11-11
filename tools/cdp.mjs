// cdp.mjs — 用 Chrome DevTools Protocol 打开页面，收集控制台/异常，截图
// 用法: node tools/cdp.mjs <url> <outPng> [waitMs] [evalExprFile]
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const url = process.argv[2] || 'http://127.0.0.1:8788/';
const out = process.argv[3] || 'tools/shot.png';
const waitMs = Number(process.argv[4] || 9000);
const evalFile = process.argv[5] || '';
const port = 9400 + Math.floor(Math.random() * 300);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--window-size=1500,950', `--remote-debugging-port=${port}`,
  '--user-data-dir=C:\\Windows\\Temp\\cr-cdp-' + port, 'about:blank'
], { stdio: 'ignore' });

let ws;
for (let i = 0; i < 40; i++) {
  await sleep(250);
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
  } catch { /* not ready */ }
}
if (!ws) { console.error('no devtools'); proc.kill(); process.exit(1); }
await new Promise((r) => { ws.onopen = r; });

let id = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    logs.push('EXCEPTION: ' + (d.exception?.description || d.text) + ' @' + (d.url || '') + ':' + (d.lineNumber + 1));
  } else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    logs.push('CONSOLE.' + m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
  } else if (m.method === 'Log.entryAdded') {
    const e = m.params.entry;
    if (e.level === 'error' || e.level === 'warning') logs.push('LOG.' + e.level + ': ' + e.text + (e.url ? ' ' + e.url : ''));
  }
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Network.enable');
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Network.responseReceived' && /\/api\/pdf\//.test(m.params.response.url)) {
    const r = m.params.response;
    logs.push('NET ' + r.status + ' ' + r.statusText + ' len=' + (r.headers['content-length'] || r.headers['Content-Length'] || '?') + ' ' + r.url.slice(-40));
  }
  if (m.method === 'Network.loadingFailed') {
    logs.push('NETFAIL ' + m.params.errorText + ' ' + (m.params.blockedReason || ''));
  }
});
await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(waitMs);

if (evalFile) {
  const expr = fs.readFileSync(evalFile, 'utf8');
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  const rr = r.result || {};
  if (rr.exceptionDetails) {
    console.log('EVAL EXC:', JSON.stringify(rr.exceptionDetails).slice(0, 1200));
  } else {
    console.log('EVAL:', JSON.stringify(rr.result ? rr.result.value : undefined, null, 1).slice(0, 6000));
  }
}
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('LOGS(' + logs.length + '):');
logs.slice(0, 40).forEach((l) => console.log(' ' + l.slice(0, 400)));
ws.close();
proc.kill();
process.exit(0);
