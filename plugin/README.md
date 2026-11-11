# dsh-litbench

LitBench 的 [DeepSeek Harness](https://github.com/deepseek-ai) 插件封装：一个文献阅读分析工作台，
以左侧栏入口 + 全屏面板的形式随宿主 Web GUI 运行，复用宿主的 HTTP 服务与鉴权，数据全部留在本机。

## 功能

- **文献库**：上传 PDF、维护元数据（标题/作者/年/标签/集合），正文与支撑材料按 `parentId`
  归到同一张卡片下折叠显示。
- **阅读器**：PDF 逐页渲染，按页/按节检索，英译中，图表解读，跨文档综合。
- **论证结构树**：把一篇文献的论点、论据、反驳抽成可折叠的树。
- **速览与对话**：右侧栏显示当前页速览和针对文献的对话；右侧栏可折叠、可拖拽调宽。
- **面板布局**：文献库、目录、右侧栏都能收起（边缘把手）或拖宽，宽度按面板记在 localStorage。

## 安装

已上架插件市场后：

```bash
dsh plugin add dsh-litbench
```

或在宿主 GUI 的插件市场里搜索「LitBench」安装，随后重启宿主。

开发期（本机源码）可以不走 npm，直接把 `plugin/` 链进 profile 的 node_modules：

```powershell
cmd /c mklink /J "<DSH_HOME>\profiles\desktop\node_modules\dsh-litbench" "<repo>\plugin"
```

```jsonc
// profile 的 package.json
"dependencies": { "dsh-litbench": "link:<repo>/plugin" },
"dsh": { "profile": { "bundles": [ ..., "dsh-litbench" ] } }
```

重启宿主后，左侧栏出现「文献工作台」入口。

## 结构

```
plugin/
├─ package.json        插件元数据（dsh.bundle.patch / dsh.client / exports）
├─ cordis.patch.yml    profile 补丁：insert id/name
├─ index.js            服务端：webServer.register({kind:'prefix', path:'/dsh-litbench'})
├─ server.cjs          由 ../server.js 生成（剥前缀、导出 handle）—— 不要手改
├─ client.js           浏览器侧：ModuleLoader bundle，注册侧栏入口 + main 面板
└─ public/             前端静态资源（发布时由 ../public/ 真实拷贝；开发期是 junction）
```

## 构建

```bash
npm run build:plugin
# = node tools/make-plugin-server.mjs   # ../server.js -> server.cjs
#   node tools/sync-plugin-public.mjs   # ../public -> plugin/public（把 junction 换成真实拷贝）
```

`server.cjs` 与 `public/` 都是产物，已在 `.gitignore` 里排除；发布 tarball 前务必先跑一次构建，
否则包里会带一个指向本机的 junction（npm 会直接忽略软链接目录）。

## 配置

| 配置项 | 说明 |
| --- | --- |
| `dataDir` | 数据目录。不填则用 `LITBENCH_DATA` 环境变量、`~/.litbench/home.json` 指针，最后回落到 `~/.dsh/litbench` |
| `keyFile` | API Key 文件路径 |

也可以完全不管这些，在界面里 **设置 → 文献存储目录** 改，写入的指针文件对插件同样生效。

## 验证

```bash
curl http://127.0.0.1:<GUI_PORT>/dsh-litbench/api/bootstrap     # {"ok":true,...}
curl http://127.0.0.1:<GUI_PORT>/plugins/events                 # SSE 首帧 graph 里应有 dsh-litbench
```

客户端 bundle 的真实 URL 是 `/plugins/??dsh-litbench/client.js&rev=<hash>`，
`/plugins/<id>/client.js` 会 404，这是宿主的约定。

## 调试

```bash
node tools/test-index.mjs    # 用 stub ctx 跑一遍 apply()，检查注册与路由
node tools/test-plugin.cjs   # 假宿主（8799）验证 handle 与前缀剥离
```
