@echo off
chcp 65001 >nul
setlocal
title تثبيت «شركة النصر — العمليات» كخدمة ويندوز
cd /d "%~dp0.."
set "ROOT=%CD%"
set "SERVICE=AlNasrOps"
set "PORT=3000"
set "NSSM=%ROOT%\tools\nssm.exe"

echo ============================================================
echo   تثبيت الموقع كخدمة تعمل تلقائيا عند اقلاع ويندوز
echo   المجلد: %ROOT%
echo ============================================================
echo.

rem ---------- 1) صلاحيات المسؤول ----------
net session >nul 2>nul
if errorlevel 1 goto :no_admin

rem ---------- 2) Node ----------
where node >nul 2>nul
if errorlevel 1 goto :no_node

set "NODE="
for /f "delims=" %%i in ('where node 2^>nul') do (
  if not defined NODE set "NODE=%%i"
)
if not defined NODE goto :no_node
echo [OK] Node: %NODE%

rem ---------- 3) الحزم ----------
if exist "node_modules" goto :skip_install
echo [1/5] تثبيت الحزم (مرة واحدة)...
call npm install --no-audit --no-fund
if errorlevel 1 goto :fail
goto :after_install
:skip_install
echo [1/5] الحزم موجودة.

:after_install
rem ---------- 4) البناء ----------
if exist ".next" goto :skip_build
echo [2/5] تجهيز نسخة التشغيل...
call npm run build
if errorlevel 1 goto :fail
goto :after_build
:skip_build
echo [2/5] نسخة التشغيل موجودة.

:after_build
rem ---------- 5) NSSM ----------
if exist "%NSSM%" goto :have_nssm
echo [3/5] تنزيل أداة الخدمة NSSM...
if not exist "tools" mkdir "tools"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0get-nssm.ps1"
if not exist "%NSSM%" goto :no_nssm
goto :nssm_ready
:have_nssm
echo [3/5] أداة NSSM موجودة.

:nssm_ready
if not exist "logs" mkdir "logs"
if not exist "data" mkdir "data"

rem ---------- 6) إنشاء الخدمة ----------
echo [4/5] إنشاء الخدمة %SERVICE% ...
"%NSSM%" stop %SERVICE% >nul 2>nul
"%NSSM%" remove %SERVICE% confirm >nul 2>nul

"%NSSM%" install %SERVICE% "%NODE%"
if errorlevel 1 goto :fail
"%NSSM%" set %SERVICE% AppParameters "node_modules\next\dist\bin\next start -H 0.0.0.0 -p %PORT%"
"%NSSM%" set %SERVICE% AppDirectory "%ROOT%"
"%NSSM%" set %SERVICE% DisplayName "شركة النصر - العمليات"
"%NSSM%" set %SERVICE% Description "نظام العمليات المالية + ربط واتساب + الترحيل التلقائي"
"%NSSM%" set %SERVICE% Start SERVICE_AUTO_START
"%NSSM%" set %SERVICE% AppStdout "%ROOT%\logs\service-out.log"
"%NSSM%" set %SERVICE% AppStderr "%ROOT%\logs\service-err.log"
"%NSSM%" set %SERVICE% AppStdoutCreationDisposition 4
"%NSSM%" set %SERVICE% AppStderrCreationDisposition 4
"%NSSM%" set %SERVICE% AppRotateFiles 1
"%NSSM%" set %SERVICE% AppRotateBytes 10485760
"%NSSM%" set %SERVICE% AppExit Default Restart
"%NSSM%" set %SERVICE% AppRestartDelay 5000
rem ملاحظة: لا نغيّر DATA_DIR ولا WA_AUTH_DIR حتى تستخدم الخدمة نفس مجلدات التشغيل اليدوي
"%NSSM%" set %SERVICE% AppEnvironmentExtra "NODE_ENV=production" "PORT=%PORT%" "APP_TZ=Asia/Damascus"

rem ---------- 7) جدار الحماية ----------
echo [5/5] فتح المنفذ %PORT% في جدار الحماية...
netsh advfirewall firewall delete rule name="AlNasr Ops %PORT%" >nul 2>nul
netsh advfirewall firewall add rule name="AlNasr Ops %PORT%" dir=in action=allow protocol=TCP localport=%PORT% >nul

rem ---------- 8) التشغيل ----------
"%NSSM%" start %SERVICE%
timeout /t 5 /nobreak >nul

echo.
echo ============================================================
echo   تم التثبيت بنجاح. الخدمة تعمل الآن وتعمل عند كل اقلاع.
echo.
echo   الموقع:        http://localhost:%PORT%
echo   من الشبكة:     http://IP-الجهاز:%PORT%
echo   ادارة الخدمة:   services.msc  (ابحث عن: شركة النصر - العمليات)
echo   السجلات:       %ROOT%\logs
echo.
echo   ايقاف:  net stop %SERVICE%
echo   تشغيل:  net start %SERVICE%
echo   ازالة:  windows\uninstall-service.bat  (كمسؤول)
echo ============================================================
start "" http://localhost:%PORT%
echo.
pause
exit /b 0

:no_admin
echo [خطأ] شغّل هذا الملف كمسؤول: انقر يمين على الملف ثم "Run as administrator".
pause
exit /b 1

:no_node
echo [خطأ] Node.js غير مثبّت أو غير موجود في PATH.
echo نزّله من https://nodejs.org/ar (نسخة LTS) ثم أعد تشغيل الجهاز وحاول مرة أخرى.
pause
exit /b 1

:no_nssm
echo [تنبيه] تعذّر تنزيل NSSM تلقائيا.
echo نزّله يدويا من https://nssm.cc/download
echo وفكّ الضغط وانسخ win64\nssm.exe إلى مجلد tools داخل المشروع، ثم أعد تشغيل هذا الملف.
pause
exit /b 1

:fail
echo.
echo [خطأ] توقّف التثبيت. راجع الرسالة أعلاه.
pause
exit /b 1
