@echo off
setlocal
cd /d "%~dp0"
set "LOUNGE_NODE="
for /f "delims=" %%I in ('where node 2^>nul') do if not defined LOUNGE_NODE set "LOUNGE_NODE=%%I"
if not defined LOUNGE_NODE set "LOUNGE_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%LOUNGE_NODE%" (
  echo Node.js was not found.
  echo Install Node.js 22 or later, then run this file again.
  pause
  exit /b 1
)
"%LOUNGE_NODE%" -e "if(Number(process.versions.node.split('.')[0])<22)process.exit(1)"
if errorlevel 1 (
  echo Node.js 22 or later is required. Please update Node.js.
  pause
  exit /b 1
)
if not defined PORT set "PORT=3210"
echo Starting Lounge Poker. Your browser will open when the server is ready.
echo Press Ctrl+C in this window to stop the server.
echo Friends on the same network must use this computer's local IP, not localhost.
if not defined LOUNGE_NO_BROWSER start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "$loungeUrl='http://localhost:'+([int]$env:PORT); for($loungeAttempt=0;$loungeAttempt -lt 30;$loungeAttempt++){try{$loungeResponse=Invoke-WebRequest -UseBasicParsing -Uri $loungeUrl -TimeoutSec 1; if($loungeResponse.StatusCode -eq 200){Start-Process $loungeUrl; break}}catch{}; Start-Sleep -Milliseconds 300}"
"%LOUNGE_NODE%" server.mjs
pause
