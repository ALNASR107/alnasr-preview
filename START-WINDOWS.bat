@echo off
chcp 65001 >nul
title شركة النصر — العمليات
cd /d "%~dp0"

echo ============================================
echo   شركة النصر — نظام العمليات المالية
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [خطأ] Node.js غير مثبّت على هذا الجهاز.
  echo نزّل النسخة LTS من: https://nodejs.org/ar
  echo ثبّتها ^(Next, Next, Finish^) ثم شغّل هذا الملف مرة أخرى.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do echo [OK] Node.js %%v

if not exist "node_modules" (
  echo.
  echo [1/3] تثبيت الحزم لأول مرة ^(يحتاج إنترنت — دقيقة إلى ثلاث^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [خطأ] فشل تثبيت الحزم. تأكد من الإنترنت ثم أعد المحاولة.
    pause
    exit /b 1
  )
)

if exist ".next" if not exist ".next\nasr-build-20261122-currency" rmdir /s /q ".next"

if not exist ".next" (
  echo.
  echo [2/3] تجهيز نسخة التشغيل ^(البناء^)...
  setlocal
  set "WA_AUTO_CONNECT=0"
  call npm run build
  if errorlevel 1 (
    echo [خطأ] فشل البناء.
    pause
    exit /b 1
  )
  endlocal
  echo built>".next\nasr-build-20261122-currency"
)

echo.
echo [3/3] تشغيل الموقع...
echo.
echo   افتح المتصفح على:  http://localhost:3000
echo   أو من الجوال على نفس الشبكة:  http://IP-الجهاز:3000
echo.
echo   لإيقاف الموقع: اضغط Ctrl + C في هذه النافذة
echo   لا تغلق هذه النافذة أثناء العمل — واتساب يعمل من خلالها.
echo ============================================
echo.

start "" http://localhost:3000
call npm run start
pause
