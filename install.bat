@echo off
title JP Manga Studio Installer
echo.
echo ================================================
echo   JP Manga Studio - Installer
echo ================================================
echo.

echo [..] Downloading install.ps1...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='%~dp0install.ps1'; [Net.ServicePointManager]::SecurityProtocol=3072; try { $r=Invoke-RestMethod 'https://api.github.com/repos/yechongyi-dot/jp-manga-studio/contents/install.ps1' -Headers @{'User-Agent'='jp-installer'}; $b=[Convert]::FromBase64String(($r.content -replace \"`n\",'')); [IO.File]::WriteAllBytes($p,$b); Write-Host '  [OK]' -ForegroundColor Green } catch { try { (New-Object Net.WebClient).DownloadFile('https://raw.githubusercontent.com/yechongyi-dot/jp-manga-studio/master/install.ps1',$p); Write-Host '  [OK]' -ForegroundColor Green } catch { Write-Host '  [FAIL] Check network.' -ForegroundColor Red; exit 1 }}"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Failed to download install.ps1. Check your network and try again.
    echo https://github.com/yechongyi-dot/jp-manga-studio
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
pause
exit /b 0
