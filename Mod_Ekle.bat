@echo off
title ustaY Adder Bot
color 0A
echo ustaY Adder Bot Baslatiliyor...
echo.
echo Lutfen bekleyin, islemler arka planda yapiliyor...
echo.

node "%~dp0add-game.mjs" %1

echo.
pause
