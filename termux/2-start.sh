#!/usr/bin/env bash
# الخطوة 2: تشغيل الموقع + إعادة تشغيله تلقائيًا إذا وقع
# الاستخدام:  bash termux/2-start.sh        (اتركه يعمل — أو يُستدعى من الإقلاع)
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$PWD"
PORT="${PORT:-3000}"
LOG="$ROOT/logs/termux.log"
mkdir -p "$ROOT/logs" "$ROOT/data"

termux-wake-lock 2>/dev/null || true
export NODE_ENV=production
export PORT
export APP_TZ="${APP_TZ:-Asia/Damascus}"

echo "=== بدء التشغيل $(date '+%Y-%m-%d %H:%M:%S') على المنفذ $PORT ===" >> "$LOG"

while true; do
  node "$ROOT/node_modules/next/dist/bin/next" start -H 0.0.0.0 -p "$PORT" >> "$LOG" 2>&1
  code=$?
  echo "=== توقّف السيرفر (رمز $code) — إعادة التشغيل بعد 5 ثوان ===" >> "$LOG"
  sleep 5
done
