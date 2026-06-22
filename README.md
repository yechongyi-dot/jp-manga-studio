# JP Manga Studio

日本股票短视频批量制作工具。输入股票文案，自动生成 TTS 配音 + Remotion 动画视频，支持批量生成与多副本去重。

## 安装

### 方式一：离线整合包（推荐，给客户分发）

零联网、零安装、不污染系统 —— 已内置便携 Node / Python+edge-tts / FFmpeg / Git 与全部依赖。

1. 拿到 `jp-manga-studio-portable.zip`（网盘或 U 盘）
2. 解压到 `D:\`（路径建议不含空格）
3. 双击 **「启动.bat」** → 浏览器自动打开 `http://localhost:3020`

> 客户机器即使已装 Node 24 等也完全不受影响（便携运行时与系统隔离）。整合包由分发方用 `build-portable.ps1` 构建，见下方「构建离线包」。

### 方式二：在线安装（需联网，环境自动装）

> `install.bat` 会自动安装 Node 20 LTS、Python、FFmpeg、Git（已装则跳过）。

1. 下载 [install.bat](https://github.com/yechongyi-dot/jp-manga-studio/raw/master/install.bat)（自举，会自动拉取最新 install.ps1）
2. 右键 → **以管理员身份运行**
3. 自动检查环境 → 拉取代码 → 安装依赖 → 创建桌面快捷方式

## 日常使用

双击桌面 **JP Manga Studio** 快捷方式 → 浏览器自动打开 `http://localhost:3020`

> 首次启动需要约 30 秒加载 Remotion Studio

## 自动更新

有新版本时，界面顶部会出现更新提示，点击「立即更新」即可一键更新并重启，无需重新安装（走国内源，轻量）。

## 构建离线包（分发方）

在一台**有网络**、已 `npm install` 的机器上运行一次：

```
powershell -ExecutionPolicy Bypass -File build-portable.ps1
```

产出 `dist\jp-manga-studio-portable.zip`，上传网盘或拷 U 盘发给客户即可。脚本自动下载并打包便携 Node / Python+edge-tts / FFmpeg / MinGit 与全部依赖。

## 目录结构

```
jp-manga-studio/
├── src/              Remotion 视频模板组件
├── scripts/          生成流程脚本
├── public/           Web 操作界面 + 音效资源
├── output/           渲染输出（视频 + YouTube 素材）
├── temp/             运行时临时文件（自动管理）
├── install.bat       双击安装入口
├── install.ps1       安装脚本（PowerShell）
├── start.vbs         静默启动器（日常双击运行）
└── jp-server.js      后端服务
```

## 系统要求

| 软件 | 版本 | 说明 |
|------|------|------|
| Node.js | **20 LTS** | 服务器 & 渲染（务必用 20；Node 24 会导致渲染进程卡死）|
| FFmpeg | 任意 | 视频变体处理 |
| Python + edge-tts | 3.8+ | Edge TTS 配音 |

## 常见问题

**启动后浏览器未自动打开？**
手动访问 http://localhost:3020

**首次渲染很慢？**
初次渲染需要编译 Remotion 包（1-2分钟），之后使用缓存速度正常。

**Edge TTS 报错？**
运行 `pip install edge-tts`
