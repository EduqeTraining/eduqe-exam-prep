@echo off
setlocal
cd /d "%~dp0"
title Eduqe Exam Preparation Platform
echo ===================================================
echo   Starting Eduqe Exam Preparation Platform...
echo ===================================================
echo.
echo Opening browser to http://localhost:3000 ...
start http://localhost:3000
echo.
echo Eduqe server is running on http://localhost:3000
echo (Keep this terminal window open while using Eduqe)
echo Press Ctrl+C to stop the server anytime.
echo.
node src/server.js
pause
