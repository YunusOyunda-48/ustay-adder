@echo off
title ustaY Oyun Silme Araci
color 0C
chcp 65001 >nul
echo ======================================================
echo           ustaY OYUN SILME ARACI
echo ======================================================
echo.

node "%~dp0remove-game.mjs" %1

echo.
pause
