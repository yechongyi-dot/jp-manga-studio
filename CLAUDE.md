# JP Manga Studio — 项目向导（给 Claude / 未来会话）

日本股短视频自动制作台。本机 Windows 工具：Express 服务器跑 UI，调 Remotion 渲染竖屏 MP4（1080×1920）。

## 跑起来

```bash
npm run server      # 主程序，端口 3020（启动时自动按需构建编辑器）
npm run editor:build  # 手动重建编辑器产物（一般不用，server 启动会自动判断）
npm run dev         # 可选：Remotion Studio（端口 3021，仅调试 composition 用）
```

`.env` 存 `DEEPSEEK_KEY`（已 gitignore）。

## 架构总览

```
public/index.html  ──vanilla JS UI（左栏控制 + 右栏编辑器）
   │  POST /api/generate (手动) | /api/ai/generate (AI)
   ▼
jp-server.js (3020)  ──spawn──►  scripts/jp-generate.js
                                     │  选股/组稿 → TTS → renderMedia
                                     ▼
                          src/compositions/AiVideo.tsx  ← 唯一渲染入口
                                     │  按 structure 派发
                            ┌────────┴────────┐
                   JpStandardVideo        pro/JpNisaVideo
                   (standard 排行)         (portfolio NISA)
```

**关键不变量：`AiVideo` 是唯一渲染 composition**。手动和 AI 两条路都走它，靠 props 区分：
- `structure`: `'standard'`（排行）| `'portfolio'`（NISA 组合）
- `stockSceneId`: 股票卡片样式组件（JpStockScene / AiRankCard / AiDeepCard / …）
- `themeId`: 6 套配色主题（见 `src/compositions/pro/jpTheme.ts`）
- `bg`: `{type:'procedural',id}` 或 `{type:'image',top,scroll,...}`
- `fontConfig?`: 字体覆盖（见下）

## 三轴正交模型（AI 路径）

题材(数据源) × 口吻(persona) × 皮肤(配色)，配置在 `config/{themes,tones,skins,formats}.json`，
矩阵合法性在 `scripts/ai/layers.js`。皮肤→主题映射在 `config/skins.json`。
布局(format)由题材自带，不是用户轴。历史设计见 `docs/PLAN-ai-pipeline.md`。

## 自定义编辑器（src/editor/）

基于 `@remotion/player` 的所见即所得编辑器，替代了旧的 Remotion Studio iframe。

- `main.tsx` → 挂载到 index.html 的 `#editorRoot`
- `EditorPlayer.tsx` → `<Player>` 包 AiVideo + 右侧 `EditorPanel`，持有 `AiVideoProps` state
- `EditorPanel.tsx` → 属性面板：场景风格 / 文案 / 旁白 / 股票数据 / 时间轴 / 字体 / 模板
- `EditorBridge.ts` → `window.__JP_EDITOR` 桥，vanilla JS 调它实时改 props（皮肤/背景下拉等）
- Vite 打包 → `public/editor-dist/editor.js`（gitignore，server 启动 `ensureEditorBuilt()` 按需构建）

**改了 src/editor 或 src/compositions 后**：server 重启会自动重建；或手动 `npm run editor:build`。

## 字体覆盖（零侵入方案）

13 个 pro composition 各自定义 `const FONT/MONO`，内联用在每个元素上。
字体编辑**不改这些文件**，而是 AiVideo 渲染一个 `<style>` 用属性选择器覆盖：
```css
[style*="Noto Sans JP"]{font-family:<用户字体> !important}
```
内联样式（无 !important）会被带 !important 的作者样式压过，且只命中含 "Noto Sans JP"
的 sans 元素，不动 "Roboto Mono" 数字。预览和真实出片都生效（同由 AiVideo 渲染）。

## 模板与「编辑→出片」闭环

- 模板 = 完整 `AiVideoProps`（含旁白），存 `config/templates/*.json`，API 在 jp-server.js（`/api/templates` CRUD）
- 编辑器「生成视频」(`window.generateFromEditor`) 把内容当 `manualScript` 送 `/api/generate`，复用手动管线做 TTS+渲染
- **产出物都在 `OUT_DIR`（运行时可经 `/api/output-dir` 切换的输出目录）**：MP4 + `jp_publish_*.html`（发布素材：YT 标题/简介/标签 + 日文配音稿 + 中文翻译）。编辑器生成完一条会调 `generatePublishDoc()` 生成/更新 HTML，与正常批量流程一致——视频和交付素材一起出、同目录

**生成对 manualScript 的硬要求**（jp-generate.js）：必须有 `script.introTts`，每只股票要有 `ttsText`，否则子进程报错退出。编辑器旁白字段就是喂这些的。

## 注意事项

- 别轻改手动生成路径（jp-generate.js 的 manual 分支 / jp-parser.js / `/api/parse-scripts`）
- `npx tsc --noEmit` 有几个**改动前就存在**的非致命错误（`folderName` 是 Remotion 运行时特性 TS 不认；NisaVideo 隐式 any）。新代码不应引入新错误
- 渲染管线（@remotion/renderer + bundler）与编辑器 Player 完全独立，互不影响
- Windows：server 启动会清理上次残留的 headless Chrome / jp-generate 僵尸进程

## 分发包构建

```bash
powershell -ExecutionPolicy Bypass -File build-portable.ps1
```
产出 `dist/jp-manga-studio-portable.zip`，包含便携 Node/Python/FFmpeg/Git + 完整代码。

## 自动更新机制

应用内更新系统基于 `git fetch origin` + `git log HEAD..origin/master` 检测更新，
`git fetch origin master` + `git reset --hard origin/master` 应用更新（通过 启动.bat 的 exit code 123 循环重启）。

**重要**：仓库的 `master` 分支是唯一更新来源。发布新版本时，提交到 master 并 push 即可。
安装方式支持：
1. 在线安装：`install.bat` → 自举下载 `install.ps1` → `git clone` 到目标目录
2. 离线包：解压 `jp-manga-studio-portable.zip` → 双击 `启动.bat`
