@echo off
title Sasi Portfolio - Multi-Tier Web Server
echo Starting Sasi Portfolio Application Server...

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    node server.js
    goto :end
)

if exist "C:\Users\acer\AppData\Local\ms-playwright-go\1.57.0\node.exe" (
    "C:\Users\acer\AppData\Local\ms-playwright-go\1.57.0\node.exe" server.js
    goto :end
)

echo Node.js not detected in PATH. Please install Node.js from https://nodejs.org
pause

:end
