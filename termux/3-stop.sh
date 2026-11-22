#!/usr/bin/env bash
# إيقاف الموقع مؤقتًا (يبقى جاهزًا للتشغيل من جديد)
pkill -f "next/dist/bin/next" 2>/dev/null
pkill -f "termux/2-start.sh" 2>/dev/null
termux-wake-unlock 2>/dev/null || true
echo "تم الإيقاف. للتشغيل من جديد: bash termux/2-start.sh"
