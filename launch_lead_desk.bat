@echo off
cd /d "%~dp0"

:: Check if server is already running on port 8080
powershell -NoProfile -Command "try { $r = [System.Net.WebRequest]::Create('http://127.0.0.1:8080/api/status'); $resp = $r.GetResponse(); $resp.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    start /b "" python server.py >nul 2>&1
    timeout /t 2 /nobreak >nul
)

:: Flags:
:: --app=URL launches dedicated clean desktop window
:: --use-fake-ui-for-media-stream completely bypasses browser microphone permission pop-up!
:: --unsafely-treat-insecure-origin-as-secure=http://127.0.0.1:8080 enables full media API permissions
set "TARGET_URL=http://127.0.0.1:8080"
set "APP_FLAGS=--app=%TARGET_URL% --use-fake-ui-for-media-stream --unsafely-treat-insecure-origin-as-secure=http://127.0.0.1:8080"

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" %APP_FLAGS%
    exit
)
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" %APP_FLAGS%
    exit
)
if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" %APP_FLAGS%
    exit
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" %APP_FLAGS%
    exit
)

:: Fallback to default browser
start "" "%TARGET_URL%"
exit
