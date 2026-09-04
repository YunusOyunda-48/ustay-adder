@echo off
title ustaY Bypass Adder Bot
color 0E
echo ustaY Bypass Adder Bot Baslatiliyor...
echo.
echo Lutfen bekleyin, islemler arka planda yapiliyor...
echo.

node "%~dp0add-game.mjs" %1 --bypass

echo.
pause
