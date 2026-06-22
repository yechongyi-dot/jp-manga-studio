###############################################################################
# JP Manga Studio - One-click installer
# Installs Node.js / Python / FFmpeg / Git automatically, deploys to D:\jp-manga-studio
###############################################################################

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ── Auto-elevate ──────────────────────────────────────────────────────────
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")) {
    Start-Process powershell "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

function Download-File($url, $dest) {
    Write-Host "    -> $([System.IO.Path]::GetFileName($dest))" -ForegroundColor Gray
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $lastErr = ""
    for ($i = 1; $i -le 3; $i++) {
        try {
            $wc = New-Object Net.WebClient
            $wc.Headers.Add("User-Agent", "Mozilla/5.0")
            $wc.DownloadFile($url, $dest)
            if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 0)) { return }
            $lastErr = "下载文件为空"
        } catch {
            $lastErr = $_.Exception.Message
            Write-Host "    下载失败(第 $i/3 次)，重试中… $lastErr" -ForegroundColor DarkYellow
            Start-Sleep -Seconds 2
        }
    }
    throw "下载失败（已重试3次）: $url`n$lastErr"
}

Write-Host ""
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "    JP Manga Studio - Installer" -ForegroundColor Cyan
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host ""

# ────────────────────────────────────────────────────────────────────────
# Step 1: Node.js
# ────────────────────────────────────────────────────────────────────────
Write-Host "  [1/6] Node.js (固定 v20 LTS)" -ForegroundColor Yellow
Refresh-Path
$nodeVer = ""
try { $nodeVer = (node -v 2>&1).ToString().Trim() } catch {}

if ($nodeVer -match '^v20\.') {
    # 既に v20 系 — そのまま使用（Remotion が安定動作する推奨バージョン）
    Write-Host "  [OK] Node.js $nodeVer" -ForegroundColor Green
} else {
    # v20 以外（未インストール or v24 等）。v24 は Remotion でプロセスがハングするため v20 に統一する
    if ($nodeVer -match '^v\d+') {
        Write-Host "  現在の Node $nodeVer は非推奨。v20 へ入れ替えます（既存をアンインストール中）..." -ForegroundColor Yellow
        $existing = Get-ItemProperty `
            "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*", `
            "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*" `
            -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "Node.js*" }
        foreach ($e in $existing) {
            try { Start-Process msiexec -ArgumentList "/x `"$($e.PSChildName)`" /qn /norestart" -Wait -NoNewWindow } catch {}
        }
        Refresh-Path
    }
    Write-Host "  Installing Node.js 20 LTS..." -ForegroundColor Yellow
    $nodeUrl = "https://nodejs.org/dist/v20.18.3/node-v20.18.3-x64.msi"
    try {
        $rel = (Invoke-RestMethod "https://nodejs.org/dist/index.json" -TimeoutSec 10) | Where-Object { $_.version -like "v20.*" } | Select-Object -First 1
        if ($rel) { $nodeUrl = "https://nodejs.org/dist/$($rel.version)/node-$($rel.version)-x64.msi" }
    } catch {}
    $nodeTmp = "$env:TEMP\node-v20-installer.msi"
    Download-File $nodeUrl $nodeTmp
    Start-Process msiexec -ArgumentList "/i `"$nodeTmp`" /qn /norestart" -Wait -NoNewWindow
    Remove-Item $nodeTmp -Force -ErrorAction SilentlyContinue
    Refresh-Path
    try {
        $v = (node -v 2>&1).ToString().Trim()
        if ($v -notmatch '^v20\.') { throw "version mismatch: $v" }
        Write-Host "  [OK] Node.js $v installed" -ForegroundColor Green
    } catch {
        Write-Host "  [ERROR] Node.js 20 install failed. Manual: https://nodejs.org/download/release/latest-v20.x/" -ForegroundColor Red
        Read-Host "  Press Enter to exit"; exit 1
    }
}

# ────────────────────────────────────────────────────────────────────────
# Step 2: Python
# ────────────────────────────────────────────────────────────────────────
Write-Host "  [2/6] Python" -ForegroundColor Yellow
Refresh-Path
$pyOk = $false
try {
    $v = (python --version 2>&1).ToString().Trim()
    if ($v -match 'Python \d+') { $pyOk = $true; Write-Host "  [OK] $v" -ForegroundColor Green }
} catch {}

if (-not $pyOk) {
    Write-Host "  Installing Python 3.12..." -ForegroundColor Yellow
    $pyTmp = "$env:TEMP\python-installer.exe"
    # 官方源 + 国内镜像（国内访问 python.org 常超时）
    $pyUrls = @(
        "https://www.python.org/ftp/python/3.12.7/python-3.12.7-amd64.exe",
        "https://mirrors.huaweicloud.com/python/3.12.7/python-3.12.7-amd64.exe"
    )
    $dl = $false
    foreach ($u in $pyUrls) {
        try { Download-File $u $pyTmp; $dl = $true; break } catch { Write-Host "    该源失败，尝试下一个镜像…" -ForegroundColor DarkYellow }
    }
    if (-not $dl) {
        Write-Host "  [ERROR] Python 安装包下载失败（网络问题）。请检查网络，或手动安装 https://www.python.org 后重新运行。" -ForegroundColor Red
        Read-Host "  Press Enter to exit"; exit 1
    }
    $proc = Start-Process $pyTmp -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_pip=1" -Wait -NoNewWindow -PassThru
    Remove-Item $pyTmp -Force -ErrorAction SilentlyContinue
    Refresh-Path
    # 验证：先试 PATH，失败再查常见安装目录（PrependPath 写注册表后当前进程有时读不到）
    $pyExe = $null
    try { if ((& python --version 2>&1) -match 'Python \d+') { $pyExe = "python" } } catch {}
    if (-not $pyExe) {
        foreach ($p in @("$env:ProgramFiles\Python312\python.exe", "$env:LocalAppData\Programs\Python\Python312\python.exe", "C:\Python312\python.exe")) {
            if (Test-Path $p) { $env:Path = (Split-Path $p) + ";" + (Split-Path $p) + "\Scripts;" + $env:Path; $pyExe = $p; break }
        }
    }
    if ($pyExe) {
        $v = (& $pyExe --version 2>&1).ToString().Trim()
        Write-Host "  [OK] $v installed" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] Python 安装失败 (installer 退出码=$($proc.ExitCode))。可能被杀毒软件拦截，请放行安装程序后重试，或手动安装 https://www.python.org" -ForegroundColor Red
        Read-Host "  Press Enter to exit"; exit 1
    }
}

# ────────────────────────────────────────────────────────────────────────
# Step 3: FFmpeg
# ────────────────────────────────────────────────────────────────────────
Write-Host "  [3/6] FFmpeg" -ForegroundColor Yellow
Refresh-Path
$ffmpegOk = $false
try { $null = ffmpeg -version 2>&1; $ffmpegOk = $true; Write-Host "  [OK] FFmpeg" -ForegroundColor Green } catch {}

if (-not $ffmpegOk) {
    Write-Host "  Installing FFmpeg..." -ForegroundColor Yellow
    $ffUrl  = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
    $ffTmp  = "$env:TEMP\ffmpeg.zip"
    $ffEx   = "$env:TEMP\ffmpeg-ex"
    $ffDest = "D:\tools\ffmpeg"
    Download-File $ffUrl $ffTmp
    Write-Host "  Extracting..." -ForegroundColor Gray
    if (Test-Path $ffEx) { Remove-Item $ffEx -Recurse -Force }
    Expand-Archive $ffTmp -DestinationPath $ffEx -Force
    $binDir = Get-ChildItem $ffEx -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1 | ForEach-Object { $_.DirectoryName }
    if ($binDir) {
        New-Item -ItemType Directory -Force $ffDest | Out-Null
        Copy-Item "$binDir\*" $ffDest -Force
        $syspath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
        if ($syspath -notlike "*$ffDest*") {
            [System.Environment]::SetEnvironmentVariable("Path", "$syspath;$ffDest", "Machine")
        }
        Write-Host "  [OK] FFmpeg installed to $ffDest" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] FFmpeg extraction failed" -ForegroundColor Yellow
    }
    Remove-Item $ffTmp, $ffEx -Recurse -Force -ErrorAction SilentlyContinue
    Refresh-Path
}

# ────────────────────────────────────────────────────────────────────────
# Step 4: Git
# ────────────────────────────────────────────────────────────────────────
Write-Host "  [4/6] Git" -ForegroundColor Yellow
Refresh-Path
$gitOk = $false
try {
    $v = (git --version 2>&1).ToString().Trim()
    if ($v -match 'git version') { $gitOk = $true; Write-Host "  [OK] $v" -ForegroundColor Green }
} catch {}

if (-not $gitOk) {
    Write-Host "  Installing Git for Windows..." -ForegroundColor Yellow
    $gitUrl = "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/Git-2.47.1-64-bit.exe"
    $gitTmp = "$env:TEMP\git-installer.exe"
    Download-File $gitUrl $gitTmp
    Start-Process $gitTmp -ArgumentList "/VERYSILENT /NORESTART /NOCANCEL /SP- /COMPONENTS=icons,ext\reg\shellhere,assoc,assoc_sh" -Wait -NoNewWindow
    Remove-Item $gitTmp -Force -ErrorAction SilentlyContinue
    Refresh-Path
    try {
        $v = (git --version 2>&1).ToString().Trim()
        Write-Host "  [OK] $v installed" -ForegroundColor Green
    } catch {
        Write-Host "  [ERROR] Git install failed. Please install manually: https://git-scm.com" -ForegroundColor Red
        Read-Host "  Press Enter to exit"; exit 1
    }
}

# ────────────────────────────────────────────────────────────────────────
# Step 5: edge-tts
# ────────────────────────────────────────────────────────────────────────
Write-Host "  [5/6] edge-tts" -ForegroundColor Yellow
Refresh-Path
try {
    & python -m pip install edge-tts --quiet -i https://pypi.tuna.tsinghua.edu.cn/simple
    Write-Host "  [OK] edge-tts" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] edge-tts install failed: $_" -ForegroundColor Yellow
}

# ────────────────────────────────────────────────────────────────────────
# Step 6: Clone / update project + npm install
# ────────────────────────────────────────────────────────────────────────
$REPO_URL    = "https://github.com/yechongyi-dot/jp-manga-studio.git"
$INSTALL_DIR = "D:\jp-manga-studio"

Write-Host "  [6/6] JP Manga Studio -> $INSTALL_DIR" -ForegroundColor Yellow
Refresh-Path
# 管理者/一般ユーザー切替時の dubious ownership エラーを回避
& git config --global --add safe.directory $INSTALL_DIR

if (Test-Path "$INSTALL_DIR\.git") {
    # Already a proper git repo — 强制同步（app 为只读分发物，避免本地改动/行尾差异令 pull 失败）
    Write-Host "  Updating to latest version..." -ForegroundColor Yellow
    & git -C $INSTALL_DIR fetch origin master
    & git -C $INSTALL_DIR reset --hard origin/master
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] git update failed" -ForegroundColor Red
        Read-Host "  Press Enter to exit"; exit 1
    }
    Write-Host "  [OK] Updated" -ForegroundColor Green
} elseif (Test-Path "$INSTALL_DIR\jp-server.js") {
    # Installed via ZIP (no .git) — convert to git repo in-place
    # This preserves output/ temp/ and other untracked user files
    Write-Host "  Converting existing install to git repo..." -ForegroundColor Yellow
    Set-Location $INSTALL_DIR
    & git init
    & git remote add origin $REPO_URL
    & git fetch origin
    & git reset --hard origin/master
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] git setup failed" -ForegroundColor Red
        Read-Host "  Press Enter to exit"; exit 1
    }
    Write-Host "  [OK] Converted and updated" -ForegroundColor Green
} else {
    # Fresh install — clone
    Write-Host "  Cloning repository..." -ForegroundColor Yellow
    # 削除前にユーザーデータ（output / app-config.json）を退避し、データ消失を防ぐ
    $backup = $null
    if (Test-Path $INSTALL_DIR) {
        $backup = "$env:TEMP\jpms-backup-$(Get-Random)"
        New-Item -ItemType Directory -Force -Path $backup | Out-Null
        if (Test-Path "$INSTALL_DIR\output")          { Move-Item "$INSTALL_DIR\output"          $backup -Force -ErrorAction SilentlyContinue }
        if (Test-Path "$INSTALL_DIR\app-config.json") { Move-Item "$INSTALL_DIR\app-config.json" $backup -Force -ErrorAction SilentlyContinue }
        Remove-Item $INSTALL_DIR -Recurse -Force
    }
    & git clone $REPO_URL $INSTALL_DIR
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] git clone failed. Check network." -ForegroundColor Red
        Read-Host "  Press Enter to exit"; exit 1
    }
    Write-Host "  [OK] Cloned" -ForegroundColor Green
    # 退避したユーザーデータを復元
    if ($backup -and (Test-Path $backup)) {
        if (Test-Path "$backup\output")          { Move-Item "$backup\output"          $INSTALL_DIR -Force -ErrorAction SilentlyContinue }
        if (Test-Path "$backup\app-config.json") { Move-Item "$backup\app-config.json" $INSTALL_DIR -Force -ErrorAction SilentlyContinue }
        Remove-Item $backup -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# npm install
Write-Host "  Installing npm dependencies (~5 min)..." -ForegroundColor Yellow
Set-Location $INSTALL_DIR
Refresh-Path
$npmCmd = $null
try { $npmCmd = (Get-Command npm -ErrorAction Stop).Source } catch {}
if (-not $npmCmd) {
    foreach ($p in @("C:\Program Files\nodejs\npm.cmd", "C:\Program Files (x86)\nodejs\npm.cmd")) {
        if (Test-Path $p) { $npmCmd = $p; break }
    }
}
if (-not $npmCmd) {
    Write-Host "  [ERROR] npm not found. Restart and try again." -ForegroundColor Red
    Read-Host "  Press Enter to exit"; exit 1
}
& $npmCmd install --registry=https://registry.npmmirror.com
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] npm install failed" -ForegroundColor Red
    Read-Host "  Press Enter to exit"; exit 1
}
Write-Host "  [OK] npm dependencies installed" -ForegroundColor Green

# ── Desktop shortcut ──────────────────────────────────────────────────────
try {
    $ws  = New-Object -ComObject WScript.Shell
    $lnk = $ws.CreateShortcut("$env:USERPROFILE\Desktop\JP Manga Studio.lnk")
    $lnk.TargetPath       = "wscript.exe"
    $lnk.Arguments        = "`"$INSTALL_DIR\start.vbs`""
    $lnk.WorkingDirectory = $INSTALL_DIR
    $lnk.IconLocation     = "C:\Windows\System32\shell32.dll,136"
    $lnk.Description      = "JP Manga Studio"
    $lnk.Save()
    Write-Host "  [OK] Desktop shortcut created" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Shortcut failed. Run manually: $INSTALL_DIR\start.vbs" -ForegroundColor Yellow
}

# ── Done ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ================================================" -ForegroundColor Green
Write-Host "    Installation complete! Launching..." -ForegroundColor Green
Write-Host "  ================================================" -ForegroundColor Green
Write-Host ""
# start.vbs がサーバー起動とブラウザ起動（3秒後）を担当するため、ここでは二重に開かない
Start-Process "wscript.exe" -ArgumentList "`"$INSTALL_DIR\start.vbs`""
Read-Host "  Press Enter to exit"
