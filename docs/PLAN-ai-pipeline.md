# JP Manga Studio — AI 自动生成「全新管线」重构方案

> 目标：用**三层正交模型**重写 AI 自动生成；**手动上传文案管线全程零影响**；
> 最终（阶段2）让 AI 与手动**共用同一套格式/口吻/背景**。

## 核心架构（五轴正交）

```
题材(源)   雅虎实时榜单feed(50+种) → 选哪些股+角度 + 【自带布局format,不让用户选,题材层标注】
口吻(persona) 初心者安心/辛口本音/ガチ分析/エンタメ → 只决定文案/配音语气
皮肤(配色)  蓝/橙/薄荷/青/紫/红金(jpTheme) → 配色+卡片+跑马灯+幕布色（与口吻已解耦）
背景       图片库(顶部静态短图+长图上下滚·双文件夹顺序轮选) 或 程序化(跟随皮肤/各色)
(格式)     布局引擎内部概念：结构+卡片组件+股数+需补字段，由题材自带，非用户轴
```
用户选：**题材 × 口吻 × 皮肤 × 背景**（格式题材自带）。任一轴加一项 = 乘法扩展。
矩阵(合法性)= 题材×口吻(格式派生自题材)；皮肤/背景为自由轴。

## 关键设计决策（已与用户敲定）

1. **题材数据源 = 雅虎**（pro 已证 h2 可破其反爬；feed 已实抓成功）
2. **重写**全新 AI 管线，不改旧 `jp-generate.js`（旧的只留给手动；imitate 旧分支退役）
3. **NISA 方案 A**：手动维持 jp 暗色 NISA 不动；AI 用 pro 模板。彻底统一(方案B)留到阶段2
4. **背景**：程序化背景 + 图片统一成**公共背景库**，两管线共用；动效=长图上下滚动；provider 可插拔（现读本地文件夹，将来接动态图库）；**全程有网，不做离线兜底**
5. **统一 Script 契约**当防火墙：AI 与手动都吐同一结构 → 下游格式/口吻/背景自动共用

## 统一 Script 契约（字段即场景·空则跳过）

```
Script = {
  meta:    { themeId, angle/hook, asOf }
  stocks:  [{ code,name,price,pct, per?,pbr?,dividend?,marketCap?,yutai?, ... 真facts }]
  ranking?/compare?/portfolio? : 各格式专属字段（可空）
  toneId:  口吻 → persona+配色
  bg:      { type:'procedural'|'image', id|src, motion:'scroll' }   // 钉死,可复现
  cta, subtitleSegs, 各段时长 ...
}
```

## 背景系统（公共库）

```
背景库 = [
  {type:'procedural', id:'JpReportBg'|'JpBroadcastBg'|'RakutenBg'|'JpBg'|...},  // 现有全纳入
  {type:'image', src, motion:'scroll', ...},                                    // 本地/动态图库
]
```
- 中心组件 `背景层(bg)` 派发渲染：procedural→动画组件；image→`<Img>`+长图滚动(translateY)+暗化遮罩(矮图降级推拉)
- 背景与口吻解耦（口吻给默认背景，可换库内任意）
- **取图必须生成前(node)做完→下载→路径钉进 props**（保证同条视频可复现；差异体现在视频之间）

## 扩展工作流（新增「文案模板」）

```
① 布局: 现有格式够用→复用; 不够→用 Remotion 做新格式组件(读契约字段)  ←一次性
② 手动支持: 写「解析适配器」(文本→契约)；AI支持: 加一条题材/角度配置
③ 背景: 默认从公共库选(图/程序化)；想要全新动画背景才用 Remotion 做一个进库
④ 口吻: 复用现有4种 or 加 tone 配置
→ 新格式自动 × 所有口吻 × 所有背景 × (AI|手动)
```

## 文件落点

```
新建(全新AI管线):  scripts/ai/{net-h2.js✅, feed-yahoo.js✅, select.js, compose.js, generate-ai.js, bg-provider.js}
                   config/{themes,formats,tones}.json + 兼容矩阵
                   src/components/BackgroundLayer.tsx (背景派发渲染)
复用(只读不改):    scripts/jp-quote.js(株探补字段), jp-tts.js, jp-variant.js, src/compositions/pro/*
绝不碰(手动):      jp-generate.js 手动分支, jp-parser.js, src/compositions/JpNisa*(jp原件), /api/parse-scripts
server:           新增 /api/generate-ai 走新管线; 旧 /api/generate 手动分支保留
```

## 手动隔离 + 阶段2 统一

- 阶段1：建 AI 三层 + 顺手定好统一契约；手动维持现状（已做"手动模板列表与 content-presets 解耦"）
- 阶段2：重写手动 parser 吐同一契约 → 手动切到共享 格式+口吻+背景 库 → 退役旧 NISA 栈
- 切换有两道保险：①统一契约 ②回归 fixtures（历史文案跑，旧的没坏才过）

## 验证

雅虎接口实抓✅ → 单条端到端出片 → 三层矩阵抽样各出一条 → 手动回归（逐帧对比证明没被波及）

## 进度

- [x] **C. 雅虎 feed 实抓打通**：`net-h2.js`(h2传输) + `feed-yahoo.js`(50+榜单, 实时数据已验证 exit0)
- [x] **统一 Script 契约定义**：`scripts/ai/contract.js`(validate + 字段即场景)
- [x] **三层配置 + 矩阵**：`config/{themes(6),formats(5),tones(4)}.json` + `scripts/ai/layers.js`(矩阵=90合法组合, 验证exit0)
- [x] **select(选股)**：`scripts/ai/{quote.js(株探富字段),select.js}`，实时数据验证(急騰/高配当 各3只真facts) exit0
- [x] **compose(组稿·真数据先行)**：`scripts/ai/{deepseek.js,compose.js}`，**端到端实跑成功**(select→DeepSeek→统一Script，真数据/口吻/合规/金额铁律全验证 exit0)；key 在 .env(git已忽略)
- [x] **通用渲染合成 AiVideo**：`src/compositions/AiVideo.tsx`(format×tone派发) + `scripts/ai/render-adapter.js`(Script→props)；静帧验证正交渲染正确(JP_INSIGHT主题+JpStockScene卡片+真数据+AI字幕) exit0
- [x] **generate-ai 完整编排**：`scripts/ai/generate-ai.js`(选股→组稿→TTS→静态服务托管音频→bundle→renderMedia)。**实跑出片成功**：MP4 h264 1080×1920 + aac 62.3s，真数据/AI日语/TTS全验证 exit0
- [x] **server + 前端接入**：jp-server `/api/ai/layers` + `/api/ai/generate`(复用jobs/SSE)；前端三层选择器(题材×格式×口吻+股数+矩阵约束)替换旧AI UI，generate()路由到aiGenerate。**在软件内端到端验证**：UI点击→子进程→SSE进度→面板内<video>播放 exit0
- [x] **背景系统**：`config/backgrounds.json` + `scripts/ai/bg-provider.js`(双文件夹顺序轮选/不重复/循环+零依赖读图尺寸) + `src/compositions/bg/ImageBg.tsx`(长图上下滚动+顶部静态+遮罩) + AiVideo 按 props.bg 覆盖 theme.Bg(图片/程序化/默认)。验证：轮选 exit0、滚动早晚帧明显不同、Studio 默认props带图片背景可预览。public/backgrounds/{top,scroll} + README
- [~] 旧 AI 清扫：**已注销旧 AI 模板** JpMangaVideo/JpOverlayVideo(Root)，手动 JpNisaVideo 回归渲染通过。**深层清扫(jp-generate imitate分支/content-presets/前端死代码)与手动共用文件，留作单独一轮配手动回归做**
