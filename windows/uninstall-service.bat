@echo off
chcp 65001 >nul
title إزالة خدمة «شركة النصر — العمليات»
cd /d "%~dp0.."
set "SERVICE=AlNasrOps"

net session >nul 2>nul
if errorlevel 1 (
  echo [خطأ] شغّل هذا الملف كمسؤول ^(Run as administrator^).
  pause & exit /b 1
)

echo إيقاف الخدمة وإزالتها...
if exist "tools\nssm.exe" (
  "tools\nssm.exe" stop %SERVICE% >nul 2>nul
  "tools\nssm.exe" remove %SERVICE% confirm >nul 2>nul
) else (
  sc stop %SERVICE% >nul 2>nul
  sc delete %SERVICE% >nul 2>nul
)

netsh advfirewall firewall delete rule name="AlNasr Ops 3000" >nul 2>nul

echo.
echo تم إزالة الخدمة. الملفات والبيانات في مجلد data لم تُحذف.
echo لتشغيل الموقع يدويًا استخدم START-WINDOWS.bat
echo.
pause
