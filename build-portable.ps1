###############################################################################
# build-portable.ps1 — JP Manga Studio 离线整合包 构建脚本
#
#   作用：在【有网络】的机器上运行一次，产出一个自包含的离线整合包：
#         dist\jp-manga-studio-portable.zip
#
#   客户拿到后：解压 → 双击「启动.bat」即可使用。
#     · 无需联网、无需安装 Node/Python/FFmpeg/Git（全部便携内置）
#     · 不污染系统、不与已有环境冲突（彻底规避 Node24 等问题）
#     · app/ 是完整 git 仓库，日常仍可在软件内「立即更新」（走国内源）
#
#   用法： 右键本文件 →「使用 PowerShell 运行」 （或在已 npm install 的项目里执行）
###############################################################################
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ROOT     = $PSScriptRoot
$REPO_URL = 'https://github.com/yechongyi-dot/jp-manga-studio.git'
$NODEV    = '20.18.3'
$PYV      = '3.12.7'
$BUILD    = Join-Path $env:TEMP 'jpms-portable-build'
$PKG      = 'jp-manga-studio-portable'
$PKGDIR   = Join-Path $BUILD $PKG
$OUTDIR   = Join-Path $ROOT 'dist'

function Step($n, $msg) { Write-Host "`n[$n/8] $msg" -ForegroundColor Cyan }
function DL($urls, $dest) {
  foreach ($u in $urls) {
    try {
      Write-Host "    下载 $u" -ForegroundColor DarkGray
      (New-Object Net.WebClient).DownloadFile($u, $dest)
      if ((Test-Path $dest) -and (Get-Item $dest).Length -gt 0) { return }
    } catch { Write-Host "      该源失败，尝试下一个…" -ForegroundColor DarkYellow }
  }
  throw "下载失败（所有源都不可用）: $($urls -join '  |  ')"
}

Write-Host "======== JP Manga Studio 离线整合包构建 ========" -ForegroundColor Green

# ── 前置检查：项目必须已 npm install ────────────────────────────────────────
if (-not (Test-Path "$ROOT\node_modules\remotion")) {
  throw "未检测到 node_modules（或缺 remotion）。请先在项目里执行 npm install 再运行本脚本。"
}

# ── 0. 准备目录 ──────────────────────────────────────────────────────────────
Step 0 '准备构建目录'
Remove-Item $BUILD -Recurse -Force -ErrorAction SilentlyContinue
$null = New-Item -ItemType Directory -Force $PKGDIR, "$PKGDIR\runtime", $OUTDIR

# ── 1. 便携 Node ─────────────────────────────────────────────────────────────
Step 1 "便携 Node v$NODEV"
$nz = "$BUILD\node.zip"
DL @("https://registry.npmmirror.com/-/binary/node/v$NODEV/node-v$NODEV-win-x64.zip",
     "https://nodejs.org/dist/v$NODEV/node-v$NODEV-win-x64.zip") $nz
Expand-Archive $nz "$BUILD\node-ex" -Force
Copy-Item "$BUILD\node-ex\node-v$NODEV-win-x64" "$PKGDIR\runtime\node" -Recurse -Force
Write-Host "  [OK] $(& "$PKGDIR\runtime\node\node.exe" -v)" -ForegroundColor Green

# ── 2. 便携 FFmpeg（ffmpeg + ffprobe）────────────────────────────────────────
Step 2 '便携 FFmpeg'
$fz = "$BUILD\ffmpeg.zip"
DL @("https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip") $fz
Expand-Archive $fz "$BUILD\ffmpeg-ex" -Force
$ffbin = (Get-ChildItem "$BUILD\ffmpeg-ex" -Recurse -Filter ffmpeg.exe | Select-Object -First 1).DirectoryName
$null = New-Item -ItemType Directory -Force "$PKGDIR\runtime\ffmpeg"
Copy-Item "$ffbin\ffmpeg.exe", "$ffbin\ffprobe.exe" "$PKGDIR\runtime\ffmpeg" -Force
Write-Host "  [OK] ffmpeg + ffprobe" -ForegroundColor Green

# ── 3. 便携 Python + edge-tts ────────────────────────────────────────────────
Step 3 "便携 Python v$PYV + edge-tts"
$pz = "$BUILD\python.zip"
DL @("https://registry.npmmirror.com/-/binary/python/$PYV/python-$PYV-embed-amd64.zip",
     "https://www.python.org/ftp/python/$PYV/python-$PYV-embed-amd64.zip") $pz
Expand-Archive $pz "$PKGDIR\runtime\python" -Force
# embeddable 默认禁用 site-packages，需启用才能用 pip 装的包
$pthFile = (Get-ChildItem "$PKGDIR\runtime\python\python*._pth" | Select-Object -First 1).FullName
(Get-Content $pthFile) -replace '^#\s*import site', 'import site' | Set-Content $pthFile
DL @("https://bootstrap.pypa.io/get-pip.py") "$BUILD\get-pip.py"
& "$PKGDIR\runtime\python\python.exe" "$BUILD\get-pip.py" --no-warn-script-location -q
& "$PKGDIR\runtime\python\python.exe" -m pip install edge-tts -i https://pypi.tuna.tsinghua.edu.cn/simple --no-warn-script-location -q
& "$PKGDIR\runtime\python\python.exe" -c "import edge_tts" ; if ($LASTEXITCODE -ne 0) { throw 'edge-tts 安装验证失败' }
Write-Host "  [OK] Python + edge-tts" -ForegroundColor Green

# ── 4. 便携 Git（MinGit，供软件内「立即更新」git pull 使用）──────────────────
Step 4 '便携 Git (MinGit)'
$gz = "$BUILD\mingit.zip"
DL @("https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/MinGit-2.47.1-64-bit.zip") $gz
Expand-Archive $gz "$PKGDIR\runtime\git" -Force
Write-Host "  [OK] MinGit" -ForegroundColor Green

# ── 5. 项目代码（git clone 本地仓库 → 干净 HEAD + .git，便于软件内更新）──────
Step 5 '项目代码 (app/)'
& "$PKGDIR\runtime\git\cmd\git.exe" clone --quiet $ROOT "$PKGDIR\app"
& "$PKGDIR\runtime\git\cmd\git.exe" -C "$PKGDIR\app" remote set-url origin $REPO_URL
& "$PKGDIR\runtime\git\cmd\git.exe" -C "$PKGDIR\app" config --add safe.directory "*"
Write-Host "  [OK] 代码 $(& "$PKGDIR\runtime\git\cmd\git.exe" -C "$PKGDIR\app" log -1 --format='%h %s')" -ForegroundColor Green

# ── 6. node_modules（复制现有，客户端免 npm install）─────────────────────────
Step 6 'node_modules（复制现有依赖）'
robocopy "$ROOT\node_modules" "$PKGDIR\app\node_modules" /E /NFL /NDL /NJH /NJS /NP /MT:16 | Out-Null
if ($LASTEXITCODE -ge 8) { throw "node_modules 复制失败 (robocopy code=$LASTEXITCODE)" }
Write-Host "  [OK] node_modules" -ForegroundColor Green

# ── 7. 启动器 启动.bat ───────────────────────────────────────────────────────
Step 7 '生成 启动.bat'
$launcher = @"
@echo off
chcp 65001 >nul
title JP Manga Studio
rem Portable runtime first, to isolate client's existing Node/Python/Git.
rem NOTE: keep this .bat pure ASCII. GBK Chinese under chcp 65001 corrupts
rem       byte sequences and breaks command parsing (server fails to start).
set "DIR=%~dp0"
set "PATH=%DIR%runtime\node;%DIR%runtime\ffmpeg;%DIR%runtime\python;%DIR%runtime\python\Scripts;%DIR%runtime\git\cmd;%PATH%"
cd /d "%DIR%app"
echo Starting JP Manga Studio, please wait...
start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3020"
:loop
"%DIR%runtime\node\node.exe" jp-server.js
rem exit code 123 = in-app update asked for a restart; relaunch the server.
if errorlevel 124 goto stopped
if errorlevel 123 ( timeout /t 2 /nobreak >nul & goto loop )
:stopped
echo.
echo Server stopped. Press any key to close.
pause >nul
"@
# 启动.bat 用 GBK(Default) 写入，确保中文 Windows 的 cmd 正确解析（chcp 65001 在内部切换）
[System.IO.File]::WriteAllText("$PKGDIR\启动.bat", $launcher, [System.Text.Encoding]::Default)

$readme = @"
JP Manga Studio 离线整合包
==========================

【使用方法】
  1. 把本文件夹整个解压到 D:\ 等位置（路径建议不含空格）
  2. 双击「启动.bat」
  3. 稍候浏览器自动打开 http://localhost:3020 即可使用

【特点】
  · 已内置 Node / Python / FFmpeg / Git 与全部依赖，无需联网、无需安装
  · 不会修改系统环境，可随时整个文件夹删除

【日常更新】
  软件界面顶部出现更新提示时，点「立即更新」即可（走国内源，轻量）。

【常见问题】
  · 杀毒软件拦截：把本文件夹加入白名单后重试。
  · 端口被占用：关闭占用 3020/3021 端口的程序后重启。
"@
[System.IO.File]::WriteAllText("$PKGDIR\使用说明.txt", $readme, [System.Text.Encoding]::Default)
Write-Host "  [OK] 启动.bat + 使用说明.txt" -ForegroundColor Green

# ── 8. 打包 zip ──────────────────────────────────────────────────────────────
Step 8 '打包 zip（文件多，请耐心等待）'
$zip = "$OUTDIR\$PKG.zip"
Remove-Item $zip -Force -ErrorAction SilentlyContinue
# Compress-Archive(PS5.1)も .NET CreateFromDirectory(.NET Framework)も、Windows では
# \ 区切りの非標準 zip を生成し、7-Zip/WinRAR で解凍するとフォルダ構造が壊れる。
# Windows 10+ 同梱の tar(bsdtar)は標準 zip(/ 区切り)を生成するためこれを使う。
& tar.exe -a -c -f $zip -C $BUILD $PKG
if ($LASTEXITCODE -ne 0) { throw "zip 打包失败 (tar code=$LASTEXITCODE)" }

$sizeGB = [math]::Round((Get-Item $zip).Length / 1GB, 2)
Write-Host "`n======== 构建完成 ========" -ForegroundColor Green
Write-Host "  产出: $zip" -ForegroundColor Green
Write-Host "  大小: $sizeGB GB" -ForegroundColor Green
Write-Host "  分发: 上传网盘 / 拷 U 盘给客户，解压双击「启动.bat」即用" -ForegroundColor Green
Remove-Item $BUILD -Recurse -Force -ErrorAction SilentlyContinue
exit 0  # robocopy は成功時も $LASTEXITCODE=1 を残すため、明示的に 0 で正常終了
