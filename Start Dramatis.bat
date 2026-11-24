@echo off
title Dramatis
cd /d "%~dp0"

rem Runs Dramatis on this PC at http://localhost:3000 (set PORT to use another port).
rem Characters and presets stay in this browser on this PC. They are separate from the
rem online version, so use Export / Import on the Characters page to move them across.

where npm.cmd >nul 2>&1
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\npm.cmd" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
  ) else (
    echo Node.js was not found. Trying to install it with winget...
    where winget >nul 2>&1
    if errorlevel 1 goto :nonode
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if not exist "%ProgramFiles%\nodejs\npm.cmd" goto :nonode
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
  )
)

if not exist node_modules (
  echo Installing dependencies, this only happens once...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo Installation failed. Please check the error message above.
    pause
    exit /b 1
  )
)

if not defined PORT set "PORT=3000"
rem "Generate with Alembic" opens the online Alembic unless you point it somewhere else.
if not defined VITE_ALEMBIC_URL set "VITE_ALEMBIC_URL=https://thatbio.vercel.app/tools/alembic/"

echo Starting Dramatis on http://localhost:%PORT% ...
echo Keep this window open while you use Dramatis. Close it to stop.
echo.

rem Open the browser as soon as the server answers (waits up to a minute).
if not defined NO_BROWSER start "" /b powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='http://localhost:%PORT%/'; for($i=0;$i -lt 120;$i++){ try { Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process $u; break } catch { Start-Sleep -Milliseconds 500 } }"

call npm.cmd run dev
if errorlevel 1 pause
exit /b

:nonode
echo.
echo Node.js could not be installed automatically. Please install it from https://nodejs.org/ and try again.
start https://nodejs.org/
pause
exit /b 1
