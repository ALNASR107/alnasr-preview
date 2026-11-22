#!/usr/bin/env bash
# فحص سريع: هل الموقع شغال؟ وما حالة واتساب؟
PORT="${PORT:-3000}"
echo "— العملية:"
pgrep -af "next/dist/bin/next" || echo "  غير شغالة"
echo
echo "— الصحة:"
curl -s --max-time 8 "http://localhost:$PORT/api/health" | head -c 600
echo
echo
echo "— آخر 15 سطر من السجل:"
tail -n 15 "$(dirname "$0")/../logs/termux.log" 2>/dev/null || echo "  لا يوجد سجل بعد"
