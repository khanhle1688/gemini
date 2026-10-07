@echo off
chcp 65001 > nul
title Gemini Ultra 20s - Local Stitcher & Auto Cleaner
color 0b
echo ==============================================================================
echo        🎬 GEMINI ULTRA 20S - LOCAL STITCHER & AUTO CLEANER
echo ==============================================================================
echo.
echo [*] Dang kiem tra Node.js va FFmpeg...
node -v > nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Khong tim thay Node.js! Vui long cai dat Node.js.
    pause
    exit /b
)

ffmpeg -version > nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Khong tim thay FFmpeg tren may tinh!
    pause
    exit /b
)

echo [OK] He thong san sang! Dang khoi chay bo xu ly tai may...
echo.
node client/local_bridge.js
pause
