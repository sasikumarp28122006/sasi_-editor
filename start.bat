@echo off
title Sasi Portfolio - Multi-Tier Web Server
echo ======================================================================
echo           SASI PORTFOLIO — ENTERPRISE MULTI-TIER WEB SERVER
echo ======================================================================

set "NODE_CMD=node"

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    goto :launch
)

if exist "C:\Users\acer\AppData\Local\ms-playwright-go\1.57.0\node.exe" (
    set "NODE_CMD=C:\Users\acer\AppData\Local\ms-playwright-go\1.57.0\node.exe"
    goto :launch
)

echo.
echo [ERROR] Node.js was not detected in system PATH.
echo Please install Node.js (v20+) from https://nodejs.org
echo.
pause
goto :end

:launch
echo Starting server on http://localhost:3000 ...
echo Opening Owner Dashboard in browser...
start "" "http://localhost:3000/owner.html"
"%NODE_CMD%" server.js

:end
