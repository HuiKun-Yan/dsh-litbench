@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [LitBench] Node.js not found in PATH.
  pause
  exit /b 1
)
netstat -ano | findstr ":8788" | findstr "LISTENING" >nul 2>nul
if errorlevel 1 (
  echo [LitBench] starting server on 127.0.0.1:8788 ...
  start "LitBench server" /min cmd /c "node server.js"
  timeout /t 2 >nul
) else (
  echo [LitBench] server already listening on 8788.
)
start "" "http://127.0.0.1:8788/"
exit /b 0
