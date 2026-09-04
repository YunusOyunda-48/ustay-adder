@echo off
title ustaY Online Adder Bot
color 0B
echo ustaY Online Adder Bot Baslatiliyor...
echo.
echo Lutfen bekleyin, islemler arka planda yapiliyor...
echo.

node "%~dp0add-game.mjs" %1 --online

echo.
pause
