@echo off
title IdleNyah - Cozy Maid Estate
cd /d "%~dp0"

echo ========================================================
echo   Launching IdleNyah for Master...
echo ========================================================
echo.

call npm.cmd run dev -- --open

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Game encountered an issue or was terminated.
    pause
)
