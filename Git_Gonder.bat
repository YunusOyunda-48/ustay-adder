@echo off
setlocal enabledelayedexpansion
title ustaY Git Gonderici
color 0B
chcp 65001 >nul

cd /d "%~dp0"

echo ======================================================
echo            ustaY Git Gonderici (Push)
echo ======================================================
echo.

:: Mevcut degisiklikleri kisa ozet olarak goster
echo [DEGISIKLIKLER]:
git status -s
echo.

set "msg="
set /p "msg=Commit Aciklamasi (Enter = auto): "

:: Eger Enter'a basip bos gecerse "auto" yap
if not defined msg set "msg=auto"
if "%msg%"=="" set "msg=auto"

echo.
echo [1/3] Dosyalar ekleniyor (git add -A)...
git add -A

echo.
echo [2/3] Degisiklikler kaydediliyor: "%msg%"...
git commit -m "%msg%"

echo.
echo [3/3] GitHub'a yukleniyor (git push)...
git push

if %ERRORLEVEL% EQU 0 (
    color 0A
    echo.
    echo ======================================================
    echo    [BASARILI] Tum islemler GitHub'a gonderildi!
    echo ======================================================
) else (
    echo.
    echo ======================================================
    echo    [BILGI] Islem tamamlandi veya gonderilecek yeni veri yok.
    echo ======================================================
)

echo.
pause
