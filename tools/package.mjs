/**
 * 打一个可以直接发布的干净包：dist/litbench-<version>.zip
 *
 *   node tools/package.mjs
 *
 * 只包含源码与静态资源：排除 data/、node_modules/、日志、开发截图。
 * plugin/public 在包内是真实拷贝（本地开发时它是 junction）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const NAME = `litbench-${pkg.version}`;
const DIST = path.join(ROOT, 'dist');
const STAGE = path.join(DIST, NAME);
const ZIP = path.join(DIST, `${NAME}.zip`);

const SKIP_DIRS = new Set(['node_modules', 'data', 'dist', '.git']);
const SKIP_FILES = /\.(log|bak)$|^shot-.*\.png$/i;

function copyTree(src, dst, skip = null) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip && skip.has(ent.name)) continue;
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    // junction / symlink：取真实目标再决定，绝不按文件复制
    if (ent.isSymbolicLink()) {
      const real = fs.realpathSync(s);
      if (fs.statSync(real).isDirectory()) copyTree(real, d);
      else fs.copyFileSync(real, d);
      continue;
    }
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      copyTree(s, d);
    } else {
      if (SKIP_FILES.test(ent.name)) continue;
      fs.copyFileSync(s, d);
    }
  }
}

fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });

for (const f of ['README.md', 'LICENSE', '.gitignore', 'package.json', 'server.js', 'start.bat']) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(STAGE, f));
}

copyTree(path.join(ROOT, 'public'), path.join(STAGE, 'public'));
copyTree(path.join(ROOT, 'docs'), path.join(STAGE, 'docs'));
copyTree(path.join(ROOT, 'plugin'), path.join(STAGE, 'plugin'), new Set(['public']));

// plugin/public：发布包内必须是真实文件
copyTree(path.join(ROOT, 'public'), path.join(STAGE, 'plugin', 'public'));

// tools/：只带脚本
fs.mkdirSync(path.join(STAGE, 'tools'), { recursive: true });
for (const ent of fs.readdirSync(path.join(ROOT, 'tools'), { withFileTypes: true })) {
  if (!ent.isFile()) continue;
  if (!/\.(mjs|cjs|js)$/i.test(ent.name)) continue;
  fs.copyFileSync(path.join(ROOT, 'tools', ent.name), path.join(STAGE, 'tools', ent.name));
}

fs.rmSync(ZIP, { force: true });
const RAW = ZIP + '.raw.zip';
fs.rmSync(RAW, { force: true });
execFileSync(
  'powershell.exe',
  ['-NoProfile', '-Command', `Compress-Archive -Path '${STAGE}' -DestinationPath '${RAW}' -CompressionLevel Optimal`],
  { stdio: 'inherit' }
);

// Windows PowerShell 的 Compress-Archive 用反斜杠做条目分隔符，在 Linux/macOS 解压会坏。
// 再走一遍重写：条目名统一成正斜杠、去掉目录条目，得到标准 zip。
const FIX = path.join(DIST, '_zipfix.ps1');
fs.writeFileSync(FIX, [
  'param([string]$Src,[string]$Dst)',
  'Add-Type -AssemblyName System.IO.Compression.FileSystem',
  '$zin=[System.IO.Compression.ZipFile]::OpenRead($Src)',
  'try {',
  '  $fs=[System.IO.File]::Open($Dst,\'CreateNew\')',
  '  try {',
  '    $zout=New-Object System.IO.Compression.ZipArchive($fs,[System.IO.Compression.ZipArchiveMode]::Create,$false)',
  '    try {',
  '      foreach ($e in $zin.Entries) {',
  "        if ($e.Name -eq '') { continue }",
  "        $name=$e.FullName.Replace('\\','/')",
  '        $ne=$zout.CreateEntry($name,[System.IO.Compression.CompressionLevel]::Optimal)',
  '        $ne.LastWriteTime=$e.LastWriteTime',
  '        $os=$ne.Open()',
  '        try { $is=$e.Open(); try { $is.CopyTo($os) } finally { $is.Dispose() } } finally { $os.Dispose() }',
  '      }',
  '    } finally { $zout.Dispose() }',
  '  } finally { $fs.Dispose() }',
  '} finally { $zin.Dispose() }',
].join('\n'), 'utf8');
execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', FIX, RAW, ZIP], { stdio: 'inherit' });
fs.rmSync(FIX, { force: true });
fs.rmSync(RAW, { force: true });

const size = (fs.statSync(ZIP).size / 1024 / 1024).toFixed(1);
let count = 0;
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(d, e.name));
    else count++;
  }
})(STAGE);

console.log(`\n${path.relative(ROOT, ZIP)}  ${size} MB  ${count} files`);
