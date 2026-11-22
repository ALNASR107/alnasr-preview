/**
 * فحص صحة التشغيل — مناسب لمراقبة الإنتاج (UptimeRobot / Docker healthcheck).
 * GET /api/health  →  200 إن كان التطبيق يعمل، 503 إن كان هناك خلل كبير.
 *
 * هذا المسار عام (بدون تسجيل دخول) ولا يكشف أي بيانات شخصية.
 */
import { NextResponse } from 'next/server';
import { pendingForSheet, sheetTotals } from '@/lib/sheet';
import { autoPostState } from '@/lib/auto-post';
import { hasStoredSession, waWebState } from '@/lib/integrations/wa-web';
import { DATA_DIR, fileSize } from '@/lib/store';
import { ensureBoot } from '@/lib/boot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  ensureBoot(); // يضمن تشغيل المجدول حتى قبل أي زيارة للواجهة
  const wa = waWebState();
  const totals = sheetTotals();
  const auto = autoPostState();

  const issues: string[] = [];
  if (!auto.enabled) issues.push('الترحيل التلقائي معطّل');
  if (hasStoredSession() && wa.status !== 'connected') issues.push(`واتساب: ${wa.status}`);
  if (totals.rowsValid === false) issues.push('سطور شيت غير سليمة');
  if (process.env.DEMO_MODE === '1') issues.push('DEMO_MODE مفعّل — أوقفه في الإنتاج');

  const body = {
    ok: true,
    status: issues.length ? 'degraded' : 'healthy',
    issues,
    uptimeSec: Math.round(process.uptime()),
    now: new Date().toISOString(),
    version: process.env.APP_VERSION ?? '1.0.0',
    sheet: { lines: totals.count, debit: totals.debit, credit: totals.credit, pending: pendingForSheet().length },
    whatsapp: { status: wa.status, stored: hasStoredSession(), me: wa.me ?? null },
    autoPost: {
      enabled: auto.enabled,
      intervalMin: auto.intervalMin,
      running: auto.running,
      lastRun: auto.lastRuns[0]?.at ?? null,
      lastAdded: auto.lastRuns[0]?.added ?? null,
    },
    storage: { dir: DATA_DIR, sheetBytes: fileSize('sheet-lines') },
  };

  return NextResponse.json(body, { status: 200 });
}
