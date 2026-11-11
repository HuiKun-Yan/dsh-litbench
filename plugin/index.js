/**
 * dsh-litbench — Literature workbench as a DSH plugin.
 *
 * Mounts the LitBench server (zero-dependency CommonJS, reused verbatim from
 * the standalone build) under the web server prefix /dsh-litbench, and the
 * browser half adds a header button that opens the workbench full screen.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);

export const name = 'dsh-litbench';
export const inject = ['webServer'];

export const ROUTE = '/dsh-litbench';

export function apply(ctx, config = {}) {
  // 数据目录优先级：plugin 配置 > 指针文件 > 环境变量 > 默认(~/.dsh/litbench)
  // 只有显式配置 dataDir 时才覆盖，否则保留用户在设置面板里选的目录。
  if (config.dataDir) {
    const dataDir = path.resolve(config.dataDir);
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {
      console.error('[litbench] cannot create data dir', dataDir, e && e.message);
    }
    process.env.LITBENCH_DATA = dataDir;
  }
  if (config.keyFile) process.env.LITBENCH_KEY_FILE = String(config.keyFile);

  const impl = require('./server.cjs');
  impl.setBase(ROUTE);
  impl.ensure();

  const webServer = ctx.webServer ?? (typeof ctx.get === 'function' ? ctx.get('webServer') : undefined);
  if (!webServer) {
    console.error('[litbench] webServer service unavailable — workbench not mounted');
    return;
  }

  ctx.effect(
    () =>
      webServer.register({
        kind: 'prefix',
        path: ROUTE,
        handler: (req, res) => impl.handle(req, res),
      }),
    'litbench: http routes'
  );

  const p = impl.paths();
  console.log(`[litbench] mounted ${ROUTE}  data=${p.DATA}  key=${fs.existsSync(p.KEYFILE) ? 'yes' : 'NO'}`);
}
