#!/usr/bin/env bash
# الخطوة 1: تحضير Termux + تنصيب الحزم + بناء الموقع  (مرة واحدة فقط)
# الاستخدام:  bash termux/1-setup.sh
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$PWD"

say() { printf '\n\033[1;36m%s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m%s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m%s\033[0m\n' "$*"; exit 1; }

say "1) تحديث حزم Termux…"
pkg update -y && pkg upgrade -y || die "فشل التحديث. تحقق من الإنترنت."

say "2) تنصيب Node.js وأدوات مساعدة…"
pkg install -y nodejs-lts termux-api unzip curl || die "فشل تنصيب الحزم."

command -v node >/dev/null || die "Node غير مثبت."
say "Node: $(node -v)  |  npm: $(npm -v)"

say "3) منع النوم (Wake lock)…"
termux-wake-lock 2>/dev/null && echo "تم تثبيت Wake lock (يمنع النظام من إيقاف Termux)." \
  || warn "لم يعمل termux-wake-lock — ثبّت تطبيق Termux:API من F-Droid."

if [ ! -d "$ROOT/node_modules" ]; then
  say "4) تنصيب حزم المشروع (يحتاج إنترنت، قد يأخذ 5-15 دقيقة)…"
  npm install --no-audit --no-fund || die "فشل npm install."
else
  say "4) حزم المشروع موجودة."
fi

mkdir -p "$ROOT/logs" "$ROOT/data"

if [ ! -d "$ROOT/.next" ]; then
  say "5) بناء نسخة التشغيل (قد يأخذ 5-20 دقيقة على الموبايل)…"
  export NODE_OPTIONS="--max-old-space-size=2048"
  if ! npm run build; then
    warn "فشل البناء — إذا ظهر خطأ عن SWC جرّب:"
    echo "   npm i -D @next/swc-wasm-nodejs"
    echo "   npm run build"
    die "البناء لم يكتمل."
  fi
else
  say "5) نسخة التشغيل (.next) موجودة مسبقًا."
fi

say "6) تجهيز التشغيل التلقائي عند إقلاع الموبايل…"
mkdir -p "$HOME/.termux/boot"
cp "$ROOT/termux/boot-start.sh" "$HOME/.termux/boot/amanah-start.sh"
chmod +x "$HOME/.termux/boot/amanah-start.sh" "$ROOT"/termux/*.sh
echo "تم نسخ سكربت الإقلاع إلى ~/.termux/boot/"

say "✅ انتهى التحضير. الخطوة التالية:"
echo "   bash termux/2-start.sh"
echo
echo "مهم: ثبّت تطبيق Termux:Boot من F-Droid، وافتحه مرة واحدة ليسمح للتشغيل التلقائي."
