@echo off
rem Double-click me to start the WordCamp Bengaluru WordPress + MCP demo on Windows.
rem Checks Node.js, installs the kit on first run, connects your AI apps, starts WordPress.
setlocal
title WordCamp Bengaluru - WordPress + MCP demo
cd /d "%~dp0"

echo.
echo   WordCamp Bengaluru 2026 - Connecting WordPress and MCP
echo   ======================================================
echo.

if not exist "package.json" goto :notunzipped

where node >nul 2>nul
if errorlevel 1 goto :nonode
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto :oldnode

if exist "node_modules\@wp-playground\cli\package.json" goto :installed
echo   First run: installing the kit. This takes 1 to 3 minutes...
echo.
call npm install
if errorlevel 1 goto :installfailed
:installed

call npm run connect
call npm start
goto :end

:notunzipped
echo   It looks like you opened this file from inside the ZIP.
echo   Right-click the ZIP file, choose "Extract All...", open the new folder
echo   and double-click Start-Windows.cmd there.
goto :end

:nonode
echo   Node.js is not installed yet. It is free and takes about 2 minutes:
echo.
echo     Option 1: open PowerShell or Command Prompt and run:
echo                 winget install OpenJS.NodeJS.LTS
echo     Option 2: download the "LTS" installer from https://nodejs.org
echo.
echo   Then close this window and double-click Start-Windows.cmd again.
goto :end

:oldnode
for /f "delims=" %%v in ('node --version') do set NODEVER=%%v
echo   Your Node.js is %NODEVER%, but this kit needs version 22 or newer.
echo.
echo     Option 1: open PowerShell or Command Prompt and run:
echo                 winget upgrade OpenJS.NodeJS.LTS
echo     Option 2: download the "LTS" installer from https://nodejs.org
echo.
echo   Then close this window and double-click Start-Windows.cmd again.
goto :end

:installfailed
echo.
echo   The install did not finish. Check your internet connection and try again.
echo   On office Wi-Fi or VPN, a company proxy may block npm: try another network.

:end
echo.
echo   You can close this window now.
pause
endlocal
